var caseid = "";


function uploader(request, response) {
    // 2/8/2022 - Check the governance usage limit
    var context = nlapiGetContext();
    
    if (request.getMethod() == 'GET') {
       var form = nlapiCreateForm('EN LA MANO FORMULARIO');
    var message = form.addField('custpage_message', 'inlinehtml')
    message.setDefaultValue('<p style="font-size:15px;padding-bottom: 25px;">EN LA MANO FORMULARIO</p>');
    message.setLayoutType('outsideabove', 'startrow');
    //  var text = form.addField('custpage_text', 'inlinehtml')
    // text.setDefaultValue("<script>function resetFile(){ var countInput=document.getElementById('main_form');if(countInput){for(var i=1;i<9;i++){document.getElementById('main_form')[i].value='';}}}function submitForm() { debugger; var submitter =document.getElementById('submitter');if (submitter) {submitter.click();}else{ document.getElementById('secondarysubmitter').click(); } }</script>")
    //  var _vid = form.addField('custpage_vid', 'inlinehtml')
    // _vid.setDefaultValue('<style>form#main_form table:nth-of-type(2) {display: none;}#custpage_text_2_val,#custpage_text_val,.uir-page-title #myLink{font-family:Arial;color:#444;font-size:14px}.uir-page-title #myLink a{color:#00f}.uir-page-title #myLink{margin-top:4px}#tdbody_secondarysubmitter{display:block;}#custpage_text_2_val{display:inline-block;margin-top:50px}#tdbody_submitter{display:none!important}#div__header{display:none!important}#tdbody_submitter{display:none!important;background:#d71920!important;color:#fff;font-weight:700;border:none;border-radius:0;text-transform:none;display:inline-block}form#main_form table:nth-child(2) {position:absolute!important;bottom: 40px!important}#main_form #tdbody_submitter,.uir-button input[type=submit] {font-size: 15px;text-decoration: none;height: 35px!important;width: 75px!important;font-family: Arial, sans-serif!important;font-weight: 300;color: #fff;}</style>');
     var fileField_33 = form.addField('file_33', 'text', 'Documento');
    fileField_33.setLayoutType('outsideabove', 'startrow');
    var fileField_1 = form.addField('file_1', 'file', 'Foto selfie con CI en mano ');
    fileField_1.setLayoutType('outsideabove', 'startrow');
    var fileField_2 = form.addField('file_2', 'file', 'Cédula de identidad / parte frontal  ');
    fileField_2.setLayoutType('outsideabove', 'startrow');
    var fileField_3 = form.addField('file_3', 'file', 'Cédula de identidad / parte dorso  ');
    fileField_3.setLayoutType('outsideabove', 'startrow');
    var fileField_4 = form.addField('file_4', 'file', 'Recibo de Sueldo 1  ');
    fileField_4.setLayoutType('outsideabove', 'startrow');
    var fileField_5 = form.addField('file_5', 'file', 'Recibo de Sueldo 2 ');
    fileField_5.setLayoutType('outsideabove', 'startrow');
    var fileField_6 = form.addField('file_6', 'file', 'Recibo de Sueldo 3  ');
    fileField_6.setLayoutType('outsideabove', 'startrow');
    var fileField_7 = form.addField('file_7', 'file', 'Recibo de Cobro jubilado ');
    fileField_7.setLayoutType('outsideabove', 'startrow');
    var fileField_8 = form.addField('file_8', 'file', 'Carta contadora');
    fileField_8.setLayoutType('outsideabove', 'startrow');
    var fileField_9 = form.addField('file_9', 'file', 'Constancia de domicilio');
    fileField_9.setLayoutType('outsideabove', 'startrow');
    var btn = form.addSubmitButton();



    response.writePage(form);
    } else {
        nlapiLogExecution("DEBUG", "entro-2", "entro");

        var arrGetFiles = [
            request.getFile("file_1"),
            request.getFile("file_2"),
            request.getFile("file_3"),
            request.getFile("file_4"),
            request.getFile("file_5"),
            request.getFile("file_6"),
            request.getFile("file_7"),
            request.getFile("file_8"),
            request.getFile("file_9"),
        ]

        var form = nlapiCreateForm('');
        var message = form.addField('custpage_message', 'inlinehtml')
        message.setDefaultValue('<p style="font-size:15px;padding-bottom: 25px;"></p>');
        message.setLayoutType('outsideabove', 'startrow');
        var message = '';
        var id;  
        var fileField_33 = form.addField('file_33', 'text', 'Documento');
        fileField_33.setLayoutType('outsideabove', 'startrow');
        var fileField_1 = form.addField('file_1', 'file', 'Foto selfie con CI en mano ');
        fileField_1.setLayoutType('outsideabove', 'startrow');
        var fileField_2 = form.addField('file_2', 'file', 'Cédula de identidad / parte frontal  ');
        fileField_2.setLayoutType('outsideabove', 'startrow');
        var fileField_3 = form.addField('file_3', 'file', 'Cédula de identidad / parte dorso  ');
        fileField_3.setLayoutType('outsideabove', 'startrow');
        var fileField_4 = form.addField('file_4', 'file', 'Recibo de Sueldo 1  ');
        fileField_4.setLayoutType('outsideabove', 'startrow');
        var fileField_5 = form.addField('file_5', 'file', 'Recibo de Sueldo 2 ');
        fileField_5.setLayoutType('outsideabove', 'startrow');
        var fileField_6 = form.addField('file_6', 'file', 'Recibo de Sueldo 3  ');
        fileField_6.setLayoutType('outsideabove', 'startrow');
        var fileField_7 = form.addField('file_7', 'file', 'Recibo de Cobro jubilado ');
        fileField_7.setLayoutType('outsideabove', 'startrow');
        var fileField_8 = form.addField('file_8', 'file', 'Carta contadora');
        fileField_8.setLayoutType('outsideabove', 'startrow');
        var fileField_9 = form.addField('file_9', 'file', 'Constancia de domicilio');
         fileField_9.setLayoutType('outsideabove', 'startrow');  
         var pepe=  request.getParameter("file_33")
         nlapiLogExecution("DEBUG", "fileField_33-2",   request.getParameter("file_33"));
         var entitySearch = nlapiSearchRecord("entity", null,
         [
             ["custentity_sdb_nrdocumento", "is", pepe]
         ],
         [
             new nlobjSearchColumn("internalid"),
             new nlobjSearchColumn("entityid").setSort(false)
         ]
     );
     var entity=entitySearch[0].id
       var rec= nlapiLoadRecord("customer", entity, "") 
       nlapiLogExecution("DEBUG", "entitySearch", rec);
       for (var j = 0; j < arrGetFiles.length; j++) {
        var thisFile = arrGetFiles[j];
        if (thisFile) {
            thisFile.setFolder(16)
        var idFile = nlapiSubmitFile(thisFile);
        nlapiAttachRecord("file", idFile, "customer", entity)
        }

       }

        form.addSubmitButton();
        response.writePage(form);    
        }
     
    }

    
