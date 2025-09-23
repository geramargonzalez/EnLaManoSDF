/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/ui/dialog', 'N/search', 'N/log', './ELM_Aux_Lib.js'], function(dialog, search, log, auxLib) {
    
    let mode = null;

    function pageInit(context) {
        try {
            // Check if the script is running in the correct context
            mode = context.mode
        }catch (e) {
            console.error('Error in pageInit: ' + e.message);
        }
    }
    /**
     * fieldChanged - Function to be executed when record is saved
     * @param {Object} context
     * @param {Record} context.currentRecord - Current form record
     */
    function fieldChanged(context) {
        try {
            // Only proceed if document number exists
            if (context.fieldId === "custentity_sdb_nrdocumento" && mode === 'create') {
                const currentRecord = context.currentRecord;
                const id = currentRecord?.id;
                const docNumber = currentRecord.getValue({
                    fieldId: 'custentity_sdb_nrdocumento'
                });

                 const isValid = auxLib.validateCI(docNumber);
                  if (!isValid) {
                     log.audit('Error', 'El documento ' + docNumber + ' no es válido.');
                        dialog.alert({
                            title: 'Documento no válido',
                            message: 'El documento ' + docNumber + ' no es válido.'
                        }).then(function() {
                            // User clicked OK on the dialog
                            return true;
                        });
                  }
                // If search returns results, show dialog
                    const count = searchRepetitveLead(docNumber, id);
                    if (count > 0) {
                        dialog.alert({
                            title: 'LEAD Repetido',
                            message: 'La cedula: ' + docNumber + ' ya existe en el sistema. Por favor, Verifique los datos nuevamente.'
                        }).then(function() {
                            // User clicked OK on the dialog
                            return true;
                        });
                    }


            }
        } catch (e) {
            console.error('Error in saveRecord: ' + e.message);
          
        }
    }

    /**
     * saveRecord - function to be executed when record is saved
     * @param {Object} context 
     * @param {Record} context.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     */
    function saveRecord(context) {
        try {
            const currentRecord = context.currentRecord;
             const id = currentRecord?.id;
            const docNumber = currentRecord.getValue({
                fieldId: 'custentity_sdb_nrdocumento'
            });
            const isValid = auxLib.validateCI(docNumber);
            if (!isValid) {
                log.audit('Error', 'El documento ' + docNumber + ' no es válido.');
                dialog.alert({
                    title: 'Documento no válido',
                    message: 'El documento ' + docNumber + ' no es válido.'
                }).then(function() {
                    // User clicked OK on the dialog
                    return true;
                });
            }


            const count = searchRepetitveLead(docNumber);
            if (count > 0 && mode === 'create') {

                dialog.alert({
                    title: 'LEAD Repetido',
                    message: 'La cedula: ' + docNumber + ' ya existe en el sistema. Por favor, verifique los datos nuevamente.'
                }).then(function() {
                    // User clicked OK on the dialog
                    return true;
                });
                 return false; // Prevent saving the record
            } else {
                // If no repetitive lead, proceed with saving the record
                return true;
            }



           
        } catch (e) {
            console.error('Error in saveRecord: ' + e.message);
        }
    }

    /**
     * searchRepetitveLead - Function to search for repetitive leads
     * @param {string} docNumber
     * @returns {number} count - Number of records found with the same document number
     */
    function searchRepetitveLead(docNumber) {
        try {
    
            const filters =  [
            ["custentity_sdb_nrdocumento" , "is" , docNumber],
                "AND", 
                ["isinactive","is","F"],
                "AND",
                ["datecreated","within","daysago30"],
            ];

            const customerSearchObj = search.create({
                type: "customer",
                filters: filters,
             });

             log.debug("customerSearchObj filters",filters);
             const searchResultCount = customerSearchObj.runPaged().count;
             log.debug("customerSearchObj result count",searchResultCount);
             return searchResultCount;
        } catch (e) {
            console.error('Error searchRepetitveLead: ' + e.message);
        }   
    }
    
    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});