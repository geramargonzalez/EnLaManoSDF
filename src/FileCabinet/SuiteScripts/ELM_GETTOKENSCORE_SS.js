/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description Script programado para asignar leads a operadores disponibles
 */

define(['N/record', 'N/search', 'N/runtime', 'N/error', 'N/email', './bcuScore/adapters/equifaxAdapter'],
    function (record, search, runtime, error, email, equifaxAdapter) {


        /**
          * @author Gerardo González
          * @desc maskTokenLikeString - Función para enmascarar un token o cadena larga
          * @param {string} value - Contexto de ejecución del script programado
          */
        function maskTokenLikeString(value) {
            if (value === null || value === undefined) return String(value);
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            if (str.length <= 16) return str;
            return `${str.slice(0, 6)}...${str.slice(-4)}`;
        }
        /**
          * @author Gerardo González
          * @desc trySendNotification - Función para enviar notificaciones por correo electrónico
          * @param {Object} context - Contexto de ejecución del script programado
          */
        function trySendNotification({ scriptObj, subject, body }) {
            try {
                const recipients = scriptObj.getParameter({ name: 'custscript_elm_tokenscore_notify_to' });
                const author = scriptObj.getParameter({ name: 'custscript_elm_tokenscore_notify_author' });
                email.send({
                    author,
                    recipients,
                    subject,
                    body
                });
            } catch (notifyErr) {
                throw error.create({
                    name: 'ERROR_SENDING_NOTIFICATION',
                    message: 'Error enviando notificación: ' + (notifyErr && notifyErr.message ? notifyErr.message : notifyErr),
                    notifyOff: true
                });
            }
        }

        /**
         * @author Gerardo González
         *execute - Función principal del script programado para obtener y actualizar el token de score
        */
        function execute() {
            const logTitle = 'ELM GETTOKENSCORE - Scheduled';
            try {
                log.audit(logTitle, '**** INICIO DE OBTENCIÓN DE TOKEN DE SCORE ****');
                
                // Obtener parámetros del script
                const scriptObj = runtime.getCurrentScript();
                const idConfig = parseInt(scriptObj.getParameter({ name: 'custscript_elm_qty_assigned' })) || 1;
                const equifaxTokenInfo = equifaxAdapter.getValidToken(false, false);
                const idToken = record.submitFields({
                    type: 'customrecord_elm_config_servicion',
                    id: idConfig,
                    values: {
                        custrecord_elm_token_prov: equifaxTokenInfo,
                        custrecord_elm_token_ref_date: tokenRefreshDate
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true

                    }
                });
                log.audit(logTitle, `Equifax Token Actualizado en Configuración (ID Registro: ${idToken})`);
                if (idToken) {   
                    trySendNotification({
                        scriptObj,
                        subject: '[EnLaMano] Token Equifax actualizado correctamente',
                        body: [
                            'Se actualizó correctamente el token de Equifax.',
                            `Fecha/Hora: ${tokenRefreshDate.toISOString()}`,
                            `Token/Info (enmascarado): ${maskTokenLikeString(equifaxTokenInfo)}`
                        ].join('\n')
                    });
                }

            } catch (e) {
                log.error(logTitle, 'Error en ejecución: ' + e.message);
                const scriptObj = runtime.getCurrentScript();
                trySendNotification({
                    scriptObj,
                    subject: '[EnLaMano] ERROR actualizando token Equifax',
                    body: [
                        'Ocurrió un error al obtener/actualizar el token de Equifax.',
                        `Fecha/Hora: ${new Date().toISOString()}`,
                        `Mensaje: ${e && e.message ? e.message : e}`,
                        `Nombre: ${e && e.name ? e.name : 'N/A'}`,
                        `Stack: ${e && e.stack ? e.stack : 'N/A'}`
                    ].join('\n')
                });

                throw error.create({
                    name: 'ERROR_SCHEDULED_EXECUTION',
                    message: 'Error en ejecución de GETTOKENSCORE: ' + e.message,
                    notifyOff: false
                });
            }
        }

    

        return {
            execute: execute
        };
    });
