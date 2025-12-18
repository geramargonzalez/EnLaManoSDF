/**
 * @NApiVersion 2.1
 * @description ELM_SCORE_BCU_LIB OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/log', 'N/runtime', './bcuScore/app/service'], function (log, runtime, scoreService) {
    'use strict';


    /**
     * OPTIMIZADO: Entry point con mínima latencia y backward compatibility
     * @param {string} dni - Documento a consultar  
     * @param {Object} options - Opciones de scoring
     * @returns {Object} Respuesta en formato legacy compatible
     */
    function scoreFinal(dni, options) {
        // Validación ultra-rápida
        if (!dni) {
            return {
                title: 'Error de validación',
                error_reglas: 400,
                detail: 'Documento requerido',
                score: 0
            };
        }

        const isSandbox = runtime && runtime.envType === runtime.EnvType.SANDBOX;
 
        try {
            // Mapear options a nuevo formato optimizado
            let provider = 'equifax';
            if (options.provider == '1') {
                provider = 'mym';
            }

           /*  if (options.provider == '3') {
                provider = 'bcu';
            } */

            const newOptions = {
                provider: provider,
                strictRules: options && options.strictRules,
                forceRefresh: options && options.forceRefresh,
                debug: options && options.debug,
                timeout: 15000 // Timeout agresivo
            };


            // Llamada optimizada al servicio
            const result = scoreService.calculateScore(dni, newOptions);

      
            
            // Mapear respuesta a formato legacy para backward compatibility
            if (result.metadata && result.metadata.isRejected) {
                // Determinar código de error según razón de rechazo
                // NO_BCU_DATA = 404 (sin información en BCU)
                // Otros rechazos = 422 (score rechazado por reglas)
                const rejectionReason = result.metadata.rejectionReason || 'Rechazado por scoring';
                const errorCode = rejectionReason === 'NO_BCU_DATA' ? 404 : 422;
                
                return {
                    title: rejectionReason === 'NO_BCU_DATA' ? 'No hay Información en BCU' : 'Score rechazado',
                    error_reglas: errorCode,
                    detail: result.metadata.rejectionMessage || rejectionReason,
                    score: 0,
                    calificacionMinima: extractWorstRating(result),
                    provider: result.metadata.provider || 'equifax',
                    flags: result.flags || {},
                    metadata: result.metadata,
                    logTxt: result?.logTxt
                };
            }

            // Respuesta exitosa en formato exactamente igual a SDB-Enlamano-score.js
            // CRITICAL: Agregar t2/t6 para compatibilidad con extractBcuData
            // T2 viene de normalizedData.periodData.t0 (periodo actual)
            // T6 viene de normalizedDataT6.periodData.t0 (periodo 6 meses atrás - segunda llamada)
            return {
                score: result.score,
                calificacionMinima: result.calificacionMinima || extractWorstRating(result),
                contador: result.contador || extractEntityCount(result),
                mensaje: result.mensaje || 'No tenemos prestamo disponible en este momento',
                endeudamiento: result.endeudamiento !== undefined ? result.endeudamiento : extractTotalDebt(result),
                nombre: isSandbox ? 'default default' : (result.nombre || ''),
                error_reglas: false,
                logTxt: result.logTxt || '',
                // Agregar t2/t6 desde normalizedData para que extractBcuData pueda procesarlos
                // T2 = datos del periodo actual (t0 de normalizedData)
                // T6 = datos de 6 meses atrás (t0 de normalizedDataT6, ya que es una consulta separada)
                t2: result.normalizedData?.periodData?.t0 || null,
                t6: result.normalizedDataT6?.periodData?.t0 || result.normalizedData?.periodData?.t6 || null,
                periodoT2: result.periodoT2 || result.metadata?.periodoT2,
                periodoT6: result.periodoT6 || result.metadata?.periodoT6
            };

        } catch (error) {
            // Log mínimo solo si es modo debug
            if (options && options.debug) {
                log.error({
                    title: 'ELM Score Fast Error',
                    details: dni.substr(-4) + ': ' + (error.message || error.toString())
                });
            }

            return {
                title: 'Error de servicio',
                error_reglas: 500,
                detail: 'Error interno del scoring',
                score: 0,
                provider: 'equifax',
                flags: {},
                metadata: { error: error.message }
            };
        }
    }

    /**
     * Extrae peor calificación del resultado para backward compatibility
     */
    function extractWorstRating(result) {
        if (result.contributions && result.contributions.worstRating) {
            return result.contributions.worstRating.rawValue || '0';
        }
        if (result.metadata && result.metadata.worstRating) {
            return result.metadata.worstRating;
        }
        return null;
    }

    /**
     * Extrae cantidad de entidades del resultado
     */
    function extractEntityCount(result) {
        if (result.contributions && result.contributions.entityCount) {
            return result.contributions.entityCount.rawValue || 0;
        }
        return null;
    }

    /**
     * Extrae total de endeudamiento del resultado
     */
    function extractTotalDebt(result) {
        if (!result.contributions) return 0;
        
        var vigente = (result.contributions.vigente && result.contributions.vigente.rawValue) || 0;
        var vencido = (result.contributions.vencido && result.contributions.vencido.rawValue) || 0;
        var castigado = (result.contributions.castigado && result.contributions.castigado.rawValue) || 0;
        
        return vigente + vencido + castigado;
    }



    // Public API con backward compatibility
    return {
        scoreFinal: scoreFinal
    };
});
