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
                // const equifaxTokenInfo = 'eyJraWQiOiJlMTNmX1ZnOXdXcGp4NTkzX3FmWTRzMmU1eUtlTnBWU0xkc1AwUk9PRGU4IiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULldxcHlVY3NnamVDeE15alJlWFd4dTZsM2VQM3hMd0YwU25zVktPRVZfR1EiLCJpc3MiOiJodHRwczovL2VxdWlmYXgtaWNnLWNhbi1nY3Aub2t0YS5jb20vb2F1dGgyL2F1czE4N2h0bHRPb05ZWG80NWQ3IiwiYXVkIjoiOTc3YmUyMWIwNzcwNDhlNjhkNDY3OTlhMWY5YzA4NzAiLCJpYXQiOjE3NjU3NjQxMjgsImV4cCI6MTc2NTg1MDUyOCwiY2lkIjoiMG9hZzh4bHcxeTZCdjZJYkI1ZDciLCJ1aWQiOiIwMHVybnR4OHg2RGNkSGdKUTVkNyIsInNjcCI6WyJvcGVuaWQiXSwiYXV0aF90aW1lIjoxNzY1NzY0MTI4LCJzdWIiOiJ1c2VydXltYW5kYXp5Iiwicm9sZXMiOlsiRUZYX0lDX1JPTEVfTEFUQU1fQ09ORklHVVJBVE9SX1VTRVIiLCJFRlhfSUNfUk9MRV9MQVRBTV9DQUxDVUxBVE9SX1VTRVIiLCJFRlhfSUNfUk9MRV91cm46c2w6aWQ9RXF1aWZheFJ1bGVFeGVjdXRvcklDR0NQIiwiRUZYX0lDX1JPTEVfVXNlciJdLCJncm91cHMiOiJHdWVzdCIsImxvY2tlZFVzZXIiOiIwIiwiZ2l2ZW5fbmFtZSI6InVzZXJ1eW1hbmRhenkiLCJzdHNfdXNlciI6ImZhbHNlIiwib2ZmaWNlX2lkIjoiIiwiVXNlcklkIjoidXNlcnV5bWFuZGF6eSIsIm5hbWUiOiJ1c2VyIiwib3JnYW5pemF0aW9ucyI6WyJFRlhfSUNfT1JHX1VZSUNNQU5EQVpZIiwiRUZYX0lDX09SR19VWUlDQk9YIiwiRUZYX0lDX09SR19VWUNPUkUiLCJFRlhfSUNfT1JHX1VZQ01TIl0sInVzZXJFbWFpbCI6InVzZXJ1eW1hbmRhenlAZXF1aWZheC5jb20iLCJlbWFpbCI6InVzZXJ1eW1hbmRhenlAZXF1aWZheC5jb20iLCJzdGF0dXMiOiIwIn0.Ccw2g3qHYaqj2suctldjW0MltrHqCwZOqi1ah8IGVPJjFCOUkWgYgHtcewLIzfzA7GvfvTogr_Zy5amkPnwyTKjvkfnuQNMaYpeIUKF7gJ6WFLXyuAVpGUbcadnQTV1q2lIsVpHNPYHxKHtSvRoSmjg-kUUOp3Po0Cbf97znUBdnGzSe38r2BvxUxtgYuI9a1MyLruyOh6qVg-OPhGPZpCkuBiXaspxszX6WDAmF_bzLov7QlJYWf7kJMhPEavtycZ9zqVj_CjSKFy7TbwZOkAjvg9dPvgUdnmPu8RdL_Ig_OcVCyC_UIkCZj1MPvM-yiyPflt729SVwq7IFZ9QJbA'
                const tokenRefreshDate = new Date();
                log.audit(logTitle, `Equifax Token Válido Hasta: ${equifaxTokenInfo}`);
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
                trySendNotification({
                    scriptObj,
                    subject: '[EnLaMano] Token Equifax actualizado correctamente',
                    body: [
                        'Se actualizó correctamente el token de Equifax.',
                        `Fecha/Hora: ${tokenRefreshDate.toISOString()}`,
                        `Config record ID: ${idConfig}`,
                        `Record actualizado (submitFields): ${idToken}`,
                        `Token/Info (enmascarado): ${maskTokenLikeString(equifaxTokenInfo)}`
                    ].join('\n')
                });

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
