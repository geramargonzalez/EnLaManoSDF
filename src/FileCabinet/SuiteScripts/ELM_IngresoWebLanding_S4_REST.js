/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

define(['N/runtime', './SDB-Enlamano-score.js', './ELM_Aux_Lib.js', 'N/record','./ELM_SCORE_BCU_LIB.js'],
   function (runtime, scoreLib, auxLib, record, bcuScoreLib) {
      function post(requestBody) {
         const logTitle = 'post';
         const objScriptParam = getScriptParameters();
         const docNumber = requestBody.docNumber;
         const firstName = requestBody.firstName;
         const lastName = requestBody.lastName;
         const isSandbox = runtime.envType === runtime.EnvType.SANDBOX;
         const maskedFirstName = isSandbox ? 'default' : firstName;
         const maskedLastName = isSandbox ? 'default' : lastName;
         const activityType = requestBody.activityType;
         const salary = requestBody.salary;
         const dateOfBirth = requestBody.dateOfBirth;
         const workStartDate = requestBody.workStartDate;
         const email = requestBody.email;
         log.debug('RESTlet working', 'Nro de Documento: ' + docNumber + ' - Nombre: ' + firstName +
            ' - Apellido: ' + lastName + ' - Tipo de Actividad: ' + activityType + ' - Salario: ' + salary +
            'Fecha de Nacimiento: ' + dateOfBirth + ' - Fecha de Ingreso Laboral: ' + workStartDate + ' - Email: ' + email);
         const idLog = auxLib.createLogRecord(docNumber, null, false, 4, null, requestBody);
         const response = {
            docNumber: docNumber,
            success: false,
            result: null
         };
         try {
            const preLeadId = auxLib.findEntity(docNumber, 6);
            if (preLeadId) {
               const age = auxLib.calculateYearsSinceDate(dateOfBirth);
               let yearsOfWork;
               if (workStartDate) yearsOfWork = auxLib.calculateYearsSinceDate(workStartDate);
               let activity = auxLib.getActivityType(activityType);
               let score = bcuScoreLib.scoreFinal(docNumber, { provider: objScriptParam.providerBCU, forceRefresh: true, strictRules: true, debug: true });
               
               if (score?.error_reglas) {
                     let approvalStatus = objScriptParam.estadoRechazado;
                     if (score.error_reglas == 500 || score.error_reglas == 400) {
                        if (objScriptParam.providerBCU == '2') {
                                 approvalStatus = 28;
                           } else {
                                 approvalStatus = 15;
                        }
                     }
                     log.audit('Error', `El documento ${docNumber} tiene mala calificación en BCU.`);
                     response.success = false;
                     response.result = 'BCU';
   
                     auxLib.submitFieldsEntity(preLeadId, approvalStatus, objScriptParam.rechazoBCU, null, null, null, null, null, {
                        score: 0,
                        calificacionMinima: score?.calificacionMinima,
                        detail: score?.detail,
                        nombre: score?.nombre
                     });

                     auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
                     return response;
                  }
 
                if (score && score.score > 499) {
                  if (score.error_reglas == null) {
                     score.error_reglas = false; 
                  } 
                  const leadId = auxLib.convertToLead(preLeadId, score, objScriptParam.leadStatus, null, maskedFirstName, maskedLastName, activity, salary, dateOfBirth, yearsOfWork, email, age, null, workStartDate);
                  log.debug('leadId', leadId);
                  const montoCuotaObj = auxLib.getPonderador(score.score, score.calificacionMinima, score.endeudamiento, salary, activity, age);
                  log.debug('montoCuotaObj', JSON.stringify(montoCuotaObj));
                  const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj.ponderador);
                  log.debug('montoCuota', montoCuota);
                  let ofertaFinal = auxLib.getOfertaFinal(montoCuota);
                  log.debug('ofertaFinal', ofertaFinal);

                  let isLatente = true;
                  if (montoCuotaObj?.esRechazo) {
                      isLatente = false;
                  }

                  if (isLatente) {
                     log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal?.oferta + ' - Cuota Final: ' + ofertaFinal?.cuotaFinal);
                     auxLib.submitFieldsEntity(leadId, objScriptParam.estadoAprobado, null, null, null, parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta), montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo/* , endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                      cantEntidadesT6, t2Quals, t6Quals */);
                       response.success = true;
                       response.result = 'Lead Aprobado correctamente';
                       auxLib.snapshotAprobados(docNumber, leadId, objScriptParam.estadoAprobado, 8);
                  } else {
                     log.audit('Error', 'No hay oferta para el documento:  ' + docNumber);
                     response.success = false;
                     response.result = 'No hay oferta';
                     auxLib.submitFieldsEntity(leadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta, null, null, 0, 0, montoCuotaObj.montoCuotaName, score, null/* , endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                      cantEntidadesT6, t2Quals, t6Quals */);
                     const idCleanOperator = record.submitFields({
                        type: record.Type.LEAD,
                        id: leadId,
                        values: {
                           custentity_elm_operador: null
                        },
                        options: {
                           enableSourcing: false,
                           ignoreMandatoryFields: true
                        }
                     });

                     log.debug('idCleanOperator', idCleanOperator);

                  }
               } else {
                  log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
                  response.success = false;
                  response.result = 'BCU';
                  auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoBCU, null, null, null, null, null, {
                     score: null,
                     calificacionMinima: score?.calificacionMinima,
                     nombre: score?.nombre
                  });
                  
                  // Clear operator field for BCU rejection
                  const idCleanOperatorBCU = record.submitFields({
                     type: record.Type.LEAD,
                     id: preLeadId,
                     values: {
                        custentity_elm_operator: null
                     },
                     options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                     }
                  });
                  
                  log.debug('idCleanOperatorBCU', idCleanOperatorBCU);
               }
            } else {
               log.audit('Error', 'El documento ' + docNumber + ' no tiene un Pre Lead creado');
               response.success = false;
               response.result = 'Pre Lead no existe';
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
               notas:  'Error - Servicio 4: ' + docNumber + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);  
         }
         log.debug('Response S4 ' + docNumber, JSON.stringify(response));
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
            rechazoBCU: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_bcu'
            }),
            rechazoNoHayOferta: scriptObj.getParameter({
               name: 'custscript_elm_motiv_rech_no_oferta'
            }),
            leadStatus: scriptObj.getParameter({
               name: 'custscript_elm_entity_stat_lead'
            }),
            providerBCU: scriptObj.getParameter({
               name: 'custscript_elm_bcu_elec_s4'
            })
         };
         return objParams;
      }

      return {
         post: post
      };

   });
