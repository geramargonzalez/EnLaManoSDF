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
    '../config/scoringRules',
    '../../ELM_Aux_Lib'
], function (log, cache, equifaxAdapter, bcuAdapter, mymAdapter, scoreEngine, scoringRules, auxLib) {
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
        options.forceRefresh = true;

        const isDebugMode = options.debug === true;
        const requestId = isDebugMode ? generateRequestId() : null;

        try {
            const __t0 = Date.now();

            if (!DOCUMENT_REGEX.test(documento.replace(/[^\d]/g, ''))) {
                throw createServiceError('INVALID_DOCUMENT', 'Documento invalido');
            }

            scoringRules.setStrictMode(options && options.strictRules === true);
            const __tRules0 = Date.now();
            const rules = scoringRules.getRules();
            const __tRules1 = Date.now();
            if (!rules) {
                throw createServiceError('RULES_UNAVAILABLE', 'No se pudieron cargar reglas de scoring');
            }

            const __tFetch0 = Date.now();
            const idLog = auxLib.createLogRecord(documento, null, false, 6, options?.provider, null);
            const normalizedData = fetchProviderData(documento, options);
            const __tFetch1 = Date.now();
            if (!normalizedData) {
                throw createServiceError('PROVIDER_NO_DATA', 'Proveedor no devolvio datos');
            }

            const __tScore0 = Date.now();
            var scoreResult;
            try {
                scoreResult = scoreEngine.computeScore(normalizedData, rules);
                log.debug({ title: 'computeScore result', details: { idLog, scoreResult } });
                auxLib.updateLogWithResponse(idLog, null, scoreResult?.metadata?.isRejected ? false : true, scoreResult, normalizedData );

            } catch (computeErr) {
                // Log compute error with normalizedData preview to help debugging
                try {
                    var nd = '';
                    try { nd = JSON.stringify(normalizedData, null, 2); } catch (e) { nd = '[unserializable normalizedData]'; }
                    if (nd && nd.length > 2000) nd = nd.substring(0, 2000) + '... [truncated]';
                    log.error({ title: 'computeScore threw exception', details: { error: (computeErr && (computeErr.message || computeErr.toString())), stack: (computeErr && computeErr.stack ? computeErr.stack : null), normalizedDataPreview: nd } });
                } catch (logErr) { /* ignore logging errors */ }
                // rethrow to be caught by outer try/catch
                throw computeErr;
            }
            const __tScore1 = Date.now();

            // DEBUG HELP: log type and a truncated preview of scoreResult to locate where computeScore fails
            try {
                var _preview = '';
                try {
                    _preview = JSON.stringify(scoreResult, null, 2);
                } catch (e) {
                    _preview = String(scoreResult);
                }
                if (_preview && _preview.length > 3000) _preview = _preview.substring(0, 3000) + '... [truncated]';
                log.debug({ title: 'computeScore result preview', details: { type: typeof scoreResult, preview: _preview } });
            } catch (dbgErr) {
                try { log.debug({ title: 'computeScore preview error', details: dbgErr.toString() }); } catch (xx) {}
            }

            if (!scoreResult || typeof scoreResult !== 'object') {
                // Log more context before throwing to ease debugging (include normalizedData small preview)
                try {
                    let _normPreview = '';
                    try { _normPreview = JSON.stringify(normalizedData, null, 2); } catch (e) { _normPreview = '[unserializable normalizedData]'; }
                    if (_normPreview && _normPreview.length > 2000) _normPreview = _normPreview.substring(0, 2000) + '... [truncated]';
                    log.error({ title: 'SCORE_COMPUTE_ERROR - invalid scoreResult', details: { scoreType: typeof scoreResult, scorePreview: (typeof scoreResult === 'object' ? '[object]' : String(scoreResult)), normalizedDataPreview: _normPreview } });
                } catch (logErr) {  }

                throw createServiceError('SCORE_COMPUTE_ERROR', 'Resultado de scoring invalido');
            }

            scoreResult.metadata = scoreResult.metadata || {};
            if (!scoreResult.metadata.calculatedAt) {
                scoreResult.metadata.calculatedAt = new Date();
            }
            scoreResult.metadata.provider = (options.provider || PROVIDER_EQUIFAX || '').toString().toLowerCase();

            if (isDebugMode) {
                scoreResult.metadata.requestId = requestId;
                scoreResult.metadata.timings = {
                    rulesMS: (__tRules1 - __tRules0),
                    fetchMS: (__tFetch1 - __tFetch0),
                    scoreMS: (__tScore1 - __tScore0),
                    totalMS: (__tScore1 - __t0)
                };
            }

            if (isDebugMode || (scoreResult.metadata && scoreResult.metadata.isRejected)) {
                log.audit({
                    title: 'BCU Score',
                    details: {
                        doc: documento.substr(-4),
                        score: scoreResult.finalScore,
                        rejected: scoreResult.metadata && scoreResult.metadata.isRejected,
                        timings: scoreResult.metadata.timings
                    }
                });
            }

            // Construir una tabla HTML con variables extraídas de logTxt para visualización clara
            try {
                scoreResult.variablesTable = buildVariablesTable(scoreResult.logTxt || '');
            } catch (tblErr) {
                // no bloquear el flujo por errores al construir la tabla
                scoreResult.variablesTable = '';
                log.debug('Variables table build error', tblErr.toString());
            }

            return scoreResult;
        } catch (error) {
            try {
                log.error({
                    title: 'BCU Score Error',
                    details: {
                        doc: (documento || '').toString().substr(-4),
                        error: error && (error.message || error.toString())
                    }
                });
            } catch (inner) {}
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
            const cacheKey = buildCacheKey(documento, provider);
            const scoreCache = cache.getCache({
                name: 'bcuScore',
                scope: CACHE_SCOPE
            });
            
            const cachedData = scoreCache.get({ key: cacheKey });
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
     * Construye una tabla HTML simple a partir del texto de logTxt
     * Busca líneas con formato `name: value` y las convierte en filas
     */
    function buildVariablesTable(logTxt) {
        if (!logTxt || typeof logTxt !== 'string') return '';
        // Normalizar separadores y extraer tokens relevantes
        // Reemplazamos etiquetas HTML por saltos de línea para facilitar parseo
        var cleaned = logTxt.replace(/<\/?P[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
        var lines = cleaned.split(/\n+/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

        // Buscamos pares clave: valor en las líneas
        var vars = [];
        var kvRegex = /([a-zA-Z0-9_\- ]+):\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?|[^\s].*)$/i;
        for (var i = 0; i < lines.length; i++) {
            var match = lines[i].match(kvRegex);
            if (match) {
                var key = match[1].trim();
                var value = match[2].trim();
                // Normalizar nombres cortos
                if (key.length > 0 && vars.length < 100) {
                    vars.push({ k: key, v: value });
                }
            }
        }

        if (vars.length === 0) return '';

        var html = '<table style="border-collapse:collapse;border:1px solid #ddd;font-family:Arial,Helvetica,sans-serif;font-size:12px;">';
        html += '<thead><tr><th style="border:1px solid #ddd;padding:6px;background:#f6f6f6">Variable</th><th style="border:1px solid #ddd;padding:6px;background:#f6f6f6">Valor</th></tr></thead><tbody>';
        for (var j = 0; j < vars.length; j++) {
            html += '<tr>';
            html += '<td style="border:1px solid #ddd;padding:6px;">' + escapeHtml(vars[j].k) + '</td>';
            html += '<td style="border:1px solid #ddd;padding:6px;">' + escapeHtml(vars[j].v) + '</td>';
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }

    // pequeño helper para escapar HTML
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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






