/**
 * @NApiVersion 2.1
 * @description Adaptador Equifax OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/https', 'N/log', 'N/runtime', 'N/encode', '../domain/normalize'], 
function (https, log, runtime, encode, normalize) {
    'use strict';

    const TIMEOUT_MS = 15000; // REDUCIDO: 15s para respuesta rápida
    const TOKEN_CACHE_DURATION = 3300; // 55 minutos
    
    // Cache de tokens por ambiente en memoria (sandbox / production)
    // Estructura: { sandbox: { token, expiry }, production: { token, expiry } }
    let _tokenCache = {};
    
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
     * Por requerimiento, generamos un token fresco en cada llamada al adapter
     * para garantizar uso de credenciales actualizadas en UAT y Producción.
     */
    function fetch(documento, options) {
        options = options || {};
        try {
            // Determinar ambiente (options -> script parameter -> default SANDBOX)
            const isSandbox = determineIsSandbox(options);

            // Obtener configuración para el ambiente especificado y forzar generación de token
            _config = getEquifaxConfig(isSandbox);
            const accessToken = getValidToken(isSandbox, true);
            
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
     * Obtiene o genera un token válido para el ambiente solicitado.
     * forceRefresh=true por defecto en llamadas desde fetch para generar
     * token fresco en cada invocación (requerimiento UAT/PROD).
     * @param {boolean} isSandbox
     * @param {boolean} forceRefresh
     * @returns {string} accessToken
     */
    function getValidToken(isSandbox, forceRefresh) {
        const envKey = isSandbox ? 'sandbox' : 'production';
        _tokenCache[envKey] = _tokenCache[envKey] || { token: null, expiry: 0 };

        const now = Date.now();
        if (!forceRefresh && _tokenCache[envKey].token && now < _tokenCache[envKey].expiry) {
            return _tokenCache[envKey].token;
        }

        // Generar nuevo token
        const cfg = getEquifaxConfig(isSandbox);
        const scope = cfg.tokenScope || cfg.apiUrl.replace(/\/execute$/, '');
        const body = 'grant_type=client_credentials&scope=' + encodeURIComponent(scope);

        const tokenResponse = https.request({
            url: cfg.tokenUrl,
            method: https.Method.POST,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + cfg.basicAuth,
                'User-Agent': 'NetSuite-ELM/1.0'
            },
            body: body,
            timeout: 10000
        });

        if (!tokenResponse || tokenResponse.code !== 200) {
            throw createEquifaxError('TOKEN_ERROR', 'Token request failed: ' + (tokenResponse ? tokenResponse.code : 'NO_RESPONSE'));
        }

        const tokenData = JSON.parse(tokenResponse.body);
        const expiresIn = parseInt(tokenData.expires_in) || 3600;
        const accessToken = tokenData.access_token;

        // Cache en memoria con buffer de seguridad
        _tokenCache[envKey] = {
            token: accessToken,
            expiry: now + ((expiresIn - 300) * 1000) // 5min buffer
        };

        log.audit({ title: 'Equifax Token Generated', details: { env: envKey, expiresIn: expiresIn } });

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
                        tipoDocumento: options.tipoDocumento || 'CI',
                        paisDocumento: options.paisDocumento || 'UY',
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

        const response = https.request({
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
        const sandbox = !!isSandbox;
        const environment = sandbox ? 'SANDBOX' : 'PRODUCTION';

        // Intentar leer credenciales desde Script Parameters (preferido)
        let clientId, clientSecret;
        let configuration = 'Config';
        let billTo = 'UY004277B001';
        let shipTo = 'UY004277B001S3642';
        let productName = 'UYICBOX';
        let productOrch = 'boxFase0Per';
        let customer = 'UYICMANDAZY';
        let model = 'boxFase0PerMandazy';


        if (sandbox) {
            clientId = 'KAIXWP3JO4y1lv4pJLoRE2XaD7S3R8bh';
            clientSecret = 'owBkHrSBNJn4jmtm';
        } else {
            clientId = '<CLIENT_ID>';
            clientSecret = '<CLIENT_SECRET>';
        }


        // URLs según ambiente
        const baseUrls = sandbox ? {
            tokenUrl: 'https://api.sandbox.equifax.com/v2/oauth/token',
            apiUrl: 'https://api.sandbox.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        } : {
            tokenUrl: 'https://api.latam.equifax.com/v2/oauth/token',
            apiUrl: 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        };

        // tokenScope (scope requerido para grant_type)
        const tokenScope = sandbox
            ? 'https://api.sandbox.equifax.com/business/interconnect/v1/decision-orchestrations'
            : 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations';

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

        // Pre-compilar headers function para evitar object creation repetido
        const requestHeadersTemplate = {
            'Content-Type': 'application/vnd.com.equifax.clientconfig.v1+json',
            'Accept': 'application/json',
            'User-Agent': 'NetSuite-ELM/1.0'
        };

        log.audit({ title: 'Equifax Config Initialized', details: 'Environment: ' + environment });

        return {
            environment: environment,
            isSandbox: sandbox,
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
            configuration: configuration,
            requestHeaders: function(token) {
                let headers = Object.assign({}, requestHeadersTemplate);
                headers['Authorization'] = 'Bearer ' + token;
                return headers;
            }
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
     * Invalidar caché de token (para troubleshooting)
     */
    function invalidateTokenCache(isSandbox) {
        if (typeof isSandbox === 'boolean') {
            var key = isSandbox ? 'sandbox' : 'production';
            if (_tokenCache[key]) delete _tokenCache[key];
        } else {
            _tokenCache = {};
        }
        log.audit({ title: 'Equifax Token Cache Invalidated', details: { env: typeof isSandbox === 'boolean' ? (isSandbox ? 'sandbox' : 'production') : 'all' } });
    }

    // Public API - mínima para performance
    return {
        fetch: fetch,
        invalidateTokenCache: invalidateTokenCache,
        
        // Solo para debugging cuando sea necesario
        _internal: {
            getValidToken: getValidToken,
            executeEquifaxRequest: executeEquifaxRequest,
            determineIsSandbox: determineIsSandbox,
            createEquifaxError: createEquifaxError,
            formatDocumento: formatDocumento,
            TIMEOUT_MS: TIMEOUT_MS
        }
    };
});