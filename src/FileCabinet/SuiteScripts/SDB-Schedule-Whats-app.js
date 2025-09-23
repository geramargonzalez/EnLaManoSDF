/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 */
 define(['N/https', 'N/search', 'N/record', 'N/task', 'N/runtime'],
 function (https, search, record, task, runtime) {
     function execute(context) {
        var rechazo = {1 : "mala_calificacion_en_bcu", 2: "incumplimientos_con_financiera",3:"perfil_credicticio",4:"extranjero",5:"edad",6:"antiguedad_laboral"};
        var headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOThjMWU2N2M3NGE0ZWMwYTc5N2VmMGYyZjJjYTkyN2Y3ZmE3MmEyNzZkMzc2ODQzOWQ1YmE5YWZkZGMxZjg4Mzc5YTM2NDI5MzYxMWRhOGEiLCJpYXQiOjE2NTUzMTg1NTcuODUyOTc3LCJuYmYiOjE2NTUzMTg1NTcuODUyOTc5LCJleHAiOjE2ODY4NTQ1NTcuODUxMDcyLCJzdWIiOiI0OTAxIiwic2NvcGVzIjpbXX0.kppM1_skWhAxpreCBcDM2yb-aA3X0cD5VsRvnyajyXq63qakPt2jhfvbcz94t9bHgUcs6a1YKAnN9BpNOZ6iAlGHPrw9zu5_vAZBWaU67zXXAZLgaJLF5H1tCVPY6iWcBnrXA0HJy83-1mtyGM8Ii7IOkJEWTG-2h5dgMKoR1kycfCwcQIDSFPgQZbxzfUgUTTiDdX4UgL8uPk3G-m2CY062-OHuniNAWMop_rH_w72IWKQDjCKl7oa4RwSmnBdMhsBq7gXeiuXrubnxIB5Du9ZDCx9fHnUKHVDd6VhqYeitSt9XEHatXGlru0XAtUHGUBpZMrZBBQTG1VP9npV8a839b5CQvzmPy6mo4-3171VjR5wJtozjMwdhQZF32ejBo1kO5Lzn7luWeMP9TTM5IV2hNL7N3GoU-3brU63n6XZ2ruP4P-cC8noTvSKXzAH5r-MgwCEMMd2OuSFNDhFq1VeEskD_y8RLZ96PNflUJ1BdKs40euzb_8J_8fDscwBzljgLgQL5KHvxHA_gwmr6I-x09PjKtFjOYofi9g8r2xM-0iJ9GjjjQGF_RSIunkioWcicasHoiW8iPJkWm1tEC1T6ocg-lTY8UMeS8XlrGyePtDMNsc59lOeEeA6iEiiQedBrhOaN3xeY0f3SaJzOx20DLqjuNjtEPjbnSf642a0"
        }
        search.create({
            type: "lead",
            filters:["custentitycustentity_sdb_pendienteretiro","is",true],
            columns: ["mobilephone"]
          }).run().each(function(result){
            if (result.getValue('mobilephone')) {
                var body = {"message": 'pendiente_de_retiro', "tel": result.getValue('mobilephone') }
                
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
               
            }
            return true;
          });

          search.create({
            type: "lead",
            filters:["custentitycustentity_sdb_ofertapend","is",true],
            columns: ["mobilephone"]
          }).run().each(function(result){
            if (result.getValue('mobilephone')) {
                var body = {"message": 'oferta_pendiente_de_respuesta', "tel": result.getValue('mobilephone') }
                
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
               
            }
            return true;
          });

          search.create({
            type: "lead",
            filters:["custentity_sdb_documentacion_incompleta","is",true],
            columns: ["mobilephone"]
          }).run().each(function(result){
            if (result.getValue('mobilephone')) {
                var body = {"message": 'documentacion_incompleta', "tel": result.getValue('mobilephone') }
                
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
               
            }
            return true;
          });

          search.create({
            type: "lead",
            filters:["custentity_sdb_pendinete_de_doc_para_ini","is",true],
            columns: ["mobilephone"]
          }).run().each(function(result){
            if (result.getValue('mobilephone')) {
                var body = {"message": 'pendiente_doc_aprobacion', "tel": result.getValue('mobilephone') }
                
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
               
            }
            return true;
          });

          search.create({
            type: "lead",
            filters:["custentitycustentity_sdb_ofertapend","is",true],
            columns: ["mobilephone","custentity_sdb_montootorgado","altname"]
          }).run().each(function(result){
            if (result.getValue('mobilephone')) {
                var body = {"message": 'pendiente_de_respuesta_nueva', "tel": result.getValue('mobilephone'),"customerName": result.getValue('altname'), "oferta":result.getValue('custentity_sdb_montootorgado')}
                log.debug("Body pendiente_de_respuesta_nueva: ",body);
                var objResponse = https.post({
                    body: JSON.stringify(body),
                    url: "https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=20&deploy=1&compid=7564430&h=3dd770853f685636f249",
                    headers: headers
                });
               
            }
            return true;
          });
          
     }

     return {
         execute: execute
     };
 });