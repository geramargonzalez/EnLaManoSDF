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

define(['N/search', 'N/error', 'N/https', 'N/record'], 
    function (search, error, https, record) {

    // ============================================
    // CONFIGURACIÓN
    // ============================================
    
    const CONFIG = {
        // Cambiar según ambiente
        IS_PRODUCTION: true, // true para producción
        
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
            // const scriptObj = runtime.getCurrentScript();
            const leadSearchObj = search.create({
                type: search.Type.CUSTOMER,
                filters:
                    [
                        [CONFIG.FIELDS.TRACKING_ID,"isnotempty",""], 
                        "AND", 
                        ["custentity_elm_lead_repetido_original","anyof","@NONE@"] , 
                        "AND", 
                        ["datecreated","notbefore","monthsago1"], 
                        "AND", 
                        ["custentity_elm_aprobado","noneof","1","4","27","26","3","16","15","23","25"]
                    ],
                columns: [
                    search.createColumn({ name: 'internalid', label: 'ID' }),
                    search.createColumn({ name: CONFIG.FIELDS.TRACKING_ID, label: 'Tracking ID' }),
                    search.createColumn({ name: CONFIG.FIELDS.ESTADO_GESTION, label: "Estado de Gestión" }),
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
            
            // Extraer valores del search result - Solo los obligatorios
            trackingId = leadData.values[CONFIG.FIELDS.TRACKING_ID];
            log.debug(logTitle, `TRACKING_ID: ${trackingId}`);
            const estadoGestion = leadData.values[CONFIG.FIELDS.ESTADO_GESTION].value;
            log.debug(logTitle, `ESTADO_GESTION: ${JSON.stringify(estadoGestion)}`);
            const postbackStatus =  statusNormalize(estadoGestion);
             log.debug(logTitle, `postbackStatus ID: ${postbackStatus}`);
       
            
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
                status: postbackStatus  // Ya viene normalizado por statusNormalize()
                
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
            const idUpdated = record.submitFields({
                type: record.Type.CUSTOMER,
                id: leadId,
                values: {
                    custentity_elm_estado_alprestamo: postbackStatus
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields : true
                }
            });
            log.debug(logTitle, `Lead actualizado con postback enviado: ${idUpdated}`);
            
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
     * @desc Normaliza el estado de NetSuite al formato esperado por Alprestamo
     * 
     * Mapeo de Estados según tabla de Alprestamo:
     * 
     * DENIED (denied):
     * - Rechazado
     * - No cumple Requisitos (ID: 21)
     * - Rechazado por Asesor (ID: 24)
     * 
     * GRANTED (granted):
     * - Gestionado (ID: 5)
     * 
     * OFFERED (validated):
     * - En validación (ID: 7)
     * - Sin Respuesta (ID: 8)
     * - Revisión (ID: 10)
     * - Desiste (ID: 9)
     * 
     * OFFERED (offered):
     * - Convertido (ID: 11)
     * 
     * @param {string|number} value - Valor del campo estado en NetSuite (puede ser ID o texto)
     * @returns {string} Estado en formato Alprestamo (denied, validated, offered, granted)
     */
    function statusNormalize(value) {
        try {
            // Si viene como objeto con [0].value (search result format)
        if (value && typeof value === 'object' && value[0] && value[0].value) {
            value = value[0].value;
        }
        
        // Convertir a string para comparación
        const valueStr = String(value);
        
        // Mapeo: Internal ID de Estados -> Status Alprestamo
        const estadoMap = {
            // DENIED - Rechazados
            '21': CONFIG.STATUS.DENIED,       // No cumple Requisitos
            '24': CONFIG.STATUS.DENIED,       // Rechazado por Asesor
            '9': CONFIG.STATUS.DENIED,     // Desiste
            '8': CONFIG.STATUS.DENIED,     // Sin Respuesta      
           
            // VALIDATED GRANTED - Aprobados
            '5': CONFIG.STATUS.VALIDATED,       // Gestionado
            '10': CONFIG.STATUS.VALIDATED,    // Revisión
            
            // OFFERED - En proceso de validación
            '2': CONFIG.STATUS.OFFERED,     // Aprobado
            '7': CONFIG.STATUS.OFFERED,     // En validación
            '6': CONFIG.STATUS.OFFERED,     // Pendiente de Documentacion
           

            // GRANTED - Oferta presentada
            '11': CONFIG.STATUS.GRANTED       // Convertido
        };
        
        // Buscar por ID
        if (estadoMap[valueStr]) {
            log.debug('statusNormalize', `Estado mapeado por ID: ${valueStr} -> ${estadoMap[valueStr]}`);
            return estadoMap[valueStr];
        }
        
        // Buscar por nombre del estado (case insensitive) - Fallback
        const valueUpper = valueStr.toUpperCase();
        
        // DENIED
        if (valueUpper.includes('RECHAZADO') || 
            valueUpper.includes('NO CUMPLE') ||
            valueUpper.includes('REQUISITOS')) {
            return CONFIG.STATUS.DENIED;
        }
        
        // GRANTED
        if (valueUpper.includes('GESTIONADO')) {
            return CONFIG.STATUS.GRANTED;
        }
        
        // VALIDATED
        if (valueUpper.includes('VALIDACION') || 
            valueUpper.includes('VALIDACIÓN') ||
            valueUpper.includes('SIN RESPUESTA') ||
            valueUpper.includes('REVISION') ||
            valueUpper.includes('REVISIÓN') ||
            valueUpper.includes('DESISTE')) {
            return CONFIG.STATUS.VALIDATED;
        }
        
        // OFFERED
        if (valueUpper.includes('CONVERTIDO')) {
            return CONFIG.STATUS.OFFERED;
        }
        
        // Por defecto, si no se encuentra, retornar denied
        log.debug('statusNormalize', `Estado no reconocido: ${value}, usando default: denied`);
        return CONFIG.STATUS.DENIED;
        } catch (error) {
            log.error('statusNormalize', `Error normalizando estado: ${error}`);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };

});
