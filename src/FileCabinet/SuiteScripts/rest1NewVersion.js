/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */ 
 
define(['N/search', "./SDB-Enlamano-score.js", 'N/runtime', "./ELM_Aux_Lib.js", 'N/record'/* , './ELM_SCORE_BCU_LIB.js' */],
   function (search, scoreLib, runtime, auxLib, record/* , bcuScoreLib */) { 

      function post(requestBody) {
         const logTitle = 'post';
         const objScriptParam = getScriptParameters();
         let user = runtime.getCurrentUser().id;
         let docNumber = requestBody.docNumber;
         let firstName = requestBody.firstName;
         let lastName = requestBody.lastName;
         let activityType = requestBody.activityType;
         let salary = requestBody.salary;
         let dateOfBirth = requestBody.dateOfBirth;
         let workStartDate = requestBody.workStartDate;
         let source = requestBody.source;
         const trackingId = requestBody?.trackingId || null;
         const idLog = auxLib.createLogRecord(docNumber, null, false, 1, source, requestBody);
         const response = {
            docNumber: docNumber,
            success: false,
            result: 'Consulte nuevamente más tarde'
         };
         try {

            const isValid = auxLib.validateCI(docNumber);
            if (!isValid) {
               log.audit('Error', 'El documento ' + docNumber + ' no es válido.');
               response.success = false;
               response.result = 'Documento no válido';
                auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
                log.debug('Response S1  ' + docNumber, JSON.stringify(response));
               return response;
            }
            let sourceId = auxLib.getProveedorId(source);
            auxLib.deactivateLeadsByDocumentNumber(docNumber); 
            const infoRepetido = auxLib.getInfoRepetido(docNumber, null, false);
            let activity = auxLib.getActivityType(activityType);
            let age = auxLib.calculateYearsSinceDate(dateOfBirth);
            let yearsOfWork;
            if (workStartDate) yearsOfWork = auxLib.calculateYearsSinceDate(workStartDate);
            log.debug('infoRepetido S1', infoRepetido);
            if (infoRepetido?.approvalStatus != objScriptParam?.estadoLatente) {
               
               let preLeadId = auxLib.createPreLead(objScriptParam.externalService, docNumber, null, firstName, lastName, activity, salary, dateOfBirth, yearsOfWork, age, sourceId, workStartDate, objScriptParam?.estadoRechazado,null, source, activityType, trackingId);
               let blackList = auxLib.checkBlacklist(docNumber);
               
               if (!blackList) {
                  
                  let mocasist = auxLib.checkMocasist(docNumber);

                  if (!mocasist) {
                    
                     if (!infoRepetido?.id) {

                         const score = scoreLib.scoreFinal(docNumber);
                           // const score = bcuScoreLib.scoreFinal(docNumber, { provider: 'mym', forceRefresh: true, debug: true, strictRules: true });
                        
                           // Extract BCU data for t2 and t6 periods
                           const bcuData = auxLib.extractBcuData(score);
                           const t2Info = auxLib.getBcuPeriodInfo(bcuData?.t2, 't2');
                           const endeudamientoT2 = t2Info?.rubrosGenerales[0]?.MnPesos || 0;
                           const cantEntidadesT2 = t2Info?.entidades.length || 0;
                           const t6Info = auxLib.getBcuPeriodInfo(bcuData.t6, 't6');
                           const endeudamientoT6 = t6Info?.rubrosGenerales[0]?.MnPesos || 0;
                           const cantEntidadesT6 = t6Info?.entidades.length || 0;
                           const t2Quals = bcuData?.t2Qualifications?.map(q => q.calificacion);
                           // Get all qualification values from T6  
                           const t6Quals = bcuData?.t6Qualifications?.map(q => q.calificacion);
                           // Manejo de rechazo BCU con calificación visible
                           if (score?.error_reglas) {
                              let approvalStatus = objScriptParam.estadoRechazado;

                              // Normalizar texto de detail(s) para búsqueda de frases conocidas
                              const detailText = String(score.detail || score.details || '').toLowerCase();
                              const isTimeoutDetail = (
                                 detailText.indexOf('el host al cual está intentando conectarse') !== -1 && detailText.indexOf('exced') !== -1
                              ) || detailText.indexOf('excedido el tiempo') !== -1 || detailText.indexOf('excedido el tiempo máximo') !== -1;
                              const isBcuFetchError = detailText.indexOf('error al obtener datos del bcu') !== -1;

                              if (score.error_reglas == 500 || score.error_reglas == 400 || isTimeoutDetail || isBcuFetchError || detailText) {
                                 approvalStatus = objScriptParam.estadoErrorBCU || 15;
                              }

                              if (score.error_reglas == 404) {
                                 approvalStatus = objScriptParam.NohayInfoBCU;
                              }

                              log.audit('Error', `El documento ${docNumber} tiene mala calificación en BCU.`);
                              response.success = false;
                              response.result = 'BCU';
            
                              auxLib.submitFieldsEntity(preLeadId, approvalStatus || 1, objScriptParam.rechazoBCU, null, null, null, null, null, {
                                 score: 0,
                                 calificacionMinima: score?.calificacionMinima,
                                 detail: score?.detail,
                                 nombre: score?.nombre
                              });

                              auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
                              log.debug('Response S1  ' + docNumber, JSON.stringify(response));
                              return response;
                           }

                           if (score.calificacionMinima == 'N/C') {
                              log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
                              response.success = false;
                              response.result = 'BCU';
                              auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoBCU, null, null, null, null, null, score);
                              auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
                              log.debug('Response S1  ' + docNumber, JSON.stringify(response));
                              return response;
                           }
                           if (score && score.score > objScriptParam.scoreMin) {
                              let leadId = auxLib.convertToLead(preLeadId, score, objScriptParam.leadStatus);
                              if (score.error_reglas == null) {
                                 score.error_reglas = false;
                              } 
                              const montoCuotaObj = auxLib.getPonderador(score?.score, score?.calificacionMinima, score?.endeudamiento, salary, activity, age, source);
                              const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj?.ponderador);
                       /*        let ofertaFinal
                              if (montoCuota > 0) { */
                                const ofertaFinal = getOfertaFinal(source, montoCuota);
                              //  }
                              
                              let isLatente = true;
                              
                              if (montoCuotaObj?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END') && source != 'AlPrestamo') {
                                 isLatente = false;
                              }

                              if (source == 'AlPrestamo' && (!ofertaFinal?.oferta || ofertaFinal?.oferta <= 0)) {
                                  isLatente = false;
                              }
                               
                  
                              if (isLatente) {
                                 log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal?.oferta + ' - Cuota Final: ' + parseFloat(ofertaFinal?.cuotaFinal));
                                 response.success = true;
                                 response.result = 'Listo para recibir datos en servicio 2';
                                 if(source == 'Creditleads'){
                                    response.oferta = ofertaFinal?.oferta;
                                 }
                                 auxLib.submitFieldsEntity(leadId, objScriptParam.estadoLatente, null,  objScriptParam.leadStatus, null, parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta), montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                                 cantEntidadesT6, t2Quals, t6Quals);
                              }  else {
                                 log.audit('Error', 'No hay oferta para el documento: ' + docNumber);
                                 response.success = false;
                                 response.result = 'No hay oferta';
                                 auxLib.submitFieldsEntity(leadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta,  null, 0, 0, 0, montoCuotaObj?.montoCuotaName, score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, score?.calificacionMinima, t6Quals);
                              }
                           
                           
                           } else {
                                 log.audit('Error', 'No hay oferta para el documento: ' + docNumber);
                                 response.success = false;
                                 response.result = 'No hay oferta';
                                 log.debug('score no cumple', JSON.stringify(score));
                                 auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta,  null, 0, 0, 0, 'Score Minimo', score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2, cantEntidadesT6, score?.calificacionMinima, t6Quals);
                              }

                     } else {
                        let repetidoIsPreLead = infoRepetido.status === objScriptParam.preLeadStatus;
                        let repetidoIsRejected = infoRepetido.approvalStatus === objScriptParam.estadoRechazado;
                        let repetidoNoInfo = infoRepetido.approvalStatus === objScriptParam.NohayInfoBCU;
                        let repetidoIsFromExternal = infoRepetido.service === objScriptParam.externalService;
                        const isPendienteEvaluacion = infoRepetido.approvalStatus == '3';
                        if (repetidoIsFromExternal && !repetidoIsRejected && !repetidoNoInfo) {
                           response.success = false;
                           response.result = 'Repetido';
                        const newCustomerId = auxLib.copyRecordToRecord({
                           sourceType: record.Type.LEAD,
                           sourceId: infoRepetido.id,
                           targetId: preLeadId,
                           defaultValues:{
                              'custrecord_sdb_nrodoc': docNumber,
                              'custentity_elm_aprobado': infoRepetido.estadoRepAprobado,
                              'custentity_elm_lead_repetido_original': infoRepetido.id,
                              'isinactive': true
                           },
                           fieldMap: {
                              
                              'custrecord_sdb_nrodoc': docNumber,
                              'custentity_elm_aprobado': infoRepetido.estadoRepAprobado,
                              'custentity_elm_lead_repetido_original': infoRepetido.id,
                              'isinactive': true
                           }
                        });

                        log.audit('Created customer', newCustomerId);
                        
                        }
                        if (repetidoIsFromExternal && repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Pre-Lead o Lead Repetido rechazado creado por Proveedor Externo.');
                           response.success = false;
                           response.result = 'Repetido rechazado';
                           //auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRepRechazado, objScriptParam.rechazoRepRechazado, infoRepetido.status, infoRepetido);
                           // Copy a lead to a customer record
                     
                           const newCustomerId = auxLib.copyRecordToRecord({
                              sourceType: record.Type.LEAD,
                              sourceId: infoRepetido.id,
                              targetId: preLeadId,
                              defaultValues:{
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                 'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
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

                       
                        } else if (!repetidoIsFromExternal) {
                           
                           if (repetidoIsPreLead && repetidoIsRejected) {
               
                              const newCustomerId = auxLib.copyRecordToRecord({
                                 sourceType: record.Type.LEAD,
                                 sourceId: infoRepetido.id,
                                 targetId: preLeadId,
                                 defaultValues:{
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
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
                           if (!repetidoIsPreLead && repetidoIsRejected) {
      
                              const newCustomerId = auxLib.copyRecordToRecord({
                                 sourceType: record.Type.LEAD,
                                 sourceId: infoRepetido.id,
                                 targetId: preLeadId,
                                 defaultValues:{
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoRepRechazado,
                                    'custentity_elm_lead_repetido_original': infoRepetido.id,
                                    'isinactive': true
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
                           if (!repetidoIsRejected && !infoRepetido) {
              
                           const newCustomerId = auxLib.copyRecordToRecord({
                              sourceType: record.Type.LEAD,
                              sourceId: infoRepetido.id,
                              targetId: preLeadId,
                              defaultValues:{
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': objScriptParam.estadoRepAprobado,
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
                              },
                              fieldMap: {
                                 
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': objScriptParam.estadoRepAprobado,
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
                              }
                           });
      
                           log.audit('Created customer', newCustomerId);
                           
                           }
                        }

                        if(!repetidoIsRejected && repetidoNoInfo) {
                           response.success = false;
                           response.result = 'Repetido No Info BCU';
                           const newCustomerId = auxLib.copyRecordToRecord({
                              sourceType: record.Type.LEAD,
                              sourceId: infoRepetido.id,
                              targetId: preLeadId,
                              defaultValues:{
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': '16',
                                 'custentity_elm_reject_reason': "3",
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
                              },
                              fieldMap: {
                                 
                                 'custrecord_sdb_nrodoc': docNumber,
                                 'custentity_elm_aprobado': '16',
                                 'custentity_elm_reject_reason': "3",
                                 'custentity_elm_lead_repetido_original': infoRepetido.id,
                                 'isinactive': true
                              }
                           });
      
                           log.audit('Created customer', newCustomerId);
                        }
                        if(isPendienteEvaluacion) {
                           const montoCuotaObj = auxLib.getPonderador(infoRepetido.score, infoRepetido.calificacion, infoRepetido.endeudamiento, salary, activity, age, "6");
                           const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj?.ponderador);

                        
                           const ofertaFinal = auxLib.getOfertaFinal(montoCuota);

                           let approvalStatus = objScriptParam.estadoRechazado;
                           if (ofertaFinal?.internalid) {
                              log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal.oferta + ' - Cuota Final: ' + parseFloat(ofertaFinal.cuotaFinal));
                              approvalStatus = objScriptParam.estadoAprobado;
                            
                           }
                           const idPrelid = record.submitFields({
                              type: record.Type.LEAD,
                              id: infoRepetido.id, 
                              values: {
                                  'custentity_elm_aprobado': approvalStatus,
                                  'custentity_elm_service': '2',
                                  'custentity_elm_channel':"6", 
                                  'custentity_sdb_valor_cuota': montoCuota,
                                  'custentity_sdb_montoofrecido':ofertaFinal?.internalid ? parseFloat(ofertaFinal?.oferta) : '',
                                  'custentity_elm_oferta_final': ofertaFinal?.internalid ? parseFloat(ofertaFinal?.cuotaFinal) : '',
                                  'custentity_sdb_valor_cuota_vale': ofertaFinal?.internalid ? parseFloat(ofertaFinal?.cuotaFinal) : '',
                                  'custentity_elm_monto_cuota': montoCuotaObj?.montoCuotaName ? montoCuotaObj?.montoCuotaName : '',
                                  'custentity_elm_plazo': ofertaFinal?.plazo ? ofertaFinal?.plazo : '',
                                  'custentity_score': infoRepetido.score,
                                  'custentity_elm_lead_repetido_original': '',
                                  'entitystatus': ofertaFinal?.internalid ? objScriptParam.leadStatus : 6,
                                  'mobilephone': infoRepetido.mobilephone,
                                  'custentity_sdb_actividad': activity,
                                  'custentity_sdb_fechanac': dateOfBirth,
                                  'custentity_elm_fecha_ingreso': workStartDate,
                                  'custentity_sdb_infolab_importe': salary,
                                  'custentity_sdb_edad': age,
                              }
                           }); 
                           log.debug('infoRepetido logic newCustomerId S1', idPrelid);  
                        }
                        response.success = false;
                        response.result = 'Repetido';
                        auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
                     }
                  } else {
                     log.audit('Error', 'El documento ' + docNumber + ' pertenece a Mocasist.');
                     response.success = false;
                     response.result = 'Mocasist';

                      if(infoRepetido?.id) {
                       const newCustomerId = auxLib.copyRecordToRecord({
                                 sourceType: record.Type.LEAD,
                                 sourceId: infoRepetido?.id,
                                 targetId: preLeadId,
                                 defaultValues:{
                                    'custrecord_sdb_nrodoc': docNumber,
                                    'custentity_elm_aprobado': objScriptParam.estadoRepRechazado,
                                    'custentity_elm_reject_reason': objScriptParam.rechazoMocasist,
                                    'custentity_elm_lead_repetido_original': infoRepetido?.id,
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
                     } else {
                        auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoMocasist, objScriptParam.rechazoMocasist);
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

                  } else {
                     auxLib.submitFieldsEntity(preLeadId, objScriptParam?.estadoBlacklist, objScriptParam?.rechazoBlacklist);
                  }
               }

            } else {

               if (source == 'AlPrestamo' && infoRepetido?.canal != "2") {
                  const montoCuotaObj = auxLib.getPonderador(infoRepetido?.score, infoRepetido?.calificacionMinima, infoRepetido?.endeudamiento, salary, activity, age, source);
                  const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj?.ponderador);
                  const ofertaFinal = getOfertaFinal(source, montoCuota);
                  if (ofertaFinal) {
                     response.success = true;
                     response.result = 'Listo para recibir datos en servicio 2';
                     const updateAlPrestamoScenarioID = record.submitFields({
                     type: record.Type.LEAD,
                     id: infoRepetido.id, 
                     values: {
                           'custentity_elm_channel':"2", 
                           'custentity_sdb_valor_cuota': montoCuota,
                           'custentity_sdb_montoofrecido':ofertaFinal?.internalid ? parseFloat(ofertaFinal?.oferta) : '',
                           'custentity_elm_oferta_final': ofertaFinal?.internalid ? parseFloat(ofertaFinal?.cuotaFinal) : '',
                           'custentity_sdb_valor_cuota_vale': ofertaFinal?.internalid ? parseFloat(ofertaFinal?.cuotaFinal) : '',
                           'custentity_elm_monto_cuota': montoCuotaObj?.montoCuotaName ? montoCuotaObj?.montoCuotaName : '',
                           'custentity_elm_plazo': ofertaFinal?.plazo ? ofertaFinal?.plazo : '',
                           'custentity_sdb_edad': age,
                           'custentity_sdb_infolab_importe': salary,
                           'custentity_sdb_actividad': activity

                        }
                     }); 
                     log.debug('updateAlPrestamoScenarioID S1', updateAlPrestamoScenarioID);

                  } else {
                     response.success = false;
                     response.result = 'Repetido';
                    
                  }

                   
               } else {

                  if (source == 'Creditleads') {
                     response.oferta = infoRepetido?.montoOfrecido;
                  }

                  response.success = true;
                  response.result = 'Listo para recibir datos en servicio 2';
               }

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
                  value: 'El Lead ' + docNumber + ' Ingreso por el provedor externo: ' + source
               });
               const idComentario = comentRec.save()
               log.debug('Se creo el comentario: ', idComentario);
              
            }

         } catch (e) {
            log.error(logTitle, e);
            response.success = false;
            response.result = e.message;
            const obj = {
               tipo: 2,
               usuario: user,
               record: 'Lead',
               notas:  'Error - Servicio 1: ' + docNumber + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);
         }
         log.debug('Response S1  ' + docNumber, JSON.stringify(response));
         auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
         return response;
      }


      function getOfertaFinal(source, monto_cuota) {
         const stLogTitle = 'getOfertaFinal';
         try {
            const proveedorId = auxLib.getProveedorId(source);
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


      function getScriptParameters() {
         const scriptObj = runtime.getCurrentScript();
         const objParams = {
            estadoAprobado: scriptObj.getParameter({
               name: 'custscript_elm_estado_aprobado'
            }),
            estadoRechazado: scriptObj.getParameter({
               name: 'custscript_elm_estado_rechazado'
            }),
            estadoRepRechazado: scriptObj.getParameter({
               name: 'custscript_elm_rep_estado_rechazado'
            }),
            estadoRepAprobado: scriptObj.getParameter({
               name: 'custscript_elm_rep_estado_aprobado'
            }),
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
            rechazoRepEspecial: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_rep_esp'
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
            scoreMin: scriptObj.getParameter({
               name: 'custscript_score_minimo'
            }),
            estadoLatente: scriptObj.getParameter({
               name: 'custscript_elm_estado_latente'
            }),
            NohayInfoBCU: scriptObj.getParameter({
               name: 'custscript_elm_no_hay_info_bcu_pm'
            }), 
            estadoErrorBCU: scriptObj.getParameter({
               name: 'custscript_elm_estado_error_bcu'
            }),
            estadoMocasist: scriptObj.getParameter({
               name: 'custscript_elm_est_mocasist'
            }),
            estadoBlacklist: scriptObj.getParameter({
               name: 'custscript_elm_est_blacklist'
            })/* ,
            reConsultaErrorBCU: scriptObj.getParameter({
               name: 'custscript_elm_reconsulta_error_bcu'
            }) */

         };
         return objParams;
      }


      

         return {
            post: post
         };

   });
