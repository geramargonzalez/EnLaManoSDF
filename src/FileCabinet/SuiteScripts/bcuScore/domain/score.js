/**
 * @ ApiVersion 2.1
 * @description Lógica pura de scoring BCU sin efectos secundarios
 */

define(['N/log'], function (log) {
    // /* 'use strict'; */

    // Pre-compilar lookup tables para performance O(1)
    const RATING_ORDER = {
        '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
    };

    function safeUpper(value) {
        if (value === null || value === undefined) return '';
        // Convertir a mayúsculas y eliminar acentos para comparaciones
        return value.toString()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }
    
    
    // Helper robusto para comparar nombres de entidades con alias
    function nameIncludesAny(name, patterns) {
        const n = safeUpper(name);
        for (var i = 0; i < patterns.length; i++) {
            const p = safeUpper(patterns[i]);
            if (p && n.indexOf(p) > -1) return true;
        }
        return false;
    }

    
    // Helpers para analizar rubros (conservativos y seguros)

    // Versión optimizada: chequea flag booleano (más confiable que el nombre del rubro)
    function containsContingencyFast(rubros) {
        if (!Array.isArray(rubros)) return false;
        for (let i = 0, n = rubros.length; i < n; i++) {
            const r = rubros[i] || {};
            // Solo confiar en el flag cont, que se establece en base a montos > 0
            if (r.cont === true) {
                return true;
            }
        }
        return false; 
    }

    function containsVigenciaRubro(rubros) {
        if (!Array.isArray(rubros)) return false;
        for (let i = 0; i < rubros.length; i++) {
            const r = rubros[i] || {};
            if (r.vig || r.vigente || r.vigencia) return true;
            // Buscar en múltiples propiedades posibles (case-insensitive)
            const rubro = (r.rubro || r.Rubro || r.nombre || r.tipo || '').toString().toUpperCase().trim();
            if (rubro.indexOf('VIGENTE') === 0 || rubro === 'VIGENTE') {
                return true;
            }
        }
        return false;
    }

    // Optimizada: chequea flags booleanos antes y evita normalización innecesaria
    function containsVigenciaRubroFast(rubros) {
        if (!Array.isArray(rubros)) return false;
        for (let i = 0, n = rubros.length; i < n; i++) {
            const r = rubros[i] || {};
            if (r.vig === true || r.vigente === true || r.vigencia === true) return true;
            const rubro = (r.rubro || r.Rubro || r.nombre || r.tipo || '').toString();
            if (!rubro) continue;
            if (rubro.length < 7) continue;
            const up = rubro.toUpperCase();
            if (up.indexOf('VIGENTE') === 0 || up === 'VIGENTE') return true;
        }
        return false;
    }

    /**
     * OPTIMIZADO: Scoring O(n) con mínimas operaciones y early exits
     */
    function computeScore(normalizedData, scoringRules, normalizedDataT6) {
        // Validación mínima
        if (!normalizedData || !scoringRules) {
            return createRejectedScore('INVALID_INPUT', 'Datos inválidos', null, normalizedData);
        }

        // Detectar si no hay datos BCU (flag especial de normalize.js)
        const flags = normalizedData.flags || {};
        if (flags.noBcuData === true) {
            return createRejectedScore('NO_BCU_DATA', 'Sin información en BCU', null, normalizedData);
        }

        // Extraer y formatear periodo de consulta (año-mes) al inicio
        let periodoConsulta = '';
        try {
            const fechaConsulta = (normalizedData.metadata && normalizedData.metadata.fechaConsulta) || '';
            if (fechaConsulta) {
                const fecha = new Date(fechaConsulta);
                if (!isNaN(fecha.getTime())) {
                    const year = fecha.getFullYear();
                    const month = String(fecha.getMonth() + 1).padStart(2, '0');
                    periodoConsulta = year + '-' + month;
                }
            }
        } catch (e) {
            log.error('Error al formatear periodo de consulta', e);
        }

        // Inicializar log para compatibilidad con el script original
        let logTxt = '<P>============= INICIO SCORING =============</P>';
        logTxt += '<P>Provider: ' + (normalizedData.provider || 'UNKNOWN') + '</P>';
        logTxt += '<P>Documento: ' + ((normalizedData.metadata && normalizedData.metadata.documento) || 'UNKNOWN') + '</P>';
        logTxt += '<P>Periodo Consulta: ' + (periodoConsulta || 'N/A') + '</P>';
        logTxt += '<P>==========================================</P>';
        
        const debugEnabled = !!(scoringRules && scoringRules.debug);
        function dbg(title, details) { if (debugEnabled) { try { log.debug(title, details); } catch (e) {} } }

        const rejectionRules = scoringRules.rejectionRules;


        const t0Data = normalizedData.periodData && normalizedData.periodData.t0;
        if (!t0Data || !t0Data.entities) {
            log.error('computeScore - NO_DATA validation failed', {
                hasT0Data: !!t0Data,
                hasEntities: !!(t0Data && t0Data.entities),
                isArray: !!(t0Data && t0Data.entities && Array.isArray(t0Data.entities)),
                t0Keys: t0Data ? Object.keys(t0Data) : 'NO_T0'
            });
            return createRejectedScore('NO_DATA', 'Sin datos para scoring', null, normalizedData);
        }

        // CRITICAL FIX: Convert Java array to JavaScript array if needed
        // NetSuite sometimes returns Java arrays ([Ljava.lang.Object;@...)
        // that need explicit conversion to be iterable in JavaScript
        let entities = t0Data.entities;
        if (!Array.isArray(entities)) {
            try {
                // Try to convert Java collection to JS array
                if (entities && typeof entities === 'object' && entities.length !== undefined) {
                    var tempArr = [];
                    for (var idx = 0; idx < entities.length; idx++) {
                        tempArr.push(entities[idx]);
                    }
                    entities = tempArr;
                } else {
                    log.error('computeScore - t0.entities not convertible', {
                        typeof_entities: typeof entities,
                        hasLength: !!(entities && entities.length !== undefined)
                    });
                    return createRejectedScore('NO_DATA', 'Entidades t0 no procesables', null, normalizedData);
                }
            } catch (convErr) {
                log.error('computeScore - failed to convert t0 entities', convErr.toString());
                return createRejectedScore('NO_DATA', 'Error convirtiendo entidades t0', null, normalizedData);
            }
        }

        if (!entities || entities.length === 0) {
            return createRejectedScore('NO_DATA', 'Sin entidades en t0', null, normalizedData);
        }

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
            const rating = String(entity.rating || '').toUpperCase().trim();
            const ratingValue = RATING_ORDER[rating] || 0;
            if (ratingValue > worstRatingValue) {
                worstRatingValue = ratingValue;
                worstRating = rating;
            }
        }

        // Early exit: límites de deuda
         if (rejectionRules && rejectionRules.maxVencido && totals.vencido > rejectionRules.maxVencido) {
            return createRejectedScore('EXCESS_VENCIDO', 'Deuda vencida excesiva', null, normalizedData);
        }
        if (rejectionRules && rejectionRules.maxCastigado && totals.castigado > rejectionRules.maxCastigado) {
            return createRejectedScore('EXCESS_CASTIGADO', 'Deuda castigada excesiva', null, normalizedData);
        }

        // Ahora replicamos la lógica de pasos 2-5 del SDB-Enlamano-score.js

        // Coeficientes binned centralizados en scoringRules.binned
        const binnedFromRules = (scoringRules && scoringRules.binned) || {};
        if (debugEnabled) { try { log.debug('Binned snapshot', binnedFromRules); } catch (e) {} }

        function getBinnedValue(binnedKey) {
            if (typeof binnedFromRules[binnedKey] === 'number') return binnedFromRules[binnedKey];
            return undefined;
        }

        function getBinnedOrDefault(binnedKey, fallback) {
            var v = binnedFromRules[binnedKey];
            return (typeof v === 'number') ? v : fallback;
        }

        // Valores por defecto (WOE) con fallback si no vienen en reglas
        const banco_binned = getBinnedOrDefault('banco_binned', 0.0038032);
        const ent_t6_binned = getBinnedOrDefault('ent_t6_binned', 0.0026394);
        const intercept = getBinnedOrDefault('intercept', 0.2114816);
        const t6_cred_dir_comp_binned = getBinnedOrDefault('t6_cred_dir_comp_binned', 0.0028341);
        const vig_noauto_t6_coop_binned = getBinnedOrDefault('vig_noauto_t6_coop_binned', 0.0033394);
        const t0_bbva_binned = getBinnedOrDefault('t0_bbva_binned', 0.0045863);
        const cont_t0_fucac_binned = getBinnedOrDefault('cont_t0_fucac_binned', 0.0038189);
        const t0_scotia_binned = getBinnedOrDefault('t0_scotia_binned', 0.0034926);
        const t0_asi_binned = getBinnedOrDefault('t0_asi_binned', 0.0037215);
        const brou_grupo_binned = getBinnedOrDefault('brou_grupo_binned', 0.0037486);
        const emp_valor_binned = getBinnedOrDefault('emp_valor_binned', 0.0059208);
        const t0_fnb_binned = getBinnedOrDefault('t0_fnb_binned', 0.0014982);
        const t0_santa_binned = getBinnedOrDefault('t0_santa_binned', 0.0006744);
        const t6_binned = getBinnedOrDefault('t6_binned', 0.0005706);
        const cred_dir_binned = getBinnedOrDefault('cred_dir_binned', 0.0002515);
        const t6_creditel_binned = getBinnedOrDefault('t6_creditel_binned', 0.0003315);
        const t6_oca_binned = getBinnedOrDefault('t6_oca_binned', 0.0042904);
        const t6_pronto_binned = getBinnedOrDefault('t6_pronto_binned', 0.0016738);


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
        // NOTA IMPORTANTE: Para MYM, t0 contiene datos de T2 (2 meses) y t6 contiene T6 (6 meses)
        // Esto es consistente con el score original SDB-Enlamano-score.js
        let t0 = (normalizedData.periodData && normalizedData.periodData.t0) || { entities: [], aggregates: {} };
        
        // CRITICAL FIX: Si t6 existe pero está vacío (sin entidades), usar normalizedDataT6.periodData.t0 como fallback
        let t6 = (normalizedData.periodData && normalizedData.periodData.t6) || { entities: [], aggregates: {} };
        if ((!t6.entities || t6.entities.length === 0) && normalizedDataT6 && normalizedDataT6.periodData && normalizedDataT6.periodData.t0) {
            t6 = normalizedDataT6.periodData.t0;
          
        }

        // CRITICAL FIX: Convert t6 entities from Java array if needed
        if (t6.entities && !Array.isArray(t6.entities)) {
            try {
                if (typeof t6.entities === 'object' && t6.entities.length !== undefined) {
                    var t6TempArr = [];
                    for (var t6idx = 0; t6idx < t6.entities.length; t6idx++) {
                        t6TempArr.push(t6.entities[t6idx]);
                    }
                    t6.entities = t6TempArr;
                
                }
            } catch (t6ConvErr) {
                log.error('computeScore - failed to convert t6 entities', t6ConvErr.toString());
                // Continue with empty t6 entities rather than failing
                t6.entities = [];
            }
        }

        // Also convert rubrosValoresGenerales if present
        if (t0.rubrosValoresGenerales && !Array.isArray(t0.rubrosValoresGenerales)) {
            try {
                if (typeof t0.rubrosValoresGenerales === 'object' && t0.rubrosValoresGenerales.length !== undefined) {
                    var t0RubrosArr = [];
                    for (var r0idx = 0; r0idx < t0.rubrosValoresGenerales.length; r0idx++) {
                        t0RubrosArr.push(t0.rubrosValoresGenerales[r0idx]);
                    }
                    t0.rubrosValoresGenerales = t0RubrosArr;
                }
            } catch (e) { t0.rubrosValoresGenerales = []; }
        }

        if (t6.rubrosValoresGenerales && !Array.isArray(t6.rubrosValoresGenerales)) {
            try {
                if (typeof t6.rubrosValoresGenerales === 'object' && t6.rubrosValoresGenerales.length !== undefined) {
                    var t6RubrosArr = [];
                    for (var r6idx = 0; r6idx < t6.rubrosValoresGenerales.length; r6idx++) {
                        t6RubrosArr.push(t6.rubrosValoresGenerales[r6idx]);
                    }
                    t6.rubrosValoresGenerales = t6RubrosArr;
                }
            } catch (e) { t6.rubrosValoresGenerales = []; }
        }

        // Extraer periodos de T2 (t0) y T6 para análisis
        // NOTA: El periodo viene en normalizedData.metadata.periodo para el periodo principal (T2)
        // Para T6, si normalizedDataT6 existe, viene en normalizedDataT6.metadata.periodo
        let periodoT2 = (normalizedData && normalizedData.metadata && normalizedData.metadata.periodo) || 
                        (t0 && t0.metadata && t0.metadata.periodo) || '';
        let periodoT6 = (normalizedDataT6 && normalizedDataT6.metadata && normalizedDataT6.metadata.periodo) || 
                        (t6 && t6.metadata && t6.metadata.periodo) || '';
        
        // Agregar periodos al log
        if (periodoT2) {
            logTxt += '<P>Periodo T2: ' + periodoT2 + '</P>';
        }
        if (periodoT6) {
            logTxt += '<P>Periodo T6: ' + periodoT6 + '</P>';
        }

        // Extraer Mn/Me usando la misma lógica que SDB-Enlamano-score.js (múltiples try-catch)
        let t2_mnPesos = -1;
        let t2_mePesos = -1;
        let t6_mnPesos = -1;
        let t6_mePesos = -1;
 


        // Intentar desde rubrosValoresGenerales directamente (igual que producción)
        try {
            if (t0.rubrosValoresGenerales && t0.rubrosValoresGenerales[0]) {
                t2_mnPesos = t0.rubrosValoresGenerales[0].MnPesos;
            }
        } catch (E) {
            log.error('Failed to extract t2_mnPesos from rubrosValoresGenerales', E.toString());
            // Fallback: intentar desde aggregates si no está en rubrosValoresGenerales
            try {
                if (t0.aggregates && t0.aggregates.vigente) {
                    t2_mnPesos = t0.aggregates.vigente.mn;
                }
            } catch (E1) {
                log.error('Failed to extract t2_mnPesos from aggregates', E1.toString());
            }
        }

        try {
            if (t0.rubrosValoresGenerales && t0.rubrosValoresGenerales[0]) {
                t2_mePesos = t0.rubrosValoresGenerales[0].MePesos;
            }
        } catch (E) {
            log.error('Failed to extract t2_mePesos from rubrosValoresGenerales', E.toString());
            try {
                if (t0.aggregates && t0.aggregates.vigente) {
                    t2_mePesos = t0.aggregates.vigente.me;
                }
            } catch (E1) {
                log.error('Failed to extract t2_mePesos from aggregates', E1.toString());
            }
        }

        // Extraer t6_mnPesos - primero intentar rubrosValoresGenerales, luego aggregates
        try {
            if (t6.rubrosValoresGenerales && t6.rubrosValoresGenerales[0] && t6.rubrosValoresGenerales[0].MnPesos !== undefined) {
                t6_mnPesos = t6.rubrosValoresGenerales[0].MnPesos;
            } else if (t6.aggregates && t6.aggregates.vigente && t6.aggregates.vigente.mn !== undefined) {
                // Fallback a aggregates si rubrosValoresGenerales no tiene datos
                t6_mnPesos = t6.aggregates.vigente.mn;
            }
        } catch (E) {
            log.error('Failed to extract t6_mnPesos', E.toString());
            try {
                if (t6.aggregates && t6.aggregates.vigente) {
                    t6_mnPesos = t6.aggregates.vigente.mn;
                }
            } catch (E1) {
                log.error('Failed to extract t6_mnPesos from aggregates', E1.toString());
            }
        }

        // Extraer t6_mePesos - primero intentar rubrosValoresGenerales, luego aggregates
        try {
            if (t6.rubrosValoresGenerales && t6.rubrosValoresGenerales[0] && t6.rubrosValoresGenerales[0].MePesos !== undefined) {
                t6_mePesos = t6.rubrosValoresGenerales[0].MePesos;
            } else if (t6.aggregates && t6.aggregates.vigente && t6.aggregates.vigente.me !== undefined) {
                // Fallback a aggregates si rubrosValoresGenerales no tiene datos
                t6_mePesos = t6.aggregates.vigente.me;
            }
        } catch (E) {
            log.error('Failed to extract t6_mePesos', E.toString());
            try {
                if (t6.aggregates && t6.aggregates.vigente) {
                    t6_mePesos = t6.aggregates.vigente.me;
                }
            } catch (E1) {
                log.error('Failed to extract t6_mePesos from aggregates', E1.toString());
            }
        }

     

        // Agregar valores extraídos al logTxt para debugging
        logTxt += '<P>========== VALORES EXTRAIDOS ==========</P>';
        logTxt += '<P>t2_mnPesos: ' + t2_mnPesos + '</P>';
        logTxt += '<P>t2_mePesos: ' + t2_mePesos + '</P>';
        logTxt += '<P>t6_mnPesos: ' + t6_mnPesos + '</P>';
        logTxt += '<P>t6_mePesos: ' + t6_mePesos + '</P>';
        logTxt += '<P>t0.entities.length: ' + (entities ? entities.length : 'NULL') + '</P>';
        logTxt += '<P>t6.entities.length: ' + (t6 && t6.entities ? t6.entities.length : 'NULL') + '</P>';
        logTxt += '<P>=======================================</P>';

        // Calcular endeudamiento igual que producción
        let endeudamiento = -314;
        try {
            // CRITICAL FIX: Si T6 está vacío o tiene valores negativos (datos no disponibles),
            // no podemos calcular endeudamiento histórico. En ese caso, usar endeudamiento = 1
            // para indicar que la deuda actual es "nueva" (no hay referencia histórica).
            // endeudamiento = 1 significa que la deuda se duplicó respecto a T6 (o que no había deuda en T6)
            if (t6_mnPesos <= 0 && t6_mePesos <= 0) {
                // T6 no disponible - asumir deuda nueva (endeudamiento = 1)
                endeudamiento = 1;
             
            } else {
                endeudamiento = ((t2_mnPesos + t2_mePesos) / (t6_mnPesos + t6_mePesos)) - 1;
            }
        } catch (E) {
            // Mantener -314 en caso de error
            log.error('computeScore - endeudamiento calculation error', E.toString());
        }


        // Agregar endeudamiento al logTxt
        logTxt += '<P>========== ENDEUDAMIENTO ==========</P>';
        logTxt += '<P>Endeudamiento calculado: ' + endeudamiento + '</P>';
        logTxt += '<P>Fórmula: ((t2_mn + t2_me) / (t6_mn + t6_me)) - 1</P>';
        logTxt += '<P>= ((' + t2_mnPesos + ' + ' + t2_mePesos + ') / (' + t6_mnPesos + ' + ' + t6_mePesos + ')) - 1</P>';
        logTxt += '<P>===================================</P>';

        // Construir estructuras t2/t6 similares a las del original para las comprobaciones por NombreEntidad y Calificacion
        let calificacionMinima = '0'; // Inicializar calificacionMinima

        let t2List = [];
        
        // Use the already-converted entities array from above
        for (let i = 0; i < entities.length; i++) {
            let e = entities[i];
            let calif = safeUpper(e.rating || e.calificacion || '');
            
            // TEMPORALMENTE DESHABILITADO: Verificar malas calificaciones ANTES de continuar
            // NOTA: Esto permite que el código continúe y construya el logTxt completo para debugging
            /* if (malasCalificaciones.indexOf(calif) > -1) {
                return createRejectedScore('BAD_RATING', 'Calificación de rechazo: ' + calif, logTxt);
            } */
            
            let nombreEntidad = e.entidad || e.nombreEntidad || '';
            
            // Convert rubros from Java array if needed
            let rubrosArray = e.rubros || [];
            if (rubrosArray && !Array.isArray(rubrosArray) && typeof rubrosArray === 'object' && rubrosArray.length !== undefined) {
                var rubTemp = [];
                for (var ridx = 0; ridx < rubrosArray.length; ridx++) {
                    rubTemp.push(rubrosArray[ridx]);
                }
                rubrosArray = rubTemp;
            }
            
            let hasCont = containsContingencyFast(rubrosArray);
            
            // DEBUG: Log TODAS las entidades para encontrar el problema
            if (debugEnabled) {
                dbg('Entity ' + i, {
                    nombre: nombreEntidad,
                    hasCont: hasCont,
                    rubrosCount: rubrosArray.length,
                    primerosRubros: rubrosArray.slice(0, 3).map(function(r) { 
                        return { Rubro: r.Rubro, rubro: r.rubro }; 
                    })
                });
            }
            
            // DEBUG: Log específico para entidades con "Vizcaya" o "BBVA" en el nombre
            if (debugEnabled && (nombreEntidad.indexOf('Vizcaya') > -1 || nombreEntidad.toUpperCase().indexOf('BBVA') > -1)) {
                dbg('BBVA/Vizcaya Entity Found', {
                    nombre: nombreEntidad,
                    hasCont: hasCont,
                    rubrosLength: rubrosArray.length,
                    todosLosRubros: JSON.stringify(rubrosArray.slice(0, 10))
                });
            }
            
            t2List.push({
                NombreEntidad: nombreEntidad,
                Calificacion: calif,
                CalificacionMinima0: RATING_ORDER[safeUpper(calif)] || 0,
                Cont: hasCont,
                vig: containsVigenciaRubroFast(rubrosArray)
            });
            
            // Agregar entidad al logTxt
            logTxt += '<P>T2 Entity[' + i + ']: ' + nombreEntidad + ' | Calif: ' + calif + ' | Cont: ' + hasCont + ' | Rubros: ' + rubrosArray.length + '</P>';
            
            // FIXED: Actualizar calificacionMinima usando RATING_ORDER (siempre mantener la PEOR calificación)
            if (calif) {
                if (calificacionMinima === '0') {
                    // Primera calificación encontrada
                    calificacionMinima = calif;
                } else {
                    // Comparar usando RATING_ORDER: mayor número = peor calificación
                    const currentRatingValue = RATING_ORDER[calificacionMinima] || 0;
                    const newRatingValue = RATING_ORDER[calif] || 0;
                    
                    // Si la nueva calificación es PEOR (mayor valor numérico), actualizar
                    if (newRatingValue > currentRatingValue) {
                        calificacionMinima = calif;
                    }
                }
            }
        }
        
        logTxt += '<P>========== T2 TOTALES ==========</P>';
        logTxt += '<P>Total entidades T2: ' + t2List.length + '</P>';
        logTxt += '<P>Calificación mínima: ' + calificacionMinima + '</P>';
        logTxt += '<P>================================</P>';

        // CRITICAL: Verificar calificaciones de rechazo DESPUÉS de determinar la calificación mínima
        // Si tiene 2B, 3, 4 o 5 → retornar score 0 (rechazo automático)
        const badRatings = (rejectionRules && rejectionRules.badRatings) || ['2B', '3', '4', '5'];
        if (badRatings.indexOf(calificacionMinima) > -1) {
            logTxt += '<P>========== RECHAZO POR CALIFICACION ==========</P>';
            logTxt += '<P>Calificación mínima detectada: ' + calificacionMinima + '</P>';
            logTxt += '<P>Esta calificación está en la lista de rechazo: [' + badRatings.join(', ') + ']</P>';
            logTxt += '<P>Score retornado: 0 (rechazo automático)</P>';
            logTxt += '<P>==============================================</P>';
            
            // Extraer periodo de consulta para rechazo
            let periodoConsultaRejected = '';
            try {
                const fechaConsulta = (normalizedData.metadata && normalizedData.metadata.fechaConsulta) || '';
                if (fechaConsulta) {
                    const fecha = new Date(fechaConsulta);
                    if (!isNaN(fecha.getTime())) {
                        const year = fecha.getFullYear();
                        const month = String(fecha.getMonth() + 1).padStart(2, '0');
                        periodoConsultaRejected = year + '-' + month;
                    }
                }
            } catch (e) {
                log.error('Error al formatear periodo de consulta en rechazo', e);
            }
            
            return {
                score: 0,
                isGood: false,
                rawScore: 0,
                total: 0,
                calificacionMinima: calificacionMinima,
                endeudamiento: 0,
                contador: entityCount,
                mensaje: 'Rechazado por calificación: ' + calificacionMinima,
                logTxt: logTxt,
                rejected: true,
                rejectionReason: 'BAD_RATING',
                rejectionDetails: 'Calificación mínima ' + calificacionMinima + ' está en lista de rechazo',
                periodoConsulta: periodoConsultaRejected,
                periodoT2: periodoT2,
                periodoT6: periodoT6
            };
        }

        let t6List = [];
        try {
            var t6EntitiesArray = t6.entities || [];
            for (let p = 0; p < t6EntitiesArray.length; p++) {
                let e2 = t6EntitiesArray[p];
                if (!e2 || typeof e2 !== 'object') {
                    log.error('computeScore - malformed t6 entity', {
                        index: p,
                        typeof_e2: typeof e2,
                        e2_value: e2
                    });
                    continue; // Skip malformed entity
                }
                
                // Convert rubros from Java array if needed
                let e2Rubros = e2.rubros || [];
                if (e2Rubros && !Array.isArray(e2Rubros) && typeof e2Rubros === 'object' && e2Rubros.length !== undefined) {
                    var e2RubTemp = [];
                    for (var e2ridx = 0; e2ridx < e2Rubros.length; e2ridx++) {
                        e2RubTemp.push(e2Rubros[e2ridx]);
                    }
                    e2Rubros = e2RubTemp;
                }
                
                var t6EntityName = e2.entidad || e2.nombreEntidad || '';
                var t6Calif = (e2.rating || e2.calificacion || '').toString();
                var t6HasCont = containsContingencyFast(e2Rubros);
                
                t6List.push({
                    NombreEntidad: t6EntityName,
                    Calificacion: t6Calif,
                    CalificacionMinima: RATING_ORDER[safeUpper(e2.rating || e2.calificacion || '')] || 0,
                    Cont: t6HasCont,
                    vig: containsVigenciaRubroFast(e2Rubros)
                });
                
                // Agregar entidad T6 al logTxt
                logTxt += '<P>T6 Entity[' + p + ']: ' + t6EntityName + ' | Calif: ' + t6Calif + ' | Cont: ' + t6HasCont + ' | Rubros: ' + e2Rubros.length + '</P>';
            }
        } catch (t6Err) {
            log.error('computeScore - t6List construction failed', {
                error: t6Err.toString(),
                t6_entities_length: (t6 && t6.entities) ? t6.entities.length : 'NO_ENTITIES',
                t6_type: typeof t6
            });
            logTxt += '<P>ERROR construyendo T6: ' + t6Err.toString() + '</P>';
            // Continue with empty t6List rather than failing completely
        }
        
        // Fallback: si no se construyó ninguna entidad T6, intentar reconstruir desde rawData (igual que el script SDB)
        if (t6List.length === 0 && normalizedData.rawData && normalizedData.rawData.datosBcuT6 &&
            normalizedData.rawData.datosBcuT6.data && normalizedData.rawData.datosBcuT6.data.EntidadesRubrosValores) {
            try {
                var rawT6Entities = normalizedData.rawData.datosBcuT6.data.EntidadesRubrosValores;
                if (rawT6Entities && !Array.isArray(rawT6Entities) && typeof rawT6Entities === 'object' && rawT6Entities.length !== undefined) {
                    var rawArr = [];
                    for (var rt6 = 0; rt6 < rawT6Entities.length; rt6++) {
                        rawArr.push(rawT6Entities[rt6]);
                    }
                    rawT6Entities = rawArr;
                }
                if (Array.isArray(rawT6Entities) && rawT6Entities.length > 0) {
                    logTxt += '<P>Fallback T6: reconstruyendo ' + rawT6Entities.length + ' entidades desde rawData</P>';
                    for (var rf = 0; rf < rawT6Entities.length; rf++) {
                        var rawEnt = rawT6Entities[rf] || {};
                        var rawRubros = rawEnt.RubrosValores || rawEnt.rubrosValores || rawEnt.rubros || [];
                        if (rawRubros && !Array.isArray(rawRubros) && typeof rawRubros === 'object' && rawRubros.length !== undefined) {
                            var rawRubArr = [];
                            for (var rr = 0; rr < rawRubros.length; rr++) {
                                rawRubArr.push(rawRubros[rr]);
                            }
                            rawRubros = rawRubArr;
                        }
                        var fallbackName = rawEnt.NombreEntidad || rawEnt.nombreEntidad || '';
                        var fallbackCalif = (rawEnt.Calificacion || rawEnt.calificacion || '').toString();
                        var fallbackHasCont = containsContingencyFast(rawRubros);
                        t6List.push({
                            NombreEntidad: fallbackName,
                            Calificacion: fallbackCalif,
                            CalificacionMinima: RATING_ORDER[safeUpper(fallbackCalif)] || 0,
                            Cont: fallbackHasCont,
                            vig: containsVigenciaRubroFast(rawRubros)
                        });
                        logTxt += '<P>T6 Entity Fallback[' + rf + ']: ' + fallbackName + ' | Calif: ' + fallbackCalif + ' | Cont: ' + fallbackHasCont + ' | Rubros: ' + rawRubros.length + '</P>';
                    }
                }
            } catch (fallbackErr) {
                log.error('computeScore - fallback T6 failed', fallbackErr.toString());
                logTxt += '<P>Fallback T6 error: ' + fallbackErr + '</P>';
            }
        }

        logTxt += '<P>========== T6 TOTALES ==========</P>';
        logTxt += '<P>Total entidades T6: ' + t6List.length + '</P>';
        logTxt += '<P>================================</P>';

        // recorrer t6 para asignaciones por entidad
        let contador = 0;
        let __maxCalifMinT6 = 0;

        // CRITICAL FIX: Cuando T6 está vacío (0 entidades), se deben usar los woe_min
        // para las variables T6, NO quedarse en 0.
        // Según el modelo Excel:
        // - t6.binned "missing" = -9.95 (woe para cuando no hay calificación T6)
        // - t6_oca.binned "resto" = -15.16
        // - t6_banco.binned "resto" = -37.55
        // - etc.
        
        // Siempre inicializar con woe_min - se sobrescribirán si hay entidades T6 con match
        t6_binned_res = -9.95;               // woe_min para t6.binned (missing/sin calificación)
        t6_creditel_binned_res = -17.15;     // woe_min para t6_creditel.binned
        t6_oca_binned_res = -15.16;          // woe_min para t6_oca.binned
        t6_pronto_binned_res = -7.86;        // woe_min para t6_pronto.binned
        cred_dir_binned_res = -90.18;        // woe_min para t6_cred_dir.binned (resto)
        t6_cred_dir_comp_binned_res = -4.35; // woe_min para t6_cred_dir_comp.binned
        t6_banco_binned_res = -37.55;        // woe_min para t6_banco.binned
        vig_noauto_t6_coop_binned_res = -23.52; // woe_min para vig_noauto_t6_coop.binned

        for (let __i = 0, __n = t6List.length; __i < __n; __i++) {
            let current = t6List[__i];
            contador = contador + 1; // Incrementar contador igual que el original
            
            const nameU = safeUpper(current.NombreEntidad);
            const califU = safeUpper(current.Calificacion);
            const calMinNum = current.CalificacionMinima || 0;
            if (calMinNum >= __maxCalifMinT6) __maxCalifMinT6 = calMinNum;

            // t6_binned_res por calificación
            if (t6_binned_res !== -9.95) {
                if (!califU) {
                    t6_binned_res = -68.53;
                } else if (califU === '2B' && t6_binned_res !== 14.88) {
                    t6_binned_res = 14.88;
                } else if (califU === '1C' || califU === '1A' || califU === '2A' || califU === '0') {
                    t6_binned_res = 31.94;
                }
            }

            // creditel (SOCUR) - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(nameU, ['SOCUR', 'CREDITEL'])) {
                t6_creditel_binned_res = 40.62;
            } else if (t6_creditel_binned_res !== 40.62) {
                t6_creditel_binned_res = -17.15;
            }

            // OCA - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(nameU, ['OCA']) && (califU === '1C' || califU === '1A')) {
                t6_oca_binned_res = 50.39;
            } else if (t6_oca_binned_res !== 50.39) {
                t6_oca_binned_res = -15.16;
            }

            // CREDITOS DIRECTOS / cred_dir_binned_res
            // Según modelo Excel: woe_min=-90.18, woe_max=30.77, default=-4.12 (cuando no hay entidades T6)
            const matchesCredDir = nameIncludesAny(nameU, ['CREDITOS DIRECTOS', 'CRED. DIRECTOS']);
            if ((matchesCredDir && califU === '1C') || califU === '2A') {
                cred_dir_binned_res = 30.77;
            } else if ((matchesCredDir && cred_dir_binned_res !== 30.77 && califU !== '2A') || califU !== '1C') {
                cred_dir_binned_res = -90.18;
            }
            // Si no entró en ninguno de los casos anteriores, usar -4.12 como valor intermedio
            if (cred_dir_binned_res !== 30.77 && cred_dir_binned_res !== -90.18) {
                cred_dir_binned_res = -4.12;
            }

            // t6_cred_dir_comp_binned_res - REPLICAR LÓGICA CON ELSE
            if (matchesCredDir) {
                t6_cred_dir_comp_binned_res = 37.78;
            } else if (t6_cred_dir_comp_binned_res !== 37.78) {
                t6_cred_dir_comp_binned_res = -4.35;
            }

            // bancos (aceptar alias y mantener condicin de HSBC con rating)
            const isVizcaya = nameIncludesAny(nameU, ['VIZCAYA', 'BBVA', 'BANCO BILBAO', 'BANCO BILBAO VIZCAYA', 'BANCO BILBAO VIZCAYA ARGENTARIA']);
            const isBandes  = nameIncludesAny(nameU, ['BANDES']);
            const isItau    = nameIncludesAny(nameU, ['BANCO ITA', 'BANCO ITAÚ', 'ITAU', 'ITAÚ']);
            const isSant    = nameIncludesAny(nameU, ['SANTANDER']);
            const isScotia  = nameIncludesAny(nameU, ['SCOTIABANK', 'SCOTIA', 'SCOTIA BANK']);
            const isHsbc    = nameIncludesAny(nameU, ['HSBC']);
            if (isVizcaya || isBandes || isItau || isSant || isScotia || (isHsbc && (califU === '1A' || califU === '1C' || califU === '2A'))) {
                t6_banco_binned_res = 51.06;
            } else if (t6_banco_binned_res !== 51.06) {
                t6_banco_binned_res = -37.55;
            }

            // cooperativas no auto - REPLICAR LÓGICA CON ELSE
            // CRITICAL: El script original tiene un bug donde usa !current.NombreEntidad.vig
            // current.NombreEntidad es un STRING, entonces .vig es siempre undefined
            // Por lo tanto !undefined = true, SIEMPRE entra en esta condición
            // Tenemos que replicar este comportamiento exactamente
            if (califU) { // Replicar bug: siempre evalúa (porque !undefined = true)
                if (nameIncludesAny(nameU, ['ANDA', 'FUCEREP', 'ACAC'])) {
                    vig_noauto_t6_coop_binned_res = 48.55;
                } else if (vig_noauto_t6_coop_binned_res !== 48.55) {
                    // Segundo else if también replica bug: !undefined = true siempre
                    vig_noauto_t6_coop_binned_res = -23.52;
                }
            }

            // BAUTZEN / PRONTO - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(nameU, ['BAUTZEN', 'PRONTO']) && califU) {
                t6_pronto_binned_res = 36.73;
            } else if (t6_pronto_binned_res !== 36.73) {
                t6_pronto_binned_res = -7.86;
            }
        }
        
        // Después del loop, asignar ent_t6_binned_res según contador (igual que el original)
        // Excel: woe_min=-63.64, woe_max=72.8 para cont_ent_t6
        if (contador === 0 || contador === 1) ent_t6_binned_res = -63.64;
        if (contador === 2 || contador === 3) ent_t6_binned_res = 8;
        if (contador === 4 || contador === 5) ent_t6_binned_res = 34.84;
        if (contador > 5) ent_t6_binned_res = 72.8; // Corregido: era 72, 80 (bug operador coma)
        
        if ((__maxCalifMinT6 || 0) >= 5) {
            t6_binned_res = -9.95;
        }

    // Para t0 (t2) - recorrer y asignar binned_res similares
    // permitimos reasignar el objeto ganador durante el recorrido
    let object0Min = { CalificacionMinima0: 0 };
        for (let kk = 0; kk < t2List.length; kk++) {
            if ((t2List[kk].CalificacionMinima0 || 0) >= (object0Min.CalificacionMinima0 || 0)) {
                object0Min = t2List[kk];
            }
        }
        
        // DEBUG: Log calificación mínima encontrada
        if (debugEnabled) {
            logTxt += '<P>DEBUG object0Min.CalificacionMinima0: ' + object0Min.CalificacionMinima0 + '</P>';
            logTxt += '<P>DEBUG object0Min.NombreEntidad: ' + (object0Min.NombreEntidad || 'NONE') + '</P>';
        }

        // Defaults negativos para variables de t0 antes del recorrido
        t0_asi_binned_res = -4.94;
        t0_bbva_binned_res = -3.65;
        t0_scotia_binned_res = -4.16;
        emp_valor_binned_res = -4.46;
        cont_t0_fucac_binned_res = -7.01;
        brou_grupo_binned_res = -15.44;
        t0_santa_binned_res = -18.27;
        
        // t0_fnb_binned_res: Regla del modelo según peor calificación (CalificacionMinima0)
        // CalificacionMinima0: 1=1A, 2=1C, 3=2A, 4=2B, 5=3, 6=4, 7=5
        // - Si peor calif = 1A (1) o 1C (2) → 14.06
        // - Si peor calif = 2A (3) → -6.06
        // - Resto → -42.71
        if (object0Min.CalificacionMinima0 === 1 || object0Min.CalificacionMinima0 === 2) {
            t0_fnb_binned_res = 14.06;
        } else if (object0Min.CalificacionMinima0 === 3) {
            t0_fnb_binned_res = -6.06;
        } else {
            t0_fnb_binned_res = -42.71;
        }

        for (let key2 = 0, __n2 = t2List.length; key2 < __n2; key2++) {
            let currentt2 = t2List[key2];
            const name0U = safeUpper(currentt2.NombreEntidad);           
            const calif0 = safeUpper(currentt2.CalificacionMinima0 || currentt2.Calificacion);

            // t0_asi_binned - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(name0U, ['INTEGRALES']) && calif0) {
                t0_asi_binned_res = 67.86;
            } else if (t0_asi_binned_res !== 67.86) {
                t0_asi_binned_res = -4.94;
            }

            // t0_bbva_binned - REPLICAR LÓGICA CON ELSE
            // DEBUG: Log detallado para BBVA/Vizcaya
            if (debugEnabled && (currentt2.NombreEntidad || '').indexOf('Vizcaya') > -1) {
                dbg('BBVA Check in loop', {
                    nombre: currentt2.NombreEntidad,
                    Cont: currentt2.Cont,
                    condition: currentt2.Cont && (currentt2.NombreEntidad || '').indexOf('Vizcaya') > -1
                });
            }
            if (currentt2.Cont && (nameIncludesAny(name0U, ['VIZCAYA', 'BBVA', 'BANCO BILBAO']))) {
                if (debugEnabled) {
                    logTxt += '<P> => currentt2.NombreEntidad.Cont: ' + currentt2.Cont + '</P>';
                    logTxt += '<P/> tes currentt2.NombreEntidad index BBVA/Vizcaya: ' + ((name0U.indexOf('VIZCAYA') > -1) || (name0U.indexOf('BBVA') > -1));
                }
                t0_bbva_binned_res = 79.39;
                dbg('Binned values Vizcaya CON CONTINGENCIA', t0_bbva_binned_res);
            } else if (t0_bbva_binned_res !== 79.39) {
                t0_bbva_binned_res = -3.65;
                dbg('Binned values Vizcaya other', t0_bbva_binned_res);
            }

            // NOTA: t0_fnb_binned_res ya se calculó antes del loop basándose en cantidad de entidades T2

            // t0_scotia_binned - REPLICAR LÓGICA CON ELSE
            if (currentt2.Cont && nameIncludesAny(name0U, ['SCOTIABANK','SCOTIA'])) {
                t0_scotia_binned_res = 74.04;
            } else if (t0_scotia_binned_res !== 74.04) {
                t0_scotia_binned_res = -4.16;
            }

            // emp_valor_binned - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(name0U, ['EMPRENDIMIENTOS']) && calif0) {
                emp_valor_binned_res = 124.21;
            } else if (emp_valor_binned_res !== 124.21) {
                emp_valor_binned_res = -4.46;
            }

            // cont_t0_fucac_binned - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(name0U, ['FUCAC']) && currentt2.Cont) {
                cont_t0_fucac_binned_res = 74.16;
            } else if (cont_t0_fucac_binned_res !== 74.16) {
                cont_t0_fucac_binned_res = -7.01;
            }

            // brou_grupo_binned - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(name0U, ['REPUBLICA','REPÚBLICA','BROU','BANCO REPUBLICA','BANCO REPÚBLICA','BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY','BANCO DE LA REPÚBLICA ORIENTAL DEL URUGUAY']) && calif0) {
                brou_grupo_binned_res = 33.61;
            } else if (brou_grupo_binned_res !== 33.61) {
                brou_grupo_binned_res = -15.44;
            }

            // t0_santa_binned - REPLICAR LÓGICA CON ELSE
            if (nameIncludesAny(name0U, ['SANTANDER'])) {
                t0_santa_binned_res = 38.33;
            } else if (t0_santa_binned_res !== 38.33) {
                t0_santa_binned_res = -18.27;
            }
        }

        // Más bloques del original (t0_scotia, emp_valor, fucac, brou, santa, scotia, etc.)
        /* PERF: loop duplicado, integrado en el loop principal
        for (let key3 = 0, __n3 = t2List.length; key3 < __n3; key3++) {
            let currentt2 = t2List[key3];
            const name0U = safeUpper(currentt2.NombreEntidad);
            const calif0 = safeUpper(currentt2.CalificacionMinima0 || currentt2.Calificacion);

            if (currentt2.Cont && name0U.indexOf('SCOTIABANK') > -1) {
                t0_scotia_binned_res = 74.04;
            }

            if (name0U.indexOf('EMPRENDIMIENTOS') > -1 && calif0) {
                emp_valor_binned_res = 124.21;
            }

            if (name0U.indexOf('FUCAC') > -1 && currentt2.Cont) {
                cont_t0_fucac_binned_res = 74.16;
            }

            if (name0U.indexOf('REPUBLICA') > -1 && calif0) {
                brou_grupo_binned_res = 33.61;
            }

            if (name0U.indexOf('SANTANDER') > -1) {
                t0_santa_binned_res = 38.33;
            }
        }

        // Más bloques del original (t0_scotia, emp_valor, fucac, brou, santa, scotia, etc.)
        /* PERF: loop duplicado, integrado en el loop principal
        for (let key3 = 0, __n3 = t2List.length; key3 < __n3; key3++) {
            let currentt2 = t2List[key3];
            const name0U = safeUpper(currentt2.NombreEntidad);
            const calif0 = safeUpper(currentt2.CalificacionMinima0 || currentt2.Calificacion);

            if (currentt2.Cont && name0U.indexOf('SCOTIABANK') > -1) {
                t0_scotia_binned_res = 74.04;
            }

            if (name0U.indexOf('EMPRENDIMIENTOS') > -1 && calif0) {
                emp_valor_binned_res = 124.21;
            }

            if (name0U.indexOf('FUCAC') > -1 && currentt2.Cont) {
                cont_t0_fucac_binned_res = 74.16;
            }

            if (name0U.indexOf('REPUBLICA') > -1 && calif0) {
                brou_grupo_binned_res = 33.61;
            }

            if (name0U.indexOf('SANTANDER') > -1) {
                t0_santa_binned_res = 38.33;
            }
        }
        */

        // DEBUG: Log valores ANTES de multiplicar por coeficientes
/*         logTxt += '<P>========== VALORES ANTES DE MULTIPLICAR ==========</P>';
        logTxt += '<P>ent_t6_binned_res: ' + ent_t6_binned_res + '</P>';
        logTxt += '<P>t6_binned_res: ' + t6_binned_res + '</P>';
        logTxt += '<P>t6_creditel_binned_res: ' + t6_creditel_binned_res + '</P>';
        logTxt += '<P>t6_oca_binned_res: ' + t6_oca_binned_res + '</P>';
        logTxt += '<P>t0_fnb_binned_res: ' + t0_fnb_binned_res + '</P>';
        logTxt += '<P>t0_asi_binned_res: ' + t0_asi_binned_res + '</P>';
        logTxt += '<P>t0_bbva_binned_res: ' + t0_bbva_binned_res + '</P>';
        logTxt += '<P>t6_cred_dir_comp_binned_res: ' + t6_cred_dir_comp_binned_res + '</P>';
        logTxt += '<P>t6_banco_binned_res: ' + t6_banco_binned_res + '</P>';
        logTxt += '<P>vig_noauto_t6_coop_binned_res: ' + vig_noauto_t6_coop_binned_res + '</P>';
        logTxt += '<P>t0_santa_binned_res: ' + t0_santa_binned_res + '</P>';
        logTxt += '<P>emp_valor_binned_res: ' + emp_valor_binned_res + '</P>';
        logTxt += '<P>cont_t0_fucac_binned_res: ' + cont_t0_fucac_binned_res + '</P>';
        logTxt += '<P>brou_grupo_binned_res: ' + brou_grupo_binned_res + '</P>';
        logTxt += '<P>t6_pronto_binned_res: ' + t6_pronto_binned_res + '</P>';
        logTxt += '<P>t0_scotia_binned_res: ' + t0_scotia_binned_res + '</P>';
        logTxt += '<P>cred_dir_binned_res: ' + cred_dir_binned_res + '</P>';
        logTxt += '<P>===================================================</P>'; */
        
        // DEBUG: Log coeficientes (binned) usados
      /*   logTxt += '<P>========== COEFICIENTES (BINNED) ==========</P>';
        logTxt += '<P>ent_t6_binned: ' + ent_t6_binned + '</P>';
        logTxt += '<P>t6_binned: ' + t6_binned + '</P>';
        logTxt += '<P>t6_creditel_binned: ' + t6_creditel_binned + '</P>';
        logTxt += '<P>t6_oca_binned: ' + t6_oca_binned + '</P>';
        logTxt += '<P>t0_fnb_binned: ' + t0_fnb_binned + '</P>';
        logTxt += '<P>t0_asi_binned: ' + t0_asi_binned + '</P>';
        logTxt += '<P>t0_bbva_binned: ' + t0_bbva_binned + '</P>';
        logTxt += '<P>t6_cred_dir_comp_binned: ' + t6_cred_dir_comp_binned + '</P>';
        logTxt += '<P>banco_binned: ' + banco_binned + '</P>';
        logTxt += '<P>vig_noauto_t6_coop_binned: ' + vig_noauto_t6_coop_binned + '</P>';
        logTxt += '<P>t0_santa_binned: ' + t0_santa_binned + '</P>';
        logTxt += '<P>emp_valor_binned: ' + emp_valor_binned + '</P>';
        logTxt += '<P>cont_t0_fucac_binned: ' + cont_t0_fucac_binned + '</P>';
        logTxt += '<P>brou_grupo_binned: ' + brou_grupo_binned + '</P>';
        logTxt += '<P>t6_pronto_binned: ' + t6_pronto_binned + '</P>';
        logTxt += '<P>t0_scotia_binned: ' + t0_scotia_binned + '</P>';
        logTxt += '<P>cred_dir_binned: ' + cred_dir_binned + '</P>';
        logTxt += '<P>intercept: ' + intercept + '</P>';
        logTxt += '<P>===================================================</P>'; */

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

        // DEBUG: contribuciones DESPUÉS de multiplicar (mismo formato que SDB)
        logTxt += '<P>========== VALORES DESPUES DE MULTIPLICAR ==========</P>';
        logTxt += '<P/> intercept (test): ' + test;
        logTxt += '<P/> ent_t6_binned_res: ' + ent_t6_binned_res;
        logTxt += '<P/> t6_binned_res: ' + t6_binned_res;
        logTxt += '<P/> t6_creditel_binned_res: ' + t6_creditel_binned_res;
        logTxt += '<P/> t6_oca_binned_res: ' + t6_oca_binned_res;
        logTxt += '<P/> t0_fnb_binned_res: ' + t0_fnb_binned_res;
        logTxt += '<P/> t0_asi_binned_res: ' + t0_asi_binned_res;
        logTxt += '<P/> t0_bbva_binned_res: ' + t0_bbva_binned_res;
        logTxt += '<P/> t6_cred_dir_comp_binned_res: ' + t6_cred_dir_comp_binned_res;
        logTxt += '<P/> t6_banco_binned_res: ' + t6_banco_binned_res;
        logTxt += '<P/> vig_noauto_t6_coop_binned_res: ' + vig_noauto_t6_coop_binned_res;
        logTxt += '<P/> t0_santa_binned_res: ' + t0_santa_binned_res;
        logTxt += '<P/> emp_valor_binned_res: ' + emp_valor_binned_res;
        logTxt += '<P/> cont_t0_fucac_binned_res: ' + cont_t0_fucac_binned_res;
        logTxt += '<P/> brou_grupo_binned_res: ' + brou_grupo_binned_res;
        logTxt += '<P/> t6_pronto_binned_res: ' + t6_pronto_binned_res;
        logTxt += '<P/> t0_scotia_binned_res: ' + t0_scotia_binned_res;
        logTxt += '<P/> cred_dir_binned_res: ' + cred_dir_binned_res;
        logTxt += '<P/> TOTAL (logit): ' + total;
        logTxt += '<P>===================================================</P>';

        // Aplicar función logística y escalar a 0-1000 (igual que el original)
        const __e = Math.exp(Math.max(-50, Math.min(50, total)));
        let scoreNumeric = (__e / (1 + __e)) * 1000;
        let scoreRounded = Math.round(scoreNumeric);
        
        // DEBUG: Log cálculo final del score
        logTxt += '<P>========== CALCULO FINAL SCORE ==========</P>';
        logTxt += '<P>exp(total): ' + __e + '</P>';
        logTxt += '<P>scoreNumeric = exp(total) / (1 + exp(total)) * 1000: ' + scoreNumeric + '</P>';
        logTxt += '<P>scoreRounded = Math.round(scoreNumeric): ' + scoreRounded + '</P>';
        logTxt += '<P>===================================================</P>';

        // Umbral configurable para considerar "buen score" (por defecto 499)
        const goodThreshold = (scoringRules && typeof scoringRules.goodThreshold === 'number') ? scoringRules.goodThreshold : 499;

        // Construir logTxt extenso con toda la información de debugging (formato exacto de SDB-Enlamano-score.js)
        
        
         if (debugEnabled) { logTxt += '<P> => datosBcu: </P>'; }
         if (debugEnabled) { try {
            // Si tenemos datos RAW, usarlos directamente (igual que producción)
            if (normalizedData.rawData && normalizedData.rawData.datosBcu) {
                logTxt += JSON.stringify(normalizedData.rawData.datosBcu) + '<P/>';
            } else {
                // Fallback: construir estructura similar
                let bcuData = {
                    bcuRawData: null,
                    data: {
                        Nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || '',
                        Documento: (normalizedData.metadata && normalizedData.metadata.documento) || null,
                        SectorActividad: (normalizedData.metadata && normalizedData.metadata.sectorActividad) || '',
                        Periodo: (t0.metadata && t0.metadata.periodo) || '',
                        RubrosValoresGenerales: t0.rubrosValoresGenerales || [],
                        EntidadesRubrosValores: (t0.entities || []).map(function(e) {
                            return {
                                NombreEntidad: e.entidad || e.nombreEntidad || '',
                                Calificacion: e.rating || e.calificacion || '',
                                RubrosValores: e.rubros || []
                            };
                        })
                    },
                    errors: (normalizedData.errors) || null,
                    responseId: (normalizedData.responseId) || '00000000-0000-0000-0000-000000000000'
                };
                logTxt += JSON.stringify(bcuData) + '<P/>';
            }
            } catch (e) {
                logTxt += '[Error serializing t0 data]<P/>';
            } }

        // Log de datos BCU t6 - debe coincidir con el formato de producción
        if (debugEnabled) { logTxt += '<P> => datosBcu_T6: </P>'; }
        if (debugEnabled) { try {
            // Si tenemos datos RAW, usarlos directamente (igual que producción)
            if (normalizedData.rawData && normalizedData.rawData.datosBcuT6) {
                logTxt += JSON.stringify(normalizedData.rawData.datosBcuT6) + '<P/>';
            } else {
                // Fallback: construir estructura similar
                let bcuDataT6 = {
                    bcuRawData: null,
                    data: {
                        Nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || '',
                        Documento: (normalizedData.metadata && normalizedData.metadata.documento) || null,
                        SectorActividad: (normalizedData.metadata && normalizedData.metadata.sectorActividad) || '',
                        Periodo: (t6.metadata && t6.metadata.periodo) || '',
                        RubrosValoresGenerales: t6.rubrosValoresGenerales || [],
                        EntidadesRubrosValores: (t6.entities || []).map(function(e) {
                            return {
                                NombreEntidad: e.entidad || e.nombreEntidad || '',
                                Calificacion: e.rating || e.calificacion || '',
                                RubrosValores: e.rubros || []
                            };
                        })
                    },
                    errors: null,
                    responseId: '00000000-0000-0000-0000-000000000000'
                };
                logTxt += JSON.stringify(bcuDataT6) + '<P/>';
            }
        } catch (e) {
            logTxt += '[Error serializing t6 data]<P/>';
        } }

        // Log de cálculo de endeudamiento (formato exacto de producción)
        if (debugEnabled) logTxt += '<P> ***************** ENDEUDAMIENTO comienzo ****************** </P>';
        if (debugEnabled) logTxt += '<P> +++++ t2_mnPesos: ' + t2_mnPesos + '<P/>';
        if (debugEnabled) logTxt += '<P> +++++ t2_mePesos: ' + t2_mePesos + '<P/>';
        if (debugEnabled) logTxt += '<P> +++++ t6_mnPesos: ' + t6_mnPesos + '<P/>';
        if (debugEnabled) logTxt += '<P> +++++ t6_mePesos: ' + t6_mePesos + '<P/>';
        if (debugEnabled) logTxt += '<P> +++++ endeudamiento: ' + endeudamiento + '<P/>';
        if (debugEnabled) logTxt += '<P> ***************** ENDEUDAMIENTO fin ****************** </P>';

        // Log de entidades procesadas en t6 (producción usa el objeto current directamente)
        if (debugEnabled) {
            for (let i = 0; i < t6List.length; i++) {
                logTxt += '<P> => t6: ' + t6List[i] + '</P>';
            }
        }

        // Log de resultados de scoring por variable (formato exacto sin espacio despu�s de <P/>)
        if (debugEnabled) { 
            var __sum=[];
        __sum.push('<P/> ent_t6_binned_res: ' + ent_t6_binned_res);
        __sum.push('<P/> t6_binned_res: ' + t6_binned_res);
        __sum.push('<P/> t6_creditel_binned_res: ' + t6_creditel_binned_res);
        __sum.push('<P/> t6_oca_binned_res: ' + t6_oca_binned_res);
        __sum.push('<P/> t0_fnb_binned_res: ' + t0_fnb_binned_res);
        __sum.push('<P/> t0_asi_binned_res: ' + t0_asi_binned_res);
        __sum.push('<P/> t0_bbva_binned_res: ' + t0_bbva_binned_res);
        __sum.push('<P/> t6_cred_dir_comp_binned_res: ' + t6_cred_dir_comp_binned_res);
        __sum.push('<P/> t6_banco_binned_res: ' + t6_banco_binned_res);
        __sum.push('<P/> vig_noauto_t6_coop_binned_res: ' + vig_noauto_t6_coop_binned_res);
        __sum.push('<P/> t0_santa_binned_res: ' + t0_santa_binned_res);
        __sum.push('<P/> cont_t0_fucac_binned_res: ' + cont_t0_fucac_binned_res);
        __sum.push('<P/> brou_grupo_binned_res: ' + brou_grupo_binned_res);
        __sum.push('<P/> t6_pronto_binned_res: ' + t6_pronto_binned_res);
        __sum.push('<P/> t0_scotia_binned_res: ' + t0_scotia_binned_res);
        __sum.push('<P/> cred_dir_binned_res: ' + cred_dir_binned_res);
        __sum.push('<P/> total: ' + total);
        __sum.push('<P/> score: ' + scoreRounded);
        logTxt += __sum.join('');
        dbg('t0_bbva_binned_res after bin', t0_bbva_binned_res); }

        // Agregar resumen final al logTxt
        logTxt += '<P>============= RESULTADO FINAL =============</P>';
        logTxt += '<P>Score Final: ' + scoreRounded + '</P>';
        logTxt += '<P>Score Raw: ' + scoreNumeric + '</P>';
        logTxt += '<P>Total (logit): ' + total + '</P>';
        logTxt += '<P>Endeudamiento: ' + endeudamiento + '</P>';
        logTxt += '<P>Calificación Mínima: ' + calificacionMinima + '</P>';
        logTxt += '<P>Contador: ' + contador + '</P>';
        logTxt += '<P>Is Good (>= ' + goodThreshold + '): ' + (scoreRounded >= goodThreshold) + '</P>';
        logTxt += '<P>===========================================</P>';

        // Resultado unificado: contrato moderno + compatibilidad legacy
        let result = { 
            // Contrato moderno
            finalScore: scoreRounded,
            rawScore: scoreNumeric,
            baseScore: (typeof scoringRules.baseScore === 'number' ? scoringRules.baseScore : 0),
            contributions: {},
            metadata: {
                calculatedAt: new Date(),
                isRejected: false,
                rejectionReason: null,
                goodThreshold: goodThreshold,
                isGood: scoreRounded >= goodThreshold,
                provider: normalizedData.provider,
                periodoConsulta: periodoConsulta,
                periodoT2: periodoT2,
                periodoT6: periodoT6
            },
            flags: normalizedData.flags || {},
            validation: { hasValidData: true },

            // Compatibilidad con el script original
            score: scoreRounded,
            calificacionMinima: calificacionMinima,
            contador: contador,
            mensaje: 'No tenemos prestamo disponible en este momento',
            endeudamiento: endeudamiento,
            nombre: (normalizedData.metadata && normalizedData.metadata.nombre) || '',
            error_reglas: false,
            logTxt: logTxt,
            periodoConsulta: periodoConsulta,
            periodoT2: periodoT2,
            periodoT6: periodoT6
        }; 


            return result;
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
        if (!data || !data.periodData || !data.periodData.t0) {
            return 0;
        }
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
        if (!data || !data.periodData || !data.periodData.t0) {
            return 0;
        }
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
        if (!data || !data.periodData || !data.periodData.t0) {
            return '0';
        }
        const t0Data = data.periodData.t0;
        if (!t0Data || !t0Data.entities || !Array.isArray(t0Data.entities)) {
            return '0';
        }

        let worstRating = '0';
        let worstNumeric = 0;

        for (let i = 0; i < t0Data.entities.length; i++) {
            let rating = String(t0Data.entities[i].rating || '').toUpperCase().trim();
            let numeric = RATING_ORDER[rating] || 0;
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
        if (data.metadata && data.metadata.nombre && !data.flags.isDeceased) score++;

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
    function createRejectedScore(reason, message, logTxt, normalizedData) {
        // Extraer periodo de consulta si normalizedData está disponible
        let periodoConsulta = '';
        let periodoT2 = '';
        let periodoT6 = '';
        
        if (normalizedData && normalizedData.metadata && normalizedData.metadata.fechaConsulta) {
            try {
                const fecha = new Date(normalizedData.metadata.fechaConsulta);
                if (!isNaN(fecha.getTime())) {
                    const year = fecha.getFullYear();
                    const month = String(fecha.getMonth() + 1).padStart(2, '0');
                    periodoConsulta = year + '-' + month;
                }
            } catch (e) {
                // Ignorar error silenciosamente
            }
        }
        
        // Extraer periodos T2 y T6 si están disponibles
        if (normalizedData && normalizedData.periodData) {
            if (normalizedData.periodData.t0 && normalizedData.periodData.t0.metadata) {
                periodoT2 = normalizedData.periodData.t0.metadata.periodo || '';
            }
            if (normalizedData.periodData.t6 && normalizedData.periodData.t6.metadata) {
                periodoT6 = normalizedData.periodData.t6.metadata.periodo || '';
            }
        }
        
        return {
            finalScore: 0,
            rawScore: 0,
            baseScore: 0,
            contributions: {},
            metadata: {
                calculatedAt: new Date(),
                isRejected: true,
                rejectionReason: reason,
                rejectionMessage: message || reason,
                goodThreshold: 499,
                isGood: false,
                periodoConsulta: periodoConsulta,
                periodoT2: periodoT2,
                periodoT6: periodoT6
            },
            flags: {},
            validation: { hasValidData: false },
            logTxt: logTxt || ('<P>Rechazado: ' + reason + ' - ' + (message || '') + '</P>'),
            periodoConsulta: periodoConsulta,
            periodoT2: periodoT2,
            periodoT6: periodoT6
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




















