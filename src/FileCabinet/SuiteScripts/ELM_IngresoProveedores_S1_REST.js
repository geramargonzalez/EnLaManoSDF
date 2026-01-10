/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */ 
 
define(['N/search', './SDB-Enlamano-score.js', 'N/runtime', './ELM_Aux_Lib.js', 'N/record', './ELM_SCORE_BCU_LIB.js'],
function (search, scoreLib, runtime, auxLib, record, bcuScoreLib) {

  // ---------- Utils de uso general ----------
  const LOG_PREFIX = 'S1';
  const isEmpty = (v) => v === null || v === undefined || v === '';
  const toNum = (v, d = 0) => (isNaN(parseFloat(v)) ? d : parseFloat(v));

  // ---------- Handler principal ----------
  function post(body) {
    const params = getScriptParametersCached();
    const userId = runtime.getCurrentUser().id;
    
    const {
      docNumber, firstName, lastName, activityType,
      salary, dateOfBirth, workStartDate, source, trackingId
    } = body || {};

    // En sandbox, enmascarar nombres de leads/preleads
    const isSandbox = runtime.envType === runtime.EnvType.SANDBOX;
    const maskedFirstName = isSandbox ? 'default' : firstName;
    const maskedLastName = isSandbox ? 'default' : lastName;

    const idLog = auxLib.createLogRecord(docNumber, null, false, 1, source, body);
    const response = { docNumber, success: false, result: 'Consulte nuevamente más tarde' };
    try {
      // Validación temprana
      if (isEmpty(docNumber) || !auxLib.validateCI(docNumber)) {
        log.audit(`${LOG_PREFIX} Doc inválido`, docNumber);
        response.result = 'Documento no válido';
        auxLib.updateLogWithResponse(idLog, response.result, false, response);
        return response;
      }

      // Datos derivados (una sola vez)
      const sourceId = auxLib.getProveedorId(source);
      const activity = auxLib.getActivityType(activityType);
      const age = auxLib.calculateYearsSinceDate(dateOfBirth);
      const yearsOfWork = workStartDate ? auxLib.calculateYearsSinceDate(workStartDate) : undefined;

      // "Apagar" leads activos por doc (siempre antes de crear)
      // Si se desactivaron leads, no es necesario buscar info repetido
      // const leadsDesactivados = auxLib.deactivateLeadsByDocumentNumber(docNumber);

      // Info repetido (una sola llamada, solo si no se desactivaron leads)
      const infoRepExist = auxLib.getSolicitudVidente (docNumber);
      const leadInfo = auxLib.getInfoRepetidoSql(docNumber,null,null, false);

      log.debug(`${LOG_PREFIX} Info repetido existente`, infoRepExist);
      const notLatente = infoRepExist?.approvalStatus != params?.estadoLatente;

      // Crear preLead mínimo al inicio del flujo “no latente”
      let preLeadId = leadInfo?.id ? leadInfo.id : null;

      if (notLatente && !infoRepExist?.id) {
        preLeadId = auxLib.createPreLead(
        params.externalService, docNumber, null, maskedFirstName, maskedLastName,
        activity, salary, dateOfBirth, yearsOfWork, age, sourceId, workStartDate,
        params?.inicial, null, source, activityType, trackingId
      );
      } 
        //  creo la solicitud de lead directamente
        const idSol = auxLib.createSolicitudVale({
          leadId: preLeadId,
          estadoGestion: params?.inicial,
          operadorId: null,
          canalId: sourceId,
          montoSolicitado: null,
          plazo: null,
          score: null,
          calificacion: null,
          nroDocumento: docNumber,
          comentarioEtapa: 'Solicitud creada desde REST',
          actividadId: activity,
          salario: salary,
          canalId:  sourceId,
          crearEtapa: false
      });
      log.debug(`${LOG_PREFIX} Solicitud de vale creada directamente`, idSol);
      

      // ---------- Blacklist/Mocasist early-exit ----------
      const blacklisted = auxLib.checkBlacklist(docNumber);
      if (blacklisted) {
        response.success = false;
        response.result = 'Blacklist';
        auxLib.submitFieldsEntity(preLeadId, params?.estadoBlacklist, params?.rechazoBlacklist);
        auxLib.updateSolicitudVale({
          solicitudId: idSol,
          estadoGestion: params?.estadoBlacklist,
          motivoRechazoId: params?.rechazoBlacklist
      });
        auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
        return response; // EARLY RETURN
      }

      const isMocasist = auxLib.checkMocasist(docNumber);
      if (isMocasist) {
        response.success = false;
        response.result = 'Mocasist';
        auxLib.updateSolicitudVale({
          solicitudId: idSol,
          estadoGestion: params?.estadoMocasist,
          motivoRechazoId: params?.rechazoMocasist,
          
      });
        auxLib.submitFieldsEntity(preLeadId, params?.estadoMocasist, params?.rechazoMocasist);
        auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
        return response; // EARLY RETURN
      }

      // ---------- Si NO está latente hoy (flujo “normal”) ----------
      if (notLatente) {
        
        if (!infoRepExist?.id) {
          // Caso NUEVO → Scoring & BCU
          // Usar motor bcuScore optimizado con fallback al SDB cl�sico
          let score = bcuScoreLib.scoreFinal(docNumber, { provider: params.providerBCU, forceRefresh: true, strictRules: true, debug: true });

          if (score?.error_reglas) {
            const approvalStatus =
            score.error_reglas === 500 ? params.estadoErrorBCU :
            score.error_reglas === 404 ? params.NohayInfoBCU :
            params.estadoRechazado;
            response.success = false;
            response.result = 'BCU';
            auxLib.submitFieldsEntity(preLeadId, approvalStatus, params.rechazoBCU, null, null, null, null, null, {
              score: 0, calificacionMinima: score?.calificacionMinima, detail: score?.detail, nombre: score?.nombre
            });
            auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
            return response; // EARLY RETURN
          }

          if (score?.calificacionMinima === 'N/C') {
            response.success = false;
            response.result = 'BCU';
            auxLib.submitFieldsEntity(preLeadId, params.estadoRechazado, params.rechazoBCU, null, null, null, null, null, score);
            auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
            return response; // EARLY RETURN
          }

          // ========== USAR FUNCIÓN CENTRALIZADA PARA EXTRAER VARIABLES BCU ==========
          const bcuVars = auxLib.extractBcuVariables(score);
          const { endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6 } = bcuVars;

          log.debug(`${LOG_PREFIX} BCU vars extraídas`, { endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6, endeudamiento: score.endeudamiento });
          
          const historyId = auxLib.createScoreHistoryRecord({
              leadId: preLeadId,
              score: score?.score,
              calificacion: score?.calificacionMinima,  // ID de lista de calificaciones
              respuesta: JSON.stringify(score),
              t2CantEntidades: cantEntT2,
              t2Endeudamiento: endeudT2,
              t2PeorCalificacion: peorCalifT2,
              t6CantEntidades: cantEntT6,
              t6Endeudamiento: endeudT6,
              t6PeorCalificacion: peorCalifT6,
              endeudamiento: score.endeudamiento
          });
          log.debug(`${LOG_PREFIX} Score history creado`, historyId);

          if (score && toNum(score.score) > params.scoreMin) {
            // Convertir a lead y calcular oferta
            const leadId = auxLib.convertToLead(preLeadId, score, params.leadStatus);

            if (score.error_reglas == null) score.error_reglas = false;

            const ponder = auxLib.getPonderador(score?.score, score?.calificacionMinima, score?.endeudamiento, salary, activity, age, source);
            const montoCuota = toNum(salary) * toNum(ponder?.ponderador);
            const ofertaFinal = getOfertaFinal(source, montoCuota);

            let isLatente = true;
            if (ponder?.montoCuotaName?.toUpperCase()?.includes('RECHAZO VAR END')) isLatente = false;
            // if (source === 'AlPrestamo' && !ofertaFinal) isLatente = false;

            if (isLatente) {
              
              response.success = true; 
              response.result = 'Listo para recibir datos en servicio 2';
              
              if (source === 'Creditleads') response.oferta = ofertaFinal?.oferta;

              if (source == 'AlPrestamo') {

                if (score.score >= 650) {
                    response.result = 'Latente: Campaña A';
                } else {
                    response.result = 'Latente: Campaña B';
                }
              
              }
              auxLib.updateSolicitudVale({
                  solicitudId: idSol,
                  estadoGestion: params?.estadoLatente,
                  montoCuotaId: ponder.montoCuotaId,
                  montoOtorgado: ofertaFinal?.oferta || 0,
                  plazo: ofertaFinal?.plazo || 0,
                  score: score?.score,
                  calificacion: auxLib.getCalificacionId(score?.calificacionMinima),
                  valorCuota: toNum(ofertaFinal?.cuotaFinal),
              });

              auxLib.submitFieldsEntity(
                leadId,
                params.estadoLatente,
                null,
                params.leadStatus,
                null,
                toNum(ofertaFinal?.cuotaFinal),
                toNum(ofertaFinal?.oferta),
                ponder?.montoCuotaName,
                score,
                ofertaFinal?.plazo,
                endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6, null, score.endeudamiento, idSol
              );
            } else {
              response.success = false;
              response.result = 'No hay oferta';
              auxLib.submitFieldsEntity(
                leadId,
                params.estadoRechazado,
                params.rechazoNoHayOferta,
                null,
                0, 0, 0,
                ponder?.montoCuotaName,
                score,
                null,
                endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6, null, score.endeudamiento,idSol);

                auxLib.updateSolicitudVale({
                  solicitudId: idSol,
                  estadoGestion: params?.estadoRechazado,
                  motivoRechazoId:params.rechazoNoHayOferta,
                  score: score?.score,
                  calificacion: auxLib.getCalificacionId(score?.calificacionMinima),
                  montoCuotaId: ponder.montoCuotaId
              });
            }
          } else {
            response.success = false;
            response.result = 'No hay oferta';
            auxLib.updateSolicitudVale({
                  solicitudId: idSol,
                  estadoGestion: params?.estadoRechazado,
                  motivoRechazoId:params.rechazoNoHayOferta,
                  score: score?.score,
              });
              auxLib.submitFieldsEntity(
                    preLeadId,
                    params.estadoRechazado,
                    params.rechazoNoHayOferta,
                    null,
                    0, 0, 0,
                    'Score Minimo',
                    score,
                    null,
                    endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6, null, score.endeudamiento, idSol
                  );
          }

        } else {
          // REPETIDO con múltiples escenarios, sin duplicar ramas
          const infoRep = auxLib.getInfoRepetidoSql(docNumber,null,null, false);
          log.debug(`${LOG_PREFIX} Info repetido completo`, infoRep);

          const repetidoNoInfo = infoRep.approvalStatus == params.NohayInfoBCU;
          const estadoRechazado = infoRep.approvalStatus == params.estadoRechazado || infoRep.approvalStatus == params.estadoRepRechazado;
          const estadoRepAprobado = infoRep.approvalStatus == params.estadoRepAprobado || infoRep.approvalStatus == params.estadoAprobado;
          const estadoGestion = auxLib.getEstadosGestion(infoRep.approvalStatus);
          const isPendienteEvaluacion = infoRep.approvalStatus == '3';

          if (repetidoNoInfo) {
            response.success = false;
            response.result = 'Repetido - No Hay Info en BCU';

            auxLib.updateSolicitudVale({
                solicitudId: idSol,
                estadoGestion: params.NohayInfoBCU
            });
          }

          if (estadoRechazado) {
            response.success = false;
            response.result = 'Repetido Rechazado';

            auxLib.updateSolicitudVale({
                solicitudId: idSol,
                estadoGestion: params.estadoRepRechazado
            });
          }

          if (estadoRepAprobado) {
              response.success = false;
              response.result = 'Repetido Rechazado con solicitud anterior aprobada';

              auxLib.updateSolicitudVale({
                  solicitudId: idSol,
                  estadoGestion: params.estadoRepAprobado
              });
          }

          if(estadoGestion) {
             response.success = false;
              response.result = 'Repetido Rechazado - Lead con solicitud en curso';

              auxLib.updateSolicitudVale({
                  solicitudId: idSol,
                  estadoGestion: params.estadoRepRechazado
              });
          }


          if (isPendienteEvaluacion) {
            const ponder = auxLib.getPonderador(infoRep.score, infoRep.calificacion, infoRep.endeudamiento, salary, activity, age, '6');
            const montoCuota = toNum(salary) * toNum(ponder?.ponderador);
            const ofertaFinal = getOfertaFinal(source, montoCuota);

            const approvalStatus = ofertaFinal?.internalid ? params.estadoAprobado : params.estadoRechazado;

            record.submitFields({
              type: record.Type.LEAD,
              id: infoRep.id,
              values: {
                'custentity_elm_aprobado': approvalStatus,
                'custentity_elm_service': '2',
                'custentity_elm_channel': '6',
                'custentity_sdb_valor_cuota': toNum(montoCuota),
                'custentity_sdb_montoofrecido': ofertaFinal?.internalid ? toNum(ofertaFinal?.oferta) : '',
                'custentity_elm_oferta_final': ofertaFinal?.internalid ? toNum(ofertaFinal?.cuotaFinal) : '',
                'custentity_sdb_valor_cuota_vale': ofertaFinal?.internalid ? toNum(ofertaFinal?.cuotaFinal) : '',
                'custentity_elm_monto_cuota': ponder?.montoCuotaName ? ponder?.montoCuotaName : '',
                'custentity_elm_plazo': ofertaFinal?.plazo || '',
                'custentity_score': infoRep.score,
                'custentity_elm_lead_repetido_original': '',
                'entitystatus': ofertaFinal?.internalid ? params.leadStatus : 6,
                'mobilephone': infoRep.mobilephone,
                'custentity_sdb_actividad': activity,
                'custentity_sdb_fechanac': dateOfBirth,
                'custentity_elm_fecha_ingreso': workStartDate,
                'custentity_sdb_infolab_importe': salary,
                'custentity_sdb_edad': age,
              },
              options: { enableSourcing: false, ignoreMandatoryFields: true }
            });
          }

        }

      // ---------- Ya estaba LATENTE ----------
      } else {
        const infoRep = auxLib.getInfoRepetidoSql(docNumber, null,null, false);
        
        // Comentario (creación directa, dynamic:false)
        const coment = record.create({ type: 'customrecord_elm_comentarios', isDynamic: false });
        coment.setValue({ fieldId: 'custrecord_elm_com_lead', value: infoRep?.id });
        coment.setValue({ fieldId: 'custrecord_elm_comentarios_com', value: `El Lead ${docNumber} ingresó por proveedor externo: ${source}` });
        coment.save({ enableSourcing: false, ignoreMandatoryFields: true });

        if (source === 'Creditleads') response.oferta = infoRep?.montoOfrecido;
          response.success = true;
          response.result = 'Listo para recibir datos en servicio 2';

           if (source == 'AlPrestamo') {

              if (infoRep.score >= 650) {
                  response.result = 'Latente: Campaña A';
              } else {
                  response.result = 'Latente: Campaña B';
              }
            
            }

        }

    } catch (e) {
      log.error(`${LOG_PREFIX} post error`, e);
      response.success = false;
      response.result = e.message;
      auxLib.createRecordAuditCambios({
        tipo: 2,
        usuario: userId,
        record: 'Lead',
        notas: `Error - Servicio 1: ${docNumber} - details: ${e}`
      });
    } finally {
      log.debug(`${LOG_PREFIX} Response S1 ${docNumber}`, JSON.stringify(response));
      auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
      // log.debug(`${LOG_PREFIX} ms`, Date.now() - startTs); // activar si querés medir tiempos crudos
    }

    return response;
  }
    function getScriptParametersCached() {
    // Llamada única por ejecución del Restlet
    const s = runtime.getCurrentScript();
    return {
      estadoAprobado: s.getParameter({ name: 'custscript_elm_estado_aprobado' }),
      estadoRechazado: s.getParameter({ name: 'custscript_elm_estado_rechazado' }),
      estadoRepRechazado: s.getParameter({ name: 'custscript_elm_rep_estado_rechazado' }),
      estadoRepAprobado: s.getParameter({ name: 'custscript_elm_rep_estado_aprobado' }),
      rechazoBlacklist: s.getParameter({ name: 'custscript_elm_motiv_rech_blacklist' }),
      rechazoMocasist: s.getParameter({ name: 'custscript_elm_motiv_rech_mocasist' }),
      rechazoBCU: s.getParameter({ name: 'custscript_elm_motiv_rech_bcu' }),
      rechazoNoHayOferta: s.getParameter({ name: 'custscript_elm_motiv_rech_no_oferta' }),
      rechazoRepRechazado: s.getParameter({ name: 'custscript_elm_motiv_rech_rep_rech' }),
      rechazoRepEspecial: s.getParameter({ name: 'custscript_elm_motiv_rech_rep_esp' }),
      leadStatus: s.getParameter({ name: 'custscript_elm_entity_stat_lead' }),
      preLeadStatus: s.getParameter({ name: 'custscript_elm_entity_stat_pre_lead' }),
      externalService: s.getParameter({ name: 'custscript_elm_channel_prov_externo' }),
      manualService: s.getParameter({ name: 'custscript_elm_channel_manual' }),
      webLandingService: s.getParameter({ name: 'custscript_elm_channel_web_landing' }),
      scoreMin: toNum(s.getParameter({ name: 'custscript_score_minimo' })),
      estadoLatente: s.getParameter({ name: 'custscript_elm_estado_latente' }),
      NohayInfoBCU: s.getParameter({ name: 'custscript_elm_no_hay_info_bcu_pm' }),
      estadoErrorBCU: s.getParameter({ name: 'custscript_elm_estado_bcu' }),
      estadoMocasist: s.getParameter({
         name: 'custscript_elm_est_mocasist'
      }),
      estadoBlacklist: s.getParameter({
         name: 'custscript_elm_est_blacklist'
        }),
        providerBCU: s.getParameter({
         name: 'custscript_elm_provider_election'
        }),
        inicial: 29
    };
  }



  // Calcular oferta final eficientemente (1 query, top 1)
  function getOfertaFinal(source, montoCuota) {
    try {
      const proveedorId = auxLib.getProveedorId(source); // cachea internamente si tu auxLib lo hace
      const hasSourceData = auxLib.checkSourceOfertaFinalDataExists(proveedorId);

      const filters = hasSourceData
        ? [
            ['custrecord_source', 'is', proveedorId], 'AND',
            ['custrecord_monto_cuota', 'lessthanorequalto', montoCuota]
          ]
        : [
            ['custrecord_source', 'isempty', ''], 'AND',
            ['custrecord_monto_cuota', 'lessthanorequalto', montoCuota]
          ];

      const columns = [
        search.createColumn({ name: 'custrecord_monto_cuota', sort: search.Sort.DESC }),
        'internalid', 'name', 'custrecord_oferta', 'custrecord_plazo', 'custrecord_monto_cuota_final', 'custrecord_source'
      ];

      const searchObj = search.create({
        type: 'customrecord_sdb_oferta_final',
        filters,
        columns
      });

      const res = searchObj.run().getRange({ start: 0, end: 1 });
      if (!res || !res.length) return null;

      const r = res[0];
      return {
        internalid: r.getValue('internalid'),
        name: r.getValue('name'),
        montoCuota: r.getValue('custrecord_monto_cuota'),
        oferta: r.getValue('custrecord_oferta'),
        plazo: r.getValue('custrecord_plazo'),
        cuotaFinal: r.getValue('custrecord_monto_cuota_final'),
        source: r.getValue('custrecord_source')
      };
    } catch (e) {
      log.error(`${LOG_PREFIX} getOfertaFinal`, e);
      return null;
    }
  }


  return { post };
});

''