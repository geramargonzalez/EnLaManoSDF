/**
 * @NApiVersion 2.1
 * @description Servicio de orquestación para scoring BCU
 */

define([
    'N/log',
    'N/cache',
    '../adapters/equifaxAdapter',
    '../adapters/bcuAdapter',
    '../adapters/mymAdapter',
    '../domain/score',
    '../config/scoringRules'
], function (log, cache, equifaxAdapter, bcuAdapter, mymAdapter, scoreEngine, scoringRules) {
    'use strict';

    const  PROVIDER_EQUIFAX = 'equifax';
    const PROVIDER_BCU = 'bcu';
    const PROVIDER_MYM = 'mym';
    const CACHE_TTL_SECONDS = 180; // 30 minutos - caché más agresivo
    const CACHE_SCOPE = cache.Scope.PROTECTED;

    // Pre-compilar regex para validación rápida
    const DOCUMENT_REGEX = /^\d{7,8}$/;

    /**
     * OPTIMIZADO: Calcula score con caché agresivo y mínimo logging
     */
    function calculateScore(documento, options) {
        options = options || {};
        // Fuerzo bypass del cache: cada cálculo debe ser único
        // (según requerimiento del usuario, no se debe reutilizar resultados previos)
        options.forceRefresh = true;

        // Skip logging detallado en producción para velocidad
        const  isDebugMode = options.debug === true;
        const requestId = isDebugMode ? generateRequestId() : null;

        try {
            // Validación rápida con regex pre-compilada
            if (!DOCUMENT_REGEX.test(documento.replace(/[^\d]/g, ''))) {
                throw createServiceError('INVALID_DOCUMENT', 'Documento inválido');
            }


            // Bypass cache: siempre forzamos refresh para que cada cálculo sea único
            // (Se mantiene options.forceRefresh para compatibilidad, pero lo forzamos arriba)

            // Path crítico: obtener reglas (cached)
            const rules = scoringRules.getScoringRules();
            
            // Path crítico: obtener datos del proveedor
            const normalizedData = fetchProviderData(documento, options);

            // Path crítico: calcular score (O(n) puro)
            const scoreResult = scoreEngine.computeScore(normalizedData, rules);

            // Metadata mínima para producción
            if (isDebugMode) {
                scoreResult.metadata.requestId = requestId;
                scoreResult.metadata.fromCache = false;
            }
            
            // No cache: no almacenamos resultados para garantizar unicidad por solicitud
            // cacheScore(documento, options.provider, scoreResult);
            
            // Log mínimo solo si es debug o error
            if (isDebugMode || scoreResult.metadata?.isRejected) {
                log.audit({
                    title: 'BCU Score',
                    details: {
                        doc: documento.substr(-4), // Solo últimos 4 dígitos
                        score: scoreResult.finalScore,
                        rejected: scoreResult.metadata?.isRejected,
                        provider: normalizedData.provider

                    }
                });
            }

            return scoreResult;

        } catch (error) {
            // Log solo errores críticos
            log.error({
                title: 'BCU Score Error',
                details: {
                    doc: documento.substr(-4),
                    error: error.message || error.toString()
                }
            });

            return createErrorScoreResult(error, requestId);
        }
    }

    /**
     * Obtiene datos del proveedor especificado o usa fallback
     */
    function fetchProviderData(documento, options) {
        var provider = options.provider || PROVIDER_EQUIFAX; // Default a Equifax
        
        try {
            switch (provider.toLowerCase()) {
                case PROVIDER_EQUIFAX:
                    return equifaxAdapter.fetch(documento, options);
                    
                case PROVIDER_BCU:
                    return bcuAdapter.fetch(documento, options);
                    
                case PROVIDER_MYM:
                    return mymAdapter.fetch(documento, options);
                    
                default:
                    // Intentar Equifax como fallback
                    log.debug({
                        title: 'BCU Score Provider Fallback',
                        details: 'Unknown provider "' + provider + '", falling back to Equifax'
                    });
                    return equifaxAdapter.fetch(documento, options);
            }
        } catch (providerError) {
            // Para MYM, no hacer fallback automático (puede funcionar independientemente)
            // Solo hacer fallback para BCU ya que es un stub
            if (provider === PROVIDER_BCU && !options.noFallback) {
                log.debug({
                    title: 'BCU Score Provider Fallback',
                    details: {
                        originalProvider: provider,
                        error: providerError.toString(),
                        fallbackTo: PROVIDER_EQUIFAX
                    }
                });
                
                try {
                    return equifaxAdapter.fetch(documento, options);
                } catch (fallbackError) {
                    // Si ambos fallan, lanzar error original
                    throw providerError;
                }
            }
            
            // Para MYM y otros providers, lanzar error original sin fallback
            throw providerError;
        }
    }

    /**
     * Obtiene score desde caché
     */
    function getCachedScore(documento, provider) {
        try {
            var cacheKey = buildCacheKey(documento, provider);
            var scoreCache = cache.getCache({
                name: 'bcuScore',
                scope: CACHE_SCOPE
            });
            
            var cachedData = scoreCache.get({ key: cacheKey });
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            
        } catch (error) {
            log.debug({
                title: 'BCU Score Cache Get Error',
                details: error.toString()
            });
        }
        
        return null;
    }

    /**
     * Guarda score en caché
     */
    function cacheScore(documento, provider, scoreResult) {
        try {
            var cacheKey = buildCacheKey(documento, provider);
            var scoreCache = cache.getCache({
                name: 'bcuScore',
                scope: CACHE_SCOPE
            });
            
            scoreCache.put({
                key: cacheKey,
                value: JSON.stringify(scoreResult),
                ttl: CACHE_TTL_SECONDS
            });
            
            log.debug({
                title: 'BCU Score Cached',
                details: { cacheKey: cacheKey, ttl: CACHE_TTL_SECONDS }
            });
            
        } catch (error) {
            log.debug({
                title: 'BCU Score Cache Put Error',
                details: error.toString()
            });
        }
    }

    /**
     * Construye clave de caché
     */
    function buildCacheKey(documento, provider) {
        return 'score_' + (provider || PROVIDER_EQUIFAX) + '_' + documento;
    }

    /**
     * OPTIMIZADO: Validación rápida con regex pre-compilada
     */
    function isValidDocument(documento) {
        if (!documento) return false;
        var cleaned = documento.replace(/[^\d]/g, '');
        return DOCUMENT_REGEX.test(cleaned);
    }

    /**
     * Genera ID único para request
     */
    function generateRequestId() {
        return 'BCU_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Crea error de servicio estructurado
     */
    function createServiceError(code, message, details) {
        var error = new Error(message);
        error.name = 'BCUServiceError';
        error.code = code;
        error.details = details || {};
        error.timestamp = new Date().toISOString();
        return error;
    }

    /**
     * Crea resultado de score en caso de error
     */
    function createErrorScoreResult(error, requestId) {
        return {
            finalScore: 0,
            rawScore: 0,
            baseScore: 0,
            contributions: {},
            metadata: {
                calculatedAt: new Date(),
                isRejected: true,
                rejectionReason: 'SERVICE_ERROR',
                rejectionMessage: error.message || 'Error interno del servicio', 
                requestId: requestId,
                error: {
                    name: error.name,
                    code: error.code,
                    message: error.message
                }
            },
            flags: {},
            validation: {
                hasValidData: false,
                dataQuality: { level: 'NONE', score: 0, percentage: 0 },
                confidence: { level: 'NONE', score: 0 }
            }
        };
    }

    /**
     * Limpia caché de scoring para documento específico
     */
    function invalidateCache(documento, provider) {
        try {
            var cacheKey = buildCacheKey(documento, provider);
            var scoreCache = cache.getCache({
                name: 'bcuScore',
                scope: CACHE_SCOPE
            });
            
            scoreCache.remove({ key: cacheKey });
            
            log.debug({
                title: 'BCU Score Cache Invalidated',
                details: { documento: documento, provider: provider }
            });
            
        } catch (error) {
            log.error({
                title: 'BCU Score Cache Invalidation Error',
                details: error.toString()
            });
        }
    }

    /**
     * Obtiene estadísticas de caché
     */
    function getCacheStats() {
        try {
            var scoreCache = cache.getCache({
                name: 'bcuScore',
                scope: CACHE_SCOPE
            });
            
            // NetSuite cache no expone estadísticas directamente
            return {
                name: 'bcuScore',
                scope: CACHE_SCOPE,
                ttl: CACHE_TTL_SECONDS,
                message: 'Cache statistics not available in NetSuite'
            };
            
        } catch (error) {
            return {
                error: error.toString()
            };
        }
    }

    /**
     * Calcula múltiples scores en lote (uso futuro)
     */
    function calculateBatchScores(documentos, options) {
        if (!Array.isArray(documentos)) {
            throw createServiceError('INVALID_BATCH', 'documentos debe ser un array');
        }

        var results = [];
        var errors = [];

        for (var i = 0; i < documentos.length; i++) {
            try {
                var result = calculateScore(documentos[i], options);
                results.push({
                    documento: documentos[i],
                    score: result,
                    success: true
                });
            } catch (error) {
                errors.push({
                    documento: documentos[i],
                    error: error.toString(),
                    success: false
                });
            }
        }

        return {
            results: results,
            errors: errors,
            summary: {
                total: documentos.length,
                successful: results.length,
                failed: errors.length,
                successRate: (results.length / documentos.length) * 100
            }
        };
    }

    // Public API
    return {
        calculateScore: calculateScore,
        invalidateCache: invalidateCache,
        getCacheStats: getCacheStats,
        calculateBatchScores: calculateBatchScores,
        
        // Para testing
        _internal: {
            fetchProviderData: fetchProviderData,
            getCachedScore: getCachedScore,
            cacheScore: cacheScore,
            buildCacheKey: buildCacheKey,
            isValidDocument: isValidDocument,
            generateRequestId: generateRequestId,
            createServiceError: createServiceError,
            createErrorScoreResult: createErrorScoreResult,
            PROVIDER_EQUIFAX: PROVIDER_EQUIFAX,
            PROVIDER_BCU: PROVIDER_BCU,
            PROVIDER_MYM: PROVIDER_MYM
        }
    };
});