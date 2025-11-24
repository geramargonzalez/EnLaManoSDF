/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/runtime', 'N/ui/dialog', 'N/search', 'N/record', "./ELM_Aux_Lib.js"], function(runtime, dialog, search, record, auxlib) {

    
    /**
     * pageInit - this function is executed when the page is initialized
     * @param {Object} context 
     * @param {Record} context.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     */
    function pageInit(context) {
        try {
            // Check if the script is running in the correct context
            const currentRecord = context.currentRecord;
            const estadoGestion = currentRecord.getValue({ fieldId: 'custentity_elm_aprobado' });
            const solVigente = currentRecord.getValue({ fieldId: 'custentity_elm_sol_vig' });
            const score = currentRecord.getValue({ fieldId: 'custentity_score' });
            const rechazado = runtime.getCurrentScript().getParameter({name: 'custscript_elm_est_rech_pm' });
            const salario = currentRecord.getValue({ fieldId: 'custentity_sdb_infolab_importe' });
           // const sinRepuesta = runtime.getCurrentScript().getParameter({name: 'custscript_elm_sin_respuesta_pm' });
            // Disable reject reason field when estado gestion is 1
            if (estadoGestion != rechazado) {
                // Get field and set to disabled
                currentRecord.getField({
                    fieldId: 'custentity_elm_reject_reason'
                }).isDisabled = true;

                 currentRecord.getField({
                    fieldId: 'custentity_elm_sub_estado'
                }).isDisabled = false;
            } else {
                // Make sure it's enabled in other cases
                currentRecord.getField({
                    fieldId: 'custentity_elm_reject_reason'
                }).isDisabled = false;

                 currentRecord.getField({
                    fieldId: 'custentity_elm_sub_estado'
                }).isDisabled = true;
            }
            
            if (solVigente) {
                const estadoGesSol = search.lookupFields({
                    type: "customrecord_elm_solicitud",
                    id: solVigente,
                    columns: ['custrecord_elm_sol_est_gestion']
                });
                 console.log('Estado de Gestion de Solicitud', 'El estado de gestion de la solicitud ' + estadoGesSol.custrecord_elm_sol_est_gestion[0]?.value);

                const estadoGestionSolicitud = estadoGesSol.custrecord_elm_sol_est_gestion[0]?.value;
                if (estadoGestionSolicitud != estadoGestion) {
                    currentRecord.setValue({
                        fieldId: 'custentity_elm_aprobado',
                        value: estadoGestionSolicitud
                    });
                } 

                 const id = record.submitFields({
                    type: 'customrecord_elm_solicitud',
                    id: solVigente,
                    values: {
                        custrecord_elm_sol_score: score,
                        custrecord_elm_sol_salario: salario
                    }
                    });
                    console.log('ID de solicitud actualizado:', id);

            }

        }catch (e) {
            console.error('pageInit: ' + e.message);
        }
    }
    /**
     * fieldChanged - function to be executed when field is changed
     * @param {Object} context 
     * @param {Record} context.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     */
    function fieldChanged(context) {
        try {
            const scriptObj = runtime.getCurrentScript();
            const aprobado = scriptObj.getParameter({name: 'custscript_elm_est_ap_pm' });
            const rechazado = scriptObj.getParameter({name: 'custscript_elm_est_rech_pm' });
            const sinRepuesta = scriptObj.getParameter({name: 'custscript_elm_sin_respuesta_pm' });
            const rechazadoPorAsesor = 24;
            
            const currentRecord = context.currentRecord;
          
            if (context.fieldId === "custpage_estadogestion" ) {
                const estadoGestion = currentRecord.getValue({ fieldId: 'custpage_estadogestion' });
                if (estadoGestion != aprobado && estadoGestion) {
                    // If the user selects "No Aprobado", set the field to "Aprobado"
                    currentRecord.setValue({
                        fieldId: 'custentity_elm_aprobado',
                        value: estadoGestion
                    }) 

                    auxlib.createGestionLead({
                        leadId: currentRecord.id,
                        estado: estadoGestion,
                        nroDocumento: currentRecord.getValue({ fieldId: 'custentity_sdb_nrdocumento' }),
                        setBy: runtime.getCurrentUser().id
                    });

                } else {	
                    // If the user selects "Aprobado", set the field to "No Aprobado"
                        dialog.alert({
                        title: 'Estado de Gestion',
                        message: 'El estado de gestion que usted desea ingresar no es permitido para su rol.'
                    }).then(function() {
                        // User clicked OK on the dialog
                        return true;
                    });
                }
                

            }

            if (context.fieldId === "custentity_elm_aprobado" ) {
                // Enable reject reason field when estado gestion is 1
                const estadoGestion = currentRecord.getValue({ fieldId: 'custentity_elm_aprobado' });
                // const solVigente = currentRecord.getValue({ fieldId: 'custentity_elm_sol_vig' });
                // const motivoRechazado = currentRecord.getValue({ fieldId: 'custentity_elm_reject_reason' });
                
                if (estadoGestion == rechazado || estadoGestion == rechazadoPorAsesor) {
                    currentRecord.getField({
                        fieldId: 'custentity_elm_reject_reason'
                    }).isDisabled = false;
                    currentRecord.getField({
                        fieldId: 'custentity_elm_sub_estado'
                    }).isDisabled = true;
                    
                } else {
                    // Make sure it's enabled in other cases
                    currentRecord.getField({
                        fieldId: 'custentity_elm_reject_reason'
                    }).isDisabled = true;
                    currentRecord.getField({
                        fieldId: 'custentity_elm_sub_estado'
                    }).isDisabled = false;
                }

                if (estadoGestion == 22) {
                    currentRecord.getField({
                        fieldId: 'custentity_sdb_fechanac'
                    }).isMandatory = false;
                    currentRecord.getField({
                        fieldId: 'custentity_sdb_actividad'
                    }).isMandatory = false;
                    currentRecord.getField({
                        fieldId: 'custentity_sdb_infolab_importe'
                    }).isMandatory = false;
                }

                // Handle mandatory field for sub estado based on approval status
                // Enable or disable sub estado field based on estado gestion

                if (estadoGestion == sinRepuesta) {
                    currentRecord.getField({
                        fieldId: 'custentity_elm_sub_estado'
                    }).isMandatory = true;
                } else {
                    currentRecord.getField({
                        fieldId: 'custentity_elm_sub_estado'
                    }).isMandatory = false;
                }

            /*     if (solVigente) {
                    const id = record.submitFields({
                    type: 'customrecord_elm_solicitud',
                    id: solVigente,
                    values: {
                        custrecord_elm_sol_est_gestion: estadoGestion
                    }
                });
                console.log('ID de solicitud actualizado:', id);

                

                //auxlib.createEtapaSolicitud(estadoGestion, runtime.getCurrentUser().id, solVigente);

                 } */

                 auxlib.createGestionLead({
                    leadId: currentRecord.id,
                    estado: estadoGestion,
                    nroDocumento: currentRecord.getValue({ fieldId: 'custentity_sdb_nrdocumento' }),
                    setBy: runtime.getCurrentUser().id
                });

            }

        
                
        } catch (error) {
            console.error('fieldChanged:', error);
        }
    
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };
});