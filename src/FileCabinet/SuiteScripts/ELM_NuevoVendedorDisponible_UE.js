/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define(['N/runtime', 'N/search', 'N/error', 'N/record', "./ELM_Aux_Lib.js"],
   ( runtime, search, error, record, auxLib) => {


    /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function keeps track of the available sellers and updates the custom record when a seller is activated or deactivated.
     * @param {string} purposeName - Purpose name
     */
      const afterSubmit = (scriptContext) => {
          const {newRecord, oldRecord} = scriptContext;
         try {
        
            const objScriptParam = getScriptParameters();
            const availableSeller = getAvailableSeller(objScriptParam);
            const activo = newRecord.getValue({ fieldId: 'custentity_elm_activo' });
            const activoOld = oldRecord.getValue({ fieldId: 'custentity_elm_activo' });
                if (activo != activoOld && activo) {
                    const isElement = isElementInArray(availableSeller, newRecord.id);
                    // Add it to the end of the array
                    if (!isElement) {
                        availableSeller.push(newRecord.id);
                        const idAvailable = record.submitFields({
                            type: 'customrecord_elm_vend_disponibles',
                            id: objScriptParam.idAvailable,
                            values: {
                                custrecord_elm_vend_disp_array: JSON.stringify(availableSeller)
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                        log.audit(' Employee was added to the available list ','The available seller was updated: ' + idAvailable);
                    } 
                        
                }
                if (activo != activoOld && !activo) {
                    // If seller is deactivated, remove them from available sellers
                    const removed = removeElementFromArray(availableSeller, newRecord.id);
                    if (removed) {
                        const idAvailable = record.submitFields({
                            type: 'customrecord_elm_vend_disponibles',
                            id: objScriptParam.idAvailable,
                            values: {
                                custrecord_elm_vend_disp_array: JSON.stringify(availableSeller)
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        });
                        log.audit(' Employee Removed from available list ','The available seller was updated: ' + idAvailable);
                    }
                }
         } catch (e) {
            log.error('beforeSubmit', e);
            const user = runtime.getCurrentUser().id;
            const obj = {
               tipo: 2,
               usuario: user,
               record: 'Lead',
               notas:  'Error - Nuevo Vendedor Disponible: ' + newRecord.id + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);  
         }
      };
      /**
     * @author  Gerardo Gonzalez
     * @desc getScriptParameters - This function retrieves the script parameters from the current script context.
     */
      const getScriptParameters = () => {
         const scriptObj = runtime.getCurrentScript();
         return {
            idAvailable: scriptObj.getParameter({ name: 'custscript_elm_vendedores_param' })
         };
      };
    /**
     * @author  Gerardo Gonzalez
     * @desc getAvailableSeller - This function retrieves the available sellers from the custom record.
     * @param {string} purposeName - Purpose name
     */
      const getAvailableSeller = (objScriptParam) => {
        try {
            const fieldAvailableSeller = search.lookupFields({
               type: 'customrecord_elm_vend_disponibles',
               id: objScriptParam.idAvailable,
               columns: ['custrecord_elm_vend_disp_array']
            });
            return JSON.parse(fieldAvailableSeller.custrecord_elm_vend_disp_array);
        } catch (e) {
            throw error.create({
               name: 'GET_AVAILABLE_SELLER_ERROR',
               message: `Something failed when getting available seller error: ${e.message}`,
               notifyUser: true,
            });
         }
      }
    /**
     * @author  Gerardo Gonzalez
     * @desc isElementInArray - This function checks if an element is in an array.
     * @param {array} array
     * @param {string} element
     */
      const isElementInArray = (array, element) => {
        return array.indexOf(element) !== -1;
    }
    /**
     * @author  Gerardo Gonzalez
     * @desc isElementInArray - This function removes an element from an array.
     * @param {array} array
     * @param {string} element
     */
    const removeElementFromArray = (array, element) => {
        const index = array.indexOf(element);
        if (index !== -1) {
            array.splice(index, 1); // Remove the element from the array
            return true; // Element was found and removed
        }
        return false; // Element was not found in the array
    }

        return { afterSubmit };
   });
