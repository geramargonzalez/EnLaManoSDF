// Test de generación de token UAT/PROD para equifaxAdapter
// Ejecuta el AMD file con mocks de N/https, N/log, N/runtime y N/encode

const fs = require('fs');
const path = require('path');

// Mocks
let lastTokenCounter = 0;
const httpsMock = {
    Method: { POST: 'POST' },
    post: function (opts) { return this.request(opts); },
    request: function (opts) {
        const url = opts && opts.url ? String(opts.url) : '';
        // Simular token endpoint
        if (url.indexOf('/oauth/token') !== -1) {
            lastTokenCounter++;
            const isSandbox = url.indexOf('sandbox') !== -1;
            const tokenValue = (isSandbox ? 'UAT' : 'PROD') + '_TOKEN_' + lastTokenCounter;
            return { code: 200, body: JSON.stringify({ access_token: tokenValue, expires_in: 3600 }) };
        }
        // Simular API call
        return { code: 200, body: JSON.stringify({ ok: true, received: true, url: url }) };
    }
};

const logMock = {
    audit: (d) => console.log('[LOG-AUDIT]', d.title, d.details || ''),
    debug: (d) => console.log('[LOG-DEBUG]', d.title, d.details || ''),
    error: (d) => console.error('[LOG-ERROR]', d.title, d.details || '')
};

const runtimeMock = {
    getCurrentScript: function () {
        return {
            getParameter: function (p) {
                const param = p && p.name ? p.name : p;
                const mapping = {
                    'custscript_equifax_clientid_sandbox': 'SANDBOX_ID',
                    'custscript_equifax_clientsecret_sandbox': 'SANDBOX_SECRET',
                    'custscript_equifax_clientid_prod': 'PROD_ID',
                    'custscript_equifax_clientsecret_prod': 'PROD_SECRET',
                    'custscript_equifax_configuration': 'Config',
                    'custscript_equifax_billto': 'UY004277B001',
                    'custscript_equifax_shipto': 'UY004277B001S3642'
                };
                return mapping[param];
            }
        };
    }
};

const encodeMock = {
    convert: function (opts) {
        // Usar Buffer en node para retornar base64
        const str = opts && opts.string ? opts.string : '';
        return Buffer.from(str, 'utf8').toString('base64');
    },
    Encoding: {
        UTF_8: 'utf-8',
        BASE_64: 'base64'
    }
};

const normalizeMock = {
    normalizeEquifaxResponse: function (raw) {
        return { provider: 'equifax', normalized: true, raw: raw };
    }
};

// Preparar define() global para ejecutar el archivo AMD
global.__AMD_MODULE__ = null;
global.define = function (deps, factory) {
    const modules = deps.map(function (dep) {
        if (dep === 'N/https') return httpsMock;
        if (dep === 'N/log') return logMock;
        if (dep === 'N/runtime') return runtimeMock;
        if (dep === 'N/encode') return encodeMock;
        if (dep === '../domain/normalize') return normalizeMock;
        return null;
    });
    global.__AMD_MODULE__ = factory.apply(null, modules);
};

// Cargar y ejecutar el adapter (eval del archivo AMD)
const adapterPath = path.resolve(__dirname, '..', 'src', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'adapters', 'equifaxAdapter.js');
const code = fs.readFileSync(adapterPath, 'utf8');
// Ejecutar en este contexto - el define global capturará el módulo
eval(code);

const equifaxAdapter = global.__AMD_MODULE__;
if (!equifaxAdapter) {
    console.error('No se pudo inicializar equifaxAdapter (define falló)');
    process.exit(1);
}

(async function run() {
    console.log('\n=== TEST GENERACIÓN TOKENS EQUIFAX ===\n');

    // 1) Generar token UAT
    try {
        const tokenUat = equifaxAdapter._internal.getValidToken(true, true);
        console.log('Token UAT generado:', tokenUat);
    } catch (e) {
        console.error('Error generando token UAT:', e.message);
    }

    // 2) Generar token PROD
    try {
        const tokenProd = equifaxAdapter._internal.getValidToken(false, true);
        console.log('Token PROD generado:', tokenProd);
    } catch (e) {
        console.error('Error generando token PROD:', e.message);
    }

    // 3) Llamada fetch simulada en UAT (debe generar token y llamar API)
    try {
        const resp = equifaxAdapter.fetch('12345678', { isSandbox: true });
        console.log('Fetch UAT returned normalized:', resp.normalized || resp);
    } catch (e) {
        console.error('Error fetch UAT:', e.message);
    }

    // 4) Llamada fetch simulada en PROD (debe generar token y llamar API)
    try {
        const resp2 = equifaxAdapter.fetch('12345678', { isSandbox: false });
        console.log('Fetch PROD returned normalized:', resp2.normalized || resp2);
    } catch (e) {
        console.error('Error fetch PROD:', e.message);
    }

    console.log('\n=== FIN TEST ===\n');
})();
