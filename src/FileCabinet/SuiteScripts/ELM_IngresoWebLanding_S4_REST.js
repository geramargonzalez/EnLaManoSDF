/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

define(['N/runtime', './SDB-Enlamano-score.js', './ELM_Aux_Lib.js', 'N/record'],
   function (runtime, scoreLib, auxLib, record) {
      function post(requestBody) {
         const logTitle = 'post';
         const objScriptParam = getScriptParameters();
         const docNumber = requestBody.docNumber;
         const firstName = requestBody.firstName;
         const lastName = requestBody.lastName;
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
               let score = scoreLib.scoreFinal(docNumber);


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
 
                if (score && score.score > 500) {
                  if (score.error_reglas == null) {
                     score.error_reglas = false; 
                  } 
                  const leadId = auxLib.convertToLead(preLeadId, score, objScriptParam.leadStatus, null, firstName, lastName, activity, salary, dateOfBirth, yearsOfWork, email, age, null, workStartDate);
                  log.debug('leadId', leadId);
                  const montoCuotaObj = auxLib.getPonderador(score.score, score.calificacionMinima, score.endeudamiento, salary, activity, age);
                  log.debug('montoCuotaObj', JSON.stringify(montoCuotaObj));
                  const montoCuota = parseFloat(salary) * parseFloat(montoCuotaObj.ponderador);
                  log.debug('montoCuota', montoCuota);
                  let ofertaFinal = auxLib.getOfertaFinal(montoCuota);
                  log.debug('ofertaFinal', ofertaFinal);

                  let isLatente = true;
                  if (montoCuotaObj?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END')) {
                      isLatente = false;
                  }

                  if (isLatente) {
                     log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal?.oferta + ' - Cuota Final: ' + ofertaFinal?.cuotaFinal);
                     auxLib.submitFieldsEntity(leadId, objScriptParam.estadoAprobado, null, null, null, parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta), montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                      cantEntidadesT6, t2Quals, t6Quals);
                       response.success = true;
                       response.result = 'Lead Aprobado correctamente';
                       auxLib.snapshotAprobados(docNumber, leadId, objScriptParam.estadoAprobado, 8);
                  } else {
                     log.audit('Error', 'No hay oferta para el documento:  ' + docNumber);
                     response.success = false;
                     response.result = 'No hay oferta';
                     auxLib.submitFieldsEntity(leadId, objScriptParam.estadoRechazado, objScriptParam.rechazoNoHayOferta, null, null, 0, 0, montoCuotaObj.montoCuotaName, score, null, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
                      cantEntidadesT6, t2Quals, t6Quals);
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
            })
         };
         return objParams;
      }

      return {
         post: post
      };

   });
