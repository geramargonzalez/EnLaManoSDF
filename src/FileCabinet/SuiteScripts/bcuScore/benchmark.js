/**
 * @NApiVersion 2.1
 * @description Benchmark de performance para scoring BCU
 */

define(['./equifaxSamples', './bcuSamples', '../domain/normalize', '../domain/score'], 
function (equifaxSamples, bcuSamples, normalize, score) {
    'use strict';

    /**
     * Ejecuta benchmark completo del sistema de scoring
     */
    function runFullBenchmark() {
        var results = {
            timestamp: new Date().toISOString(),
            environment: 'SuiteScript 2.1',
            tests: {}
        };

        // Test 1: Normalización Equifax
        results.tests.equifaxNormalization = benchmarkEquifaxNormalization();
        
        // Test 2: Normalización BCU  
        results.tests.bcuNormalization = benchmarkBcuNormalization();
        
        // Test 3: Scoring puro (sin I/O)
        results.tests.pureScoring = benchmarkPureScoring();
        
        // Test 4: Scoring con diferentes volúmenes de datos
        results.tests.scalingScoring = benchmarkScalingScoring();

        // Calcular totales
        results.summary = calculateSummary(results.tests);

        return results;
    }

    /**
     * Benchmark normalización de respuestas Equifax
     */
    function benchmarkEquifaxNormalization() {
        var iterations = 1000;
        var samples = [
            equifaxSamples.EQUIFAX_NORMAL_RESPONSE,
            equifaxSamples.EQUIFAX_DECEASED_RESPONSE,
            equifaxSamples.EQUIFAX_BAD_RATING_RESPONSE
        ];

        var startTime = Date.now();
        
        for (var i = 0; i < iterations; i++) {
            var sampleIndex = i % samples.length;
            normalize.normalizeEquifaxResponse(samples[sampleIndex]);
        }
        
        var endTime = Date.now();
        var totalTime = endTime - startTime;
        
        return {
            iterations: iterations,
            totalTimeMs: totalTime,
            avgTimeMs: totalTime / iterations,
            opsPerSecond: (iterations / totalTime) * 1000,
            description: 'Normalización respuestas Equifax'
        };
    }

    /**
     * Benchmark normalización de respuestas BCU
     */
    function benchmarkBcuNormalization() {
        var iterations = 1000;
        var samples = [
            bcuSamples.BCU_NORMAL_RESPONSE,
            bcuSamples.BCU_DECEASED_RESPONSE,
            bcuSamples.BCU_BAD_RATING_RESPONSE
        ];

        var startTime = Date.now();
        
        for (var i = 0; i < iterations; i++) {
            var sampleIndex = i % samples.length;
            normalize.normalizeBcuResponse(samples[sampleIndex]);
        }
        
        var endTime = Date.now();
        var totalTime = endTime - startTime;
        
        return {
            iterations: iterations,
            totalTimeMs: totalTime,
            avgTimeMs: totalTime / iterations,
            opsPerSecond: (iterations / totalTime) * 1000,
            description: 'Normalización respuestas BCU'
        };
    }

    /**
     * Benchmark del scoring puro (sin I/O)
     */
    function benchmarkPureScoring() {
        var iterations = 10000; // Más iteraciones para función pura
        
        // Datos normalizados de muestra
        var normalizedData = normalize.normalizeEquifaxResponse(equifaxSamples.EQUIFAX_NORMAL_RESPONSE);
        
        // Reglas de scoring mock
        var scoringRules = {
            coefficients: {
                vigente: { weight: -0.05, threshold: 100000 },
                vencido: { weight: -0.15, threshold: 10000 },
                castigado: { weight: -0.25, threshold: 5000 },
                entityCount: { weight: -0.08, threshold: 3 },
                worstRating: { '1A': 0, '1C': -0.1, '2A': -0.2, '2B': -0.4, '3': -0.6, '4': -0.8, '5': -1.0 }
            },
            baseScore: 0.7,
            rejectionRules: {
                isDeceased: true,
                badRatings: ['2B', '3', '4', '5']
            }
        };

        var startTime = Date.now();
        
        for (var i = 0; i < iterations; i++) {
            score.computeScore(normalizedData, scoringRules);
        }
        
        var endTime = Date.now();
        var totalTime = endTime - startTime;
        
        return {
            iterations: iterations,
            totalTimeMs: totalTime,
            avgTimeMs: totalTime / iterations,
            opsPerSecond: (iterations / totalTime) * 1000,
            description: 'Scoring puro (O(n) sin I/O)',
            complexity: 'O(n) donde n = número de entidades'
        };
    }

    /**
     * Benchmark escalabilidad con diferentes volúmenes
     */
    function benchmarkScalingScoring() {
        var results = [];
        var entityCounts = [1, 5, 10, 25, 50, 100]; // Diferentes volúmenes
        var iterationsPerTest = 1000;

        for (var i = 0; i < entityCounts.length; i++) {
            var entityCount = entityCounts[i];
            var testData = generateScalingTestData(entityCount);
            
            var scoringRules = {
                coefficients: {
                    vigente: { weight: -0.05, threshold: 100000 },
                    vencido: { weight: -0.15, threshold: 10000 },
                    castigado: { weight: -0.25, threshold: 5000 },
                    entityCount: { weight: -0.08, threshold: 3 }
                },
                baseScore: 0.7
            };

            var startTime = Date.now();
            
            for (var j = 0; j < iterationsPerTest; j++) {
                score.computeScore(testData, scoringRules);
            }
            
            var endTime = Date.now();
            var totalTime = endTime - startTime;
            
            results.push({
                entityCount: entityCount,
                iterations: iterationsPerTest,
                totalTimeMs: totalTime,
                avgTimeMs: totalTime / iterationsPerTest,
                opsPerSecond: (iterationsPerTest / totalTime) * 1000
            });
        }

        return {
            description: 'Escalabilidad scoring O(n)',
            results: results,
            verified: verifyLinearComplexity(results)
        };
    }

    /**
     * Genera datos de prueba con N entidades
     */
    function generateScalingTestData(entityCount) {
        var entities = [];
        
        for (var i = 0; i < entityCount; i++) {
            entities.push({
                entidad: 'BANK_' + i,
                rating: i % 2 === 0 ? '1A' : '2A',
                vigente: Math.random() * 500000,
                vencido: Math.random() * 50000,
                castigado: Math.random() * 20000,
                rubros: [
                    {
                        rubro: 'PRESTAMOS',
                        vigente: Math.random() * 300000,
                        vencido: Math.random() * 30000,
                        castigado: Math.random() * 10000
                    }
                ]
            });
        }

        return {
            provider: 'equifax',
            documento: '12345678',
            periodData: {
                t0: {
                    totals: [
                        {
                            rubro: 'TOTAL',
                            vigente: entities.reduce(function(sum, e) { return sum + e.vigente; }, 0),
                            vencido: entities.reduce(function(sum, e) { return sum + e.vencido; }, 0),
                            castigado: entities.reduce(function(sum, e) { return sum + e.castigado; }, 0)
                        }
                    ],
                    entities: entities
                },
                t6: {
                    totals: [],
                    entities: []
                }
            },
            flags: {
                isDeceased: false,
                hasRejectableRating: false
            }
        };
    }

    /**
     * Verifica que la complejidad sea efectivamente O(n)
     */
    function verifyLinearComplexity(results) {
        if (results.length < 3) return false;

        // Calcular ratio entre tiempo y número de entidades
        var ratios = [];
        for (var i = 1; i < results.length; i++) {
            var prev = results[i - 1];
            var curr = results[i];
            
            var timeRatio = curr.avgTimeMs / prev.avgTimeMs;
            var entityRatio = curr.entityCount / prev.entityCount;
            
            ratios.push(timeRatio / entityRatio);
        }

        // Para complejidad O(n), los ratios deberían estar cerca de 1
        var avgRatio = ratios.reduce(function(sum, r) { return sum + r; }, 0) / ratios.length;
        
        // Permitir variación del 50% (considerando optimizaciones JS engine)
        return avgRatio >= 0.5 && avgRatio <= 2.0;
    }

    /**
     * Calcula resumen de resultados
     */
    function calculateSummary(tests) {
        var summary = {
            totalTests: Object.keys(tests).length,
            performance: {
                fastest: null,
                slowest: null
            },
            recommendations: []
        };

        var allOpsPerSecond = [];
        
        Object.keys(tests).forEach(function(testName) {
            var test = tests[testName];
            if (test.opsPerSecond) {
                allOpsPerSecond.push({
                    name: testName,
                    ops: test.opsPerSecond,
                    description: test.description
                });
            }
        });

        if (allOpsPerSecond.length > 0) {
            allOpsPerSecond.sort(function(a, b) { return b.ops - a.ops; });
            summary.performance.fastest = allOpsPerSecond[0];
            summary.performance.slowest = allOpsPerSecond[allOpsPerSecond.length - 1];
        }

        // Generar recomendaciones
        if (tests.pureScoring && tests.pureScoring.opsPerSecond > 1000) {
            summary.recommendations.push('✅ Scoring puro cumple objetivo >1000 ops/seg');
        } else {
            summary.recommendations.push('⚠️ Scoring puro necesita optimización');
        }

        if (tests.scalingScoring && tests.scalingScoring.verified) {
            summary.recommendations.push('✅ Complejidad O(n) verificada');
        } else {
            summary.recommendations.push('⚠️ Revisar complejidad algorítmica');
        }

        return summary;
    }

    /**
     * Ejecuta benchmark rápido para testing
     */
    function quickBenchmark() {
        var normalizedData = normalize.normalizeEquifaxResponse(equifaxSamples.EQUIFAX_NORMAL_RESPONSE);
        
        var scoringRules = {
            coefficients: {
                vigente: { weight: -0.05, threshold: 100000 },
                vencido: { weight: -0.15, threshold: 10000 },
                castigado: { weight: -0.25, threshold: 5000 }
            },
            baseScore: 0.7
        };

        var iterations = 100;
        var startTime = Date.now();
        
        for (var i = 0; i < iterations; i++) {
            score.computeScore(normalizedData, scoringRules);
        }
        
        var endTime = Date.now();
        var totalTime = endTime - startTime;
        
        return {
            iterations: iterations,
            totalTimeMs: totalTime,
            avgTimeMs: totalTime / iterations,
            opsPerSecond: (iterations / totalTime) * 1000,
            result: 'Quick benchmark completed'
        };
    }

    // Public API
    return {
        runFullBenchmark: runFullBenchmark,
        quickBenchmark: quickBenchmark,
        benchmarkPureScoring: benchmarkPureScoring,
        benchmarkEquifaxNormalization: benchmarkEquifaxNormalization,
        benchmarkBcuNormalization: benchmarkBcuNormalization,
        benchmarkScalingScoring: benchmarkScalingScoring
    };
});