/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

define(["./SDB-Enlamano-score.js", "./ELM_Aux_Lib.js", "N/runtime",  "N/record"],
   function (scoreLib, auxLib, runtime, record) {
      function post(requestBody) { 
         const logTitle = 'post';
         const objScriptParam = getScriptParameters();
         let docNumber = requestBody?.docNumber;
         let mobilePhone = requestBody?.mobilephone;
         let source = requestBody?.source;
         log.debug('RESTlet working', 'Documento: ' + docNumber + ' - Telefono: ' + mobilePhone + ' - Source: ' + source);
         const idLog = auxLib.createLogRecord(docNumber, null, false, 3, source, requestBody);
         const response = {
            docNumber: docNumber,
            success: false,
            result: null
         }; 
         try {
            auxLib.deactivateLeadsByDocumentNumber(docNumber);
            const infoRepetido = auxLib.getInfoRepetido(docNumber, null, false);
            let sourceId = auxLib.getProveedorId(source);

            if (infoRepetido.approvalStatus != "3") {

               let preLeadId = auxLib.createPreLead(objScriptParam?.webLandingService, docNumber, mobilePhone, null, null, null, null, null, null, null, sourceId, null,objScriptParam.estadoRechazado);
               let blackList = auxLib.checkBlacklist(docNumber);

               if (!blackList) {
                  let mocasist = auxLib.checkMocasist(docNumber);

                  if (!mocasist) { 
                     
                     let repetidoIsPreLead = infoRepetido?.status === objScriptParam.preLeadStatus;
                     let repetidoIsRejected = infoRepetido?.approvalStatus === objScriptParam.estadoRechazado;
                     let repetidoIsFromExternal = infoRepetido?.service === objScriptParam.externalService;
                     let repetidoIsFromManual = infoRepetido?.service === objScriptParam.manualService;

                     if (!infoRepetido.id || (repetidoIsFromExternal && repetidoIsPreLead && repetidoIsRejected)) {
                        const score = scoreLib.scoreFinal(docNumber);
                        // Extract BCU data for t2 and t6 periods
                        const bcuData = auxLib.extractBcuData(score);
                        const t2Info = auxLib.getBcuPeriodInfo(bcuData.t2, 't2');
                        const endeudamientoT2 = t2Info?.rubrosGenerales[0]?.MnPesos || 0;
                        const cantEntidadesT2 = t2Info?.entidades.length || 0;
                        const t6Info = auxLib.getBcuPeriodInfo(bcuData.t6, 't6');
                        const endeudamientoT6 = t6Info?.rubrosGenerales[0]?.MnPesos || 0;
                        const cantEntidadesT6 = t6Info?.entidades.length || 0;
                        
                        const t2Quals = bcuData?.t2Qualifications?.map(q => q.calificacion);
                        // Get all qualification values from T6  
                        const t6Quals = bcuData?.t6Qualifications?.map(q => q.calificacion);

                        if (score.calificacionMinima == 'N/C') {
                              log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
                              response.success = false;
                              response.result = 'BCU';
                              auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoBCU, null, null, null, null, null, score);
                              log.debug('Response S3 ' + docNumber, JSON.stringify(response));
                              auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
                              return response;
                        }
                        if (score && score.score > 499) {
                           log.audit('Success', 'El documento ' + docNumber + ' fue evaluado con éxito. Pre Lead aprobado: ' + preLeadId);
                           auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoPendienteEvaluacion, null, null, null, null, null, null, score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, t2Quals, t6Quals);

                           if (repetidoIsFromExternal || repetidoIsFromManual) {

                              let lead = auxLib.convertToLead(preLeadId, score, objScriptParam.leadStatus, objScriptParam.estadoPendienteEvaluacion, infoRepetido.firstName, infoRepetido.lastName, infoRepetido?.activityType, infoRepetido?.salary, infoRepetido?.dateOfBirth, infoRepetido.yearsOfWork, infoRepetido.email, infoRepetido?.age);
                              let montoCuotaObj = auxLib.getPonderador(score?.score, score?.calificacionMinima, score?.endeudamiento, infoRepetido?.salary, infoRepetido.activity, infoRepetido?.age);
                              let montoCuota = parseFloat(infoRepetido.salary) * parseFloat(montoCuotaObj.ponderador);
                              let ofertaFinal = auxLib.getOfertaFinal(montoCuota);
                              let isLatente = true;
                               if (montoCuotaObj?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END')) {
                                 isLatente = false;
                              }
                              
                              if (isLatente) {
                                 response.success = true;
                                 response.result = 'Listo para recibir datos en servicio 4';
                                 log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal?.oferta + ' - Cuota Final: ' + ofertaFinal?.cuotaFinal);
                                 auxLib.submitFieldsEntity(lead, objScriptParam?.estadoAprobado, null, null, null, parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta), montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                                 cantEntidadesT6, t2Quals, t6Quals);
                                 auxLib.snapshotAprobados(docNumber, lead, objScriptParam?.estadoAprobado, 5);

                              } else {
                                 log.audit('Error', 'No hay oferta para el documento:  ' + docNumber);
                                 response.success = false;
                                 response.result = 'No hay oferta';
                                 auxLib.submitFieldsEntity(lead, objScriptParam?.estadoRechazado, objScriptParam?.rechazoNoHayOferta, null, null, 0, 0, montoCuotaObj?.montoCuotaName, score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, t2Quals, t6Quals);
                              }
                           } else {
                                 response.success = true;
                                 response.result = 'Listo para recibir datos en servicio 4';
                           }
                        } else {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
                           response.success = false;
                           response.result = 'BCU';
                           let approvalStatus = objScriptParam.estadoRechazado;
                           if (score.error_reglas == 500){
                              approvalStatus = 15;
                           }

                           if (score.error_reglas == 404) {
                              approvalStatus = 16;
                           }
                           auxLib.submitFieldsEntity(preLeadId, approvalStatus, objScriptParam?.rechazoBCU, null, null, null, null, null, score);
                        }

                     } else {
                       
                        if (!repetidoIsFromExternal && repetidoIsPreLead && repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Pre-Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
                           response.success = false;
                           response.result = 'Pre-Lead Repetido rechazado';
                           const newCustomerId = auxLib.copyRecordToRecord({
                              sourceType: record.Type.LEAD,
                              sourceId: infoRepetido.id,
                              targetId: preLeadId,
                              defaultValues:{
                              },
                              fieldMap: {
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                 'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
                                 
                              }
                           });

                           log.audit('Created customer', newCustomerId);
                        }  
                        
                         if (!repetidoIsFromExternal && !repetidoIsPreLead && repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
                           response.success = false;
                           response.result = 'Lead Repetido rechazado';
                           const newCustomerId = auxLib.copyRecordToRecord({
                              sourceType: record.Type.LEAD,
                              sourceId: infoRepetido.id,
                              targetId: preLeadId,
                              defaultValues:{
                              },
                              fieldMap: {
                                 
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                 'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,

                                 'isinactive': true
                                 
                              }
                           });

                           log.audit('Created customer', newCustomerId);
                        
                        }  

                    
                        if (!repetidoIsFromExternal && !repetidoIsPreLead && !repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
                           response.success = false;
                           response.result = 'Lead Repetido';
                        }

                        if(infoRepetido.approvalStatus == objScriptParam?.estadoLatente) {

                            const idUpdated = record.submitFields({
                              type: record.Type.LEAD,
                              id: infoRepetido.id,
                              values: {
                                  'custentity_elm_service': '2',
                                  'custentity_elm_channel': sourceId,
                                  'mobilephone': mobilePhone,
                                  'custentity_elm_aprobado': 2
                                  
                              }
                           });
                             log.audit('Updated lead original', idUpdated);
                        }
                        auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
                     }
                  } else {
                     log.audit('Error', 'El documento ' + docNumber + ' pertenece a Mocasist.');
                     response.success = false;
                     response.result = 'Mocasist';

                     if(infoRepetido.id) {
                       const newCustomerId = auxLib.copyRecordToRecord({
                                 sourceType: record.Type.LEAD,
                                 sourceId: infoRepetido.id,
                                 targetId: preLeadId,
                                 defaultValues:{
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoMocasist,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
                                 },
                                 fieldMap: {
                                    
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoMocasist,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
                                    
                                 }
                              });

                               log.audit('Created customer', newCustomerId);
                                auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
                     } else {
                     auxLib.submitFieldsEntity(preLeadId, objScriptParam?.estadoMocasist, objScriptParam?.rechazoMocasist);
                     }
                  }

               } else {
                  log.audit('Error', 'El documento ' + docNumber + ' pertenece a la Lista Negra.');
                  response.success = false;
                  response.result = 'Blacklist';
                   if(infoRepetido.id) {
                       const newCustomerId = auxLib.copyRecordToRecord({
                                 sourceType: record.Type.LEAD,
                                 sourceId: infoRepetido.id,
                                 targetId: preLeadId,
                                 defaultValues:{
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoBlacklist,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
                                 },
                                 fieldMap: {
                                    
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoBlacklist,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
                                    
                                 }
                              });

                               log.audit('Created customer', newCustomerId);

                                auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
                  } else {
                     auxLib.submitFieldsEntity(preLeadId, objScriptParam?.estadoBlacklist, objScriptParam?.rechazoBlacklist);
                  }
                  
               }
            } else {
               const comentRec = record.create({
                  type: 'customrecord_elm_comentarios',
                  isDynamic: false
               });
               comentRec.setValue({
                  fieldId: 'custrecord_elm_com_lead',
                  value: infoRepetido.id
               });
               comentRec.setValue({
                  fieldId: 'custrecord_elm_comentarios_com',
                  value: 'El Lead ' + docNumber + ' tuvo un nuevo ingreso por la web: ' + source
               });
               const idComentario = comentRec.save()
               log.debug('Se creo el comentario: ', idComentario);
            }

         } catch (e) {
            log.error(logTitle, e);
            response.success = false;
            response.result = e.message;
            const user = runtime.getCurrentUser().id;
            const obj = {
               tipo: 2,
               usuario: user,
               record: 'Lead',
               notas:  'Error - Servicio 3: ' + docNumber + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);  

         }
         log.debug('Response S3 ' + docNumber, JSON.stringify(response));
         auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
         return response;
      }

      function getScriptParameters() {
         const scriptObj = runtime.getCurrentScript();
         const objParams = {
            estadoAprobado: scriptObj.getParameter({
               name: 'custscript_elm_estado_aprobado'
            }),
            estadoRechazado: scriptObj.getParameter({
               name: 'custscript_elm_estado_rechazado'
            }),
            estadoPendienteEvaluacion: '3',
            rechazoBlacklist: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_blacklist'
            }),
            rechazoMocasist: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_mocasist'
            }),
            rechazoBCU: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_bcu'
            }),
            rechazoNoHayOferta: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_no_oferta'
            }),
            rechazoRepRechazado: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_rep_rech'
            }),

            estadoRepRechazado: scriptObj.getParameter({
               name: 'custscript_elm_rep_aprob_s2'
            }),
            estadoRepAprobado: scriptObj.getParameter({
               name: 'custscript_elm_rep_rech_s2'
            }),
            estadoLatente: 4,
      
            NohayInfoBCU: 16,
            ErrorBCU: scriptObj.getParameter({
               name: 'custscript_elm_bcu_error_estado_s3'
            }),
            leadStatus: scriptObj.getParameter({
               name: 'custscript_elm_entity_stat_lead'
            }),
            preLeadStatus: scriptObj.getParameter({
               name: 'custscript_elm_entity_stat_pre_lead'
            }),
            externalService: scriptObj.getParameter({
               name: 'custscript_elm_channel_prov_externo'
            }),
            manualService: scriptObj.getParameter({
               name: 'custscript_elm_channel_manual'
            }),
            webLandingService: scriptObj.getParameter({
               name: 'custscript_elm_channel_web_landing'
            }),
              estadoMocasist: scriptObj.getParameter({
               name: 'custscript_elm_est_mocasist_s3'
            }),
            estadoBlacklist: scriptObj.getParameter({
               name: 'custscript_elm_est_blacklist_s3'
            })
        };
      
         return objParams;
      }

      return {
         post: post
      };

   });
