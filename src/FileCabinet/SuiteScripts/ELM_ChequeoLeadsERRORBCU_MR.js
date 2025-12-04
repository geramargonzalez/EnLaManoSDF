/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/runtime', 'N/error', 'N/email', "./SDB-Enlamano-score.js", "./ELM_Aux_Lib.js", './ELM_SCORE_BCU_LIB.js'],
    function (record, search, runtime, error, email, scoreLib, auxLib, bcuScoreLib) {
         

         /**
          * @author  Gerardo Gonzalez
          * @desc getInputData - This function is used to retrieve the input data for the Map/Reduce script.
          * @param {object} scriptContext 
         */
        function getInputData() {
            const logTitle = 'Get Input Data';
            try {
                log.debug(logTitle, '**** START *****');
                const customerSearchObj = search.create({
                    type: "customer",
                    filters:
                    [
                       ["status","anyof","7","6"], 
                       "AND", 
                        [["custentity_response_score_bcu","contains","Error al obtener datos del BCU"],"OR",["custentity_elm_aprobado","anyof","15", "28"]],
                        "AND", 
                       ["custentity_elm_lead_repetido_original","anyof","@NONE@"]/* 
                         ,"AND",
                       ["custentity_sdb_nrdocumento","is","49878016"] */
                    ],
                    columns:
                    [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({name: "custentity_sdb_nrdocumento", label: "Nro de Documento"}), 
                        search.createColumn({name: "custentity_elm_service", label: "Servicio"}),
                        search.createColumn({name: "custentity_elm_channel", label: "Channel"}),
                        search.createColumn({name: "custentity_sdb_infolab_importe", label: "Inporte de ingresos"}),
                        search.createColumn({name: "custentity_sdb_actividad", label: "Activity"}),
                        search.createColumn({name: "custentity_sdb_fechanac", label: "Fecha de Nacimiento"}),
                        search.createColumn({name: "mobilephone", label: "Mobile Phone"}),
                        search.createColumn({name: "custentity_elm_aprobado", label: "Estado de Gestion"}),
                    ]
                 });
                 const searchResultCount = customerSearchObj.runPaged().count;
                 log.debug("customerSearchObj result count", searchResultCount);
                 
                 // Enviar email si hay más de 40 leads con error BCU
                 const threashold = runtime.getCurrentScript().getParameter({ name: 'custscript_elm_umbral_toler' }) || 30;
                  if (searchResultCount > threashold) {
                     sendHighVolumeAlert(searchResultCount);
                 }
        
                return customerSearchObj;
            } catch (e) {
                throw error.create({
                    name: 'ERROR_GET_INPUT_DATA',
                    message: 'Something Failed When Retrieved the data: ' + e.message,
                    notifyOff: false
                });
            }
        }
         /**
          * @author  Gerardo Gonzalez
          * @desc map - This function is used to process each key/value pair in the input data.
          * @param {object} scriptContext 
         */
        function map(context) {
            let logTitle = 'Map';
            try {
                let LeadsData = JSON.parse(context.value);
                const objScriptParam = getScriptParameters();
                const docNumber = removeSpecialCharacters(LeadsData?.values?.custentity_sdb_nrdocumento);
                const service = LeadsData?.values?.custentity_elm_service.value;
                const source = LeadsData?.values?.custentity_elm_channel.value;
                const salary = LeadsData?.values?.custentity_sdb_infolab_importe;
                const activity = LeadsData?.values?.custentity_sdb_actividad?.value;
                const dateOfBirth = LeadsData?.values?.custentity_sdb_fechanac;
                const age = auxLib.calculateYearsSinceDate(dateOfBirth);
                const preLeadId = LeadsData?.id;
                const mobilePhone = LeadsData?.values?.mobilephone;
                const approvalStatus = LeadsData?.values?.custentity_elm_aprobado?.value; 
                
                let blackList = auxLib.checkBlacklist(docNumber);

                if (!blackList) {
                   let mocasist = auxLib.checkMocasist(docNumber);
    
                   if (!mocasist) {
                      let infoRepetido = auxLib.getInfoRepetido(docNumber, preLeadId, false);
    
                      if (!infoRepetido?.id) { 
                           
                              let score;
                              if (approvalStatus == 28) {
                                    score = bcuScoreLib.scoreFinal(docNumber, { provider: '2', forceRefresh: false, debug: false, strictRules: true });
                              } else {
                                    score = scoreLib.scoreFinal(docNumber);
                              }
                              const bcuData = auxLib.extractBcuData(score);
                              const t2Info = auxLib.getBcuPeriodInfo(bcuData.t2, 't2');
                              const endeudamientoT2 = t2Info?.rubrosGenerales[0]?.MnPesos || 0;
                              const cantEntidadesT2 = t2Info?.entidades.length || 0;
                              const t6Info = auxLib.getBcuPeriodInfo(bcuData.t6, 't6');
                              const endeudamientoT6 = t6Info?.rubrosGenerales[0]?.MnPesos || 0;
                              const cantEntidadesT6 = t6Info?.entidades.length || 0;
                              
                              const t2Quals = bcuData.t2Qualifications?.map(q => q.calificacion);
                              // Get all qualification values from T6  
                              const t6Quals = bcuData.t6Qualifications?.map(q => q.calificacion);

                              // Manejo de rechazo BCU con calificación visible
                              if (score?.error_reglas) {
                                 let approvalStatus = objScriptParam.estadoRechazado;
                                 if (score.error_reglas == 500 || score.error_reglas == 400) {
                                    if (approvalStatus == 28) {
                                          approvalStatus = 28;
                                       } else {
                                          approvalStatus = 15
                                    }
                                 }
      
                                 if (score.error_reglas == 404) {
                                    approvalStatus = 16;
                                 }
                                 log.audit('Error', `El documento ${docNumber} tiene mala calificación en BCU.`);
               
                                 auxLib.submitFieldsEntity(preLeadId, approvalStatus, objScriptParam.rechazoBCU, null, null, null, null, null, {
                                    score: 0,
                                    calificacionMinima: score.calificacionMinima,
                                    detail: score.detail,
                                    nombre: score.nombre
                                 });
                                 
                              }
    
                            if (score && score.score > objScriptParam.scoreMin) {
                  
                               const status = service == objScriptParam.serviceExternal ? objScriptParam.estadoLatente : objScriptParam.pendienteDeEvaluacion;
                               let leadId = auxLib.convertToLead(preLeadId, score, objScriptParam.leadStatus, status);
                               if (score.error_reglas == null) {
                                  score.error_reglas = false;
                               }
                               const montoCuotaObj = auxLib.getPonderador(score?.score, score?.calificacionMinima, score?.endeudamiento, salary, activity, age, source);
                               const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj?.ponderador);
                               const ofertaFinal = getOfertaFinal(source, montoCuota);

                              let isLatente = true;
                              
                              if (montoCuotaObj?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END')) {
                                 isLatente = false;
                              }
                              /*  if ((source == 2 || source == 'AlPrestamo') && (!ofertaFinal?.oferta || ofertaFinal?.oferta <= 0)) {
                                  isLatente = false;
                              } */
                              if (isLatente) {
                                  const estadoAprobExternal = mobilePhone ? objScriptParam.estadoAprobado : objScriptParam.estadoLatente;
                                  const estadoAprobadoInTernal =  mobilePhone ? objScriptParam.estadoAprobado : objScriptParam.pendienteDeEvaluacion;
                                  log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal?.oferta + ' - Cuota Final: ' + parseFloat(ofertaFinal?.cuotaFinal));
                                  auxLib.submitFieldsEntity(leadId, service == objScriptParam.serviceExternal ? estadoAprobExternal : estadoAprobadoInTernal, null,  objScriptParam.leadStatus, null, parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta), montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                                 cantEntidadesT6, t2Quals, t6Quals, 105);
                                  if (estadoAprobExternal == objScriptParam.estadoAprobado || estadoAprobadoInTernal == objScriptParam.estadoAprobado) {
                                     auxLib.snapshotAprobados(docNumber, leadId, objScriptParam.estadoAprobado, 105);
                                  }
                                  

                               } else {
                                  log.audit('Error', 'No hay oferta para el documento: ' + docNumber);
                                  auxLib.submitFieldsEntity(leadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta,  null, 0, 0, 0, montoCuotaObj?.montoCuotaName, score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, t2Quals, t6Quals);
                               }
                            } else {
                              auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta,  null, 0, 0, 0, 'Score Minimo', score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, score?.calificacionMinima, t6Quals);

                            }
    
                   
                      } else {
                         let repetidoIsPreLead = infoRepetido.status === objScriptParam.preLeadStatus;
                         let repetidoIsRejected = infoRepetido.approvalStatus === objScriptParam.estadoRechazado;
                         let repetidoIsFromExternal = infoRepetido.service === objScriptParam.externalService;
    
                         if (repetidoIsFromExternal && repetidoIsRejected) {
                            log.audit('Error', 'El documento ' + docNumber + ' tiene un Pre-Lead o Lead Repetido rechazado creado por Proveedor Externo.');

                            const newCustomerId = auxLib.copyRecordToRecord({
                               sourceType: record.Type.LEAD,
                               sourceId: infoRepetido.id,
                               targetId: preLeadId,
                               defaultValues:{
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                               },
                               fieldMap: {
                                  
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                               }
                            });
       
                            log.audit('Created customer', newCustomerId);
                         } else if (!repetidoIsFromExternal) {
                            if (repetidoIsPreLead && repetidoIsRejected) {
                               const newCustomerId = auxLib.copyRecordToRecord({
                                  sourceType: record.Type.LEAD,
                                  sourceId: infoRepetido.id,
                                  targetId: preLeadId,
                                  defaultValues:{
                                     'custrecord_sdb_nrodoc': docNumber,
                                     'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                     'custentity_elm_lead_repetido_original': infoRepetido.id
                                  },
                                  fieldMap: {
                                     
                                     'custrecord_sdb_nrodoc': docNumber,
                                     'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                     'custentity_elm_lead_repetido_original': infoRepetido.id
                                     
                                  }
                               });
          
                               log.audit('Created customer', newCustomerId);
                            
                            }
                            if (!repetidoIsPreLead && repetidoIsRejected) {
                               const newCustomerId = auxLib.copyRecordToRecord({
                                  sourceType: record.Type.LEAD,
                                  sourceId: infoRepetido.id,
                                  targetId: preLeadId,
                                  defaultValues:{
                                     'custrecord_sdb_nrodoc': docNumber,
                                     'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                     'custentity_elm_lead_repetido_original': infoRepetido.id
                                  },
                                  fieldMap: {
                                     
                                     'custrecord_sdb_nrodoc': docNumber,
                                     'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                     'custentity_elm_lead_repetido_original': infoRepetido.id
                                     
                                  }
                               });
          
                               log.audit('Created customer', newCustomerId);
                            
                            }
                            if (!repetidoIsRejected) {
                              const newCustomerId = auxLib.copyRecordToRecord({
                               sourceType: record.Type.LEAD,
                               sourceId: infoRepetido.id,
                               targetId: preLeadId,
                               defaultValues:{
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                               },
                               fieldMap: {
                                  
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                                  
                               }
                            });
       
                            log.audit('Created customer', newCustomerId);
                            
                            }
                         } else {
                            const newCustomerId = auxLib.copyRecordToRecord({
                               sourceType: record.Type.LEAD,
                               sourceId: infoRepetido.id,
                               targetId: preLeadId,
                               defaultValues:{
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepAprobado,
                                  //'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                               },
                               fieldMap: {
                                  
                                  'custrecord_sdb_nrodoc': docNumber,
                                  'custentity_elm_aprobado': objScriptParam.estadoRepAprobado,
                                  //'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                  'custentity_elm_lead_repetido_original': infoRepetido.id
                                  
                               }
                            });
       
                            log.audit('Created customer', newCustomerId);
                         }
    
                         
                         auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
                      }
                   } else {
                      log.audit('Error', 'El documento ' + docNumber + ' pertenece a Mocasist.');
                      auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoMocasist, objScriptParam.rechazoMocasist);
                   }
                } else {
                   log.audit('Error', 'El documento ' + docNumber + ' pertenece a la Lista Negra.');
                   auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoBlacklist, objScriptParam.rechazoBlacklist);
                }
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }
         /**
          * @author  Gerardo Gonzalez
          * @desc summarize - This function is used to process each key/value pair in the input data.
          * @param {object} scriptContext 
         */
        function summarize(summary) {
            let logTitle = 'Summarize';
            log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
        }

         /**
          * @author  Gerardo Gonzalez
          * @desc getScriptParameters - This function is used to retrieve the script parameters.
          * @param {object} scriptContext 
         */
         function getScriptParameters() {
               const scriptObj = runtime.getCurrentScript();
               const objParams = {
                  estadoAprobado: scriptObj.getParameter({
                     name: 'custscript_elm_aprob_bcu_error'
                  }),
                  estadoRechazado: scriptObj.getParameter({
                     name: 'custscript_elm_estado_rech_error_bcu'
                  }),
                  estadoRepRechazado: scriptObj.getParameter({
                     name: 'custscript_elm_rep_estado_rech_error_bcu'
                  }),
                  estadoRepAprobado: scriptObj.getParameter({
                     name: 'custscript_elm_rep_estado_aprob_error_bc'
                  }),
                  leadStatus: scriptObj.getParameter({
                     name: 'custscript_elm_lead_status_bcu'
                  }),
                  preLeadStatus: false,
                  externalService: scriptObj.getParameter({
                     name: 'custscript_elm_lead_status_bcu'
                  }),
                  scoreMin: scriptObj.getParameter({
                     name: 'custscript_score_min_error_bcu'
                  }),
                  estadoLatente: scriptObj.getParameter({
                     name: 'custscript_elm_latente_bcu_error'
                  }),
                  rechazoBlacklist: scriptObj.getParameter({
                     name: 'custscript_elm_list_black_bcu_error'
                  }),
                  rechazoMocasist: scriptObj.getParameter({
                     name: 'custscript_elm_mocasist_bcu_error'
                  }),
                  pendienteDeEvaluacion: scriptObj.getParameter({
                     name: 'custscript_elm_pendiente_de_evaluacion'
                  }),
                  serviceExternal: scriptObj.getParameter({
                     name: 'custscript_elm_serv_externo_pm'
                  }),
                  estadoMocasist: scriptObj.getParameter({
                     name: 'custscript_elm_estado_mocasist_mr'
                  }),
                  estadoBlacklist: scriptObj.getParameter({
                     name: 'custscript_elm_estado_blacklist_mr'
                  }),
               };
               return objParams;
            }

          function getOfertaFinal(proveedorId, monto_cuota) {
            const stLogTitle = 'getOfertaFinal';
            try {

               const hasSourceData = auxLib.checkSourceOfertaFinalDataExists(proveedorId)
               
               let searchFilters = hasSourceData
                  ? [["custrecord_source", "is", proveedorId], "AND", ["custrecord_monto_cuota", "lessthanorequalto", monto_cuota]]
                  : [["custrecord_source", "isempty", ""], "AND", ["custrecord_monto_cuota", "lessthanorequalto", monto_cuota]];

               const searchColumns = [
                  search.createColumn({ name: "internalid" }),
                  search.createColumn({ name: "name" }),
                  search.createColumn({ name: "custrecord_monto_cuota", sort: search.Sort.DESC }),
                  search.createColumn({ name: "custrecord_oferta" }),
                  search.createColumn({ name: "custrecord_plazo" }),
                  search.createColumn({ name: "custrecord_monto_cuota_final" }),
                  search.createColumn({ name: "custrecord_source" })
               ];

               const searchObj = search.create({
                  type: "customrecord_sdb_oferta_final",
                  filters: searchFilters,
                  columns: searchColumns
               });

               let ofertaFinal = null;
               searchObj.run().each(function (result) {
                  ofertaFinal = {
                     internalid: result.getValue('internalid'),
                     name: result.getValue('name'),
                     montoCuota: result.getValue('custrecord_monto_cuota'),
                     oferta: result.getValue('custrecord_oferta'),
                     plazo: result.getValue('custrecord_plazo'),
                     cuotaFinal: result.getValue('custrecord_monto_cuota_final'),
                     source: result.getValue('custrecord_source')
                  };
                  return false; // Stop after first result
               });

               log.debug(stLogTitle, ofertaFinal);
               return ofertaFinal;
            } catch (error) {
               log.error(stLogTitle, error);
            }
      }


       

         /**
          * Sends an email alert when high volume of BCU error leads is detected
          * @param {number} leadCount - Number of leads found with BCU errors
          */
         function sendHighVolumeAlert(leadCount) {
             const logTitle = 'sendHighVolumeAlert';
             try {
                 log.audit(logTitle, `Iniciando función de alerta - ${leadCount} leads encontrados`);
                 log.audit(logTitle, `Umbral actual: 30 leads`);
                 
         
                 log.audit(logTitle, `Enviando alerta por alto volumen de errores BCU: ${leadCount} leads encontrados`);
                 
                 const scriptObj = runtime.getCurrentScript();
                 const currentUser = runtime.getCurrentUser();
                 
                 // Obtener parámetros de email del script
                 const emailCC = scriptObj.getParameter({ name: 'custscript_elm_email_cc_bcu' }) || 'ssilvera@enlamano.com.uy';
                 const emailRecipients = 'mcampodonico@enlamano.com.uy, cshearer@enlamano.com.uy';
                 const author = scriptObj.getParameter({ name: 'custscript_elm_autor_' });

                 log.debug(logTitle, `Email recipients: ${emailRecipients}`);
                 log.debug(logTitle, `Email CC: ${emailCC}`);
                 log.debug(logTitle, `Email Author: ${author}`);
                 // Preparar contenido del email
                 const currentDateTime = new Date().toLocaleString('es-ES', {
                     year: 'numeric',
                     month: '2-digit',
                     day: '2-digit',
                     hour: '2-digit',
                     minute: '2-digit',
                     second: '2-digit'
                 });
                 
                 const subject = `🚨 ALERTA: Alto volumen de Leads con Error BCU - ${leadCount} leads detectados`;
                 
                 const emailBody = `
                     <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                         <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
                             <h2 style="color: #721c24; margin: 0;">⚠️ ALERTA DE SISTEMA - ALTO VOLUMEN DE ERRORES BCU</h2>
                         </div>
                         
                         <p><strong>Fecha y Hora:</strong> ${currentDateTime}</p>
                         <p><strong>Usuario que ejecutó:</strong> ${currentUser.name} (ID: ${currentUser.id})</p>
                         
                         <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                             <h3 style="color: #856404; margin-top: 0;">Resumen del Problema</h3>
                             <ul>
                                 <li><strong>Leads con Error BCU detectados:</strong> <span style="font-size: 18px; color: #dc3545; font-weight: bold;">${leadCount}</span></li>
                                 <li><strong>Umbral de alerta:</strong> 40 leads</li>
                                 <li><strong>Exceso detectado:</strong> ${leadCount - 40} leads por encima del umbral</li>
                             </ul>
                         </div>
                         
                         <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 5px; padding: 15px; margin: 20px 0;">
                             <h3 style="color: #0c5460; margin-top: 0;">Criterios de Búsqueda</h3>
                             <p>Se encontraron Leads/Customers con las siguientes características:</p>
                             <ul>
                                 <li>Status: Lead (7) o Customer (6)</li>
                                 <li>Condición: Contiene "Error al obtener datos del BCU" O Estado = Error BCU (15)</li>
                                 <li>Sin Lead repetido original</li>
                             </ul>
                         </div>
                         
                         <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 5px; padding: 15px; margin: 20px 0;">
                             <h3 style="color: #155724; margin-top: 0;"> Acciones Recomendadas</h3>
                             <ul>
                                 <li>✅ Revisar la conectividad con el sistema BCU</li>
                                 <li>✅ Verificar logs del sistema para errores recurrentes</li>
                                 <li>✅ Evaluar si es necesario re-procesar estos leads</li>
                                 <li>✅ Contactar al equipo técnico si el problema persiste</li>
                             </ul>
                         </div>
                         
                         <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin: 20px 0;">
                             <h3 style="color: #495057; margin-top: 0;"> Próximos Pasos</h3>
                             <p>El script procederá a:</p>
                             <ol>
                                 <li> La Automatizacion va consultar de nuevo y corregir los datos</li>
                                 <li> Verifique la search con el nombre: ELM | Error al obtener datos del BCU - ALERT (Auditoria)</li>
                                 <li> Comuníquese con los responsables de las areas</li>
                             </ol>
                         </div>
                         
                         <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
                         
                         <p style="font-size: 12px; color: #6c757d;">
                             <strong>Nota:</strong> Este es un email automático generado por el sistema EnLaMano.<br>
                             Para configurar alertas, contacte al administrador del sistema.
                         </p>
                     </div>
                 `;
                 log.audit(logTitle, `Antes de enviar a: ${emailRecipients}`);
                 log.audit(logTitle, `Usuario actual: ${currentUser.name} (ID: ${currentUser.id})`);
                 log.audit(logTitle, `CC: ${emailCC}`);
                 
                 // Enviar email
                 const emailResult = email.send({
                     author: author,
                     recipients: emailRecipients,
                     cc: [emailCC],
                     subject: subject,
                     body: emailBody
                 });
                 
                 log.audit(logTitle, `Email enviado exitosamente. ID: ${emailResult}`);
                 log.audit(logTitle, `Destinatarios: ${emailRecipients}`);
                 
             } catch (e) {
                 log.error(logTitle, `Error enviando email de alerta: ${e.message}`);
                 // No lanzar error para no interrumpir el procesamiento principal
             }
         }

         /**
          * removeSpecialCharacters - Removes special characters from a string
          * @param {string} input - The string to clean
          * @param {boolean} [onlyDotsAndHyphens=false] - If true, removes only dots and hyphens
          * @returns {string} The cleaned string
          */
         function removeSpecialCharacters(input) {
            try {
               if (!input) return '';
               // Remove dots and hyphens
               return input.replace(/[.\-]/g, '');
            // For more special characters, use this instead:
            // return input.replace(/[^a-zA-Z0-9\s]/g, '');
            } catch (error) {
               log.error('removeSpecialCharacters', error);
            }
         }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
