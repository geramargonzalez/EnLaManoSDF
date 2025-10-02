// Quick Node test harness for SuiteScript AMD-style module
// This file wraps the SuiteScript define() module so we can require computeScore in Node.

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const fpath = path.join(__dirname, '..', 'FileCabinet', 'SuiteScripts', 'bcuScore', 'domain', 'score.js');
let code = fs.readFileSync(fpath, 'utf8');

// Instead of trying to regex-rewrite the AMD wrapper, create a sandbox
// that defines a global `define` which captures the factory and resolves
// common NetSuite modules to lightweight stubs (N/search, N/record).
const script = new vm.Script(code, { filename: fpath });

let capturedExports = {};

const sandbox = {
  module: { exports: {} },
  exports: {},
  console: console,
  setTimeout: setTimeout,
  // provide a simple require for in-module requires if any
  require: require
};

// Inject an AMD define into the sandbox
sandbox.define = function(deps, factory) {
  try {
    // Resolve dependencies to stubs
    const resolved = (Array.isArray(deps) ? deps : []).map(function(d) {
      if (d === 'N/search') {
        return {
          lookupFields: function(opts) {
            // Return empty lookup by default; tests can override if needed
            return {};
          }
        };
      }
      if (d === 'N/record') {
        return {
          lookupFields: function(opts) { return {}; },
          load: function() { return { getValue: function() { return 0; } }; }
        };
      }
      // unknown dependency -> undefined
      return undefined;
    });

    const result = factory.apply(null, resolved);
    // AMD module may return an object or export via returned value
    if (result && typeof result === 'object') {
      sandbox.module.exports = result;
      capturedExports = result;
    }
  } catch (err) {
    throw err;
  }
};

vm.createContext(sandbox);
script.runInContext(sandbox);

// Prefer captured export from define, fall back to module.exports
const computeScore = (capturedExports && capturedExports.computeScore) || sandbox.module.exports.computeScore;

// Multiple fixtures to exercise different branches and entity types
const fixtures = [
  {
    name: 'Scotiabank',
    flags: {},
    provider: 'Scotiabank',
    metadata: { nombre: 'Scotiabank', worstRating: '0' },
    periodData: {
      t0: {
        entities: [ { vigente: 1000, vencido: 0, castigado: 0, rating: '1A', NombreEntidad: 'Scotiabank', rubros: [] } ],
        aggregates: { vigente: { mn: 1000, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'FUCAC',
    flags: {},
    provider: 'FUCAC',
    metadata: { nombre: 'FUCAC', worstRating: '1A' },
    periodData: {
      t0: {
        entities: [
          { vigente: 500, vencido: 0, castigado: 0, rating: '1A', NombreEntidad: 'FUCAC', rubros: [] },
          { vigente: 300, vencido: 0, castigado: 0, rating: '1C', NombreEntidad: 'Santander', rubros: [] }
        ],
        aggregates: { vigente: { mn: 800, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'República',
    flags: {},
    provider: 'República',
    metadata: { nombre: 'República', worstRating: '0' },
    periodData: {
      t0: {
        entities: [ { vigente: 0, vencido: 0, castigado: 0, rating: '2B', NombreEntidad: 'FUCAC', rubros: [ { tipo: 'contingencia', cont: true } ] } ],
        aggregates: { vigente: { mn: 0, me: 0 } }
      },
      t6: { entities: [], aggregates: {} }
    }
  },
  {
    name: 'Santander',
    flags: {},
    provider: 'Santander',
    metadata: { nombre: 'Santander', worstRating: '0' },
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
          { NombreEntidad: 'Santander', Calificacion: '1A', rubros: [ { nombre: 'OCA', vig: true } ], Cont: false },
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
// Note: by default the scoring engine uses fallback multipliers that allow
// negative "binned_res" defaults to contribute. For testing we provide an
// explicit base ruleset that zeros out bin multipliers so contributions are
// neutral unless coefficients are supplied.
const baseScoringRules = {
  coefficients: {
    intercept: 0.211,
    banco_binned: 0,
    ent_t6_binned: 0,
    t6_cred_dir_comp_binned: 0,
    vig_noauto_t6_coop_binned: 0,
    t0_bbva_binned: 0,
    cont_t0_fucac_binned: 0,
    t0_scotia_binned: 0,
    t0_asi_binned: 0,
    brou_grupo_binned: 0,
    emp_valor_binned: 0,
    t0_fnb_binned: 0,
    t0_santa_binned: 0,
    t6_binned: 0,
    cred_dir_binned: 0,
    t6_creditel_binned: 0,
    t6_oca_binned: 0,
    t6_pronto_binned: 0,
    t6_banco_binned: 0
  }
};
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
