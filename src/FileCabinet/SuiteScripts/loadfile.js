/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
 define(['N/record', 'N/log', 'N/search', 'N/format', 'N/email','N/file', 'N/http', 'N/render', 'N/runtime','N/compress'], 

 function (record, log, search, format, email, file, http, render, runtime,compress) {
    function onRequest(context) {
   var fileId=19;
   var csvFile = file.load({
    id: fileId
});
var unzip = compress.gunzip({
    file: csvFile
});


// log.debug('archiver', JSON.stringify(archiver))
log.debug('archiver',unzip.getContents())

}
    return {
        onRequest: onRequest,
    };
  });
  