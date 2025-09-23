/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define(['./SDB-Enlamano-score.js', './ELM_Aux_Lib.js', 'N/runtime'],
   function (scoreLib, auxLib, runtime) {
      function beforeSubmit(scriptContext) {
         try {
            const oldRec = scriptContext.oldRecord;
            const newRec = scriptContext.newRecord;
            const salaryOld = oldRec?.getValue('custentity_sdb_infolab_importe');
            const dateOfBirthOld = oldRec?.getValue('custentity_sdb_fechanac');
            const ageOld = auxLib.calculateYearsSinceDate(dateOfBirthOld);
            const activityOld = oldRec?.getValue('custentity_sdb_actividad');
            const salary = newRec.getValue('custentity_sdb_infolab_importe');
            const dateOfBirth = newRec.getValue('custentity_sdb_fechanac');
            const age = auxLib.calculateYearsSinceDate(dateOfBirth);
            const activity = newRec.getValue('custentity_sdb_actividad');
            const needsRecalculate = scriptContext.type === scriptContext.UserEventType.EDIT && (salaryOld !== salary || ageOld !== age || activityOld !== activity);
            log.debug('needsRecalculate', needsRecalculate);
            if (scriptContext.type === scriptContext.UserEventType.CREATE || (scriptContext.type === scriptContext.UserEventType.EDIT && needsRecalculate)) {
               const objScriptParam = getScriptParameters();
               const newRec = scriptContext.newRecord;
               if (needsRecalculate) {
                  newRec.setValue('custentity_elm_years_work', null);
                  newRec.setValue('custentity_elm_aprobado', null);
                  newRec.setValue('custentity_elm_reject_reason', null);
                  newRec.setValue('custentity_score', null);
                  newRec.setValue('custentity_calificacion', null);
                  newRec.setValue('custentity_sdb_montoofrecido', null);
               }
               newRec.setValue('custentity_sdb_edad', age);
               const workStartDate = newRec.getValue('custentity_elm_fecha_ingreso');
               if (workStartDate) {
                  const yearsOfWork = auxLib.calculateYearsSinceDate(workStartDate);
                  newRec.setValue('custentity_elm_years_work', yearsOfWork);
               }
               const docNumber = newRec.getValue('custentity_sdb_nrdocumento');
               const blackList = auxLib.checkBlacklist(docNumber);
               if (!blackList) {
                  const mocasist = auxLib.checkMocasist(docNumber);

                  if (!mocasist) {
                     var infoRepetido = auxLib.getInfoRepetido(docNumber, null, false);
                     log.debug('infoRepetido', JSON.stringify(infoRepetido));
                     var repetidoIsPreLead = infoRepetido.status === objScriptParam.preLeadStatus;
                     var repetidoIsRejected = infoRepetido.approvalStatus === objScriptParam.estadoRechazado;
                     var repetidoIsFromExternal = infoRepetido.service === objScriptParam.externalService;

                     if (!infoRepetido.id || (repetidoIsFromExternal && repetidoIsPreLead && repetidoIsRejected) || needsRecalculate) {
                        var score = scoreLib.scoreFinal(docNumber);
                        if (score !== null) {
                           log.debug('score.score', score.score);
                           var montoCuotaObj = auxLib.getPonderador(score.score, score.calificacionMinima, score.endeudamiento, salary, activity, age);
                           log.debug('montoCuotaObj', JSON.stringify(montoCuotaObj));
                           var montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj.ponderador);
                           log.debug('montoCuota', montoCuota);
                           var ofertaFinal = auxLib.getOfertaFinal(montoCuota);
                           log.debug('ofertaFinal', ofertaFinal);
                           if (ofertaFinal) {
                              log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal.oferta + ' - Cuota Final: ' + ofertaFinal.cuotaFinal);
                              auxLib.updateEntity(newRec, objScriptParam.estadoAprobado, null, score, objScriptParam.leadStatus, parseFloat(ofertaFinal.cuotaFinal), parseFloat(ofertaFinal.oferta), montoCuotaObj.montoCuotaName);
                           } else {
                              log.audit('Error', 'No hay oferta para el documento:  ' + docNumber);
                              auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta, score, null, 0, 0, montoCuotaObj.montoCuotaName);
                           }
                        } else {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
                           auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoBCU, score);
                        }

                     } else {
                        if (!repetidoIsFromExternal && repetidoIsPreLead && repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Pre-Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
                           auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoRepRechazado, score, null, 0, null, null, null, null, null, null, null, null, null, infoRepetido);
                        } else if (!repetidoIsFromExternal && !repetidoIsPreLead && repetidoIsRejected) {
                           log.audit('Error', 'El documento ' + docNumber + ' tiene un Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
                           auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoRepRechazado, score, objScriptParam.leadStatus, 0, null, null, null, null, null, null, null, null, null, infoRepetido);
                        }
                     }
                  } else {
                     log.audit('Error', 'El documento ' + docNumber + ' pertenece a Mocasist.');
                     auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoMocasist);
                  }
               } else {
                  log.audit('Error', 'El documento ' + docNumber + ' pertenece a la Lista Negra.');
                  auxLib.updateEntity(newRec, objScriptParam.estadoRechazado, objScriptParam.rechazoBlacklist);
               }
            }
         } catch (error) {
            log.error('beforeSubmit', error);
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
            leadStatus: scriptObj.getParameter({
               name: 'custscript_elm_entity_stat_lead'
            }),
            preLeadStatus: scriptObj.getParameter({
               name: 'custscript_elm_entity_stat_pre_lead'
            }),
            externalService: scriptObj.getParameter({
               name: 'custscript_elm_channel_prov_externo'
            })
         };
         return objParams;
      }

      return {
         beforeSubmit: beforeSubmit
      };
   });
