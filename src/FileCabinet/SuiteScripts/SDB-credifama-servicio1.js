/**
 * 
 * Task                    Date                  Author                             
 *  Servicio 1 Credifama         14 mar 2022           Edgar Russi                       
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
             let phone=JSONResult.mobile;
             let date =JSONResult.datetime;
             let canal=JSONResult.user;
             let nombre = JSONResult.name
             let lastname = JSONResult.lastname
             let birth = JSONResult.birth
             let clearing = JSONResult.clearing
             let product = JSONResult.product
             let idTrackeo = JSONResult.idTrackeo
         
             
             if (method == "POST") {
                 let dni = JSONResult.identification
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
                             value: lastname
                         });

                         objRecord.setValue({
                            fieldId: 'custentity5',
                            value: idTrackeo
                        });

                        objRecord.setValue({
                            fieldId: 'custentity6',
                            value: product
                        });
                        objRecord.setValue({
                            fieldId: 'custentity_sdb_fechanac',
                            value: birth
                        });
                        objRecord.setValue({
                            fieldId: 'custentity7',
                            value: clearing
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
