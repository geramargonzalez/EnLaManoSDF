/**
 * 
 * Task                    Date                  Author                             
 *  Servicio 1          2 feb 2022           Edgar Russi                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
 define(['N/search', "N/log","./SDB-Enlamano-score.js","N/record"],
 (search, log,scorelib,record) => {
     function onRequest(context) {

        log.debug("onRequest", '************  start  ************');
        let Response = {};

         try {
           
             var JSONResult = JSON.parse(context.request.body);
             log.debug("JSONResult", JSONResult);
             let method = context.request.method;
         
             if (method == "POST") {
                 let dni = JSONResult.dni
                 var fecha = new Date();
                 log.debug("fecha", fecha);
                 var entitySearchObj = search.create({
                     type: "entity",
                     filters:
                     [
                        ["custentity_sdb_nrdocumento","is",dni]
                     ],
                     columns:
                     [
                        search.createColumn({name: "internalid", label: "Internal ID"}),
                        search.createColumn({
                           name: "entityid",
                           sort: search.Sort.ASC,
                           label: "ID"
                        })
                     ]
                  });
                 var searchResultCount = entitySearchObj.runPaged().count;
                 log.debug("entitySearchObj result count", searchResultCount);
                 log.debug("dni", dni.length);
                 if (!dni || dni.length <= 7 || dni.length >= 10) {
                     Response = {
                         status: "ERROR",
                         code: "200",
                         message: " CEDULA NO VALIDA",
                     };
                 } else if (searchResultCount > 0) {
                         Response.status = "Success";
                         Response.code = "200"
                         Response.message = "CEDULA YA INGRESADA ANTERIORMENTE";

                       
                         var objRecord = record.create({
                             type: "customrecord_sdb_repetidos",
                             isDynamic: true,
                         });
                         objRecord.setValue({
                             fieldId: 'name',
                             value: dni
                         });
                         objRecord.setValue({
                             fieldId: 'custrecord2',
                             value: fecha,
                         });
             
                         var objRecordId = objRecord.save({
                             enableSourcing: true,
                             ignoreMandatoryFields: false
                         });


                     context.response.write(JSON.stringify(Response))
                     return
                 }
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
                     var score = scorelib.scoreFinal(dni);
                     log.debug("1 score", score);
                     log.debug("score.logTxt", score.logTxt);

                     var logTXT = " -Comienzo - ";
                     logTXT += score.logTxt;
                     log.debug("logTXT", logTXT);

                     if (score.error_reglas == true) {
                         log.debug("score", score);
                         Response = {
                             status: "ERROR",
                             code: "200",
                             message: "No cumple con las reglas del score",
                         };
                         context.response.write(JSON.stringify(Response));
                         return;
                     }
                     if (listaNegra == 0) {
                         log.debug('sin result', "sin result");
                         Response.status = "Success";
                         Response.code = "200"
                         Response.message = "Aprobado";
                     } else {
                         Response = {
                             status: "Success",
                             code: "200",
                             message: "Rechazado",
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
