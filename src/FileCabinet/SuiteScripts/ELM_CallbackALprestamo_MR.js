/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

/**
 * Alprestamo Postback Integration - Map/Reduce Script
 * 
 * Este script procesa leads de Alprestamo y envía postbacks según el estado del funnel.
 * 
 * Estados soportados:
 * - denied: Lead denegado por algún motivo
 * - validated: Usuario validado
 * - offered: Se mostró la oferta
 * - granted: Se otorgó el producto
 * 
 * Endpoints:
 * - Testing: https://sandbox.api.uy.alprestamo.io/bid/postback/only-by-url
 * - Producción: https://api.uy.alprestamo.io/bid/postback/only-by-url
 * 
 */

define(['N/search', 'N/error', 'N/https', 'N/runtime'], 
    function (search, error, https, runtime) {

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    
    const CONFIG = {
        // Cambiar según ambiente
        IS_PRODUCTION: false, // true para producción
        
        ENDPOINTS: {
            TESTING: 'https://sandbox.api.uy.alprestamo.io/bid/postback/only-by-url',
            PRODUCTION: 'https://api.uy.alprestamo.io/bid/postback/only-by-url'
        },
        
        // Estados válidos de postback
        STATUS: {
            DENIED: 'denied',
            VALIDATED: 'validated',
            OFFERED: 'offered',
            GRANTED: 'granted'
        },
        
        // IDs de campos custom - AJUSTAR SEGÚN TU NETSUITE
        FIELDS: {
            TRACKING_ID: 'custentity_track_id_al_prestamo',
            SOURCE: 'custentity_elm_canal',
            ESTADO_GESTION: 'custentity_elm_aprobado',
            
            // Campos opcionales - Comentados por ahora, no se enviarán en el postback
            // AMOUNT: 'custentity_elm_monto_oferta_final',
            // INSTALLMENTS: 'custentity_elm_plazo_oferta_final',
            // PRODUCT: 'custentity_elm_producto',
            // EMAIL: 'email',
            // PHONE: 'phone',
            // VALIDATED_TIMESTAMP: 'custentity_elm_validated_timestamp',
            // OFFERED_TIMESTAMP: 'custentity_elm_offered_timestamp',
            // GRANTED_TIMESTAMP: 'custentity_elm_granted_timestamp'
        }
    };

    /**
     * @author  Gerardo Gonzalez
     * @desc getInputData - This function is used to process each key/value pair in the input data.
     */
    function getInputData() {
        const logTitle = 'getInputData';
        
        try {
            log.debug(logTitle, '========== INICIO POSTBACK ALPRESTAMO ==========');
            
            // Script parameters para configuración dinámica
            const scriptObj = runtime.getCurrentScript();
            const daysToProcess = scriptObj.getParameter({ name: 'custscript_elm_postback_days' }) || 7;
            
            log.debug(logTitle, `Procesando leads de los últimos ${daysToProcess} días`);

            const leadSearchObj = search.create({
                type: search.Type.CUSTOMER,
                filters:
                    [
                        [CONFIG.FIELDS.TRACKING_ID,"isnotempty",""], 
                        "AND", 
                        ["custentity_elm_lead_repetido_original","anyof","@NONE@"], 
                        "AND", 
                        ["datecreated","within","today"]
                    ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'ID' }),
                    search.createColumn({ name: CONFIG.FIELDS.TRACKING_ID, label: 'Tracking ID' }),
                    search.createColumn({ name: CONFIG.FIELDS.ESTADO_GESTION, label: "Estado de Gestión" }),

                    // Columnas opcionales - Comentadas por ahora
                    // search.createColumn({ name: CONFIG.FIELDS.AMOUNT, label: 'Amount' }),
                    // search.createColumn({ name: CONFIG.FIELDS.INSTALLMENTS, label: 'Installments' }),
                    // search.createColumn({ name: CONFIG.FIELDS.PRODUCT, label: 'Product' }),
                    // search.createColumn({ name: CONFIG.FIELDS.EMAIL, label: 'Email' }),
                    // search.createColumn({ name: CONFIG.FIELDS.PHONE, label: 'Phone' }),
                    // search.createColumn({ name: CONFIG.FIELDS.VALIDATED_TIMESTAMP, label: 'Validated TS' }),
                    // search.createColumn({ name: CONFIG.FIELDS.OFFERED_TIMESTAMP, label: 'Offered TS' }),
                    // search.createColumn({ name: CONFIG.FIELDS.GRANTED_TIMESTAMP, label: 'Granted TS' })
                ]
            });

            const searchResultCount = leadSearchObj.runPaged().count;
            log.audit(logTitle, `Leads encontrados para postback: ${searchResultCount}`);

            return leadSearchObj;
            
        } catch (e) {
            log.error(logTitle, `Error en getInputData: ${e.message}`);
            throw error.create({
                name: 'ELM_ALPRESTAMO_POSTBACK_GET_INPUT_ERROR',
                message: `Error al obtener leads para postback: ${e.message}`,
                notifyOff: false
            });
        }
    }

    /**
     * @author  Gerardo Gonzalez
     * @desc  map - Procesa cada lead y envía el postback a Alprestamo
     * @param {object} context
     * @param {string} context.key - Internal ID del lead
     * @param {string} context.value - Datos del lead en JSON
     */
    function map(context) {
        const logTitle = 'map';
        let leadId, trackingId;
        
        try {
            const leadData = JSON.parse(context.value);
            leadId = leadData.id;
            
            log.debug(logTitle, `Procesando Lead ID: ${leadId}`);
            
            // Extraer valores del search result - Solo los obligatorios
            trackingId = leadData.values[CONFIG.FIELDS.TRACKING_ID];
            const postbackStatus =  statusNormalize(leadData.values[CONFIG.FIELDS.ESTADO_GESTION]);
            
            // Valores opcionales - Comentados por ahora, no se enviarán
            // const amount = leadData.values[CONFIG.FIELDS.AMOUNT];
            // const installments = leadData.values[CONFIG.FIELDS.INSTALLMENTS];
            // const product = leadData.values[CONFIG.FIELDS.PRODUCT];
            // const email = leadData.values[CONFIG.FIELDS.EMAIL];
            // const phone = leadData.values[CONFIG.FIELDS.PHONE];
            // const validatedTs = leadData.values[CONFIG.FIELDS.VALIDATED_TIMESTAMP];
            // const offeredTs = leadData.values[CONFIG.FIELDS.OFFERED_TIMESTAMP];
            // const grantedTs = leadData.values[CONFIG.FIELDS.GRANTED_TIMESTAMP];
            
            // Validar estado obligatorio
            if (!postbackStatus) {
                throw error.create({
                    name: 'MISSING_STATUS',
                    message: 'Lead no tiene estado de postback definido'
                });
            }
            
            // Construir URL del postback - Solo con parámetros obligatorios
            const endpoint = CONFIG.IS_PRODUCTION ? 
                CONFIG.ENDPOINTS.PRODUCTION : 
                CONFIG.ENDPOINTS.TESTING;
            
            const postbackUrl = buildPostbackUrl({
                endpoint: endpoint,
                trackingId: trackingId,
                status: getStatusText(postbackStatus)
                
            });
            
            log.debug(logTitle, `URL Postback: ${postbackUrl}`);
            
            // Enviar postback HTTP GET
            const response = https.get({
                url: postbackUrl
            });
            
            log.debug(logTitle, `Response Code: ${response.code}`);
            log.debug(logTitle, `Response Body: ${response.body}`);
            
            // Procesar respuesta
            if (response.code === 200) {
                
                const responseBody = JSON.parse(response.body);
                
                if (responseBody.status === 'success') {

                    log.audit(logTitle, `✓ Postback enviado exitosamente - Lead: ${leadId}, Tracking: ${trackingId}`);
                    
                } else {
                    throw error.create({
                        name: 'POSTBACK_FAILED',
                        message: `Alprestamo retornó error: ${responseBody.error_message || 'Unknown error'}`
                    });
                }
                
            } else {
                throw error.create({
                    name: 'HTTP_ERROR',
                    message: `HTTP ${response.code}: ${response.body}`
                });
            }
            
        } catch (e) {
            log.error(logTitle, `✗ Error procesando Lead ${leadId}: ${e.message}`);
        }
    }
    /**
     * @author  Gerardo Gonzalez
     * @desc summarize - This function logs the summary of the Map/Reduce execution.
     * @param {object} summary
     */
    function summarize(summary) {
        const logTitle = 'summarize';
        try {
            log.audit(logTitle, '========== RESUMEN EJECUCIÓN ==========');
            log.audit(logTitle, `Uso: ${summary.usage} unidades`);
            log.audit(logTitle, `Concurrencia: ${summary.concurrency}`);
            log.audit(logTitle, `Yields: ${summary.yields}`);
            
            // Contar éxitos
            let successCount = 0;
            summary.mapSummary.keys.iterator().each(function (key) {
                successCount++;
                return true;
            });
            
            log.audit(logTitle, `✓ Postbacks exitosos: ${successCount}`);
            
            // Contar errores
            let errorCount = 0;
            summary.mapSummary.errors.iterator().each(function (key, error) {
                errorCount++;
                log.error(logTitle, `Error en Lead ${key}: ${error}`);
                return true;
            });
            
            if (errorCount > 0) {
                log.audit(logTitle, `✗ Postbacks con error: ${errorCount}`);
            }
            
            log.audit(logTitle, '========== FIN POSTBACK ALPRESTAMO ==========');
            
        } catch (e) {
            log.error(logTitle, `Error en summarize: ${e.message}`);
        }
    }

    // ============================================
    // FUNCIONES AUXILIARES
    // ============================================

    /**
     * @author Gerardo Gonzalez
     * @desc Construye la URL del postback con todos los parámetros
     * @param {object} params
     */
    function buildPostbackUrl(params) {
        let url = `${params.endpoint}?tracking_id=${encodeURIComponent(params.trackingId)}`;
        
        // Parámetro obligatorio: status
        url += `&status=${encodeURIComponent(params.status)}`;
        
        // Parámetros opcionales - Comentados por ahora, no se enviarán
        /*
        if (params.amount) {
            url += `&amount=${encodeURIComponent(params.amount)}`;
        }
        
        if (params.installments) {
            url += `&installments=${encodeURIComponent(params.installments)}`;
        }
        
        if (params.product) {
            url += `&product=${encodeURIComponent(params.product)}`;
        }
        
        if (params.email) {
            url += `&validated_email=${encodeURIComponent(params.email)}`;
        }
        
        if (params.phone) {
            url += `&validated_phone=${encodeURIComponent(params.phone)}`;
        }
        
        if (params.validatedTimestamp) {
            url += `&validated_timestamp=${encodeURIComponent(params.validatedTimestamp)}`;
        }
        
        if (params.offeredTimestamp) {
            url += `&offered_timestamp=${encodeURIComponent(params.offeredTimestamp)}`;
        }
        
        if (params.grantedTimestamp) {
            url += `&granted_timestamp=${encodeURIComponent(params.grantedTimestamp)}`;
        }
        */
        
        return url;
    }

    /**
     * @author  Gerardo Gonzalez
     * @desc Convierte el valor del campo status a texto esperado por Alprestamo
     * @param {string} statusValue - Valor del campo en NetSuite
     * @returns {string} Estado en formato Alprestamo
     */
    function getStatusText(statusValue) {
        // Si el valor ya viene como texto, retornarlo
        if (typeof statusValue === 'string' && 
            Object.values(CONFIG.STATUS).includes(statusValue.toLowerCase())) {
            return statusValue.toLowerCase();
        }
        
        // Si viene como ID de lista, mapear según tu configuración
        // Ajustar según tus IDs de custom list
        const statusMap = {
            '1': CONFIG.STATUS.DENIED,
            '2': CONFIG.STATUS.VALIDATED,
            '3': CONFIG.STATUS.OFFERED,
            '4': CONFIG.STATUS.GRANTED
        };
        
        return statusMap[statusValue] || CONFIG.STATUS.DENIED;
    }

     /**
     * @author  Gerardo Gonzalez
     * @desc Convierte el valor del campo status a texto esperado por Alprestamo
     * @param {string} statusValue - Valor del campo en NetSuite
     * @returns {string} Estado en formato Alprestamo
     */
    function statusNormalize(value) {
        if (value === true || value === 'T' || value === 'true') {
            return CONFIG.STATUS.GRANTED;
        } else {
            return CONFIG.STATUS.DENIED;
        }   
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };

});
