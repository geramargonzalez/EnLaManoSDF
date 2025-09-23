/**
 * 
 * Task                    Date                  Author                             
 *  Servicio Test          5 feb 2024           Oscar Lopez                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
*/
define(['N/search', "N/log", "N/https", 'N/ui/serverWidget', "N/record"], (search, log, https, serverWidget, record) => {
    function onRequest(context) {    

        try {
            var page = context.request.parameters["page"];
            log.debug('page', page);

            let method = context.request.method;
            if (method == "GET") {

                if (page != null && page == 'informacion') {
                    var form = serverWidget.createForm({ title : 'Al Prestamo Test - Ingreso de Informacion', hideNavBar: false });

                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' });
                    pageHTML.defaultValue = '<input name="page" value="informacion" type="hidden" />';
    
                    var prestador_codigo = form.addField({ id : 'custpage_prestador_codigo', type : serverWidget.FieldType.TEXT, label: 'Prestador Codigo' });
                    prestador_codigo.defaultValue = '4';

                    var prestador_sucursal = form.addField({ id : 'custpage_prestadorsucursal', type : serverWidget.FieldType.TEXT, label: 'Prestador Sucursal' });
                    prestador_sucursal.defaultValue = '1';

                    var prestador_usuario = form.addField({ id : 'custpage_prestadorusuario', type : serverWidget.FieldType.TEXT, label: 'Prestador Usuario' });
                    prestador_usuario.defaultValue = 'UsuarioALP';
                    
                    form.addField({ id : 'custpage_numerodocumento', type : serverWidget.FieldType.TEXT, label: 'Numero Documento' });
                    form.addField({ id : 'custpage_telefono', type : serverWidget.FieldType.TEXT, label: 'Telefono' });
                    form.addField({ id : 'custpage_nombre', type : serverWidget.FieldType.TEXT, label: 'Nombre' });
                    form.addField({ id : 'custpage_apellido', type : serverWidget.FieldType.TEXT, label: 'Apellido' });
                    form.addField({ id : 'custpage_salario', type : serverWidget.FieldType.TEXT, label: 'Salario' });
                    
                    form.addSubmitButton({ label : 'Submit' });

                    context.response.writePage(form);

                } else if (page != null && page == 'cedula') {

                    var form = serverWidget.createForm({ title : 'Al Prestamo - Validar Cedula', hideNavBar: false });

                    var cedula = form.addField({ id : 'custpage_cedula', type : serverWidget.FieldType.TEXT, label: 'Cedula' })

                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' })
                    pageHTML.defaultValue = '<input name="page" value="cedula" type="hidden" />';

                    form.addSubmitButton({ label : 'Submit' });

                    context.response.writePage(form);

                } else {
                    var form = serverWidget.createForm({ title : 'Al Prestamo - Seleccione una opcion', hideNavBar: false });

                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' });
                    pageHTML.defaultValue = 
                        '<H2><a href="https://7564430.app.netsuite.com/app/site/hosting/scriptlet.nl?script=32&deploy=1&page=cedula">Testear Cedula</a></H1><BR><BR>' +
                        '<H2><a href="https://7564430.app.netsuite.com/app/site/hosting/scriptlet.nl?script=32&deploy=1&page=informacion">Testear Informacion</a></H1><BR><BR>';
    
                    context.response.writePage(form);
                }

            } else {

                var page = context.request.parameters["page"]

                if (page == 'informacion') {
                    var jsonRequest = {};
                    jsonRequest.Prestadorcodigo = context.request.parameters["custpage_prestador_codigo"]
                    jsonRequest.Prestadorsucursal = context.request.parameters["custpage_prestadorsucursal"]
                    jsonRequest.Prestadorusuario = context.request.parameters["custpage_prestadorusuario"]
                    jsonRequest.Numerodocumento = context.request.parameters["custpage_numerodocumento"]
                    jsonRequest.telefono = context.request.parameters["custpage_telefono"]
                    jsonRequest.Nombre = context.request.parameters["custpage_nombre"]
                    jsonRequest.Apellido = context.request.parameters["custpage_apellido"]
                    jsonRequest.Salario = context.request.parameters["custpage_salario"]

                    log.debug('jsonRequest.dni', jsonRequest);

                    var headerObj = {
                        name: 'Accept-Language',
                        value: 'en-us'
                    };
                    var response = https.post({
                        url: 'https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=9&deploy=1&compid=7564430&h=7a4bcd285f5bbb90139b',
                        body: JSON.stringify(jsonRequest),
                        headers: headerObj
                    });

                    var form = serverWidget.createForm({ title : 'Al Prestamo Test - Ingreso de Informacion', hideNavBar: false });

                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' });

                    if (response.code == 200) {
                        pageHTML.defaultValue = '<H2>OK</H2>';

                    } else {
                        pageHTML.defaultValue = '<H2>ERROR !!!</H2>';

                    }
    
                    context.response.writePage(form);


                } else if (page == 'cedula') {
                    var jsonRequest = {};
                    jsonRequest.dni = context.request.parameters["custpage_cedula"];

                    log.debug('jsonRequest.dni', jsonRequest);

                    var headerObj = {
                        name: 'Accept-Language',
                        value: 'en-us'
                    };
                    var response = https.post({
                        url: 'https://7564430.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=8&deploy=1&compid=7564430&h=56c69ad840c607c7e6fc',
                        body: JSON.stringify(jsonRequest),
                        headers: headerObj
                    });
    
                    var form = serverWidget.createForm({ title : 'Al Prestamo - Validar Cedula', hideNavBar: false });
                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' });
                    pageHTML.defaultValue = '<H1>'+response.body+'</H1>';
    
                    context.response.writePage(form);

                } else {
                    var pageHTML = form.addField({ id : 'custpage_page', type : serverWidget.FieldType.INLINEHTML, label: ' ' });
                    pageHTML.defaultValue = '<H1>Opcion no valida</H1>';
                    context.response.writePage(form);

                }
                
           

            }

        } catch (E) {
            log.error('request', E);
        }
    }

    return {
        onRequest
    }

});