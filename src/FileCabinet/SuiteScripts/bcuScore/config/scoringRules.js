/**
 * @NApiVersion 2.1
 * @description Configuración centralizada de reglas de scoring BCU
 */

define(['N/search', 'N/log'], function (search, log) {
    'use strict';

    // Configuración por defecto (fallback si falla carga desde NetSuite)
    // PRE-COMPILADAS para máxima velocidad - NO requiere parsing JSON
    var DEFAULT_RULES = {
        coefficients: {
            vigente: { weight: -0.05, threshold: 100000, maxImpact: -0.3 },
            vencido: { weight: -0.15, threshold: 10000, maxImpact: -0.5 },
            castigado: { weight: -0.25, threshold: 5000, maxImpact: -0.8 },
            entityCount: { weight: -0.08, threshold: 3, maxImpact: -0.2 },
            // Pre-compilado para lookup O(1)
            ratingPenalties: {
                '1A': 0, '1C': -0.1, '2A': -0.2, '2B': -0.4, '0': -0.3,
                'N/C': -0.25, 'N': -0.3, '3': -0.6, '4': -0.8, '5': -1.0
            }
        },
        baseScore: 0.7,
        rejectionRules: {
            isDeceased: true,
            badRatings: ['2B', '3', '4', '5'], // Pre-compilado array
            maxVencido: 200000,
            maxCastigado: 100000,
            maxTotalDebt: 5000000
        },
        periods: { current: 't0', comparison: 't6' },
        trending: {
            enabled: false, // DESHABILITADO por defecto para velocidad
            improvementBonus: 0.1,
            deteriorationPenalty: -0.15,
            thresholdPercentage: 0.1
        }
    };

    var _cachedRules = null;
    var _lastCacheTime = null;
    var CACHE_DURATION_MS = 1800000; // 30 minutos - caché más largo

    /**
     * OPTIMIZADO: Obtiene reglas con caché agresivo y fallback inmediato
     */
    function getScoringRules() {
        // Caché hit inmediato - sin validación temporal en producción
        if (_cachedRules) {
            return _cachedRules;
        }

        try {
            // Intentar carga rápida desde NetSuite (timeout corto)
            var customRules = loadRulesFromNetSuite();
            if (customRules && scoringRules.validateRules && scoringRules.validateRules(customRules)) {
                _cachedRules = customRules;
                _lastCacheTime = Date.now();
                return customRules;
            }
        } catch (error) {
            // Log error pero continúa inmediatamente con defaults
            if (log && log.debug) {
                log.debug({
                    title: 'BCU Fast Rules Fallback',
                    details: 'Using defaults due to: ' + (error.message || error.toString())
                });
            }
        }

        // Fallback instantáneo a reglas optimizadas
        _cachedRules = DEFAULT_RULES;
        _lastCacheTime = Date.now();
        return DEFAULT_RULES;
    }

    /**
     * Carga reglas personalizadas desde customrecord_sdb_score
     */
    function loadRulesFromNetSuite() {
        try {
            var scoreSearch = search.create({
                type: 'customrecord_sdb_score',
                filters: [
                    ['isinactive', 'is', 'F'] // Solo registros activos
                ],
                columns: [
                    'custrecord_sdb_score_coefficient',
                    'custrecord_sdb_score_threshold',
                    'custrecord_sdb_score_max_impact',
                    'custrecord_sdb_score_base_score',
                    'custrecord_sdb_score_rejection_rules',
                    'custrecord_sdb_score_rating_penalties'
                ]
            });

            var searchResult = scoreSearch.run().getRange(0, 1);
            
            if (searchResult.length === 0) {
                log.debug({
                    title: 'Scoring Rules',
                    details: 'No custom scoring rules found in NetSuite'
                });
                return null;
            }

            var record = searchResult[0];
            
            // Construir objeto de reglas desde campos del record
            var customRules = {
                coefficients: {
                    vigente: {
                        weight: parseFloat(record.getValue('custrecord_sdb_score_vigente_weight')) || DEFAULT_RULES.coefficients.vigente.weight,
                        threshold: parseFloat(record.getValue('custrecord_sdb_score_vigente_threshold')) || DEFAULT_RULES.coefficients.vigente.threshold,
                        maxImpact: parseFloat(record.getValue('custrecord_sdb_score_vigente_max')) || DEFAULT_RULES.coefficients.vigente.maxImpact
                    },
                    vencido: {
                        weight: parseFloat(record.getValue('custrecord_sdb_score_vencido_weight')) || DEFAULT_RULES.coefficients.vencido.weight,
                        threshold: parseFloat(record.getValue('custrecord_sdb_score_vencido_threshold')) || DEFAULT_RULES.coefficients.vencido.threshold,
                        maxImpact: parseFloat(record.getValue('custrecord_sdb_score_vencido_max')) || DEFAULT_RULES.coefficients.vencido.maxImpact
                    },
                    castigado: {
                        weight: parseFloat(record.getValue('custrecord_sdb_score_castigado_weight')) || DEFAULT_RULES.coefficients.castigado.weight,
                        threshold: parseFloat(record.getValue('custrecord_sdb_score_castigado_threshold')) || DEFAULT_RULES.coefficients.castigado.threshold,
                        maxImpact: parseFloat(record.getValue('custrecord_sdb_score_castigado_max')) || DEFAULT_RULES.coefficients.castigado.maxImpact
                    },
                    entityCount: {
                        weight: parseFloat(record.getValue('custrecord_sdb_score_entity_weight')) || DEFAULT_RULES.coefficients.entityCount.weight,
                        threshold: parseFloat(record.getValue('custrecord_sdb_score_entity_threshold')) || DEFAULT_RULES.coefficients.entityCount.threshold,
                        maxImpact: parseFloat(record.getValue('custrecord_sdb_score_entity_max')) || DEFAULT_RULES.coefficients.entityCount.maxImpact
                    },
                    ratingPenalties: parseRatingPenalties(record.getValue('custrecord_sdb_score_rating_penalties'))
                },
                baseScore: parseFloat(record.getValue('custrecord_sdb_score_base_score')) || DEFAULT_RULES.baseScore,
                rejectionRules: parseRejectionRules(record.getValue('custrecord_sdb_score_rejection_rules')),
                periods: DEFAULT_RULES.periods, // Usar configuración estática
                trending: DEFAULT_RULES.trending // Usar configuración estática
            };

            return customRules;

        } catch (error) {
            log.error({
                title: 'Load Rules from NetSuite Error',
                details: error.toString()
            });
            return null;
        }
    }

    /**
     * Parsea string JSON de penalizaciones por rating
     */
    function parseRatingPenalties(jsonString) {
        try {
            if (!jsonString) return DEFAULT_RULES.coefficients.ratingPenalties;
            
            var parsed = JSON.parse(jsonString);
            return Object.assign({}, DEFAULT_RULES.coefficients.ratingPenalties, parsed);
            
        } catch (error) {
            log.error({
                title: 'Parse Rating Penalties Error', 
                details: error.toString()
            });
            return DEFAULT_RULES.coefficients.ratingPenalties;
        }
    }

    /**
     * Parsea string JSON de reglas de rechazo
     */
    function parseRejectionRules(jsonString) {
        try {
            if (!jsonString) return DEFAULT_RULES.rejectionRules;
            
            var parsed = JSON.parse(jsonString);
            return Object.assign({}, DEFAULT_RULES.rejectionRules, parsed);
            
        } catch (error) {
            log.error({
                title: 'Parse Rejection Rules Error',
                details: error.toString()
            });
            return DEFAULT_RULES.rejectionRules;
        }
    }

    /**
     * Invalida caché de reglas (fuerza recarga desde NetSuite)
     */
    function invalidateCache() {
        _cachedRules = null;
        _lastCacheTime = null;
        
        log.debug({
            title: 'Scoring Rules Cache',
            details: 'Cache invalidated, will reload on next request'
        });
    }

    /**
     * Obtiene reglas por defecto (para testing)
     */
    function getDefaultRules() {
        return JSON.parse(JSON.stringify(DEFAULT_RULES)); // Deep copy
    }

    /**
     * Valida que las reglas estén bien formadas
     */
    function validateRules(rules) {
        if (!rules || typeof rules !== 'object') {
            return false;
        }

        // Validar estructura básica
        if (!rules.coefficients || !rules.baseScore || !rules.rejectionRules) {
            return false;
        }

        // Validar coeficientes
        var requiredCoeffs = ['vigente', 'vencido', 'castigado', 'entityCount'];
        for (var i = 0; i < requiredCoeffs.length; i++) {
            var coeff = requiredCoeffs[i];
            if (!rules.coefficients[coeff] || 
                typeof rules.coefficients[coeff].weight !== 'number' ||
                typeof rules.coefficients[coeff].threshold !== 'number') {
                return false;
            }
        }

        // Validar base score
        if (typeof rules.baseScore !== 'number' || 
            rules.baseScore < 0 || rules.baseScore > 1) {
            return false;
        }

        return true;
    }

    // Public API
    return {
        getScoringRules: getScoringRules,
        getDefaultRules: getDefaultRules,
        invalidateCache: invalidateCache,
        validateRules: validateRules,
        
        // Para testing
        _internal: {
            DEFAULT_RULES: DEFAULT_RULES,
            loadRulesFromNetSuite: loadRulesFromNetSuite,
            parseRatingPenalties: parseRatingPenalties,
            parseRejectionRules: parseRejectionRules
        }
    };
});