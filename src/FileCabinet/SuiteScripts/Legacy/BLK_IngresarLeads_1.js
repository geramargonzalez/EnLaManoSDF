/**
 * 
 * Task                    Date                  Author                             
 *  Ingresar Lead 1          15 feb 2024           Oscar Lopez                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
 define(['N/ui/serverWidget', 'N/search', "N/log","./SDB-Enlamano-score.js","N/record"], (serverWidget, search, log,scorelib,record) => {
    
    function onRequest(context) {
        try {
            const FIELDS = [
                "Cedula", 
                "Nombre", 
                "Apellido", 
                "Edad", 
                "Salario_Declarado"
            ];

            let method = context.request.method;
            if (method == "GET") {

                var form = serverWidget.createForm({ title : 'Al Prestamo Test - Ingreso de Informacion', hideNavBar: false });
                form.addSubmitButton({ label : 'Submit' });

                for (var i=0; i < FIELDS.length; i++) {
                    var field_label = FIELDS[i];
                    var field_id = field_label.toLowerCase();
                    form.addField({ id : 'custpage_' + field_id, type : serverWidget.FieldType.TEXT, label: field_label });
                }

                var actividad = form.addField({ id: "custpage_actividad_laboral", type: serverWidget.FieldType.SELECT, label: "Actividad_Laboral" });
                actividad.addSelectOption({ value: 1, text: "Privado" });
                actividad.addSelectOption({ value: 2, text: "Publico" });
                actividad.addSelectOption({ value: 3, text: "Jubilado" });
                actividad.addSelectOption({ value: 4, text: "banco" });
                actividad.addSelectOption({ value: 5, text: "financiera" });
                actividad.addSelectOption({ value: 6, text: "carta contador" });
                actividad.addSelectOption({ value: 7, text: "policia" });
        
                context.response.writePage(form);

            } else {

                var html_response = '<a href="https://7564430.app.netsuite.com/app/site/hosting/scriptlet.nl?script=33&deploy=1">INGRESAR NUEVAMENTE</a><BR><BR>';
                var json_response = {};

                var dni = context.request.parameters.custpage_cedula
                
                if (!dni || dni.length <= 7 || dni.length >= 10) {
                    json_response.status = "ERROR";
                    json_response.code = "200";
                    json_response.message = "CEDULA NO VALIDA";

                    html_response += '<P>CEDULA NO VALIDA</P>';

                } else {
                    html_response += '<P>CEDULA OK</P>';

                    var nombre = context.request.parameters.custpage_nombre
                    if (!nombre) {
                        json_response.status = "ERROR";
                        json_response.code = "200";
                        json_response.message = "REQUEST NEED A NOMBRE PARAMETER";

                        html_response += '<P>NOMBRE no valido</P>';
        
                    } else {

                        var fecha = new Date();

                        var searchResultCount = cedulaYaIngresada(dni);
                        if (searchResultCount > 0) {
                            json_response.status = "Success";
                            json_response.code = "200"
                            json_response.message = "CEDULA YA INGRESADA ANTERIORMENTE";

                            html_response += '<p>CEDULA YA INGRESADA ANTERIORMENTE</p>';

                            var objRecord = record.create({ type: "customrecord_sdb_repetidos", isDynamic: true });
                            objRecord.setValue({ fieldId: 'name', value: dni });
                            objRecord.setValue({ fieldId: 'custrecord2', value: fecha });
                            objRecord.setValue({ fieldId: 'custrecord1', value: dni });
                            objRecord.setValue({ fieldId: 'custrecord_sdb_medio', value: 'Al Prestamo' });

                            var objRecordId = objRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });
                            html_response += '<P><a target="_blank" href="https://7564430.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=20&id='+objRecordId+'">Registro de repetido creado</a></P>';

                        } else {

                            var listaNegraCount = listaNegra(dni);
                            if (0 < listaNegraCount) {
                                json_response.status = "Success";
                                json_response.code = "200"
                                json_response.message = "Rechazado";

                                html_response += '<P><a target="_blank" href="https://7564430.app.netsuite.com/app/common/custom/custrecordentrylist.nl?rectype=2">CEDULA en lista negra</a></P>';

                            } else {

                                var score = scorelib.scoreFinal(dni);

                                html_response += '<P>-------------   INFORMACION RETORNADA POR EL SCORING... COMIENZO --------- </P>';
                                html_response += '<BR>' + JSON.stringify(score) + '<BR>';
                                html_response += '<P>-------------   SCORING FIN --------- </P>';

                                if (score.error_reglas == null) {
                                    score.error_reglas = false;
                                }

                                if (score.error_reglas == true) {
                                    html_response += '<P>No cumple las reglas del scroting</P>';

                                } else {

                                    var prestadorcodigo = 4;
                                    var prestadorsucursal = 1;
                                    var prestadorusuario = "UsuarioALP";
                                    
                                    var objRecord = record.create({
                                        type: record.Type.LEAD,
                                        isDynamic: true,
                                    });
                                    objRecord.setValue({ fieldId: 'entitystatus', value: '6' });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_prestadorcodigo', value: prestadorcodigo });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_prestadorsucursal', value: prestadorsucursal });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_prestadorusuario', value: prestadorusuario });

                                    var apellido = context.request.parameters.custpage_apellido;
                                    var edad = context.request.parameters.custpage_edad;
                                    var actividad_laboral = context.request.parameters.custpage_actividad_laboral;
                                    var salario_declarado = context.request.parameters.custpage_salario_declarado;

                                    objRecord.setValue({ fieldId: 'custentity_sdb_nrdocumento', value: dni });
                                    objRecord.setValue({ fieldId: 'firstname', value: nombre });
                                    objRecord.setValue({ fieldId: 'lastname', value: apellido });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_edad', value: edad });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_actividad', value: actividad_laboral });
                                    objRecord.setValue({ fieldId: 'custentity_sdb_infolab_importe', value: salario_declarado });
                                    
                                    objRecord.setValue({ fieldId: 'mobilephone', value: '1234567' });

                                    objRecord.setValue({ fieldId: 'custentity_score', value: score.score });
                                    objRecord.setValue({ fieldId: 'custentity_calificacion', value: score.calificacionMinima });
                                    /*
//                                    objRecord.setValue({ fieldId: 'custentityendeudamiento_t2', value: score.endeudamiento });
                                    */

                                    html_response += '<P>------ getPonderador ------</P>';
                                    html_response += '<P>score.score: ' + score.score + '</P>';
                                    html_response += '<P>score.calificacionMinima: ' + score.calificacionMinima + '</P>';
                                    html_response += '<P>score.endeudamiento: ' + score.endeudamiento + '</P>';
                                    html_response += '<P>salario_declarado: ' + salario_declarado + '</P>';
                                    html_response += '<P>actividad_laboral: ' + actividad_laboral + '</P>';
                                    html_response += '<P>edad: ' + edad + '</P>';

                                    var ponderador = getPonderador(score.score, score.calificacionMinima, score.endeudamiento, salario_declarado, actividad_laboral, edad);
                                    html_response += '<P>------ getPonderador = RESULTADO ------</P>';
                                    html_response += '<P>ponderador: ' + ponderador + '</P>';
                                    if (0 < ponderador) {
                                        html_response += '<P>ponderador: ' + ponderador + '</P>';
                                        var monto_cuota = parseFloat(salario_declarado) * parseFloat(ponderador);
                                        html_response += '<P>monto_cuota: ' + monto_cuota + '</P>';

                                        var oferta_final = getOfertaFinal(monto_cuota);
                                        if (oferta_final == null) {
                                            html_response += '<P>No hay oferta final para este monto de cuota!!!!</P>';

                                        } else {
                                            /*
                                            objRecord.setValue({ fieldId: 'custentity_sdb_cuotas', value: oferta_final.plazo });
                                            */

                                            html_response += '<P>Oferta Final asociada: </P>';
                                            html_response += '<P>' + JSON.stringify(oferta_final) + '</P>';

                                            objRecord.setValue({ fieldId: 'custentity_sdb_valor_cuota', value: parseFloat(oferta_final.monto_cuota) });
//                                            objRecord.setValue({ fieldId: 'custentity_sdb_montoofrecido', value: oferta_final.oferta });

                                        }

                                    } else {
                                        html_response += '<P>SIN OFERTA</P>';

                                    }

                                    html_response += '<P>Creando lead...</P>';

                                    var lead_id = objRecord.save({ enableSourcing: true, ignoreMandatoryFields: false });

                                    html_response += '<P><a target="_blank" href="https://7564430.app.netsuite.com/app/common/entity/custjob.nl?id='+lead_id+'">Lead creado correctamente</a></P>';

                                }
                            }
                        }
                    }
                }
                html_response += '<BR><BR>JSON RESPUESTA: <BR>' + JSON.stringify(json_response);

                context.response.write(html_response);
            }
        } catch (E) {
            log.error('Error', E);
        }
    }

    function getMontoCuota(score) {

        var scoreValue = score.score;
        var endeudamiento = score.endeudamiento;
        var calificacionMinima = score.calificacionMinima;
        var contador = score.contador;
        var mensaje = score.mensaje;

        var montoCuotaRecord_id = -1;

        var customrecord_oferta_finalSearchObj = search.create({
            type: "customrecord_oferta_final",
            filters: [
               ["custrecord_score", "lessthanorequalto", scoreValue], "AND", 
               ["custrecord_score_final", "greaterthanorequalto", scoreValue], "AND", 
               ["custrecord_peor_calif_bcu", "is", calificacionMinima], "AND", 
               ["custrecord_endeudamiento_inicial", "lessthanorequalto", endeudamiento], "AND", 
               ["custrecord_endeudamiento_final", "greaterthanorequalto", endeudamiento]
            ],
            columns: [
               search.createColumn( { name: "custrecord_score" } )
            ]
        });
        customrecord_oferta_finalSearchObj.run().each(function(result) {
            montoCuotaRecord_id = result.id;
            return true;
        });
         
        if (montoCuotaRecord_id == -1) {
            throw 'Oferta final no encontrada';
        }

        return record.load({
            type: 'customrecord_oferta_final',
            id: montoCuotaRecord_id,
            isDynamic: true
        });
    }

    function cedulaYaIngresada(dni) {
        var entitySearchObj = search.create({
            type: "entity",
            filters: [ ["custentity_sdb_nrdocumento","is",dni] ],
            columns: [ search.createColumn({name: "internalid", label: "Internal ID"}) ]
         });
        return entitySearchObj.runPaged().count;
    }

    function listaNegra(dni) {
        let customrecord_sdb_lista_negraSearchObj = search.create({
            type: "customrecord_sdb_lista_negra",
            filters: [ ["name", "is", dni] ],
            columns: [ search.createColumn({ name: "name" }) ]
        });
        return customrecord_sdb_lista_negraSearchObj.runPaged().count;
    }

    function getPonderador(score, peor_calif_bcu, endeudamiento, salario, actividad, edad) {
        var ponderador = -1;
        var customrecord_oferta_finalSearchObj = search.create({
            type: "customrecord_oferta_final",
            filters: [
               ["custrecord_score","lessthanorequalto", score],  "AND", 
               ["custrecord_score_final","greaterthanorequalto", score], "AND", 
               ["custrecord_peor_calif_bcu","is", peor_calif_bcu], "AND", 
               ["custrecord_endeudamiento_inicial","lessthanorequalto", endeudamiento], "AND", 
               ["custrecord_endeudamiento_final","greaterthanorequalto", endeudamiento], "AND", 
               ["custrecord_salario_inicial","lessthanorequalto", salario], "AND", 
               ["custrecord_salario_final","greaterthanorequalto", salario], "AND", 
               [["custrecord_actividad","anyof", "8"],"OR",["custrecord_actividad","anyof", actividad]], "AND", 
               ["custrecord_edad","lessthanorequalto", edad], "AND", 
               ["custrecord_edad_final","greaterthanorequalto", edad], 
            ],
            columns: [
               search.createColumn({name: "custrecord_ponderador"})
            ]
        });
        customrecord_oferta_finalSearchObj.run().each(function(result) {
            ponderador = result.getValue('custrecord_ponderador');
            return true;
        });
        return ponderador;
    }

    function getOfertaFinal(monto_cuota) {
        var customrecord_sdb_oferta_finalSearchObj = search.create({
            type: "customrecord_sdb_oferta_final",
            filters: [ ["custrecord_monto_cuota","lessthanorequalto", monto_cuota] ],
            columns: [
                search.createColumn({name: "internalid"}),
                search.createColumn({name: "name"}),
                search.createColumn({name: "custrecord_monto_cuota", sort: search.Sort.DESC}),
                search.createColumn({name: "custrecord_oferta"}),
                search.createColumn({name: "custrecord_plazo"}),
                search.createColumn({name: "custrecordmonto_cuota_final"})
            ]
        });
        var oferta_final = null;
        customrecord_sdb_oferta_finalSearchObj.run().each(function(result) {
            oferta_final = {};
            oferta_final.internalid = result.getValue('internalid');
            oferta_final.name = result.getValue('name');
            oferta_final.monto_cuota = result.getValue('custrecord_monto_cuota');
            oferta_final.oferta = result.getValue('custrecord_oferta');
            oferta_final.plazo = result.getValue('custrecord_plazo');
            oferta_final.cuota_final = result.getValue('custrecordmonto_cuota_final');
            return false;
        });
        return oferta_final;
    }

    return {
        onRequest
    }

 });
