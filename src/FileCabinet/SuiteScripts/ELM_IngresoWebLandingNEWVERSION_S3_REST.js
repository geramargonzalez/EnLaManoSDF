/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

define(["./SDB-Enlamano-score.js", "./ELM_Aux_Lib.js", "N/runtime", "N/record", "N/log"],
   function (scoreLib, auxLib, runtime, record, log) {
      
      // Constants
      const RESPONSE_MESSAGES = {
         BCU_ERROR: 'BCU',
         NO_OFFER: 'No hay oferta',
         BLACKLIST: 'Blacklist',
         MOCASIST: 'Mocasist',
         DUPLICATE_REJECTED: 'Pre-Lead Repetido rechazado',
         LEAD_DUPLICATE_REJECTED: 'Lead Repetido rechazado',
         LEAD_EXISTS: 'Lead ya existe'
      };

      const STATUS_CODES = {
         SERVER_ERROR: 500,
         NOT_FOUND: 404,
         PENDING_EVALUATION: '3',
         APPROVED: '2',
         REPETITIVE_APPROVED: 14
      };

      /**
       * Validates the incoming request body
       * @param {Object} requestBody - The request payload
       * @returns {Object} Validation result with isValid flag and errors
       */
      function validateRequest(requestBody) {
         const errors = [];
         
         if (!requestBody?.docNumber) {
            errors.push('docNumber is required');
         }
         
         if (!requestBody?.mobilephone) {
            errors.push('mobilephone is required');
         }
         
         if (!requestBody?.source) {
            errors.push('source is required');
         }
         
         return {
            isValid: errors.length === 0,
            errors: errors
         };
      }

      /**
       * Creates a standardized response object
       * @param {string} docNumber - Document number
       * @param {boolean} success - Success status
       * @param {string} result - Result message
       * @param {string} error - Error message if any
       * @returns {Object} Response object
       */
      function createResponse(docNumber, success, result = null, error = null) {
         return {
            docNumber: docNumber,
            success: success,
            result: result,
            error: error
         };
      }

      /**
       * Handles the creation of duplicate record with common fields
       * @param {string} sourceId - Source record ID
       * @param {string} targetId - Target record ID
       * @param {string} docNumber - Document number
       * @param {string} approvalStatus - Approval status
       * @param {string} rejectReason - Rejection reason
       * @returns {string} Created record ID
       */
      function createDuplicateRecord(sourceId, targetId, docNumber, approvalStatus, rejectReason) {
         return auxLib.copyRecordToRecord({
            sourceType: record.Type.LEAD,
            sourceId: sourceId,
            targetId: targetId,
            defaultValues: {
               'custrecord_sdb_nrodoc': docNumber,
               'custentity_elm_aprobado': approvalStatus,
               'custentity_elm_reject_reason': rejectReason,
               'custentity_elm_lead_repetido_original': sourceId
            },
            fieldMap: {
               'custrecord_sdb_nrodoc': docNumber,
               'custentity_elm_aprobado': approvalStatus,
               'custentity_elm_reject_reason': rejectReason,
               'custentity_elm_lead_repetido_original': sourceId
            }
         });
      }

      /**
       * Handles BCU scoring and lead processing
       * @param {Object} params - Processing parameters
       * @returns {Object} Processing result
       */
      function processBcuScore(params) {
         const { docNumber, preLeadId, infoRepetido, objScriptParam } = params;
         
         try {
            const score = scoreLib.scoreFinal(docNumber);
            
            // Check for bad qualification
            if (score.calificacionMinima == 'N/C') {
               log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
               auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoRechazado, objScriptParam.rechazoBCU, null, null, null, null, null, score);
               return { success: false, result: RESPONSE_MESSAGES.BCU_ERROR };
            }
            
            log.debug('Score', score);
            
            if (!score || score.score <= 0) {
               return handleBcuError(score, preLeadId, docNumber, objScriptParam);
            }
            
            // Process approved score
            return handleApprovedScore(score, preLeadId, docNumber, infoRepetido, objScriptParam);
            
         } catch (e) {
            log.error('Error in BCU processing', e);
            return { success: false, result: 'Error en procesamiento BCU', error: e.message };
         }
      }

      /**
       * Handles BCU error scenarios
       * @param {Object} score - Score object with error information
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {Object} objScriptParam - Script parameters
       * @returns {Object} Error handling result
       */
      function handleBcuError(score, preLeadId, docNumber, objScriptParam) {
         log.audit('Error', 'El documento ' + docNumber + ' tiene mala calificación en BCU.');
         
         let approvalStatus = objScriptParam.estadoRechazado;
         
         if (score.error_reglas == STATUS_CODES.SERVER_ERROR) {
            approvalStatus = 15;
         } else if (score.error_reglas == STATUS_CODES.NOT_FOUND) {
            approvalStatus = 16;
         }
         
         auxLib.submitFieldsEntity(preLeadId, approvalStatus, objScriptParam.rechazoBCU, null, null, null, null, null, score);
         
         return { success: false, result: RESPONSE_MESSAGES.BCU_ERROR };
      }

      /**
       * Handles approved score processing
       * @param {Object} score - Score object
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {Object} infoRepetido - Duplicate information
       * @param {Object} objScriptParam - Script parameters
       * @returns {Object} Processing result
       */
      function handleApprovedScore(score, preLeadId, docNumber, infoRepetido, objScriptParam) {
         log.audit('Success', 'El documento ' + docNumber + ' fue evaluado con éxito. Pre Lead aprobado: ' + preLeadId);
         auxLib.submitFieldsEntity(preLeadId, objScriptParam.estadoPendienteEvaluacion, null, null, null, null, null, null, score);
         
         const repetidoIsFromExternal = infoRepetido?.service === objScriptParam.externalService;
         const repetidoIsFromManual = infoRepetido?.service === objScriptParam.manualService;
         
         if (repetidoIsFromExternal || repetidoIsFromManual) {
            return processLeadConversion(score, preLeadId, docNumber, infoRepetido, objScriptParam);
         }
         
         return { success: true, result: 'Pre-lead procesado exitosamente' };
      }

      /**
       * Processes lead conversion and offer calculation
       * @param {Object} score - Score object
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {Object} infoRepetido - Duplicate information
       * @param {Object} objScriptParam - Script parameters
       * @returns {Object} Processing result
       */
      function processLeadConversion(score, preLeadId, docNumber, infoRepetido, objScriptParam) {
         const lead = auxLib.convertToLead(
            preLeadId, score, objScriptParam.leadStatus, objScriptParam.estadoPendienteEvaluacion,
            infoRepetido.firstName, infoRepetido.lastName, infoRepetido?.activityType,
            infoRepetido?.salary, infoRepetido?.dateOfBirth, infoRepetido.yearsOfWork,
            infoRepetido.email, infoRepetido?.age
         );
         
         const montoCuotaObj = auxLib.getPonderador(
            score?.score, score?.calificacionMinima, score?.endeudamiento,
            infoRepetido?.salary, infoRepetido.activity, infoRepetido?.age
         );
         
         const montoCuota = parseFloat(infoRepetido.salary) * parseFloat(montoCuotaObj.ponderador);
         const ofertaFinal = auxLib.getOfertaFinal(montoCuota);
         
         if (ofertaFinal) {
            log.audit('Success', 'Oferta para el documento: ' + docNumber + '. Oferta: ' + ofertaFinal.oferta + ' - Cuota Final: ' + ofertaFinal.cuotaFinal);
            auxLib.submitFieldsEntity(
               lead, objScriptParam?.estadoAprobado, null, null, null,
               parseFloat(ofertaFinal?.cuotaFinal), parseFloat(ofertaFinal?.oferta),
               montoCuotaObj?.montoCuotaName, score, ofertaFinal?.plazo
            );
            return { success: true, result: 'Lead aprobado con oferta' };
         } else {
            log.audit('Error', 'No hay oferta para el documento: ' + docNumber);
            auxLib.submitFieldsEntity(
               lead, objScriptParam?.estadoRechazado, objScriptParam?.rechazoNoHayOferta,
               null, null, 0, 0, montoCuotaObj?.montoCuotaName, score
            );
            return { success: false, result: RESPONSE_MESSAGES.NO_OFFER };
         }
      }

      /**
       * Handles duplicate lead scenarios
       * @param {Object} params - Parameters for duplicate handling
       * @returns {Object} Processing result
       */
      function handleDuplicates(params) {
         const { infoRepetido, preLeadId, docNumber, objScriptParam, mobilePhone } = params;
         
         const repetidoIsPreLead = infoRepetido?.status === objScriptParam.preLeadStatus;
         const repetidoIsRejected = infoRepetido?.approvalStatus === objScriptParam.estadoRechazado;
         const repetidoIsFromExternal = infoRepetido?.service === objScriptParam.externalService;
         
         // Handle pre-lead rejected from external source
         if (!repetidoIsFromExternal && repetidoIsPreLead && repetidoIsRejected) {
            log.audit('Error', 'El documento ' + docNumber + ' tiene un Pre-Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
            createDuplicateRecord(infoRepetido.id, preLeadId, docNumber, objScriptParam.estadoRepRechazado, objScriptParam.rechazoRepRechazado);
            return { success: false, result: RESPONSE_MESSAGES.DUPLICATE_REJECTED };
         }
         
         // Handle lead rejected from external source
         if (!repetidoIsFromExternal && !repetidoIsPreLead && repetidoIsRejected) {
            log.audit('Error', 'El documento ' + docNumber + ' tiene un Lead Repetido rechazado creado por Web y Landing o Ingreso Manual.');
            createDuplicateRecord(infoRepetido.id, preLeadId, docNumber, objScriptParam.estadoRepRechazado, objScriptParam.rechazoRepRechazado);
            return { success: false, result: RESPONSE_MESSAGES.LEAD_DUPLICATE_REJECTED };
         }
         
         // Handle status 4 (approved) duplicates
         if (infoRepetido.approvalStatus == '4') {
            return handleStatus4Duplicate(infoRepetido, preLeadId, docNumber, mobilePhone);
         }
         
         auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
         return { success: false, result: 'Duplicate processed' };
      }

      /**
       * Handles status 4 duplicate scenarios
       * @param {Object} infoRepetido - Duplicate information
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {string} mobilePhone - Mobile phone
       * @returns {Object} Processing result
       */
      function handleStatus4Duplicate(infoRepetido, preLeadId, docNumber, mobilePhone) {
         auxLib.copyRecordToRecord({
            sourceType: record.Type.LEAD,
            sourceId: infoRepetido.id,
            targetId: preLeadId,
            defaultValues: {
               'custrecord_sdb_nrodoc': docNumber,
               'custentity_elm_aprobado': STATUS_CODES.APPROVED,
               'custentity_elm_lead_repetido_original': '',
               'mobilephone': mobilePhone,
            },
            fieldMap: {
               'custrecord_sdb_nrodoc': docNumber,
               'custentity_elm_aprobado': STATUS_CODES.APPROVED,
               'custentity_elm_lead_repetido_original': '',
               'mobilephone': mobilePhone,
            }
         });
         
         // Update pre-lead
         record.submitFields({
            type: record.Type.LEAD,
            id: preLeadId,
            values: {
               'custentity_elm_aprobado': STATUS_CODES.APPROVED,
               'custentity_elm_lead_repetido_original': ''
            }
         });
         
         // Update original lead
         record.submitFields({
            type: record.Type.LEAD,
            id: infoRepetido.id,
            values: {
               'custentity_elm_service': STATUS_CODES.APPROVED,
               'custentity_elm_channel': '6',
               'mobilephone': mobilePhone,
               'custentity_elm_aprobado': STATUS_CODES.REPETITIVE_APPROVED,
               'custentity_elm_lead_repetido_original': preLeadId
            }
         });
         
         return { success: true, result: 'Status 4 duplicate processed' };
      }

      /**
       * Main POST function
       * @param {Object} requestBody - Request payload
       * @returns {Object} Response object
       */
      function post(requestBody) {
         const logTitle = 'post';
         
         try {
            // Validate request
            const validation = validateRequest(requestBody);
            if (!validation.isValid) {
               log.error('Validation failed', validation.errors.join(', '));
               return createResponse(null, false, null, validation.errors.join(', '));
            }
            
            const objScriptParam = getScriptParameters();
            const { docNumber, mobilephone: mobilePhone, source } = requestBody;
            
            log.debug('RESTlet working', `Documento: ${docNumber} - Telefono: ${mobilePhone} - Source: ${source}`);
            
            // Check if lead already exists with specific statuses
            const infoRepetido = auxLib.getInfoRepetido(docNumber, null, false);
            if (infoRepetido.approvalStatus != STATUS_CODES.PENDING_EVALUATION && 
                infoRepetido.approvalStatus != objScriptParam.NohayInfoBCU && 
                infoRepetido.approvalStatus != objScriptParam.ErrorBCU) {
               
               const sourceId = auxLib.getProveedorId(source);
               const preLeadId = auxLib.createPreLead(
                  objScriptParam?.webLandingService, docNumber, mobilePhone, 
                  null, null, null, null, null, null, null, sourceId
               );
               
               // Check blacklist
               const blackList = auxLib.checkBlacklist(docNumber);
               if (blackList) {
                  return handleBlacklist(infoRepetido, preLeadId, docNumber, objScriptParam);
               }
               
               // Check mocasist
               const mocasist = auxLib.checkMocasist(docNumber);
               if (mocasist) {
                  return handleMocasist(infoRepetido, preLeadId, docNumber, objScriptParam);
               }
               
               // Process main logic
               const updatedInfoRepetido = auxLib.getInfoRepetido(docNumber, preLeadId, false);
               
               if (!updatedInfoRepetido.id || 
                   (updatedInfoRepetido?.service === objScriptParam.externalService && 
                    updatedInfoRepetido?.status === objScriptParam.preLeadStatus && 
                    updatedInfoRepetido?.approvalStatus === objScriptParam.estadoRechazado)) {
                  
                  const bcuResult = processBcuScore({
                     docNumber, preLeadId, infoRepetido: updatedInfoRepetido, objScriptParam
                  });
                  
                  return createResponse(docNumber, bcuResult.success, bcuResult.result, bcuResult.error);
               } else {
                  const duplicateResult = handleDuplicates({
                     infoRepetido: updatedInfoRepetido, preLeadId, docNumber, objScriptParam, mobilePhone
                  });
                  
                  return createResponse(docNumber, duplicateResult.success, duplicateResult.result);
               }
            } else {
               // Lead already exists
               return handleExistingLead(infoRepetido, docNumber, source);
            }
            
         } catch (e) {
            log.error(logTitle, e);
            return createResponse(requestBody?.docNumber, false, null, e.message);
         }
      }

      /**
       * Handles blacklist scenario
       * @param {Object} infoRepetido - Duplicate information
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {Object} objScriptParam - Script parameters
       * @returns {Object} Processing result
       */
      function handleBlacklist(infoRepetido, preLeadId, docNumber, objScriptParam) {
         log.audit('Error', 'El documento ' + docNumber + ' pertenece a la Lista Negra.');
         
         if (infoRepetido.id) {
            createDuplicateRecord(infoRepetido.id, preLeadId, docNumber, objScriptParam.estadoRepRechazado, objScriptParam.rechazoBlacklist);
            auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
         } else {
            auxLib.submitFieldsEntity(preLeadId, objScriptParam?.estadoRechazado, objScriptParam?.rechazoBlacklist);
         }
         
         return createResponse(docNumber, false, RESPONSE_MESSAGES.BLACKLIST);
      }

      /**
       * Handles mocasist scenario
       * @param {Object} infoRepetido - Duplicate information
       * @param {string} preLeadId - Pre-lead ID
       * @param {string} docNumber - Document number
       * @param {Object} objScriptParam - Script parameters
       * @returns {Object} Processing result
       */
      function handleMocasist(infoRepetido, preLeadId, docNumber, objScriptParam) {
         log.audit('Error', 'El documento ' + docNumber + ' pertenece a Mocasist.');
         
         if (infoRepetido.id) {
            createDuplicateRecord(infoRepetido.id, preLeadId, docNumber, objScriptParam.estadoRepRechazado, objScriptParam.rechazoMocasist);
            auxLib.createListRepetido(docNumber, infoRepetido.firstName + ' ' + infoRepetido.lastName);
         } else {
            auxLib.submitFieldsEntity(preLeadId, objScriptParam?.estadoRechazado, objScriptParam?.rechazoMocasist);
         }
         
         return createResponse(docNumber, false, RESPONSE_MESSAGES.MOCASIST);
      }

      /**
       * Handles existing lead scenario
       * @param {Object} infoRepetido - Duplicate information
       * @param {string} docNumber - Document number
       * @param {string} source - Source of the request
       * @returns {Object} Processing result
       */
      function handleExistingLead(infoRepetido, docNumber, source) {
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
         
         const idComentario = comentRec.save();
         log.debug('Se creo el comentario: ', idComentario);
         
         return createResponse(docNumber, false, RESPONSE_MESSAGES.LEAD_EXISTS);
      }      /**
       * Gets script parameters
       * @returns {Object} Script parameters object
       */
      function getScriptParameters() {
         const scriptObj = runtime.getCurrentScript();
         const objParams = {
            estadoAprobado: scriptObj.getParameter({
               name: 'custscript_elm_estado_aprobado'
            }),
            estadoRechazado: scriptObj.getParameter({
               name: 'custscript_elm_estado_rechazado'
            }),
            estadoPendienteEvaluacion: STATUS_CODES.PENDING_EVALUATION,
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
            })
         };
         return objParams;
      }

      return {
         post: post
      };

   });
