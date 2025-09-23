/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define([ 'N/ui/dialog', 'N/url', 'N/ui/message', 'N/currentRecord', 'N/search'], function( dialog, url, message, currentRecord, search) {

    /**
     * fieldChanged - Function to be executed when field is changed.
     * @param {Object} context
     * @param {Record} context.currentRecord - Current form record
     * @param {string} context.fieldId - Field name that triggered the event
     */
    function fieldChanged(context) {
        try {
            const currentRecord = context.currentRecord;
            const fieldId = context.fieldId;
            const reasignarTodos = currentRecord.getValue({
                    fieldId: 'custpage_reasignaroperadores'
                });
            const operadorAreasignar = currentRecord.getValue({
                fieldId: 'custpage_operadorasignar'
            });

            // Handle reasignar a todos los operadores checkbox
            if (fieldId === 'custpage_reasignaroperadores') {
                const operadorAAsignarField = currentRecord.getField({
                    fieldId: 'custpage_operadorasignar'
                });
                if (reasignarTodos) {
                    operadorAAsignarField.isDisabled = true;
                    currentRecord.setValue({
                        fieldId: 'custpage_operadorasignar',
                        value: ''
                    });
                    
                    const fieldAvailableSeller = search.lookupFields({
                        type: 'customrecord_elm_vend_disponibles',
                        id: 1,
                        columns: ['custrecord_elm_vend_disp_array']
                    });

                    const countSlotsAvailable = getQuantityAvailableSlots(JSON.parse(fieldAvailableSeller.custrecord_elm_vend_disp_array));
                    currentRecord.setValue({
                        fieldId: 'custpage_leads_disponibles',
                        value: countSlotsAvailable
                    });
                    
                } else {
                    operadorAAsignarField.isDisabled = false;
                    
                }
            }
            // Handle operador selection
            if (fieldId === 'custpage_operador') {
                const operadorValue = currentRecord.getValue({
                    fieldId: 'custpage_operador'
                });
                
                if (operadorValue) {
                    const objParameters = {
                        action: 'update_sublist',
                        operador: operadorValue,
                        reasignarTodos:reasignarTodos,
                        operadorAsignar: operadorAreasignar
                    };
                    callSuitelet(objParameters, 'Actualizando sublista para el operador seleccionado...');
                }
            }
            // Handle operadora a asignar selection
            if (fieldId === 'custpage_operadorasignar') {
                  const currentLeadCount = search.create({
                        type: 'lead',
                        filters: [
                            ["stage", "anyof", "LEAD"],
                            "AND",
                            ["custentity_elm_aprobado","anyof","2"],
                            "AND", 
                            ["custentity_elm_operador","anyof",operadorAreasignar],
                            "AND",
                            ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
                        ]
                    }).runPaged().count;

                    const leadsDisponibles = 20 - currentLeadCount;

                    currentRecord.setValue({
                        fieldId: 'custpage_leads_disponibles',
                        value: leadsDisponibles
                    });

            }
            
        } catch (e) {
            console.error('Error in fieldChanged: ' + e.message);
        }
    }
    /**
     * saveRecord - Validation function to be executed when record is saved.
     * @param {Object} context
     * @param {Record} context.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     */
    function saveRecord(context) {
        try {
            const currentRecord = context.currentRecord;
            const operador = currentRecord.getValue({
                fieldId: 'custpage_operador'
            });

             const leadsDisponibles = currentRecord.getValue({
                fieldId: 'custpage_leads_disponibles'
            });
            // Check if appropriate values are set based on form mode
            const operadorAAsignar = currentRecord.getValue({
                fieldId: 'custpage_operadorasignar'
            });
            // Check if the operator to assign is selected
            if (operadorAAsignar === operador) {
                dialog.alert({
                    title: 'Validación',
                    message: 'Los operadores deben ser distintos.'
                });
                return false;
                
            } 

           /*  const arrayID = getAllRows (currentRecord, true);
            if (arrayID.length > leadsDisponibles ) {
                dialog.alert({
                    title: 'Validación',
                    message: 'Los leads disponibles para asignar son mas de los que disponibles.'
                });
                return false;
            } */

            return true;
        } catch (e) {
            console.error('Error in saveRecord: ' + e.message);
            return false;
        }
    }
    /**
     * @author Gerardo Gonzalez
     * @desc callSuitelet - This function calls the suitelet  
     * @param {object} objParameters
     * @param {string} messageTxt
    */
    function callSuitelet(objParameters, messageTxt) {
        try {
            //const suiteletScriptParams = custpageParameters.suiteletScriptParams;
            /*  const stSuiteletUrl = url.resolveScript({
                scriptId: suiteletScriptParams.scriptId,
                deploymentId: suiteletScriptParams.deploymentId,
                returnExternalUrl: false
            });
*/
            const stSuiteletUrl = url.resolveScript({
            scriptId: 'customscript_elm_asig_ope_unico_sl',
            deploymentId: 'customdeploy_elm_asig_ope_unico_sl',
            returnExternalUrl: false
            });
            const suiteletUrl = url.format(stSuiteletUrl, objParameters);
            window.ischanged = false;
            if (messageTxt) {
                const msgProcess = message.create({
                    title: 'Processing',
                    message: messageTxt,
                    type: message.Type.INFORMATION
                });
                msgProcess.show();
            }
            window.open(suiteletUrl, '_self');
        } catch (e) {
            console.error('callSuitelet', e);
        }
    }
    /**
     *  @author Gerardo Gonzalez
     *  @desc markbutton - This Function will mark or unmark lines depending on user actions
     *  @param {boolean} value
    **/
    function markbutton(value) {
        try {
            const objRecord = currentRecord.get();
            const lineCountAll = objRecord.getLineCount({
                sublistId: 'custpage_leads'
            });
            for (let i = 0; i < lineCountAll; i++) {
                objRecord.selectLine({
                    sublistId: 'custpage_leads',
                    line: i
                });
                const custpageSelect = objRecord.getCurrentSublistValue({
                    sublistId: 'custpage_leads',
                    fieldId: 'custpage_lead_select'
                });
                if (custpageSelect !== value) {
                    objRecord.setCurrentSublistValue({
                        sublistId: 'custpage_leads',
                        fieldId: 'custpage_lead_select',
                        value: value
                    });
                    objRecord.commitLine({
                        sublistId: 'custpage_leads'
                    });
                }
            }
        } catch (e) {
            console.error('markbutton', e);
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc goBack - This function redirects to the previous page
     * @param {string} scriptId
     * @param {string} deploymentId
     * @param {string} operador
     */
    function goBack(scriptId, deploymentId, operador) {
        try {
            window.location = `${url.resolveScript({
            scriptId: scriptId,
            deploymentId: deploymentId
            })}&operador=${operador}&action=update_sublist`;
        } catch (error) {
            console.error('goBack', error);
            
        }
    }

     /**
     * @desc getAllRows - this function will return all rows whether they are selected or not
     * @param form
     * @param selected
     */ 
    function getAllRows (form, selected) {
        const count = form.getLineCount('custpage_leads');
        const ids = [];
        for (let i = 0; i < count; i++) {
            if (selected === null || form.getSublistValue({sublistId: 'custpage_leads', line: i, fieldId: 'custpage_lead_select'}) === selected) {
                ids.push(form.getSublistValue({
                    sublistId: 'custpage_leads',
                    line: i,
                    fieldId: 'custpage_lead_id'
                }));
            }
        }
        return ids;
    }

    /**
     * @desc getQuantityAvailableSlots - This function calculates the number of available slots for leads based on the operators provided.
     * @param operadores
     */ 
    function getQuantityAvailableSlots(operadores) {
        let countSlotsAvailable = 0;
        try {
            for (const operador of operadores) {
                const currentLeadCount = search.create({
                type: 'lead',
                filters: [
                    ["stage", "anyof", "LEAD"],
                    "AND",
                    ["custentity_elm_aprobado","anyof","2"],
                    "AND", 
                    ["custentity_elm_operador","anyof",operador],
                    "AND",
                    ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
                ]
            }).runPaged().count;
            countSlotsAvailable += 20 - currentLeadCount;
            }
            return countSlotsAvailable;
        } catch (e) {
            console.error('Error in getQuantityAvailableSlots: ' + e.message);
            return countSlotsAvailable
        }
    }

    
    return {
        fieldChanged: fieldChanged,
        goBack: goBack,
        markbutton: markbutton,
       	saveRecord: saveRecord
    };
});
