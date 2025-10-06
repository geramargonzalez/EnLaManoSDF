/**
 * @ ApiVersion 2.1
 * @description Lógica pura de scoring BCU sin efectos secundarios
 */

define(['N/search'], function (search) {
    'use strict';

    // Pre-compilar lookup tables para performance O(1)
    const RATING_ORDER = {
        '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
    };
    const BAD_RATINGS_SET = { '2B': true, '3': true, '4': true, '5': true };

    // Helper: convertir valores a número de forma segura (evita NaN)
    function toNumberSafe(v) {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return (isFinite(n) ? n : 0);
    }

    // Helpers para analizar rubros (conservativos y seguros)
    function containsContingency(rubros) {
        if (!Array.isArray(rubros)) return false;
        for (let i = 0; i < rubros.length; i++) {
            const r = rubros[i] || {};
            const tipo = (r.tipo || '').toString().toLowerCase();
            if (tipo.indexOf('cont') === 0 || tipo.indexOf('conting') > -1 || (r.cont && r.cont === true)) return true;
        }
        return false;
    }

    function containsVigenciaRubro(rubros) {
        if (!Array.isArray(rubros)) return false;
        for (let i = 0; i < rubros.length; i++) {
            const r = rubros[i] || {};
            if (r.vig || r.vigente || r.vigencia) return true;
            const clave = (r.nombre || r.tipo || '').toString().toLowerCase();
            if (clave.indexOf('vig') === 0) return true;
        }
        return false;
    }

    function lookupNumber(fieldName) {
        if (!lookup || !(fieldName in lookup)) return 0;
        const raw = lookup[fieldName];
        if (Array.isArray(raw) && raw.length) {
            return toNumberSafe(raw[0].value);
        }
        return toNumberSafe(raw);
    }

    function getBinnedValue(binnedKey, lookupFieldName) {
        if (binnedFromRules && typeof binnedFromRules[binnedKey] === 'number') return binnedFromRules[binnedKey];
        return lookupNumber(lookupFieldName);
    }

    /**
     * OPTIMIZADO: Scoring O(n) con mínimas operaciones y early exits
     */
    function computeScore(normalizedData, scoringRules) {
        // Validación mínima
        if (!normalizedData || !scoringRules) {
            return createRejectedScore('INVALID_INPUT', 'Datos inválidos');
        }

        const rejectionRules = scoringRules.rejectionRules;
        const flags = normalizedData.flags || {};

        // Early exit: fallecido (más común)
        if (rejectionRules && rejectionRules.isDeceased && flags.isDeceased) {
            return createRejectedScore('DECEASED', 'Persona fallecida');
        }

        // Early exit: mal rating (segundo más común)
        if (flags.hasRejectableRating) {
            return createRejectedScore('BAD_RATING', 'Calificación de rechazo');
        }

        const t0Data = normalizedData.periodData && normalizedData.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return createRejectedScore('NO_DATA', 'Sin datos para scoring');
        }

        const entities = t0Data.entities;
        const entityCount = entities.length;

        // Calcular totales en una sola pasada O(n)
        const totals = { vigente: 0, vencido: 0, castigado: 0 };
        let worstRatingValue = 0;
        let worstRating = '0';

        for (let i = 0; i < entityCount; i++) {
            let entity = entities[i];
            totals.vigente += entity.vigente || 0;
            totals.vencido += entity.vencido || 0;
            totals.castigado += entity.castigado || 0;
            
            // Worst rating en mismo loop
            const rating = String(entity.rating || '').toUpperCase();
            const ratingValue = RATING_ORDER[rating] || 0;
            if (ratingValue > worstRatingValue) {
                worstRatingValue = ratingValue;
                worstRating = rating;
            }
        }

        // Early exit: límites de deuda
        if (rejectionRules && rejectionRules.maxVencido && totals.vencido > rejectionRules.maxVencido) {
            return createRejectedScore('EXCESS_VENCIDO', 'Deuda vencida excesiva');
        }
        if (rejectionRules && rejectionRules.maxCastigado && totals.castigado > rejectionRules.maxCastigado) {
            return createRejectedScore('EXCESS_CASTIGADO', 'Deuda castigada excesiva');
        }

        // Ahora replicamos la lógica de pasos 2-5 del SDB-Enlamano-score.js

        // Preferir valores inyectados en scoringRules.binned (evita lookupFields y mejora rendimiento)
        const binnedFromRules = scoringRules?.binned ?? null;

        // Si no recibimos binned desde las reglas, hacemos un único lookupFields
        let lookup = null;
        if (!binnedFromRules) {
            try {
                lookup = search.lookupFields({
                    type: 'customrecord_sdb_score',
                    id: 1,
                    columns: [
                        'custrecord_sdb_banco_binned',
                        'custrecord_sdb_ent_t6_binned',
                        'custrecord_sdb_intercept',
                        'custrecord_sdb_t6_cred_dir_comp_binned',
                        'custrecord_sdb_vig_noauto_t6_coop_binned',
                        'custrecord_sdb_woe_cont_t0_bbva_binned',
                        'custrecord_sdb_woe_cont_t0_fucac_binned',
                        'custrecord_sdb_woe_cont_t0_scotia_binned',
                        'custrecord_sdb_woe_t0_asi_binned',
                        'custrecord_sdb_woe_t0_brou_grupo_binned',
                        'custrecord_sdb_woe_t0_emp_valor_binned',
                        'custrecord_sdb_woe_t0_fnb_binned',
                        'custrecord_sdb_woe_t0_santa_binned',
                        'custrecord_sdb_woe_t6_binned',
                        'custrecord_sdb_woe_t6_cred_dir_binned',
                        'custrecord_sdb_woe_t6_creditel_binned',
                        'custrecord_sdb_woe_t6_oca_binned',
                        'custrecord_sdb_woe_t6_pronto_binned'
                    ]
                });
            } catch (e) {
                lookup = null;
            }
        }

    

        // Valores por defecto (WOE) tomados del screenshot proporcionado
        const banco_binned = getBinnedValue('banco_binned', 'custrecord_sdb_banco_binned') || 0.0038032;
        const ent_t6_binned = getBinnedValue('ent_t6_binned', 'custrecord_sdb_ent_t6_binned') || 0.0026394;
        const intercept = getBinnedValue('intercept', 'custrecord_sdb_intercept') || 0.2114816;
        const t6_cred_dir_comp_binned = getBinnedValue('t6_cred_dir_comp_binned', 'custrecord_sdb_t6_cred_dir_comp_binned') || 0.0028341;
        const vig_noauto_t6_coop_binned = getBinnedValue('vig_noauto_t6_coop_binned', 'custrecord_sdb_vig_noauto_t6_coop_binned') || 0.0033394;
        const t0_bbva_binned = getBinnedValue('t0_bbva_binned', 'custrecord_sdb_woe_cont_t0_bbva_binned') || 0.0045863;
        const cont_t0_fucac_binned = getBinnedValue('cont_t0_fucac_binned', 'custrecord_sdb_woe_cont_t0_fucac_binned') || 0.0038189;
        const t0_scotia_binned = getBinnedValue('t0_scotia_binned', 'custrecord_sdb_woe_cont_t0_scotia_binned') || 0.0034926;
        const t0_asi_binned = getBinnedValue('t0_asi_binned', 'custrecord_sdb_woe_t0_asi_binned') || 0.0037215;
        const brou_grupo_binned = getBinnedValue('brou_grupo_binned', 'custrecord_sdb_woe_t0_brou_grupo_binned') || 0.0037486;
        const emp_valor_binned = getBinnedValue('emp_valor_binned', 'custrecord_sdb_woe_t0_emp_valor_binned') || 0.0059208;
        const t0_fnb_binned = getBinnedValue('t0_fnb_binned', 'custrecord_sdb_woe_t0_fnb_binned') || 0.0014982;
        const t0_santa_binned = getBinnedValue('t0_santa_binned', 'custrecord_sdb_woe_t0_santa_binned') || 0.0006744;
        const t6_binned = getBinnedValue('t6_binned', 'custrecord_sdb_woe_t6_binned') || 0.0005706;
        const cred_dir_binned = getBinnedValue('cred_dir_binned', 'custrecord_sdb_woe_t6_cred_dir_binned') || 0.0002515;
        const t6_creditel_binned = getBinnedValue('t6_creditel_binned', 'custrecord_sdb_woe_t6_creditel_binned') || 0.0003315;
        const t6_oca_binned = getBinnedValue('t6_oca_binned', 'custrecord_sdb_woe_t6_oca_binned') || 0.0042904;
        const t6_pronto_binned = getBinnedValue('t6_pronto_binned', 'custrecord_sdb_woe_t6_pronto_binned') || 0.0016738;


        // Inicializar resultados parciales (mismos nombres que en el original)
        let cred_dir_binned_res = 0;
        let ent_t6_binned_res = 0;
        let t6_binned_res = 0;
        let t6_creditel_binned_res = 0;
        let t6_oca_binned_res = 0;
        let t0_fnb_binned_res = 0;
        let t0_scotia_binned_res = 0;
        let t0_asi_binned_res = 0;
        let t0_bbva_binned_res = 0;
        let t6_cred_dir_comp_binned_res = 0;
        let t6_banco_binned_res = 0;
        let vig_noauto_t6_coop_binned_res = 0;
        let t0_santa_binned_res = 0;
        let emp_valor_binned_res = 0;
        let cont_t0_fucac_binned_res = 0;
        let brou_grupo_binned_res = 0;
        let t6_pronto_binned_res = 0;

        // Preparar datos t0/t6 desde normalizedData (normalizer asegura formato uniforme)
        let t0 = (normalizedData.periodData && normalizedData.periodData.t0) || { entities: [], aggregates: {} };
        let t6 = (normalizedData.periodData && normalizedData.periodData.t6) || { entities: [], aggregates: {} };

        // Extraer Mn/Me desde múltiples fuentes posibles (compatibilidad con diferentes formatos de normalizer)
        let t2_mnPesos = -1;
        let t2_mePesos = -1;
        let t6_mnPesos = -1;
        let t6_mePesos = -1;

        // Intentar desde aggregates.vigente (formato normalizado)
        if (t0.aggregates && t0.aggregates.vigente) {
            t2_mnPesos = toNumberSafe(t0.aggregates.vigente.mn) || toNumberSafe(t0.aggregates.vigente.MnPesos) || -1;
            t2_mePesos = toNumberSafe(t0.aggregates.vigente.me) || toNumberSafe(t0.aggregates.vigente.MePesos) || -1;
        }
        
        // Intentar desde rubrosValoresGenerales (formato original BCU)
        if (t2_mnPesos === -1 && t0.aggregates && t0.aggregates.rubrosValoresGenerales && Array.isArray(t0.aggregates.rubrosValoresGenerales)) {
            for (let i = 0; i < t0.aggregates.rubrosValoresGenerales.length; i++) {
                let rubro = t0.aggregates.rubrosValoresGenerales[i];
                if ((rubro.rubro || rubro.Rubro || '').toString().toUpperCase().indexOf('VIGENTE') === 0) {
                    t2_mnPesos = toNumberSafe(rubro.mnPesos || rubro.MnPesos);
                    t2_mePesos = toNumberSafe(rubro.mePesos || rubro.MePesos);
                    break;
                }
            }
        }

        // Lo mismo para t6
        if (t6.aggregates && t6.aggregates.vigente) {
            t6_mnPesos = toNumberSafe(t6.aggregates.vigente.mn) || toNumberSafe(t6.aggregates.vigente.MnPesos) || -1;
            t6_mePesos = toNumberSafe(t6.aggregates.vigente.me) || toNumberSafe(t6.aggregates.vigente.MePesos) || -1;
        }
        
        if (t6_mnPesos === -1 && t6.aggregates && t6.aggregates.rubrosValoresGenerales && Array.isArray(t6.aggregates.rubrosValoresGenerales)) {
            for (let i = 0; i < t6.aggregates.rubrosValoresGenerales.length; i++) {
                let rubro = t6.aggregates.rubrosValoresGenerales[i];
                if ((rubro.rubro || rubro.Rubro || '').toString().toUpperCase().indexOf('VIGENTE') === 0) {
                    t6_mnPesos = toNumberSafe(rubro.mnPesos || rubro.MnPesos);
                    t6_mePesos = toNumberSafe(rubro.mePesos || rubro.MePesos);
                    break;
                }
            }
        }

        // Calcular endeudamiento seguro
        let endeudamiento = null;
        if ((t6_mnPesos + t6_mePesos) > 0) {
            endeudamiento = ((t2_mnPesos + t2_mePesos) / (t6_mnPesos + t6_mePesos)) - 1;
        } else {
            endeudamiento = -314; // mismo valor por defecto en el original
        }

        // Construir estructuras t2/t6 similares a las del original para las comprobaciones por NombreEntidad y Calificacion
        let objectCalification = { '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10 };

        let t2List = [];
        for (let i = 0; i < (t0.entities || []).length; i++) {
            let e = t0.entities[i];
            t2List.push({
                NombreEntidad: e.entidad || e.nombreEntidad || '',
                Calificacion: (e.rating || e.calificacion || '').toString(),
                CalificacionMinima0: objectCalification[(e.rating || e.calificacion || '')] || 0,
                Cont: containsContingency(e.rubros || []),
                vig: containsVigenciaRubro(e.rubros || [])
            });
        }

        let t6List = [];
        for (let p = 0; p < (t6.entities || []).length; p++) {
            let e2 = t6.entities[p];
            t6List.push({
                NombreEntidad: e2.entidad || e2.nombreEntidad || '',
                Calificacion: (e2.rating || e2.calificacion || '').toString(),
                CalificacionMinima: objectCalification[(e2.rating || e2.calificacion || '')] || 0,
                Cont: containsContingency(e2.rubros || []),
                vig: containsVigenciaRubro(e2.rubros || [])
            });
        }

        // ent_t6_binned_res según cantidad de entidades en t6 (usar la misma semántica que el original; note: original usa coma en 72, 80 -> efectivamente 80)
        let t6len = t6List.length;
        if (t6len === 0 || t6len === 1) ent_t6_binned_res = -63.64;
        else if (t6len === 2 || t6len === 3) ent_t6_binned_res = 8;
        else if (t6len === 4 || t6len === 5) ent_t6_binned_res = 34.84;
        else if (t6len > 5) ent_t6_binned_res = 80; // replicando el comportamiento del original

        // recorrer t6 para asignaciones por entidad
        let contador = 0;
        let min = 0;
        let objectMin = {};
        for (let k = 0; k < t6List.length; k++) {
            let current = t6List[k];
            if ((current.CalificacionMinima || 0) >= min) {
                min = current.CalificacionMinima || 0;
                objectMin = current;
            }
        }

        // t6 por calificacion
        if ((objectMin.CalificacionMinima || 0) >= 5) {
            t6_binned_res = -9.95;
        }

        for (let key in t6List) {
            let current = t6List[key];
            contador = contador + 1;

            if (t6_binned_res !== -9.95) {
                if (!current.Calificacion || current.Calificacion === '') {
                    t6_binned_res = -68.53;
                } else if (current.Calificacion === '2B' && t6_binned_res !== 14.88) {
                    t6_binned_res = 14.88;
                } else if (['1C', '1A', '2A', '0'].indexOf(current.Calificacion) > -1) {
                    t6_binned_res = 31.94;
                }
            }

            // creditel (SOCUR)
            if ((current.NombreEntidad || '').indexOf('SOCUR') > -1) {
                t6_creditel_binned_res = 40.62;
            } else if (t6_creditel_binned_res !== 40.62) {
                t6_creditel_binned_res = -17.15;
            }

            // OCA
            if ((current.NombreEntidad || '').indexOf('OCA') > -1 && (current.Calificacion === '1C' || current.Calificacion === '1A')) {
                t6_oca_binned_res = 50.39;
            } else if (t6_oca_binned_res !== 50.39) {
                t6_oca_binned_res = -15.16;
            }

            // CREDITOS DIRECTOS / cred_dir_binned_res (replicar la lógica tal cual del original, incluyendo su quirks)
            if ((current.NombreEntidad || '').indexOf('CREDITOS DIRECTOS') > -1 && (current.Calificacion === '1C' || current.Calificacion === '2A')) {
                cred_dir_binned_res = 30.77;
            } else if ((current.NombreEntidad || '').indexOf('CREDITOS DIRECTOS') > -1 && cred_dir_binned_res !== 30.77 && (current.Calificacion !== '2A' || current.Calificacion !== '1C')) {
                cred_dir_binned_res = -90.18;
            }
            if (cred_dir_binned_res !== 30.77 && cred_dir_binned_res !== -90.18) {
                cred_dir_binned_res = -4.12;
            }

            // t6_cred_dir_comp_binned_res
            if ((current.NombreEntidad || '').indexOf('CREDITOS DIRECTOS') > -1) {
                t6_cred_dir_comp_binned_res = 37.78;
            } else if (t6_cred_dir_comp_binned_res !== 37.78) {
                t6_cred_dir_comp_binned_res = -4.35;
            }

            // bancos (IMPORTANTE: replicar bug de precedencia del original)
            if ((current.NombreEntidad || '').indexOf('Vizcaya') > -1 || (current.NombreEntidad || '').indexOf('Bandes') > -1 || (current.NombreEntidad || '').indexOf('Banco Ita') > -1 || (current.NombreEntidad || '').indexOf('Santander') > -1 || (current.NombreEntidad || '').indexOf('Scotiabank') > -1 || (current.NombreEntidad || '').indexOf('HSBC') > -1 && (current.Calificacion === '1A' || current.Calificacion === '1C' || current.Calificacion === '2A')) {
                t6_banco_binned_res = 51.06;
            } else if (t6_banco_binned_res !== 51.06) {
                t6_banco_binned_res = -37.55;
            }

            // cooperativas no auto
            if (!current.vig && current.Calificacion) {
                if (((current.NombreEntidad || '').indexOf('ANDA') > -1) || ((current.NombreEntidad || '').indexOf('FUCEREP') > -1) || ((current.NombreEntidad || '').indexOf('ACAC') > -1)) {
                    vig_noauto_t6_coop_binned_res = 48.55;
                } else if (!current.vig && vig_noauto_t6_coop_binned_res !== 48.55) {
                    vig_noauto_t6_coop_binned_res = -23.52;
                }
            }

            // BAUTZEN pronto
            if ((current.NombreEntidad || '').indexOf('BAUTZEN') > -1 && current.Calificacion) {
                t6_pronto_binned_res = 36.73;
            } else if (t6_pronto_binned_res !== 36.73) {
                t6_pronto_binned_res = -7.86;
            }
        }

        // Reaplicar ent_t6_binned_res según contador (el original recalcula)
        if (contador === 0 || contador === 1) ent_t6_binned_res = -63.64;
        else if (contador === 2 || contador === 3) ent_t6_binned_res = 8;
        else if (contador === 4 || contador === 5) ent_t6_binned_res = 34.84;
        else if (contador > 5) ent_t6_binned_res = 80;

    // Para t0 (t2) - recorrer y asignar binned_res similares
    // permitimos reasignar el objeto ganador durante el recorrido
    let object0Min = { CalificacionMinima0: 0 };
        for (let kk = 0; kk < t2List.length; kk++) {
            if ((t2List[kk].CalificacionMinima0 || 0) >= (object0Min.CalificacionMinima0 || 0)) {
                object0Min = t2List[kk];
            }
        }

        for (let key2 in t2List) {
            let currentt2 = t2List[key2];

            if ((currentt2.NombreEntidad || '').indexOf('Integrales') > -1 && currentt2.Calificacion) {
                t0_asi_binned_res = 67.86;
            } else if (t0_asi_binned_res !== 67.86) {
                t0_asi_binned_res = -4.94;
            }

            if (currentt2.Cont && (currentt2.NombreEntidad || '').indexOf('Vizcaya') > -1) {
                t0_bbva_binned_res = 79.39;
            } else if (t0_bbva_binned_res !== 79.39) {
                t0_bbva_binned_res = -3.65;
            }

            // t0_fnb_binned_res según object0.CalificacionMinima0
            if ((object0Min.CalificacionMinima0 === 2 || object0Min.CalificacionMinima0 === 1)) {
                if (((currentt2.NombreEntidad || '').indexOf('Integrales') > -1) || ((currentt2.NombreEntidad || '').indexOf('BAUTZEN') > -1) || ((currentt2.NombreEntidad || '').indexOf('CREDITOS DIRECTOS') > -1) || ((currentt2.NombreEntidad || '').indexOf('Emprendimientos') > -1) || ((currentt2.NombreEntidad || '').indexOf('Microfinanzas') > -1) || ((currentt2.NombreEntidad || '').indexOf('OCA') > -1) || ((currentt2.NombreEntidad || '').indexOf('PASS CARD') > -1) || ((currentt2.NombreEntidad || '').indexOf('Promotora') > -1) || ((currentt2.NombreEntidad || '').indexOf('Republica Microfinazas') > -1) || ((currentt2.NombreEntidad || '').indexOf('RETOP') > -1) || ((currentt2.NombreEntidad || '').indexOf('CIA') > -1) || ((currentt2.NombreEntidad || '').indexOf('SOCUR') > -1) || ((currentt2.NombreEntidad || '').indexOf('VERENDY') > -1)) {
                    t0_fnb_binned_res = 14.06;
                }
            } else if (object0Min.CalificacionMinima0 === 3 && t0_fnb_binned_res !== 14.06) {
                if (((currentt2.NombreEntidad || '').indexOf('Integrales') > -1) || ((currentt2.NombreEntidad || '').indexOf('BAUTZEN') > -1) || ((currentt2.NombreEntidad || '').indexOf('CREDITOS DIRECTOS') > -1) || ((currentt2.NombreEntidad || '').indexOf('Emprendimientos') > -1) || ((currentt2.NombreEntidad || '').indexOf('Microfinanzas') > -1) || ((currentt2.NombreEntidad || '').indexOf('OCA') > -1) || ((currentt2.NombreEntidad || '').indexOf('PASS CARD') > -1) || ((currentt2.NombreEntidad || '').indexOf('Promotora') > -1) || ((currentt2.NombreEntidad || '').indexOf('Republica Microfinazas') > -1) || ((currentt2.NombreEntidad || '').indexOf('RETOP') > -1) || ((currentt2.NombreEntidad || '').indexOf('CIA') > -1) || ((currentt2.NombreEntidad || '').indexOf('SOCUR') > -1) || ((currentt2.NombreEntidad || '').indexOf('VERENDY') > -1)) {
                    t0_fnb_binned_res = -6.06;
                }
            } else if (t0_fnb_binned_res !== 14.06 && t0_fnb_binned_res !== -6.06) {
                t0_fnb_binned_res = -42.71;
            }
        }

        // Más bloques del original (t0_scotia, emp_valor, fucac, brou, santa, scotia, etc.)
        for (let key3 in t2List) {
            let currentt2 = t2List[key3];

            if (currentt2.Cont && (currentt2.NombreEntidad || '').indexOf('Scotiabank') > -1) {
                t0_scotia_binned_res = 74.04;
            } else if (t0_scotia_binned_res !== 74.04) {
                t0_scotia_binned_res = -4.16;
            }

            if ((currentt2.NombreEntidad || '').indexOf('Emprendimientos') > -1 && currentt2.Calificacion) {
                emp_valor_binned_res = 124.21;
            } else if (emp_valor_binned_res !== 124.21) {
                emp_valor_binned_res = -4.46;
            }

            if ((currentt2.NombreEntidad || '').indexOf('FUCAC') > -1 && currentt2.Cont) {
                cont_t0_fucac_binned_res = 74.16;
            } else if (cont_t0_fucac_binned_res !== 74.16) {
                cont_t0_fucac_binned_res = -7.01;
            }

            if ((currentt2.NombreEntidad || '').indexOf('República') > -1 && currentt2.Calificacion) {
                brou_grupo_binned_res = 33.61;
            } else if (brou_grupo_binned_res !== 33.61) {
                brou_grupo_binned_res = -15.44;
            }

            if ((currentt2.NombreEntidad || '').indexOf('Santander') > -1) {
                t0_santa_binned_res = 38.33;
            } else if (t0_santa_binned_res !== 38.33) {
                t0_santa_binned_res = -18.27;
            }
        }

        // Calculo final: multiplicar por bins y sumar (limpio y canónico)
        ent_t6_binned_res = ent_t6_binned_res * (ent_t6_binned || 1);
        t6_binned_res = t6_binned_res * (t6_binned || 1);
        t6_creditel_binned_res = t6_creditel_binned_res * (t6_creditel_binned || 1);
        t6_oca_binned_res = t6_oca_binned_res * (t6_oca_binned || 1);
        t0_fnb_binned_res = t0_fnb_binned_res * (t0_fnb_binned || 1);
        t0_asi_binned_res = t0_asi_binned_res * (t0_asi_binned || 1);
        t0_bbva_binned_res = t0_bbva_binned_res * (t0_bbva_binned || 1);
        t6_cred_dir_comp_binned_res = t6_cred_dir_comp_binned_res * (t6_cred_dir_comp_binned || 1);
        t6_banco_binned_res = t6_banco_binned_res * (banco_binned || 1);
        vig_noauto_t6_coop_binned_res = vig_noauto_t6_coop_binned_res * (vig_noauto_t6_coop_binned || 1);
        t0_santa_binned_res = t0_santa_binned_res * (t0_santa_binned || 1);
        emp_valor_binned_res = emp_valor_binned_res * (emp_valor_binned || 1);
        cont_t0_fucac_binned_res = cont_t0_fucac_binned_res * (cont_t0_fucac_binned || 1);
        brou_grupo_binned_res = brou_grupo_binned_res * (brou_grupo_binned || 1);
        t6_pronto_binned_res = t6_pronto_binned_res * (t6_pronto_binned || 1);
        t0_scotia_binned_res = t0_scotia_binned_res * (t0_scotia_binned || 1);
        cred_dir_binned_res = cred_dir_binned_res * (cred_dir_binned || 1);

        // Intercept / test contribution (mantener compatibilidad con el original)
        let test = 1 * (intercept || 0.211);

        // Sumar todas las contribuciones para obtener el logit total
        let total = test + ent_t6_binned_res + t6_binned_res + t6_creditel_binned_res + t6_oca_binned_res + t0_fnb_binned_res + t0_asi_binned_res + t0_bbva_binned_res + t6_cred_dir_comp_binned_res + t6_banco_binned_res + vig_noauto_t6_coop_binned_res + t0_santa_binned_res + emp_valor_binned_res + cont_t0_fucac_binned_res + brou_grupo_binned_res + t6_pronto_binned_res + t0_scotia_binned_res + cred_dir_binned_res;

        // Aplicar función logística y escalar a 0-1000 (igual que el original)
        let scoreNumeric = (Math.exp(total) / (1 + Math.exp(total))) * 1000;
        let scoreRounded = Math.round(scoreNumeric);

        // Umbral configurable para considerar "buen score" (por defecto 499)
        const goodThreshold = (scoringRules && typeof scoringRules.goodThreshold === 'number') ? scoringRules.goodThreshold : 499;

        // Construir logTxt extenso con toda la información de debugging (formato compatible con SDB-Enlamano-score.js)
        let logTxt = '<P>En scoring...</P>';
        
        // Log de datos BCU originales (t0 y t6)
        logTxt += '<P> => datosBcu: </P>';
        try {
            logTxt += JSON.stringify({
                bcuRawData: normalizedData.rawData || null,
                data: {
                    nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || '',
                    documento: (normalizedData.metadata && normalizedData.metadata.documento) || null,
                    sectorActividad: (normalizedData.metadata && normalizedData.metadata.sectorActividad) || '',
                    periodo: (t0.metadata && t0.metadata.periodo) || '',
                    rubrosValoresGenerales: (t0.aggregates && t0.aggregates.rubrosValoresGenerales) || [],
                    entidadesRubrosValores: (t0.entities || []).map(function(e) {
                        return {
                            nombreEntidad: e.entidad || e.nombreEntidad || '',
                            calificacion: e.rating || e.calificacion || '',
                            rubrosValores: e.rubros || []
                        };
                    })
                },
                errors: (normalizedData.errors) || null,
                responseId: (normalizedData.responseId) || '00000000-0000-0000-0000-000000000000'
            }) + '<P/>';
        } catch (e) {
            logTxt += '[Error serializing t0 data]<P/>';
        }

        logTxt += '<P> => datosBcu_T6: </P>';
        try {
            logTxt += JSON.stringify({
                bcuRawData: null,
                data: {
                    nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || '',
                    documento: (normalizedData.metadata && normalizedData.metadata.documento) || null,
                    sectorActividad: (normalizedData.metadata && normalizedData.metadata.sectorActividad) || '',
                    periodo: (t6.metadata && t6.metadata.periodo) || '',
                    rubrosValoresGenerales: (t6.aggregates && t6.aggregates.rubrosValoresGenerales) || [],
                    entidadesRubrosValores: (t6.entities || []).map(function(e) {
                        return {
                            nombreEntidad: e.entidad || e.nombreEntidad || '',
                            calificacion: e.rating || e.calificacion || '',
                            rubrosValores: e.rubros || []
                        };
                    })
                },
                errors: null,
                responseId: '00000000-0000-0000-0000-000000000000'
            }) + '<P/>';
        } catch (e) {
            logTxt += '[Error serializing t6 data]<P/>';
        }

        // Log de cálculo de endeudamiento
        logTxt += '<P> ***************** ENDEUDAMIENTO comienzo ****************** </P>';
        logTxt += '<P> +++++ t2_mnPesos: ' + t2_mnPesos + '<P/>';
        logTxt += '<P> +++++ t2_mePesos: ' + t2_mePesos + '<P/>';
        logTxt += '<P> +++++ t6_mnPesos: ' + t6_mnPesos + '<P/>';
        logTxt += '<P> +++++ t6_mePesos: ' + t6_mePesos + '<P/>';
        logTxt += '<P> +++++ endeudamiento: ' + endeudamiento + '<P/>';
        logTxt += '<P> ***************** ENDEUDAMIENTO fin ****************** </P>';

        // Log de entidades procesadas en t6
        for (let i = 0; i < t6List.length; i++) {
            logTxt += '<P> => t6: [object Object]</P>';
        }

        // Log de resultados de scoring por variable
        logTxt += '<P/> ent_t6_binned_res: ' + ent_t6_binned_res + '<P/>';
        logTxt += ' t6_binned_res: ' + t6_binned_res + '<P/>';
        logTxt += ' t6_creditel_binned_res: ' + t6_creditel_binned_res + '<P/>';
        logTxt += ' t6_oca_binned_res: ' + t6_oca_binned_res + '<P/>';
        logTxt += ' t0_fnb_binned_res: ' + t0_fnb_binned_res + '<P/>';
        logTxt += ' t0_asi_binned_res: ' + t0_asi_binned_res + '<P/>';
        logTxt += ' t0_bbva_binned_res: ' + t0_bbva_binned_res + '<P/>';
        logTxt += ' t6_cred_dir_comp_binned_res: ' + t6_cred_dir_comp_binned_res + '<P/>';
        logTxt += ' t6_banco_binned_res: ' + t6_banco_binned_res + '<P/>';
        logTxt += ' vig_noauto_t6_coop_binned_res: ' + vig_noauto_t6_coop_binned_res + '<P/>';
        logTxt += ' t0_santa_binned_res: ' + t0_santa_binned_res + '<P/>';
        logTxt += ' cont_t0_fucac_binned_res: ' + cont_t0_fucac_binned_res + '<P/>';
        logTxt += ' brou_grupo_binned_res: ' + brou_grupo_binned_res + '<P/>';
        logTxt += ' t6_pronto_binned_res: ' + t6_pronto_binned_res + '<P/>';
        logTxt += ' t0_scotia_binned_res: ' + t0_scotia_binned_res + '<P/>';
        logTxt += ' cred_dir_binned_res: ' + cred_dir_binned_res + '<P/>';
        logTxt += ' total: ' + total + '<P/>';
        logTxt += ' score: ' + scoreRounded;

        // Construir objeto similar al original para compatibilidad total
        let objetos = { 
            score: scoreRounded,
            calificacionMinima: (normalizedData.metadata && normalizedData.metadata.worstRating) || '0',
            contador: contador,
            mensaje: 'No tenemos prestamo disponible en este momento',
            endeudamiento: endeudamiento,
            nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || normalizedData.provider || '',
            error_reglas: false,
            logTxt: logTxt
        };

        return objetos;
    }

    /**
     * Verifica reglas de rechazo automático
     */
    function checkAutoRejection(data, rejectionRules) {
        if (!rejectionRules) {
            return { isRejected: false };
        }

        // Persona fallecida
        if (rejectionRules.isDeceased && data.flags.isDeceased) {
            return { 
                isRejected: true, 
                reason: 'DECEASED', 
                message: 'Persona fallecida' 
            };
        }

        // Calificación mala
        if (rejectionRules.badRatings && data.flags.hasRejectableRating) {
            let worstRating = extractWorstRating(data);
            if (rejectionRules.badRatings.includes(worstRating)) {
                return { 
                    isRejected: true, 
                    reason: 'BAD_RATING', 
                    message: 'Calificación rechazo automático: ' + worstRating 
                };
            }
        }

        // Deuda vencida excesiva
        if (rejectionRules.maxVencido) {
            let totalVencido = extractTotalByType(data, 'vencido');
            if (totalVencido > rejectionRules.maxVencido) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_VENCIDO', 
                    message: 'Deuda vencida excesiva: ' + totalVencido 
                };
            }
        }

        // Deuda castigada excesiva
        if (rejectionRules.maxCastigado) {
            let totalCastigado = extractTotalByType(data, 'castigado');
            if (totalCastigado > rejectionRules.maxCastigado) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_CASTIGADO', 
                    message: 'Deuda castigada excesiva: ' + totalCastigado 
                };
            }
        }

        // Deuda total excesiva
        if (rejectionRules.maxTotalDebt) {
            let totalDebt = extractTotalByType(data, 'vigente') + 
                           extractTotalByType(data, 'vencido') + 
                           extractTotalByType(data, 'castigado');
            if (totalDebt > rejectionRules.maxTotalDebt) {
                return { 
                    isRejected: true, 
                    reason: 'EXCESS_TOTAL_DEBT', 
                    message: 'Deuda total excesiva: ' + totalDebt 
                };
            }
        }

        return { isRejected: false };
    }

    /**
     * Calcula contribución de un tipo de deuda (vigente, vencido, castigado)
     */
    function calculateDebtContribution(totalAmount, coefficients) {
        if (!coefficients || totalAmount <= 0) {
            return { 
                rawValue: totalAmount, 
                impact: 0, 
                applied: false,
                reason: totalAmount <= 0 ? 'No debt' : 'No coefficients'
            };
        }

        let threshold = coefficients.threshold || 0;
        let weight = coefficients.weight || 0;
        let maxImpact = coefficients.maxImpact || -1;

        // Solo aplicar si supera el threshold
        if (totalAmount <= threshold) {
            return { 
                rawValue: totalAmount, 
                impact: 0, 
                applied: false,
                reason: 'Below threshold: ' + threshold
            };
        }

        // Calcular impacto proporcional
        let excessAmount = totalAmount - threshold;
        let rawImpact = (excessAmount / 100000) * weight; // Normalizar por 100K

        // Aplicar límite máximo
        let finalImpact = Math.max(maxImpact, rawImpact);

        return {
            rawValue: totalAmount,
            threshold: threshold,
            excessAmount: excessAmount,
            weight: weight,
            rawImpact: rawImpact,
            impact: finalImpact,
            applied: true,
            cappedAtMax: rawImpact < maxImpact
        };
    }

    /**
     * Calcula contribución por cantidad de entidades
     */
    function calculateEntityCountContribution(entityCount, coefficients) {
        if (!coefficients || entityCount <= 0) {
            return { 
                rawValue: entityCount, 
                impact: 0, 
                applied: false 
            };
        }

        const threshold = coefficients.threshold || 0;
        const weight = coefficients.weight || 0;
        const maxImpact = coefficients.maxImpact || -1;

        if (entityCount <= threshold) {
            return { 
                rawValue: entityCount, 
                impact: 0, 
                applied: false,
                reason: 'Below threshold: ' + threshold
            };
        }

        const excessEntities = entityCount - threshold;
        const rawImpact = excessEntities * weight;
        const finalImpact = Math.max(maxImpact, rawImpact);

        return {
            rawValue: entityCount,
            threshold: threshold,
            excessEntities: excessEntities,
            weight: weight,
            rawImpact: rawImpact,
            impact: finalImpact,
            applied: true,
            cappedAtMax: rawImpact < maxImpact
        };
    }

    /**
     * Calcula contribución de la peor calificación
     */
    function calculateWorstRatingContribution(worstRating, ratingPenalties) {
        if (!ratingPenalties || !worstRating) {
            return { 
                rawValue: worstRating, 
                impact: 0, 
                applied: false 
            };
        }

        const penalty = ratingPenalties[worstRating] || 0;

        return {
            rawValue: worstRating,
            penalty: penalty,
            impact: penalty,
            applied: penalty !== 0
        };
    }

    /**
     * Calcula contribución por trending (comparación t0 vs t6)
     */
    function calculateTrendingContribution(data, trendingConfig) {
        if (!trendingConfig || !trendingConfig.enabled) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'Trending disabled'
            };
        }

        const t0Data = data.periodData.t0;
        const t6Data = data.periodData.t6;

        if (!t0Data || !t6Data || !t0Data.entities || !t6Data.entities) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'Insufficient historical data'
            };
        }

        // Calcular totales para ambos períodos
        const t0Total = calculatePeriodTotal(t0Data);
        const t6Total = calculatePeriodTotal(t6Data);

        if (t6Total === 0) {
            return { 
                impact: 0, 
                applied: false,
                reason: 'No t6 data for comparison'
            };
        }

        // Calcular cambio porcentual
        const percentChange = (t0Total - t6Total) / t6Total;
        const threshold = trendingConfig.thresholdPercentage || 0.1;

        // Solo aplicar trending si el cambio es significativo
        if (Math.abs(percentChange) < threshold) {
            return {
                t0Total: t0Total,
                t6Total: t6Total,
                percentChange: percentChange,
                impact: 0,
                applied: false,
                reason: 'Change below threshold: ' + (threshold * 100) + '%'
            };
        }

        // Determinar si es mejora o empeoramiento
        let impact = 0;
        let trendType = '';

        if (percentChange < 0) { // Reducción de deuda = mejora
            impact = trendingConfig.improvementBonus || 0;
            trendType = 'improvement';
        } else { // Aumento de deuda = empeoramiento
            impact = trendingConfig.deteriorationPenalty || 0;
            trendType = 'deterioration';
        }

        return {
            t0Total: t0Total,
            t6Total: t6Total,
            percentChange: percentChange,
            trendType: trendType,
            impact: impact,
            applied: true
        };
    }

    /**
     * Calcula total de deudas para un período
     */
    function calculatePeriodTotal(periodData) {
        if (!periodData.entities || !Array.isArray(periodData.entities)) {
            return 0;
        }

        return periodData.entities.reduce(function(total, entity) {
            return total + (entity.vigente || 0) + (entity.vencido || 0) + (entity.castigado || 0);
        }, 0);
    }

    /**
     * Extrae total por tipo de deuda de los datos normalizados
     */
    function extractTotalByType(data, type) {
        const t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return 0;
        }

        return t0Data.entities.reduce(function(total, entity) {
            return total + (entity[type] || 0);
        }, 0);
    }

    /**
     * Extrae cantidad total de entidades
     */
    function extractEntityCount(data) {
        const t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return 0;
        }
        
        return t0Data.entities.length;
    }

    /**
     * Extrae la peor calificación de los metadatos
     */
    function extractWorstRating(data) {
        if (data.metadata && data.metadata.worstRating) {
            return data.metadata.worstRating;
        }

        // Fallback: buscar en entidades t0
        const t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return '0';
        }

        const ratingOrder = {
            '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
        };

        let worstRating = '0';
        let worstNumeric = 0;

        for (let i = 0; i < t0Data.entities.length; i++) {
            let rating = String(t0Data.entities[i].rating || '').toUpperCase();
            let numeric = ratingOrder[rating] || 0;
            if (numeric > worstNumeric) {
                worstNumeric = numeric;
                worstRating = rating;
            }
        }

        return worstRating;
    }

    /**
     * Aplica función logística para suavizar score
     */
    function applyLogisticFunction(score) {
        // Función logística: 1 / (1 + e^(-k*(x-0.5)))
        const k = 8; // Factor de suavizado
        let centered = score - 0.5;
        return 1 / (1 + Math.exp(-k * centered));
    }

    /**
     * Verifica si los datos son suficientes para scoring confiable
     */
    function hasValidScoringData(data) {
        if (!data.periodData || !data.periodData.t0) {
            return false;
        }

        const t0Data = data.periodData.t0;
        
        // Necesita al menos entidades O totales
        const hasEntities = t0Data.entities && Array.isArray(t0Data.entities) && t0Data.entities.length > 0;
        const hasTotals = t0Data.totals && Array.isArray(t0Data.totals) && t0Data.totals.length > 0;

        return hasEntities || hasTotals;
    }

    /**
     * Evalúa la calidad de los datos para scoring
     */
    function assessDataQuality(data) {
        let score = 0;
        const maxScore = 5;

        // +1 por tener datos básicos
        if (hasValidScoringData(data)) score++;

        // +1 por tener datos históricos (t6)
        if (data.periodData.t6 && data.periodData.t6.entities && 
            data.periodData.t6.entities.length > 0) score++;

        // +1 por tener calificaciones
        const hasRatings = data.periodData.t0.entities && 
            data.periodData.t0.entities.some(function(e) { return e.rating; });
        if (hasRatings) score++;

        // +1 por tener múltiples entidades (diversidad)
        if (extractEntityCount(data) > 1) score++;

        // +1 por consistencia de datos
        if (data.metadata && data.metadata.nome && !data.flags.isDeceased) score++;

        return {
            score: score,
            maxScore: maxScore,
            percentage: (score / maxScore) * 100,
            level: score >= 4 ? 'HIGH' : score >= 2 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * Calcula nivel de confianza del score
     */
    function calculateConfidenceLevel(data, contributions) {
        const factors = [];

        // Factor 1: Calidad de datos
        const dataQuality = assessDataQuality(data);
        factors.push(dataQuality.percentage / 100);

        // Factor 2: Número de contribuciones aplicadas
        const appliedContributions = Object.keys(contributions).filter(function(key) {
            return contributions[key].applied;
        }).length;
        factors.push(Math.min(appliedContributions / 4, 1)); // Max 4 contribuciones principales

        // Factor 3: Diversidad de entidades
        const entityCount = extractEntityCount(data);
        factors.push(Math.min(entityCount / 5, 1)); // Max 5 entidades para confidence máximo

        // Promedio de factores
        const avgConfidence = factors.reduce(function(sum, f) { return sum + f; }, 0) / factors.length;

        return {
            level: avgConfidence >= 0.8 ? 'HIGH' : avgConfidence >= 0.5 ? 'MEDIUM' : 'LOW',
            score: Math.round(avgConfidence * 100),
            factors: {
                dataQuality: Math.round(factors[0] * 100),
                contributionDiversity: Math.round(factors[1] * 100),
                entityDiversity: Math.round(factors[2] * 100)
            }
        };
    }

    /**
     * OPTIMIZADO: Cálculo rápido de impacto de deuda
     */
    function calculateDebtImpactFast(totalAmount, coefficients) {
        if (!coefficients || totalAmount <= coefficients.threshold) {
            return 0;
        }
        const excess = totalAmount - coefficients.threshold;
        const rawImpact = (excess / 100000) * coefficients.weight;
        return Math.max(coefficients.maxImpact, rawImpact);
    }

    /**
     * OPTIMIZADO: Cálculo rápido de impacto por cantidad de entidades
     */
    function calculateEntityImpactFast(entityCount, coefficients) {
        if (!coefficients || entityCount <= coefficients.threshold) {
            return 0;
        }
        const excess = entityCount - coefficients.threshold;
        const rawImpact = excess * coefficients.weight;
        return Math.max(coefficients.maxImpact, rawImpact);
    }

    /**
     * OPTIMIZADO: Crear resultado de rechazo con mínima metadata
     */
    function createRejectedScore(reason, message) {
        return {
            finalScore: 0,
            rawScore: 0,
            baseScore: 0,
            contributions: {},
            metadata: {
                calculatedAt: new Date(),
                isRejected: true,
                rejectionReason: reason,
                goodThreshold: 499,
                isGood: false
            },
            flags: {},
            validation: { hasValidData: false }
        };
    } 

    // Public API
    return {
        computeScore: computeScore,
        
        // Para testing y debugging
        _internal: {
            checkAutoRejection: checkAutoRejection,
            calculateDebtContribution: calculateDebtContribution,
            calculateEntityCountContribution: calculateEntityCountContribution,
            calculateWorstRatingContribution: calculateWorstRatingContribution,
            calculateTrendingContribution: calculateTrendingContribution,
            extractTotalByType: extractTotalByType,
            extractEntityCount: extractEntityCount,
            extractWorstRating: extractWorstRating,
            applyLogisticFunction: applyLogisticFunction,
            hasValidScoringData: hasValidScoringData,
            assessDataQuality: assessDataQuality,
            calculateConfidenceLevel: calculateConfidenceLevel,
            createRejectedScore: createRejectedScore
        }
    };
});

/**
 * @typedef {Object} ScoreResult
 * @property {number} finalScore - Score final (0-1)
 * @property {number} rawScore - Score antes de normalizar
 * @property {number} baseScore - Score base inicial
 * @property {Object} contributions - Desglose de contribuciones
 * @property {Object} metadata - Metadatos del cálculo
 * @property {Object} flags - Banderas de los datos
 * @property {Object} validation - Validación y calidad de datos
 */