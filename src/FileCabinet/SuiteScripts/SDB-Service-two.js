/**
 * 
 * Task                    Date                  Author                             
 *  Servicio 1          2 feb 2022           Edgar Russi                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/search', "N/log", "N/record"],
    (search, log, record) => {
        function onRequest(context) {

            let Response = {};

            try {
                var JSONResult = JSON.parse(context.request.body);
                log.debug("JSONResult", JSONResult);
                let method = context.request.method;
                let prestadorcodigo = JSONResult.Prestadorcodigo
                let prestadorsucursal = JSONResult.Prestadorsucursal
                let prestadorusuario = JSONResult.Prestadorusuario
                let telefono = JSONResult.telefono
                let nombre = JSONResult.Nombre
                let apellido = JSONResult.Apellido
                let salario = JSONResult.Salario
                let numerodocumento = JSONResult.Numerodocumento
                if (method == "POST") {

                    if (!nombre) {
                        Response = {
                            status: "ERROR",
                            code: "200",
                            message: "REQUEST NEED A NOMBRE PARAMETER",
                        };
                    } else {

                        var objRecord = record.create({
                            type: record.Type.LEAD,
                            isDynamic: true,
                        });
                        objRecord.setValue({
                            fieldId: 'entitystatus',
                            value: '6'
                        });
                        objRecord.setValue({
                            fieldId: 'custentity_sdb_prestadorcodigo',
                            value: prestadorcodigo
                        });
                        objRecord.setValue({
                            fieldId: 'custentity_sdb_prestadorsucursal',
                            value: prestadorsucursal
                        }),
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_prestadorusuario',
                                value: prestadorusuario
                            });
                        objRecord.setValue({
                            fieldId: 'custentity_sdb_nrdocumento',
                            value: numerodocumento
                        });
                        objRecord.setValue({
                            fieldId: 'custentity_sdb_infolab_importe',
                            value: salario
                        });
                        objRecord.setValue({
                            fieldId: 'mobilephone',
                            value: telefono
                        });
                        objRecord.setValue({
                            fieldId: 'firstname',
                            value: nombre
                        });
                        objRecord.setValue({
                            fieldId: 'lastname',
                            value: apellido
                        });
                    objRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: false
                });

                    }
                } else {
                    Response = {
                        status: "ERROR",
                        code: "200",
                        message: "REQUEST METHOD MUST BE POST",
                    }

                };
            } catch (error) {
                // throw new Error(error.message || 'Unexpected Error, Contact your admin');
                Response = {
                    status: "ERROR",
                    code: "500",
                    message: error,
                };
            }
            context.response.write(JSON.stringify(Response));
        }

        return {
            onRequest
        }
    });
