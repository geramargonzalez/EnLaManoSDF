/**
 * @NApiVersion 2.1
 * @description Adaptador MYM (RiskAPI) para scoring BCU
 * Conecta con el servicio enlamanocrm de RiskAPI que retorna datosBcu y datosBcu_T6
 */

define(['N/https', 'N/log', '../domain/normalize'], 
function (https, log, normalize) {
    'use strict';
 
    const TIMEOUT_MS = 20000; // 20 segundos para la API MYM
    const MYM_API_URL = 'https://riskapi.info/api/models/v2/enlamanocrm/execute';
    const MYM_AUTH_BASIC = 'cHJvZDJfZW5sYW1hbm86ZGZlcjRlZHI='; // prod2_enlamano:dfer4edr

    /**
     * Fetch de datos BCU desde RiskAPI MYM
     */
    function fetch(documento, options) {
        options = options || {};
        
        try {
            // Ejecutar request a RiskAPI
            const response = executeRiskApiRequest(documento, options);

            // Normalizar respuesta
            return normalize.normalizeMymResponse(response, documento);

        } catch (error) {
            // Log de error si debug está activado
            if (options.debug) {
                log.debug({
                    title: 'MYM Adapter Error',
                    details: documento.substr(-4) + ': ' + (error.message || error.toString())
                });
            }
            
            throw createMymError('MYM_FETCH_ERROR', error.message, error);
        }
    }

    /**
     * Ejecuta request a RiskAPI enlamanocrm
     */
    function executeRiskApiRequest(documento, options) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + MYM_AUTH_BASIC
        };

        const body = {
            Documento: documento,
            TipoDocumento: 'IDE'
        };

        const response = https.post({
            url: MYM_API_URL,
            headers: headers,
            body: JSON.stringify(body),
            timeout: TIMEOUT_MS
        });

        // Verificar código HTTP
        if (response.code !== 200) {
            throw mapMymHttpError(response.code, response.body);
        }

        // Parsear respuesta
        let responseBody;
        try {
            responseBody = JSON.parse(response.body);
        } catch (parseError) {
            throw createMymError('MYM_PARSE_ERROR', 'No se pudo parsear respuesta JSON', parseError);
        }

        // DEBUG: Log completo de la estructura de respuesta
        log.debug({
            title: 'MYM Response Structure',
            details: {
                documento: documento,
                hasDataosBcu: !!(responseBody && responseBody.datosBcu),
                hasDatosBcuT6: !!(responseBody && (responseBody.datosBcu_T6 || responseBody.datosBcuT6)),
                datosBcu_T6_type: typeof responseBody.datosBcu_T6,
                datosBcu_T6_value: responseBody.datosBcu_T6 ? String(responseBody.datosBcu_T6).substring(0, 200) : 'EMPTY/NULL',
                datosBcuT6_type: typeof responseBody.datosBcuT6,
                datosBcuT6_value: responseBody.datosBcuT6 ? String(responseBody.datosBcuT6).substring(0, 200) : 'EMPTY/NULL',
                responseKeys: responseBody ? Object.keys(responseBody) : 'NO_RESPONSE'
            }
        });

        // CASO 1: Verificar si datosBcu existe y parsearlo
        let datosBcu = null;
        let datosBcuT6 = null;

        if (responseBody.datosBcu) {
            try {
                datosBcu = JSON.parse(responseBody.datosBcu);
                
                // CRITICAL FIX: Forzar conversión de arrays Java a JS nativo para T2
                if (datosBcu && datosBcu.data) {
                    datosBcu.data = forceConvertJavaArrays(datosBcu.data, documento, 'T2');
                }
            } catch (e) {
                throw createMymError('MYM_PARSE_BCU_ERROR', 'No se pudo parsear datosBcu', e);
            }

            // Verificar errores en datosBcu
            if (datosBcu.errors && Array.isArray(datosBcu.errors) && datosBcu.errors.length > 0) {
                const error = datosBcu.errors[0];
                if (error.status === 404) {
                    // CASO 2: Si datosBcu tiene error 404, usar los arrays directos del responseBody
                    log.debug({
                        title: 'MYM datosBcu 404 - usando estructura plana',
                        details: 'Documento: ' + documento
                    });
                    
                    return adaptFlatStructure(responseBody, documento);
                }
                throw createMymError('MYM_BCU_ERROR', 'Error en datosBcu', { errors: datosBcu.errors });
            }
        }

        // Intentar parsear datosBcu_T6 si existe y no es false/null
        if (responseBody.datosBcu_T6 && 
            responseBody.datosBcu_T6 !== 'false' && 
            responseBody.datosBcu_T6 !== false) {
            try {
                datosBcuT6 = JSON.parse(responseBody.datosBcu_T6);
                
                // CRITICAL FIX: Forzar conversión de arrays Java a JS nativo
                // Esto es necesario porque JSON.parse puede devolver objetos Java array-like
                if (datosBcuT6 && datosBcuT6.data) {
                    datosBcuT6.data = forceConvertJavaArrays(datosBcuT6.data, documento, 'T6');
                }
                
                // DEBUG: Verificar estructura DESPUÉS de JSON.parse y conversión
                if (datosBcuT6 && datosBcuT6.data) {
                    const t6Data = datosBcuT6.data;
                    const rubrosRaw = t6Data.RubrosValoresGenerales;
                    log.audit({
                        title: 'MYM T6 PARSE DEBUG',
                        details: {
                            documento: documento,
                            rubrosIsArray: Array.isArray(rubrosRaw),
                            rubrosType: Object.prototype.toString.call(rubrosRaw),
                            rubrosLength: rubrosRaw ? rubrosRaw.length : 'null',
                            rubrosHasIndex0: rubrosRaw ? !!(rubrosRaw[0]) : false,
                            rubrosIndex0: rubrosRaw && rubrosRaw[0] ? JSON.stringify(rubrosRaw[0]) : 'empty',
                            entidadesIsArray: Array.isArray(t6Data.EntidadesRubrosValores),
                            entidadesLength: t6Data.EntidadesRubrosValores ? t6Data.EntidadesRubrosValores.length : 'null'
                        }
                    });
                }
            } catch (e) {
                log.error({
                    title: 'MYM datosBcu_T6 parse error - continuando con T6 vacío',
                    details: {
                        documento: documento,
                        error: e.toString(),
                        datosBcu_T6Type: typeof responseBody.datosBcu_T6,
                        datosBcu_T6Value: String(responseBody.datosBcu_T6).substring(0, 100)
                    }
                });
                // Continuar con T6 vacío en lugar de fallar
                datosBcuT6 = null;
            }

            // Verificar errores en datosBcu_T6 solo si se parseó exitosamente
            if (datosBcuT6 && datosBcuT6.errors && Array.isArray(datosBcuT6.errors) && datosBcuT6.errors.length > 0) {
                const error = datosBcuT6.errors[0];
                if (error.status === 404) {
                    log.debug({
                        title: 'MYM datosBcu_T6 404 - usando T6 vacío',
                        details: 'Documento: ' + documento
                    });
                    datosBcuT6 = null; // Usar T6 vacío en lugar de fallar
                } else {
                    throw createMymError('MYM_BCU_T6_ERROR', 'Error en datosBcu_T6', { errors: datosBcuT6.errors });
                }
            }
        } else {
            // datosBcu_T6 no existe o es false/null - intentar fallback con datosBcuT6 (sin guión bajo)
            if (responseBody.datosBcuT6 && 
                responseBody.datosBcuT6 !== 'false' && 
                responseBody.datosBcuT6 !== false &&
                responseBody.datosBcuT6 !== 'null') {
                try {
                    datosBcuT6 = JSON.parse(responseBody.datosBcuT6);
                    // CRITICAL FIX: También convertir arrays para este formato alternativo
                    if (datosBcuT6 && datosBcuT6.data) {
                        datosBcuT6.data = forceConvertJavaArrays(datosBcuT6.data, documento, 'T6-alt');
                    }
                    log.debug({
                        title: 'MYM parsed datosBcuT6 (alias sin guión bajo)',
                        details: { documento: documento }
                    });
                } catch (e) {
                    log.error({
                        title: 'MYM datosBcuT6 alias parse error - continuando con T6 vacío',
                        details: { error: e.toString(), documento: documento }
                    });
                    datosBcuT6 = null;
                }
            } else {
                // Ningún formato de T6 disponible - usar estructura vacía
                log.debug({
                    title: 'MYM sin datosBcu_T6 ni datosBcuT6 - usando T6 vacío',
                    details: {
                        documento: documento,
                        datosBcu_T6Value: responseBody.datosBcu_T6,
                        datosBcu_T6Type: typeof responseBody.datosBcu_T6,
                        datosBcuT6Value: responseBody.datosBcuT6,
                        datosBcuT6Type: typeof responseBody.datosBcuT6
                    }
                });
                datosBcuT6 = null;
            }
        }

        // Verificar errores de validación en responseBody principal
        if (responseBody.errores && Array.isArray(responseBody.errores) && responseBody.errores.length > 0) {
            const primerError = responseBody.errores[0];
            throw createMymError(
                'MYM_VALIDATION_ERROR',
                primerError.mensaje || 'Error de validación',
                { errores: responseBody.errores }
            );
        }

        // CASO 3: Si no hay datosBcu ni datosBcu_T6 pero hay arrays directos, usar estructura plana
        if (!datosBcu && !datosBcuT6 && 
            (responseBody.entidadesRubrosValores_t0 || responseBody.rubrosValoresGenerales_t0)) {
            log.debug({
                title: 'MYM sin datosBcu/datosBcu_T6 - usando estructura plana',
                details: 'Documento: ' + documento
            });
            
            return adaptFlatStructure(responseBody, documento);
        }

        // CASO 4: Si datosBcu es null, es un error crítico (requerido)
        if (!datosBcu) {
            log.error({
                title: 'MYM Missing datosBcu - crítico',
                details: {
                    documento: documento,
                    hasDatosBcu: !!datosBcu,
                    responseKeys: Object.keys(responseBody),
                    responsePreview: JSON.stringify(responseBody).substring(0, 1000)
                }
            });
            
            throw createMymError(
                'MYM_MISSING_DATA',
                'La respuesta no contiene datosBcu (período T0 requerido)',
                { 
                    responseKeys: Object.keys(responseBody),
                    hasDatosBcu: false
                }
            );
        }
        
        // Si datosBcuT6 es null, crear estructura vacía (opcional)
        if (!datosBcuT6) {
            log.debug({
                title: 'MYM creando datosBcuT6 vacío',
                details: { documento: documento }
            });
            
            datosBcuT6 = {
                bcuRawData: null,
                data: {
                    Nombre: (datosBcu.data && datosBcu.data.Nombre) || '',
                    Documento: documento,
                    TipoDocumento: 'IDE',
                    SectorActividad: '',
                    Periodo: '',
                    RubrosValoresGenerales: [],
                    EntidadesRubrosValores: []
                },
                errors: null,
                responseId: '00000000-0000-0000-0000-000000000000'
            };
        }
        
        // Verificar que al menos T0 tenga datos válidos
        const hasValidT0Data = datosBcu && datosBcu.data && 
                               (datosBcu.data.EntidadesRubrosValores || datosBcu.data.RubrosValoresGenerales);
        
        if (!hasValidT0Data) {
            log.error({
                title: 'MYM Empty T0 Data - sin información en período actual',
                details: {
                    documento: documento,
                    t0DataKeys: (datosBcu && datosBcu.data) ? Object.keys(datosBcu.data) : 'NO_DATA',
                    t0Preview: datosBcu ? JSON.stringify(datosBcu).substring(0, 300) : 'NULL'
                }
            });
            
            throw createMymError(
                'MYM_EMPTY_DATA',
                'El período T0 (actual) no contiene entidades ni rubros',
                { t0HasData: false }
            );
        }

        // Retornar objeto con ambos períodos (T6 puede estar vacío)
        return {
            datosBcu: datosBcu,
            datosBcuT6: datosBcuT6,
            raw: responseBody
        };
    }

    /**
     * Adapta estructura plana de MYM (cuando viene sin datosBcu/datosBcu_T6 anidados)
     * al formato esperado por normalize
     */
    function adaptFlatStructure(responseBody, documento) {
        // Construir estructura compatible con normalize.normalizeMymResponse
        const datosBcu = {
            bcuRawData: null,
            data: {
                Nombre: responseBody.nombre || '',
                Documento: documento,
                TipoDocumento: responseBody.tipoDocumento || 'IDE',
                SectorActividad: responseBody.sectorActividad || '',
                Periodo: responseBody.periodo || '',
                RubrosValoresGenerales: responseBody.rubrosValoresGenerales_t0 || [],
                EntidadesRubrosValores: (responseBody.entidadesRubrosValores_t0 || []).map(function(e) {
                    return {
                        NombreEntidad: e.nombreEntidad || '',
                        Calificacion: e.calificacion || '',
                        Rubros: (e.rubrosValores || []).map(function(r) {
                            return {
                                Rubro: r.rubro || '',
                                MnPesos: r.mnPesos || 0,
                                MePesos: r.mePesos || 0,
                                MnDolares: r.mnDolares || 0,
                                MeDolares: r.meDolares || 0
                            };
                        })
                    };
                })
            },
            errors: null,
            responseId: responseBody.responseId || '00000000-0000-0000-0000-000000000000'
        };

        const datosBcuT6 = {
            bcuRawData: null,
            data: {
                Nombre: responseBody.nombre || '',
                Documento: documento,
                TipoDocumento: responseBody.tipoDocumento || 'IDE',
                SectorActividad: responseBody.sectorActividad || '',
                Periodo: responseBody.periodoT6 || '',
                RubrosValoresGenerales: responseBody.rubrosValoresGenerales_t6 || [],
                EntidadesRubrosValores: (responseBody.entidadesRubrosValores_t6 || []).map(function(e) {
                    return {
                        NombreEntidad: e.nombreEntidad || '',
                        Calificacion: e.calificacion || '',
                        Rubros: (e.rubrosValores || []).map(function(r) {
                            return {
                                Rubro: r.rubro || '',
                                MnPesos: r.mnPesos || 0,
                                MePesos: r.mePesos || 0,
                                MnDolares: r.mnDolares || 0,
                                MeDolares: r.meDolares || 0
                            };
                        })
                    };
                })
            },
            errors: null,
            responseId: responseBody.responseId || '00000000-0000-0000-0000-000000000000'
        };

        return {
            datosBcu: datosBcu,
            datosBcuT6: datosBcuT6,
            raw: responseBody
        };
    }

    /**
     * CRITICAL: Fuerza la conversión de arrays Java a arrays JS nativos
     * Esto es necesario porque JSON.parse en NetSuite puede devolver objetos
     * que tienen estructura de array pero no pasan Array.isArray()
     * @param {Object} data - Objeto que puede contener arrays Java
     * @param {string} documento - Para logging
     * @param {string} period - Nombre del período para logging
     * @returns {Object} - Objeto con arrays convertidos
     */
    function forceConvertJavaArrays(data, documento, period) {
        if (!data || typeof data !== 'object') return data;
        
        // Lista de propiedades que sabemos que son arrays
        const arrayProps = ['EntidadesRubrosValores', 'RubrosValoresGenerales', 'Rubros', 'RubrosValores'];
        
        for (let i = 0; i < arrayProps.length; i++) {
            const prop = arrayProps[i];
            if (data[prop] !== undefined && data[prop] !== null) {
                const original = data[prop];
                const converted = convertToNativeArray(original);
                
                // Log solo si hubo conversión
                if (!Array.isArray(original) && Array.isArray(converted) && converted.length > 0) {
                    log.audit({
                        title: 'forceConvertJavaArrays - Converted ' + prop,
                        details: {
                            documento: documento,
                            period: period,
                            originalType: Object.prototype.toString.call(original),
                            convertedLength: converted.length
                        }
                    });
                }
                
                data[prop] = converted;
                
                // Si es EntidadesRubrosValores, también convertir los Rubros dentro de cada entidad
                if (prop === 'EntidadesRubrosValores' && Array.isArray(data[prop])) {
                    for (let j = 0; j < data[prop].length; j++) {
                        if (data[prop][j] && data[prop][j].RubrosValores) {
                            data[prop][j].RubrosValores = convertToNativeArray(data[prop][j].RubrosValores);
                        }
                        if (data[prop][j] && data[prop][j].Rubros) {
                            data[prop][j].Rubros = convertToNativeArray(data[prop][j].Rubros);
                        }
                    }
                }
            }
        }
        
        return data;
    }
    
    /**
     * Convierte un objeto array-like a un array JS nativo
     */
    function convertToNativeArray(obj) {
        // Ya es array nativo
        if (Array.isArray(obj)) return obj;
        
        // Es null/undefined
        if (obj === null || obj === undefined) return [];
        
        // Tiene propiedad length numérica (típico de Java arrays)
        if (typeof obj === 'object' && typeof obj.length === 'number') {
            const arr = [];
            for (let i = 0; i < obj.length; i++) {
                arr.push(obj[i]);
            }
            return arr;
        }
        
        // Intentar convertir via JSON (fuerza serialización/deserialización)
        try {
            const jsonStr = JSON.stringify(obj);
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {
            // Ignorar errores
        }
        
        // Último intento: iterar con for..in
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            // Si las keys son numéricas consecutivas, probablemente es array-like
            const isNumericKeys = keys.length > 0 && keys.every(function(k, idx) {
                return String(idx) === k || !isNaN(parseInt(k, 10));
            });
            
            if (isNumericKeys) {
                const arr = [];
                for (let i = 0; i < keys.length; i++) {
                    arr.push(obj[keys[i]]);
                }
                return arr;
            }
        }
        
        // No se pudo convertir, retornar array vacío
        return [];
    }

    /**
     * Mapea errores HTTP de RiskAPI
     */
    const HTTP_ERROR_MAP = {
        400: ['MYM_BAD_REQUEST', 'Solicitud inválida'],
        401: ['MYM_UNAUTHORIZED', 'Credenciales inválidas'],
        403: ['MYM_FORBIDDEN', 'Sin permisos'],
        404: ['MYM_NOT_FOUND', 'Documento no encontrado'],
        429: ['MYM_RATE_LIMIT', 'Límite de requests excedido'],
        500: ['MYM_SERVER_ERROR', 'Error interno de RiskAPI'],
        503: ['MYM_UNAVAILABLE', 'Servicio no disponible']
    };

    function mapMymHttpError(httpStatus, responseBody) {
        const mapping = HTTP_ERROR_MAP[httpStatus];
        if (mapping) {
            return createMymError(mapping[0], mapping[1], { 
                httpStatus: httpStatus,
                body: responseBody 
            });
        }
        return createMymError('MYM_UNKNOWN_ERROR', 'Error desconocido: ' + httpStatus);
    }

    /**
     * Crea error estructurado de MYM
     */
    function createMymError(code, message, details) {
        const error = new Error(message);
        error.name = 'MymAdapterError';
        error.code = code;
        error.provider = 'mym';
        if (details) error.details = details;
        return error;
    }

    // Public API
    return {
        fetch: fetch,
        
        // Para debugging
        _internal: {
            executeRiskApiRequest: executeRiskApiRequest,
            adaptFlatStructure: adaptFlatStructure,
            createMymError: createMymError,
            TIMEOUT_MS: TIMEOUT_MS,
            MYM_API_URL: MYM_API_URL
        }
    };
});
