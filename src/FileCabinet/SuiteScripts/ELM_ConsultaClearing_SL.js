/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 * @description Suitelet que maneja la lógica de conexión con Equifax IC GCP - Mandazy FlexBP
 *              Servicio REST para consulta de antecedentes crediticios
 */

define(['N/record', 'N/https', 'N/log', 'N/runtime', 'N/error', 'N/cache', 'N/search'], 
    function(record, https, log, runtime, error, cache, search) {

    // ============ CONSTANTES ============
    
    // URLs del servicio Equifax
    const EQUIFAX_URLS = {
        // UAT: {
        //     token: 'https://api.uat.latam.equifax.com/v2/oauth/token',
        //     api: 'https://api.uat.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        // },
        PROD: {
            token: 'https://api.latam.equifax.com/v2/oauth/token',
            api: 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
        }
    };


    // Configuración productData (ajustar según ambiente)
    const PRODUCT_DATA = {
        configuration: 'Config',
        customer: 'UYICMANDAZY',
        model: 'mandazyFlexBP',
        billTo: 'UY004277B001',
        shipTo: 'UY004277B001S3642'
    };

    // Campos del registro Clearing Historico (customrecord_clearing_historico)
    const CLEARING_HISTORICO_FIELDS = {
        lead: 'custrecord_elm_clearing_lead',
        nombre: 'custrecord_elm_clearing_nombre',
        apellido: 'custrecord_elm_clearing_apellido',
        sexo: 'custrecord_elm_clearing_sexo',
        estadoCivil: 'custrecord_elm_clearing_estado_civil',
        direccion: 'custrecord_elm_clearing_direccion',
        departamento: 'custrecord_elm_clearing_departamento',
        telefono: 'custrecord_elm_clearing_telefono',
        ocupacion: 'custrecord_elm_clearing_ocupacion',
        fechaExtravioCi: 'custrecord_elm_clearing_fecha_extra_ci',
        cantConsultasU1m: 'custrecord_elm_clearing_cant_const_u1',
        cantIncuFnb: 'custrecord_elm_clearing_cant_incu_fnb',
        fechaUltIncuFnb: 'custrecord_elm_clearing_fecha_ult_incufa',
        saldoUltIncuFnb: 'custrecord_elm_clearing_saldo_ult_fnb',
        cantIncuResto: 'custrecord_elm_clearing_cant_incu_resto',
        fechaIncuResto: 'custrecord_elm_clearing_fecha_incu_resto',
        saldoUltIncuResto: 'custrecord_elm_clearing_saldo_ult_incu_r',
        cancU3mFnb: 'custrecord_elm_clearing_can_u3m_fnb_ban_',
        fechaCancMerFa: 'custrecord_elm_clearing_fech_canc_mer_fa',
        saldoCancMerF: 'custrecord_elm_clearing_saldo_canc_mer_f',
        scoreRiesgo: 'custrecord_elm_clearing_score_riesgo',
        scoreIf: 'custrecord_elm_clearing_score_if',
        peorCalifBpU1m: 'custrecord_elm_clearing_peor_calif_bp_u1m',
        peorCalifBpU3m: 'custrecord_elm_clearing_peor_calif_bp_u3m',
        peorCalifBpU12m: 'custrecord_elm_clearing_peor_calif_bp_u1',
        tcPeorCalifU1m: 'custrecord_elm_clearing_tc_peor_calif_u1',
        tcPeorCalifU3m: 'custrecord_elm_clearing_tc_peor_calif_u3',
        tcPeorCalifU12m: 'custrecord_elm_clearing_tc_peorcalifu12m',
        sePeorCalifU1m: 'custrecord_elm_clearing_se_peorcalifu1m',
        sePeorCalifU3m: 'custrecord_elm_clearing_se_peorcalifu3m',
        sePeorCalifU12m: 'custrecord_elm_clearing_se_peorcalifu12m',
        prPeorCalifU1m: 'custrecord_elm_clearing_pr_peorcalifu1m',
        prPeorCalifU3m: 'custrecord_elm_clearing_pr_peorcalifu3m',
        prPeorCalifU12m: 'custrecord_elm_clearing_pr_peorcalifu12m',
        compBpU1m: 'custrecord_elm_clearing_comp_bp_u1m',
        tcCantAbiertas: 'custrecord_elm_clearing_tc_cant_abiertas',
        prCantAbiertas: 'custrecord_elm_clearing_pr_cant_abiertas',
        seCantAbiertas: 'custrecord_elm_clearing_se_cant_abiertas',
        saldoBpU1m: 'custrecord_elm_clearing_saldo_bp_u1m',
        saldoVencidoBp: 'custrecord_elm_clearing_saldo_vencido_bp',
        tcSaldoU1m: 'custrecord_elm_clearing_tc_saldo_u1m',
        tcSaldoVencido: 'custrecord_elm_clearing_tc_saldo_vencido',
        seSaldoU1m: 'custrecord_elm_clearing_se_saldo_u1m',
        seSaldoVencido: 'custrecord_elm_clearing_se_saldo_vencido',
        prSaldoU1m: 'custrecord_elm_clearing_pr_saldo_u1m',
        prSaldoVencido: 'custrecord_elm_clearing_pr_saldo_vencido_u1m',
        bcuPeorCalifU6m: 'custrecord_elm_clearing_bcu_peorcalifu6m'
    };

    // Cache para token (evitar múltiples llamadas)
    const TOKEN_CACHE_NAME = 'MANDAZY_TOKEN_CACHE';
    const TOKEN_CACHE_KEY = 'access_token';
    const TOKEN_TTL = 3500; // Segundos (tokens suelen durar 1 hora, renovar antes)

    /**
     * @author Gerardo Gonzalez
     * @desc onRequest - Punto de entrada del Suitelet
     * @param {Object} context
     */
    function onRequest(context) {
        try {
            if (context.request.method === 'POST') {
                handlePostRequest(context);
            } else {
                handleGetRequest(context);
            }
        } catch (e) {
            log.error('Error en onRequest', e);
            sendErrorResponse(context, e.message, e.name);
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc handleGetRequest - Maneja peticiones GET (información del servicio)
     * @param {Object} context
     */
    function handleGetRequest(context) {
        const response = {
            success: true,
            message: 'Suitelet de Consulta a Equifax IC GCP - Mandazy FlexBP',
            version: '2.0',
            methods: ['POST'],
            requiredFields: ['recordId', 'recordType', 'documento'],
            optionalFields: ['tipoDocumento', 'paisDocumento'],
            documentFormats: {
                CI: 'xxxxxxx-x (cédula uruguaya con dígito verificador)',
                PA: 'Pasaporte',
                OTR: 'Otro documento'
            }
        };
        
        context.response.write(JSON.stringify(response));
    }

    /**
     * @author Gerardo Gonzalez
     * @desc handlePostRequest - Maneja peticiones POST para consultar Mandazy
     * @param {Object} context
     */
    function handlePostRequest(context) {
        let datosConsulta;
        
        try {
            datosConsulta = JSON.parse(context.request.body);
            log.debug('Datos de consulta recibidos', JSON.stringify(datosConsulta));
        } catch (e) {
            log.error('Error parseando request body', e);
            sendErrorResponse(context, 'Error en formato de datos: ' + e.message, 'PARSE_ERROR');
            return;
        }

        // Validar datos requeridos
        if (!datosConsulta.recordId || !datosConsulta.recordType || !datosConsulta.documento) {
            sendErrorResponse(context, 'Faltan datos requeridos: recordId, recordType o documento', 'VALIDATION_ERROR');
            return;
        }

        // Formatear documento (agregar guión si no lo tiene)
        const documentoFormateado = formatDocumento(datosConsulta.documento);
        
        log.audit('Iniciando consulta Mandazy', {
            recordId: datosConsulta.recordId,
            documento: documentoFormateado
        });

        try {
            // Obtener configuración
            const config = getScriptParameters();

            log.debug('Config Mandazy', config);
 
            const tokenField = search.lookupFields({
                type: 'customrecord_elm_config_servicion',
                id: 1,
                columns: ['custrecord_elm_token_prov']
            });

            const accessToken = tokenField.custrecord_elm_token_prov;
            
            // Paso 2: Construir request body
            const requestBody = buildRequestBody(documentoFormateado, datosConsulta);
            log.debug('Request Body Mandazy', JSON.stringify(requestBody));

            // Paso 3: Llamar al servicio IC GCP
            const apiResponse = callMandazyService(config, accessToken, requestBody);

            // Paso 4: Procesar respuesta
            const resultado = processResponse(apiResponse);

            log.debug('Resultado Mandazy', JSON.stringify(resultado));

            // Paso 5: Crear registro de Clearing Historico
            const clearingHistoricoId = createClearingHistoricoRecord(datosConsulta.recordId, resultado);

            // Enviar respuesta al cliente
            const response = {
                success: true,
                dataUpdated: true,
                clearingHistoricoId: clearingHistoricoId,
                transactionId: resultado.transactionId,
                status: resultado.status,
                accion: resultado.accion,
                scoreRiesgo: resultado.scoreRiesgo,
                scoreIF: resultado.scoreIF,
                fallecido: resultado.fallecido,
                message: 'Consulta realizada correctamente'
            };

            context.response.write(JSON.stringify(response));

        } catch (e) {
            log.error('Error en consulta Mandazy', {
                name: e.name,
                message: e.message,
                stack: e.stack
            });

            sendErrorResponse(context, e.message, e.name);
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc getScriptParameters - Obtiene los parámetros de configuración del script
     * @returns {Object} - Configuración de Mandazy/Equifax
     */
    function getScriptParameters() {
        const scriptObj = runtime.getCurrentScript();
        const isSandbox = runtime.envType === runtime.EnvType.SANDBOX;
        
        // Obtener URLs según ambiente
        // const urls = isSandbox ? EQUIFAX_URLS.UAT : EQUIFAX_URLS.PROD;
        const urls = EQUIFAX_URLS.PROD;
        
        return {
            isSandbox: isSandbox,
            clientId: scriptObj.getParameter('custscript_elm_mandazy_client_id') || '',
            clientSecret: scriptObj.getParameter('custscript_elm_mandazy_client_secret') || '',
            tokenUrl: scriptObj.getParameter('custscript_elm_mandazy_token_url') || urls.token,
            apiUrl: scriptObj.getParameter('custscript_elm_mandazy_api_url') || urls.api,
            // ProductData configurable
            billTo: scriptObj.getParameter('custscript_elm_mandazy_bill_to') || PRODUCT_DATA.billTo,
            shipTo: scriptObj.getParameter('custscript_elm_mandazy_ship_to') || PRODUCT_DATA.shipTo,
            customer: scriptObj.getParameter('custscript_elm_mandazy_customer') || PRODUCT_DATA.customer,
            model: scriptObj.getParameter('custscript_elm_mandazy_model') || PRODUCT_DATA.model,
            configuration: scriptObj.getParameter('custscript_elm_mandazy_config') || PRODUCT_DATA.configuration
        };
    }

    /**
     * @author Gerardo Gonzalez
     * @desc buildRequestBody - Construye el body del request para IC GCP
     * @param {string} documento - Documento formateado
     * @param {Object} datos - Datos adicionales
     * @returns {Object} - Request body
     */
    function buildRequestBody(documento, datos) {
        // Determinar tipo de documento
        let tipoDocumento = datos.tipoDocumento || 'CI';
        let paisDocumento = datos.paisDocumento || 'UY';
        
        // Validar tipo de documento
        const tiposValidos = ['CI', 'PA', 'OTR'];
        if (!tiposValidos.includes(tipoDocumento.toUpperCase())) {
            tipoDocumento = 'CI';
        }
        
        const config = getScriptParameters();

        return {
            applicants: {
                primaryConsumer: {
                    personalInformation: {
                        documento: documento,
                        paisDocumento: paisDocumento.toUpperCase(),
                        tipoDocumento: tipoDocumento.toUpperCase()
                    }
                }
            },
            productData: {
                configuration: config.configuration,
                customer: config.customer,
                model: config.model,
                billTo: config.billTo,
                shipTo: config.shipTo
            }
        };
    }

    /**
     * @author Gerardo Gonzalez
     * @desc callMandazyService - Realiza la llamada al servicio IC GCP
     * @param {Object} config - Configuración
     * @param {string} accessToken - Token OAuth
     * @param {Object} requestBody - Body del request
     * @returns {Object} - Respuesta del servicio
     */
    function callMandazyService(config, accessToken, requestBody) {
        log.audit('Llamando a Mandazy IC GCP', { url: config.apiUrl });

        const response = https.post({
            url: config.apiUrl,
            headers: {
                'Content-Type': 'application/vnd.com.equifax.clientconfig.v1+json',
                'Accept': 'application/vnd.com.equifax.clientconfig.v1+json',
                'Authorization': 'Bearer ' + accessToken
            },
            body: JSON.stringify(requestBody)
        });

        log.audit('Respuesta Mandazy', {
            code: response.code,
            bodyLength: response.body ? response.body.length : 0,
            body: response.body
        });

        // Manejar errores HTTP
        if (response.code === 400) {
            const errorBody = tryParseJson(response.body);
            throw error.create({
                name: 'MANDAZY_BAD_REQUEST',
                message: 'Error 400: ' + (errorBody?.description || response.body),
                notifyOff: true
            });
        }

        if (response.code === 401) {
            // Invalidar cache de token
            invalidateTokenCache();
            throw error.create({
                name: 'MANDAZY_UNAUTHORIZED',
                message: 'Error 401: Token inválido o expirado',
                notifyOff: true
            });
        }

        if (response.code === 403) {
            throw error.create({
                name: 'MANDAZY_FORBIDDEN',
                message: 'Error 403: Sin permisos para acceder al recurso',
                notifyOff: true
            });
        }

        if (response.code === 404) {
            throw error.create({
                name: 'MANDAZY_NOT_FOUND',
                message: 'Error 404: Recurso no encontrado - verificar productData',
                notifyOff: true
            });
        }

        if (response.code === 406) {
            throw error.create({
                name: 'MANDAZY_NOT_ACCEPTABLE',
                message: 'Error 406: Formato de respuesta no aceptable - verificar headers Accept/Content-Type',
                notifyOff: true
            });
        }

        if (response.code >= 500) {
            throw error.create({
                name: 'MANDAZY_SERVER_ERROR',
                message: 'Error ' + response.code + ': Error en servidor Equifax',
                notifyOff: true
            });
        }

        if (response.code !== 200) {
            throw error.create({
                name: 'MANDAZY_HTTP_ERROR',
                message: 'Error HTTP ' + response.code + ': ' + response.body,
                notifyOff: true
            });
        }

        return response;
    }

    /**
     * @author Gerardo Gonzalez
     * @desc processResponse - Procesa la respuesta JSON del servicio Mandazy
     * @param {Object} response - Respuesta HTTP
     * @returns {Object} - Resultado procesado
     */
    function processResponse(response) {
        let responseData;
        
        try {
            responseData = JSON.parse(response.body);
        } catch (e) {
            throw error.create({
                name: 'MANDAZY_PARSE_ERROR',
                message: 'Error parseando respuesta JSON: ' + e.message,
                notifyOff: true
            });
        }

        // Verificar errores en la respuesta
        if (responseData.interconnectResponse?.CodigoError) {
            throw error.create({
                name: 'MANDAZY_BUSINESS_ERROR',
                message: 'Código ' + responseData.interconnectResponse.CodigoError + 
                         ': ' + responseData.interconnectResponse.MensajeError,
                notifyOff: true
            });
        }

        const resultado = {
            transactionId: responseData.transactionId || '',
            status: responseData.status || 'unknown',
            accion: '',
            fallecido: 'N',
            // Datos personales
            nombres: '',
            apellidos: '',
            sexo: '',
            estadoCivil: '',
            direccion: '',
            departamento: '',
            telefono: '',
            ocupacion: '',
            fechaExtravioCi: '',
            // Consultas e incumplimientos
            cantConsultasU1m: '',
            cantIncuFnb: '',
            fechaUltIncuFnb: '',
            saldoUltIncuFnb: '',
            cantIncuResto: '',
            fechaIncuResto: '',
            saldoUltIncuResto: '',
            cancU3mFnb: '',
            fechaCancMerFa: '',
            saldoCancMerF: '',
            // Scores
            scoreRiesgo: '',
            scoreIf: '',
            // Calificaciones BP
            peorCalifBpU1m: '',
            peorCalifBpU3m: '',
            peorCalifBpU12m: '',
            // Calificaciones TC
            tcPeorCalifU1m: '',
            tcPeorCalifU3m: '',
            tcPeorCalifU12m: '',
            // Calificaciones Servicios
            sePeorCalifU1m: '',
            sePeorCalifU3m: '',
            sePeorCalifU12m: '',
            // Calificaciones Préstamos
            prPeorCalifU1m: '',
            prPeorCalifU3m: '',
            prPeorCalifU12m: '',
            // Compromiso y cantidades
            compBpU1m: '',
            tcCantAbiertas: '',
            prCantAbiertas: '',
            seCantAbiertas: '',
            // Saldos BP
            saldoBpU1m: '',
            saldoVencidoBp: '',
            // Saldos TC
            tcSaldoU1m: '',
            tcSaldoVencido: '',
            // Saldos Servicios
            seSaldoU1m: '',
            seSaldoVencido: '',
            // Saldos Préstamos
            prSaldoU1m: '',
            prSaldoVencido: '',
            // BCU
            bcuPeorCalifU6m: '',
            rawResponse: responseData
        };

        const interconnect = responseData.interconnectResponse;
        if (!interconnect) {
            log.debug('Respuesta sin interconnectResponse', responseData);
            return resultado;
        }

        // Extraer variablesDeSalida
        const variables = interconnect.variablesDeSalida;
        if (variables) {
            resultado.accion = variables.accion || '';
            // Datos personales
            resultado.nombres = variables.nombres || '';
            resultado.apellidos = variables.apellidos || '';
            resultado.sexo = variables.sexo || '';
            resultado.estadoCivil = variables.estado_civil || '';
            resultado.direccion = variables.direccion || '';
            resultado.departamento = variables.departamento || '';
            resultado.telefono = variables.telefonos || '';
            resultado.ocupacion = variables.ocupacion || '';
            resultado.fechaExtravioCi = variables.fecha_extravio_ci_abierto || '';
            // Consultas e incumplimientos
            resultado.cantConsultasU1m = variables.cant_consultas_u1m || '';
            resultado.cantIncuFnb = variables.cant_incu_fnb_ban_mer_fasa || '';
            resultado.fechaUltIncuFnb = variables.fecha_ult_incu_fnb_ban_mer_fasa || '';
            resultado.saldoUltIncuFnb = variables.saldo_ult_incu_fnb_ban_mer_fasa || '';
            resultado.cantIncuResto = variables.cant_incu_resto || '';
            resultado.fechaIncuResto = variables.fecha_ult_incu_resto || '';
            resultado.saldoUltIncuResto = variables.saldo_ult_incu_resto || '';
            resultado.cancU3mFnb = variables.canc_u3m_fnb_ban_mer_fasa || '';
            resultado.fechaCancMerFa = variables.fecha_ult_canc_fnb_ban_mer_fasa || '';
            resultado.saldoCancMerF = variables.saldo_ult_canc_fnb_ban_mer_fasa || '';
            // Scores
            resultado.scoreRiesgo = variables.score_riesgo || '';
            resultado.scoreIf = variables.score_if || '';
            // Calificaciones BP
            resultado.peorCalifBpU1m = variables.peor_calif_bp_u1m || '';
            resultado.peorCalifBpU3m = variables.peor_calif_bp_u3m || '';
            resultado.peorCalifBpU12m = variables.peor_calif_bp_u12m || '';
            // Calificaciones TC
            resultado.tcPeorCalifU1m = variables.tc_peor_calif_u1m || '';
            resultado.tcPeorCalifU3m = variables.tc_peor_calif_u3m || '';
            resultado.tcPeorCalifU12m = variables.tc_peor_calif_u12m || '';
            // Calificaciones Servicios
            resultado.sePeorCalifU1m = variables.se_peor_calif_u1m || '';
            resultado.sePeorCalifU3m = variables.se_peor_calif_u3m || '';
            resultado.sePeorCalifU12m = variables.se_peor_calif_u12m || '';
            // Calificaciones Préstamos
            resultado.prPeorCalifU1m = variables.pr_peor_calif_u1m || '';
            resultado.prPeorCalifU3m = variables.pr_peor_calif_u3m || '';
            resultado.prPeorCalifU12m = variables.pr_peor_calif_u12m || '';
            // Compromiso y cantidades
            resultado.compBpU1m = variables.compromiso_bp_u1m || '';
            resultado.tcCantAbiertas = variables.tc_cant_abiertas || '';
            resultado.prCantAbiertas = variables.pr_cant_abiertas || '';
            resultado.seCantAbiertas = variables.se_cant_abiertas || '';
            // Saldos BP
            resultado.saldoBpU1m = variables.saldo_bp_u1m || '';
            resultado.saldoVencidoBp = variables.saldo_vencido_bp_u1m || '';
            // Saldos TC
            resultado.tcSaldoU1m = variables.tc_saldo_u1m || '';
            resultado.tcSaldoVencido = variables.tc_saldo_vencido_u1m || '';
            // Saldos Servicios
            resultado.seSaldoU1m = variables.se_saldo_u1m || '';
            resultado.seSaldoVencido = variables.se_saldo_vencido_u1m || '';
            // Saldos Préstamos
            resultado.prSaldoU1m = variables.pr_saldo_u1m || '';
            resultado.prSaldoVencido = variables.pr_saldo_vencido_u1m || '';
            // BCU
            resultado.bcuPeorCalifU6m = variables.bcu_peor_calif_u6m || '';
        }

        // Extraer infoConsulta
        const infoConsulta = interconnect.infoConsulta;
        if (infoConsulta) {
            resultado.fallecido = infoConsulta.fallecido || 'N';
        }

        log.audit('Resultado procesado Mandazy', {
            transactionId: resultado.transactionId,
            accion: resultado.accion,
            scoreRiesgo: resultado.scoreRiesgo,
            fallecido: resultado.fallecido
        });

        return resultado;
    }

    /**
     * @author Gerardo Gonzalez
     * @desc createClearingHistoricoRecord - Crea un registro de Clearing Historico con los resultados
     * @param {number} leadId - ID del Lead/Cliente asociado
     * @param {Object} resultado - Resultado procesado de Mandazy
     * @returns {number} - ID del registro creado
     */
    function createClearingHistoricoRecord(leadId, resultado) {
        try {
            const clearingRecord = record.create({
                type: 'customrecord_clearing_historico',
                isDynamic: true
            });

            // Lead/Cliente asociado
            clearingRecord.setValue({
                fieldId: CLEARING_HISTORICO_FIELDS.lead,
                value: leadId
            });

            // Datos personales
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.nombre, value: resultado.nombres || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.apellido, value: resultado.apellidos || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.sexo, value: resultado.sexo || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.estadoCivil, value: resultado.estadoCivil || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.direccion, value: resultado.direccion || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.departamento, value: resultado.departamento || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.telefono, value: resultado.telefono || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.ocupacion, value: resultado.ocupacion || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.fechaExtravioCi, value: resultado.fechaExtravioCi || '' });

            // Consultas e incumplimientos
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.cantConsultasU1m, value: resultado.cantConsultasU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.cantIncuFnb, value: resultado.cantIncuFnb || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.fechaUltIncuFnb, value: resultado.fechaUltIncuFnb || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.saldoUltIncuFnb, value: resultado.saldoUltIncuFnb || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.cantIncuResto, value: resultado.cantIncuResto || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.fechaIncuResto, value: resultado.fechaIncuResto || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.saldoUltIncuResto, value: resultado.saldoUltIncuResto || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.cancU3mFnb, value: resultado.cancU3mFnb || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.fechaCancMerFa, value: resultado.fechaCancMerFa || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.saldoCancMerF, value: resultado.saldoCancMerF || '' });

            // Scores
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.scoreRiesgo, value: resultado.scoreRiesgo || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.scoreIf, value: resultado.scoreIf || '' });

            // Calificaciones BP
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.peorCalifBpU1m, value: resultado.peorCalifBpU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.peorCalifBpU3m, value: resultado.peorCalifBpU3m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.peorCalifBpU12m, value: resultado.peorCalifBpU12m || '' });

            // Calificaciones TC
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcPeorCalifU1m, value: resultado.tcPeorCalifU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcPeorCalifU3m, value: resultado.tcPeorCalifU3m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcPeorCalifU12m, value: resultado.tcPeorCalifU12m || '' });

            // Calificaciones Servicios
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.sePeorCalifU1m, value: resultado.sePeorCalifU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.sePeorCalifU3m, value: resultado.sePeorCalifU3m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.sePeorCalifU12m, value: resultado.sePeorCalifU12m || '' });

            // Calificaciones Préstamos
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prPeorCalifU1m, value: resultado.prPeorCalifU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prPeorCalifU3m, value: resultado.prPeorCalifU3m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prPeorCalifU12m, value: resultado.prPeorCalifU12m || '' });

            // Compromiso y cantidades
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.compBpU1m, value: resultado.compBpU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcCantAbiertas, value: resultado.tcCantAbiertas || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prCantAbiertas, value: resultado.prCantAbiertas || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.seCantAbiertas, value: resultado.seCantAbiertas || '' });

            // Saldos BP
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.saldoBpU1m, value: resultado.saldoBpU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.saldoVencidoBp, value: resultado.saldoVencidoBp || '' });

            // Saldos TC
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcSaldoU1m, value: resultado.tcSaldoU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.tcSaldoVencido, value: resultado.tcSaldoVencido || '' });

            // Saldos Servicios
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.seSaldoU1m, value: resultado.seSaldoU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.seSaldoVencido, value: resultado.seSaldoVencido || '' });

            // Saldos Préstamos
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prSaldoU1m, value: resultado.prSaldoU1m || '' });
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.prSaldoVencido, value: resultado.prSaldoVencido || '' });

            // BCU
            clearingRecord.setValue({ fieldId: CLEARING_HISTORICO_FIELDS.bcuPeorCalifU6m, value: resultado.bcuPeorCalifU6m || '' });

            const recordId = clearingRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.audit('Clearing Historico creado', {
                recordId: recordId,
                leadId: leadId,
                accion: resultado.accion,
                scoreRiesgo: resultado.scoreRiesgo
            });

            return recordId;

        } catch (e) {
            log.error('Error creando Clearing Historico', e);
            throw e;
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc sendErrorResponse - Envía respuesta de error al cliente
     * @param {Object} context - Contexto del Suitelet
     * @param {string} message - Mensaje de error
     * @param {string} errorCode - Código de error
     */
    function sendErrorResponse(context, message, errorCode) {
        const response = {
            success: false,
            dataUpdated: false,
            errorCode: errorCode || 'UNKNOWN_ERROR',
            errorMessage: message
        };
        
        context.response.write(JSON.stringify(response));
    }

    // ============ FUNCIONES AUXILIARES ============

    /**
     * @desc formatDocumento - Formatea el documento con guión si es cédula uruguaya
     * @param {string} documento - Documento a formatear
     * @returns {string} - Documento formateado
     */
    function formatDocumento(documento) {
        if (!documento) return '';
        
        // Eliminar espacios y caracteres especiales excepto guiones
        let doc = documento.toString().trim().replace(/[^0-9-]/g, '');
        
        // Si ya tiene guión, retornar
        if (doc.includes('-')) {
            return doc;
        }
        
        // Si tiene 7 u 8 dígitos, agregar guión antes del último
        if (doc.length >= 7 && doc.length <= 8) {
            return doc.slice(0, -1) + '-' + doc.slice(-1);
        }
        
        return doc;
    }

    /**
     * @desc encodeBase64 - Codifica string a Base64
     * @param {string} str - String a codificar
     * @returns {string} - String codificado
     */
    function encodeBase64(str) {
        // NetSuite no tiene btoa nativo, usar encode module
        const encode = require('N/encode');
        return encode.convert({
            string: str,
            inputEncoding: encode.Encoding.UTF_8,
            outputEncoding: encode.Encoding.BASE_64
        });
    }

    /**
     * @desc tryParseJson - Intenta parsear JSON sin lanzar error
     * @param {string} str - String a parsear
     * @returns {Object|null} - Objeto parseado o null
     */
    function tryParseJson(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return null;
        }
    }

    /**
     * @desc invalidateTokenCache - Invalida el cache del token
     */
    function invalidateTokenCache() {
        try {
            const tokenCache = cache.getCache({
                name: TOKEN_CACHE_NAME,
                scope: cache.Scope.PRIVATE
            });
            tokenCache.remove({
                key: TOKEN_CACHE_KEY
            });
            log.debug('Token cache invalidado');
        } catch (e) {
            log.debug('Error invalidando token cache', e.message);
        }
    }

    return {
        onRequest: onRequest
    };
});
