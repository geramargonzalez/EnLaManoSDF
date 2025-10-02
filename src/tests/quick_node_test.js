// Quick Node test harness for SuiteScript AMD-style module
// This file wraps the SuiteScript define() module so we can require computeScore in Node.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const fpath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'score.js');
let code = fs.readFileSync(fpath, 'utf8');

// Replace SuiteScript define wrapper with a simple export for Node
code = code.replace(/define\(\[\],\s*function \(\) \{[\s\S]*?return\s+\{[\s\S]*?\};?\s*\}\);?/, function(match) {
    // Try to capture the inner function body
    const innerMatch = match.match(/define\(\[\],\s*function \(\) \{([\s\S]*)return\s+\{[\s\S]*?\};?\s*\}\);?/);
    if (innerMatch && innerMatch[1]) {
        return innerMatch[1] + '\nmodule.exports = { computeScore: computeScore };\n';
    }
    // fallback: naive removal of define wrapper
    return match.replace(/^define\(\[\],\s*function \(\) \{/, '').replace(/\}\);?$/, '\nmodule.exports = { computeScore: computeScore };');
});

// Run in VM to get module.exports
const script = new vm.Script(code, { filename: fpath });
const sandbox = { module: {}, exports: {}, require: require, console: console, setTimeout: setTimeout };
vm.createContext(sandbox);
script.runInContext(sandbox);
const computeScore = sandbox.module.exports.computeScore;

// Multiple fixtures to exercise different branches and entity types
const fixtures = [
  {
    name: 'Base_OCA_single_good',
    flags: {},
    provider: 'TEST',
    metadata: { nombre: 'Prueba OCA', worstRating: '0' },
    periodData: {
      t0: {
        entities: [ { vigente: 1000, vencido: 0, castigado: 0, rating: '1A', NombreEntidad: 'OCA', rubros: [] } ],
        aggregates: { vigente: { mn: 1000, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'Banks_good_rating',
    flags: {},
    provider: 'TEST',
    metadata: { nombre: 'Clientes Bancos', worstRating: '1A' },
    periodData: {
      t0: {
        entities: [
          { vigente: 500, vencido: 0, castigado: 0, rating: '1A', NombreEntidad: 'Scotiabank', rubros: [] },
          { vigente: 300, vencido: 0, castigado: 0, rating: '1C', NombreEntidad: 'Santander', rubros: [] }
        ],
        aggregates: { vigente: { mn: 800, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'FUCAC_contingency_and_fucac',
    flags: {},
    provider: 'TEST',
    metadata: { nombre: 'Prueba FUCAC', worstRating: '0' },
    periodData: {
      t0: {
        entities: [ { vigente: 0, vencido: 0, castigado: 0, rating: '2B', NombreEntidad: 'FUCAC', rubros: [ { tipo: 'contingencia', cont: true } ] } ],
        aggregates: { vigente: { mn: 0, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'Multiple_entities_with_t6',
    flags: {},
    provider: 'TEST',
    metadata: { nombre: 'Prueba Multient', worstRating: '0' },
    periodData: {
      t0: {
        entities: [
          { vigente: 200, vencido: 50, castigado: 0, rating: '1A', NombreEntidad: 'Vizcaya', rubros: [] },
          { vigente: 100, vencido: 20, castigado: 0, rating: '1C', NombreEntidad: 'Banco Ita', rubros: [] }
        ],
        aggregates: { vigente: { mn: 300, me: 0 } }
      },
      t6: {
        entities: [
          { NombreEntidad: 'Cooperativa X', Calificacion: '1A', rubros: [ { nombre: 'OCA', vig: true } ], Cont: false },
          { NombreEntidad: 'ProntoPago', Calificacion: '2A', rubros: [], Cont: false }
        ],
        aggregates: { vigente: { mn: 300, me: 0 } }
      }
    }
  },
  {
    name: 'Rejected_deceased',
    flags: { isDeceased: true },
    provider: 'TEST',
    metadata: { nombre: 'Fallecido', worstRating: '5' },
    periodData: {
      t0: { entities: [], aggregates: {} },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'Bad_rating_rejection',
    flags: { hasRejectableRating: true },
    provider: 'TEST',
    metadata: { nombre: 'Mal Rating', worstRating: '5' },
    periodData: {
      t0: { entities: [ { vigente: 100, vencido: 0, castigado: 0, rating: '5', NombreEntidad: 'Santander', rubros: [] } ], aggregates: { vigente: { mn: 100, me: 0 } } },
      t6: { entities: [], aggregates: {} }
    }
  }
];

// Two scoring rules sets: default and one with some bin coefficients to exercise multipliers
const baseScoringRules = { coefficients: { intercept: 0.211 } };
const bankHeavyRules = { coefficients: { intercept: 0.211, banco_binned: 1.2, t0_scotia_binned: 1.1, t6_banco_binned: 1.3 } };

// Iterate and execute computeScore for each fixture
fixtures.forEach(function(f, idx) {
  var rules = (f.name === 'Banks_good_rating' ? bankHeavyRules : baseScoringRules);
  try {
    var res = computeScore(f, rules);
    console.log('---- Fixture', idx + 1, '-', f.name, '----');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error running computeScore for fixture', f.name, e.stack || e);
  }
});
