/**
 * TEST REAL - Equifax IC GCP REPORTE API
 * Usa credenciales reales UAT para testing
 */

// Configuración REAL de Equifax (UAT)
const EQUIFAX_CONFIG = {
    tokenUrl: 'https://api.uat.latam.equifax.com/v2/oauth/token',
    apiUrl: 'https://api.uat.latam.equifax.com/business/interconnect/v1/decision-orchestrations',
    
    // NOTA: Reemplazar con tus credenciales reales
    clientId: 'TU_CLIENT_ID_AQUI',
    clientSecret: 'TU_CLIENT_SECRET_AQUI',
    
    scope: 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations',
    grantType: 'client_credentials'
};

// Simulación de N/https para Node.js (en NetSuite sería el módulo real)
const https = require('https');
const querystring = require('querystring');

// Cache de token (como en NetSuite)
let tokenCache = null;
let tokenExpiry = null;

/**
 * Obtener token OAuth real de Equifax
 */
async function getEquifaxToken() {
    const now = Date.now();
    
    // Verificar cache
    if (tokenCache && tokenExpiry && now < tokenExpiry) {
        console.log('✅ Token desde cache');
        return tokenCache;
    }
    
    console.log('🔄 Obteniendo nuevo token de Equifax...');
    
    const tokenPayload = querystring.stringify({
        grant_type: EQUIFAX_CONFIG.grantType,
        scope: EQUIFAX_CONFIG.scope
    });
    
    const authHeader = Buffer.from(`${EQUIFAX_CONFIG.clientId}:${EQUIFAX_CONFIG.clientSecret}`).toString('base64');
    
    try {
        const tokenResponse = await makeHttpRequest({
            hostname: 'api.uat.latam.equifax.com',
            path: '/v2/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authHeader}`,
                'Content-Length': Buffer.byteLength(tokenPayload)
            }
        }, tokenPayload);
        
        const tokenData = JSON.parse(tokenResponse);
        
        // Cache con buffer de 5 minutos
        tokenCache = tokenData.access_token;
        const expiresIn = parseInt(tokenData.expires_in) || 3600;
        tokenExpiry = now + ((expiresIn - 300) * 1000);
        
        console.log(`✅ Token obtenido, expira en ${expiresIn}s`);
        return tokenCache;
        
    } catch (error) {
        console.error('❌ Error obteniendo token:', error.message);
        throw error;
    }
}

/**
 * Consulta REAL a Equifax IC GCP REPORTE
 */
async function consultarEquifaxReal(documento) {
    console.log(`\n🌐 CONSULTA REAL EQUIFAX: ${documento}`);
    const startTime = Date.now();
    
    try {
        // 1. Obtener token
        const accessToken = await getEquifaxToken();
        
        // 2. Preparar payload de consulta
        const consultaPayload = JSON.stringify({
            // Estructura básica - ajustar según docs de Equifax
            cedula: documento,
            tipoConsulta: 'IC_GCP_REPORTE',
            periodo: ['t0', 't6'] // Período actual y 6 meses atrás
        });
        
        console.log(`📤 Enviando consulta para ${documento}...`);
        
        // 3. Hacer request a la API
        const apiResponse = await makeHttpRequest({
            hostname: 'api.uat.latam.equifax.com',
            path: '/business/interconnect/v1/decision-orchestrations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Content-Length': Buffer.byteLength(consultaPayload)
            },
            timeout: 15000 // 15s timeout agresivo
        }, consultaPayload);
        
        const responseTime = Date.now() - startTime;
        const responseData = JSON.parse(apiResponse);
        
        console.log(`✅ Respuesta recibida en ${responseTime}ms`);
        console.log(`📊 Status: ${responseData.status || 'N/A'}`);
        
        return {
            success: true,
            data: responseData,
            responseTime: responseTime,
            documento: documento,
            provider: 'equifax_real'
        };
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.log(`❌ Error en consulta (${responseTime}ms): ${error.message}`);
        
        return {
            success: false,
            error: error.message,
            responseTime: responseTime,
            documento: documento,
            provider: 'equifax_real'
        };
    }
}

/**
 * Helper para hacer requests HTTP (simula N/https de NetSuite)
 */
function makeHttpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (options.timeout) {
            req.setTimeout(options.timeout);
        }
        
        if (postData) {
            req.write(postData);
        }
        
        req.end();
    });
}

/**
 * EJECUTAR PRUEBAS REALES
 */
async function runRealEquifaxTests() {
    console.log('🚀 INICIANDO PRUEBAS REALES CON EQUIFAX API\n');
    console.log('🔗 Endpoint:', EQUIFAX_CONFIG.apiUrl);
    console.log('🎯 Scope:', EQUIFAX_CONFIG.scope);
    
    // Documentos de prueba
    const testDocuments = [
        '46175108',  // Tu documento específico
        '12345678',  // Documento genérico
        '11111111'   // Otro test
    ];
    
    const results = [];
    let totalTime = 0;
    let successCount = 0;
    
    console.log(`\n📋 PROBANDO ${testDocuments.length} DOCUMENTOS:\n`);
    
    for (const doc of testDocuments) {
        const result = await consultarEquifaxReal(doc);
        results.push(result);
        totalTime += result.responseTime;
        
        if (result.success) {
            successCount++;
        }
        
        // Pausa entre requests para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // === MÉTRICAS FINALES ===
    const avgResponseTime = totalTime / testDocuments.length;
    const successRate = (successCount / testDocuments.length) * 100;
    const throughput = (testDocuments.length / totalTime) * 1000;
    
    console.log('\n=== 📊 RESULTADOS REALES EQUIFAX ===');
    console.log(`✅ Consultas exitosas: ${successCount}/${testDocuments.length} (${successRate.toFixed(1)}%)`);
    console.log(`⏱️  Tiempo promedio: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`🚀 Throughput: ${throughput.toFixed(2)} docs/seg`);
    console.log(`📊 Tiempo total: ${totalTime}ms`);
    
    // Validación de targets
    console.log('\n=== 🎯 VALIDACIÓN DE TARGETS ===');
    const responseTarget = avgResponseTime < 2500;
    const successTarget = successRate >= 90;
    
    console.log(`⚡ Respuesta < 2.5s: ${avgResponseTime.toFixed(1)}ms ${responseTarget ? '✅' : '❌'}`);
    console.log(`🎯 Success rate > 90%: ${successRate.toFixed(1)}% ${successTarget ? '✅' : '❌'}`);
    
    if (responseTarget && successTarget) {
        console.log('\n🎉 API EQUIFAX FUNCIONANDO CORRECTAMENTE');
    } else {
        console.log('\n⚠️  REVISAR CONFIGURACIÓN O CREDENCIALES');
    }
    
    // Mostrar resultados detallados
    console.log('\n=== 📝 DETALLE DE RESPUESTAS ===');
    results.forEach((result, index) => {
        console.log(`\n${index + 1}. Documento: ${result.documento}`);
        console.log(`   Estado: ${result.success ? '✅ Éxito' : '❌ Error'}`);
        console.log(`   Tiempo: ${result.responseTime}ms`);
        
        if (result.success && result.data) {
            console.log(`   Data: ${JSON.stringify(result.data).substring(0, 100)}...`);
        } else if (result.error) {
            console.log(`   Error: ${result.error}`);
        }
    });
    
    return {
        totalTests: testDocuments.length,
        successful: successCount,
        failed: testDocuments.length - successCount,
        avgResponseTime: avgResponseTime,
        successRate: successRate,
        throughput: throughput,
        results: results
    };
}

// IMPORTANTE: Configurar credenciales antes de ejecutar
function checkCredentials() {
    if (EQUIFAX_CONFIG.clientId === 'TU_CLIENT_ID_AQUI' || 
        EQUIFAX_CONFIG.clientSecret === 'TU_CLIENT_SECRET_AQUI') {
        
        console.log('⚠️  ADVERTENCIA: Configurar credenciales reales en EQUIFAX_CONFIG');
        console.log('');
        console.log('📝 Pasos:');
        console.log('1. Reemplazar clientId con tu Client ID real');
        console.log('2. Reemplazar clientSecret con tu Client Secret real'); 
        console.log('3. Ejecutar: node realEquifaxTest.js');
        console.log('');
        return false;
    }
    return true;
}

// EJECUTAR SI LAS CREDENCIALES ESTÁN CONFIGURADAS
if (checkCredentials()) {
    runRealEquifaxTests().catch(error => {
        console.error('💥 Error en pruebas:', error);
    });
} else {
    console.log('🔧 Configura las credenciales y vuelve a ejecutar');
}