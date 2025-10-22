/**
 * @NApiVersion 2.1
 * @description Normalización de respuestas de proveedores BCU a formato uniforme
 */

define([], function () {
    'use strict'; 

    const PROVIDER_EQUIFAX = 'equifax';
    const PROVIDER_BCU = 'bcu';
    const PROVIDER_MYM = 'mym';

    const BAD_RATINGS = ['2B', '2', '3', '4', '5'];

    /**
     * Normaliza respuesta de Equifax IC GCP REPORTE a formato uniforme
     * Soporta dos formatos:
     * 1. Formato antiguo: entidadesRubrosValores_t0/t6, rubrosValoresGenerales_t0/t6
     * 2. Formato nuevo (BOX_FASE0_PER): variablesDeSalida con datos agregados BCU
     * @param {Object} raw - Respuesta cruda de Equifax
     * @returns {NormalizedBCUData}
     */
    function normalizeEquifaxResponse(raw) {
        const interconnect = raw?.interconnectResponse || {};
        const variables = interconnect.variablesDeSalida || {};
        const infoConsulta = interconnect.infoConsulta || {};

        // Verificar si la persona está fallecida
        const isDeceased = String(infoConsulta.fallecido || '').toUpperCase() === 'S';
        if (isDeceased) {
            return buildNormalizedData({
                provider: PROVIDER_EQUIFAX,
                documento: pickDocument(variables, raw),
                periodData: { t0: createEmptyPeriod(), t6: createEmptyPeriod() },
                flags: { isDeceased: true, hasRejectableRating: false },
                metadata: { 
                    nombre: sanitizeString(variables.nombre || infoConsulta.nombre),
                    fechaConsulta: infoConsulta.fechaConsulta || new Date().toISOString().split('T')[0]
                }
            });
        }

        // Detectar formato de respuesta
        const isNewFormat = variables.hasOwnProperty('vigente') || 
                           variables.hasOwnProperty('castigado') || 
                           variables.hasOwnProperty('bcu_calificacion');

        if (isNewFormat) {
            // Formato nuevo BOX_FASE0_PER
            return normalizeEquifaxNewFormat(raw, variables, infoConsulta);
        } else {
            // Formato antiguo con entidadesRubrosValores
            return normalizeEquifaxLegacyFormat(raw, variables, infoConsulta);
        }
    }

    /**
     * Normaliza formato antiguo de Equifax (entidadesRubrosValores_t0/t6)
     */
    function normalizeEquifaxLegacyFormat(raw, variables, infoConsulta) {
        // Normalizar datos de períodos con parsing de strings "Mn: x Me: y"
        const t0Data = {
            totals: normalizeRubroList(variables.rubrosValoresGenerales_t0),
            entities: normalizeEntityList(variables.entidadesRubrosValores_t0),
            // Parsear strings de totales agregados si están disponibles
            aggregates: parseEquifaxAggregates(variables)
        };

        const t6Data = {
            totals: normalizeRubroList(variables.rubrosValoresGenerales_t6),
            entities: normalizeEntityList(variables.entidadesRubrosValores_t6),
            aggregates: parseEquifaxAggregates(variables, '_t6') // Si tiene sufijos t6
        };

        // Extraer calificación mínima y verificar rechazos por mal BCU
        const worstRating = findWorstRating(t0Data.entities.concat(t6Data.entities));
        const hasRejectableRating = BAD_RATINGS.includes(worstRating);

        return buildNormalizedData({
            provider: PROVIDER_EQUIFAX,
            documento: pickDocument(variables, raw),
            periodData: { t0: t0Data, t6: t6Data },
            flags: { 
                isDeceased: false,
                hasRejectableRating: hasRejectableRating
            },
            metadata: {
                nombre: sanitizeString(variables.nombre),
                worstRating: worstRating,
                fechaConsulta: infoConsulta.fechaConsulta,
                aggregates: t0Data.aggregates
            }
        });
    }

    /**
     * Normaliza formato nuevo BOX_FASE0_PER de Equifax
     * Respuesta con datos agregados en variablesDeSalida
     */
    function normalizeEquifaxNewFormat(raw, variables, infoConsulta) {
        // Parsear valores de vigente, vencido, castigado (formato "Me: X Mn: Y")
        const vigente = parseMoneyString(variables.vigente || 'Me: 0 Mn: 0');
        const vencido = parseMoneyString(variables.vencido || 'Me: 0 Mn: 0');
        const castigado = parseMoneyString(variables.castigado || 'Me: 0 Mn: 0');
        const contingencias = parseMoneyString(variables.contingencias || 'Me: 0 Mn: 0');
        
        // Extraer calificación BCU
        const bcu_calificacion = String(variables.bcu_calificacion || '0').toUpperCase();
        const hasRejectableRating = BAD_RATINGS.includes(bcu_calificacion);
        
        // Construir entidad sintética desde los datos agregados
        const instituciones = String(variables.bcu_instituciones || 'CLEARING BCU').split(',').map(function(s) { return s.trim(); });
        
        // Crear entidades sintéticas por cada institución
        const entities = instituciones.map(function(institucion) {
            return {
                entidad: institucion,
                rating: bcu_calificacion,
                NombreEntidad: institucion,
                Calificacion: bcu_calificacion,
                vigente: vigente.total,
                vencido: vencido.total,
                castigado: castigado.total,
                total: vigente.total + vencido.total + castigado.total,
                rubros: [
                    {
                        rubro: 'VIGENTE',
                        Rubro: 'VIGENTE',
                        vigente: vigente.total,
                        vencido: 0,
                        castigado: 0,
                        MnPesos: vigente.mn,
                        MePesos: vigente.me,
                        cont: false
                    },
                    {
                        rubro: 'VENCIDO',
                        Rubro: 'VENCIDO',
                        vigente: 0,
                        vencido: vencido.total,
                        castigado: 0,
                        MnPesos: vencido.mn,
                        MePesos: vencido.me,
                        cont: false
                    },
                    {
                        rubro: 'CASTIGADO',
                        Rubro: 'CASTIGADO',
                        vigente: 0,
                        vencido: 0,
                        castigado: castigado.total,
                        MnPesos: castigado.mn,
                        MePesos: castigado.me,
                        cont: false
                    },
                    {
                        rubro: 'CONTINGENCIAS',
                        Rubro: 'CONTINGENCIAS',
                        vigente: contingencias.total,
                        vencido: 0,
                        castigado: 0,
                        MnPesos: contingencias.mn,
                        MePesos: contingencias.me,
                        cont: true
                    }
                ]
            };
        });
        
        // Construir totales agregados
        const totals = [
            {
                rubro: 'VIGENTE',
                vigente: vigente.total,
                vencido: 0,
                castigado: 0,
                total: vigente.total
            },
            {
                rubro: 'VENCIDO',
                vigente: 0,
                vencido: vencido.total,
                castigado: 0,
                total: vencido.total
            },
            {
                rubro: 'CASTIGADO',
                vigente: 0,
                vencido: 0,
                castigado: castigado.total,
                total: castigado.total
            },
            {
                rubro: 'CONTINGENCIAS',
                vigente: contingencias.total,
                vencido: 0,
                castigado: 0,
                total: contingencias.total
            }
        ];
        
        // Datos T0 (actual)
        const t0Data = {
            totals: totals,
            entities: entities,
            aggregates: {
                vigente: vigente,
                vencido: vencido,
                castigado: castigado,
                sumVigenteU1m: toNumber(variables.bcu_sum_vigente_u1m || 0),
                sumVencidoU1m: toNumber(variables.bcu_sum_novigente_u1m || 0), // "novigente" = vencido
                sumCastigadoU1m: toNumber(variables.bcu_sum_castigado_u1m || 0),
                cantEntidadesVigente: instituciones.length,
                cantEntidadesVencido: vencido.total > 0 ? 1 : 0,
                cantEntidadesCastigado: castigado.total > 0 ? 1 : 0
            },
            // Preservar rubros para compatibilidad con score.js
            rubrosValoresGenerales: totals.map(function(t) {
                return {
                    Rubro: t.rubro,
                    MnPesos: t.rubro === 'VIGENTE' ? vigente.mn : 
                             t.rubro === 'VENCIDO' ? vencido.mn :
                             t.rubro === 'CASTIGADO' ? castigado.mn : contingencias.mn,
                    MePesos: t.rubro === 'VIGENTE' ? vigente.me : 
                             t.rubro === 'VENCIDO' ? vencido.me :
                             t.rubro === 'CASTIGADO' ? castigado.me : contingencias.me
                };
            })
        };
        
        // Para T6 no tenemos datos en este formato, crear vacío
        const t6Data = createEmptyPeriod();
        
        return buildNormalizedData({
            provider: PROVIDER_EQUIFAX,
            documento: pickDocument(variables, raw),
            periodData: { t0: t0Data, t6: t6Data },
            flags: { 
                isDeceased: false,
                hasRejectableRating: hasRejectableRating
            },
            metadata: {
                nombre: sanitizeString(variables.nombre || infoConsulta.nombre),
                worstRating: bcu_calificacion,
                fechaConsulta: infoConsulta.fechaConsulta || new Date().toISOString().split('T')[0],
                aggregates: t0Data.aggregates,
                periodo: variables.periodo,
                codigo_institucion: variables.codigo_institucion
            },
            // Preservar datos RAW para debugging
            rawData: {
                variablesDeSalida: variables
            }
        });
    }

    /**
     * Normaliza respuesta BCU Direct (pendiente de implementación)
     * @param {Object} raw - Respuesta cruda de BCU
     * @returns {NormalizedBCUData}
     */
    function normalizeBcuResponse(raw) {
        // TODO: Implementar cuando esté disponible el API BCU Direct
        return buildNormalizedData({
            provider: PROVIDER_BCU,
            documento: (raw && raw.documento) || '',
            periodData: { t0: createEmptyPeriod(), t6: createEmptyPeriod() },
            flags: { isDeceased: false, hasRejectableRating: false },
            metadata: {}
        });
    }

    /**
     * Normaliza respuesta MYM (RiskAPI enlamanocrm)
     * Estructura esperada: { datosBcu: {...}, datosBcuT6: {...}, raw: {...} }
     * @param {Object} mymResponse - Respuesta de mymAdapter.fetch()
     * @param {string} documento - Documento consultado
     * @returns {NormalizedBCUData}
     */
    function normalizeMymResponse(mymResponse, documento) {
        const datosBcu = mymResponse.datosBcu || {};
        // Aceptar ambos nombres de propiedad: datosBcuT6 y datosBcu_T6
        const datosBcuT6 = mymResponse.datosBcuT6 || mymResponse.datosBcu_T6 || {};
        
        // IMPORTANTE: datosBcu contiene datos de T2 (2 meses atrás), NO T0
        // Esto está alineado con el score original SDB-Enlamano-score.js
        const dataT2 = datosBcu.data || {};
        const nombre = dataT2.Nombre || '';
        
        // Extraer data de T6 (datosBcuT6)
        const dataT6 = datosBcuT6.data || {};
        
        // Normalizar entidades y rubros de T2 (forzar arrays JS)
        function ensureJsArray(arr) {
            if (Array.isArray(arr)) return arr.slice();
            if (arr && typeof arr === 'object' && typeof arr.length === 'number') {
                var out = [];
                for (var i = 0; i < arr.length; i++) out.push(arr[i]);
                return out;
            }
            return [];
        }
        const entidadesT2 = ensureJsArray(dataT2.EntidadesRubrosValores || []);
        const rubrosT2 = ensureJsArray(dataT2.RubrosValoresGenerales || []);
        
        // Normalizar entidades y rubros de T6
        const entidadesT6 = ensureJsArray(dataT6.EntidadesRubrosValores || []);
        const rubrosT6 = ensureJsArray(dataT6.RubrosValoresGenerales || []);
        
        // Convertir formato MYM a formato normalizado
        // NOTA: Usamos nombres t0/t6 en la estructura normalizada por compatibilidad con score.js
        // pero los datos reales son T2 (datosBcu) y T6 (datosBcuT6)
        const t0Data = {
            totals: normalizeMymRubrosList(rubrosT2),
            entities: normalizeMymEntitiesList(entidadesT2),
            aggregates: extractMymAggregates(rubrosT2),
            // Preservar datos RAW para compatibilidad con SDB-Enlamano-score.js
            rawMirror: {
                periodo: dataT2.Periodo || '',
                realPeriod: 'T2' // Indicar que estos son datos de T2
            },
            rubrosValoresGenerales: rubrosT2 // Acceso directo a rubros originales
        };
        
        const t6Data = {
            totals: normalizeMymRubrosList(rubrosT6),
            entities: normalizeMymEntitiesList(entidadesT6),
            aggregates: extractMymAggregates(rubrosT6),
            // Preservar datos RAW para compatibilidad con SDB-Enlamano-score.js
            metadata: {
                periodo: dataT6.Periodo || '',
                realPeriod: 'T6' // Indicar que estos son datos de T6
            },
            rubrosValoresGenerales: rubrosT6 // Acceso directo a rubros originales
        };
        
        // Detectar peor calificación y si hay rechazables
        const allEntities = t0Data.entities.concat(t6Data.entities);
        const worstRating = findWorstRating(allEntities);
        const hasRejectableRating = BAD_RATINGS.includes(worstRating);
        
        return buildNormalizedData({
            provider: PROVIDER_MYM,
            documento: documento,
            periodData: { t0: t0Data, t6: t6Data },
            flags: { 
                isDeceased: false,
                hasRejectableRating: hasRejectableRating
            },
            metadata: {
                nombre: sanitizeString(nombre),
                worstRating: worstRating,
                documento: documento,
                sectorActividad: dataT2.SectorActividad || '',
                aggregates: t0Data.aggregates,
                tipoDocumento: 'IDE',
                // espejo crudo para logging similar a SDB
                rawMirror: {
                    tipoDocumento: 'IDE',
                    documento: documento,
                    datosBcu: datosBcu,
                    datosBcu_T6: (mymResponse && (mymResponse.datosBcuT6 === null || mymResponse.datosBcu_T6 === null)) ? null : (datosBcuT6 || null)
                }
            },
            // Preservar datos RAW completos para logTxt
            rawData: {
                datosBcu: datosBcu,
                datosBcuT6: datosBcuT6
            }
        });
    }

    /**
     * Normaliza lista de rubros de formato MYM a formato estándar
     * MYM usa: { MnPesos, MePesos } en lugar de { vigente, vencido, castigado }
     */
    function normalizeMymRubrosList(rubros) {
        if (!Array.isArray(rubros)) return [];
        
        return rubros.map(function(rubro) {
            const mnPesos = toNumber(rubro.MnPesos || 0);
            const mePesos = toNumber(rubro.MePesos || 0);
            
            return {
                rubro: String(rubro.Rubro || ''),
                vigente: mnPesos, // MYM no separa vigente/vencido/castigado en totales
                vencido: 0,
                castigado: 0,
                total: mnPesos + mePesos
            };
        });
    }

    /**
     * Normaliza lista de entidades de formato MYM
     * MYM usa: { NombreEntidad, Calificacion, Rubros: [...] }
     */
    function normalizeMymEntitiesList(entities) {
        if (!Array.isArray(entities)) return [];
        
        return entities.map(function(entity) {
            const entidadVal = String(entity.NombreEntidad || '');
            const ratingVal = String(entity.Calificacion || '').toUpperCase();
            
            // Calcular totales sumando rubros (aceptar RubrosValores o Rubros)
            const rubros = entity.RubrosValores || entity.Rubros || entity.rubrosValores || entity.rubros || [];
            let totalVigente = 0;
            let totalVencido = 0;
            let totalCastigado = 0;
            
            for (let i = 0; i < rubros.length; i++) {
                const rubro = rubros[i];
                const rubroNombre = String(rubro.Rubro || '').toUpperCase().trim();
                const mnPesos = toNumber(rubro.MnPesos || 0);
                const mePesos = toNumber(rubro.MePesos || 0);
                const total = mnPesos + mePesos;
                
                if (rubroNombre === 'VIGENTE') {
                    totalVigente += total;
                } else if (rubroNombre === 'VENCIDO') {
                    totalVencido += total;
                } else if (rubroNombre === 'CASTIGADO') {
                    totalCastigado += total;
                }
            }
            
            return {
                // Campos normalizados
                entidad: entidadVal,
                rating: ratingVal,
                // Campos legacy para compatibilidad con SDB-Enlamano-score.js
                NombreEntidad: entidadVal,
                Calificacion: ratingVal,
                vigente: totalVigente,
                vencido: totalVencido,
                castigado: totalCastigado,
                total: totalVigente + totalVencido + totalCastigado,
                rubros: normalizeMymEntityRubros(rubros)
            };
        });
    }

    /**
     * Normaliza rubros de una entidad específica (formato MYM)
     */
    function normalizeMymEntityRubros(rubros) {
        if (!Array.isArray(rubros)) return [];
        
        return rubros.map(function(r) {
            const mnPesos = toNumber(r.MnPesos || 0);
            const mePesos = toNumber(r.MePesos || 0);
            const total = mnPesos + mePesos;
            const name = String(r.Rubro || '').trim();
            const nameUpper = name.toUpperCase().trim();
            
            // Detectar contingencia por nombre de rubro (con trim extra para eliminar espacios)
            const isContingencia = nameUpper.indexOf('CONTING') > -1 || 
                                   nameUpper === 'CONTINGENCIAS' ||
                                   nameUpper === 'CONTINGENCIA';
            
            return {
                rubro: name,
                vigente: total, // MYM no separa vigente/vencido en nivel de rubro
                vencido: 0,
                castigado: 0,
                Rubro: name, // Campo legacy
                MnPesos: mnPesos,
                MePesos: mePesos,
                cont: isContingencia // Preservar flag de contingencia
            };
        });
    }

    /**
     * Extrae agregados de rubros MYM (suma de VIGENTE, VENCIDO, CASTIGADO)
     */
    function extractMymAggregates(rubros) {
        if (!Array.isArray(rubros)) {
            return {
                vigente: { mn: 0, me: 0, total: 0 },
                vencido: { mn: 0, me: 0, total: 0 },
                castigado: { mn: 0, me: 0, total: 0 },
                sumVigenteU1m: 0,
                sumVencidoU1m: 0,
                sumCastigadoU1m: 0,
                cantEntidadesVigente: 0,
                cantEntidadesVencido: 0,
                cantEntidadesCastigado: 0
            };
        }
        
        let vigenteTotal = { mn: 0, me: 0, total: 0 };
        let vencidoTotal = { mn: 0, me: 0, total: 0 };
        let castigadoTotal = { mn: 0, me: 0, total: 0 };
        
        for (let i = 0; i < rubros.length; i++) {
            const rubro = rubros[i];
            const rubroNombre = String(rubro.Rubro || '').toUpperCase();
            const mn = toNumber(rubro.MnPesos || 0);
            const me = toNumber(rubro.MePesos || 0);
            
            if (rubroNombre === 'VIGENTE') {
                vigenteTotal.mn += mn;
                vigenteTotal.me += me;
                vigenteTotal.total += (mn + me);
            } else if (rubroNombre === 'VENCIDO') {
                vencidoTotal.mn += mn;
                vencidoTotal.me += me;
                vencidoTotal.total += (mn + me);
            } else if (rubroNombre === 'CASTIGADO') {
                castigadoTotal.mn += mn;
                castigadoTotal.me += me;
                castigadoTotal.total += (mn + me);
            }
        }
        
        return {
            vigente: vigenteTotal,
            vencido: vencidoTotal,
            castigado: castigadoTotal,
            sumVigenteU1m: vigenteTotal.total,
            sumVencidoU1m: vencidoTotal.total,
            sumCastigadoU1m: castigadoTotal.total,
            cantEntidadesVigente: vigenteTotal.total > 0 ? 1 : 0,
            cantEntidadesVencido: vencidoTotal.total > 0 ? 1 : 0,
            cantEntidadesCastigado: castigadoTotal.total > 0 ? 1 : 0
        };
    }

    /**
     * Parsea strings de formato "Mn: 123.45 Me: 67.89" de Equifax
     */
    function parseEquifaxAggregates(variables, suffix) {
        suffix = suffix || '';
        return {
            vigente: parseMoneyString(variables['vigente' + suffix]),
            vencido: parseMoneyString(variables['vencido' + suffix]), 
            castigado: parseMoneyString(variables['castigado' + suffix]),
            sumVigenteU1m: toNumber(variables['bcu_sum_vigente_u1m' + suffix]),
            sumVencidoU1m: toNumber(variables['bcu_sum_vencido_u1m' + suffix]),
            sumCastigadoU1m: toNumber(variables['bcu_sum_castigado_u1m' + suffix]),
            cantEntidadesVigente: toNumber(variables['bcu_cant_entidades_vigente' + suffix]),
            cantEntidadesVencido: toNumber(variables['bcu_cant_entidades_vencido' + suffix]),
            cantEntidadesCastigado: toNumber(variables['bcu_cant_entidades_castigado' + suffix])
        };
    }

    /**
     * Parsea string "Mn: 123.45 Me: 67.89" o "Me: 67.89 Mn: 123.45" y retorna {mn, me, total}
     */
    function parseMoneyString(str) {
        if (!str || typeof str !== 'string') {
            return { mn: 0, me: 0, total: 0 };
        }
        const mnMatch = str.match(/Mn:\s*([\d.,]+)/i);
        const meMatch = str.match(/Me:\s*([\d.,]+)/i);
        const mn = mnMatch ? toNumber(mnMatch[1]) : 0;
        const me = meMatch ? toNumber(meMatch[1]) : 0;
        return {
            mn: mn,
            me: me,
            total: mn + me
        };
    }

    /**
     * Encuentra la peor calificación en lista de entidades
     */
    function findWorstRating(entities) {
        const ratingOrder = {
            '1A': 1, '1C': 2, '2A': 3, '0': 4, 'N/C': 5, 'N': 6, '2B': 7, '3': 8, '4': 9, '5': 10
        };

        let worstNumeric = 0;
        let worstLabel = '0';

        for (const entity of entities) {
            const rating = String(entity.rating || '').toUpperCase();
            const numeric = ratingOrder[rating] || 0;
            if (numeric > worstNumeric) {
                worstNumeric = numeric;
                worstLabel = rating;
            }
        }
        
        return worstLabel;
    }

    /**
     * Construye objeto de datos BCU normalizado
     * @param {Object} config - Configuración del objeto
     * @returns {NormalizedBCUData}
     */
    function buildNormalizedData(config) {
        return {
            provider: config.provider || PROVIDER_EQUIFAX,
            documento: String(config.documento || ''),
            periodData: config.periodData || {},
            flags: Object.assign({
                isDeceased: false,
                hasRejectableRating: false
            }, config.flags || {}),
            metadata: config.metadata || {},
            normalizedAt: new Date()
        };
    } 

    /**
     * Crea período vacío para casos sin datos
     */
    function createEmptyPeriod() {
        return {
            totals: [],
            entities: [],
            aggregates: {
                vigente: { mn: 0, me: 0, total: 0 },
                vencido: { mn: 0, me: 0, total: 0 },
                castigado: { mn: 0, me: 0, total: 0 },
                sumVigenteU1m: 0,
                sumVencidoU1m: 0,
                sumCastigadoU1m: 0,
                cantEntidadesVigente: 0,
                cantEntidadesVencido: 0,
                cantEntidadesCastigado: 0
            }
        };
    }

    /**
     * Normaliza lista de rubros generales
     */
    function normalizeRubroList(rubros) {
        if (!Array.isArray(rubros)) return [];

        return rubros.map(function(rubro) {
            return {
                rubro: String(rubro.rubro || ''),
                vigente: toNumber(rubro.vigente),
                vencido: toNumber(rubro.vencido),
                castigado: toNumber(rubro.castigado),
                total: toNumber(rubro.vigente) + toNumber(rubro.vencido) + toNumber(rubro.castigado)
            };
        });
    }

    /**
     * Normaliza lista de entidades con rubros
     */
    function normalizeEntityList(entities) {
        if (!Array.isArray(entities)) return [];

        return entities.map(function(entity) {
            // Keep both original/normalized and legacy field names to ensure
            // compatibility with the original SDB-Enlamano-score.js expectations
            const entidadVal = String(entity.entidad || entity.nombreEntidad || '');
            const ratingVal = String(entity.calificacion || entity.rating || '').toUpperCase();

            return {
                // normalized names
                entidad: entidadVal,
                rating: ratingVal,
                // legacy / original script aliases (exact names expected elsewhere)
                NombreEntidad: entidadVal,
                Calificacion: ratingVal,
                vigente: toNumber(entity.vigente),
                vencido: toNumber(entity.vencido), 
                castigado: toNumber(entity.castigado),
                total: toNumber(entity.vigente) + toNumber(entity.vencido) + toNumber(entity.castigado),
                rubros: normalizeEntityRubros(entity.rubros)
            };
        });
    }

    /**
     * Normaliza rubros de una entidad específica
     */
    function normalizeEntityRubros(rubros) {
        if (!Array.isArray(rubros)) return [];

        return rubros.map(function(rubro) {
            const rubroName = String(rubro.rubro || '');
            const rubroNameUpper = rubroName.toUpperCase();
            
            // Detectar contingencia por nombre de rubro
            const isContingencia = rubroNameUpper.indexOf('CONTING') > -1 || rubroNameUpper === 'CONTINGENCIAS';
            
            return {
                rubro: rubroName,
                vigente: toNumber(rubro.vigente),
                vencido: toNumber(rubro.vencido),
                castigado: toNumber(rubro.castigado),
                cont: isContingencia // Preservar flag de contingencia
            };
        });
    }

    /**
     * Extrae documento de diferentes ubicaciones posibles
     */
    function pickDocument(variables, raw) {
        return String(
            variables.cedula || 
            variables.documento || 
            raw?.interconnectResponse?.infoConsulta?.documento ||
            ''
        );
    }

    /**
     * Limpia strings removiendo caracteres especiales
     */
    function sanitizeString(str) {
        if (!str) return '';
        return String(str).trim().replaceAll(/[^\w\s]/gi, '');
    }

    /**
     * Convierte valor a número, manejando strings con comas/puntos
     */
    function toNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            // Remover comas y espacios, convertir
            const cleaned = value.replace(/[,\s]/g, '');
            const parsed = Number.parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    // Public API
    return {
        normalizeEquifaxResponse: normalizeEquifaxResponse,
        normalizeBcuResponse: normalizeBcuResponse,
        buildNormalizedData: buildNormalizedData,
        createEmptyPeriod: createEmptyPeriod,
        parseMoneyString: parseMoneyString,
        findWorstRating: findWorstRating,
        normalizeMymResponse: normalizeMymResponse,
        
        // Para testing
        _internal: {
            BAD_RATINGS: BAD_RATINGS,
            PROVIDER_EQUIFAX: PROVIDER_EQUIFAX,
            PROVIDER_BCU: PROVIDER_BCU,
            PROVIDER_MYM: PROVIDER_MYM,
            toNumber: toNumber,
            sanitizeString: sanitizeString
        }
    };
});

/**
 * @typedef {Object} NormalizedBCUData
 * @property {string} provider - Proveedor de datos ('equifax' | 'bcu')
 * @property {string} documento - Documento del consultado
 * @property {Object} periodData - Datos de períodos t0 y t6
 * @property {Object} flags - Banderas de estado (fallecido, mal rating, etc)
 * @property {Object} metadata - Metadatos adicionales
 * @property {Date} normalizedAt - Timestamp de normalización
 */
