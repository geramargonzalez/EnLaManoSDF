/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/currentRecord'], function (currentRecord) {

    function pageInit(context) {
        // No-op: requerido para que NetSuite reconozca el ClientScript como entry point.
    }

    function setActionAndSubmit(action) {
        const rec = currentRecord.get();
        try {
            rec.setValue({ fieldId: 'custpage_action', value: action });
        } catch (e) {
            // ignore
        }
        document.forms[0].submit();
    }

    function elmExportCsv() {
        setActionAndSubmit('export_csv');
    }

    function elmExportExcel() {
        setActionAndSubmit('export_excel');
    }

    function elmSendEmail() {
        setActionAndSubmit('send_email');
    }

    return {
        pageInit: pageInit,
        elmExportCsv: elmExportCsv,
        elmExportExcel: elmExportExcel,
        elmSendEmail: elmSendEmail
    };
});
