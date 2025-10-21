/**
 * Test completo de scoring - MYM vs Equifax
 * Ejecuta el motor de score completo y compara resultados
 * 
 * Ejecutar con: node tests/test_full_score_comparison.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// MOCK DE N/log PARA NODE.JS
// ============================================================================
const mockLog = {
    debug: function(title, details) {
        if (process.env.DEBUG) {
            console.log('[DEBUG]', typeof title === 'string' ? title : JSON.stringify(title));
        }
    },
    error: function(title, details) {
        console.error('[ERROR]', typeof title === 'string' ? title : JSON.stringify(title));
    },
    audit: function(title, details) {
        console.log('[AUDIT]', typeof title === 'string' ? title : JSON.stringify(title));
    }
};

// ============================================================================
// TEST DATA
// ============================================================================

const MYM_SAMPLE_NORMAL = {
    "status": "success",
    "data": {
        "documento": "12345678",
        "periodos": {
            "t0": {
                "periodo": "2024-10",
                "entidadesRubrosValores": [
                    {
                        "entidad": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY",
                        "rating": "1C",
                        "rubros": [
                            {
                                "rubro": "PRESTAMOS PERSONALES",
                                "vigente": { "mn": 150000, "me": 5000 },
                                "vencido": { "mn": 0, "me": 0 },
                                "castigado": { "mn": 0, "me": 0 },
                                "cont": false
                            },
                            {
                                "rubro": "TARJETAS DE CREDITO",
                                "vigente": { "mn": 80000, "me": 2000 },
                                "vencido": { "mn": 0, "me": 0 },
                                "castigado": { "mn": 0, "me": 0 },
                                "cont": false
                            }
                        ]
                    },
                    {
                        "entidad": "BBVA URUGUAY S.A.",
                        "rating": "1A",
                        "rubros": [
                            {
                                "rubro": "PRESTAMOS HIPOTECARIOS",
                                "vigente": { "mn": 2500000, "me": 0 },
                                "vencido": { "mn": 0, "me": 0 },
                                "castigado": { "mn": 0, "me": 0 },
                                "cont": false
                            }
                        ]
                    }
                ],
                "totales": {
                    "vigente": { "mn": 2730000, "me": 7000 },
                    "vencido": { "mn": 0, "me": 0 },
                    "castigado": { "mn": 0, "me": 0 },
                    "total": { "mn": 2730000, "me": 7000 }
                }
            },
            "t6": {
                "periodo": "2024-04",
                "entidadesRubrosValores": [
                    {
                        "entidad": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY",
                        "rating": "1C",
                        "rubros": [
                            {
                                "rubro": "PRESTAMOS PERSONALES",
                                "vigente": { "mn": 180000, "me": 6000 },
                                "vencido": { "mn": 0, "me": 0 },
                                "castigado": { "mn": 0, "me": 0 },
                                "cont": false
                            }
                        ]
                    }
                ],
                "totales": {
                    "vigente": { "mn": 180000, "me": 6000 },
                    "vencido": { "mn": 0, "me": 0 },
                    "castigado": { "mn": 0, "me": 0 },
                    "total": { "mn": 180000, "me": 6000 }
                }
            }
        }
    }
};

const EQUIFAX_SAMPLE_NORMAL = {
    "interconnectResponse": {
        "variablesDeSalida": {
            "bcu_calificacion": "1C",
            "bcu_cant_ent_vig": "2",
            "bcu_cant_ent_venc": "0",
            "bcu_cant_ent_cast": "0",
            "bcu_instituciones": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY, BBVA URUGUAY S.A.",
            "bcu_periodo": "OCT2024",
            "bcu_suma_creditos_mn_vig_u1m": "2730000",
            "bcu_suma_creditos_me_vig_u1m": "7000",
            "bcu_suma_creditos_mn_venc_u1m": "0",
            "bcu_suma_creditos_me_venc_u1m": "0",
            "bcu_suma_creditos_mn_cast_u1m": "0",
            "bcu_suma_creditos_me_cast_u1m": "0",
            "bcu_vigente": "Mn: 2730000 Me: 7000",
            "bcu_vencido": "Mn: 0 Me: 0",
            "bcu_castigado": "Mn: 0 Me: 0",
            "bcu_periodo_u6m": "ABR2024",
            "bcu_suma_creditos_mn_vig_u6m": "180000",
            "bcu_suma_creditos_me_vig_u6m": "6000",
            "bcu_suma_creditos_mn_venc_u6m": "0",
            "bcu_suma_creditos_me_venc_u6m": "0",
            "bcu_suma_creditos_mn_cast_u6m": "0",
            "bcu_suma_creditos_me_cast_u6m": "0"
        }
    }
};

// ============================================================================
// NORMALIZERS
// ============================================================================

function parseMoneyString(str) {
    if (!str) return { mn: 0, me: 0 };
    const mnMatch = str.match(/Mn:\s*(\d+)/i);
    const meMatch = str.match(/Me:\s*(\d+)/i);
    return {
        mn: mnMatch ? parseFloat(mnMatch[1]) : 0,
        me: meMatch ? parseFloat(meMatch[1]) : 0
    };
}

function normalizeEquifaxNewFormat(response, documento) {
    const vars = response.interconnectResponse.variablesDeSalida;
    const vigente = parseMoneyString(vars.bcu_vigente);
    const vencido = parseMoneyString(vars.bcu_vencido);
    const castigado = parseMoneyString(vars.bcu_castigado);
    const instituciones = vars.bcu_instituciones ? vars.bcu_instituciones.split(',').map(i => i.trim()) : [];
    
    const entities = instituciones.length > 0 ? instituciones.map(inst => ({
        entidad: inst,
        NombreEntidad: inst,
        rating: vars.bcu_calificacion || '',
        Calificacion: vars.bcu_calificacion || '',
        vigente: { mn: vigente.mn / instituciones.length, me: vigente.me / instituciones.length },
        vencido: { mn: vencido.mn / instituciones.length, me: vencido.me / instituciones.length },
        castigado: { mn: castigado.mn / instituciones.length, me: castigado.me / instituciones.length },
        total: { 
            mn: (vigente.mn + vencido.mn + castigado.mn) / instituciones.length, 
            me: (vigente.me + vencido.me + castigado.me) / instituciones.length 
        },
        rubros: [{
            rubro: 'AGREGADO EQUIFAX',
            Rubro: 'AGREGADO EQUIFAX',
            vigente: { mn: vigente.mn / instituciones.length, me: vigente.me / instituciones.length },
            vencido: { mn: vencido.mn / instituciones.length, me: vencido.me / instituciones.length },
            castigado: { mn: castigado.mn / instituciones.length, me: castigado.me / instituciones.length },
            MnPesos: vigente.mn / instituciones.length,
            MePesos: vigente.me / instituciones.length,
            cont: false
        }]
    })) : [];
    
    const t6_mn = parseFloat(vars.bcu_suma_creditos_mn_vig_u6m || 0);
    const t6_me = parseFloat(vars.bcu_suma_creditos_me_vig_u6m || 0);
    const t6Rubros = instituciones.length > 0 ? [{
        rubro: 'AGREGADO EQUIFAX T6',
        Rubro: 'AGREGADO EQUIFAX T6',
        vigente: { mn: t6_mn / instituciones.length, me: t6_me / instituciones.length },
        vencido: { mn: 0, me: 0 },
        castigado: { mn: 0, me: 0 },
        MnPesos: t6_mn / instituciones.length,
        MePesos: t6_me / instituciones.length,
        cont: false
    }] : [];
    
    return {
        provider: 'equifax',
        documento: documento,
        periodData: {
            t0: {
                periodo: '2024-10',
                totals: {
                    vigente: vigente,
                    vencido: vencido,
                    castigado: castigado,
                    total: { mn: vigente.mn + vencido.mn + castigado.mn, me: vigente.me + vencido.me + castigado.me }
                },
                entities: entities,
                aggregates: {
                    vigente: { mn: vigente.mn, me: vigente.me, total: vigente.mn + vigente.me }
                },
                rubrosValoresGenerales: entities[0]?.rubros || []
            },
            t6: {
                periodo: '2024-04',
                totals: {
                    vigente: { mn: t6_mn, me: t6_me },
                    vencido: { mn: 0, me: 0 },
                    castigado: { mn: 0, me: 0 },
                    total: { mn: t6_mn, me: t6_me }
                },
                entities: [],
                aggregates: {
                    vigente: { mn: t6_mn, me: t6_me }
                },
                rubrosValoresGenerales: t6Rubros
            }
        },
        flags: { isDeceased: false, hasNoData: false },
        metadata: { rating: vars.bcu_calificacion || '', documento: documento }
    };
}

function normalizeMymResponse(response, documento) {
    const periodos = response.data.periodos;
    
    const t0Entities = (periodos.t0.entidadesRubrosValores || []).map(ent => {
        const rubros = (ent.rubros || []).map(rubro => ({
            rubro: rubro.rubro,
            Rubro: rubro.rubro,
            vigente: rubro.vigente || { mn: 0, me: 0 },
            vencido: rubro.vencido || { mn: 0, me: 0 },
            castigado: rubro.castigado || { mn: 0, me: 0 },
            MnPesos: (rubro.vigente?.mn || 0),
            MePesos: (rubro.vigente?.me || 0),
            cont: rubro.cont || false
        }));
        
        const totalVig = rubros.reduce((sum, r) => ({ 
            mn: sum.mn + r.vigente.mn, 
            me: sum.me + r.vigente.me 
        }), { mn: 0, me: 0 });
        
        return {
            entidad: ent.entidad,
            NombreEntidad: ent.entidad,
            rating: ent.rating || '',
            Calificacion: ent.rating || '',
            vigente: totalVig,
            vencido: { mn: 0, me: 0 },
            castigado: { mn: 0, me: 0 },
            total: totalVig,
            rubros: rubros
        };
    });
    
    const t6Entities = (periodos.t6.entidadesRubrosValores || []).map(ent => {
        const rubros = (ent.rubros || []).map(rubro => ({
            rubro: rubro.rubro,
            Rubro: rubro.rubro,
            vigente: rubro.vigente || { mn: 0, me: 0 },
            vencido: rubro.vencido || { mn: 0, me: 0 },
            castigado: rubro.castigado || { mn: 0, me: 0 },
            MnPesos: (rubro.vigente?.mn || 0),
            MePesos: (rubro.vigente?.me || 0),
            cont: rubro.cont || false
        }));
        
        return {
            entidad: ent.entidad,
            NombreEntidad: ent.entidad,
            rating: ent.rating || '',
            Calificacion: ent.rating || '',
            rubros: rubros
        };
    });
    
    return {
        provider: 'mym',
        documento: documento,
        periodData: {
            t0: {
                periodo: periodos.t0.periodo,
                totals: periodos.t0.totales,
                entities: t0Entities,
                aggregates: {
                    vigente: { 
                        mn: periodos.t0.totales.vigente.mn, 
                        me: periodos.t0.totales.vigente.me,
                        total: periodos.t0.totales.vigente.mn + periodos.t0.totales.vigente.me
                    }
                },
                rubrosValoresGenerales: t0Entities[0]?.rubros || []
            },
            t6: {
                periodo: periodos.t6.periodo,
                totals: periodos.t6.totales,
                entities: t6Entities,
                aggregates: {
                    vigente: { 
                        mn: periodos.t6.totales.vigente.mn, 
                        me: periodos.t6.totales.vigente.me 
                    }
                },
                rubrosValoresGenerales: t6Entities[0]?.rubros || []
            }
        },
        flags: { isDeceased: false, hasNoData: false },
        metadata: { rating: periodos.t0?.entidadesRubrosValores?.[0]?.rating || '', documento: documento }
    };
}

// ============================================================================
// SCORING RULES (Mock simplificado)
// ============================================================================

const scoringRules = {
    debug: false,
    goodThreshold: 499,
    baseScore: 0,
    rejectionRules: {
        maxVencido: 1000000,
        maxCastigado: 1000000
    },
    binned: {
        banco_binned: 0.0038032,
        ent_t6_binned: 0.0026394,
        intercept: 0.2114816,
        t6_cred_dir_comp_binned: 0.0028341,
        vig_noauto_t6_coop_binned: 0.0033394,
        t0_bbva_binned: 0.0045863,
        cont_t0_fucac_binned: 0.0038189,
        t0_scotia_binned: 0.0034926,
        t0_asi_binned: 0.0037215,
        brou_grupo_binned: 0.0037486,
        emp_valor_binned: 0.0059208,
        t0_fnb_binned: 0.0014982,
        t0_santa_binned: 0.0006744,
        t6_binned: 0.0005706,
        cred_dir_binned: 0.0002515,
        t6_creditel_binned: 0.0003315,
        t6_oca_binned: 0.0042904,
        t6_pronto_binned: 0.0016738
    }
};

// ============================================================================
// SCORE ENGINE (Versión simplificada del score.js real)
// ============================================================================

function computeScoreSimplified(normalizedData, rules) {
    const log = mockLog;
    
    if (!normalizedData || !rules) {
        throw new Error('Invalid input');
    }
    
    const t0Data = normalizedData.periodData?.t0;
    if (!t0Data || !t0Data.entities) {
        throw new Error('NO_DATA');
    }
    
    const entities = t0Data.entities;
    if (!entities || entities.length === 0) {
        throw new Error('NO_DATA');
    }
    
    // Extract valores
    const t0 = normalizedData.periodData.t0;
    const t6 = normalizedData.periodData.t6;
    
    let t2_mnPesos = -1;
    let t2_mePesos = -1;
    let t6_mnPesos = -1;
    let t6_mePesos = -1;
    
    // Intentar desde rubrosValoresGenerales
    try {
        if (t0.rubrosValoresGenerales && t0.rubrosValoresGenerales[0]) {
            t2_mnPesos = t0.rubrosValoresGenerales[0].MnPesos || -1;
            t2_mePesos = t0.rubrosValoresGenerales[0].MePesos || -1;
        }
    } catch (e) {
        if (t0.aggregates && t0.aggregates.vigente) {
            t2_mnPesos = t0.aggregates.vigente.mn || -1;
            t2_mePesos = t0.aggregates.vigente.me || -1;
        }
    }
    
    try {
        if (t6.rubrosValoresGenerales && t6.rubrosValoresGenerales[0]) {
            t6_mnPesos = t6.rubrosValoresGenerales[0].MnPesos || -1;
            t6_mePesos = t6.rubrosValoresGenerales[0].MePesos || -1;
        }
    } catch (e) {
        if (t6.aggregates && t6.aggregates.vigente) {
            t6_mnPesos = t6.aggregates.vigente.mn || -1;
            t6_mePesos = t6.aggregates.vigente.me || -1;
        }
    }
    
    // Calcular endeudamiento
    let endeudamiento = -314;
    try {
        const t2_total = t2_mnPesos + t2_mePesos;
        const t6_total = t6_mnPesos + t6_mePesos;
        if (t6_total > 0) {
            endeudamiento = (t2_total / t6_total) - 1;
        }
    } catch (e) {
        endeudamiento = -314;
    }
    
    // Construir t2List y t6List (similar a score.js real)
    let t2List = [];
    for (let i = 0; i < entities.length; i++) {
        const e = entities[i];
        t2List.push({
            NombreEntidad: e.NombreEntidad || e.entidad,
            Calificacion: e.Calificacion || e.rating,
            CalificacionMinima0: e.Calificacion || e.rating,
            Cont: false,
            rubros: e.rubros || []
        });
    }
    
    let t6List = [];
    if (t6.entities && t6.entities.length > 0) {
        for (let i = 0; i < t6.entities.length; i++) {
            const e = t6.entities[i];
            t6List.push({
                NombreEntidad: e.NombreEntidad || e.entidad,
                Calificacion: e.Calificacion || e.rating
            });
        }
    }
    
    // Inicializar binned_res
    let ent_t6_binned_res = 0;
    let t6_binned_res = 0;
    let t0_bbva_binned_res = -3.65;
    let brou_grupo_binned_res = -15.44;
    let t0_santa_binned_res = -18.27;
    
    // Contador de entidades T6
    let contador = t6List.length;
    
    // Asignar ent_t6_binned_res según contador
    if (contador === 0 || contador === 1) ent_t6_binned_res = -4.34;
    if (contador === 2 || contador === 3) ent_t6_binned_res = 0;
    if (contador === 4 || contador === 5) ent_t6_binned_res = 42.61;
    if (contador > 5) ent_t6_binned_res = 72;
    
    // Procesar entidades T0
    for (let i = 0; i < t2List.length; i++) {
        const ent = t2List[i];
        const name = (ent.NombreEntidad || '').toUpperCase();
        
        if (name.includes('BBVA')) {
            t0_bbva_binned_res = 0;
        }
        
        if (name.includes('REPUBLICA') || name.includes('BROU')) {
            brou_grupo_binned_res = 33.61;
        }
        
        if (name.includes('SANTANDER')) {
            t0_santa_binned_res = 38.33;
        }
    }
    
    // Obtener coeficientes
    const binned = rules.binned || {};
    const ent_t6_binned = binned.ent_t6_binned || 0.0026394;
    const t6_binned = binned.t6_binned || 0.0005706;
    const t0_bbva_binned = binned.t0_bbva_binned || 0.0045863;
    const brou_grupo_binned = binned.brou_grupo_binned || 0.0037486;
    const t0_santa_binned = binned.t0_santa_binned || 0.0006744;
    const intercept = binned.intercept || 0.2114816;
    
    // Multiplicar por coeficientes
    ent_t6_binned_res = ent_t6_binned_res * ent_t6_binned;
    t6_binned_res = t6_binned_res * t6_binned;
    t0_bbva_binned_res = t0_bbva_binned_res * t0_bbva_binned;
    brou_grupo_binned_res = brou_grupo_binned_res * brou_grupo_binned;
    t0_santa_binned_res = t0_santa_binned_res * t0_santa_binned;
    
    const test = 1 * intercept;
    
    // Total
    const total = test + ent_t6_binned_res + t6_binned_res + t0_bbva_binned_res + 
                   brou_grupo_binned_res + t0_santa_binned_res;
    
    // Función logística
    const exp_total = Math.exp(Math.max(-50, Math.min(50, total)));
    const scoreNumeric = (exp_total / (1 + exp_total)) * 1000;
    const scoreRounded = Math.round(scoreNumeric);
    
    return {
        finalScore: scoreRounded,
        rawScore: scoreNumeric,
        baseScore: rules.baseScore || 0,
        contributions: {
            intercept: test,
            ent_t6_binned: ent_t6_binned_res,
            t6_binned: t6_binned_res,
            t0_bbva_binned: t0_bbva_binned_res,
            brou_grupo_binned: brou_grupo_binned_res,
            t0_santa_binned: t0_santa_binned_res,
            total: total
        },
        metadata: {
            calculatedAt: new Date(),
            isRejected: false,
            rejectionReason: null,
            goodThreshold: rules.goodThreshold || 499,
            isGood: scoreRounded >= (rules.goodThreshold || 499),
            provider: normalizedData.provider
        },
        flags: normalizedData.flags || {},
        validation: { hasValidData: true },
        score: scoreRounded,
        calificacionMinima: t2List[0]?.Calificacion || '0',
        contador: contador,
        endeudamiento: endeudamiento,
        t2_mnPesos: t2_mnPesos,
        t2_mePesos: t2_mePesos,
        t6_mnPesos: t6_mnPesos,
        t6_mePesos: t6_mePesos,
        error_reglas: false
    };
}

// ============================================================================
// MAIN TEST
// ============================================================================

function runFullScoreTest() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST COMPLETO DE SCORING - MYM vs EQUIFAX');
    console.log('='.repeat(80) + '\n');
    
    // Normalizar
    console.log('📊 Paso 1: Normalizando datos...\n');
    const mymNormalized = normalizeMymResponse(MYM_SAMPLE_NORMAL, '12345678');
    const equifaxNormalized = normalizeEquifaxNewFormat(EQUIFAX_SAMPLE_NORMAL, '12345678');
    
    console.log('✅ MYM normalizado - Provider:', mymNormalized.provider);
    console.log('✅ Equifax normalizado - Provider:', equifaxNormalized.provider);
    console.log('');
    
    // Calcular scores
    console.log('⚡ Paso 2: Calculando scores...\n');
    const mymScore = computeScoreSimplified(mymNormalized, scoringRules);
    const equifaxScore = computeScoreSimplified(equifaxNormalized, scoringRules);
    
    console.log('='.repeat(80));
    console.log('📊 RESULTADOS DE SCORING');
    console.log('='.repeat(80) + '\n');
    
    // Resultado MYM
    console.log('🔵 SCORE MYM:');
    console.log('  Provider:           ', mymScore.metadata.provider);
    console.log('  Score Final:        ', mymScore.finalScore);
    console.log('  Score Raw:          ', mymScore.rawScore.toFixed(2));
    console.log('  Endeudamiento:      ', mymScore.endeudamiento.toFixed(6));
    console.log('  T2 Total:           ', (mymScore.t2_mnPesos + mymScore.t2_mePesos));
    console.log('  T6 Total:           ', (mymScore.t6_mnPesos + mymScore.t6_mePesos));
    console.log('  Contador (T6 ent):  ', mymScore.contador);
    console.log('  Calificación:       ', mymScore.calificacionMinima);
    console.log('  Is Good (>=499):    ', mymScore.metadata.isGood);
    console.log('');
    console.log('  Contribuciones:');
    console.log('    intercept:         ', mymScore.contributions.intercept.toFixed(6));
    console.log('    ent_t6_binned:     ', mymScore.contributions.ent_t6_binned.toFixed(6));
    console.log('    t0_bbva_binned:    ', mymScore.contributions.t0_bbva_binned.toFixed(6));
    console.log('    brou_grupo_binned: ', mymScore.contributions.brou_grupo_binned.toFixed(6));
    console.log('    total (logit):     ', mymScore.contributions.total.toFixed(6));
    console.log('');
    
    // Resultado Equifax
    console.log('🟢 SCORE EQUIFAX:');
    console.log('  Provider:           ', equifaxScore.metadata.provider);
    console.log('  Score Final:        ', equifaxScore.finalScore);
    console.log('  Score Raw:          ', equifaxScore.rawScore.toFixed(2));
    console.log('  Endeudamiento:      ', equifaxScore.endeudamiento.toFixed(6));
    console.log('  T2 Total:           ', (equifaxScore.t2_mnPesos + equifaxScore.t2_mePesos));
    console.log('  T6 Total:           ', (equifaxScore.t6_mnPesos + equifaxScore.t6_mePesos));
    console.log('  Contador (T6 ent):  ', equifaxScore.contador);
    console.log('  Calificación:       ', equifaxScore.calificacionMinima);
    console.log('  Is Good (>=499):    ', equifaxScore.metadata.isGood);
    console.log('');
    console.log('  Contribuciones:');
    console.log('    intercept:         ', equifaxScore.contributions.intercept.toFixed(6));
    console.log('    ent_t6_binned:     ', equifaxScore.contributions.ent_t6_binned.toFixed(6));
    console.log('    t0_bbva_binned:    ', equifaxScore.contributions.t0_bbva_binned.toFixed(6));
    console.log('    brou_grupo_binned: ', equifaxScore.contributions.brou_grupo_binned.toFixed(6));
    console.log('    total (logit):     ', equifaxScore.contributions.total.toFixed(6));
    console.log('');
    
    // Comparación
    console.log('='.repeat(80));
    console.log('🔍 COMPARACIÓN');
    console.log('='.repeat(80) + '\n');
    
    const scoreDiff = Math.abs(mymScore.finalScore - equifaxScore.finalScore);
    const endeudamientoDiff = Math.abs(mymScore.endeudamiento - equifaxScore.endeudamiento);
    const totalDiff = Math.abs(mymScore.contributions.total - equifaxScore.contributions.total);
    
    console.log('📈 Diferencias:');
    console.log('  Score Final:       ', scoreDiff, scoreDiff === 0 ? '✅ IDÉNTICO' : '⚠️  DIFERENTE');
    console.log('  Endeudamiento:     ', endeudamientoDiff.toFixed(6), endeudamientoDiff < 0.01 ? '✅ SIMILAR' : '⚠️  DIFERENTE');
    console.log('  Total (logit):     ', totalDiff.toFixed(6), totalDiff < 0.001 ? '✅ SIMILAR' : '⚠️  DIFERENTE');
    console.log('');
    
    console.log('📊 Análisis:');
    console.log('  Mismo contador T6:  ', mymScore.contador === equifaxScore.contador ? '✅ SÍ' : '❌ NO');
    console.log('  Misma calificación: ', mymScore.calificacionMinima === equifaxScore.calificacionMinima ? '✅ SÍ' : '❌ NO');
    console.log('  Mismo provider meta:', mymScore.metadata.provider !== equifaxScore.metadata.provider ? '✅ DIFERENTES' : '❌ IGUALES');
    console.log('');
    
    // Conclusión
    console.log('='.repeat(80));
    if (scoreDiff === 0) {
        console.log('✅ ¡ÉXITO! Ambos providers generan el MISMO score final');
        console.log('   Score: ' + mymScore.finalScore);
    } else if (scoreDiff <= 10) {
        console.log('⚠️  ADVERTENCIA: Scores muy similares pero no idénticos');
        console.log('   MYM: ' + mymScore.finalScore + ', Equifax: ' + equifaxScore.finalScore);
        console.log('   Diferencia: ' + scoreDiff + ' puntos');
    } else {
        console.log('❌ ERROR: Scores significativamente diferentes');
        console.log('   MYM: ' + mymScore.finalScore + ', Equifax: ' + equifaxScore.finalScore);
        console.log('   Diferencia: ' + scoreDiff + ' puntos');
    }
    console.log('='.repeat(80) + '\n');
    
    // Guardar resultados
    const results = {
        timestamp: new Date().toISOString(),
        mym: mymScore,
        equifax: equifaxScore,
        comparison: {
            scoreDiff: scoreDiff,
            endeudamientoDiff: endeudamientoDiff,
            totalDiff: totalDiff,
            identical: scoreDiff === 0,
            similar: scoreDiff <= 10
        }
    };
    
    const outputPath = path.join(__dirname, 'full_score_comparison_results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log('📁 Resultados completos guardados en:', outputPath);
    console.log('');
}

// Ejecutar test
try {
    runFullScoreTest();
} catch (error) {
    console.error('❌ ERROR EN TEST:', error.message);
    console.error(error.stack);
    process.exit(1);
}
