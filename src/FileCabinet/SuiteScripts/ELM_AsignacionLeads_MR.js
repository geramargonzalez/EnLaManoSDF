/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/runtime', 'N/error'],
    function (record, search, runtime, error) {
         
        function getInputData() {
            const logTitle = 'Get Input Data';
            try {
                log.debug(logTitle, '**** START *****');
                const qtyTotalLeads = runtime.getCurrentScript().getParameter({ name: 'custscript_elm_qty_assigned' });
                const employeeLeadCounts = [];
                const employeesSearch = search.create({
                    type: 'employee',
                    filters: [
                        ['custentity_elm_activo', 'is', 'T']
                    ]
                }); 
                const searchResultCount = employeesSearch.runPaged().count;
                log.debug("employeeSearchObj result count",searchResultCount);
                const leadsSearch = search.create({
                    type: 'lead',
                    filters: [
                        ["stage", "anyof", "LEAD"],
                        "AND",
                        ["custentity_elm_aprobado", "anyof", "2", "3"],
                        "AND",
                        ["custentity_elm_operador", "anyof", "@NONE@"],
                        "AND",
                        ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"],
                        "AND",
                        ["custentity_elm_batch_id", "isempty", ""]
                    ]
                }).run().getRange({ start: 0, end: 1000 });

                // Recorrer los empleados y contar los leads asignados a cada uno
                // y asignar leads a cada empleado
                employeesSearch.run().each(function (employee) {
                    const employeeId = employee.id;
                    const currentLeadCount = search.create({
                        type: 'lead',
                        filters: [
                            ["stage", "anyof", "LEAD"],
                            "AND",
                            ['custentity_elm_operador', 'anyof', employeeId],
                            "AND",
                            ["custentity_elm_aprobado", "anyof","2", "3"],
                            "AND",
                            ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"], 
                            "AND", 
                            ["custentity_elm_batch_id","isempty",""]
                        ]
                    }).runPaged().count;

                    log.debug('currentLeadCount', currentLeadCount);
                    
                    if (currentLeadCount < qtyTotalLeads) {
                        // Si ya tiene 20 leads o más, no asignamos más
                        employeeLeadCounts.push({
                            employeeId: employeeId,
                            currentLeadCount: currentLeadCount
                        });
                    }

                    return true; // Continue iterating through the results
                });

                log.debug('employeeLeadCounts', employeeLeadCounts);

                let remainingLeads = leadsSearch.length;  // Total de leads sin asignar
                let leadIndex = 0;

                const arrObjs = [];

                employeeLeadCounts.forEach(function (employeeData) {
                    const employeeId = employeeData.employeeId;
                    log.debug('employeeId', employeeId);
                    let currentLeadCount = employeeData.currentLeadCount;

                    // Calcular cuántos leads más se pueden asignar a este empleado
                    let assignableLeads = Math.min(qtyTotalLeads - currentLeadCount, remainingLeads);
                    log.debug('assignableLeads', assignableLeads);
                    let leadsToAssign = leadsSearch.slice(leadIndex, leadIndex + assignableLeads);
                    log.debug('leadsToAssign', leadsToAssign);
                    leadIndex += assignableLeads;
                    remainingLeads -= assignableLeads;
                    let obj = {
                        employee: employeeId,
                        arrLeads: leadsToAssign
                    };
                    arrObjs.push(obj);
                });
                return arrObjs;
            } catch (e) {
                throw error.create({
                    name: 'ERROR_GET_INPUT_DATA',
                    message: 'Something Failed When Retrieved the data: ' + e.message,
                    notifyOff: false
                });
            }
        }
 
        function map(context) {
            let logTitle = 'Map';
            try {
                let inputData = JSON.parse(context.value);
                let employeeId = inputData.employee;
                let leads = inputData.arrLeads;
                context.write(employeeId, leads);
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        function reduce(context) {
            let logTitle = 'Reduce';
            try {
                let employeeId = context.key;
                let leadIds = context.values.map(function (leadSet) {
                    return JSON.parse(leadSet);
                });
                // Asignar los leads a este empleado
                leadIds[0].forEach(function (leadId) {
                    try {
                        record.submitFields({
                            type: 'lead',
                            id: leadId.id,
                            values: {
                                custentity_elm_operador: employeeId
                            }
                        });
                        log.audit('Lead Assigned', 'Lead ' + leadId.id + ' assigned to employee ' + employeeId);
                    } catch (e) {
                        log.error('Error assigning lead', 'Lead ID: ' + leadId + ', Error: ' + e.message);
                    }
                });
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        function summarize(summary) {
            let logTitle = 'Summarize';
            log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
