/**
 * Test de comparación entre score viejo y nuevo usando MYM
 */

const https = require('https');

// Documento a probar
const documento = process.argv[2] || '53350991';

console.log('═══════════════════════════════════════════════');
console.log('  TEST COMPARACIÓN SCORES');
console.log('  Documento:', documento);
console.log('═══════════════════════════════════════════════\n');

// Configuración MYM API
const MYM_CONFIG = {
    hostname: 'riskapi.info',
    path: '/api/models/v2/enlamanocrm/execute',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('prod2_enlamano:dfer4edr').toString('base64')
    }
};

/**
 * Llama al API de MYM
 */
function callMymApi(periodo) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            inputs: [{ documento: documento, periodo: periodo }]
        });

        const req = https.request(MYM_CONFIG, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Error parsing JSON: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

/**
 * Calcula score con el script viejo (SDB-Enlamano-score.js)
 */
async function calcularScoreViejo() {
    console.log('\n📊 Calculando con SCORE VIEJO (SDB-Enlamano-score.js)...');
    
    try {
        // Llamar a MYM para T2 y T6
        const [respT2, respT6] = await Promise.all([
            callMymApi('t2'),
            callMymApi('t6')
        ]);

        // Cargar el módulo viejo
        const vm = require('vm');
        const fs = require('fs');
        const path = require('path');
        
        const oldScriptPath = path.join(__dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'SDB-Enlamano-score.js');
        const code = fs.readFileSync(oldScriptPath, 'utf8');

        // Crear sandbox con define
        const sandbox = {
            console: console,
            Buffer: Buffer,
            define: function(deps, factory) {
                const log = {
                    debug: () => {},
                    error: () => {},
                    audit: () => {}
                };
                const result = factory(log);
                sandbox.scoreModule = result;
            }
        };

        vm.createContext(sandbox);
        vm.runInContext(code, sandbox);

        // Ejecutar scoring
        const result = sandbox.scoreModule.calculateScore(
            JSON.stringify(respT2),
            JSON.stringify(respT6)
        );

        console.log('✅ Score Viejo:', result.score || 0);
        console.log('   Calificación:', result.calificacionMinima || 'N/A');
        
        return result;

    } catch (error) {
        console.error('❌ Error en score viejo:', error.message);
        return null;
    }
}

/**
 * Calcula score con el script nuevo (bcuScore)
 */
async function calcularScoreNuevo() {
    console.log('\n📊 Calculando con SCORE NUEVO (bcuScore)...');
    
    try {
        // Llamar a MYM para T2 y T6
        const [respT2, respT6] = await Promise.all([
            callMymApi('t2'),
            callMymApi('t6')
        ]);

        // Cargar módulos del nuevo sistema
        const vm = require('vm');
        const fs = require('fs');
        const path = require('path');

        // Paths
        const normalizePath = path.join(__dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'normalize.js');
        const scorePath = path.join(__dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'score.js');
        const rulesPath = path.join(__dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'config', 'scoringRules.js');

        // Cargar módulos
        const normalizeCode = fs.readFileSync(normalizePath, 'utf8');
        const scoreCode = fs.readFileSync(scorePath, 'utf8');
        const rulesCode = fs.readFileSync(rulesPath, 'utf8');

        // Crear sandbox
        const sandbox = {
            console: console,
            Buffer: Buffer,
            Date: Date,
            JSON: JSON,
            Array: Array,
            Object: Object,
            String: String,
            Number: Number,
            Boolean: Boolean,
            Math: Math,
            parseInt: parseInt,
            parseFloat: parseFloat,
            isNaN: isNaN,
            modules: {},
            define: function(deps, factory) {
                const log = {
                    debug: () => {},
                    error: () => {},
                    audit: () => {}
                };
                
                const resolvedDeps = deps.map(dep => {
                    if (dep === 'N/log') return log;
                    return sandbox.modules[dep] || {};
                });
                
                const result = factory(...resolvedDeps);
                return result;
            }
        };

        vm.createContext(sandbox);

        // Ejecutar módulos en orden
        const normalizeModule = vm.runInContext(normalizeCode, sandbox);
        sandbox.modules['normalize'] = normalizeModule;

        const rulesModule = vm.runInContext(rulesCode, sandbox);
        sandbox.modules['scoringRules'] = rulesModule;

        const scoreModule = vm.runInContext(scoreCode, sandbox);

        // Normalizar datos MYM
        const mymResponse = {
            datosBcu: respT2,
            datosBcuT6: respT6
        };

        const normalizedData = normalizeModule.normalizeMymResponse(mymResponse, documento);
        
        // Obtener reglas
        const rules = rulesModule.getRules();

        // Calcular score
        const result = scoreModule.computeScore(normalizedData, rules);

        console.log('✅ Score Nuevo:', result.finalScore || 0);
        console.log('   Base Score:', result.baseScore || 0);
        console.log('   Raw Score:', result.rawScore || 0);
        console.log('   Rechazado:', result.metadata?.isRejected || false);
        
        if (result.metadata?.isRejected) {
            console.log('   Razón:', result.metadata.rejectionReason);
        }

        return result;

    } catch (error) {
        console.error('❌ Error en score nuevo:', error.message);
        console.error(error.stack);
        return null;
    }
}

/**
 * Ejecuta la comparación
 */
async function main() {
    try {
        const [scoreViejo, scoreNuevo] = await Promise.all([
            calcularScoreViejo(),
            calcularScoreNuevo()
        ]);

        console.log('\n═══════════════════════════════════════════════');
        console.log('  RESUMEN COMPARACIÓN');
        console.log('═══════════════════════════════════════════════');
        
        const oldScore = scoreViejo?.score || 0;
        const newScore = scoreNuevo?.finalScore || 0;
        const diff = Math.abs(oldScore - newScore);
        const diffPercent = oldScore > 0 ? ((diff / oldScore) * 100).toFixed(2) : 0;

        console.log(`\nScore Viejo:  ${oldScore}`);
        console.log(`Score Nuevo:  ${newScore}`);
        console.log(`Diferencia:   ${diff} (${diffPercent}%)`);
        
        if (diff < 5) {
            console.log('\n✅ ÉXITO: Los scores son prácticamente iguales');
        } else if (diff < 50) {
            console.log('\n⚠️  ADVERTENCIA: Hay una pequeña diferencia');
        } else {
            console.log('\n❌ ERROR: Hay una diferencia significativa');
        }

        console.log('\n═══════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Error fatal:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar
main();
