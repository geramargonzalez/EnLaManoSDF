/**
 * @NApiVersion 2.1
 * @description Adaptador Equifax OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/https', 'N/log', 'N/runtime', 'N/encode', '../domain/normalize', 'N/search'], 
function (https, log, runtime, encode, normalize, search) {
    'use strict';

    const TIMEOUT_MS = 10000; // REDUCIDO: 15s para respuesta rápida
    
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
                const script = runtime.getCurrentScript();
                const envParam = script.getParameter({ name: 'custscript_equifax_environment' }) ||
                               script.getParameter({ name: 'custscript_equifax_env' }) ||
                               script.getParameter({ name: 'custscript_equifax_is_sandbox' });
                if (envParam !== null && envParam !== undefined) {
                    const s = String(envParam).toLowerCase();
                    if (s === 'production' || s === 'prod' || s === 'p' || s === '0' || s === 'false') return false;
                    if (s === 'sandbox' || s === 'uat' || s === 'test' || s === '1' || s === 'true') return true;
                }
            }
        } catch (e) {
            // ignore and fallback to env vars
        }

        if (typeof process !== 'undefined' && process.env) {
            const env = process.env.EQUIFAX_ENV || process.env.EQUIFAX_ENVIRONMENT || process.env.EQUIFAX_IS_SANDBOX;
            if (env) {
                const s2 = String(env).toLowerCase();
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
     * @param {number} periodMonths - Periodo en meses (no usado en Equifax)
     */
    function fetch(documento, options, periodMonths) {
        options = options || {};
        try {
            // Determinar ambiente (options -> script parameter -> default SANDBOX)
            // const isSandbox = determineIsSandbox(options);
            const isSandbox = false; // FORZADO A PRODUCCION PARA TESTING

            // Obtener configuración para el ambiente especificado
            _config = getEquifaxConfig(isSandbox);
            
            // Verificar si se debe forzar generación de nuevo token
            const forceRefresh = options.forceNewToken === false;
            
            if (forceRefresh) {
                log.audit({
                    title: 'Equifax Token Force Refresh',
                    details: 'Generando nuevo token por solicitud explícita (forceNewToken=false)'
                });
            }
            
            // const accessToken = getValidToken(isSandbox, forceRefresh);

            const tokenField = search.lookupFields({
                type: 'customrecord_elm_config_servicion',
                id: 1,
                columns: ['custrecord_elm_token_prov']
            });
            const accessToken = tokenField.custrecord_elm_token_prov;
            
            // Request optimizado con timeout corto
            const response = executeEquifaxRequest(documento, accessToken, options, periodMonths);
 
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
     * Genera un nuevo token de Equifax mediante OAuth2.
     * NOTA: Esta función genera un nuevo token en cada llamada.
     * Para mejor performance, usar lookupFields del custom record donde se almacena el token.
     * @param {boolean} isSandbox - true para UAT, false para Production
     * @param {boolean} forceRefresh - Parámetro legacy, ignorado (siempre genera nuevo token)
     * @returns {string} accessToken
     */
    function getValidToken(isSandbox, forceRefresh) {
        const envKey = isSandbox ? 'sandbox' : 'production';
    
        // Generar nuevo token
        const cfg = getEquifaxConfig(isSandbox);
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

      /*   log.debug({
            title: 'Equifax Token Response',
            details: 'Response Code: ' + tokenResponse.code
        }); */

        if (!tokenResponse || tokenResponse.code !== 200) {
            throw createEquifaxError('TOKEN_ERROR', 'Token request failed: ' + (tokenResponse ? tokenResponse.code : 'NO_RESPONSE'));
        }

        const tokenData = JSON.parse(tokenResponse.body);
        const accessToken = tokenData.access_token;

      /*   log.audit({
            title: 'Equifax Token Generated',
            details: 'New token generated for ' + envKey + ' (preview: ' + accessToken.substring(0, 20) + '...)'
        }); */

        return accessToken;
    }

    /**
     * OPTIMIZADO: Request Equifax con headers pre-compilados
     * Usa nueva API BOX_FASE0_PER de MANDAZY
     */
    function executeEquifaxRequest(documento, accessToken, options, periodMonths) {
        // Calcular período restando meses correctamente (considerando cambio de año)
        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth() - (periodMonths || 0), 1);
        const anio = String(targetDate.getFullYear());
        const mes = String(targetDate.getMonth() + 1).padStart(2, '0');
        
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

       /*  log.debug({
            title: 'Equifax Request Payload',
            details: JSON.stringify(payload)
        });
 */
        // Log completo del request para enviar a técnicos
        // const requestHeaders = _config.requestHeaders(accessToken);
        
        // Crear representación explícita con comillas para debugging

        const requestOptions = {
            url: _config.apiUrl,
            method: https.Method.POST,
            headers: {
                'Content-Type': 'application/vnd.com.equifax.clientconfig.v1+json',
                'Authorization': 'Bearer ' + accessToken,
                'Accept': '*/*'
            },
            body: JSON.stringify(payload),
            timeout: TIMEOUT_MS
        };



        const response = https.request(requestOptions);
        
        log.debug({
            title: 'Equifax Response',
            details: 'Code: ' + response.code + ', Body: ' + response.body
        });

        if (response.code !== 200) {
            throw mapEquifaxHttpError(response.code, response.body);
        }

        const responseBody = JSON.parse(response.body);
        
        // Agregar correlationId al objeto de respuesta para que esté disponible en normalize
      /*   if (correlationId) {
            responseBody._equifaxCorrelationId = correlationId;
        }
 */
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
        let billTo =  isSandbox ? '011314B001' : 'UY004277B001';
        let shipTo = isSandbox ? '011314B001S0001' : 'UY004277B001S3642';
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
            clientId = 'klUWtB5KbtpYPGTMnAGUmXTpF1UAvvsn';
            clientSecret = 'sas5AsZV4AjvFlNk';
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

        // log.audit({ title: 'Equifax Config Initialized', details: 'Environment: ' + environment });

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



    // Public API - mínima para performance
    return {
        fetch: fetch,
        getValidToken: getValidToken,
        // Solo para debugging cuando sea necesario
        _internal: {
            executeEquifaxRequest: executeEquifaxRequest,
            determineIsSandbox: determineIsSandbox,
            createEquifaxError: createEquifaxError,
            formatDocumento: formatDocumento,
            TIMEOUT_MS: TIMEOUT_MS
        }
    };
});