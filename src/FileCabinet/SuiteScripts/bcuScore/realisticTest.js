/**
 * SIMULACIÓN REALISTA - Con delays de red y procesamiento
 * Para probar en condiciones más parecidas a NetSuite
 */

// Función para simular delay de red/procesamiento
function simulateNetworkDelay(minMs, maxMs) {
    var delay = Math.random() * (maxMs - minMs) + minMs;
    var start = Date.now();
    while (Date.now() - start < delay) {
        // Busy wait para simular procesamiento
    }
    return delay;
}

// Mock más realista con delays
function createRealisticMockELMScore() {
    return {
        scoreFinal: function(documento, options) {
            var startTime = Date.now();
            
            if (!documento) {
                return {
                    title: 'Error de validación',
                    error_reglas: 400,
                    detail: 'Documento requerido',
                    score: 0,
                    processingTime: Date.now() - startTime
                };
            }
            
            // Simular validación rápida (1-3ms)
            simulateNetworkDelay(1, 3);
            
            var lastDigit = documento.charAt(documento.length - 1);
            
            // Simular diferentes escenarios de tiempo
            var fromCache = options && options.forceRefresh === false;
            var networkDelay = 0;
            
            if (fromCache) {
                // Cache hit: 10-50ms (NetSuite cache lookup)
                networkDelay = simulateNetworkDelay(10, 50);
            } else {
                // Cache miss: API call simulation
                switch (lastDigit) {
                    case '2': // Fallecido - respuesta rápida
                        networkDelay = simulateNetworkDelay(800, 1200);
                        break;
                    case '9': // Error de API - timeout parcial
                        networkDelay = simulateNetworkDelay(3000, 5000);
                        break;
                    default: // Respuesta normal de Equifax
                        networkDelay = simulateNetworkDelay(1500, 2500);
                }
            }
            
            // Simular scoring computation (siempre rápido)
            var scoringTime = simulateNetworkDelay(2, 8);
            
            var totalTime = Date.now() - startTime;
            
            // Crear respuesta basada en último dígito
            switch (lastDigit) {
                case '2':
                    return {
                        title: 'Score rechazado',
                        error_reglas: 422,
                        detail: 'DECEASED',
                        score: 0,
                        provider: 'equifax',
                        flags: { isDeceased: true },
                        metadata: { 
                            fromCache: fromCache,
                            networkDelay: networkDelay,
                            scoringTime: scoringTime,
                            totalTime: totalTime
                        }
                    };
                    
                case '3': case '4':
                    return {
                        title: 'Score rechazado', 
                        error_reglas: 422,
                        detail: 'BAD_RATING',
                        score: 0,
                        provider: 'equifax',
                        flags: { hasRejectableRating: true },
                        metadata: { 
                            fromCache: fromCache,
                            networkDelay: networkDelay,
                            scoringTime: scoringTime,
                            totalTime: totalTime
                        }
                    };
                    
                case '9':
                    return {
                        title: 'Error de servicio',
                        error_reglas: 500,
                        detail: 'Timeout Equifax',
                        score: 0,
                        provider: 'equifax',
                        metadata: { 
                            networkDelay: networkDelay,
                            totalTime: totalTime,
                            error: 'API_TIMEOUT'
                        }
                    };
                    
                default:
                    var baseScore = 50 + (parseInt(lastDigit) * 5);
                    return {
                        score: baseScore,
                        calificacionMinima: lastDigit === '0' || lastDigit === '1' ? '1A' : '2A',
                        contador: parseInt(lastDigit) % 3 + 1,
                        mensaje: 'Score calculado exitosamente',
                        endeudamiento: parseInt(lastDigit) * 50000 + 200000,
                        provider: 'equifax',
                        flags: { isDeceased: false, hasRejectableRating: false },
                        breakdown: {
                            vigente: { rawValue: parseInt(lastDigit) * 30000, impact: -0.02 },
                            vencido: { rawValue: parseInt(lastDigit) * 5000, impact: -0.01 },
                            castigado: { rawValue: 0, impact: 0 }
                        },
                        metadata: {
                            fromCache: fromCache,
                            networkDelay: networkDelay,
                            scoringTime: scoringTime,
                            totalTime: totalTime,
                            provider: 'equifax'
                        },
                        error_reglas: false,
                        finalScore: baseScore / 100
                    };
            }
        }
    };
}

// EJECUTAR PRUEBAS REALISTAS
function runRealisticTests() {
    console.log('🎯 PRUEBAS REALISTAS ELM BCU SCORE\n');
    console.log('Simulando condiciones de NetSuite con delays de red...\n');
    
    var elmScore = createRealisticMockELMScore();
    var overallStart = Date.now();
    
    // Escenarios realistas
    var scenarios = [
        { 
            name: 'CACHE HIT SCENARIO',
            docs: ['46175108', '46175108', '12345671', '12345670'], // Repite 46175108 para cache
            options: { forceRefresh: false }
        },
        {
            name: 'FRESH API CALLS', 
            docs: ['46175108', '12345673', '12345675', '12345677'],
            options: { forceRefresh: true }
        },
        {
            name: 'ERROR HANDLING',
            docs: ['46175108', '12345679', '', null, 'ABC123'],
            options: { debug: true }
        }
    ];
    
    var allResults = [];
    
    for (var s = 0; s < scenarios.length; s++) {
        var scenario = scenarios[s];
        console.log(`📋 ${scenario.name}:\n`);
        
        var scenarioStart = Date.now();
        var scenarioResults = [];
        
        for (var i = 0; i < scenario.docs.length; i++) {
            var doc = scenario.docs[i];
            var testStart = Date.now();
            
            try {
                var result = elmScore.scoreFinal(doc, scenario.options);
                var testTime = Date.now() - testStart;
                
                scenarioResults.push({
                    documento: doc || 'null',
                    success: true,
                    score: result.score,
                    rejected: result.error_reglas !== false,
                    totalTime: testTime,
                    networkTime: result.metadata && result.metadata.networkDelay,
                    scoringTime: result.metadata && result.metadata.scoringTime,
                    fromCache: result.metadata && result.metadata.fromCache
                });
                
                console.log(`  ✓ Doc: ${doc || 'null'}`);
                console.log(`    Score: ${result.score} | Rechazado: ${result.error_reglas !== false}`);
                console.log(`    Tiempo total: ${testTime}ms`);
                if (result.metadata) {
                    if (result.metadata.fromCache !== undefined) {
                        console.log(`    Cache: ${result.metadata.fromCache ? 'HIT' : 'MISS'}`);
                    }
                    if (result.metadata.networkDelay) {
                        console.log(`    Red: ${result.metadata.networkDelay.toFixed(0)}ms | Scoring: ${result.metadata.scoringTime.toFixed(0)}ms`);
                    }
                }
                console.log('');
                
            } catch (error) {
                scenarioResults.push({
                    documento: doc || 'null',
                    success: false,
                    error: error.toString(),
                    totalTime: Date.now() - testStart
                });
                
                console.log(`  ❌ Doc: ${doc || 'null'} - ERROR: ${error.message}\n`);
            }
        }
        
        var scenarioTime = Date.now() - scenarioStart;
        var avgTime = scenarioTime / scenario.docs.length;
        
        console.log(`  📊 Escenario completado en ${scenarioTime}ms`);
        console.log(`  ⏱️ Tiempo promedio: ${avgTime.toFixed(1)}ms\n`);
        
        allResults = allResults.concat(scenarioResults);
    }
    
    // Análisis de throughput realista
    console.log('🚀 ANÁLISIS DE THROUGHPUT:\n');
    
    var throughputTest = [];
    var batchSize = 20;
    
    console.log(`Procesando lote de ${batchSize} documentos...`);
    var batchStart = Date.now();
    
    for (var i = 0; i < batchSize; i++) {
        var testDoc;
        if (i === 0 || i === 10 || i === 15) {
            // Usar documento específico en algunas posiciones
            testDoc = '46175108';
        } else {
            testDoc = '1234567' + (i % 10);
        }
        var isCached = i > 10; // Algunos con caché, otros sin caché
        
        var result = elmScore.scoreFinal(testDoc, { forceRefresh: !isCached });
        throughputTest.push({
            doc: testDoc,
            time: result.metadata ? result.metadata.totalTime : 0,
            cached: isCached
        });
    }
    
    var batchTime = Date.now() - batchStart;
    var throughput = (batchSize / batchTime) * 1000;
    
    console.log(`📊 Lote procesado en ${batchTime}ms`);
    console.log(`🎯 Throughput realista: ${throughput.toFixed(1)} docs/seg`);
    console.log('');
    
    // Análisis por tipo de operación
    var cacheHits = throughputTest.filter(t => t.cached).length;
    var cacheMisses = throughputTest.filter(t => !t.cached).length;
    
    if (cacheHits > 0) {
        var avgCacheTime = throughputTest
            .filter(t => t.cached)
            .reduce((sum, t) => sum + t.time, 0) / cacheHits;
        console.log(`💾 Cache hits (${cacheHits}): ${avgCacheTime.toFixed(1)}ms promedio`);
    }
    
    if (cacheMisses > 0) {
        var avgApiTime = throughputTest
            .filter(t => !t.cached)
            .reduce((sum, t) => sum + t.time, 0) / cacheMisses;
        console.log(`🌐 API calls (${cacheMisses}): ${avgApiTime.toFixed(1)}ms promedio`);
    }
    
    // Resumen final realista
    var totalTime = Date.now() - overallStart;
    var successfulTests = allResults.filter(r => r.success).length;
    var failedTests = allResults.filter(r => !r.success).length;
    
    console.log('\n📋 RESUMEN REALISTA:\n');
    console.log(`✅ Tests exitosos: ${successfulTests}`);
    console.log(`❌ Tests fallidos: ${failedTests}`);
    console.log(`📊 Tasa de éxito: ${(successfulTests / allResults.length * 100).toFixed(1)}%`);
    console.log(`⏱️ Tiempo total de pruebas: ${totalTime}ms`);
    console.log(`🎯 Throughput realista: ${throughput.toFixed(1)} docs/seg`);
    console.log('');
    
    // Evaluación de targets
    var cacheTarget = avgCacheTime < 100; // <100ms para cache hits
    var apiTarget = avgApiTime < 2500; // <2.5s para API calls
    var throughputTarget = throughput > 10; // >10 docs/seg realista
    
    console.log('🎯 EVALUACIÓN DE TARGETS:\n');
    console.log(`Cache hits <100ms: ${cacheTarget ? '✅ CUMPLIDO' : '❌ NO CUMPLIDO'} (${avgCacheTime.toFixed(1)}ms)`);
    console.log(`API calls <2500ms: ${apiTarget ? '✅ CUMPLIDO' : '❌ NO CUMPLIDO'} (${avgApiTime.toFixed(1)}ms)`);
    console.log(`Throughput >10 docs/seg: ${throughputTarget ? '✅ CUMPLIDO' : '❌ NO CUMPLIDO'} (${throughput.toFixed(1)})`);
    
    if (cacheTarget && apiTarget && throughputTarget && successfulTests === allResults.length) {
        console.log('\n🎉 SISTEMA OPTIMIZADO LISTO PARA PRODUCCIÓN');
        console.log('📈 Cumple todos los targets de performance');
    } else {
        console.log('\n⚠️ REVISAR PERFORMANCE ANTES DE PRODUCCIÓN');
    }
    
    return {
        totalTests: allResults.length,
        successful: successfulTests,
        failed: failedTests,
        throughputDocsPerSec: throughput,
        avgCacheTimeMs: avgCacheTime,
        avgApiTimeMs: avgApiTime,
        meetsAllTargets: cacheTarget && apiTarget && throughputTarget,
        readyForProduction: successfulTests === allResults.length && cacheTarget && apiTarget && throughputTarget
    };
}

// EJECUTAR
console.log('Ejecutando pruebas realistas...\n');
var realisticResults = runRealisticTests();

console.log('\n🔧 RESULTADO FINAL ESTRUCTURADO:');
console.log(JSON.stringify(realisticResults, null, 2));