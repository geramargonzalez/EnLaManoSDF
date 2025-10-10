/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/log', 'N/http', 'N/file', 'N/search'], function (log, http, file, search) {

    function onAction(scriptContext) {
        log.debug({
            title: 'Start Script'
        });
        var newRecord = scriptContext.newRecord;

        var ci = newRecord.getValue("custentity_sdb_nrdocumento");
        var contratoCodigo = newRecord.getValue("custentity_sdb_contrato_codigo");

        var string = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cred="Creditos">';
        string += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cred="Creditos">';
        string += '<soapenv:Header/><soapenv:Body><cred:WSObtenerPrestamoPDF.Execute>';
        string += '<cred:Contratocodigo>'+ contratoCodigo + '</cred:Contratocodigo>'
        string += '</cred:WSObtenerPrestamoPDF.Execute></soapenv:Body></soapenv:Envelope>';
        var headerObj = {
            "Content-Type": "text/plain",
            "Cookie": "ASP.NET_SessionId=ly0cehfeqvhxa5mmi2er42nj"
        };

        var response = http.post({
            url: 'http://200.125.41.106:444/CreditosTesting/awsobtenerprestamopdf.aspx?wsdl',
            body: string,
            headers: headerObj
        });
        var stringpdf = response.body
        stringpdf = stringpdf.split('<Pdfbase64file xmlns="Creditos">')
        stringpdf = stringpdf[1].split('</Pdfbase64file>')
        stringpdf = stringpdf[0]
        var marchaFile = createAndAttachFile(stringpdf, newRecord)

    }
    function createAndAttachFile(pdfContents, currentRecord) {
        try {

            var fileObj = {
                name: "Marcha " + currentRecord.getValue("id"),
                fileType: file.Type.PDF,
                contents: pdfContents,
                folder: 9
            }
            log.debug("fileObj", fileObj)

            var docPDF = file.create(fileObj);
            log.debug("fileObj", fileObj)
            var docPDFId = docPDF.save();
            currentRecord.setValue({
                fieldId: 'custentity_sdb_marcha',
                value: docPDFId
            });
            var docURL = search.lookupFields({
                type: "file",
                id: docPDFId,
                columns: ['url']
            })["url"];
            return docURL;
        } catch (e) {
            log.error("error in create log file", e)
        }
    }

    return {
        onAction: onAction
    }
});