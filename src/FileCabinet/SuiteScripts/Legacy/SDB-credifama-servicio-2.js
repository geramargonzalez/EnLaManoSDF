/**
 * 
 * Task                    Date                  Author                             
 *  Servicio 2 Credifama         14 mar 2022           Edgar Russi                       
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
             let IdTrackeo = JSONResult.IdTrackeo
         
             log.debug("idTrackeo ",IdTrackeo);
             if (method == "POST") {
                    var entitySearchObj = search.create({
                        type: "entity",
                        filters:
                        [
                           ["custentity5","is",IdTrackeo]
                        ],
                        columns:
                        [
                           search.createColumn({
                              name: "entityid",
                              sort: search.Sort.ASC,
                              label: "ID"
                           }),
                           search.createColumn({name: "altname", label: "Name"}),
                           search.createColumn({name: "custentity_sdb_montootorgado", label: "Monto Otorgado"}),
                           search.createColumn({name: "custentity_sdv_comentarios", label: "Comentartios"})
                     
                        ]
                     });
                     var searchResultCount = entitySearchObj.runPaged().count;
                     log.debug("entitySearchObj result count",searchResultCount);
                     var monto="0"
                     entitySearchObj.run().each(function(result){
                        monto=result.getValue("custentity_sdb_montootorgado")
                        // .run().each has a limit of 4,000 results
                        return true;
                     });
                     if (searchResultCount == 1) {
                         log.debug('sin result', "sin result");
                         Response.status = "Success";
                         Response.Monto= monto
                         Response.code = "200"    
                     }else{
                        Response = {
                            status: "ERROR",
                            code: "200",
                            message: " Id traker no encontrado",
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
