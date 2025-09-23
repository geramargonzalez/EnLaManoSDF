/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
define(['N/log', 'N/search'], function(log, search) {

    function onRequest(context) {
        var Response = {}
        var responseMessage = ""
        try {
            var JSONResult = JSON.parse(context.request.body);
                log.debug("JSONResult", JSONResult);
                var method = context.request.method;
                if (method == "POST") {
                    var ci = JSONResult.cedula;
                    var canal = JSONResult.canal;
                    var customerArr = [];
                    var lead = {}
                    var customerSearchObj = search.create({
                        type: "customer",
                        filters:
                        [
                           ["status","anyof","13","16","15","7","6","14","12","11"], 
                           "AND", 
                           ["custentity_sdb_nrdocumento","is", ci]
                        ],
                        columns:
                        [
                           search.createColumn({name: "custentitycustentity_sdb_ofertapend", label: "Oferta pendiente de respuesta"}),
                           search.createColumn({name: "custentitycustentity_sdb_pendienteretiro", label: "Pendiente de retiro"}),
                           search.createColumn({name: "custentitycustentity_sdb_prestamoaprob", label: "Préstamo aprobado"}),
                           search.createColumn({name: "custentity_sdb_razon_rechazo", label: "RECHAZO POR DEPARTAMENTO DE ANALISIS"}),
                           search.createColumn({name: "custentity_sdb_documentacion_incompleta", label: "Documentacion Incompleta"}),
                           search.createColumn({name: "custentity_sdb_pendinete_de_doc_para_ini", label: "PENDIENTE DE DOC PARA INCIAR SOLICITUD"}),
                           search.createColumn({name: "custentity_sdb_prestadorcodigo", label: "Prestador codigo"}),
                           search.createColumn({name: "altname", label: "Name"})
                        ]
                     });
                     var searchResultCount = customerSearchObj.runPaged().count;
                     log.debug("customerSearchObj result count",searchResultCount);
                     customerSearchObj.run().each(function(result){
                        log.debug('result', result)
                        if (result.recordType == "customer"){
                            customerArr.push(JSON.parse(JSON.stringify(result)));
                        }
                        var prestador = result.getValue('custentity_sdb_prestadorcodigo');
                        if (prestador == canal) {
                            lead = JSON.parse(JSON.stringify(result))
                        }
                        return true;
                     });
                     if (customerArr.length > 0){
                        log.debug('HAY UN CUSTOMER', customerArr[0])
                        log.debug('asdasd', customerArr[0].values)
                        var pendienteRespuesta = customerArr[0].values.custentitycustentity_sdb_ofertapend;
                        var pendienteRetiro = customerArr[0].values.custentitycustentity_sdb_pendienteretiro;
                        var prestamoAprobado = customerArr[0].values.custentitycustentity_sdb_prestamoaprob;
                        var rechazo = customerArr[0].values['custentity_sdb_razon_rechazo'].length > 0 ? customerArr[0].values['custentity_sdb_razon_rechazo'][0].text : false;
                        var docIncompleta = customerArr[0].values.custentity_sdb_documentacion_incompleta;
                        var pendienteDoc = customerArr[0].values.custentity_sdb_pendinete_de_doc_para_ini;
                        var name = customerArr[0].values.altname;
                        var prestadorCod = customerArr[0].values.custentity_sdb_prestadorcodigo;
                        responseMessage += `<br></br>Nombre: ${name}<br></br>`
                        responseMessage += `Prestador: ${prestadorCod}<br></br>`
                        responseMessage += `Estado: <ul>`
                        if (pendienteRespuesta) responseMessage += `<li>Oferta pendiente de respuesta</li>`
                        if (pendienteRetiro) responseMessage += `<li>Pendiente de retiro</li>`
                        if (prestamoAprobado) responseMessage += `<li>Prestamo aprobado</li>`
                        if (rechazo) responseMessage += `<li>Rechazado por ${rechazo}</li>`
                        if (docIncompleta) responseMessage += `<li>Documentacion Incompleta</li>`
                        if (pendienteDoc) responseMessage += `<li>Pendiente de documentacion para iniciar solicitud</li>`
                        responseMessage += `</ul>`
                        Response = {
                            status: "Success",
                            code: "200",
                            message: responseMessage,
                        }
                     }
                     else if (Object.keys(lead).length > 0) {
                        log.debug('HAY UN LEAD', lead)
                        var pendienteRespuesta = lead.values.custentitycustentity_sdb_ofertapend;
                        var pendienteRetiro = lead.values.custentitycustentity_sdb_pendienteretiro;
                        var prestamoAprobado = lead.values.custentitycustentity_sdb_prestamoaprob;
                        var rechazo = lead.values['custentity_sdb_razon_rechazo'].length > 0 ? lead.values['custentity_sdb_razon_rechazo'][0].text : false;
                        var docIncompleta = lead.values.custentity_sdb_documentacion_incompleta;
                        var pendienteDoc = lead.values.custentity_sdb_pendinete_de_doc_para_ini;
                        var name = lead.values.altname;
                        var prestadorCod = lead.values.custentity_sdb_prestadorcodigo;
                        responseMessage += `<br></br>Nombre: ${name}<br></br>`
                        responseMessage += `Prestador: ${prestadorCod}<br></br>`
                        responseMessage += `Estado: <ul>`
                        if (pendienteRespuesta) responseMessage += `<li>Oferta pendiente de respuesta</li>`
                        if (pendienteRetiro) responseMessage += `<li>Pendiente de retiro</li>`
                        if (prestamoAprobado) responseMessage += `<li>Prestamo aprobado</li>`
                        if (rechazo) responseMessage += `<li>Rechazado por ${rechazo}</li>`
                        if (docIncompleta) responseMessage += `<li>Documentacion Incompleta</li>`
                        if (pendienteDoc) responseMessage += `<li>Pendiente de documentacion para iniciar solicitud</li>`
                        responseMessage += `</ul>`
                        Response = {
                            status: "Success",
                            code: "200",
                            message: responseMessage,
                        }
                     }
                     else{ 
                        log.debug('NO HAY LEAD PARA ESE PRESTADOR')
                        Response = {
                            status: "Success",
                            code: "200",
                            message: "Numero de documento no registrado para este prestador",
                        }
                     }
                }
                else{
                    Response = {
                        status: "ERROR",
                        code: "200",
                        message: "REQUEST METHOD MUST BE POST",
                    }
                }
        } catch (error) {
            Response = {
                status: "ERROR",
                code: "500",
                message: "Internal server error",
            };
            log.debug('error', error)
        }
        context.response.write(Response.message);
    }

    return {
        onRequest: onRequest
    }
});
