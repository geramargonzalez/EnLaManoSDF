/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 * @description Client Script que maneja la llamada asíncrona al Suitelet de Mandazy/Equifax
 */

define(['N/url', 'N/https', 'N/ui/dialog', 'N/ui/message', 'N/currentRecord'], 
    function(url, https, dialog, message, currentRecord) {

    /**
     * @author Gerardo Gonzalez
     * @desc pageInit - Inicialización de la página
     * @param {Object} context
     */
    function pageInit(context) {
        // Inicialización si es necesaria
        console.log('Client Script Mandazy/Equifax inicializado');
    }

    /**
     * @author Gerardo Gonzalez
     * @desc consultarMandazy - Función llamada desde el botón para consultar Mandazy/Equifax
     * @param {number} recordId - ID del registro actual
     * @param {string} documento - Documento del registro actual
     */
    function consultarMandazy(recordId, documento) {
        try {
            // Mostrar mensaje de procesamiento
            const msgProcesando = message.create({
                title: 'Consultando Clearing',
                message: 'Obteniendo información crediticia para ' + documento,
                type: message.Type.INFORMATION
            });
            msgProcesando.show();

            // Obtener el registro actual
            // const record = currentRecord.get();
            
            // Obtener documento
            // const documento = record.getValue('custentity_sdb_nrdocumento');
            
            if (!documento) {
                msgProcesando.hide();
                dialog.alert({
                    title: 'Error',
                    message: 'El registro no tiene documento (cédula) definido.'
                });
                return;
            }

            // Recopilar datos del registro para enviar al Suitelet
            const datosConsulta = {
                recordId: recordId,
                recordType: 'customer',
                documento: documento,
                tipoDocumento: 'CI',  // Cédula uruguaya por defecto
                paisDocumento: 'UY'
            };

            // Llamar al Suitelet mediante promesa
            callSuiteletAsync(datosConsulta)
                .then(function(response) {
                    msgProcesando.hide();
                    handleSuiteletResponse(response, recordId);
                })
                .catch(function(error) {
                    msgProcesando.hide();
                    handleSuiteletError(error);
                });

        } catch (e) {
            console.error('Error en consultarMandazy:', e);
            dialog.alert({
                title: 'Error',
                message: 'Ocurrió un error al consultar Mandazy: ' + e.message
            });
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc callSuiteletAsync - Realiza llamada asíncrona al Suitelet mediante promesa
     * @param {Object} datosConsulta - Datos a enviar al Suitelet
     * @returns {Promise} - Promesa con la respuesta del Suitelet
     */
    function callSuiteletAsync(datosConsulta) {
        return new Promise(function(resolve, reject) {
            try {
                // Resolver URL del Suitelet
                const suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_elm_consulta_clearing_sl',
                    deploymentId: 'customdeploy_elm_consulta_clearing_sl',
                    returnExternalUrl: false
                });

                // Realizar llamada POST al Suitelet
                https.post.promise({
                    url: suiteletUrl,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(datosConsulta)
                }).then(function(response) {
                    if (response.code === 200) {
                        try {
                            const responseBody = JSON.parse(response.body);
                            resolve(responseBody);
                        } catch (parseError) {
                            resolve({ 
                                success: true, 
                                rawResponse: response.body 
                            });
                        }
                    } else {
                        reject({
                            code: response.code,
                            message: 'Error en la respuesta del servidor: ' + response.body
                        });
                    }
                }).catch(function(error) {
                    reject({
                        code: 'HTTPS_ERROR',
                        message: error.message || 'Error en la comunicación con el servidor'
                    });
                });

            } catch (e) {
                reject({
                    code: 'SCRIPT_ERROR',
                    message: e.message
                });
            }
        });
    }

    /**
     * @author Gerardo Gonzalez
     * @desc handleSuiteletResponse - Procesa la respuesta exitosa del Suitelet
     * @param {Object} response - Respuesta del Suitelet
     * @param {number} recordId - ID del registro
     */
    function handleSuiteletResponse(response, recordId) {
        try {
            if (response.success) {
                // Verificar si es persona fallecida
                if (response.fallecido === 'S') {
                    dialog.alert({
                        title: 'Persona Fallecida',
                        message: 'La consulta indica que la persona está registrada como FALLECIDA en el sistema.'
                    }).then(function() {
                        window.location.reload();
                    });
                    return;
                }

                // Mostrar resultado exitoso
                const accionTexto = formatAccion(response.accion);
                
                let mensajeDetalle = 'La consulta a Clearing se realizó correctamente.\n\n';
                mensajeDetalle += ' 📋 Estado: ' + (response.status || 'completed') + '\n';
                mensajeDetalle += ' 📊 Acción: ' + accionTexto + '\n';
                mensajeDetalle += ' 📈 Score Riesgo: ' + (response.scoreRiesgo || 'N/A') + '\n';
                mensajeDetalle += ' 📉 Score IF: ' + (response.scoreIF || 'N/A') + '\n';
                mensajeDetalle += ' 📁 Clearing Historico ID: ' + (response.clearingHistoricoId || 'N/A');

                dialog.alert({
                    title: 'Consulta Completada - Registro Creado',
                    message: mensajeDetalle
                }).then(function() {
                    // Recargar la página para mostrar los datos actualizados
                    window.location.reload();
                });

            } else {
                // Mostrar error del servicio
                dialog.alert({
                    title: 'Error en Consulta',
                    message: 'La consulta a Mandazy retornó un error:\n\n' + 
                             'Código: ' + (response.errorCode || 'UNKNOWN') + '\n' +
                             'Mensaje: ' + (response.errorMessage || 'Error desconocido')
                });
            }
        } catch (e) {
            console.error('Error procesando respuesta:', e);
            dialog.alert({
                title: 'Error',
                message: 'Error al procesar la respuesta: ' + e.message
            });
        }
    }

    /**
     * @author Gerardo Gonzalez
     * @desc handleSuiteletError - Maneja errores de la llamada al Suitelet
     * @param {Object} error - Objeto de error
     */
    function handleSuiteletError(error) {
        console.error('Error en llamada al Suitelet:', error);
        dialog.alert({
            title: 'Error de Comunicación',
            message: 'No se pudo completar la consulta a Mandazy.\n\n' +
                     'Código: ' + (error.code || 'UNKNOWN') + '\n' +
                     'Mensaje: ' + (error.message || 'Error desconocido')
        });
    }

    /**
     * @author Gerardo Gonzalez
     * @desc formatAccion - Formatea el campo acción para mostrar
     * @param {string} accion - Valor de acción de la respuesta
     * @returns {string} - Texto formateado
     */
    function formatAccion(accion) {
        if (!accion) return 'Sin información';
        
        const acciones = {
            'CON_ANTECEDENTES': '✅ Con Antecedentes',
            'SIN_ANTECEDENTES': '⚠️ Sin Antecedentes',
            'PERSONA_FALLECIDA': '❌ Persona Fallecida'
        };
        
        return acciones[accion] || accion;
    }

    return {
        pageInit: pageInit,
        consultarClearing: consultarMandazy
    };
});
