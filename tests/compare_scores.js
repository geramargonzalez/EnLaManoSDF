/* tests/compare_scores.js
   Compara scores entre ELM_SCORE_BCU_LIB y SDB-Enlamano-score
   sin mocks, usando llamadas reales a MYM
   
   Ejecutar: node tests/compare_scores.js
*/
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const https = require('https');
const http = require('http');

// Documento a probar
const DNI = '46175108';

// Cargar módulos AMD de NetSuite
function loadAmdModule(filePath, dependencies) {
    const code = fs.readFileSync(filePath, 'utf8');
    let exported = null;
    
    const sandbox = {
        console,
        require,
        module: {},
        exports: {},
        binnedFromRules: null,
        lookup: null,
        define: function(deps, factory) {
            const resolved = deps.map(depName => {
                if (dependencies && dependencies[depName]) {
                    return dependencies[depName];
                }
                return {};
            });
            exported = factory.apply(null, resolved);
        }
    };
    
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: filePath });
    return exported;
}

// NetSuite N/https mock que hace peticiones HTTP reales
const realHttpsModule = {
    post: function(options) {
        return new Promise((resolve, reject) => {
            const url = new URL(options.url);
            const isHttps = url.protocol === 'https:';
            const lib = isHttps ? https : http;
            
            const postData = options.body || '';
            
            const reqOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    ...options.headers
                }
            };
            
            const req = lib.request(reqOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    resolve({
                        code: res.statusCode,
                        body: body
                    });
                });
            });
            
            req.on('error', (e) => {
                reject(e);
            });
            
            req.write(postData);
            req.end();
        });
    }
};

// Hacer la petición usando Node.js https (retorna Promise para compatibilidad async)
function asyncHttpsPost(options) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const postData = options.body || '';
        
        const reqOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                ...options.headers
            }
        };
        
        const req = lib.request(reqOptions, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({ code: res.statusCode, body: body });
            });
        });
        
        req.on('error', (e) => {
            reject(e);
        });
        
        req.write(postData);
        req.end();
    });
}

// NetSuite N/record mock con valores reales del scoring
const recordModule = {
    load: function() {
        return {
            getValue: function(fieldId) {
                const coefficients = {
                    'custrecord_sdb_banco_binned': 0.0038032,
                    'custrecord_sdb_ent_t6_binned': 0.0026394,
                    'custrecord_sdb_intercept': 0.2114816,
                    'custrecord_sdb_t6_cred_dir_comp_binned': 0.0028341,
                    'custrecord_sdb_vig_noauto_t6_coop_binned': 0.0033394,
                    'custrecord_sdb_woe_cont_t0_bbva_binned': 0.0045863,
                    'custrecord_sdb_woe_cont_t0_fucac_binned': 0.0038189,
                    'custrecord_sdb_woe_cont_t0_scotia_binned': 0.0034926,
                    'custrecord_sdb_woe_t0_asi_binned': 0.0037215,
                    'custrecord_sdb_woe_t0_brou_grupo_binned': 0.0037486,
                    'custrecord_sdb_woe_t0_emp_valor_binned': 0.0059208,
                    'custrecord_sdb_woe_t0_fnb_binned': 0.0014982,
                    'custrecord_sdb_woe_t0_santa_binned': 0.0006744,
                    'custrecord_sdb_woe_t6_binned': 0.0005706,
                    'custrecord_sdb_woe_t6_cred_dir_binned': 0.0002515,
                    'custrecord_sdb_woe_t6_creditel_binned': 0.0003315,
                    'custrecord_sdb_woe_t6_oca_binned': 0.0042904,
                    'custrecord_sdb_woe_t6_pronto_binned': 0.0016738
                };
                return coefficients[fieldId] !== undefined ? coefficients[fieldId] : 0;
            }
        };
    }
};

const logModule = {
    debug: function() {},
    error: function() {},
    audit: function() {}
};

const searchModule = {
    lookupFields: function() { return null; }
};

const runtimeModule = {};
const renderModule = {};
const emailModule = {};

// Rutas de archivos
const repoRoot = path.resolve(__dirname, '..');
const legacyPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'SDB-Enlamano-score.js');
const elmLibPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'ELM_SCORE_BCU_LIB.js');
const servicePath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'app', 'service.js');
const mymAdapterPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'adapters', 'mymAdapter.js');
const bcuAdapterPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'adapters', 'bcuAdapter.js');
const equifaxAdapterPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'adapters', 'equifaxAdapter.js');
const normalizePath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'normalize.js');
const scorePath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'score.js');
const rulesPath = path.join(repoRoot, 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'config', 'scoringRules.js');

console.log('=== Comparación de Scores - Llamadas Reales a MYM ===');
console.log('DNI:', DNI);
console.log('');

(async function() {
    try {
        // 1. Cargar librería legacy SDB-Enlamano-score.js
        console.log('1. Cargando SDB-Enlamano-score.js...');
        const legacyModule = loadAmdModule(legacyPath, {
            'N/log': logModule,
            'N/record': recordModule,
            'N/search': searchModule,
            'N/runtime': runtimeModule,
            'N/render': renderModule,
            'N/email': emailModule,
            'N/https': { post: asyncHttpsPost }
        });
        
        // 2. Cargar todos los módulos necesarios para ELM_SCORE_BCU_LIB
        console.log('2. Cargando módulos de bcuScore...');
        
        const cacheModule = {
            Scope: { PROTECTED: 1 },
            getCache: function() {
                return {
                    get: () => null,
                    put: () => {},
                    remove: () => {}
                };
            }
        };
        
        const normalizeModule = loadAmdModule(normalizePath, {});
        const scoreModule = loadAmdModule(scorePath, { 'N/search': searchModule });
        const rulesModule = loadAmdModule(rulesPath, {});
        
        const mymAdapter = loadAmdModule(mymAdapterPath, {
            'N/https': { post: asyncHttpsPost },
            'N/log': logModule,
            '../domain/normalize': normalizeModule
        });
        
        const bcuAdapter = loadAmdModule(bcuAdapterPath, {
            'N/https': { post: asyncHttpsPost },
            'N/log': logModule,
            '../domain/normalize': normalizeModule
        });
        
        const equifaxAdapter = loadAmdModule(equifaxAdapterPath, {
            'N/https': { post: asyncHttpsPost },
            'N/log': logModule,
            '../domain/normalize': normalizeModule
        });
        
        const serviceModule = loadAmdModule(servicePath, {
            'N/log': logModule,
            'N/cache': cacheModule,
            '../adapters/mymAdapter': mymAdapter,
            '../adapters/bcuAdapter': bcuAdapter,
            '../adapters/equifaxAdapter': equifaxAdapter,
            '../domain/score': scoreModule,
            '../config/scoringRules': rulesModule
        });
        
        const elmModule = loadAmdModule(elmLibPath, {
            'N/log': logModule,
            './bcuScore/app/service': serviceModule
        });
        
        // 3. Ejecutar scoring con ELM_SCORE_BCU_LIB
        console.log('3. Ejecutando ELM_SCORE_BCU_LIB.scoreFinal...');
        console.log('   Parámetros: DNI=' + DNI + ', provider=mym, forceRefresh=true, debug=false');
        const elmResultRaw = elmModule.scoreFinal(DNI, { 
            provider: 'mym', 
            forceRefresh: true, 
            debug: false 
        });
        // Si es una promesa, esperarla
        const elmResult = elmResultRaw && elmResultRaw.then ? await elmResultRaw : elmResultRaw;
        
        console.log('');
        console.log('========================================');
        console.log('OBJETO COMPLETO ELM_SCORE_BCU_LIB:');
        console.log('========================================');
        console.log(JSON.stringify(elmResult, null, 2));
        console.log('========================================');
        console.log('');
        
        // 4. Ejecutar scoring con SDB-Enlamano-score
        console.log('4. Ejecutando SDB-Enlamano-score.scoreFinal...');
        console.log('   Parámetros: DNI=' + DNI);
        const legacyResultRaw = legacyModule.scoreFinal(DNI);
        // Si es una promesa, esperarla
        const legacyResult = legacyResultRaw && legacyResultRaw.then ? await legacyResultRaw : legacyResultRaw;
        
        console.log('');
        console.log('========================================');
        console.log('OBJETO COMPLETO SDB-Enlamano-score:');
        console.log('========================================');
        console.log(JSON.stringify(legacyResult, null, 2));
        console.log('========================================');
        console.log('');
        
        // 5. Extraer y comparar scores
        console.log('=== COMPARACIÓN DE SCORES ===');
        console.log('');
        
        const scoreElm = elmResult?.score || 0;
        const scoreLegacy = legacyResult?.score || 0;
        
        console.log('ELM_SCORE_BCU_LIB score:', scoreElm);
        console.log('SDB-Enlamano-score score:', scoreLegacy);
        console.log('');
        
        if (scoreElm === scoreLegacy) {
            console.log('✅ SUCCESS: Los scores coinciden');
            process.exit(0);
        } else {
            console.log('❌ MISMATCH: Los scores NO coinciden');
            console.log('Diferencia:', Math.abs(scoreElm - scoreLegacy));
            console.log('');
            console.log('ELM Result:', JSON.stringify(elmResult, null, 2));
            console.log('');
            console.log('Legacy Result:', JSON.stringify(legacyResult, null, 2));
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        console.error(error.stack);
        process.exit(2);
    }
})();
