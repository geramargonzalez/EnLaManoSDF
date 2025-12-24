/**
 * @fileoverview Test de fallback Equifax -> MYM
 * Verifica que cuando Equifax falla, el sistema automáticamente usa MYM como fallback
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SUITESCRIPTS_DIR = path.join(ROOT, 'src', 'FileCabinet', 'SuiteScripts');

// Datos de ejemplo que MYM retornaría
const MOCK_MYM_NORMALIZED_DATA = {
    documento: '12345678',
    hasData: true,
    instituciones: [
        {
            nombre: 'BANCO MOCK',
            codigo: '001',
            obligaciones: [
                {
                    tipo: 'CREDITO',
                    calificacion: '1A',
                    vigente: 1000000,
                    vencido: 0,
                    moneda: 'UYU'
                }
            ]
        }
    ],
    metadata: {
        provider: 'mym',
        worstRating: '1A',
        fetchedAt: new Date().toISOString()
    },
    totals: {
        vigente: 1000000,
        vencido: 0,
        total: 1000000
    }
};

// Error que Equifax lanzaría
class EquifaxError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EquifaxError';
        this.code = 'EQUIFAX_SERVER_ERROR';
    }
}

describe('Fallback Equifax -> MYM', () => {
    let serviceModule;
    let equifaxFetchCalls = 0;
    let mymFetchCalls = 0;
    let logMessages = [];

    beforeEach(() => {
        equifaxFetchCalls = 0;
        mymFetchCalls = 0;
        logMessages = [];

        // Crear mocks para los adapters
        const mockEquifaxAdapter = {
            fetch: jest.fn().mockImplementation((documento, options, periodMonths) => {
                equifaxFetchCalls++;
                // Simular error de Equifax
                throw new EquifaxError('EQUIFAX_SERVER_ERROR: Error interno Equifax - simulated for testing');
            })
        };

        const mockMymAdapter = {
            fetch: jest.fn().mockImplementation((documento, options) => {
                mymFetchCalls++;
                // Retornar datos válidos de MYM
                return { ...MOCK_MYM_NORMALIZED_DATA, documento };
            })
        };

        const mockBcuAdapter = {
            fetch: jest.fn().mockImplementation(() => {
                throw new Error('BCU not implemented');
            })
        };

        const mockScoreEngine = {
            computeScore: jest.fn().mockImplementation((normalizedData, rules, normalizedDataT6) => {
                return {
                    finalScore: 750,
                    rawScore: 750,
                    baseScore: 700,
                    contributions: { credit: 50 },
                    metadata: {
                        calculatedAt: new Date(),
                        isRejected: false,
                        provider: normalizedData?.metadata?.provider || 'unknown'
                    },
                    flags: {},
                    validation: {
                        hasValidData: true,
                        dataQuality: { level: 'GOOD', score: 80, percentage: 80 },
                        confidence: { level: 'HIGH', score: 90 }
                    },
                    logTxt: 'Test log output'
                };
            })
        };

        const mockScoringRules = {
            setStrictMode: jest.fn(),
            getRules: jest.fn().mockReturnValue({
                mode: 'sdb-compat',
                debug: false,
                thresholds: { min: 0, max: 1000 }
            }),
            getDefaultRules: jest.fn().mockReturnValue({
                mode: 'sdb-compat',
                debug: false
            })
        };

        const mockAuxLib = {
            createLogRecord: jest.fn().mockReturnValue(12345),
            updateLogWithResponse: jest.fn()
        };

        const mockLog = {
            debug: jest.fn((msg) => logMessages.push({ level: 'debug', ...msg })),
            error: jest.fn((msg) => logMessages.push({ level: 'error', ...msg })),
            audit: jest.fn((msg) => logMessages.push({ level: 'audit', ...msg }))
        };

        const mockCache = {
            Scope: { PROTECTED: 'PROTECTED' },
            getCache: jest.fn().mockReturnValue({
                get: jest.fn().mockReturnValue(null),
                put: jest.fn(),
                remove: jest.fn()
            })
        };

        // Cargar el módulo de servicio con mocks inyectados
        serviceModule = loadServiceModule({
            'N/log': mockLog,
            'N/cache': mockCache,
            '../adapters/equifaxAdapter': mockEquifaxAdapter,
            '../adapters/bcuAdapter': mockBcuAdapter,
            '../adapters/mymAdapter': mockMymAdapter,
            '../domain/score': mockScoreEngine,
            '../config/scoringRules': mockScoringRules,
            '../../ELM_Aux_Lib': mockAuxLib
        });
    });

    test('debería hacer fallback a MYM cuando Equifax falla', () => {
        const documento = '12345678';
        const options = {
            provider: 'equifax',
            debug: true
        };

        // Ejecutar calculateScore - debería fallar con Equifax y usar MYM
        const result = serviceModule.calculateScore(documento, options);

        // Verificaciones
        expect(equifaxFetchCalls).toBe(1); // Se intentó Equifax
        expect(mymFetchCalls).toBe(1);     // Se usó MYM como fallback
        
        // El resultado debería ser exitoso (de MYM)
        expect(result).toBeDefined();
        expect(result.finalScore).toBe(750);
        expect(result.metadata.isRejected).toBe(false);
        
        // Verificar que el provider final sea MYM
        expect(options.provider).toBe('mym');
        
        // Verificar que se logueó el fallback
        const fallbackLog = logMessages.find(
            msg => msg.title === 'BCU Score Provider Fallback'
        );
        expect(fallbackLog).toBeDefined();
        expect(fallbackLog.details.originalProvider).toBe('equifax');
        expect(fallbackLog.details.fallbackTo).toBe('mym');
    });

    test('debería NO hacer fallback si noFallback está activo', () => {
        const documento = '12345678';
        const options = {
            provider: 'equifax',
            noFallback: true, // <-- Deshabilita fallback
            debug: true
        };

        // Ejecutar calculateScore - debería fallar sin intentar MYM
        const result = serviceModule.calculateScore(documento, options);

        // Verificaciones
        expect(equifaxFetchCalls).toBe(1); // Se intentó Equifax
        expect(mymFetchCalls).toBe(0);     // NO se usó MYM

        // El resultado debería ser de error
        expect(result).toBeDefined();
        expect(result.metadata.isRejected).toBe(true);
        expect(result.metadata.rejectionReason).toBe('SERVICE_ERROR');
    });

    test('debería hacer fallback de MYM a Equifax cuando MYM falla', () => {
        // Reconfigurar mocks para este caso específico
        let localEquifaxCalls = 0;
        let localMymCalls = 0;

        const mockEquifaxAdapterSuccess = {
            fetch: jest.fn().mockImplementation((documento, options, periodMonths) => {
                localEquifaxCalls++;
                return { ...MOCK_MYM_NORMALIZED_DATA, documento, metadata: { ...MOCK_MYM_NORMALIZED_DATA.metadata, provider: 'equifax' } };
            })
        };

        const mockMymAdapterFail = {
            fetch: jest.fn().mockImplementation((documento, options) => {
                localMymCalls++;
                throw new Error('MYM_FETCH_ERROR: Servicio MYM no disponible');
            })
        };

        const mockLog = {
            debug: jest.fn((msg) => logMessages.push({ level: 'debug', ...msg })),
            error: jest.fn((msg) => logMessages.push({ level: 'error', ...msg })),
            audit: jest.fn((msg) => logMessages.push({ level: 'audit', ...msg }))
        };

        // Recargar módulo con nuevos mocks
        const svcMod = loadServiceModule({
            'N/log': mockLog,
            'N/cache': {
                Scope: { PROTECTED: 'PROTECTED' },
                getCache: jest.fn().mockReturnValue({
                    get: jest.fn().mockReturnValue(null),
                    put: jest.fn(),
                    remove: jest.fn()
                })
            },
            '../adapters/equifaxAdapter': mockEquifaxAdapterSuccess,
            '../adapters/bcuAdapter': { fetch: jest.fn() },
            '../adapters/mymAdapter': mockMymAdapterFail,
            '../domain/score': {
                computeScore: jest.fn().mockReturnValue({
                    finalScore: 800,
                    rawScore: 800,
                    baseScore: 750,
                    contributions: {},
                    metadata: { calculatedAt: new Date(), isRejected: false },
                    flags: {},
                    validation: { hasValidData: true, dataQuality: { level: 'GOOD' }, confidence: { level: 'HIGH' } }
                })
            },
            '../config/scoringRules': {
                setStrictMode: jest.fn(),
                getRules: jest.fn().mockReturnValue({ mode: 'sdb-compat' }),
                getDefaultRules: jest.fn().mockReturnValue({ mode: 'sdb-compat' })
            },
            '../../ELM_Aux_Lib': {
                createLogRecord: jest.fn().mockReturnValue(99999),
                updateLogWithResponse: jest.fn()
            }
        });

        const documento = '87654321';
        const options = {
            provider: 'mym', // <-- Empezamos con MYM
            debug: true
        };

        const result = svcMod.calculateScore(documento, options);

        // Verificaciones
        expect(localMymCalls).toBe(1);      // Se intentó MYM primero
        expect(localEquifaxCalls).toBe(1);  // Se usó Equifax como fallback

        // El resultado debería ser exitoso
        expect(result).toBeDefined();
        expect(result.finalScore).toBe(800);
        
        // Verificar que el provider cambió a equifax
        expect(options.provider).toBe('equifax');
    });

    test('debería fallar si AMBOS proveedores fallan', () => {
        // Configurar ambos para que fallen
        const mockEquifaxAdapterFail = {
            fetch: jest.fn().mockImplementation(() => {
                throw new EquifaxError('EQUIFAX_SERVER_ERROR');
            })
        };

        const mockMymAdapterFail = {
            fetch: jest.fn().mockImplementation(() => {
                throw new Error('MYM_FETCH_ERROR');
            })
        };

        const svcMod = loadServiceModule({
            'N/log': {
                debug: jest.fn(),
                error: jest.fn(),
                audit: jest.fn()
            },
            'N/cache': {
                Scope: { PROTECTED: 'PROTECTED' },
                getCache: jest.fn().mockReturnValue({
                    get: jest.fn().mockReturnValue(null),
                    put: jest.fn(),
                    remove: jest.fn()
                })
            },
            '../adapters/equifaxAdapter': mockEquifaxAdapterFail,
            '../adapters/bcuAdapter': { fetch: jest.fn() },
            '../adapters/mymAdapter': mockMymAdapterFail,
            '../domain/score': { computeScore: jest.fn() },
            '../config/scoringRules': {
                setStrictMode: jest.fn(),
                getRules: jest.fn().mockReturnValue({ mode: 'sdb-compat' }),
                getDefaultRules: jest.fn().mockReturnValue({})
            },
            '../../ELM_Aux_Lib': {
                createLogRecord: jest.fn().mockReturnValue(11111),
                updateLogWithResponse: jest.fn()
            }
        });

        const documento = '11112222';
        const options = {
            provider: 'equifax',
            debug: true
        };

        const result = svcMod.calculateScore(documento, options);

        // El resultado debería indicar error
        expect(result).toBeDefined();
        expect(result.metadata.isRejected).toBe(true);
        // Se preserva el error original de Equifax (no el de MYM)
        expect(result.metadata.error.message).toContain('EQUIFAX_SERVER_ERROR');
    });
});

/**
 * Carga el módulo de servicio con dependencias mockeadas
 */
function loadServiceModule(dependencyMap) {
    const servicePath = path.join(SUITESCRIPTS_DIR, 'bcuScore', 'app', 'service.js');
    const code = fs.readFileSync(servicePath, 'utf8');
    
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
        Error,
        define: function(deps, factory) {
            const resolved = (deps || []).map((dep) => {
                if (dependencyMap && Object.prototype.hasOwnProperty.call(dependencyMap, dep)) {
                    return dependencyMap[dep];
                }
                // Fallback genérico
                return {};
            });
            capturedModule = factory.apply(null, resolved);
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: servicePath });
    
    return capturedModule;
}
