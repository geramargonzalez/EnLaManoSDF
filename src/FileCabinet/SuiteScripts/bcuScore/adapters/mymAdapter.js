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

        // Fallback adicional: algunos entornos devuelven 'datosBcuT6' (sin guion bajo)
        if (!datosBcuT6 && responseBody && responseBody.datosBcuT6 &&
            responseBody.datosBcuT6 !== 'false' && responseBody.datosBcuT6 !== 'null') {
            try {
                datosBcuT6 = JSON.parse(responseBody.datosBcuT6);
                log.debug({ title: 'MYM parsed datosBcuT6 (alias)', details: { documento: documento } });
            } catch (e) {
                log.error({
                    title: 'MYM datosBcuT6 alias parse error - continuando con T6 vacío',
                    details: { error: e.toString(), documento: documento }
                });
                datosBcuT6 = null;
            }
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
                responseKeys: responseBody ? Object.keys(responseBody) : 'NO_RESPONSE',
                responseBodyPreview: responseBody ? JSON.stringify(responseBody).substring(0, 500) : 'NO_BODY'
            }
        });

        // CASO 1: Verificar si datosBcu existe y parsearlo
        let datosBcu = null;
        let datosBcuT6 = null;

        if (responseBody.datosBcu) {
            try {
                datosBcu = JSON.parse(responseBody.datosBcu);
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
            // datosBcu_T6 es false, null, o no existe - usar estructura vacía
            log.debug({
                title: 'MYM sin datosBcu_T6 - usando T6 vacío',
                details: {
                    documento: documento,
                    datosBcu_T6Value: responseBody.datosBcu_T6,
                    datosBcu_T6Type: typeof responseBody.datosBcu_T6
                }
            });
            datosBcuT6 = null;
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
