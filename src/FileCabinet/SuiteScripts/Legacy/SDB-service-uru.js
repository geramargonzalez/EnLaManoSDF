/**
 * 
 * Task                    Date                  Author                             
 *  Servicio 1 Urupago         2 feb 2022           Edgar Russi                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/search', "N/log","N/record"],
    (search, log,record) => {
        function onRequest(context) {

            let Response = {};

            try {
                var JSONResult = JSON.parse(context.request.body);
                log.debug("JSONResult", JSONResult);
                let method = context.request.method;
                let phone=JSONResult.Phone;
                let date =JSONResult.Date;
                let canal=JSONResult.Canal;
                let nombre = JSONResult.Nombre
                let apellido = JSONResult.Apellido

                if (method == "POST") {
                    let dni = JSONResult.Dni
                    if (!dni) {
                        Response = {
                            status: "ERROR",
                            code: "200",
                            message: " REQUEST NEED A DNI PARAMETER",
                        };
                    } else {
                        let customrecord_sdb_lista_negraSearchObj = search.create({
                            type: "customrecord_sdb_lista_negra",
                            filters:
                                [
                                    ["name", "is", dni]
                                ],
                            columns:
                                [
                                    search.createColumn({
                                        name: "name",
                                        sort: search.Sort.ASC,
                                        label: "Nombre"
                                    }),
                                    search.createColumn({ name: "id", label: "ID" }),
                                    search.createColumn({ name: "scriptid", label: "ID de script" })
                                ]
                        });
                        let listaNegra = customrecord_sdb_lista_negraSearchObj.runPaged().count;
                        log.debug("customrecord_sdb_lista_negraSearchObj result count", listaNegra);
                        if (listaNegra == 0) {
                            log.debug('sin result', "sin result");
                            Response.status = "Success";
                            Response.code = "200"
                            Response.message = "Cliente Valido";
                            Response.PeorCalificación = "444 test result";
                            Response.Documento = dni;
                            Response.TipoDocumento = "CI";
                               
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
                                value: canal
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_nrdocumento',
                                value: dni
                            });
                            objRecord.setValue({
                                fieldId: 'mobilephone',
                                value: phone
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

                    log.debug('objRecord', objRecord);
                        } else {
                            Response = {
                                status: "Success",
                                code: "200",
                                message: "Cliente no Apto para prestamo",
                                PeorCalificación: "444 444 test result",
                                Documento:dni,
                                TipoDocumento:"CI"
                            };
                        }
                    }
                } else {
                    Response = {
                        status: "ERROR",
                        code: "200",
                        message: " REQUEST METHOD MUST BE POST",
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
