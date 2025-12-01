/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description Script programado para asignar leads a operadores disponibles
 */

define(['N/record', 'N/search', 'N/runtime', 'N/error', './bcuScore/adapters/equifaxAdapter'],
    function (record, search, runtime, error, equifaxAdapter) {

        function execute(context) {
            const logTitle = 'ELM GETTOKENSCORE - Scheduled';
            
            try {
                log.audit(logTitle, '**** INICIO DE OBTENCIÓN DE TOKEN DE SCORE ****');
                
                // Obtener parámetros del script
                const scriptObj = runtime.getCurrentScript();
                const idConfig = parseInt(scriptObj.getParameter({ name: 'custscript_elm_qty_assigned' })) || 1;
                
                const equifaxTokenInfo = equifaxAdapter.getValidToken(false, false);
                log.audit(logTitle, `Equifax Token Válido Hasta: ${equifaxTokenInfo}`);
                const idToken = record.submitFields({
                    type: 'customrecord_elm_config_servicion',
                    id: idConfig,
                    values: {
                        custrecord_elm_token_prov: equifaxTokenInfo
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true

                    }
                });
                log.audit(logTitle, `Equifax Token Actualizado en Configuración (ID Registro: ${idToken})`);

            } catch (e) {
                log.error(logTitle, 'Error en ejecución: ' + e.message);
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
