/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @NDescription Client Script que alerta cuando múltiples usuarios están editando Leads con el mismo número de documento
 * @author Gerardo Gonzalez
 */

define(['N/runtime', 'N/search', 'N/ui/message'], 
    function(runtime, search, message) {

    let alertBanner = null;
    let checkInterval = null;
    let currentDocNumber = null;
    let currentUserId = null;
    let currentLeadId = null;

    /**
     * pageInit - Función ejecutada cuando se inicializa la página
     * @param {Object} context
     * @param {Record} context.currentRecord - Registro actual del formulario
     */
    function pageInit(context) {
        try {
            const record = context.currentRecord;
            currentDocNumber = record.getValue({ fieldId: 'custentity_sdb_nrdocumento' });
            currentUserId = runtime.getCurrentUser().id;
            currentLeadId = record.id;

            console.log('ELM_ConcurrentEditAlert_CS - pageInit iniciado');
            console.log('Documento:', currentDocNumber);
            console.log('Usuario:', currentUserId);
            console.log('Lead ID:', currentLeadId);

            // Solo verificar si estamos en modo edición y tenemos un número de documento
            if (context.mode === 'edit' && currentDocNumber && currentLeadId) {
                startConcurrentEditCheck();
            }

        } catch (error) {
            console.error('Error en pageInit:', error.message);
        }
    }

    
    /**
     * Inicia la verificación periódica de edición concurrente
     */
    function startConcurrentEditCheck() {
        try {
            console.log('Iniciando verificación de edición concurrente para documento:', currentDocNumber);
            
            // Verificar inmediatamente
            checkConcurrentEdit();
            
            // Configurar verificación periódica cada 30 segundos
            checkInterval = setInterval(function() {
                checkConcurrentEdit();
            }, 30000);

        } catch (error) {
            console.error('Error al iniciar verificación de edición concurrente:', error.message);
        }
    }

    /**
     * Detiene la verificación periódica de edición concurrente
     */
    function stopConcurrentEditCheck() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        
        // Remover banner de alerta si existe
        if (alertBanner) {
            alertBanner.hide();
            alertBanner = null;
        }
    }

    /**
     * Verifica si hay otros usuarios editando Leads con el mismo número de documento
     */
    function checkConcurrentEdit() {
        try {
            if (!currentDocNumber || !currentLeadId) {
                return;
            }


            // Buscar otros Leads con el mismo número de documento que estén siendo editados
            const leadSearch = search.create({
                type: search.Type.LEAD,
                filters: [
                    ['custentity_sdb_nrdocumento', 'is', currentDocNumber],
                    'AND',
                    //["custentity_elm_aprobado","anyof","24","23","5","10"],
                    ["custentity_elm_aprobado","anyof","23","25","7","10"],
                    'AND',
                    ["internalid", "noneof", currentLeadId]
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid'
                    }),
                    search.createColumn({
                        name: 'entityid'
                    }),
                    search.createColumn({
                        name: 'datecreated'
                    }),
                    search.createColumn({
                        name: 'lastmodifieddate'
                    }),
                    search.createColumn({
                        name: 'custentity_elm_operador'
                    }),
                    search.createColumn({
                        name: 'custentity_elm_aprobado'
                    })
                ]
            });

            const searchResults = leadSearch.run().getRange({ start: 0, end: 10 });
            
            
            if (searchResults.length > 0) {
                console.log('Se encontraron', searchResults.length, 'Leads adicionales con el mismo documento');
                
                let foundLeads = [];
                
                searchResults.forEach(function(result) {
                    const lastModifiedStr = result.getValue('lastmodifieddate');
                    const lastModifiedBy = result.getText('custentity_elm_operador') || 'Usuario desconocido';
                    const leadId = result.getValue('internalid');
                    const leadName = result.getValue('entityid');
                    const leadApproved = result.getText('custentity_elm_aprobado');

                    let lastModified;
                    try {
                        // NetSuite devuelve fechas como strings, necesitamos convertirlas
                        lastModified = new Date(lastModifiedStr);
                        
                        if (isNaN(lastModified.getTime())) {
                            console.log('❌ Fecha inválida, usando fecha actual');
                            lastModified = new Date();
                        }
                        
                    } catch (error) {
                        console.error('Error parseando fecha:', error);
                        lastModified = new Date(); // Usar fecha actual como fallback
                    }
                    
                    // Agregar todos los Leads encontrados sin validación de tiempo
                    foundLeads.push({
                        id: leadId,
                        name: leadName,
                        lastModified: lastModified,
                        lastModifiedBy: lastModifiedBy,
                        approved: leadApproved
                    });
                });
                
               
                // Mostrar alerta si se encontró cualquier Lead con el mismo documento
                if (foundLeads.length > 0) {
                    showConcurrentEditAlert(foundLeads);
                } else {
                    hideConcurrentEditAlert();
                }
            } else {
                // Si no hay otros Leads, ocultar la alerta
                hideConcurrentEditAlert();
            }

        } catch (error) {
            console.error('Error verificando edición concurrente:', error.message);
        }
    }

    /**
     * Muestra la alerta de edición concurrente
     * @param {Array} concurrentLeads - Array de Leads que están siendo editados concurrentemente
     */
    function showConcurrentEditAlert(concurrentLeads) {
        try {
            // Si ya hay una alerta mostrada, no crear otra
            if (alertBanner) {
                return;
            }

            let alertMessage = '⚠️ ATENCIÓN: ';
            
            if (concurrentLeads.length === 1) {
                const lead = concurrentLeads[0];
                alertMessage += `Se detectó otro Lead (${lead.name}) con el mismo número la cédula (${currentDocNumber}).  En el estado: ${lead.approved}. `;
                alertMessage += `Último usuario que lo modificó: "${lead.lastModifiedBy}" el ${formatDate(lead.lastModified)}.`;
            } else {
                alertMessage += `Se detectaron ${concurrentLeads.length} Leads adicionales con el mismo número de la cédula (${currentDocNumber}): `;
                concurrentLeads.forEach(function(lead, index) {
                    if (index > 0) alertMessage += ', ';
                    alertMessage += `${lead.lastModifiedBy} (${lead.name})`;
                });
            }

            alertMessage += ' Por favor, coordine con el/los otro(s) usuario(s) para evitar conflictos de datos.';

            // Crear y mostrar el banner de alerta
            alertBanner = message.create({
                title: 'LEAD Duplicado Detectado',
                message: alertMessage,
                type: message.Type.INFORMATION
            });

            alertBanner.show({
                duration: 0 // Mostrar indefinidamente hasta que se oculte manualmente
            });

        } catch (error) {
            console.error('Error mostrando alerta de edición concurrente:', error.message);
        }
    }

    /**
     * Oculta la alerta de edición concurrente
     */
    function hideConcurrentEditAlert() {
        if (alertBanner) {
            alertBanner.hide();
            alertBanner = null;
        }
    }

    /**
     * Formatea una fecha para mostrar en la alerta
     * @param {Date} date - Fecha a formatear
     * @returns {string} - Fecha formateada
     */
    function formatDate(date) {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        return date.toLocaleString('es-ES', options);
    }

    /**
     * saveRecord - Función ejecutada antes de guardar el registro
     * @param {Object} context
     * @returns {boolean} - true para permitir guardar, false para cancelar
     */
    function saveRecord(context) {
        try {
            // Detener verificación al guardar
            stopConcurrentEditCheck();
            
            // Permitir guardar el registro
            return true;

        } catch (error) {
            console.error('Error en saveRecord:', error.message);
            return true; // Permitir guardar incluso si hay error
        }
    }

    // Exponer las funciones públicas
    return {
        pageInit: pageInit,
        saveRecord: saveRecord
    };
});
