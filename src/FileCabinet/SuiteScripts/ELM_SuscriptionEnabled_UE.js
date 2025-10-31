/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define(['N/record', 'N/error'], (record, error) => {


     /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function assigned a available seller to the lead when it is approved.
     * @param {object} scriptContext 
     */
      const afterSubmit = (scriptContext) => {
        const { newRecord, type } = scriptContext;
         try {

            if (type != scriptContext.UserEventType.CREATE) {
               return;
            }

            const rec = record.load({
               type: record.Type.LEAD,
               id: newRecord.id,
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

         } catch (e) {
            throw error.create({
               name: 'ELM_SuscriptionEnabled_UE_AFTERSUBMIT_ERROR',
               message: `Some error occurred when subscribing to the user to newsletters: ${e.message}`,
               notifyUser: true,
            });
         }
      };
   
   




        
      return { 
        afterSubmit 
    };
   });
