/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/record', 'N/https'], function (record, https) {
    function beforeLoad(context) {

    }
    function beforeSubmit(context) {

    }
    function afterSubmit(context) {
        var months = {};
        months[0] = "Enero"
        months[1] = "Febrero"
        months[2] = "Marzo"
        months[3] = "Abril"
        months[4] = "Mayo"
        months[5] = "Junio"
        months[6] = "Julio"
        months[7] = "Agosto"
        months[8] = "Septiembre"
        months[9] = "Octubre"
        months[10] = "Noviembre"
        months[11] = "Diciembre"
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;
        var rechazo = {1 : "mala_calificacion_en_bcu", 2: "incumplimientos_con_financiera",3:"perfil_credicticio",4:"extranjero",5:"edad",6:"antiguedad_laboral"};

        var headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOThjMWU2N2M3NGE0ZWMwYTc5N2VmMGYyZjJjYTkyN2Y3ZmE3MmEyNzZkMzc2ODQzOWQ1YmE5YWZkZGMxZjg4Mzc5YTM2NDI5MzYxMWRhOGEiLCJpYXQiOjE2NTUzMTg1NTcuODUyOTc3LCJuYmYiOjE2NTUzMTg1NTcuODUyOTc5LCJleHAiOjE2ODY4NTQ1NTcuODUxMDcyLCJzdWIiOiI0OTAxIiwic2NvcGVzIjpbXX0.kppM1_skWhAxpreCBcDM2yb-aA3X0cD5VsRvnyajyXq63qakPt2jhfvbcz94t9bHgUcs6a1YKAnN9BpNOZ6iAlGHPrw9zu5_vAZBWaU67zXXAZLgaJLF5H1tCVPY6iWcBnrXA0HJy83-1mtyGM8Ii7IOkJEWTG-2h5dgMKoR1kycfCwcQIDSFPgQZbxzfUgUTTiDdX4UgL8uPk3G-m2CY062-OHuniNAWMop_rH_w72IWKQDjCKl7oa4RwSmnBdMhsBq7gXeiuXrubnxIB5Du9ZDCx9fHnUKHVDd6VhqYeitSt9XEHatXGlru0XAtUHGUBpZMrZBBQTG1VP9npV8a839b5CQvzmPy6mo4-3171VjR5wJtozjMwdhQZF32ejBo1kO5Lzn7luWeMP9TTM5IV2hNL7N3GoU-3brU63n6XZ2ruP4P-cC8noTvSKXzAH5r-MgwCEMMd2OuSFNDhFq1VeEskD_y8RLZ96PNflUJ1BdKs40euzb_8J_8fDscwBzljgLgQL5KHvxHA_gwmr6I-x09PjKtFjOYofi9g8r2xM-0iJ9GjjjQGF_RSIunkioWcicasHoiW8iPJkWm1tEC1T6ocg-lTY8UMeS8XlrGyePtDMNsc59lOeEeA6iEiiQedBrhOaN3xeY0f3SaJzOx20DLqjuNjtEPjbnSf642a0"
        }
        if (newRecord.getValue('custentity_sdb_montoofrecido') != '' && oldRecord.getValue('custentity_sdb_montoofrecido') == '') {
            if (newRecord.getValue('mobilephone')) {
                var body = { "bienvenida": true, "message": newRecord.getValue('custentity_sdb_montoofrecido'), "tel": newRecord.getValue('mobilephone') }
                
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
                log.debug("objResponse: ", objResponse)
            }
        }else if (newRecord.getValue('custentity_sdb_razon_rechazo')) {
            var body = {"message": rechazo[newRecord.getValue('custentity_sdb_razon_rechazo')], "tel": newRecord.getValue('mobilephone') }
            
            var objResponse = https.post({
                body: JSON.stringify(body),
                url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                headers: headers
            });
            log.debug("objResponse: ", objResponse)
        }else if (newRecord.getValue('custentitycustentity_sdb_prestamoaprob')) {
            var vale = formatMoney(newRecord.getValue('custentity_sdb_montootorgado'));
            var body = {"message": 'aprobado', "tel": newRecord.getValue('mobilephone'),"vale": "$" + vale,"fechaVencimiento": new Date(newRecord.getValue('custentity8')).getDate().toString(), "fechaMesInicio": months[new Date(newRecord.getValue('custentity8')).getMonth()+1]}
            log.debug("body: ",body)
            var objResponse = https.post({
                body: JSON.stringify(body),
                url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                headers: headers
            });
            log.debug("objResponse: ", objResponse)
        }
        
    }
   function formatMoney(number, decPlaces, decSep, thouSep) {
    decPlaces = isNaN(decPlaces = Math.abs(decPlaces)) ? 2 : decPlaces,
    decSep = typeof decSep === "undefined" ? "." : decSep;
    thouSep = typeof thouSep === "undefined" ? "," : thouSep;
    var sign = number < 0 ? "-" : "";
    var i = String(parseInt(number = Math.abs(Number(number) || 0).toFixed(decPlaces)));
    var j = (j = i.length) > 3 ? j % 3 : 0;

    return sign +
        (j ? i.substr(0, j) + thouSep : "") +
        i.substr(j).replace(/(\decSep{3})(?=\decSep)/g, "$1" + thouSep) +
        (decPlaces ? decSep + Math.abs(number - i).toFixed(decPlaces).slice(2) : "");
}
    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});