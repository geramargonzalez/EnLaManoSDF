/**
 * @NApiVersion 2.1
 * @description Configuración centralizada de reglas de scoring BCU
 */

define(['N/search', 'N/log'], function (search, log) {
    'use strict';

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj || {}));
    }

    const DEFAULT_COEFFS = {
        banco_binned: 0.0038032,
        ent_t6_binned: 0.0026394,
        intercept: 0.211, // IMPORTANTE: Usar exactamente 0.211 como en SDB-Enlamano-score.js (NO 0.2114816)
        t6_cred_dir_comp_binned: 0.0028341,
        vig_noauto_t6_coop_binned: 0.0033394,
        t0_bbva_binned: 0.0045863,
        cont_t0_fucac_binned: 0.0038189,
        t0_scotia_binned: 0.0034926,
        t0_asi_binned: 0.0037215,
        brou_grupo_binned: 0.0037486,
        emp_valor_binned: 0.0059208,
        t0_fnb_binned: 0.0014982,
        t0_santa_binned: 0.0006744,
        t6_binned: 0.0005706,
        cred_dir_binned: 0.0002515,
        t6_creditel_binned: 0.0003315,
        t6_oca_binned: 0.0042904,
        t6_pronto_binned: 0.0016738
    };

    const DEFAULT_ALIAS_MAP = {
        creditel: ['SOCUR', 'CREDITEL'],
        oca: ['OCA'],
        creditosDirectos: ['CREDITOS DIRECTOS', 'CRED. DIRECTOS'],
        pronto: ['BAUTZEN', 'PRONTO'],
        integrales: ['INTEGRALES'],
        empr: ['EMPRENDIMIENTOS'],
        fucac: ['FUCAC'],
        scotia: ['SCOTIABANK', 'SCOTIA', 'SCOTIA BANK'],
        brou: ['REPUBLICA', 'BROU', 'BANCO REPUBLICA', 'BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY'],
        santander: ['SANTANDER'],
        vizcaya: ['VIZCAYA', 'BBVA', 'BANCO BILBAO', 'BANCO BILBAO VIZCAYA', 'BANCO BILBAO VIZCAYA ARGENTARIA'],
        bandes: ['BANDES'],
        itau: ['BANCO ITA', 'BANCO ITAU', 'ITAU'],
        hsbc: ['HSBC'],
        coopNoAuto: ['ANDA', 'FUCEREP', 'ACAC'],
        fnbTargets: ['INTEGRALES', 'BAUTZEN', 'CREDITOS DIRECTOS', 'EMPRENDIMIENTOS', 'MICROFINANZAS', 'OCA', 'PASS CARD', 'PROMOTORA', 'REPUBLICA MICROFINAZAS', 'RETOP', 'CIA', 'SOCUR', 'VERENDY']
    };

    const DEFAULT_NUMERIC = {
        eps: 0,
        rounding: {}
    };

    // Configuración por defecto (fallback si falla carga desde NetSuite)
    // PRE-COMPILADAS para máxima velocidad - NO requiere parsing JSON
    const DEFAULT_RULES = {
        mode: 'strict',
        numeric: clone(DEFAULT_NUMERIC),
        aliases: clone(DEFAULT_ALIAS_MAP),
        coeffs: clone(DEFAULT_COEFFS),
        // NOTA: La sección 'coefficients' está comentada porque actualmente NO se usa en el scoring principal.
        // El scoring usa exclusivamente los coeficientes 'binned' (WOE) de abajo.
        // Esta sección está reservada para futuras extensiones (scoring híbrido, validaciones adicionales).
        // Si necesitas activarla, descomenta y agrega los campos correspondientes en customrecord_sdb_score.
        /*
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
        */
        // Valores por defecto para coeficientes "binned" (WOE) extraídos del record de Score
        // ESTOS SON LOS COEFICIENTES QUE SE USAN ACTUALMENTE EN EL SCORING
        binned: clone(DEFAULT_COEFFS),
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
 
    let _cachedRules = null;
    let STRICT_MODE = false;    
    const scoreNetsuiteID = 1; // ID fijo del record customrecord_sdb_score

    /**
     * OPTIMIZADO: Obtiene reglas con caché agresivo y fallback inmediato
     */
    function getScoringRules() {
        if (_cachedRules) return _cachedRules;

        var customRules = null;
        var loadError = null;
        try { customRules = loadRulesFromNetSuite(); } catch (e) { loadError = e; }

        if (customRules && validateRules(customRules)) {
            var requiredKeys = Object.keys(DEFAULT_RULES.binned || {});
            var missing = [];
            for (var i = 0; i < requiredKeys.length; i++) {
                var key = requiredKeys[i];
                if (!customRules.binned || typeof customRules.binned[key] !== 'number' || isNaN(customRules.binned[key])) {
                    missing.push(key);
                }
            }
            if (missing.length) {
                var msg = 'Missing binned keys: ' + missing.join(', ');
                if (STRICT_MODE) {
                    throw createRulesError('SCORING_RULES_INCOMPLETE', msg);
                }
                if (log && log.debug) {
                    log.debug({ title: 'Scoring Rules Incomplete', details: msg });
                }
            }
            _cachedRules = customRules;
            return customRules;
        }

        if (STRICT_MODE) {
            var reason = loadError ? (loadError.message || loadError.toString()) : 'Invalid or missing rules';
            throw createRulesError('SCORING_RULES_STRICT_LOAD_FAILED', reason);
        }

        if (log && log.debug) {
            log.debug({
                title: 'BCU Fast Rules Fallback',
                details: 'Using defaults due to: ' + (loadError ? (loadError.message || loadError.toString()) : 'invalid rules')
            });
        }
    _cachedRules = DEFAULT_RULES;
    return DEFAULT_RULES;
    }

    /** 
     * Carga reglas personalizadas desde customrecord_sdb_score
     * OPTIMIZADO: usa lookupFields directo (más rápido que saved search)
     */
    function loadRulesFromNetSuite() {
        try {
            // OPTIMIZACIÓN: lookupFields es más rápido que search.create + getRange
            // Carga TODOS los campos en una sola llamada para minimizar latencia
            const record = search.lookupFields({
                type: 'customrecord_sdb_score',
                id: scoreNetsuiteID,
                columns: [
                    // Campos básicos (algunos comentados porque no se usan)
                    //  'custrecord_sdb_score_base_score',
                    // 'custrecord_sdb_score_rejection_rules', // COMENTADO: Campo probablemente no existe
                    'custrecord_sdb_banco_binned',
                    'custrecord_sdb_ent_t6_binned',
                    'custrecord_sdb_intercept',
                    'custrecord_sdb_t6_cred_dir_comp_binned',
                    'custrecord_sdb_vig_noauto_t6_coop_binned',
                    'custrecord_sdb_woe_cont_t0_bbva_binned',
                    'custrecord_sdb_woe_cont_t0_fucac_binned',
                    'custrecord_sdb_woe_cont_t0_scotia_binned',
                    'custrecord_sdb_woe_t0_asi_binned',
                    'custrecord_sdb_woe_t0_brou_grupo_binned',
                    'custrecord_sdb_woe_t0_emp_valor_binned',
                    'custrecord_sdb_woe_t0_fnb_binned',
                    'custrecord_sdb_woe_t0_santa_binned',
                    'custrecord_sdb_woe_t6_binned',
                    'custrecord_sdb_woe_t6_cred_dir_binned',
                    'custrecord_sdb_woe_t6_creditel_binned',
                    'custrecord_sdb_woe_t6_oca_binned',
                    'custrecord_sdb_woe_t6_pronto_binned',
                    // 'custrecord_sdb_score_coefficient', // COMENTADO: Campo probablemente no existe
                    // 'custrecord_sdb_score_threshold', // COMENTADO: Campo no existe en custom record
                    // 'custrecord_sdb_score_vigente_max', // COMENTADO: Campo probablemente no existe
                    //'custrecord_sdb_score_base_score'
                    // 'custrecord_sdb_score_vencido_weight', // COMENTADO: Campo probablemente no existe
                    // 'custrecord_sdb_score_rating_penalties' // COMENTADO: Campo probablemente no existe
                ]
            });

            // Helper para parsear valores de lookupFields (pueden venir como array o valor directo)
            function getFieldValue(fieldName) {
                var raw = record[fieldName];
                if (!raw) return null;
                // lookupFields puede devolver array [{ value, text }] o valor directo
                if (Array.isArray(raw) && raw.length > 0) {
                    return raw[0].value || raw[0];
                }
                return raw;
            }

            // Construir objeto de reglas desde campos del record
            const customRules = {
                mode: 'strict',
                numeric: clone(DEFAULT_NUMERIC),
                aliases: clone(DEFAULT_ALIAS_MAP),
                baseScore: DEFAULT_RULES.baseScore,
                rejectionRules: DEFAULT_RULES.rejectionRules, // parseRejectionRules(getFieldValue('custrecord_sdb_score_rejection_rules')), // COMENTADO: Campo no existe
                periods: DEFAULT_RULES.periods, // Usar configuración estática
                trending: DEFAULT_RULES.trending // Usar configuración estática
            };

            // Mapear valores binned (WOE) desde lookupFields
            customRules.binned = {
                banco_binned: parseFloat(getFieldValue('custrecord_sdb_banco_binned')) || DEFAULT_RULES.binned.banco_binned,
                ent_t6_binned: parseFloat(getFieldValue('custrecord_sdb_ent_t6_binned')) || DEFAULT_RULES.binned.ent_t6_binned,
                intercept: 0.211, // HARDCODED: Usar siempre 0.211 como en SDB-Enlamano-score.js (ignorar NetSuite)
                t6_cred_dir_comp_binned: parseFloat(getFieldValue('custrecord_sdb_t6_cred_dir_comp_binned')) || DEFAULT_RULES.binned.t6_cred_dir_comp_binned,
                vig_noauto_t6_coop_binned: parseFloat(getFieldValue('custrecord_sdb_vig_noauto_t6_coop_binned')) || DEFAULT_RULES.binned.vig_noauto_t6_coop_binned,
                t0_bbva_binned: parseFloat(getFieldValue('custrecord_sdb_woe_cont_t0_bbva_binned')) || DEFAULT_RULES.binned.t0_bbva_binned,
                cont_t0_fucac_binned: parseFloat(getFieldValue('custrecord_sdb_woe_cont_t0_fucac_binned')) || DEFAULT_RULES.binned.cont_t0_fucac_binned,
                t0_scotia_binned: parseFloat(getFieldValue('custrecord_sdb_woe_cont_t0_scotia_binned')) || DEFAULT_RULES.binned.t0_scotia_binned,
                t0_asi_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t0_asi_binned')) || DEFAULT_RULES.binned.t0_asi_binned,
                brou_grupo_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t0_brou_grupo_binned')) || DEFAULT_RULES.binned.brou_grupo_binned,
                emp_valor_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t0_emp_valor_binned')) || DEFAULT_RULES.binned.emp_valor_binned,
                t0_fnb_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t0_fnb_binned')) || DEFAULT_RULES.binned.t0_fnb_binned,
                t0_santa_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t0_santa_binned')) || DEFAULT_RULES.binned.t0_santa_binned,
                t6_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t6_binned')) || DEFAULT_RULES.binned.t6_binned,
                cred_dir_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t6_cred_dir_binned')) || DEFAULT_RULES.binned.cred_dir_binned,
                t6_creditel_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t6_creditel_binned')) || DEFAULT_RULES.binned.t6_creditel_binned,
                t6_oca_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t6_oca_binned')) || DEFAULT_RULES.binned.t6_oca_binned,
                t6_pronto_binned: parseFloat(getFieldValue('custrecord_sdb_woe_t6_pronto_binned')) || DEFAULT_RULES.binned.t6_pronto_binned
            };

            customRules.coeffs = clone(customRules.binned);

            return customRules;

        } catch (error) {
            log.error({
                title: 'Load Rules from NetSuite Error',
                details: error.toString()
            });
            return null;
        }
    }

    function createRulesError(code, message) {
        var err = new Error(message || 'Scoring rules error');
        err.name = 'ScoringRulesError';
        err.code = code;
        return err;
    }

    /**
     * Invalida caché de reglas (fuerza recarga desde NetSuite)
     */
    function invalidateCache() {
        _cachedRules = null;
        if (log && log.debug) {
            log.debug({
                title: 'Scoring Rules Cache',
                details: 'Cache invalidated, will reload on next request'
            });
        }
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
        // NOTA: coefficients validación comentada - no se usa actualmente
        // if (!rules.coefficients || !rules.baseScore || !rules.rejectionRules) {
        if (!rules.baseScore || !rules.rejectionRules) {
            return false;
        }

        // NOTA: Validación de coefficients comentada - reservada para uso futuro
        /*
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
        */

        // Validar base score
        if (typeof rules.baseScore !== 'number' || 
            rules.baseScore < 0 || rules.baseScore > 1) {
            return false;
        }

        // Validar binned (WOE) si están presentes - estos SÍ se usan
        if (rules.binned && typeof rules.binned !== 'object') {
            return false;
        }

        return true;
    }


    function setStrictMode(enabled) {
        STRICT_MODE = enabled === true;
        _cachedRules = null;
        if (log && log.debug) {
            log.debug({
                title: 'Scoring Rules Strict Mode',
                details: STRICT_MODE ? 'ENABLED' : 'DISABLED'
            });
        }
    }
        // Public API
    return {
        getScoringRules: getScoringRules,
        getRules: getScoringRules, // Alias para compatibilidad con consumidores existentes
        getDefaultRules: getDefaultRules,
        invalidateCache: invalidateCache,
        validateRules: validateRules,
        setStrictMode: setStrictMode,
        
        // Para testing
        _internal: {
            DEFAULT_RULES: DEFAULT_RULES,
            loadRulesFromNetSuite: loadRulesFromNetSuite
        }
    };});





