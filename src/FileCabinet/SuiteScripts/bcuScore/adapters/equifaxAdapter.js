/**
 * @NApiVersion 2.1
 * @description Adaptador Equifax OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/https', 'N/log', 'N/runtime', 'N/encode', '../domain/normalize'], 
function (https, log, runtime, encode, normalize) {
    'use strict';

    var TIMEOUT_MS = 15000; // REDUCIDO: 15s para respuesta rápida
    var TOKEN_CACHE_DURATION = 3300; // 55 minutos
    
    // Cache de token EN MEMORIA para máxima velocidad (sin NetSuite cache I/O)
    var _tokenCache = null;
    var _tokenExpiry = null;
    
    // Pre-compilar URLs y headers para evitar string concatenations
    var _config = null;

    /**
     * OPTIMIZADO: Fetch con caché agresivo y timeouts cortos
     */
    function fetch(documento, options) {
        options = options || {};
        
        try {
            // Lazy init config solo una vez
            if (!_config) {
                _config = getEquifaxConfig();
            }

            // Token con caché en memoria (sin I/O cache)
            var accessToken = getValidToken();
            
            // Request optimizado con timeout corto
            var response = executeEquifaxRequest(documento, accessToken, options);
            
            // Normalización rápida
            return normalize.normalizeEquifaxResponse(response);

        } catch (error) {
            // Log mínimo para no afectar performance
            if (options.debug) {
                log.debug({
                    title: 'Equifax Adapter Fast Error',
                    details: documento.substr(-4) + ': ' + (error.message || error.toString())
                });
            }
            
            throw createEquifaxError('EQUIFAX_FETCH_ERROR', error.message, error);
        }
    }

    /**
     * OPTIMIZADO: Token con caché en memoria (sin NetSuite cache I/O)
     */
    function getValidToken() {
        var now = Date.now();
        
        // Cache hit inmediato - sin validaciones adicionales
        if (_tokenCache && _tokenExpiry && now < _tokenExpiry) {
            return _tokenCache;
        }

        // Request token con timeout agresivo
        var tokenResponse = https.request({
            url: _config.tokenUrl,
            method: https.Method.POST,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + _config.basicAuth,
                'User-Agent': 'NetSuite-ELM/1.0'
            },
            body: 'grant_type=client_credentials&scope=ic-gcp-reporte',
            timeout: 10 // TIMEOUT MUY CORTO para token
        });

        if (tokenResponse.code !== 200) {
            throw createEquifaxError('TOKEN_ERROR', 'Token request failed: ' + tokenResponse.code);
        }

        var tokenData = JSON.parse(tokenResponse.body);
        var expiresIn = parseInt(tokenData.expires_in) || 3600;
        
        // Cache en memoria con buffer de seguridad
        _tokenCache = tokenData.access_token;
        _tokenExpiry = now + ((expiresIn - 300) * 1000); // 5min buffer
        
        return _tokenCache;
    }

    /**
     * OPTIMIZADO: Request Equifax con headers pre-compilados
     */
    function executeEquifaxRequest(documento, accessToken, options) {
        // Payload mínimo para velocidad
        var payload = {
            cedula: documento,
            periodo: options.includePeriods !== false ? ['t0', 't6'] : ['t0']
        };

        var response = https.request({
            url: _config.apiUrl,
            method: https.Method.POST,
            headers: _config.requestHeaders(accessToken),
            body: JSON.stringify(payload),
            timeout: TIMEOUT_MS
        });

        if (response.code !== 200) {
            throw mapEquifaxHttpError(response.code, response.body);
        }

        return JSON.parse(response.body);
    }

    /**
     * OPTIMIZADO: Configuración lazy-loaded una sola vez
     */
    function getEquifaxConfig() {
        var script = runtime.getCurrentScript();
        var clientId = script.getParameter({ name: 'custscript_equifax_client_id' });
        var clientSecret = script.getParameter({ name: 'custscript_equifax_client_secret' });
        
        if (!clientId || !clientSecret) {
            throw createEquifaxError('CONFIG_ERROR', 'Credenciales Equifax no configuradas');
        }

        // Pre-compilar Basic Auth para evitar encoding repetido
        var basicAuth = encode.convert({
            string: clientId + ':' + clientSecret,
            inputEncoding: encode.Encoding.UTF_8,
            outputEncoding: encode.Encoding.BASE_64
        });

        // Pre-compilar headers function para evitar object creation repetido
        var requestHeadersTemplate = {
            'Content-Type': 'application/vnd.com.equifax.clientconfig.v1+json',
            'Accept': 'application/json',
            'User-Agent': 'NetSuite-ELM/1.0'
        };

        return {
            tokenUrl: script.getParameter({ name: 'custscript_equifax_token_url' }) || 
                     'https://api.equifax.com/oauth/token',
            apiUrl: script.getParameter({ name: 'custscript_equifax_api_url' }) + '/interconnect',
            basicAuth: basicAuth,
            requestHeaders: function(token) {
                // Clone template y añadir auth - más rápido que crear desde cero
                var headers = Object.assign({}, requestHeadersTemplate);
                headers['Authorization'] = 'Bearer ' + token;
                return headers;
            }
        };
    }

    /**
     * OPTIMIZADO: Error mapping con lookup table
     */
    var HTTP_ERROR_MAP = {
        400: ['EQUIFAX_BAD_REQUEST', 'Solicitud inválida'],
        401: ['EQUIFAX_UNAUTHORIZED', 'Token inválido'],
        403: ['EQUIFAX_FORBIDDEN', 'Sin permisos'],
        404: ['EQUIFAX_NOT_FOUND', 'Documento no encontrado'],
        429: ['EQUIFAX_RATE_LIMIT', 'Límite de requests excedido'],
        500: ['EQUIFAX_SERVER_ERROR', 'Error interno Equifax'],
        503: ['EQUIFAX_UNAVAILABLE', 'Servicio no disponible']
    };

    function mapEquifaxHttpError(httpStatus, responseBody) {
        var mapping = HTTP_ERROR_MAP[httpStatus];
        if (mapping) {
            return createEquifaxError(mapping[0], mapping[1], { httpStatus: httpStatus });
        }
        return createEquifaxError('EQUIFAX_UNKNOWN_ERROR', 'Error desconocido: ' + httpStatus);
    }

    /**
     * OPTIMIZADO: Error creation mínima
     */
    function createEquifaxError(code, message, details) {
        var error = new Error(message);
        error.name = 'EquifaxAdapterError';
        error.code = code;
        error.provider = 'equifax';
        if (details) error.details = details;
        return error;
    }

    /**
     * Invalidar caché de token (para troubleshooting)
     */
    function invalidateTokenCache() {
        _tokenCache = null;
        _tokenExpiry = null;
    }

    // Public API - mínima para performance
    return {
        fetch: fetch,
        invalidateTokenCache: invalidateTokenCache,
        
        // Solo para debugging cuando sea necesario
        _internal: {
            getValidToken: getValidToken,
            executeEquifaxRequest: executeEquifaxRequest,
            createEquifaxError: createEquifaxError,
            TIMEOUT_MS: TIMEOUT_MS
        }
    };
});