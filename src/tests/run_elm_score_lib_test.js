// Test runner: call ELM_SCORE_BCU_LIB.scoreFinal via a VM and stubbed service
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Load computeScore (domain/score.js) into a sandbox to extract computeScore
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
const computeScore = (scoreSandbox.module.exports && scoreSandbox.module.exports.computeScore) || scoreSandbox.module.exports.computeScore;
if (!computeScore) throw new Error('computeScore not loaded');

// Prepare a sample normalizedData similar to quick_node_test fixtures
const sampleNormalized = {
  flags: {},
  provider: 'equifax',
  periodData: {
    t0: {
      entities: [ { vigente: 1000, vencido: 0, castigado: 0, rating: '1A', entidad: 'Scotiabank', rubros: [] } ],
      aggregates: { vigente: { mn: 1000, me: 0 } }
    },
    t6: { entities: [], aggregates: {} }
  }
};

// Now load ELM_SCORE_BCU_LIB.js and provide a stub service that calls computeScore
const libPath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'ELM_SCORE_BCU_LIB.js');
const libCode = fs.readFileSync(libPath, 'utf8');

const libSandbox = { module: { exports: {} }, exports: {}, console: console, require: require };
libSandbox.define = function(deps, factory) {
  // map dependencies
  const resolved = (deps || []).map(function(d) {
    if (d === 'N/log') return { error: function() {}, debug: function() {}, audit: function() {} };
    if (d === './bcuScore/app/service') {
      return {
        calculateScore: function(dni, options) {
          // ignore dni and options; call computeScore with sampleNormalized and a simple rules object
          const rules = { rejectionRules: { isDeceased: true }, binned: { /* intentionally empty: computeScore will lookup defaults */ } };
          return computeScore(sampleNormalized, rules);
        }
      };
    }
    return undefined;
  });
  const res = factory.apply(null, resolved);
  if (res && typeof res === 'object') libSandbox.module.exports = res;
};
vm.createContext(libSandbox);
new vm.Script(libCode, { filename: libPath }).runInContext(libSandbox);
const elm = libSandbox.module.exports || libSandbox.exports;
if (!elm || !elm.scoreFinal) throw new Error('ELM_SCORE_BCU_LIB not exported');

// Call scoreFinal
const out = elm.scoreFinal('46175108', { provider: 'equifax', debug: true });
console.log('ELM scoreFinal output:\n', JSON.stringify(out, null, 2));
