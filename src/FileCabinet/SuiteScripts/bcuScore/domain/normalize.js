/**
 * @NApiVersion 2.1
 * @description Normalización de respuestas de proveedores BCU a formato uniforme
 */

define([], function () {
    'use strict';

    const PROVIDER_EQUIFAX = 'equifax';
    const PROVIDER_BCU = 'bcu';

    const BAD_RATINGS = ['2B', '2', '3', '4', '5'];

    /**
     * Normaliza respuesta de Equifax IC GCP REPORTE a formato uniforme
     * @param {Object} raw - Respuesta cruda de Equifax
     * @returns {NormalizedBCUData}
     */
    function normalizeEquifaxResponse(raw) {
        const interconnect = (raw && raw.interconnectResponse) || {};
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
                    nombre: sanitizeString(variables.nombre),
                    fechaConsulta: infoConsulta.fechaConsulta
                }
            });
        }

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
     * Parsea string "Mn: 123.45 Me: 67.89" y retorna {mn, me, total}
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

        for (let i = 0; i < entities.length; i++) {
            const rating = String(entities[i].rating || '').toUpperCase();
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
            return {
                entidad: String(entity.entidad || entity.nombreEntidad || ''),
                rating: String(entity.calificacion || entity.rating || '').toUpperCase(),
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
            return {
                rubro: String(rubro.rubro || ''),
                vigente: toNumber(rubro.vigente),
                vencido: toNumber(rubro.vencido),
                castigado: toNumber(rubro.castigado)
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
            (raw.interconnectResponse && raw.interconnectResponse.infoConsulta && raw.interconnectResponse.infoConsulta.documento) ||
            ''
        );
    }

    /**
     * Limpia strings removiendo caracteres especiales
     */
    function sanitizeString(str) {
        if (!str) return '';
        return String(str).trim().replace(/[^\w\s]/gi, '');
    }

    /**
     * Convierte valor a número, manejando strings con comas/puntos
     */
    function toNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            // Remover comas y espacios, convertir
            const cleaned = value.replace(/[,\s]/g, '');
            const parsed = parseFloat(cleaned);
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
        
        // Para testing
        _internal: {
            BAD_RATINGS: BAD_RATINGS,
            PROVIDER_EQUIFAX: PROVIDER_EQUIFAX,
            PROVIDER_BCU: PROVIDER_BCU,
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