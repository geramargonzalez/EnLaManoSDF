/**
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
 define(['N/https', 'N/runtime'],
 function (https, runtime) {


     function onRequest(context) {
         try {
             var request = context.request
             log.debug("context: ", context)
             log.debug("body: ", request.body)
            var data = request.body;
            data = JSON.parse(data);
            var documento=data.documento
            var tipoD=data.tipoDocumento
             var headers = {
                 "Content-Type": "application/json",
                 "Authorization": "Basic cHJvZDNfZW5sbTplbmxtOTg5Nw=="
             }
             var urlRequest = "https://ws-azure.enlamano.com.uy/api/models/v2/enlamanocrm/execute";
             var body = {"Documento":documento,"TipoDocumento":tipoD}
             var objResponse = https.post({
                 body: JSON.stringify(body),
                 url: urlRequest,
                 headers: headers
             });
             log.debug("objResponse: ", objResponse);
             context.response.write(JSON.parse(objResponse.body).datosBcu);
         } catch (err) {

         }
     }

     return {
         onRequest: onRequest
     }
 })
