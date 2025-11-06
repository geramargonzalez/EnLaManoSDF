/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/error'], function (record, search, error) {

        
        /**
         * @author  Gerardo Gonzalez
         * @desc getInputData - This function gets all the leads in the day.
         */
        function getInputData() {
            const logTitle = 'Get Input Data';
            try {
                log.debug(logTitle, '**** START *****');
                const customerSearchObj = search.create({
                    type: "customer",
                    filters:
                    [
                        ["email","isnotempty",""], 
                        "AND", 
                        ["custentity_elm_lead_repetido_original","anyof","@NONE@"], 
                        "AND", 
                        ["datecreated","within","today"]
                    ],
                    columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"})
                    ]
                    });
                    const searchResultCount = customerSearchObj.runPaged().count;
                    log.debug("customerSearchObj result count", searchResultCount);
                return customerSearchObj;
            } catch (e) {
                log.error(logTitle, e.message);
                 throw error.create({
                name: 'ELM_SuscriptionEnabled_STAGE_GET_INPUT_DATA_ERROR',
                message: `Some error occurred when subscribing to the user to newsletters: ${e.message}`,
                notifyUser: true,
                });
            }
        }
        /**
         * @author  Gerardo Gonzalez
         * @desc map - This function updates the lead subscription status.
         * @param {object} scriptContext 
         */
        function map(context) {
            const logTitle = 'Map';
            try {
                log.debug(logTitle, 'MAP context: ' + JSON.stringify(context));
                const leadForSubscription = JSON.parse(context.value);
                const rec = record.load({
                    type: record.Type.LEAD,
                    id: leadForSubscription.id,
                    isDynamic: false
                });
            const globalsubscriptionstatus = rec.getValue({ fieldId: 'globalsubscriptionstatus' });
            log.debug('globalsubscriptionstatus', globalsubscriptionstatus);
            if (globalsubscriptionstatus == '2') {
                log.audit('Omitido', `Lead ${newRecord.id} está UNSUBSCRIBED globalmente`);
                rec.setValue({
                    fieldId: 'globalsubscriptionstatus',
                    value: 1
                });
            }
           const boletinesLineIndex = rec.findSublistLineWithValue({
               sublistId: 'subscriptions',
               fieldId: 'subscription',
               value: "4"
            });
            
            if (boletinesLineIndex !== -1) {
               rec.setSublistValue({
                  sublistId: 'subscriptions', 
                  fieldId: 'subscribed', 
                  line: boletinesLineIndex,
                  value: true 
               });
               log.audit('Actualizado', `Lead suscrito a Boletines (línea ${boletinesLineIndex})`);
            } else {
               log.debug('Info', 'No se encontró la suscripción "Boletines"');
            }
            rec.save({ ignoreMandatoryFields: true });

            log.audit(logTitle, 'Lead ' + leadForSubscription.id + ' procesado correctamente');
            } catch (e) {
                log.error(logTitle, e.message);
                throw error.create({
                name: 'ELM_SuscriptionEnabled_STAGE_MAP_ERROR',
            message: `Some error occurred when subscribing to the user ${leadForSubscription.id} to newsletters: ${e.message}`,
                notifyUser: true,
                });
            }
        }
        /**
         * @author  Gerardo Gonzalez
         * @desc summarize - This function logs the summary of the Map/Reduce execution.
         * @param {object} summary
         */
        function summarize(summary) {
            const logTitle = 'Summarize';
            try {
                log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
