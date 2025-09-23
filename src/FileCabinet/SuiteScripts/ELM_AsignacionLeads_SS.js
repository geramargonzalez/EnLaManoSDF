/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description Script programado para asignar leads a operadores disponibles
 */

define(['N/record', 'N/search', 'N/runtime', 'N/error'],
    function (record, search, runtime, error) {

        function execute(context) {
            const logTitle = 'ELM Asignación Leads - Scheduled';
            
            try {
                log.audit(logTitle, '**** INICIO DE ASIGNACIÓN DE LEADS ****');
                
                // Obtener parámetros del script
                const scriptObj = runtime.getCurrentScript();
                const qtyTotalLeads = parseInt(scriptObj.getParameter({ name: 'custscript_elm_qty_assigned' })) || 20;
                const batchSize = parseInt(scriptObj.getParameter({ name: 'custscript_elm_batch_size' })) || 100;
                const idAvailable = scriptObj.getParameter({ name: 'custscript_elm_id_available' }) || 1;
                
                log.debug('Parámetros', { qtyTotalLeads: qtyTotalLeads, batchSize: batchSize, idAvailable: idAvailable });

                // 1. Obtener la cola de vendedores disponibles UNA SOLA VEZ
                let availableSellers = getAvailableSeller({ idAvailable: idAvailable });
                if (!availableSellers || availableSellers.length === 0) {
                    log.audit(logTitle, 'No hay vendedores configurados en la lista de disponibles.');
                    return;
                }
                log.debug('Cola de vendedores inicial', availableSellers);

                // 2. Obtener datos de empleados activos y sus cupos
                const employeesData = getActiveEmployees(qtyTotalLeads, availableSellers);
                if (employeesData.length === 0) {
                    log.audit(logTitle, 'No hay empleados disponibles para asignar leads (todos han alcanzado su capacidad máxima).');
                    return;
                }
                log.debug('Empleados con cupo disponible', employeesData);

                // 3. Obtener leads sin asignar
                const unassignedLeads = getUnassignedLeads(batchSize);
                if (unassignedLeads.length === 0) {
                    log.audit(logTitle, 'No hay leads para asignar.');
                    return;
                }
                log.debug('Leads sin asignar encontrados', unassignedLeads.length);

                // 4. Distribuir leads entre empleados
                const assignments = distributeLeads(employeesData, unassignedLeads);
                log.debug('Plan de distribución de leads', assignments);

                // 5. Procesar asignaciones y recolectar IDs de empleados que recibieron leads
                let totalAssigned = 0;
                const employeesWhoReceivedLeads = new Set();
                assignments.forEach(function(assignment) {
                    const assignedCount = processAssignment(assignment.employeeId, assignment.leads);
                    if (assignedCount > 0) {
                        totalAssigned += assignedCount;
                        employeesWhoReceivedLeads.add(assignment.employeeId);
                    }
                });

                // 6. Actualizar la cola de vendedores (Round-Robin) UNA SOLA VEZ al final
                if (employeesWhoReceivedLeads.size > 0) {
                    updateAvailableSellersQueue(idAvailable, availableSellers, Array.from(employeesWhoReceivedLeads));
                }

                log.audit(logTitle, `**** FINALIZADO - ${totalAssigned} leads asignados ****`);

            } catch (e) {
                log.error(logTitle, 'Error en ejecución: ' + e.message);
                throw error.create({
                    name: 'ERROR_SCHEDULED_EXECUTION',
                    message: 'Error en asignación de leads: ' + e.message,
                    notifyOff: false
                });
            }
        }

        /**
         * Obtiene empleados activos y cuenta sus leads actuales.
         * @param {number} qtyTotalLeads - Cantidad máxima de leads por empleado.
         * @param {Array} availableSellers - Array con IDs de los vendedores de la cola.
         * @returns {Array} Array con datos de empleados que tienen cupo.
         */
        function getActiveEmployees(qtyTotalLeads, availableSellers) {
            const logTitle = 'getActiveEmployees';
            
            try {
                const employeesData = [];
                
                availableSellers.forEach(function(employeeId) {
                    // Contar leads actuales del empleado
                    const currentLeadCount = search.create({
                        type: 'lead',
                        filters: [
                            ["stage", "anyof", "LEAD"], "AND",
                            ['custentity_elm_operador', 'anyof', employeeId], "AND",
                            ["custentity_elm_aprobado", "anyof", "2", "3"], "AND",
                            ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"], "AND", 
                            ["custentity_elm_batch_id", "isempty", ""]
                        ]
                    }).runPaged().count; 

                    log.debug(logTitle, `Empleado ID: ${employeeId} tiene ${currentLeadCount} leads de un máximo de ${qtyTotalLeads}`);
                    
                    // Solo incluir empleados que pueden recibir más leads
                    if (currentLeadCount < qtyTotalLeads) {
                        employeesData.push({
                            employeeId: employeeId,
                            currentLeadCount: currentLeadCount,
                            availableSlots: qtyTotalLeads - currentLeadCount
                        });
                    }
                    return true;
                });

                // Ordenar por empleados con menos leads para que reciban primero
                employeesData.sort((a, b) => a.currentLeadCount - b.currentLeadCount);

                return employeesData;

            } catch (e) {
                log.error(logTitle, 'Error obteniendo empleados: ' + e.message);
                throw e;
            }
        }

        /**
         * Obtiene leads sin asignar.
         * @param {number} batchSize - Tamaño del lote a procesar.
         * @returns {Array} Array con IDs y nombres de leads.
         */
        function getUnassignedLeads(batchSize) {
            const logTitle = 'getUnassignedLeads';
            
            try {
                const leadsData = [];
                
                const leadsSearch = search.create({
                    type: 'lead',
                    filters: [
                        ["stage", "anyof", "LEAD"], "AND",
                        ["custentity_elm_aprobado", "anyof", "2", "3"], "AND",
                        ["custentity_elm_operador", "anyof", "@NONE@"], "AND",
                        ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"], "AND",
                        ["custentity_elm_batch_id", "isempty", ""]
                    ],
                    columns: ['internalid', 'entityid']
                });

                const searchResults = leadsSearch.run().getRange({ start: 0, end: batchSize });

                searchResults.forEach(function(lead) {
                    leadsData.push({
                        id: lead.getValue('internalid'),
                        name: lead.getValue('entityid')
                    });
                });

                log.debug(logTitle, `Encontrados ${leadsData.length} leads sin asignar.`);
                return leadsData;

            } catch (e) {
                log.error(logTitle, 'Error obteniendo leads: ' + e.message);
                throw e;
            }
        }

        /**
         * Distribuye leads entre empleados disponibles usando round-robin verdadero.
         * @param {Array} employeesData - Datos de empleados (ordenados por menor carga).
         * @param {Array} unassignedLeads - Leads sin asignar.
         * @returns {Array} Array con el plan de asignaciones.
         */
        function distributeLeads(employeesData, unassignedLeads) {
            const logTitle = 'distributeLeads';
            
            try {
                const assignments = [];
                
                // Crear estructura de asignaciones iniciales para cada empleado
                employeesData.forEach(function(employee) {
                    assignments.push({
                        employeeId: employee.employeeId,
                        leads: [],
                        availableSlots: employee.availableSlots
                    });
                });

                let leadIndex = 0;
                let employeeIndex = 0;

                // Distribuir leads de forma round-robin (uno por uno intercalando)
                while (leadIndex < unassignedLeads.length) {
                    // Buscar el próximo empleado que tenga cupo disponible
                    let attempts = 0;
                    const maxAttempts = employeesData.length;
                    
                    while (attempts < maxAttempts) {
                        const currentAssignment = assignments[employeeIndex];
                        
                        // Si este empleado tiene cupo disponible, asignarle el lead
                        if (currentAssignment.availableSlots > 0) {
                            currentAssignment.leads.push(unassignedLeads[leadIndex]);
                            currentAssignment.availableSlots--;
                            leadIndex++;
                            
                            log.debug(logTitle, `Lead ${leadIndex} asignado al empleado ${currentAssignment.employeeId} (cupo restante: ${currentAssignment.availableSlots})`);
                            break;
                        }
                        
                        // Pasar al siguiente empleado
                        employeeIndex = (employeeIndex + 1) % employeesData.length;
                        attempts++;
                    }

                    // Si todos los empleados están llenos, salir del bucle
                    if (attempts >= maxAttempts) {
                        log.debug(logTitle, `Todos los empleados han alcanzado su capacidad máxima. Leads restantes: ${unassignedLeads.length - leadIndex}`);
                        break;
                    }

                    // Pasar al siguiente empleado para el próximo lead (round-robin)
                    employeeIndex = (employeeIndex + 1) % employeesData.length;
                }

                // Filtrar asignaciones vacías
                const finalAssignments = assignments.filter(assignment => assignment.leads.length > 0);

                log.debug(logTitle, `Distribución round-robin completada. Leads asignados: ${leadIndex}/${unassignedLeads.length}`);
                
                // Log detallado de la distribución
                finalAssignments.forEach(function(assignment, index) {
                    log.debug(logTitle, `Empleado ${assignment.employeeId}: ${assignment.leads.length} leads asignados`);
                });

                return finalAssignments;

            } catch (e) {
                log.error(logTitle, 'Error distribuyendo leads: ' + e.message);
                throw e;
            }
        }

        /**
         * Procesa la asignación de leads a un empleado.
         * @param {string} employeeId - ID del empleado.
         * @param {Array} leads - Array de leads a asignar.
         * @returns {number} Cantidad de leads asignados exitosamente.
         */
        function processAssignment(employeeId, leads) {
            const logTitle = 'processAssignment';
            let assignedCount = 0;
            
            log.debug(logTitle, `Iniciando asignación de ${leads.length} leads al empleado ${employeeId}`);
            
            leads.forEach(function(lead) {
                try {
                    record.submitFields({
                        type: 'lead',
                        id: lead.id,
                        values: { custentity_elm_operador: employeeId }
                    });
                    
                    assignedCount++;
                    log.debug(logTitle, `Lead ${lead.name} (ID: ${lead.id}) asignado al empleado ${employeeId}`);
                                          
                } catch (e) {
                    log.error(logTitle, `Error asignando lead ${lead.id} al empleado ${employeeId}: ${e.message}`);
                }
            });

            log.audit(logTitle, `Empleado ${employeeId}: ${assignedCount}/${leads.length} leads asignados exitosamente.`);
            return assignedCount;
        }

        /**
         * Actualiza la cola de vendedores moviendo los empleados asignados al final.
         * @param {number} recordId - ID del registro custom de la cola.
         * @param {Array} currentQueue - El array original de la cola de vendedores.
         * @param {Array} assignedEmployees - Array de IDs de empleados que recibieron leads.
         */
        function updateAvailableSellersQueue(recordId, currentQueue, assignedEmployees) {
            const logTitle = 'updateAvailableSellersQueue';
            try {
                if (!Array.isArray(currentQueue) || currentQueue.length === 0) {
                    log.debug(logTitle, 'Cola actual vacía o inválida. No se actualiza.');
                    return;
                }

                if (!Array.isArray(assignedEmployees) || assignedEmployees.length === 0) {
                    log.debug(logTitle, 'No hay empleados asignados para rotar.');
                    return;
                }

                // Normalizar a string para comparaciones consistentes
                const assignedSet = new Set(assignedEmployees.map(e => String(e)));

                // Mantener el orden original de la cola para los asignados
                const assignedInQueueOrder = currentQueue.filter(id => assignedSet.has(String(id)));
                // Resto de la cola que no recibió leads
                const untouched = currentQueue.filter(id => !assignedSet.has(String(id)));

                const newQueue = untouched.concat(assignedInQueueOrder);

                record.submitFields({
                    type: 'customrecord_elm_vend_disponibles',
                    id: recordId,
                    values: {
                        custrecord_elm_vend_disp_array: JSON.stringify(newQueue)
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug(logTitle, `Cola de vendedores actualizada. Nueva cola: ${JSON.stringify(newQueue)}`);

            } catch (e) {
                // No relanzar el error para no fallar la ejecución completa si solo falla la actualización de la cola
                log.error(logTitle, `Error actualizando la cola de vendedores: ${e.message}`);
            }
        }

        /**
         * Obtiene la lista de vendedores disponibles desde el registro personalizado.
         * @param {object} objScriptParam - Contiene el ID del registro a buscar.
         * @returns {Array} Array de IDs de vendedores.
         */
        const getAvailableSeller = (objScriptParam) => {
            try {
                const fieldAvailableSeller = search.lookupFields({
                   type: 'customrecord_elm_vend_disponibles',
                   id: objScriptParam.idAvailable,
                   columns: ['custrecord_elm_vend_disp_array']
                });
                
                const sellerArray = fieldAvailableSeller.custrecord_elm_vend_disp_array;
                return sellerArray ? JSON.parse(sellerArray) : [];

            } catch (e) {
                throw error.create({
                   name: 'GET_AVAILABLE_SELLER_ERROR',
                   message: `Falló al obtener la lista de vendedores disponibles: ${e.message}`,
                   notifyUser: true,
                });
            }
        }

        return {
            execute: execute
        };
    });
