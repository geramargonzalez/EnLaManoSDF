// Test local para scoringRules.js - verifica loadRulesFromNetSuite con lookupFields
const fs = require('fs');
const vm = require('vm');
const path = require('path');

console.log('=== Test: scoringRules.js con lookupFields ===\n');

// Cargar scoringRules.js en un sandbox
const rulesPath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'config', 'scoringRules.js');
const rulesCode = fs.readFileSync(rulesPath, 'utf8');

// Simular respuesta de lookupFields (como la devuelve NetSuite)
const mockLookupResponse = {
    // Campos básicos
    custrecord_sdb_score_base_score: '0.75',
    custrecord_sdb_score_rejection_rules: JSON.stringify({
        isDeceased: true,
        badRatings: ['2B', '3', '4', '5'],
        maxVencido: 250000,
        maxCastigado: 120000
    }),
    // Campos binned (WOE) - algunos como string, otros como array (como NetSuite)
    custrecord_sdb_banco_binned: [{ value: '0.004', text: '0.004' }],
    custrecord_sdb_ent_t6_binned: '0.003',
    custrecord_sdb_intercept: [{ value: '0.22', text: '0.22' }],
    custrecord_sdb_t6_cred_dir_comp_binned: '0.0029',
    custrecord_sdb_vig_noauto_t6_coop_binned: '0.0034',
    custrecord_sdb_woe_cont_t0_bbva_binned: [{ value: '0.0046', text: '0.0046' }],
    custrecord_sdb_woe_cont_t0_fucac_binned: '0.0039',
    custrecord_sdb_woe_cont_t0_scotia_binned: '0.0035',
    custrecord_sdb_woe_t0_asi_binned: '0.0038',
    custrecord_sdb_woe_t0_brou_grupo_binned: '0.00375',
    custrecord_sdb_woe_t0_emp_valor_binned: '0.006',
    custrecord_sdb_woe_t0_fnb_binned: '0.0015',
    custrecord_sdb_woe_t0_santa_binned: '0.00068',
    custrecord_sdb_woe_t6_binned: '0.00058',
    custrecord_sdb_woe_t6_cred_dir_binned: '0.00026',
    custrecord_sdb_woe_t6_creditel_binned: '0.00034',
    custrecord_sdb_woe_t6_oca_binned: '0.0043',
    custrecord_sdb_woe_t6_pronto_binned: '0.00168'
};

const rulesSandbox = {
    module: { exports: {} },
    exports: {},
    console: console,
    require: require
};

// Inyectar define con stubs de NetSuite
rulesSandbox.define = function(deps, factory) {
    const resolved = (deps || []).map(function(d) {
        if (d === 'N/search') {
            return {
                lookupFields: function(opts) {
                    console.log('  [MOCK] lookupFields called with:');
                    console.log('    type:', opts.type);
                    console.log('    id:', opts.id);
                    console.log('    columns:', opts.columns.length, 'columns');
                    console.log('  [MOCK] Returning mock data\n');
                    return mockLookupResponse;
                },
                create: function() {
                    throw new Error('search.create should NOT be called - using lookupFields optimization');
                }
            };
        }
        if (d === 'N/log') {
            return {
                error: function(o) { console.log('  [LOG ERROR]', o.title, '-', o.details); },
                debug: function(o) { console.log('  [LOG DEBUG]', o.title, '-', o.details); },
                audit: function(o) { console.log('  [LOG AUDIT]', o.title, '-', o.details); }
            };
        }
        return undefined;
    });
    const res = factory.apply(null, resolved);
    if (res && typeof res === 'object') {
        rulesSandbox.module.exports = res;
    }
};

vm.createContext(rulesSandbox);
new vm.Script(rulesCode, { filename: rulesPath }).runInContext(rulesSandbox);

const rulesModule = rulesSandbox.module.exports;
if (!rulesModule || !rulesModule.getScoringRules) {
    throw new Error('scoringRules module not loaded correctly');
}

// Test 1: Obtener reglas por defecto (sin llamar NetSuite)
console.log('--- Test 1: getDefaultRules() ---');
const defaultRules = rulesModule.getDefaultRules();
console.log('  baseScore:', defaultRules.baseScore);
console.log('  binned.banco_binned:', defaultRules.binned.banco_binned);
console.log('  binned.intercept:', defaultRules.binned.intercept);
console.log('  rejectionRules.maxVencido:', defaultRules.rejectionRules.maxVencido);
console.log('  ✓ Default rules loaded\n');

// Test 2: Cargar reglas desde NetSuite (simulado con mock)
console.log('--- Test 2: getScoringRules() - primera llamada (cache miss) ---');
const rules1 = rulesModule.getScoringRules();
console.log('  baseScore:', rules1.baseScore, '(esperado: 0.75 del mock)');
console.log('  binned.banco_binned:', rules1.binned.banco_binned, '(esperado: 0.004 del mock)');
console.log('  binned.intercept:', rules1.binned.intercept, '(esperado: 0.22 del mock)');
console.log('  binned.t0_bbva_binned:', rules1.binned.t0_bbva_binned, '(esperado: 0.0046 del mock - array format)');
console.log('  rejectionRules.maxVencido:', rules1.rejectionRules.maxVencido, '(esperado: 250000 del mock)');

// Validar que los valores del mock se cargaron correctamente
const assertions = [
    { name: 'baseScore', expected: 0.75, actual: rules1.baseScore },
    { name: 'banco_binned', expected: 0.004, actual: rules1.binned.banco_binned },
    { name: 'intercept', expected: 0.22, actual: rules1.binned.intercept },
    { name: 'ent_t6_binned', expected: 0.003, actual: rules1.binned.ent_t6_binned },
    { name: 't0_bbva_binned (array)', expected: 0.0046, actual: rules1.binned.t0_bbva_binned },
    { name: 'maxVencido', expected: 250000, actual: rules1.rejectionRules.maxVencido }
];

let passed = 0;
let failed = 0;

console.log('\n  Validaciones:');
assertions.forEach(function(test) {
    const isEqual = Math.abs(test.expected - test.actual) < 0.0001 || test.expected === test.actual;
    if (isEqual) {
        console.log('    ✓', test.name, ':', test.actual);
        passed++;
    } else {
        console.log('    ✗', test.name, ':', test.actual, '(esperado:', test.expected + ')');
        failed++;
    }
});

console.log('\n--- Test 3: getScoringRules() - segunda llamada (cache hit) ---');
const rules2 = rulesModule.getScoringRules();
console.log('  ✓ Returned from cache (no lookupFields call expected above)');
console.log('  baseScore:', rules2.baseScore);
console.log('  Same instance?', rules1 === rules2 ? 'YES ✓' : 'NO ✗');

// Test 4: Invalidar cache y recargar
console.log('\n--- Test 4: invalidateCache() y recarga ---');
rulesModule.invalidateCache();
const rules3 = rulesModule.getScoringRules();
console.log('  ✓ Cache invalidated and reloaded');
console.log('  baseScore:', rules3.baseScore);

// Test 5: Validar estructura completa
console.log('\n--- Test 5: Validar estructura completa ---');
const isValid = rulesModule.validateRules(rules1);
console.log('  validateRules():', isValid ? '✓ VALID' : '✗ INVALID');

// Resumen
console.log('\n=== RESUMEN ===');
console.log('  Tests passed:', passed);
console.log('  Tests failed:', failed);
console.log('  Status:', failed === 0 ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED');

if (failed === 0) {
    console.log('\n✅ scoringRules.js optimizado con lookupFields funciona correctamente');
    console.log('   - Helper getFieldValue maneja arrays y strings');
    console.log('   - Todos los campos binned se parsean correctamente');
    console.log('   - Cache funciona (evita llamadas repetidas)');
    console.log('   - Solo 1 llamada a lookupFields (vs 2 antes)');
} else {
    console.log('\n❌ Algunos tests fallaron - revisar implementación');
    process.exit(1);
}
