/**
 * @NApiVersion 2.1
 * @description Lógica pura de scoring BCU sin efectos secundarios
 */

define([], function () {
    'use strict';

    // Pre-compilar lookup tables para performance O(1)
    var RATING_ORDER = {
        '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
    };
    
    var BAD_RATINGS_SET = { '2B': true, '3': true, '4': true, '5': true };

    /**
     * OPTIMIZADO: Scoring O(n) con mínimas operaciones y early exits
     */
    function computeScore(normalizedData, scoringRules) {
        // Validación mínima
        if (!normalizedData || !scoringRules) {
            return createRejectedScore('INVALID_INPUT', 'Datos inválidos');
        }

        var rejectionRules = scoringRules.rejectionRules;
        var flags = normalizedData.flags || {};

        // Early exit: fallecido (más común)
        if (rejectionRules.isDeceased && flags.isDeceased) {
            return createRejectedScore('DECEASED', 'Persona fallecida');
        }

        // Early exit: mal rating (segundo más común)
        if (flags.hasRejectableRating) {
            return createRejectedScore('BAD_RATING', 'Calificación de rechazo');
        }

        var t0Data = normalizedData.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return createRejectedScore('NO_DATA', 'Sin datos para scoring');
        }

        var entities = t0Data.entities;
        var entityCount = entities.length;
        
        // Calcular totales en una sola pasada O(n)
        var totals = { vigente: 0, vencido: 0, castigado: 0 };
        var worstRatingValue = 0;
        var worstRating = '0';
        
        for (var i = 0; i < entityCount; i++) {
            var entity = entities[i];
            totals.vigente += entity.vigente || 0;
            totals.vencido += entity.vencido || 0;
            totals.castigado += entity.castigado || 0;
            
            // Worst rating en mismo loop
            var rating = String(entity.rating || '').toUpperCase();
            var ratingValue = RATING_ORDER[rating] || 0;
            if (ratingValue > worstRatingValue) {
                worstRatingValue = ratingValue;
                worstRating = rating;
            }
        }

        // Early exit: límites de deuda
        if (rejectionRules.maxVencido && totals.vencido > rejectionRules.maxVencido) {
            return createRejectedScore('EXCESS_VENCIDO', 'Deuda vencida excesiva');
        }
        if (rejectionRules.maxCastigado && totals.castigado > rejectionRules.maxCastigado) {
            return createRejectedScore('EXCESS_CASTIGADO', 'Deuda castigada excesiva');
        }

        var coeffs = scoringRules.coefficients;
        
        // Calcular contribuciones con operaciones mínimas
        var vigenteImpact = calculateDebtImpactFast(totals.vigente, coeffs.vigente);
        var vencidoImpact = calculateDebtImpactFast(totals.vencido, coeffs.vencido);
        var castigadoImpact = calculateDebtImpactFast(totals.castigado, coeffs.castigado);
        var entityImpact = calculateEntityImpactFast(entityCount, coeffs.entityCount);
        var ratingImpact = coeffs.ratingPenalties[worstRating] || 0;

        // Score final con operaciones mínimas
        var rawScore = scoringRules.baseScore + vigenteImpact + vencidoImpact + 
                      castigadoImpact + entityImpact + ratingImpact;
        var finalScore = Math.max(0, Math.min(1, rawScore));

        return {
            finalScore: finalScore,
            rawScore: rawScore,
            baseScore: scoringRules.baseScore,
            contributions: {
                vigente: { impact: vigenteImpact, rawValue: totals.vigente },
                vencido: { impact: vencidoImpact, rawValue: totals.vencido },
                castigado: { impact: castigadoImpact, rawValue: totals.castigado },
                entityCount: { impact: entityImpact, rawValue: entityCount },
                worstRating: { impact: ratingImpact, rawValue: worstRating }
            },
            metadata: {
                provider: normalizedData.provider,
                documento: normalizedData.documento,
                calculatedAt: new Date(),
                isRejected: false
            },
            flags: flags,
            validation: { hasValidData: true }
        };
    }

    /**
     * Verifica reglas de rechazo automático
     */
    function checkAutoRejection(data, rejectionRules) {
        if (!rejectionRules) {
            return { isRejected: false };
        }

        // Persona fallecida
        if (rejectionRules.isDeceased && data.flags.isDeceased) {
            return { 
                isRejected: true, 
                reason: 'DECEASED', 
                message: 'Persona fallecida' 
            };
        }

        // Calificación mala
        if (rejectionRules.badRatings && data.flags.hasRejectableRating) {
            var worstRating = extractWorstRating(data);
            if (rejectionRules.badRatings.includes(worstRating)) {
                return { 
                    isRejected: true, 
                    reason: 'BAD_RATING', 
                    message: 'Calificación rechazo automático: ' + worstRating 
                };
            }
        }

        // Deuda vencida excesiva
        if (rejectionRules.maxVencido) {
            var totalVencido = extractTotalByType(data, 'vencido');
            if (totalVencido > rejectionRules.maxVencido) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_VENCIDO', 
                    message: 'Deuda vencida excesiva: ' + totalVencido 
                };
            }
        }

        // Deuda castigada excesiva
        if (rejectionRules.maxCastigado) {
            var totalCastigado = extractTotalByType(data, 'castigado');
            if (totalCastigado > rejectionRules.maxCastigado) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_CASTIGADO', 
                    message: 'Deuda castigada excesiva: ' + totalCastigado 
                };
            }
        }

        // Deuda total excesiva
        if (rejectionRules.maxTotalDebt) {
            var totalDebt = extractTotalByType(data, 'vigente') + 
                           extractTotalByType(data, 'vencido') + 
                           extractTotalByType(data, 'castigado');
            if (totalDebt > rejectionRules.maxTotalDebt) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_TOTAL_DEBT', 
                    message: 'Deuda total excesiva: ' + totalDebt 
                };
            }
        }

        return { isRejected: false };
    }

    /**
     * Calcula contribución de un tipo de deuda (vigente, vencido, castigado)
     */
    function calculateDebtContribution(totalAmount, coefficients) {
        if (!coefficients || totalAmount <= 0) {
            return { 
                rawValue: totalAmount, 
                impact: 0, 
                applied: false,
                reason: totalAmount <= 0 ? 'No debt' : 'No coefficients'
            };
        }

        var threshold = coefficients.threshold || 0;
        var weight = coefficients.weight || 0;
        var maxImpact = coefficients.maxImpact || -1;

        // Solo aplicar si supera el threshold
        if (totalAmount <= threshold) {
            return { 
                rawValue: totalAmount, 
                impact: 0, 
                applied: false,
                reason: 'Below threshold: ' + threshold
            };
        }

        // Calcular impacto proporcional
        var excessAmount = totalAmount - threshold;
        var rawImpact = (excessAmount / 100000) * weight; // Normalizar por 100K
        
        // Aplicar límite máximo
        var finalImpact = Math.max(maxImpact, rawImpact);

        return {
            rawValue: totalAmount,
            threshold: threshold,
            excessAmount: excessAmount,
            weight: weight,
            rawImpact: rawImpact,
            impact: finalImpact,
            applied: true,
            cappedAtMax: rawImpact < maxImpact
        };
    }

    /**
     * Calcula contribución por cantidad de entidades
     */
    function calculateEntityCountContribution(entityCount, coefficients) {
        if (!coefficients || entityCount <= 0) {
            return { 
                rawValue: entityCount, 
                impact: 0, 
                applied: false 
            };
        }

        var threshold = coefficients.threshold || 0;
        var weight = coefficients.weight || 0;
        var maxImpact = coefficients.maxImpact || -1;

        if (entityCount <= threshold) {
            return { 
                rawValue: entityCount, 
                impact: 0, 
                applied: false,
                reason: 'Below threshold: ' + threshold
            };
        }

        var excessEntities = entityCount - threshold;
        var rawImpact = excessEntities * weight;
        var finalImpact = Math.max(maxImpact, rawImpact);

        return {
            rawValue: entityCount,
            threshold: threshold,
            excessEntities: excessEntities,
            weight: weight,
            rawImpact: rawImpact,
            impact: finalImpact,
            applied: true,
            cappedAtMax: rawImpact < maxImpact
        };
    }

    /**
     * Calcula contribución de la peor calificación
     */
    function calculateWorstRatingContribution(worstRating, ratingPenalties) {
        if (!ratingPenalties || !worstRating) {
            return { 
                rawValue: worstRating, 
                impact: 0, 
                applied: false 
            };
        }

        var penalty = ratingPenalties[worstRating] || 0;

        return {
            rawValue: worstRating,
            penalty: penalty,
            impact: penalty,
            applied: penalty !== 0
        };
    }

    /**
     * Calcula contribución por trending (comparación t0 vs t6)
     */
    function calculateTrendingContribution(data, trendingConfig) {
        if (!trendingConfig || !trendingConfig.enabled) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'Trending disabled'
            };
        }

        var t0Data = data.periodData.t0;
        var t6Data = data.periodData.t6;

        if (!t0Data || !t6Data || !t0Data.entities || !t6Data.entities) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'Insufficient historical data'
            };
        }

        // Calcular totales para ambos períodos
        var t0Total = calculatePeriodTotal(t0Data);
        var t6Total = calculatePeriodTotal(t6Data);

        if (t6Total === 0) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'No t6 data for comparison'
            };
        }

        // Calcular cambio porcentual
        var percentChange = (t0Total - t6Total) / t6Total;
        var threshold = trendingConfig.thresholdPercentage || 0.1;

        // Solo aplicar trending si el cambio es significativo
        if (Math.abs(percentChange) < threshold) {
            return {
                t0Total: t0Total,
                t6Total: t6Total,
                percentChange: percentChange,
                impact: 0,
                applied: false,
                reason: 'Change below threshold: ' + (threshold * 100) + '%'
            };
        }

        // Determinar si es mejora o empeoramiento
        var impact = 0;
        var trendType = '';

        if (percentChange < 0) { // Reducción de deuda = mejora
            impact = trendingConfig.improvementBonus || 0;
            trendType = 'improvement';
        } else { // Aumento de deuda = empeoramiento
            impact = trendingConfig.deteriorationPenalty || 0;
            trendType = 'deterioration';
        }

        return {
            t0Total: t0Total,
            t6Total: t6Total,
            percentChange: percentChange,
            trendType: trendType,
            impact: impact,
            applied: true
        };
    }

    /**
     * Calcula total de deudas para un período
     */
    function calculatePeriodTotal(periodData) {
        if (!periodData.entities || !Array.isArray(periodData.entities)) {
            return 0;
        }

        return periodData.entities.reduce(function(total, entity) {
            return total + (entity.vigente || 0) + (entity.vencido || 0) + (entity.castigado || 0);
        }, 0);
    }

    /**
     * Extrae total por tipo de deuda de los datos normalizados
     */
    function extractTotalByType(data, type) {
        var t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return 0;
        }

        return t0Data.entities.reduce(function(total, entity) {
            return total + (entity[type] || 0);
        }, 0);
    }

    /**
     * Extrae cantidad total de entidades
     */
    function extractEntityCount(data) {
        var t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return 0;
        }
        
        return t0Data.entities.length;
    }

    /**
     * Extrae la peor calificación de los metadatos
     */
    function extractWorstRating(data) {
        if (data.metadata && data.metadata.worstRating) {
            return data.metadata.worstRating;
        }

        // Fallback: buscar en entidades t0
        var t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return '0';
        }

        var ratingOrder = {
            '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
        };

        var worstRating = '0';
        var worstNumeric = 0;

        for (var i = 0; i < t0Data.entities.length; i++) {
            var rating = String(t0Data.entities[i].rating || '').toUpperCase();
            var numeric = ratingOrder[rating] || 0;
            if (numeric > worstNumeric) {
                worstNumeric = numeric;
                worstRating = rating;
            }
        }

        return worstRating;
    }

    /**
     * Aplica función logística para suavizar score
     */
    function applyLogisticFunction(score) {
        // Función logística: 1 / (1 + e^(-k*(x-0.5)))
        var k = 8; // Factor de suavizado
        var centered = score - 0.5;
        return 1 / (1 + Math.exp(-k * centered));
    }

    /**
     * Verifica si los datos son suficientes para scoring confiable
     */
    function hasValidScoringData(data) {
        if (!data.periodData || !data.periodData.t0) {
            return false;
        }

        var t0Data = data.periodData.t0;
        
        // Necesita al menos entidades O totales
        var hasEntities = t0Data.entities && Array.isArray(t0Data.entities) && t0Data.entities.length > 0;
        var hasTotals = t0Data.totals && Array.isArray(t0Data.totals) && t0Data.totals.length > 0;
        
        return hasEntities || hasTotals;
    }

    /**
     * Evalúa la calidad de los datos para scoring
     */
    function assessDataQuality(data) {
        var score = 0;
        var maxScore = 5;

        // +1 por tener datos básicos
        if (hasValidScoringData(data)) score++;

        // +1 por tener datos históricos (t6)
        if (data.periodData.t6 && data.periodData.t6.entities && 
            data.periodData.t6.entities.length > 0) score++;

        // +1 por tener calificaciones
        var hasRatings = data.periodData.t0.entities && 
            data.periodData.t0.entities.some(function(e) { return e.rating; });
        if (hasRatings) score++;

        // +1 por tener múltiples entidades (diversidad)
        if (extractEntityCount(data) > 1) score++;

        // +1 por consistencia de datos
        if (data.metadata && data.metadata.nome && !data.flags.isDeceased) score++;

        return {
            score: score,
            maxScore: maxScore,
            percentage: (score / maxScore) * 100,
            level: score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * Calcula nivel de confianza del score
     */
    function calculateConfidenceLevel(data, contributions) {
        var factors = [];

        // Factor 1: Calidad de datos
        var dataQuality = assessDataQuality(data);
        factors.push(dataQuality.percentage / 100);

        // Factor 2: Número de contribuciones aplicadas
        var appliedContributions = Object.keys(contributions).filter(function(key) {
            return contributions[key].applied;
        }).length;
        factors.push(Math.min(appliedContributions / 4, 1)); // Max 4 contribuciones principales

        // Factor 3: Diversidad de entidades
        var entityCount = extractEntityCount(data);
        factors.push(Math.min(entityCount / 5, 1)); // Max 5 entidades para confidence máximo

        // Promedio de factores
        var avgConfidence = factors.reduce(function(sum, f) { return sum + f; }, 0) / factors.length;

        return {
            level: avgConfidence >= 0.8 ? 'HIGH' : avgConfidence >= 0.5 ? 'MEDIUM' : 'LOW',
            score: Math.round(avgConfidence * 100),
            factors: {
                dataQuality: Math.round(factors[0] * 100),
                contributionDiversity: Math.round(factors[1] * 100),
                entityDiversity: Math.round(factors[2] * 100)
            }
        };
    }

    /**
     * OPTIMIZADO: Cálculo rápido de impacto de deuda
     */
    function calculateDebtImpactFast(totalAmount, coefficients) {
        if (!coefficients || totalAmount <= coefficients.threshold) {
            return 0;
        }
        var excess = totalAmount - coefficients.threshold;
        var rawImpact = (excess / 100000) * coefficients.weight;
        return Math.max(coefficients.maxImpact, rawImpact);
    }

    /**
     * OPTIMIZADO: Cálculo rápido de impacto por cantidad de entidades
     */
    function calculateEntityImpactFast(entityCount, coefficients) {
        if (!coefficients || entityCount <= coefficients.threshold) {
            return 0;
        }
        var excess = entityCount - coefficients.threshold;
        var rawImpact = excess * coefficients.weight;
        return Math.max(coefficients.maxImpact, rawImpact);
    }

    /**
     * OPTIMIZADO: Crear resultado de rechazo con mínima metadata
     */
    function createRejectedScore(reason, message) {
        return {
            finalScore: 0,
            rawScore: 0,
            baseScore: 0,
            contributions: {},
            metadata: {
                calculatedAt: new Date(),
                isRejected: true,
                rejectionReason: reason
            },
            flags: {},
            validation: { hasValidData: false }
        };
    }

    // Public API
    return {
        computeScore: computeScore,
        
        // Para testing y debugging
        _internal: {
            checkAutoRejection: checkAutoRejection,
            calculateDebtContribution: calculateDebtContribution,
            calculateEntityCountContribution: calculateEntityCountContribution,
            calculateWorstRatingContribution: calculateWorstRatingContribution,
            calculateTrendingContribution: calculateTrendingContribution,
            extractTotalByType: extractTotalByType,
            extractEntityCount: extractEntityCount,
            extractWorstRating: extractWorstRating,
            applyLogisticFunction: applyLogisticFunction,
            hasValidScoringData: hasValidScoringData,
            assessDataQuality: assessDataQuality,
            calculateConfidenceLevel: calculateConfidenceLevel,
            createRejectedScore: createRejectedScore
        }
    };
});

/**
 * @typedef {Object} ScoreResult
 * @property {number} finalScore - Score final (0-1)
 * @property {number} rawScore - Score antes de normalizar
 * @property {number} baseScore - Score base inicial
 * @property {Object} contributions - Desglose de contribuciones
 * @property {Object} metadata - Metadatos del cálculo
 * @property {Object} flags - Banderas de los datos
 * @property {Object} validation - Validación y calidad de datos
 */