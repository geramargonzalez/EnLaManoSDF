const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SUITESCRIPTS_DIR = path.join(ROOT, 'src', 'FileCabinet', 'SuiteScripts');
const CORPUS_DIR = path.join(ROOT, 'data', 'corpus');
const GOLDEN_DIR = path.join(ROOT, 'tests', 'golden');

const normalizeModule = loadAmdModule(path.join(SUITESCRIPTS_DIR, 'bcuScore', 'domain', 'normalize.js'), createDefaultDeps('normalize'));
const scoringRulesModule = loadAmdModule(path.join(SUITESCRIPTS_DIR, 'bcuScore', 'config', 'scoringRules.js'), createRulesDeps());
const scoreModule = loadAmdModule(path.join(SUITESCRIPTS_DIR, 'bcuScore', 'domain', 'score.js'), createScoreDeps());

fs.readdirSync(GOLDEN_DIR).filter((file) => file.endsWith('.json')).forEach((fileName) => {
    const goldenPath = path.join(GOLDEN_DIR, fileName);
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    const caseName = golden.name || path.basename(fileName, '.json');
    const corpusPath = path.join(CORPUS_DIR, `${caseName}.json`);

    if (!fs.existsSync(corpusPath)) {
        throw new Error(`No se encontró input corpus para el caso ${caseName}`);
    }

    const caseData = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

    test(`golden parity: ${caseName}`, () => {
        const normalizedData = normalizeCaseData(caseData);
        const rules = scoringRulesModule.getDefaultRules();
        rules.mode = 'sdb-compat';
        rules.debug = false;

        const result = scoreModule.computeScore(normalizedData, rules);

        expect(Boolean(result.error_reglas)).toBe(Boolean(golden.expected.error_reglas));
        expect(result.score).toBeCloseTo(golden.expected.score, 10);
        expect(result.calificacionMinima).toBe(golden.expected.calificacionMinima);
        expect(result.contador).toBe(golden.expected.contador);
        expect(result.endeudamiento).toBeCloseTo(golden.expected.endeudamiento, 10);

        const compat = result.compat || {};
        Object.keys(golden.expected.binned || {}).forEach((key) => {
            expect(compat).toHaveProperty(key);
            expect(compat[key]).toBeCloseTo(golden.expected.binned[key], 10);
        });
    });
});

function normalizeCaseData(caseData) {
    const mymResponse = {
        datosBcu: caseData.legacy && caseData.legacy.datosBcu,
        datosBcuT6: caseData.legacy && caseData.legacy.datosBcu_T6,
        raw: {
            datosBcu: caseData.legacy && caseData.legacy.datosBcu,
            datosBcu_T6: caseData.legacy && caseData.legacy.datosBcu_T6
        }
    };
    return normalizeModule.normalizeMymResponse(mymResponse, caseData.documento || '');
}

function createDefaultDeps(label) {
    return {
        'N/log': createLogger(label)
    };
}

function createRulesDeps() {
    return {
        'N/log': createLogger('rules'),
        'N/search': { lookupFields: () => null }
    };
}

function createScoreDeps() {
    return {
        'N/log': createLogger('score')
    };
}

function createLogger() {
    return {
        debug: () => {},
        error: () => {},
        audit: () => {}
    };
}

function loadAmdModule(filePath, dependencyMap, cache) {
    const absolutePath = path.resolve(filePath);
    const memo = cache || new Map();
    if (memo.has(absolutePath)) {
        return memo.get(absolutePath);
    }

    const code = fs.readFileSync(absolutePath, 'utf8');
    let capturedModule = null;

    const sandbox = {
        console,
        Buffer,
        JSON,
        Date,
        Math,
        Object,
        Array,
        String,
        Number,
        Boolean,
        define: function(deps, factory) {
            const resolved = (deps || []).map((dep) => {
                if (dependencyMap && Object.prototype.hasOwnProperty.call(dependencyMap, dep)) {
                    return dependencyMap[dep];
                }
                if (dep === 'N/log') {
                    return createLogger('default');
                }
                if (dep === 'N/search') {
                    return { lookupFields: () => null };
                }
                if (dep.startsWith('./') || dep.startsWith('../')) {
                    const nestedPath = path.resolve(path.dirname(absolutePath), dep + (dep.endsWith('.js') ? '' : '.js'));
                    return loadAmdModule(nestedPath, dependencyMap, memo);
                }
                return {};
            });
            capturedModule = factory.apply(null, resolved);
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: absolutePath });
    memo.set(absolutePath, capturedModule);
    return capturedModule;
}
