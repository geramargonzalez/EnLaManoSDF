/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define([ 'N/runtime', 'N/search', 'N/error', 'N/record',"./ELM_Aux_Lib.js", 'N/ui/serverWidget' ],
   ( runtime, search, error, record,auxLib, serverWidget) => {

    /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function loads the form and creates the estado gestion field.
     * @param {object} scriptContext 
     */
     function beforeLoad(scriptContext) {
            try {
                const { newRecord, form } = scriptContext;
                const objScriptParam = getScriptParameters();
                const estatusGestion = newRecord.getValue({ fieldId: 'custentity_elm_aprobado' });
               

                const estatusGestionField = form.getField({ id: 'custentity_elm_aprobado' });
                const role = runtime.getCurrentUser().role;
                if (role == objScriptParam.asesorVentasrole || role == objScriptParam.analistaRole || role == 1010) {
                    estatusGestionField.updateDisplayType({
                        displayType : serverWidget.FieldDisplayType.DISABLED
                    });
                    createEstadoGestionField(form,estatusGestion, role);
                }
            
                  const montoCuota = newRecord.getValue({ fieldId: 'custentity_elm_monto_cuota' });

                 if (montoCuota) {
                    newRecord.setValue('custentity_elm_monto_cuota_ven', montoCuota);
                 }

            } catch (e) {
                log.error('beforeLoad', e);
            }
    }

     /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function assigned a available seller to the lead when it is approved.
     * @param {object} scriptContext 
     */
      const afterSubmit = (scriptContext) => {
        const {newRecord, oldRecord} = scriptContext;
        const docNumber = newRecord.getValue({ fieldId: 'custentity_sdb_nrdocumento' });
        const user = runtime.getCurrentUser();
         try {
            
            if (scriptContext.type === scriptContext.UserEventType.DELETE) return;
            const objScriptParam = getScriptParameters();
            const availableSeller = getAvailableSeller(objScriptParam);
            const operador = newRecord.getValue({ fieldId: 'custentity_elm_operador' });
            const repetition = newRecord.getValue({ fieldId: 'custentity_elm_lead_repetido_original' });
            const status = newRecord.getValue({ fieldId: 'custentity_elm_aprobado' });
            const batchId = newRecord.getValue({ fieldId: 'custentity_elm_batch_id' });
            const canal = newRecord.getValue({ fieldId: 'custentity_elm_channel' });
            const service = newRecord.getValue({ fieldId: 'custentity_elm_service' });
            const inactive = newRecord.getValue({ fieldId: 'isinactive' });
            const motivoRechazo = newRecord.getValue({ fieldId: 'custentity_elm_reject_reason' });
            const operadorOld = oldRecord ? oldRecord.getValue('custentity_elm_operador') : null;
            const estadoGestion = newRecord.getValue({ fieldId: 'custentity_elm_aprobado' });

            if (operador != operadorOld && operador) {
                auxLib.operadorByLead({
                    leadId: newRecord.id,
                    operadorId: operador,
                    estadoGestion: estadoGestion
                });
            }

           if (!operador && !repetition && (status == objScriptParam.estado || status == objScriptParam.estadoPendiente) && !batchId ) {


                const user = runtime.getCurrentUser();
                const isActive = auxLib.isEmployeActive(user.id);
                if (isActive) {
                    const idLead = record.submitFields({
                        type: record.Type.LEAD,
                        id: newRecord.id,
                        values: {
                            custentity_elm_operador: user.id
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                    
                auxLib.operadorByLead({
                    leadId: newRecord.id,
                    operadorId: user.id,
                    estadoGestion: estadoGestion
                });

                log.audit('Lead Assigned', 'Lead ' + idLead + ' assigned to current user ' + user.id);

                } else {
                
                    for (let index = 0; index < availableSeller.length; index++) {
                        const element = availableSeller[index];
                        const availableSellerID = element;
                        const currentLeadCount = search.create({
                            type: 'lead',
                            filters: [
                                ["stage", "anyof", "LEAD"],
                                "AND",
                                ['custentity_elm_operador', 'anyof', availableSellerID],
                                "AND",
                                ["custentity_elm_aprobado", "anyof",objScriptParam.estado],
                                "AND",
                                ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
                            ]
                        }).runPaged().count;

                        if (currentLeadCount < objScriptParam.qtyTotalLeads) {

                            const idLead = record.submitFields({
                                type: record.Type.LEAD,
                                id: newRecord.id,
                                values: {
                                    custentity_elm_operador: availableSellerID
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });

                           auxLib.operadorByLead({
                                leadId: newRecord.id,
                                operadorId: availableSellerID,
                                estadoGestion: estadoGestion
                            });

                            log.audit('Lead Assigned', 'Lead ' + idLead + ' assigned to employee ' + availableSellerID);

                            const removedElement = availableSeller.splice(index, 1)[0];
            
                            // Add it to the end of the array
                            availableSeller.push(removedElement);

                            const IDSeller = record.submitFields({
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
                            log.audit('Available seller updated: ' + IDSeller);
                            break;
                        }
                }
                
            }
                
           
            }

            if (status == objScriptParam.estadoRechazado && canal == 2 && motivoRechazo == 4) {
           
                record.submitFields({
                    type: record.Type.LEAD,
                    id: newRecord.id,
                    values: {
                        isinactive: true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                
            }

             // Si el servicio es manual, y esta siendo editado
            if (!operador && service == 3 && scriptContext.type === scriptContext.UserEventType.EDIT) {
              
                const isActive = auxLib.isEmployeActive(user.id);
                if (isActive) {
                    record.submitFields({
                        type: record.Type.LEAD,
                        id: newRecord.id,
                        values: {
                            custentity_elm_operador: user.id,
                            isinactive: inactive ? false : inactive
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }
            }

            const infoRepetido = auxLib.getInfoRepetido(docNumber, newRecord.id, false);
            let approvalStatus = infoRepetido.approvalStatus;
          
            if(infoRepetido.approvalStatus ==  objScriptParam.estadoRechazado) {
                approvalStatus = objScriptParam.estadoReRechazado;
            }

            if(infoRepetido.approvalStatus ==  objScriptParam.estado) {
                approvalStatus = objScriptParam.estadoReAprob;
            }
    
            if (infoRepetido.id) {
                const newCustomerId = auxLib.copyRecordToRecord({
                    sourceType: record.Type.LEAD,
                    sourceId: infoRepetido.id,
                    targetId: newRecord.id,
                    defaultValues:{
                        'custrecord_sdb_nrodoc': docNumber,
                        'custentity_elm_aprobado': approvalStatus,
                        'custentity_elm_reject_reason': infoRepetido.rejectionReason,
                        'custentity_elm_lead_repetido_original': infoRepetido.id,
                        'isinactive': true
                        
                    },
                    fieldMap: {
                        'custrecord_sdb_nrodoc': docNumber,
                        'custentity_elm_aprobado': approvalStatus,
                        'custentity_elm_reject_reason': infoRepetido.rejectionReason,
                        'custentity_elm_lead_repetido_original': infoRepetido.id,
                         'isinactive': true
                    }
                    });

                    log.audit('Created customer', newCustomerId);

                    /* if (newCustomerId) {
                        auxLib.createListRepetido(docNumber, nombre)
                    } */
            }



            

         } catch (e) {
            log.error('afterSubmit', e);
            const obj = {
               tipo: 2,
               usuario: user.id,
               record: 'Lead',
               notas:  'Error - Asignacion Operado Unico: ' + docNumber + ' - details: ' + e, 
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
            idAvailable: scriptObj.getParameter({ name: 'custscript_elm_available_record' }),
            qtyTotalLeads: scriptObj.getParameter({ name: 'custscript_elm_qty_asigned' }),
            estado: scriptObj.getParameter({ name: 'custscript_elm_status_approve' }),
            estadoReRechazado: scriptObj.getParameter({ name: 'custscript_elm_estado_rep_rech_pm' }),
            estadoPendiente: scriptObj.getParameter({ name: 'custscript_elm_estado_pendiente_pm' }),
            estadoReAprob: scriptObj.getParameter({ name: 'custscript_elm_estado_rep_aprob_pm' }),
            estadoRechazado: scriptObj.getParameter({ name: 'custscript_elm_rech_pm' }),
            asesorVentasrole: scriptObj.getParameter({ name: 'custscript_elm_asesor_estado_rol' }),
            analistaRole: scriptObj.getParameter({ name: 'custscript_elm_analista_rol' }),
            tienePrestomo: scriptObj.getParameter({ name: 'custscript_tiene_prestamos_pm' }),
            alPrestamo: 2,
            noHayOferta: 4
         };
      };

    /**
     * @author  Gerardo Gonzalez
     * @desc getAvailableSeller - This function retrieves the available sellers from the custom record.
     * @param {object} objScriptParam 
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
               message: `Something failed when its getting available seller error: ${e.message}`,
               notifyUser: true,
            });
         }
      }

    /**
     * @author  Gerardo Gonzalez
     * @desc keyPairValuesOptions - This function returns a key-value pair of the status of the sellers.
     * @param {boolean} isVendedor
     */
    function keyPairValuesOptions(isVendedor) {
        try {
            const fieldEvaluated = isVendedor ? "custrecord_elm_is_ases_vend" : "custrecord_elm_is_analisis";
            const objEstados = {};
             const ssEstados = search.create({
                type: "customrecord_elm_estados",
                filters:
                [
                    [fieldEvaluated,"is","T"]
                ],
                columns:
                [
                    search.createColumn({name: "name", label: "Name"}),
                    search.createColumn({name: "internalid", label: "Internal ID"})
                ]
                });
                const searchResultCount = ssEstados.runPaged().count;
                log.debug("customrecord_elm_estadosSearchObj result count",searchResultCount);
                ssEstados.run().each(function(result){
                // .run().each has a limit of 4,000 results
                objEstados[result.getValue({name: "name"})] = result.getValue({name: "internalid"});
                return true;
                });
            return objEstados;
        } catch (e) {
            log.error('Error keyPairValuesOptions:', e);
        }
    }
    /**
     * @author  Gerardo Gonzalez
     * @desc createEstadoGestionField - This function creates the estado gestion field in the form.
     * @param {object} form
     * @param {string} estatusGestion
     * @param {string} role
     */
    function createEstadoGestionField(form, estatusGestion, role) {
        try {
            const objScriptParam = getScriptParameters();
            const textLabel = role == objScriptParam.asesorVentasrole || role == 1010 ? 'Estado de Gestión Ventas' : 'Estado de Gestión Análisis';
            const estadoGestion = form.addField({
                id: 'custpage_estadogestion',
                label: textLabel,
                type: serverWidget.FieldType.SELECT
            })
            form.insertField({
                field : estadoGestion,
                isBefore: true,
                nextfield: 'custentity_elm_reject_reason'
            });
            const keyPaiValues = keyPairValuesOptions(role == objScriptParam.asesorVentasrole || role == 1010);
            estadoGestion.addSelectOption({
                value : '',
                text : ''
            });
            Object.entries(keyPaiValues).forEach(([key, value]) => {
                estadoGestion.addSelectOption({
                    value : value,
                    text : key
                });
            });
            estadoGestion.defaultValue = estatusGestion;
        } catch (e) {
            log.error('Error createEstadoGestionField:', e);
        }
    }


        
      return { 
        beforeLoad,
        afterSubmit 
    };
   });
