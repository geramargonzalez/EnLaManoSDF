/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/error'], function (record, search, error) {
         
        /**
         * getInputData - This function is executed at the beginning of the Map/Reduce process
         * @returns {Object} - Search object to be processed in the Map stage
         */
        function getInputData() {
            const logTitle = 'Get Input Data';
            try {
                log.debug(logTitle, '**** START *****');
                const customrecord_elm_serv_logsSearchObj = search.create({
                    type: "customrecord_elm_serv_logs",
                    filters:
                    [
                        ["created","before","thirtydaysago"]
                    ],
                    columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
                    });
               const searchResultCount = customrecord_elm_serv_logsSearchObj.runPaged().count;
               log.debug("customrecord_elm_serv_logsSearchObj result count",searchResultCount);
                return customrecord_elm_serv_logsSearchObj;
            } catch (e) {
                throw error.create({
                    name: 'ERROR_GET_INPUT_DATA',
                    message: 'Something Failed When Retrieved The Data: ' + e.message,
                    notifyOff: false
                });
            }
        }
        /**
         * map - this function deletes the record from the system
         * @param {Object} context
         */
        function map(context) {
            const logTitle = 'Map';
            try {
                const servicioAudit = JSON.parse(context.value);
                const idLog = record.delete({
                    type: 'customrecord_elm_serv_logs',
                    id: servicioAudit?.id
                });
                log.audit(logTitle, 'Record Deleted Successfully: ' + idLog);
            } catch (e) {
                throw error.create({
                    name: 'ERROR_MAP',
                    message: 'Something Failed When Try to Remove Servicio Log Audit: ' + e.message,
                    notifyOff: false
                });
            }
        }
        /**
         * summarize - This function is executed at the end of the Map/Reduce process
         * @param {Object} summary - Summary of the Map/Reduce process
         */
        function summarize(summary) {
            let logTitle = 'Summarize';
            log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
