/**
 * 
 * Task                    Date                  Author                             
 *  Servicio General      14 marzo  2022           Edgar Russi                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/search', 'N/runtime', "N/log", "N/record", "./SDB-Enlamano-score.js", "N/https", "N/task"],
    (search, runtime, log, record, scorelib, https, task) => {
        function onRequest(context) {
            var Response = {};
            try {
                var JSONResult = JSON.parse(context.request.body);
                log.debug("JSONResult", JSONResult);
                var method = context.request.method;
                if (method == "POST") {
                    var canal = JSONResult.CanaldeVenta
                    var dni = JSONResult.NDoc
                    var phone = JSONResult.Telefono
                    var nombre = JSONResult.Nombre
                    var apellido = JSONResult.Apellido
                    var salariolíquido = JSONResult.salariolíquido
                    var tipoIngreso = canal == 'credizona' || canal == 'credito_para_vos' || canal == 'financialo' ? 'Privado' : JSONResult.actividad
                    tipoIngreso = tipoIngreso.toLowerCase()
                    var email = JSONResult.email
                    var edad = canal == 'credizona' || canal == 'credito_para_vos' || canal == 'financialo' ? 30 : JSONResult.edad
                    var cuidad = JSONResult.barrio
                    var direccion = JSONResult.Direccion
                    var capital = JSONResult.Capital
                    var cuotas = JSONResult.Cuotas
                    var depto = JSONResult.Depto
                    if (cuotas == "6") cuotas = "1";
                    if (cuotas == "12") cuotas = "2";
                    if (cuotas == "18") cuotas = "3";
                    if (cuotas == "24") cuotas = "4";
                    if (cuotas == "36") cuotas = "5";
                    if (tipoIngreso == "privado") tipoIngreso = "1";
                    if (tipoIngreso == "publico") tipoIngreso = "2";
                    if (tipoIngreso == "jubilado") tipoIngreso = "3";
                    if (tipoIngreso == "banco") tipoIngreso = "4";
                    if (tipoIngreso == "financiera") tipoIngreso = "5";
                    if (tipoIngreso == "carta contador") tipoIngreso = "6";
                    if (tipoIngreso == "policia") tipoIngreso = "7";
                    log.debug('tipoIngreso', tipoIngreso);
                    var entitySearchObj = search.create({
                        type: "entity",
                        filters:
                            [
                                ["custentity_sdb_nrdocumento", "is", dni],
                                "AND",
                                ["custentity_sdb_prestadorcodigo", "is", canal]
                            ],
                        columns:
                            [
                            ]
                    });
                    var searchResultCount = entitySearchObj.runPaged().count;
                    log.debug("entitySearchObj result count", searchResultCount);
                    log.debug("dni", dni.length);
                    if (!dni || dni.length <= 7 || dni.length >= 10) {
                        Response = {
                            status: "ERROR",
                            code: "200",
                            message: " CEDULA NO VALIDA O CEDULA YA INGRESADA",
                        };
                    } else if (searchResultCount > 0) {
                        entitySearchObj.run().each(function (result) {
                            var leadSearchObj = search.lookupFields({
                                type: record.Type.LEAD,
                                id: result.id,
                                columns: ['custentity_sdb_tabla_oferta']
                            })
                            var tabla = leadSearchObj.custentity_sdb_tabla_oferta
                            log.debug('tabla', tabla)
                            Response.status = "Success";
                            Response.code = "200"
                            Response.message = tabla+'</br>CEDULA YA INGRESADA ANTERIORMENTE';
                        })
                    }
                    else {
                        var customrecord_sdb_lista_negraSearchObj = search.create({
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
                        var listaNegra = customrecord_sdb_lista_negraSearchObj.runPaged().count;
                        log.debug("customrecord_sdb_lista_negraSearchObj result count", listaNegra);
                        if (listaNegra == 0) {
                            var score = scorelib.scoreFinal(dni);
                            log.debug("score", score);

                            if (score == true) {
                                log.debug("score", score);
                                Response = {
                                    status: "ERROR",
                                    code: "200",
                                    message: "No cumple con las reglas del score",
                                };
                                context.response.write(JSON.stringify(Response));
                                return;
                            }
                            var objRecord = record.create({
                                type: record.Type.LEAD,
                                isDynamic: true,
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_score',
                                value: score.score
                            });
                            objRecord.setValue({
                                fieldId: 'entitystatus',
                                value: '6'
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_entidades',
                                value: score.contador
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_calificacion',
                                value: score.calificacionMinima
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
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_infolab_importe',
                                value: salariolíquido
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_actividad',
                                value: tipoIngreso
                            });
                            objRecord.setValue({
                                fieldId: 'email',
                                value: email
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_edad',
                                value: edad
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_montosolicitado',
                                value: capital
                            });
                            objRecord.setValue({
                                fieldId: 'custentity_sdb_cuotas',
                                value: cuotas
                            });
                            //  Create the subrecord.
                            var newAddr = objRecord.selectNewLine({
                                sublistId: "addressbook"
                            })
                            var newAddr2 = objRecord.getCurrentSublistSubrecord({
                                sublistId: 'addressbook',
                                fieldId: 'addressbookaddress'
                            });
                            // Set values on the subrecord.
                            // Set country field first when script uses dynamic mode
                            newAddr2.setValue({
                                sublistId: "addressbook",
                                fieldId: 'country',
                                value: 'UY'
                            });
                            newAddr2.setValue({
                                sublistId: "addressbook",
                                fieldId: 'state',
                                value: depto
                            });
                            newAddr2.setValue({
                                sublistId: "addressbook",
                                fieldId: 'city',
                                value: cuidad
                            });
                            newAddr2.setValue({
                                sublistId: "addressbook",
                                fieldId: 'addr1',
                                value: direccion
                            });
                            newAddr2.setValue({
                                sublistId: "addressbook",
                                fieldId: 'defaultshipping',
                                value: true
                            });
                            newAddr.commitLine({
                                sublistId: 'addressbook'
                            });
                            var objRecordId = objRecord.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: false
                            });
                            log.debug('antes del workflow', 'antes del workflow')

                            var workflowTask = task.create({ taskType: task.TaskType.WORKFLOW_TRIGGER });
                            workflowTask.recordType = record.Type.LEAD;
                            workflowTask.recordId = objRecordId;
                            workflowTask.workflowId = 9;
                            var taskId = workflowTask.submit();
                            setTimeout(function () {
                                var leadSearchObj = search.lookupFields({
                                    type: record.Type.LEAD,
                                    id: objRecordId,
                                    columns: ['custentity_sdb_tabla_oferta']
                                })
                                var tabla = leadSearchObj.custentity_sdb_tabla_oferta
                                log.debug('tabla', tabla)
                                Response.status = "Success";
                                Response.code = "200"
                                Response.message = tabla;
                            }, 6000)
                        } else {
                            Response = {
                                status: "Success",
                                code: "200",
                                message: "Cliente no Apto para prestamo",
                            };
                            var body = { "noAprobado": true, "message": "90.000.000.000.0000.00000", "tel": "59891566584" }
                            var objResponse = https.post({
                                body: JSON.stringify(body),
                                url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                                headers: headers
                            });
                        }
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

        function setTimeout(aFunction, milliseconds) {
            var date = new Date();
            date.setMilliseconds(date.getMilliseconds() + milliseconds);
            while (new Date() < date) {
            }

            return aFunction();
        }


        return {
            onRequest
        }
    });
