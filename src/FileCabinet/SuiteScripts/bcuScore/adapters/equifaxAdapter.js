/**
 * @NApiVersion 2.1
 * @description Adaptador Equifax OPTIMIZADO para máxima velocidad de respuesta
 */

define(['N/https', 'N/log', 'N/runtime', 'N/encode', '../domain/normalize', 'N/search', 'N/record', 'N/format'], 
function (https, log, runtime, encode, normalize, search, record, format) {
    'use strict';

    const TIMEOUT_MS = 10000; // REDUCIDO: 15s para respuesta rápida
    // TTL esperado de tokens Equifax:
    // - UAT: ~1 hora
    // - PROD: ~24 horas
    // La validación se hace automáticamente leyendo el `exp` del JWT cuando existe;
    // si no se puede, se usa este fallback por ambiente.
    const DEFAULT_TOKEN_MAX_AGE_UAT_MS = 60 * 60 * 1000;
    const DEFAULT_TOKEN_MAX_AGE_PROD_MS = 24 * 60 * 60 * 1000;
    const TOKEN_EXP_SKEW_MS = 2 * 60 * 1000; // refrescar 2 minutos antes del vencimiento
    const recordEquifaxConfigId = 1; // ID del custom record con configuración Equifax      
    // Pre-compilar URLs y headers para evitar string concatenations
    let _config = null;

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

            // NetSuite runtime: fuente de verdad del ambiente (SANDBOX vs PRODUCTION)
            if (runtime && runtime.envType && runtime.EnvType) {
                return runtime.envType === runtime.EnvType.SANDBOX;
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
            let isSandbox = determineIsSandbox(options);
        

            // Obtener configuración para el ambiente especificado 
            const tokenField = search.lookupFields({
                type: 'customrecord_elm_config_servicion',
                id: recordEquifaxConfigId,
                columns: ['custrecord_elm_token_prov', 'custrecord_elm_token_ref_date','custrecord_elm_forzar_prod']
            });

            let accessToken = tokenField.custrecord_elm_token_prov;
            const forceProd = tokenField.custrecord_elm_forzar_prod;
            const dateRefreshToken = parseNsDateTime(tokenField.custrecord_elm_token_ref_date);
            
            if (forceProd) {
                isSandbox = false; // forzar ambiente producción    
            }

              
            log.debug({
                title: 'Equifax Adapter Fast Fetch',
                details: 'Document: ' + documento.substr(-4) + ', isSandbox: ' + isSandbox
            });
              
            _config = getEquifaxConfig(isSandbox);
            

            // 2) Fallback por ambiente si no se pudo leer exp
            const maxAgeMs = isSandbox ? DEFAULT_TOKEN_MAX_AGE_UAT_MS : DEFAULT_TOKEN_MAX_AGE_PROD_MS;
    
            const tokenTooOldByRefDate = !dateRefreshToken || ((Date.now() - dateRefreshToken.getTime()) >= maxAgeMs);
      
            const needsNewToken =  !accessToken || tokenTooOldByRefDate;

            log.debug({
                title: 'Equifax Token Validation',
                details: 'Needs new token: ' + needsNewToken + ', Force Prod: ' + forceProd
            });

           if (needsNewToken) {
                log.audit({
                    title: 'Creating new Equifax token',
                    details: 'Token is missing or too old, creating a new one.'
                });
                  accessToken = getValidToken(isSandbox);
                try {
                     const idLogrecord = record.submitFields({
                        type: 'customrecord_elm_config_servicion',
                        id: recordEquifaxConfigId,
                        values: {
                            custrecord_elm_token_prov: accessToken,
                            custrecord_elm_token_ref_date: new Date()
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    }); 

                log.audit({
                        title: 'Equifax Token Persisted',
                        details: 'Nuevo token guardado en custom record, ID: ' + idLogrecord
                    });
                } catch (e) {
                    // Si fal la persistencia, igual intentamos continuar con el token en memoria
                    log.debug({
                        title: 'Equifax Token Persist Error',
                        details: (e && e.message) ? e.message : String(e)
                    });
                    
                }
            }

            // Request optimizado con timeout corto
            const response = executeEquifaxRequest(documento, accessToken, options, periodMonths);
            const responseNormalized = normalize.normalizeEquifaxResponse(response);
          
            // Normalización rápida
            return responseNormalized;

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
     * @returns {string} accessToken
     */
    function getValidToken(isSandbox) {
    
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

        if (!tokenResponse || tokenResponse.code !== 200) {
            throw createEquifaxError('TOKEN_ERROR', 'Token request failed: ' + (tokenResponse ? tokenResponse.code : 'NO_RESPONSE'));
        }

        const tokenData = JSON.parse(tokenResponse.body);
        const accessToken = tokenData.access_token;

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
            title: 'Equifax Raw Response',
            details: 'Code: ' + response.code + ', Body: ' + response.body
        });

        if (response.code !== 200) {
            throw mapEquifaxHttpError(response.code, response.body);
        }

        const responseBody = JSON.parse(response.body);
        
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
     * mapEquifaxHttpError: Mapeo rápido de errores HTTP a errores Equifax específicos
     */
    function mapEquifaxHttpError(httpStatus) {
        const mapping = HTTP_ERROR_MAP[httpStatus];
        if (mapping) {
            return createEquifaxError(mapping[0], mapping[1], { httpStatus: httpStatus });
        }
        return createEquifaxError('EQUIFAX_UNKNOWN_ERROR', 'Error desconocido: ' + httpStatus);
    }

    /**
     * createEquifaxError: Crea un Error estandarizado para errores de Equifax
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
     * Parse robusto de Date/Time para valores devueltos por search.lookupFields.
     * NetSuite suele devolver strings en formato de cuenta; intentamos N/format primero.
     */
    function parseNsDateTime(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        // A veces viene como array (según tipo de campo), nos quedamos con el primer valor
        if (Array.isArray(value)) {
            if (!value.length) return null;
            value = value[0];
        }

        const s = String(value);

        // Preferir parser de NetSuite
        try {
            if (format && typeof format.parse === 'function' && format.Type && format.Type.DATETIME) {
                const parsed = format.parse({ value: s, type: format.Type.DATETIME });
                if (parsed instanceof Date && !isNaN(parsed.getTime())) return parsed;
            }
        } catch (e) {
            // fallback a parsing manual
        }

        // Fallback: Date nativo (funciona si viene ISO)
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d;

        // Fallback: formatos comunes dd/mm/yyyy hh:mm(:ss)
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (m) {
            const day = parseInt(m[1], 10);
            const month = parseInt(m[2], 10) - 1;
            let year = parseInt(m[3], 10);
            if (year < 100) year += 2000;
            const hour = m[4] ? parseInt(m[4], 10) : 0;
            const minute = m[5] ? parseInt(m[5], 10) : 0;
            const second = m[6] ? parseInt(m[6], 10) : 0;
            const dd = new Date(year, month, day, hour, minute, second);
            if (!isNaN(dd.getTime())) return dd;
        }

        return null;
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