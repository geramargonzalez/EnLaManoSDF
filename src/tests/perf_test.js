// Performance test for computeScore and service.calculateScore
// Measures total time and per-call statistics
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function hrtimeSeconds(start) {
  const ns = process.hrtime.bigint() - start;
  return Number(ns) / 1e9;
}

// Load computeScore (domain)
const scorePath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'score.js');
const scoreCode = fs.readFileSync(scorePath, 'utf8');
const scoreSandbox = { module: { exports: {} }, exports: {}, console: console, require: require };
scoreSandbox.define = function(deps, factory) {
  const resolved = (deps || []).map(function(d) {
    if (d === 'N/search') return { lookupFields: function() { return {}; } };
    return undefined;
  });
  const res = factory.apply(null, resolved);
  if (res && typeof res === 'object') scoreSandbox.module.exports = res;
};
vm.createContext(scoreSandbox);
new vm.Script(scoreCode, { filename: scorePath }).runInContext(scoreSandbox);
const computeScore = scoreSandbox.module.exports && scoreSandbox.module.exports.computeScore;
if (!computeScore) throw new Error('computeScore not found');

// Load service (app/service.js)
const servicePath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'app', 'service.js');
const serviceCode = fs.readFileSync(servicePath, 'utf8');

// Prepare common sample normalized data
const sampleNormalized = {
  flags: {},
  provider: 'equifax',
  periodData: {
    t0: {
      entities: [
        { vigente: 1000, vencido: 0, castigado: 0, rating: '1A', entidad: 'Scotiabank', rubros: [] },
        { vigente: 200, vencido: 10, castigado: 0, rating: '1C', entidad: 'Santander', rubros: [] }
      ],
      aggregates: { vigente: { mn: 1200, me: 0 } }
    },
    t6: {
      entities: [ { NombreEntidad: 'Santander', Calificacion: '1A', rubros: [] } ],
      aggregates: { vigente: { mn: 1200, me: 0 } }
    }
  }
};

// Rules with binned present to avoid lookupFields and measure pure math path
const rulesWithBinned = {
  rejectionRules: { isDeceased: true },
  binned: {
    banco_binned: 0.0038,
    ent_t6_binned: 0.0026,
    intercept: 0.2114,
    t6_cred_dir_comp_binned: 0.0028,
    vig_noauto_t6_coop_binned: 0.0033,
    t0_bbva_binned: 0.0045,
    cont_t0_fucac_binned: 0.0038,
    t0_scotia_binned: 0.0034,
    t0_asi_binned: 0.0037,
    brou_grupo_binned: 0.0037,
    emp_valor_binned: 0.0059,
    t0_fnb_binned: 0.0014,
    t0_santa_binned: 0.00067,
    t6_binned: 0.00057,
    cred_dir_binned: 0.00025,
    t6_creditel_binned: 0.00033,
    t6_oca_binned: 0.00429,
    t6_pronto_binned: 0.00167
  }
};

// --- Measure computeScore ---
const iterationsCompute = 5000;
console.log('Running computeScore', iterationsCompute, 'iterations...');
const computeTimings = [];
let startAllCompute = process.hrtime.bigint();
for (let i = 0; i < iterationsCompute; i++) {
  const start = process.hrtime.bigint();
  // call computeScore with the sample and explicit rules (no lookupFields)
  const res = computeScore(sampleNormalized, rulesWithBinned);
  const elapsed = process.hrtime.bigint() - start;
  computeTimings.push(Number(elapsed));
  if (i % 1000 === 0 && i !== 0) {
    // hint GC between batches if exposed
    if (global.gc) global.gc();
  }
}
let totalComputeSec = Number(process.hrtime.bigint() - startAllCompute) / 1e9;

// compute statistics
computeTimings.sort((a,b)=>a-b);
const compMin = computeTimings[0] / 1e6;
const compMax = computeTimings[computeTimings.length-1] / 1e6;
const compSumMs = computeTimings.reduce((s,v)=>s+v,0)/1e6;
const compMeanMs = compSumMs / computeTimings.length;
const compMedianMs = computeTimings.length % 2 === 1 ? computeTimings[(computeTimings.length-1)/2]/1e6 : (computeTimings[computeTimings.length/2]/1e6 + computeTimings[computeTimings.length/2 -1]/1e6)/2;

console.log('\ncomputeScore results:');
console.log('  iterations:', iterationsCompute);
console.log('  total time (s):', totalComputeSec.toFixed(4));
console.log('  mean (ms):', compMeanMs.toFixed(4));
console.log('  median (ms):', compMedianMs.toFixed(4));
console.log('  min (ms):', compMin.toFixed(4));
console.log('  max (ms):', compMax.toFixed(4));

// --- Measure service.calculateScore (with stubs) ---
console.log('\nLoading service and running service.calculateScore with stubs...');
const serviceSandbox = { module: { exports: {} }, exports: {}, console: console, require: require };
serviceSandbox.define = function(deps, factory) {
  const resolved = (deps || []).map(function(d) {
    if (d === 'N/log') return { error: function(){}, debug: function(){}, audit: function(){} };
    if (d === 'N/cache') return { Scope: { PROTECTED: 'PROTECTED' }, getCache: function(){ return { get: ()=>null, put: ()=>{}, remove: ()=>{} }; } };
    if (d === '../adapters/equifaxAdapter') return { fetch: function(doc, opts){ return sampleNormalized; } };
    if (d === '../adapters/bcuAdapter') return { fetch: function(doc, opts){ return sampleNormalized; } };
    if (d === '../domain/score') return scoreSandbox.module.exports; // computeScore available
    if (d === '../config/scoringRules') return { getScoringRules: function(){ return rulesWithBinned; } };
    return undefined;
  });
  const res = factory.apply(null, resolved);
  if (res && typeof res === 'object') serviceSandbox.module.exports = res;
};
vm.createContext(serviceSandbox);
new vm.Script(serviceCode, { filename: servicePath }).runInContext(serviceSandbox);
const service = serviceSandbox.module.exports;
if (!service || !service.calculateScore) throw new Error('service.calculateScore not found');

const iterationsService = 1000;
console.log('Running service.calculateScore', iterationsService, 'iterations... (stubs for adapters and cache)');
const serviceTimings = [];
let startAllService = process.hrtime.bigint();
for (let i = 0; i < iterationsService; i++) {
  const s = process.hrtime.bigint();
  const r = service.calculateScore('12345678', { provider: 'equifax', forceRefresh: true });
  const e = process.hrtime.bigint();
  serviceTimings.push(Number(e - s));
  if (i % 200 === 0 && i !== 0) {
    if (global.gc) global.gc();
  }
}
let totalServiceSec = Number(process.hrtime.bigint() - startAllService) / 1e9;
serviceTimings.sort((a,b)=>a-b);
const servMin = serviceTimings[0]/1e6;
const servMax = serviceTimings[serviceTimings.length-1]/1e6;
const servSumMs = serviceTimings.reduce((s,v)=>s+v,0)/1e6;
const servMeanMs = servSumMs / serviceTimings.length;
const servMedianMs = serviceTimings.length % 2 === 1 ? serviceTimings[(serviceTimings.length-1)/2]/1e6 : (serviceTimings[serviceTimings.length/2]/1e6 + serviceTimings[serviceTimings.length/2 -1]/1e6)/2;

console.log('\nservice.calculateScore results:');
console.log('  iterations:', iterationsService);
console.log('  total time (s):', totalServiceSec.toFixed(4));
console.log('  mean (ms):', servMeanMs.toFixed(4));
console.log('  median (ms):', servMedianMs.toFixed(4));
console.log('  min (ms):', servMin.toFixed(4));
console.log('  max (ms):', servMax.toFixed(4));

console.log('\nSummary:');
console.log('  computeScore total s:', totalComputeSec.toFixed(4));
console.log('  computeScore mean ms:', compMeanMs.toFixed(4));
console.log('  service total s:', totalServiceSec.toFixed(4));
console.log('  service mean ms:', servMeanMs.toFixed(4));

