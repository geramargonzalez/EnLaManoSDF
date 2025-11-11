/**
 * @NApiVersion 2.1
 * @description Adaptador Equifax OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/https', 'N/log', 'N/runtime', 'N/encode', 'N/cache', '../domain/normalize'], 
function (https, log, runtime, encode, cache, normalize) {
    'use strict';

    const TIMEOUT_MS = 15000; // REDUCIDO: 15s para respuesta rápida
    const TOKEN_CACHE_DURATION_SANDBOX = 3000; // 50 minutos en segundos (3000s = 50min)
    const TOKEN_CACHE_DURATION_PRODUCTION = 86400; // 24 horas en segundos (86400s = 24hrs)
    const TOKEN_CACHE_KEY_PREFIX = 'equifax_token';
    
    // Cache de NetSuite para persistencia entre requests
    let _cacheInstance = null;
    
    // Pre-compilar URLs y headers para evitar string concatenations
    let _config = null;

    /**
     * Determina si el adapter debe operar en modo SANDBOX/UAT o PRODUCTION.
     * Prioridad:
     * 1) options.isSandbox (boolean)
     * 2) Script Parameter: custscript_equifax_environment | custscript_equifax_env | custscript_equifax_is_sandbox
     * 3) Environment variables: EQUIFAX_ENV / EQUIFAX_IS_SANDBOX
     * 4) Default: SANDBOX (por seguridad evitar llamadas accidentales a PROD)
     */
    function determineIsSandbox(options) {
        try {
            options = options || {};
            if (typeof options.isSandbox === 'boolean') return options.isSandbox;

            if (runtime && runtime.getCurrentScript) {
                var script = runtime.getCurrentScript();
                var envParam = script.getParameter({ name: 'custscript_equifax_environment' }) ||
                               script.getParameter({ name: 'custscript_equifax_env' }) ||
                               script.getParameter({ name: 'custscript_equifax_is_sandbox' });
                if (envParam !== null && envParam !== undefined) {
                    var s = String(envParam).toLowerCase();
                    if (s === 'production' || s === 'prod' || s === 'p' || s === '0' || s === 'false') return false;
                    if (s === 'sandbox' || s === 'uat' || s === 'test' || s === '1' || s === 'true') return true;
                }
            }
        } catch (e) {
            // ignore and fallback to env vars
        }

        if (typeof process !== 'undefined' && process.env) {
            var env = process.env.EQUIFAX_ENV || process.env.EQUIFAX_ENVIRONMENT || process.env.EQUIFAX_IS_SANDBOX;
            if (env) {
                var s2 = String(env).toLowerCase();
                if (s2 === 'production' || s2 === 'prod' || s2 === '0') return false;
                if (s2 === 'sandbox' || s2 === 'uat' || s2 === '1' || s2 === 'true') return true;
            }
        }

        // Default: sandbox (más seguro)
        return true;
    }

    /** 
     * OPTIMIZADO: Fetch con generación de token por ambiente (UAT / PROD)
     * @param {string} documento - Documento a consultar
     * @param {Object} options - Opciones de consulta
     * @param {boolean} options.forceNewToken - Si es true, genera un nuevo token ignorando el cache
     * @param {boolean} options.isSandbox - Ambiente (true=UAT, false=PROD)
     * @param {boolean} options.debug - Habilita logs de debugging
     */
    function fetch(documento, options) {
        options = options || {};
        try {
            // Determinar ambiente (options -> script parameter -> default SANDBOX)
            // const isSandbox = determineIsSandbox(options);
            const isSandbox = true; // FORZADO A SANDBOX PARA TESTING

            // Obtener configuración para el ambiente especificado
            _config = getEquifaxConfig(isSandbox);
            
            // Verificar si se debe forzar generación de nuevo token
            const forceRefresh = options.forceNewToken === true;
            
            if (forceRefresh) {
                log.audit({
                    title: 'Equifax Token Force Refresh',
                    details: 'Generando nuevo token por solicitud explícita (forceNewToken=true)'
                });
            }
            
            const accessToken = getValidToken(isSandbox, forceRefresh);
            
            // Request optimizado con timeout corto
            const response = executeEquifaxRequest(documento, accessToken, options);
 
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
    /**
     * Obtiene la instancia del caché de NetSuite (lazy initialization)
     */
    function getCacheInstance() {
        if (!_cacheInstance) {
            _cacheInstance = cache.getCache({
                name: 'equifaxTokenCache',
                scope: cache.Scope.PUBLIC
            });
        }
        return _cacheInstance;
    }

    /**
     * Obtiene o genera un token válido para el ambiente solicitado usando N/cache.
     * El token se almacena en NetSuite Cache con TTL dinámico:
     * - Sandbox: 50 minutos (3000s)
     * - Production: 24 horas (86400s)
     * forceRefresh=true para forzar generación de nuevo token.
     * @param {boolean} isSandbox
     * @param {boolean} forceRefresh
     * @returns {string} accessToken
     */
    function getValidToken(isSandbox, forceRefresh) {
        const envKey = isSandbox ? 'sandbox' : 'production';
        const cacheKey = TOKEN_CACHE_KEY_PREFIX + '_' + envKey;
        
        // TTL dinámico: 50 min para sandbox, 24 hrs para producción
        const cacheDuration = isSandbox ? TOKEN_CACHE_DURATION_SANDBOX : TOKEN_CACHE_DURATION_PRODUCTION;
        const cacheDurationLabel = isSandbox ? '50 minutes' : '24 hours';
        
        // ⚠️ TESTING MODE: Always generate new token (cache disabled)
        log.audit({
            title: 'Equifax Token - TESTING MODE',
            details: 'Cache DISABLED - Generating fresh token for every request'
        });
        
        // // Si no se fuerza refresh, intentar obtener del caché
        // if (!forceRefresh) {
        //     const cachedToken = getCacheInstance().get({ key: cacheKey });
        //     if (cachedToken) {
        //         log.debug({
        //             title: 'Equifax Token Cache Hit',
        //             details: 'Using cached token for ' + envKey + ' (TTL: ' + cacheDurationLabel + ')'
        //         });
        //         return cachedToken;
        //     }
        // }

        // Cache miss o forceRefresh: generar nuevo token
        log.debug({
            title: 'Equifax Token Generation',
            details: 'Generating new token for ' + envKey
        });

        // Generar nuevo token
        const cfg = getEquifaxConfig(isSandbox);

      /*   log.audit({
            title: 'Equifax Token Request - Full Details',
            details: JSON.stringify({
                environment: envKey,
                tokenUrl: cfg.tokenUrl,
                basicAuthLength: cfg.basicAuth.length,
                basicAuthPreview: cfg.basicAuth.substring(0, 20) + '...',
                scope: cfg.tokenScope
            })
        });
         */
        const scope = cfg.tokenScope || cfg.apiUrl.replace(/\/execute$/, '');
        const body = 'grant_type=client_credentials&scope=' + encodeURIComponent(scope);
        
        const tokenResponse = https.request({
            url: cfg.tokenUrl,
            method: https.Method.POST,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + cfg.basicAuth
            },
            body: body,
            timeout: 10000
        });

        log.debug({
            title: 'Equifax Token Response',
            details: 'Response Code: ' + tokenResponse.code + ', Body: ' + tokenResponse.body
        });

        if (!tokenResponse || tokenResponse.code !== 200) {
            throw createEquifaxError('TOKEN_ERROR', 'Token request failed: ' + (tokenResponse ? tokenResponse.code : 'NO_RESPONSE'));
        }

        const tokenData = JSON.parse(tokenResponse.body);
        const accessToken = tokenData.access_token;

        // Guardar en caché de NetSuite con TTL según ambiente
        getCacheInstance().put({
            key: cacheKey,
            value: accessToken,
            ttl: cacheDuration
        });



        return accessToken;
    }

    /**
     * OPTIMIZADO: Request Equifax con headers pre-compilados
     * Usa nueva API BOX_FASE0_PER de MANDAZY
     */
    function executeEquifaxRequest(documento, accessToken, options) {
        // Obtener fecha actual para anio/mes
        const now = new Date();
        const anio = String(now.getFullYear());
        const mes = String(now.getMonth() + 1).padStart(2, '0');
        
        // Formatear documento con guión si no lo tiene (formato: xxxxxxx-x)
        const docFormatted = formatDocumento(documento);
        
        // Payload según documentación BOX_FASE0_PER
        const payload = {
            applicants: {
                primaryConsumer: {
                    personalInformation: {
                        documento: docFormatted,
                        tipoDocumento: 'CI',
                        paisDocumento: 'UY',
                        anio: anio,
                        mes: mes
                    }
                }
            },
            productData: {
                billTo: _config.billTo,
                shipTo: _config.shipTo,
                productName: _config.productName,
                productOrch: _config.productOrch,
                configuration: _config.configuration,
                customer: _config.customer,
                model: _config.model
            }
        };

        log.debug({
            title: 'Equifax Request Payload',
            details: JSON.stringify(payload)
        });

        // Log completo del request para enviar a técnicos
        // const requestHeaders = _config.requestHeaders(accessToken);
        
        // Crear representación explícita con comillas para debugging

        const requestOptions = {
            url: _config.apiUrl,
            method: https.Method.POST,
            headers: {
                'Content-Type': 'application/vnd.com.equifax.clientconfig.v1+json',
                'Authorization': 'Bearer ' + accessToken
            },
            body: JSON.stringify(payload),
            timeout: TIMEOUT_MS
        };



        const response = https.request(requestOptions);

        // Extraer correlationId de los headers de la respuesta
        const correlationId = response.headers['x-correlation-id'] || 
                             response.headers['X-Correlation-Id'] ||
                             response.headers['correlationid'] ||
                             null;

        log.debug({
            title: 'Equifax Response',
            details: 'Code: ' + response.code + ', CorrelationId: ' + correlationId + ', Body: ' + response.body
        });

        log.debug('response headers', response.headers);

 /*        var r = https.get({ url: 'https://api.ipify.org' });
        log.debug('Egress IP', r.body); */ // IP pública desde la que sale NetSuite

        if (response.code !== 200) {
            throw mapEquifaxHttpError(response.code, response.body);
        }

        const responseBody = JSON.parse(response.body);
        
        // Agregar correlationId al objeto de respuesta para que esté disponible en normalize
        if (correlationId) {
            responseBody._equifaxCorrelationId = correlationId;
        }

        return responseBody;
    }
    
    /**
     * Formatea documento al formato requerido por Equifax (xxxxxxx-x)
     */
    function formatDocumento(documento) {
        if (!documento) return '';
        
        // Remover caracteres no numéricos
        const cleaned = String(documento).replace(/[^\d]/g, '');
        
        // Si tiene 8 dígitos, agregar guión antes del último
        if (cleaned.length === 8) {
            return cleaned.substring(0, 7) + '-' + cleaned.substring(7);
        }
        
        // Si ya tiene el formato correcto, devolverlo
        if (cleaned.length === 7 || cleaned.length === 6) {
            return cleaned;
        }
        
        return cleaned;
    }

    /**
     * OPTIMIZADO: Configuración lazy-loaded una sola vez
     * Soporta Sandbox y Producción mediante Script Parameters
     */
    function getEquifaxConfig(isSandbox) {
        const environment = isSandbox ? 'SANDBOX' : 'PRODUCTION';

        // Intentar leer credenciales desde Script Parameters (preferido)
        let clientId, clientSecret;
        let configuration = 'Config';
        // Valores EXACTOS según Postman Collection UAT
        let billTo = '011314B001';
        let shipTo = '011314B001S0001';
        let productName = 'UYICBOX';
        let productOrch = 'boxFase0Per';
        let customer = 'UYICMANDAZY';
        let model = 'boxFase0PerMandazy';


        if (isSandbox) {
            // Credenciales Sandbox de Equifax
            clientId = 'KAIXWP3JO4y1lv4pJLoRE2XaD7S3R8bh';
            clientSecret = 'owBkHrSBNJn4jmtm';
        } else {
            // Credenciales Producción (reemplazar con valores reales)
            clientId = '<CLIENT_ID>';
            clientSecret = '<CLIENT_SECRET>';
        }
        // URLs según ambiente
        // UAT (Sandbox/Testing) usa api.uat.latam.equifax.com
        // PROD (Production) usa api.latam.equifax.com
        const baseUrls = isSandbox ? {
            tokenUrl: 'https://api.uat.latam.equifax.com/v2/oauth/token',
            apiUrl: 'https://api.uat.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        } : {
            tokenUrl: 'https://api.latam.equifax.com/v2/oauth/token',
            apiUrl: 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        };

        // tokenScope (scope requerido para grant_type)
        // El scope es el mismo para UAT y PROD (sin el prefijo .uat)
        const tokenScope = 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations';

        // Crear Basic Auth (NetSuite: use N/encode; Node: use Buffer)
        let basicAuth = '';
        try {
            if (encode && typeof encode.convert === 'function') {
                basicAuth = encode.convert({
                    string: clientId + ':' + clientSecret,
                    inputEncoding: encode.Encoding.UTF_8,
                    outputEncoding: encode.Encoding.BASE_64
                });
            } else if (typeof Buffer !== 'undefined') {
                basicAuth = Buffer.from(clientId + ':' + clientSecret).toString('base64');
            }
        } catch (e) {
            // last resort: don't include credentials
            basicAuth = '';
        }

        log.audit({ title: 'Equifax Config Initialized', details: 'Environment: ' + environment });

        return {
            environment: environment,
            isSandbox: isSandbox,
            tokenUrl: baseUrls.tokenUrl,
            apiUrl: baseUrls.apiUrl,
            basicAuth: basicAuth,
            tokenScope: tokenScope,
            billTo: billTo,
            shipTo: shipTo,
            productName: productName,
            productOrch: productOrch,
            customer: customer,
            model: model,
            configuration: configuration
        };
    }

    /**
     * OPTIMIZADO: Error mapping con lookup table
     */
    const HTTP_ERROR_MAP = {
        400: ['EQUIFAX_BAD_REQUEST', 'Solicitud inválida'],
        401: ['EQUIFAX_UNAUTHORIZED', 'Token inválido'],
        403: ['EQUIFAX_FORBIDDEN', 'Sin permisos'],
        404: ['EQUIFAX_NOT_FOUND', 'Documento no encontrado'],
        418: ['EQUIFAX_REJECTED', 'Solicitud rechazada por Equifax (418) - verificar datos o rate limit'],
        429: ['EQUIFAX_RATE_LIMIT', 'Límite de requests excedido'],
        500: ['EQUIFAX_SERVER_ERROR', 'Error interno Equifax'],
        503: ['EQUIFAX_UNAVAILABLE', 'Servicio no disponible']
    };

    function mapEquifaxHttpError(httpStatus, responseBody) {
        const mapping = HTTP_ERROR_MAP[httpStatus];
        if (mapping) {
            return createEquifaxError(mapping[0], mapping[1], { httpStatus: httpStatus });
        }
        return createEquifaxError('EQUIFAX_UNKNOWN_ERROR', 'Error desconocido: ' + httpStatus);
    }

    /**
     * OPTIMIZADO: Error creation mínima
     */
    function createEquifaxError(code, message, details) {
        const error = new Error(message);
        error.name = 'EquifaxAdapterError';
        error.code = code;
        error.provider = 'equifax';
        if (details) error.details = details;
        return error;
    }

    /**
     * Invalidar caché de token usando N/cache de NetSuite
     * @param {boolean} isSandbox - Si se especifica, solo invalida ese ambiente. Si es undefined, invalida ambos.
     */
    function invalidateTokenCache(isSandbox) {
        const cacheInst = getCacheInstance();
        
        if (typeof isSandbox === 'boolean') {
            const key = isSandbox ? 'sandbox' : 'production';
            const cacheKey = TOKEN_CACHE_KEY_PREFIX + '_' + key;
            cacheInst.remove({ key: cacheKey });
            log.audit({
                title: 'Equifax Token Cache Invalidated',
                details: 'Cleared token for: ' + key
            });
        } else {
            // Invalidar ambos ambientes
            cacheInst.remove({ key: TOKEN_CACHE_KEY_PREFIX + '_sandbox' });
            cacheInst.remove({ key: TOKEN_CACHE_KEY_PREFIX + '_production' });
            log.audit({
                title: 'Equifax Token Cache Invalidated',
                details: 'Cleared all tokens (sandbox & production)'
            });
        }
    }

    /**
     * Obtener información del caché actual (para monitoreo/debugging)
     */
    function getCacheInfo(isSandbox) {
        const envKey = typeof isSandbox === 'boolean' ? (isSandbox ? 'sandbox' : 'production') : 'unknown';
        const cacheKey = TOKEN_CACHE_KEY_PREFIX + '_' + envKey;
        const cacheInst = getCacheInstance();
        const cachedToken = cacheInst.get({ key: cacheKey });
        
        // TTL dinámico según ambiente
        const cacheDuration = typeof isSandbox === 'boolean' 
            ? (isSandbox ? TOKEN_CACHE_DURATION_SANDBOX : TOKEN_CACHE_DURATION_PRODUCTION)
            : 0;
        const cacheDurationLabel = typeof isSandbox === 'boolean'
            ? (isSandbox ? '50 minutes' : '24 hours')
            : 'unknown';
        
        return {
            environment: envKey,
            cacheKey: cacheKey,
            hasCachedToken: !!cachedToken,
            tokenPreview: cachedToken ? cachedToken.substring(0, 20) + '...' : null,
            cacheDuration: cacheDuration + ' seconds (' + cacheDurationLabel + ')',
            scope: 'PUBLIC',
            cacheName: 'equifaxTokenCache'
        };
    }

    // Public API - mínima para performance
    return {
        fetch: fetch,
        invalidateTokenCache: invalidateTokenCache,
        getCacheInfo: getCacheInfo,
        
        // Solo para debugging cuando sea necesario
        _internal: {
            getValidToken: getValidToken,
            executeEquifaxRequest: executeEquifaxRequest,
            determineIsSandbox: determineIsSandbox,
            createEquifaxError: createEquifaxError,
            formatDocumento: formatDocumento,
            getCacheInstance: getCacheInstance,
            TIMEOUT_MS: TIMEOUT_MS,
            TOKEN_CACHE_DURATION_SANDBOX: TOKEN_CACHE_DURATION_SANDBOX,
            TOKEN_CACHE_DURATION_PRODUCTION: TOKEN_CACHE_DURATION_PRODUCTION
        }
    };
});