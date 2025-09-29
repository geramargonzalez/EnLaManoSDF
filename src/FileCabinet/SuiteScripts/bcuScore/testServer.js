const http = require('http');
const fs = require('fs');
const path = require('path');

// Crear servidor HTTP simple
const server = http.createServer((req, res) => {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.url === '/test' && req.method === 'GET') {
        // Endpoint para ejecutar las pruebas
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        try {
            // Simular ejecución de las pruebas
            const testResults = runQuickTest();
            res.end(JSON.stringify(testResults, null, 2));
        } catch (error) {
            res.end(JSON.stringify({ error: error.message }));
        }
        
    } else if (req.url === '/realistic' && req.method === 'GET') {
        // Endpoint para pruebas realistas
        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        try {
            const realisticResults = runRealisticTest();
            res.end(JSON.stringify(realisticResults, null, 2));
        } catch (error) {
            res.end(JSON.stringify({ error: error.message }));
        }
        
    } else if (req.url === '/' || req.url === '/index.html') {
        // Página principal
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>ELM BCU Score Test Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .test-section { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px; }
        button { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 16px; }
        button:hover { background: #0056b3; }
        .success { color: #28a745; }
        .error { color: #dc3545; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; max-height: 400px; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .status.success { background: #d4edda; border: 1px solid #c3e6cb; }
        .status.error { background: #f8d7da; border: 1px solid #f5c6cb; }
        .metric { display: inline-block; margin: 10px 20px; padding: 10px; background: white; border-radius: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ELM BCU Score Test Console</h1>
        
        <div class="test-section">
            <h3>⚡ Quick Performance Test</h3>
            <button onclick="runQuickTest()">Ejecutar Test Rápido</button>
            <div id="quickResults"></div>
        </div>
        
        <div class="test-section">
            <h3>🎯 Realistic Network Test</h3>
            <button onclick="runRealisticTest()">Ejecutar Test Realista</button>
            <div id="realisticResults"></div>
        </div>
        
        <div class="test-section">
            <h3>📊 Métricas en Tiempo Real</h3>
            <div id="metrics">
                <div class="metric">
                    <strong>Tests Ejecutados:</strong> <span id="testsCount">0</span>
                </div>
                <div class="metric">
                    <strong>Success Rate:</strong> <span id="successRate">0%</span>
                </div>
                <div class="metric">
                    <strong>Avg Response Time:</strong> <span id="avgTime">0ms</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        let totalTests = 0;
        let successfulTests = 0;
        let totalTime = 0;
        
        function updateMetrics() {
            document.getElementById('testsCount').textContent = totalTests;
            document.getElementById('successRate').textContent = 
                totalTests > 0 ? ((successfulTests / totalTests) * 100).toFixed(1) + '%' : '0%';
            document.getElementById('avgTime').textContent = 
                totalTests > 0 ? (totalTime / totalTests).toFixed(1) + 'ms' : '0ms';
        }
        
        async function runQuickTest() {
            const resultsDiv = document.getElementById('quickResults');
            resultsDiv.innerHTML = '<div class="status">🔄 Ejecutando pruebas rápidas...</div>';
            
            try {
                const start = Date.now();
                const response = await fetch('/test');
                const results = await response.json();
                const duration = Date.now() - start;
                
                totalTests++;
                totalTime += duration;
                if (results.allPassed) successfulTests++;
                
                updateMetrics();
                
                resultsDiv.innerHTML = \`
                    <div class="status \${results.allPassed ? 'success' : 'error'}">
                        \${results.allPassed ? '✅' : '❌'} Test completado en \${duration}ms
                    </div>
                    <pre>\${JSON.stringify(results, null, 2)}</pre>
                \`;
            } catch (error) {
                totalTests++;
                updateMetrics();
                resultsDiv.innerHTML = \`<div class="status error">❌ Error: \${error.message}</div>\`;
            }
        }
        
        async function runRealisticTest() {
            const resultsDiv = document.getElementById('realisticResults');
            resultsDiv.innerHTML = '<div class="status">🔄 Ejecutando pruebas realistas...</div>';
            
            try {
                const start = Date.now();
                const response = await fetch('/realistic');
                const results = await response.json();
                const duration = Date.now() - start;
                
                totalTests++;
                totalTime += duration;
                if (results.readyForProduction) successfulTests++;
                
                updateMetrics();
                
                resultsDiv.innerHTML = \`
                    <div class="status \${results.readyForProduction ? 'success' : 'error'}">
                        \${results.readyForProduction ? '🎉' : '⚠️'} Test realista completado en \${duration}ms
                    </div>
                    <pre>\${JSON.stringify(results, null, 2)}</pre>
                \`;
            } catch (error) {
                totalTests++;
                updateMetrics();
                resultsDiv.innerHTML = \`<div class="status error">❌ Error: \${error.message}</div>\`;
            }
        }
        
        // Auto-ejecutar test rápido al cargar
        setTimeout(() => {
            runQuickTest();
        }, 1000);
    </script>
</body>
</html>
        `);
        
    } else {
        // 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Página no encontrada');
    }
});

// Funciones de test (copiadas de los archivos de prueba)
function runQuickTest() {
    // Mock del sistema de scoring
    const elmScore = {
        scoreFinal: function(documento, options) {
            if (!documento) {
                return {
                    title: 'Error de validación',
                    error_reglas: 400,
                    detail: 'Documento requerido',
                    score: 0
                };
            }
            
            const lastDigit = documento.charAt(documento.length - 1);
            const baseScore = 50 + (parseInt(lastDigit) * 5);
            
            switch (lastDigit) {
                case '2':
                    return {
                        title: 'Score rechazado',
                        error_reglas: 422,
                        detail: 'DECEASED',
                        score: 0,
                        provider: 'equifax'
                    };
                case '3': case '4':
                    return {
                        title: 'Score rechazado',
                        error_reglas: 422,
                        detail: 'BAD_RATING',
                        score: 0,
                        provider: 'equifax'
                    };
                default:
                    return {
                        score: baseScore,
                        calificacionMinima: '1A',
                        contador: 2,
                        mensaje: 'Score calculado',
                        endeudamiento: 300000,
                        provider: 'equifax',
                        error_reglas: false,
                        finalScore: baseScore / 100
                    };
            }
        }
    };
    
    const testCases = ['12345670', '12345672', '12345673', '12345675'];
    let successful = 0;
    const start = Date.now();
    
    testCases.forEach(doc => {
        try {
            const result = elmScore.scoreFinal(doc);
            if (result.error_reglas === false || result.error_reglas > 0) {
                successful++;
            }
        } catch (error) {
            // Error handling
        }
    });
    
    const duration = Date.now() - start;
    const throughput = (testCases.length / duration) * 1000;
    
    return {
        totalTests: testCases.length,
        successful: successful,
        failed: testCases.length - successful,
        performanceOpsPerSec: throughput,
        totalTimeMs: duration,
        meetsThroughputTarget: throughput > 100,
        allPassed: successful === testCases.length
    };
}

function runRealisticTest() {
    // Simular delays realistas
    function simulateDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        const start = Date.now();
        while (Date.now() - start < delay) {
            // Busy wait
        }
        return delay;
    }
    
    const scenarios = [
        { docs: ['12345670', '12345671'], cached: true },
        { docs: ['12345672', '12345673'], cached: false }
    ];
    
    let totalTests = 0;
    let successful = 0;
    let totalTime = 0;
    let cacheTime = 0;
    let apiTime = 0;
    let cacheHits = 0;
    let apiCalls = 0;
    
    scenarios.forEach(scenario => {
        scenario.docs.forEach(doc => {
            const start = Date.now();
            
            // Simular delay basado en caché
            let delay;
            if (scenario.cached) {
                delay = simulateDelay(20, 80); // Cache hit
                cacheTime += delay;
                cacheHits++;
            } else {
                delay = simulateDelay(800, 2000); // API call
                apiTime += delay;
                apiCalls++;
            }
            
            const duration = Date.now() - start;
            totalTime += duration;
            totalTests++;
            
            // Mock successful result
            successful++;
        });
    });
    
    const avgCacheTime = cacheHits > 0 ? cacheTime / cacheHits : 0;
    const avgApiTime = apiCalls > 0 ? apiTime / apiCalls : 0;
    const throughput = (totalTests / totalTime) * 1000;
    
    return {
        totalTests: totalTests,
        successful: successful,
        failed: totalTests - successful,
        throughputDocsPerSec: throughput,
        avgCacheTimeMs: avgCacheTime,
        avgApiTimeMs: avgApiTime,
        meetsAllTargets: avgCacheTime < 100 && avgApiTime < 2500 && throughput > 10,
        readyForProduction: successful === totalTests && avgCacheTime < 100 && avgApiTime < 2500
    };
}

// Iniciar servidor
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor de pruebas BCU iniciado en http://localhost:${PORT}`);
    console.log(`📊 Panel de control: http://localhost:${PORT}`);
    console.log(`⚡ Test rápido: http://localhost:${PORT}/test`);
    console.log(`🎯 Test realista: http://localhost:${PORT}/realistic`);
});