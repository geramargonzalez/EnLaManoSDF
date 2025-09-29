/**
 * TEST DE CONEXIÓN - Solo con Token Endpoint
 * Para validar conectividad básica con Equifax
 */

const https = require('https');
const url = require('url');

// Lo que tienes disponible
const EQUIFAX_ENDPOINTS = {
    tokenUrl: 'https://api.uat.latam.equifax.com/v2/oauth/token',
    apiUrl: 'https://api.uat.latam.equifax.com/business/interconnect/v1/decision-orchestrations',
    scope: 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations'
};

/**
 * Test básico de conectividad - Solo verificar que el endpoint responde
 */
async function testEquifaxConnectivity() {
    console.log('🔗 VALIDANDO CONECTIVIDAD CON EQUIFAX\n');
    
    const results = [];
    
    for (const [name, endpoint] of Object.entries(EQUIFAX_ENDPOINTS)) {
        if (name === 'scope') continue; // Skip scope
        
        console.log(`📡 Probando: ${name}`);
        console.log(`🔗 URL: ${endpoint}`);
        
        const startTime = Date.now();
        
        try {
            const parsedUrl = url.parse(endpoint);
            const response = await testEndpoint(parsedUrl.hostname, parsedUrl.path);
            const responseTime = Date.now() - startTime;
            
            console.log(`✅ Conectado en ${responseTime}ms`);
            console.log(`📊 Status: ${response.statusCode}`);
            console.log(`📝 Response: ${response.body.substring(0, 200)}...`);
            
            results.push({
                endpoint: name,
                url: endpoint,
                success: true,
                statusCode: response.statusCode,
                responseTime: responseTime,
                accessible: true
            });
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            console.log(`❌ Error en ${responseTime}ms: ${error.message}`);
            
            results.push({
                endpoint: name,
                url: endpoint,
                success: false,
                error: error.message,
                responseTime: responseTime,
                accessible: false
            });
        }
        
        console.log(''); // Línea en blanco
    }
    
    return results;
}

/**
 * Test básico HTTP para verificar conectividad
 */
function testEndpoint(hostname, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: hostname,
            port: 443,
            path: path,
            method: 'GET', // Solo GET para conectividad básica
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Connection timeout'));
        });
        
        req.setTimeout(10000);
        req.end();
    });
}

/**
 * Intentar token request básico (sin credenciales)
 */
async function testTokenEndpointBasic() {
    console.log('🔑 PROBANDO ENDPOINT DE TOKEN (sin credenciales)\n');
    
    try {
        const response = await makeTokenRequest();
        
        console.log('📊 Respuesta del token endpoint:');
        console.log(`   Status: ${response.statusCode}`);
        console.log(`   Body: ${response.body}`);
        
        // Analizar respuesta
        if (response.statusCode === 400 || response.statusCode === 401) {
            console.log('✅ Endpoint funciona (error esperado sin credenciales)');
            console.log('💡 Necesitas client_id y client_secret para continuar');
        } else if (response.statusCode === 200) {
            console.log('⚠️  Respuesta inesperada - revisar configuración');
        }
        
        return {
            working: true,
            statusCode: response.statusCode,
            needsCredentials: response.statusCode === 400 || response.statusCode === 401
        };
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return {
            working: false,
            error: error.message
        };
    }
}

/**
 * Request básico al token endpoint
 */
function makeTokenRequest() {
    return new Promise((resolve, reject) => {
        const postData = 'grant_type=client_credentials&scope=' + 
                        encodeURIComponent(EQUIFAX_ENDPOINTS.scope);
        
        const options = {
            hostname: 'api.uat.latam.equifax.com',
            port: 443,
            path: '/v2/oauth/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
                // Sin Authorization header - para ver la respuesta de error
            },
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Token request timeout'));
        });
        
        req.setTimeout(10000);
        req.write(postData);
        req.end();
    });
}

/**
 * Mostrar guía para obtener credenciales
 */
function showCredentialsGuide() {
    console.log('=== 📋 GUÍA PARA OBTENER CREDENCIALES ===\n');
    
    console.log('📞 Contacta al equipo de Equifax para obtener:');
    console.log('   • Client ID (identificador de aplicación)');
    console.log('   • Client Secret (clave secreta)');
    console.log('');
    
    console.log('📧 Información que pueden pedirte:');
    console.log('   • Nombre de la aplicación: "EnLaMano BCU Score"');
    console.log('   • Ambiente: UAT (Testing)');
    console.log('   • Scope: decision-orchestrations');
    console.log('   • Grant Type: client_credentials');
    console.log('');
    
    console.log('🔧 Una vez que tengas las credenciales:');
    console.log('   1. Actualiza realEquifaxTest.js');
    console.log('   2. Reemplaza clientId y clientSecret');
    console.log('   3. Ejecuta node realEquifaxTest.js');
    console.log('');
    
    console.log('🌐 Endpoints confirmados:');
    console.log(`   • Token: ${EQUIFAX_ENDPOINTS.tokenUrl}`);
    console.log(`   • API: ${EQUIFAX_ENDPOINTS.apiUrl}`);
}

/**
 * EJECUTAR TODAS LAS VALIDACIONES
 */
async function runConnectivityTests() {
    console.log('🚀 VALIDACIÓN DE CONECTIVIDAD EQUIFAX\n');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');
    
    try {
        // 1. Test básico de conectividad
        const connectivityResults = await testEquifaxConnectivity();
        
        // 2. Test específico del token endpoint
        const tokenResult = await testTokenEndpointBasic();
        
        // 3. Resumen
        console.log('=== 📊 RESUMEN DE CONECTIVIDAD ===\n');
        
        const accessibleEndpoints = connectivityResults.filter(r => r.accessible).length;
        const totalEndpoints = connectivityResults.length;
        
        console.log(`🌐 Endpoints accesibles: ${accessibleEndpoints}/${totalEndpoints}`);
        
        if (tokenResult.working) {
            console.log('✅ Token endpoint funcional');
            
            if (tokenResult.needsCredentials) {
                console.log('🔑 Necesitas credenciales OAuth');
                console.log('');
                showCredentialsGuide();
            }
        } else {
            console.log('❌ Token endpoint no accesible');
            console.log('🔧 Revisar conectividad de red');
        }
        
        // 4. Estado final
        if (accessibleEndpoints === totalEndpoints && tokenResult.working) {
            console.log('\n🎉 CONECTIVIDAD EXITOSA - Listo para credenciales');
        } else {
            console.log('\n⚠️  PROBLEMAS DE CONECTIVIDAD - Revisar red/firewall');
        }
        
    } catch (error) {
        console.error('💥 Error en validaciones:', error.message);
    }
}

// EJECUTAR
runConnectivityTests();