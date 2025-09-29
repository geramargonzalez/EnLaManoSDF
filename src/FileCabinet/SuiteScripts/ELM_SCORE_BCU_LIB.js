/**
 * @NApiVersion 2.1
 * @description ELM_SCORE_BCU_LIB OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/log', './bcuScore/app/service'], function (log, scoreService) {
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

        try {
            // Mapear options a nuevo formato optimizado
            var newOptions = {
                provider: (options && options.provider) || 'equifax',
                forceRefresh: options && options.forceRefresh,
                debug: options && options.debug,
                timeout: 15000 // Timeout agresivo
            };

            // Llamada optimizada al servicio
            var result = scoreService.calculateScore(dni, newOptions);
            
            // Mapear respuesta a formato legacy para backward compatibility
            if (result.metadata && result.metadata.isRejected) {
                return {
                    title: 'Score rechazado',
                    error_reglas: 422,
                    detail: result.metadata.rejectionReason || 'Rechazado por scoring',
                    score: 0,
                    calificacionMinima: extractWorstRating(result),
                    provider: result.metadata.provider || 'equifax',
                    flags: result.flags || {},
                    metadata: result.metadata
                };
            }

            // Respuesta exitosa optimizada
            return {
                score: Math.round(result.finalScore * 100), // Legacy format: 0-100
                calificacionMinima: extractWorstRating(result),
                contador: extractEntityCount(result),
                mensaje: 'Score calculado exitosamente',
                endeudamiento: extractTotalDebt(result),
                provider: result.metadata.provider || 'equifax',
                flags: result.flags || {},
                breakdown: result.contributions || {},
                metadata: result.metadata || {},
                error_reglas: false,
                // Campos adicionales para nueva funcionalidad
                finalScore: result.finalScore,
                rawScore: result.rawScore,
                validation: result.validation
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
        return '0';
    }

    /**
     * Extrae cantidad de entidades del resultado
     */
    function extractEntityCount(result) {
        if (result.contributions && result.contributions.entityCount) {
            return result.contributions.entityCount.rawValue || 0;
        }
        return 0;
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