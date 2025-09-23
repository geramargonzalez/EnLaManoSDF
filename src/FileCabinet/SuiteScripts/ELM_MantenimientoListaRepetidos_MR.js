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
                const ssListaRepetidos = search.create({
                  type: "customrecord_elm_repetido_lead",
                  filters:
                  [
                          ["custrecord_elm_repetido_fecha_creado","before","lastmonthtodate"]
                  ],
                  columns:
                  [
                     search.createColumn({name: "internalid", label: "Internal ID"})
                  ]
               });
               const searchResultCount = ssListaRepetidos.runPaged().count;
               log.debug("customrecord_elm_repetido_leadSearchObj result count",searchResultCount);
                return ssListaRepetidos;
            } catch (e) {
                throw error.create({
                    name: 'ERROR_GET_INPUT_DATA',
                    message: 'Something Failed When Retrieved the data: ' + e.message,
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
                const repetidoLead = JSON.parse(context.value);
                log.debug(logTitle, 'repetidoLead: ' + JSON.stringify(repetidoLead));
                record.delete({
                    type: 'customrecord_elm_repetido_lead',
                    id: repetidoLead?.id
                });
            } catch (e) {
                throw error.create({
                    name: 'ERROR_MAP',
                    message: 'Something Failed When Try to remove  Lista Repetidos: ' + e.message,
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
