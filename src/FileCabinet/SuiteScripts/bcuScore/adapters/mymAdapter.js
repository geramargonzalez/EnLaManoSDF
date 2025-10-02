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

        // Verificar errores de validación
        if (responseBody.errores && Array.isArray(responseBody.errores) && responseBody.errores.length > 0) {
            const primerError = responseBody.errores[0];
            throw createMymError(
                'MYM_VALIDATION_ERROR',
                primerError.mensaje || 'Error de validación',
                { errores: responseBody.errores }
            );
        }

        // Verificar que existan los datos BCU
        if (!responseBody.datosBcu || !responseBody.datosBcu_T6) {
            throw createMymError(
                'MYM_MISSING_DATA',
                'La respuesta no contiene datosBcu o datosBcu_T6',
                { response: responseBody }
            );
        }

        // Parsear los JSON strings internos
        let datosBcu, datosBcuT6;
        
        try {
            datosBcu = JSON.parse(responseBody.datosBcu);
        } catch (e) {
            throw createMymError('MYM_PARSE_BCU_ERROR', 'No se pudo parsear datosBcu', e);
        }

        try {
            datosBcuT6 = JSON.parse(responseBody.datosBcu_T6);
        } catch (e) {
            throw createMymError('MYM_PARSE_BCU_T6_ERROR', 'No se pudo parsear datosBcu_T6', e);
        }

        // Verificar errores en datosBcu
        if (datosBcu.errors && Array.isArray(datosBcu.errors)) {
            const error = datosBcu.errors[0];
            if (error.status === 404) {
                throw createMymError('MYM_NOT_FOUND', 'Documento no encontrado en BCU', { errors: datosBcu.errors });
            }
            throw createMymError('MYM_BCU_ERROR', 'Error en datosBcu', { errors: datosBcu.errors });
        }

        // Verificar errores en datosBcu_T6
        if (datosBcuT6.errors && Array.isArray(datosBcuT6.errors)) {
            const error = datosBcuT6.errors[0];
            if (error.status === 404) {
                throw createMymError('MYM_NOT_FOUND', 'Documento no encontrado en BCU (T6)', { errors: datosBcuT6.errors });
            }
            throw createMymError('MYM_BCU_T6_ERROR', 'Error en datosBcu_T6', { errors: datosBcuT6.errors });
        }

        // Retornar objeto con ambos períodos parseados
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
            createMymError: createMymError,
            TIMEOUT_MS: TIMEOUT_MS,
            MYM_API_URL: MYM_API_URL
        }
    };
});
