/**
 * @description Test completo del flujo S1 REST con ambos providers (MYM vs Equifax)
 * Simula la llamada a bcuScoreLib.scoreFinal() con ambos providers y compara respuestas
 */

// Mock de N/log para Node.js
const N_log = {
    debug: (config) => console.log(`[DEBUG] ${config.title}:`, config.details || ''),
    audit: (config) => console.log(`[AUDIT] ${config.title}:`, config.details || ''),
    error: (config) => console.error(`[ERROR] ${config.title}:`, config.details || '')
};

// Mock N/cache (sin implementación real para testing)
const N_cache = {
    Scope: { PROTECTED: 'PROTECTED' },
    getCache: () => ({
        get: () => null,
        put: () => {},
        remove: () => {}
    })
};

// Inyectar mocks globales
global.log = N_log;
global.define = function(deps, factory) {
    // Para simplificar, asumimos que todos los módulos están disponibles
    const modules = deps.map(dep => {
        if (dep === 'N/log') return N_log;
        if (dep === 'N/cache') return N_cache;
        if (dep === 'N/https') return null; // No usado en este test
        if (dep === 'N/runtime') return null;
        if (dep === 'N/encode') return null;
        return null;
    });
    return factory.apply(null, modules);
};

// ============================================================================
// SAMPLE DATA (mismo que test_full_score_comparison.js)
// ============================================================================

const MYM_SAMPLE_NORMAL = {
    datosBcu: {
        bcuRawData: null,
        data: {
            Nombre: 'JUAN PEREZ',
            Documento: '12345678',
            TipoDocumento: 'IDE',
            SectorActividad: 'COMERCIO',
            Periodo: '202401',
            RubrosValoresGenerales: [
                { Rubro: 'VIGENTE', MnPesos: 120000, MePesos: 35000 },
                { Rubro: 'VENCIDO', MnPesos: 0, MePesos: 0 },
                { Rubro: 'CASTIGADO', MnPesos: 0, MePesos: 0 }
            ],
            EntidadesRubrosValores: [
                {
                    NombreEntidad: 'REPUBLICA',
                    Calificacion: '1C',
                    Rubros: [
                        { Rubro: 'VIGENTE', MnPesos: 120000, MePesos: 35000 },
                        { Rubro: 'VENCIDO', MnPesos: 0, MePesos: 0 },
                        { Rubro: 'CASTIGADO', MnPesos: 0, MePesos: 0 }
                    ]
                }
            ]
        },
        errors: null,
        responseId: '12345-test'
    },
    datosBcuT6: {
        bcuRawData: null,
        data: {
            Nombre: 'JUAN PEREZ',
            Documento: '12345678',
            TipoDocumento: 'IDE',
            SectorActividad: 'COMERCIO',
            Periodo: '202312',
            RubrosValoresGenerales: [
                { Rubro: 'VIGENTE', MnPesos: 150000, MePesos: 36000 },
                { Rubro: 'VENCIDO', MnPesos: 0, MePesos: 0 },
                { Rubro: 'CASTIGADO', MnPesos: 0, MePesos: 0 }
            ],
            EntidadesRubrosValores: [
                {
                    NombreEntidad: 'REPUBLICA',
                    Calificacion: '1C',
                    Rubros: [
                        { Rubro: 'VIGENTE', MnPesos: 150000, MePesos: 36000 },
                        { Rubro: 'VENCIDO', MnPesos: 0, MePesos: 0 },
                        { Rubro: 'CASTIGADO', MnPesos: 0, MePesos: 0 }
                    ]
                }
            ]
        },
        errors: null,
        responseId: '12345-test-t6'
    },
    raw: {}
};

const EQUIFAX_SAMPLE_NORMAL = {
    interconnectResponse: {
        infoConsulta: {
            fallecido: 'N',
            fechaConsulta: '2024-01-15'
        },
        variablesDeSalida: {
            nombre: 'JUAN PEREZ',
            documento: '12345678',
            vigente: 'Me: 35000 Mn: 120000',
            vencido: 'Me: 0 Mn: 0',
            castigado: 'Me: 0 Mn: 0',
            bcu_calificacion: '1C',
            bcu_instituciones: 'BROU',
            vigente_u6m: 'Me: 36000 Mn: 150000',
            vencido_u6m: 'Me: 0 Mn: 0',
            castigado_u6m: 'Me: 0 Mn: 0',
            calificacion_u6m: '1C',
            instituciones_u6m: 'BROU'
        }
    }
};

// ============================================================================
// HELPER: Parse Money String
// ============================================================================

function parseMoneyString(str) {
    if (!str || typeof str !== 'string') return { mn: 0, me: 0, total: 0 };
    
    const mnMatch = str.match(/Mn:\s*([\d.]+)/i);
    const meMatch = str.match(/Me:\s*([\d.]+)/i);
    
    const mn = mnMatch ? parseFloat(mnMatch[1]) : 0;
    const me = meMatch ? parseFloat(meMatch[1]) : 0;
    
    return { mn, me, total: mn + me };
}

// ============================================================================
// NORMALIZERS (copiados de test_full_score_comparison.js)
// ============================================================================

function normalizeEquifaxNewFormat(raw) {
    const interconnect = (raw && raw.interconnectResponse) || {};
    const variables = interconnect.variablesDeSalida || {};
    const infoConsulta = interconnect.infoConsulta || {};

    const isDeceased = String(infoConsulta.fallecido || '').toUpperCase() === 'S';
    if (isDeceased) {
        return {
            provider: 'equifax',
            documento: variables.documento || '',
            periodData: { t0: createEmptyPeriod(), t6: createEmptyPeriod() },
            flags: { isDeceased: true, hasRejectableRating: false },
            metadata: { nombre: variables.nombre, fechaConsulta: infoConsulta.fechaConsulta }
        };
    }

    const vigente = parseMoneyString(variables.vigente || 'Me: 0 Mn: 0');
    const vencido = parseMoneyString(variables.vencido || 'Me: 0 Mn: 0');
    const castigado = parseMoneyString(variables.castigado || 'Me: 0 Mn: 0');
    const calificacion = variables.bcu_calificacion || '0';
    const instituciones = (variables.bcu_instituciones || '').split(',').map(i => i.trim()).filter(Boolean);

    const vigenteU6m = parseMoneyString(variables.vigente_u6m || 'Me: 0 Mn: 0');
    const vencidoU6m = parseMoneyString(variables.vencido_u6m || 'Me: 0 Mn: 0');
    const castigadoU6m = parseMoneyString(variables.castigado_u6m || 'Me: 0 Mn: 0');
    const calificacionU6m = variables.calificacion_u6m || '0';
    const institucionesU6m = (variables.instituciones_u6m || '').split(',').map(i => i.trim()).filter(Boolean);

    const t0Entities = instituciones.map(inst => ({
        nombre: inst,
        calificacion: calificacion,
        rubros: [
            { rubro: 'VIGENTE', mnPesos: vigente.mn / instituciones.length, mePesos: vigente.me / instituciones.length, MnPesos: vigente.mn / instituciones.length, MePesos: vigente.me / instituciones.length },
            { rubro: 'VENCIDO', mnPesos: vencido.mn / instituciones.length, mePesos: vencido.me / instituciones.length, MnPesos: vencido.mn / instituciones.length, MePesos: vencido.me / instituciones.length },
            { rubro: 'CASTIGADO', mnPesos: castigado.mn / instituciones.length, mePesos: castigado.me / instituciones.length, MnPesos: castigado.mn / instituciones.length, MePesos: castigado.me / instituciones.length }
        ]
    }));

    const t6Entities = institucionesU6m.map(inst => ({
        nombre: inst,
        calificacion: calificacionU6m,
        rubros: [
            { rubro: 'VIGENTE', mnPesos: vigenteU6m.mn / institucionesU6m.length, mePesos: vigenteU6m.me / institucionesU6m.length, MnPesos: vigenteU6m.mn / institucionesU6m.length, MePesos: vigenteU6m.me / institucionesU6m.length },
            { rubro: 'VENCIDO', mnPesos: vencidoU6m.mn / institucionesU6m.length, mePesos: vencidoU6m.me / institucionesU6m.length, MnPesos: vencidoU6m.mn / institucionesU6m.length, MePesos: vencidoU6m.me / institucionesU6m.length },
            { rubro: 'CASTIGADO', mnPesos: castigadoU6m.mn / institucionesU6m.length, mePesos: castigadoU6m.me / institucionesU6m.length, MnPesos: castigadoU6m.mn / institucionesU6m.length, MePesos: castigadoU6m.me / institucionesU6m.length }
        ]
    }));

    const BAD_RATINGS = ['2B', '2', '3', '4', '5'];
    const hasRejectableRating = BAD_RATINGS.includes(calificacion) || BAD_RATINGS.includes(calificacionU6m);

    return {
        provider: 'equifax',
        documento: variables.documento || '',
        periodData: {
            t0: {
                totals: [
                    { rubro: 'VIGENTE', mnPesos: vigente.mn, mePesos: vigente.me, MnPesos: vigente.mn, MePesos: vigente.me },
                    { rubro: 'VENCIDO', mnPesos: vencido.mn, mePesos: vencido.me, MnPesos: vencido.mn, MePesos: vencido.me },
                    { rubro: 'CASTIGADO', mnPesos: castigado.mn, mePesos: castigado.me, MnPesos: castigado.mn, MePesos: castigado.me }
                ],
                entities: t0Entities,
                aggregates: { vigente, vencido, castigado, total: vigente.total + vencido.total + castigado.total }
            },
            t6: {
                totals: [
                    { rubro: 'VIGENTE', mnPesos: vigenteU6m.mn, mePesos: vigenteU6m.me, MnPesos: vigenteU6m.mn, MePesos: vigenteU6m.me },
                    { rubro: 'VENCIDO', mnPesos: vencidoU6m.mn, mePesos: vencidoU6m.me, MnPesos: vencidoU6m.mn, MePesos: vencidoU6m.me },
                    { rubro: 'CASTIGADO', mnPesos: castigadoU6m.mn, mePesos: castigadoU6m.me, MnPesos: castigadoU6m.mn, MePesos: castigadoU6m.me }
                ],
                entities: t6Entities,
                aggregates: { vigente: vigenteU6m, vencido: vencidoU6m, castigado: castigadoU6m, total: vigenteU6m.total + vencidoU6m.total + castigadoU6m.total }
            }
        },
        flags: { isDeceased: false, hasRejectableRating },
        metadata: {
            nombre: variables.nombre,
            worstRating: calificacion,
            fechaConsulta: infoConsulta.fechaConsulta
        }
    };
}

function normalizeMymResponse(mymResponse, documento) {
    const datosBcu = mymResponse.datosBcu;
    const datosBcuT6 = mymResponse.datosBcuT6;

    if (!datosBcu || !datosBcu.data) {
        throw new Error('MYM response sin datosBcu');
    }

    const t0Data = datosBcu.data;
    const t6Data = datosBcuT6 && datosBcuT6.data ? datosBcuT6.data : null;

    function normalizeMymRubros(rubros) {
        return (rubros || []).map(r => ({
            rubro: (r.Rubro || '').toUpperCase(),
            mnPesos: parseFloat(r.MnPesos) || 0,
            mePesos: parseFloat(r.MePesos) || 0,
            MnPesos: parseFloat(r.MnPesos) || 0,
            MePesos: parseFloat(r.MePesos) || 0
        }));
    }

    function normalizeMymEntities(entities) {
        return (entities || []).map(e => ({
            nombre: (e.NombreEntidad || '').toUpperCase(),
            calificacion: e.Calificacion || '0',
            rubros: normalizeMymRubros(e.Rubros)
        }));
    }

    function extractAggregates(rubros) {
        const vigente = rubros.find(r => r.rubro === 'VIGENTE') || { mnPesos: 0, mePesos: 0 };
        const vencido = rubros.find(r => r.rubro === 'VENCIDO') || { mnPesos: 0, mePesos: 0 };
        const castigado = rubros.find(r => r.rubro === 'CASTIGADO') || { mnPesos: 0, mePesos: 0 };
        return {
            vigente: { mn: vigente.mnPesos, me: vigente.mePesos, total: vigente.mnPesos + vigente.mePesos },
            vencido: { mn: vencido.mnPesos, me: vencido.mePesos, total: vencido.mnPesos + vencido.mePesos },
            castigado: { mn: castigado.mnPesos, me: castigado.mePesos, total: castigado.mnPesos + castigado.mePesos }
        };
    }

    const t0Rubros = normalizeMymRubros(t0Data.RubrosValoresGenerales);
    const t0Entities = normalizeMymEntities(t0Data.EntidadesRubrosValores);
    const t0Aggregates = extractAggregates(t0Rubros);

    const t6Rubros = t6Data ? normalizeMymRubros(t6Data.RubrosValoresGenerales) : [];
    const t6Entities = t6Data ? normalizeMymEntities(t6Data.EntidadesRubrosValores) : [];
    const t6Aggregates = t6Data ? extractAggregates(t6Rubros) : { vigente: {mn:0,me:0,total:0}, vencido: {mn:0,me:0,total:0}, castigado: {mn:0,me:0,total:0} };

    const allEntities = t0Entities.concat(t6Entities);
    const BAD_RATINGS = ['2B', '2', '3', '4', '5'];
    const worstRating = allEntities.reduce((worst, e) => {
        const idx = BAD_RATINGS.indexOf(e.calificacion);
        if (idx > BAD_RATINGS.indexOf(worst)) return e.calificacion;
        return worst;
    }, '0');
    const hasRejectableRating = BAD_RATINGS.includes(worstRating);

    return {
        provider: 'mym',
        documento: documento,
        periodData: {
            t0: { totals: t0Rubros, entities: t0Entities, aggregates: t0Aggregates },
            t6: { totals: t6Rubros, entities: t6Entities, aggregates: t6Aggregates }
        },
        flags: { isDeceased: false, hasRejectableRating },
        metadata: { nombre: t0Data.Nombre, worstRating }
    };
}

function createEmptyPeriod() {
    return {
        totals: [],
        entities: [],
        aggregates: { vigente: {mn:0,me:0,total:0}, vencido: {mn:0,me:0,total:0}, castigado: {mn:0,me:0,total:0} }
    };
}

// ============================================================================
// SCORING ENGINE (simplificado de test_full_score_comparison.js)
// ============================================================================

const SCORING_RULES = {
    binned: {
        intercept: 0.2114816,
        ent_t6_binned: 0.0026394,
        brou_grupo_binned: 0.0037486,
        t0_bbva_binned: 0.0045863,
        banco_binned: 0.0038032,
        t6_cred_dir_comp_binned: 0.0028341,
        vig_noauto_t6_coop_binned: 0.0033394,
        cont_t0_fucac_binned: 0.0038189,
        t0_scotia_binned: 0.0034926,
        t0_asi_binned: 0.0037215,
        emp_valor_binned: 0.0059208,
        t0_fnb_binned: 0.0014982,
        t0_santa_binned: 0.0006744,
        t6_binned: 0.0005706,
        cred_dir_binned: 0.0002515,
        t6_creditel_binned: 0.0003315,
        t6_oca_binned: 0.0042904,
        t6_pronto_binned: 0.0016738
    },
    aliases: {
        brou: ['REPUBLICA', 'BROU', 'BANCO REPUBLICA'],
        vizcaya: ['VIZCAYA', 'BBVA', 'BANCO BILBAO'],
        santander: ['SANTANDER']
    }
};

function computeScoreSimplified(normalizedData, rules) {
    const periodData = normalizedData.periodData || {};
    const t0 = periodData.t0 || createEmptyPeriod();
    const t6 = periodData.t6 || createEmptyPeriod();

    // Extraer t2/t6 desde rubrosValoresGenerales[0] o aggregates
    let t2_mn = 0, t2_me = 0, t6_mn = 0, t6_me = 0;

    if (t0.totals && t0.totals.length > 0 && t0.totals[0].MnPesos !== undefined) {
        t2_mn = parseFloat(t0.totals[0].MnPesos) || 0;
        t2_me = parseFloat(t0.totals[0].MePesos) || 0;
    } else if (t0.aggregates) {
        t2_mn = (t0.aggregates.vigente?.mn || 0) + (t0.aggregates.vencido?.mn || 0) + (t0.aggregates.castigado?.mn || 0);
        t2_me = (t0.aggregates.vigente?.me || 0) + (t0.aggregates.vencido?.me || 0) + (t0.aggregates.castigado?.me || 0);
    }

    if (t6.totals && t6.totals.length > 0 && t6.totals[0].MnPesos !== undefined) {
        t6_mn = parseFloat(t6.totals[0].MnPesos) || 0;
        t6_me = parseFloat(t6.totals[0].MePesos) || 0;
    } else if (t6.aggregates) {
        t6_mn = (t6.aggregates.vigente?.mn || 0) + (t6.aggregates.vencido?.mn || 0) + (t6.aggregates.castigado?.mn || 0);
        t6_me = (t6.aggregates.vigente?.me || 0) + (t6.aggregates.vencido?.me || 0) + (t6.aggregates.castigado?.me || 0);
    }

    const t2_total = t2_mn + t2_me;
    const t6_total = t6_mn + t6_me;
    const endeudamiento = t6_total > 0 ? ((t2_total / t6_total) - 1) : -1;

    // Construir listas de entidades
    const t2List = (t0.entities || []).map(e => e.nombre.toUpperCase());
    const t6List = (t6.entities || []).map(e => e.nombre.toUpperCase());
    const contador = t6List.length;

    // Asignar binned_res según instituciones
    const hasBROU = t2List.some(n => (rules.aliases.brou || []).some(alias => n.includes(alias.toUpperCase())));
    const hasBBVA = t2List.some(n => (rules.aliases.vizcaya || []).some(alias => n.includes(alias.toUpperCase())));

    const ent_t6_binned_res = contador === 0 ? -4.341065 : (contador === 1 ? -4.341065 : 7.726115);
    const brou_grupo_binned_res = hasBROU ? 33.605932 : 0;
    const t0_bbva_binned_res = hasBBVA ? 0 : 0;

    // Calcular logit
    const contributions = {
        intercept: rules.binned.intercept,
        ent_t6_binned: rules.binned.ent_t6_binned * ent_t6_binned_res,
        t0_bbva_binned: rules.binned.t0_bbva_binned * t0_bbva_binned_res,
        brou_grupo_binned: rules.binned.brou_grupo_binned * brou_grupo_binned_res
    };

    const total = contributions.intercept + contributions.ent_t6_binned + 
                  contributions.t0_bbva_binned + contributions.brou_grupo_binned;

    // Aplicar función logística
    const rawScore = (Math.exp(total) / (1 + Math.exp(total))) * 1000;
    const finalScore = Math.round(rawScore);

    return {
        finalScore,
        rawScore,
        endeudamiento,
        t2Total: t2_total,
        t6Total: t6_total,
        contador,
        contributions,
        total,
        calificacionMinima: normalizedData.metadata?.worstRating || '0'
    };
}

// ============================================================================
// SIMULACIÓN DE bcuScoreLib.scoreFinal()
// ============================================================================

function simulateBcuScoreLib(documento, options, sampleData) {
    const provider = options.provider || 'mym';
    
    // Normalizar datos según provider
    let normalized;
    if (provider === 'mym') {
        normalized = normalizeMymResponse(sampleData, documento);
    } else if (provider === 'equifax') {
        normalized = normalizeEquifaxNewFormat(sampleData);
    } else {
        throw new Error('Provider no soportado: ' + provider);
    }

    // Calcular score
    const scoreResult = computeScoreSimplified(normalized, SCORING_RULES);

    // Mapear a formato legacy (como lo hace ELM_SCORE_BCU_LIB.js)
    return {
        score: scoreResult.finalScore,
        calificacionMinima: scoreResult.calificacionMinima,
        contador: scoreResult.contador,
        mensaje: 'No tenemos prestamo disponible en este momento',
        endeudamiento: scoreResult.endeudamiento,
        nombre: normalized.metadata?.nombre || '',
        error_reglas: false,
        logTxt: `Score: ${scoreResult.finalScore} | Calif: ${scoreResult.calificacionMinima} | Endeud: ${scoreResult.endeudamiento.toFixed(6)}`
    };
}

// ============================================================================
// TEST PRINCIPAL - SIMULACIÓN DEL FLUJO S1 REST
// ============================================================================

function runS1RestFlowTest() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST FLUJO S1 REST - COMPARACIÓN MYM vs EQUIFAX');
    console.log('='.repeat(80) + '\n');

    const docNumber = '12345678';

    console.log('📋 CASO DE PRUEBA:');
    console.log(`   Documento: ${docNumber}`);
    console.log(`   Caso: Cliente normal con deuda BROU (calificación 1C)`);
    console.log(`   T2 Total: 155,000 (Mn) + 35,000 (Me) = 190,000`);
    console.log(`   T6 Total: 150,000 (Mn) + 36,000 (Me) = 186,000`);
    console.log('');

    // ========================================================================
    // SIMULACIÓN 1: Provider MYM
    // ========================================================================
    console.log('🔵 SIMULACIÓN 1: Provider MYM');
    console.log('-'.repeat(80));

    let scoreMym;
    try {
        scoreMym = simulateBcuScoreLib(docNumber, { 
            provider: 'mym', 
            forceRefresh: true, 
            strictRules: true, 
            debug: true 
        }, MYM_SAMPLE_NORMAL);

        console.log('✅ Respuesta MYM:');
        console.log(`   score:              ${scoreMym.score}`);
        console.log(`   calificacionMinima: ${scoreMym.calificacionMinima}`);
        console.log(`   contador:           ${scoreMym.contador}`);
        console.log(`   endeudamiento:      ${scoreMym.endeudamiento.toFixed(6)}`);
        console.log(`   nombre:             ${scoreMym.nombre}`);
        console.log(`   error_reglas:       ${scoreMym.error_reglas}`);
        console.log(`   mensaje:            ${scoreMym.mensaje}`);
        console.log('');
    } catch (error) {
        console.error('❌ ERROR en MYM:', error.message);
        scoreMym = null;
    }

    // ========================================================================
    // SIMULACIÓN 2: Provider EQUIFAX
    // ========================================================================
    console.log('🟢 SIMULACIÓN 2: Provider EQUIFAX');
    console.log('-'.repeat(80));

    let scoreEquifax;
    try {
        scoreEquifax = simulateBcuScoreLib(docNumber, { 
            provider: 'equifax', 
            forceRefresh: true, 
            strictRules: true, 
            debug: true 
        }, EQUIFAX_SAMPLE_NORMAL);

        console.log('✅ Respuesta EQUIFAX:');
        console.log(`   score:              ${scoreEquifax.score}`);
        console.log(`   calificacionMinima: ${scoreEquifax.calificacionMinima}`);
        console.log(`   contador:           ${scoreEquifax.contador}`);
        console.log(`   endeudamiento:      ${scoreEquifax.endeudamiento.toFixed(6)}`);
        console.log(`   nombre:             ${scoreEquifax.nombre}`);
        console.log(`   error_reglas:       ${scoreEquifax.error_reglas}`);
        console.log(`   mensaje:            ${scoreEquifax.mensaje}`);
        console.log('');
    } catch (error) {
        console.error('❌ ERROR en EQUIFAX:', error.message);
        scoreEquifax = null;
    }

    // ========================================================================
    // COMPARACIÓN DE RESPUESTAS
    // ========================================================================
    console.log('🔍 COMPARACIÓN DE RESPUESTAS');
    console.log('='.repeat(80));

    if (!scoreMym || !scoreEquifax) {
        console.log('❌ ERROR: No se pudieron obtener ambas respuestas');
        return;
    }

    const comparisons = [
        { field: 'score', mym: scoreMym.score, equifax: scoreEquifax.score },
        { field: 'calificacionMinima', mym: scoreMym.calificacionMinima, equifax: scoreEquifax.calificacionMinima },
        { field: 'contador', mym: scoreMym.contador, equifax: scoreEquifax.contador },
        { field: 'endeudamiento', mym: scoreMym.endeudamiento.toFixed(6), equifax: scoreEquifax.endeudamiento.toFixed(6) },
        { field: 'error_reglas', mym: scoreMym.error_reglas, equifax: scoreEquifax.error_reglas }
    ];

    let allMatch = true;
    comparisons.forEach(comp => {
        const match = String(comp.mym) === String(comp.equifax);
        const symbol = match ? '✅' : '⚠️';
        const status = match ? 'IGUAL' : 'DIFERENTE';
        
        console.log(`${symbol} ${comp.field.padEnd(20)} | MYM: ${String(comp.mym).padEnd(15)} | EQUIFAX: ${String(comp.equifax).padEnd(15)} | ${status}`);
        
        if (!match) allMatch = false;
    });

    console.log('');
    console.log('='.repeat(80));
    
    if (allMatch) {
        console.log('✅ ¡ÉXITO! AMBOS PROVIDERS GENERAN LA MISMA RESPUESTA');
        console.log(`   Score Final: ${scoreMym.score}`);
    } else {
        console.log('⚠️  DIFERENCIAS DETECTADAS ENTRE PROVIDERS');
        console.log('   Revisar normalizadores o datos de prueba');
    }
    
    console.log('='.repeat(80) + '\n');

    // ========================================================================
    // VALIDACIÓN ADICIONAL: Flujo S1 REST
    // ========================================================================
    console.log('📊 VALIDACIÓN FLUJO S1 REST');
    console.log('-'.repeat(80));

    // Simular validación de score.error_reglas (línea 115 de S1_REST.js)
    if (scoreMym.error_reglas) {
        console.log('❌ FLUJO RECHAZADO: score.error_reglas === true');
        console.log('   → Se asignaría estado "BCU" y se retornaría error');
    } else {
        console.log('✅ FLUJO CONTINÚA: score.error_reglas === false');
    }

    // Simular validación de calificación N/C (línea 131 de S1_REST.js)
    if (scoreMym.calificacionMinima === 'N/C') {
        console.log('❌ FLUJO RECHAZADO: calificacionMinima === "N/C"');
    } else {
        console.log('✅ FLUJO CONTINÚA: calificacionMinima válida');
    }

    // Simular validación de score mínimo (línea 152 de S1_REST.js)
    const scoreMin = 499; // scoreMin de parámetros
    if (scoreMym.score > scoreMin) {
        console.log(`✅ FLUJO APROBADO: score (${scoreMym.score}) > scoreMin (${scoreMin})`);
        console.log('   → Se convertiría a Lead y calcularía oferta');
    } else {
        console.log(`❌ FLUJO RECHAZADO: score (${scoreMym.score}) <= scoreMin (${scoreMin})`);
        console.log('   → Se rechazaría con motivo "No hay oferta"');
    }

    console.log('-'.repeat(80) + '\n');

    // ========================================================================
    // RESULTADO JSON (para debugging/logging)
    // ========================================================================
    const result = {
        test: 's1_rest_flow',
        documento: docNumber,
        timestamp: new Date().toISOString(),
        mym: scoreMym,
        equifax: scoreEquifax,
        comparison: {
            scoreMatch: scoreMym.score === scoreEquifax.score,
            calificacionMatch: scoreMym.calificacionMinima === scoreEquifax.calificacionMinima,
            contadorMatch: scoreMym.contador === scoreEquifax.contador,
            errorReglasMatch: scoreMym.error_reglas === scoreEquifax.error_reglas,
            allMatch: allMatch
        }
    };

    require('fs').writeFileSync('s1_rest_flow_test_results.json', JSON.stringify(result, null, 2));
    console.log('📁 Resultados guardados en: s1_rest_flow_test_results.json\n');
}

// ============================================================================
// EJECUTAR TEST
// ============================================================================

if (require.main === module) {
    runS1RestFlowTest();
}
