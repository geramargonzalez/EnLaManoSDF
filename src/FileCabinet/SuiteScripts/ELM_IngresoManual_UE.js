/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define(['./SDB-Enlamano-score.js', './ELM_Aux_Lib.js', 'N/runtime', 'N/error', 'N/search', 'N/record'],
   (scoreLib, auxLib, runtime, error, search, record) => {
      // Field constants for cleaner access
      const FIELDS = {
         salary: 'custentity_sdb_infolab_importe',
         dob: 'custentity_sdb_fechanac',
         activity: 'custentity_sdb_actividad',
         age: 'custentity_sdb_edad',
         workStart: 'custentity_elm_fecha_ingreso',
         yearsWork: 'custentity_elm_years_work',
         docNumber: 'custentity_sdb_nrdocumento',
         aprobado: 'custentity_elm_aprobado',
         motivoRechazo: 'custentity_elm_reject_reason',
         score: 'custentity_score',
         calificacion: 'custentity_calificacion',
         montoOfrecido: 'custentity_sdb_montoofrecido',
         canal: 'custentity_elm_channel',
      };

      const beforeSubmit = (scriptContext) => {
         const { oldRecord, newRecord, type, UserEventType } = scriptContext;
         let idLog = null;
         const docNumber = newRecord.getValue(FIELDS.docNumber);
         const estadoGestionPendienteSinRespuesta = newRecord.getValue(FIELDS.aprobado);
         const response = {
               docNumber: docNumber,
               success: true,
               result: 'Proceso de creacion de lead comenzado ... '
            };
        
         try {

             if (type == scriptContext.UserEventType.CREATE) {
               idLog = auxLib.createLogRecord(docNumber, null, false, 5, 'Manual');
            }

            if(estadoGestionPendienteSinRespuesta == 22) {
               return null
            }
            const objScriptParam = getScriptParameters();
            const isEdit = type === UserEventType.EDIT;
            const isCreate = type === UserEventType.CREATE;
            
             if (isCreate) {
               auxLib.deactivateLeadsByDocumentNumber(docNumber);
            }
            const oldValues = {
               salary: oldRecord?.getValue(FIELDS.salary),
               dob: oldRecord?.getValue(FIELDS.dob),
               activity: oldRecord?.getValue(FIELDS.activity),
               age: auxLib.calculateYearsSinceDate(oldRecord?.getValue(FIELDS.dob))
            };

            const newValues = {
               salary: newRecord.getValue(FIELDS.salary),
               dob: newRecord.getValue(FIELDS.dob),
               activity: newRecord.getValue(FIELDS.activity),
               age: auxLib.calculateYearsSinceDate(newRecord.getValue(FIELDS.dob))
            };
            const canal = newRecord.getValue(FIELDS.canal);
            const needsRecalculate = isEdit && (
               oldValues.salary !== newValues.salary ||
               oldValues.age !== newValues.age ||
               oldValues.activity !== newValues.activity
            );
           
            if (isCreate || needsRecalculate) {
               if (needsRecalculate) {
                  [FIELDS.yearsWork, FIELDS.aprobado, FIELDS.motivoRechazo, FIELDS.score, FIELDS.calificacion, FIELDS.montoOfrecido].forEach(field => {
                     newRecord.setValue(field, null);
                  });
               }

               newRecord.setValue(FIELDS.age, newValues.age);

               const workStartDate = newRecord.getValue(FIELDS.workStart);
               if (workStartDate) {
                  newRecord.setValue(FIELDS.yearsWork, auxLib.calculateYearsSinceDate(workStartDate));
               }
               let infoRepetido = auxLib.getInfoRepetido(docNumber, null, false);

               if(isEdit) {
                  if (infoRepetido?.id && infoRepetido?.id == newRecord?.id) {
                        infoRepetido = {};
                  }
               }
             log.debug('infoRepetido test', JSON.stringify(infoRepetido));
               if (auxLib.checkBlacklist(docNumber)) {
                 
                  if (infoRepetido?.id) {
                     log.audit('Error', `El documento ${docNumber} pertenece a la Lista Negra y ya tiene un Pre-Lead creado.`);
                     return auxLib.updateEntity({
                        entity: newRecord,
                        approvalStatus: objScriptParam.estadoRepRechazado,
                        rejectReason: objScriptParam.rechazoBlacklist,
                     });
                  }
                  log.audit('Error', `El documento ${docNumber} pertenece a la Lista Negra.`);
                  return auxLib.updateEntity({
                     entity: newRecord,
                     approvalStatus: objScriptParam.estadoBlacklist,
                     rejectReason: objScriptParam.rechazoBlacklist
                  });
               }

               if (auxLib.checkMocasist(docNumber)) {
                  log.audit('Error', `El documento ${docNumber} pertenece a Mocasist.`);
                  
                  if (infoRepetido.id) {
                     log.audit('Error', `El documento ${docNumber} pertenece a Mocasist y ya tiene un Pre-Lead creado.`);
                     return auxLib.updateEntity({
                        entity: newRecord,
                        approvalStatus: objScriptParam.estadoRepRechazado,
                        rejectReason: objScriptParam.rechazoMocasist,
                     });
                  }
                  log.audit('Error', `El documento ${docNumber} pertenece a Mocasist y no tiene un Pre-Lead creado.`);
                  
                  return auxLib.updateEntity({
                     entity: newRecord,
                     approvalStatus: objScriptParam.estadoMocasist,
                     rejectReason: objScriptParam.rechazoMocasist
                  });
               }
               const isPreLead = infoRepetido.status === objScriptParam.preLeadStatus;
               const isRejected = infoRepetido.approvalStatus === objScriptParam.estadoRechazado;
               const isFromExternal = infoRepetido.service === objScriptParam.externalService;

              const shouldScore = !infoRepetido.id || (isFromExternal && isPreLead && isRejected) || needsRecalculate || isCreate;
               if (shouldScore) {
                  const score = scoreLib.scoreFinal(docNumber);
                  const bcuData = auxLib.extractBcuData(score);
                  const t2Info = auxLib.getBcuPeriodInfo(bcuData.t2, 't2');
                  const endeudamientoT2 = t2Info?.rubrosGenerales[0]?.MnPesos || 0;
                  const cantEntidadesT2 = t2Info?.entidades.length || 0;
                  const t6Info = auxLib.getBcuPeriodInfo(bcuData.t6, 't6');
                  const endeudamientoT6 = t6Info?.rubrosGenerales[0]?.MnPesos || 0;
                  const cantEntidadesT6 = t6Info?.entidades.length || 0;
                  
                  const peroCalifT2 = JSON.stringify(bcuData?.t2Qualifications?.map(q => q.calificacion));
                  // Get all qualification values from T6
                  const peroCalifT6 = JSON.stringify(bcuData?.t6Qualifications?.map(q => q.calificacion));

                  if (score !== null && score?.score > 499) {
                     const montoCuotaObj = auxLib.getPonderador(score?.score, score.calificacionMinima, score.endeudamiento, newValues.salary, newValues.activity, newValues.age, canal);
                     const montoCuota = parseFloat(newValues.salary) * parseFloat(montoCuotaObj.ponderador);
                     const ofertaFinal = auxLib.getOfertaFinal(montoCuota);

                     let isApproved = true;

                      if (montoCuotaObj?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END')) {
                           log.debug('Rechazo VAR END');
                           isApproved = false;
                        }
 
                     if (isApproved) {
                        log.audit('Success', `Oferta para el documento: ${docNumber}. Oferta: ${ofertaFinal?.oferta} - Cuota Final: ${ofertaFinal?.cuotaFinal}`);
                        auxLib.updateEntity({
                           entity: newRecord,
                           approvalStatus: objScriptParam.estadoAprobado,
                           score: score,
                           entityStatus: objScriptParam.leadStatus,
                           montoCuota: parseFloat(ofertaFinal?.cuotaFinal),
                           ofertaFinal: parseFloat(ofertaFinal?.oferta),
                           montoCuotaName: montoCuotaObj?.montoCuotaName,
                           plazo: ofertaFinal?.plazo,
                           endeudamientoT2,
                           endeudamientoT6,
                           cantEntidadesT2,
                           cantEntidadesT6,
                           peroCalifT2,
                           peroCalifT6
                        }); 

                        // Snapshot de aprobados se actualiza en afterSubmit cuando ya existe el ID del lead
                     } else {
                        log.audit('Error', `No hay oferta para el documento: ${docNumber}`);
                        auxLib.updateEntity({
                           entity: newRecord,
                           approvalStatus: objScriptParam.estadoRechazado,
                           rejectReason: objScriptParam.rechazoNoHayOferta,
                           score: score,
                           entityStatus: objScriptParam.leadStatus,
                           montoCuota: 0,
                           ofertaFinal: 0,
                           montoCuotaName: montoCuotaObj.montoCuotaName,
                           plazo: 0,
                           endeudamientoT2,
                           endeudamientoT6,
                           cantEntidadesT2,
                           cantEntidadesT6,
                           peroCalifT2,
                           peroCalifT6
                        });
                     }
                  } else {
                     log.audit('Error', `El documento ${docNumber} tiene mala calificación en BCU.`);
                     let approvalStatus = objScriptParam.estadoRechazado;

                     if (score.error_reglas == 500 || score.error_reglas == 400) {
                        approvalStatus = objScriptParam.estErrorBCU;
                     }

                     if (score.error_reglas == 404) {
                        approvalStatus = objScriptParam.estNohayInfoBCU;
                     }
      
                     auxLib.updateEntity({
                        entity: newRecord,
                        approvalStatus: approvalStatus,
                        rejectReason: objScriptParam.rechazoBCU,
                        score: score,
                        entityStatus: objScriptParam.preLeadStatus,
                     });
                  }
               } else {
                  const rejectReason = objScriptParam.rechazoRepRechazado;
                  if (!isFromExternal && isPreLead && isRejected) {
                     log.audit('Error', `El documento ${docNumber} tiene un Pre-Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.`);
                     auxLib.updateEntity({
                        entity: newRecord,
                        approvalStatus: objScriptParam.estadoRechazado,
                        rejectReason,
                        infoRepetido
                     });
                  } else if (!isFromExternal && !isPreLead && isRejected) {
                     log.audit('Error', `El documento ${docNumber} tiene un Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.`);
                     auxLib.updateEntity({
                        entity: newRecord,
                        approvalStatus: objScriptParam.estadoRechazado,
                        rejectReason,
                        entityStatus: objScriptParam.leadStatus,
                        infoRepetido
                     });
                  }
               }
            }
            
         } catch (e) {
            log.error('beforeSubmit', e);
            response.success = false;
            response.result = e.message || 'Error inesperado al procesar el ingreso manual';
            const user = runtime.getCurrentUser().id;
            const obj = {
               tipo: 2,
               usuario: user,
               record: 'Lead',
               notas:  'Error - Servicio 5: ' + docNumber + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);
         }

           if (idLog) {
             auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
           }

      }

      const getScriptParameters = () => {
         const scriptObj = runtime.getCurrentScript();
         return {
            estadoAprobado: scriptObj.getParameter({ name: 'custscript_elm_estado_aprobado' }),
            estadoRechazado: scriptObj.getParameter({ name: 'custscript_elm_estado_rechazado' }),
            rechazoBlacklist: scriptObj.getParameter({ name: 'custscript_elm_motiv_rech_blacklist' }),
            rechazoMocasist: scriptObj.getParameter({ name: 'custscript_elm_motiv_rech_mocasist' }),
            rechazoBCU: scriptObj.getParameter({ name: 'custscript_elm_motiv_rech_bcu' }),
            rechazoNoHayOferta: scriptObj.getParameter({ name: 'custscript_elm_motiv_rech_no_oferta' }),
            rechazoRepRechazado: scriptObj.getParameter({ name: 'custscript_elm_motiv_rech_rep_rech' }),
            leadStatus: scriptObj.getParameter({ name: 'custscript_elm_entity_stat_lead' }),
            preLeadStatus: scriptObj.getParameter({ name: 'custscript_elm_entity_stat_pre_lead' }),
            externalService: scriptObj.getParameter({ name: 'custscript_elm_channel_prov_externo' }),
            estErrorBCU: scriptObj.getParameter({ name: 'custscript_elm_est_err_bcu_man' }),
            estNohayInfoBCU: scriptObj.getParameter({ name: 'custscript_elm_est_no_hay_nfo_man' }),
            estadoRepRechazado: scriptObj.getParameter({ name: 'custscript_elm_rep_rechazado_man' }),
            estadoRepAprobado: scriptObj.getParameter({ name: 'custscript_elm_rep_aprobado_manual' }),
            estadoMocasist: scriptObj.getParameter({ name: 'custscript_elm_estado_mocasist_man' }),
            estadoBlacklist: scriptObj.getParameter({ name: 'custscript_elm_estado_blacklist_man' })
         };
      };

      
      const afterSubmit = (scriptContext) => {
         try {
            
            const { newRecord } = scriptContext;
            const objScriptParam = getScriptParameters();
            const docNumber = newRecord.getValue(FIELDS.docNumber);
            const estadoGestion = newRecord.getValue(FIELDS.aprobado);
            const leadId = newRecord.id;
         
            // Buscar snapshot existente por combinación (doc, estado)
            let existingRecords = [];
            search.create({
               type: 'customrecord_elm_apr_lead_his',
               filters: [
                  ['custrecord_elm_apr_doc', 'is', String(docNumber)]
               ],
               columns: [
                  search.createColumn({ name: 'internalid', sort: search.Sort.DESC }),
                  search.createColumn({ name: 'custrecord_elm_apr_lead' })
               ]
            }).run().each(function (result) {
               existingRecords.push({
                  id: result.id,
                  leadId: result.getValue('custrecord_elm_apr_lead')
               });
            });

            const recordCount = existingRecords.length;
            
            if (recordCount < 1) {
               // Actualizar el registro más reciente (primer elemento del array)
                if (objScriptParam.estadoAprobado == estadoGestion) {
                  auxLib.snapshotAprobados(docNumber, leadId, estadoGestion);
                  log.debug('Snapshot Create', `Creado nuevo snapshot para documento: ${docNumber}`);
               }
            } 
         } catch (e) {
            log.error('afterSubmit', e);
         }
      };

      return { beforeSubmit, afterSubmit };
   });
