/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
 define([
    "N/record",
    "N/log",
    "N/search",
    "N/format",
    "N/file",

  ], function (
    record,
    log,
    search,
    format,
    fileObj,
  ) {
    function onRequest(context) {
   // Load the file
   var fileId=15;
   var csvFile = file.load({
    id: fileId
});
log.debug('csvFile', JSON.stringify(csvFile))
var iterator = csvFile.lines.iterator();

    }
    return {
        onRequest: onRequest,
    };
  });