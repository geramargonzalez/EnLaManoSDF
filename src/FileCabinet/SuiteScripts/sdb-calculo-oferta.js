/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/log', 'N/search', 'N/runtime', 'N/record'], function (log, search, runtime, record) {

    function onAction(scriptContext) {

        var newRecord = scriptContext.newRecord;
        var valorCuota = newRecord.getValue("custentity_sdb_valor_cuota");
        var cuotas = newRecord.getText("custentity_sdb_cuotas");
        var monto = newRecord.getValue("custentity_sdb_montosolicitado");
        var producto = newRecord.getValue("custentity6");
        var tasaFinal = 0;
        var fechaPago = newRecord.getValue("custentity8");
        log.debug("monto",monto)
  
        if(fechaPago){
        var fechaPagoday = fechaPago.getDate()
        var fechaPagomonth = fechaPago.getMonth()
        var fechaPagoyear = fechaPago.getFullYear()
        var fechaPagoday=fechaPagoday+"/"+fechaPagomonth+"/"+fechaPagoyear;
        var date = new Date()
        var day = date.getDate()
        var month = date.getMonth()
        var year = date.getFullYear()
        var presentday=day+"/"+month+"/"+year;
        var diasRecargo =restaFechas(presentday,fechaPagoday);
        }

        var customrecord_productoSearchObj = search.create({
            type: "customrecord_producto",
            filters:
                [
                    ["internalidnumber", "equalto", producto]
                ],
            columns:
                [
                    search.createColumn({ name: "custrecord_tasa_1", label: "Tasa 1 "  }),
                    search.createColumn({ name: "custrecord_tasa_2", label: "Tasa 2"   }),
                    search.createColumn({ name: "custrecord_tasa_3", label: "Tasa 3 "  }),
                    search.createColumn({ name: "custrecord_tasa_4", label: "Tasa 4"   }),
                    search.createColumn({ name: "custrecord_monto_1", label: "Monto 1" }),
                    search.createColumn({ name: "custrecord_monto_2", label: "Monto 2" }),
                    search.createColumn({ name: "custrecord_monto_3", label: "Monto 3" }),
                    search.createColumn({ name: "custrecord_monto_4", label: "Monto 4" }),
                    search.createColumn({ name: "custrecord_plazo_1", label: "Plazo 1" }),
                    search.createColumn({ name: "custrecord_plazo_2", label: "Plazo 2" }),
                    search.createColumn({ name: "custrecord_plazo_3", label: "Plazo 3" }),
                    search.createColumn({ name: "custrecord_plazo_4", label: "Plazo 4" }),
                ]
        });
log.debug("customrecord_productoSearchObj",customrecord_productoSearchObj)
        var searchResultCount = customrecord_productoSearchObj.runPaged().count;
        log.debug("searchResultCount---",searchResultCount)
        customrecord_productoSearchObj.run().each(function (result) {
           log.debug("cuotas",cuotas) 
           log.debug("result",result) 
           
            var tasa1 = result.getValue('custrecord_tasa_1');
            // if(!tasa1||tasa1=="")tasa1=0
            log.debug("tasa1",tasa1)
            var tasa2 = result.getValue('custrecord_tasa_2');
            // if(!tasa2 ||tasa2=="") tasa2=0
            log.debug("tasa2",tasa2)
            var tasa3 = result.getValue('custrecord_tasa_3');
            // if(!tasa3||tasa3=="")tasa3=0
            log.debug("tasa3",tasa3)
            var tasa4 = result.getValue('custrecord_tasa_4');
            // if(!tasa4||tasa4=="")tasa4=0
            log.debug("tasa4",tasa4)
            var monto1 = result.getValue('custrecord_monto_1');
            // if(!monto1||monto1=="")monto1=0
            log.debug("monto1",monto1)
            var monto2 = result.getValue('custrecord_monto_2');
            // if(!monto2||monto2=="")monto2=0
            log.debug("monto2",monto2)
            var monto3 = result.getValue('custrecord_monto_3');
            // if(!monto3||monto3=="")monto3=0
            log.debug("monto3",monto3)
            var monto4 = result.getValue('custrecord_monto_4');
            // if(!monto4||monto4=="")monto4=0
            log.debug("monto4",monto4)
            var plazo1 = result.getText('custrecord_plazo_1');
            // if(!plazo1||plazo1=="")plazo1=0
            log.debug("plazo1",plazo1)
            var plazo2 = result.getText('custrecord_plazo_2');
            // if(!plazo2||plazo2)plazo2=0
            log.debug("plazo2",plazo2)
            var plazo3 = result.getText('custrecord_plazo_3');
            // if(!plazo3||plazo3=="")plazo3=0
            log.debug("plazo3",plazo3)
            var plazo4 = result.getText('custrecord_plazo_4');
            // if(!plazo4||plazo4=="")plazo4=0
            log.debug("plazo4",plazo4)
             cuotas = Number(cuotas)
             plazo1 = Number(plazo1)
             plazo2 = Number(plazo2)
             plazo3 = Number(plazo3)
             plazo4 = Number(plazo4)


             monto = Number(monto)
             monto2 = Number(monto2)
             monto3 = Number(monto3)
             monto4 = Number(monto4)
             monto1 = Number(monto1)

             log.debug("monto",monto)
             log.debug("monto1",monto1)
             log.debug("cuotas",cuotas)
             log.debug("plazo1",plazo1)

             log.debug("monto <= monto3  ",monto <= monto3 )
             log.debug("monto >= monto2",monto >= monto2 )
             log.debug("monto >= monto2",cuotas <= plazo3 )
            if (monto <= monto1 && cuotas <= plazo1 ) { tasaFinal = tasa1 }log.debug("test","test")
            if (monto <= monto2 && cuotas <= plazo2 && cuotas >= plazo1 ) { tasaFinal = tasa2 }
            if (monto <= monto3   && monto >= monto2  && cuotas <= plazo3) { tasaFinal = tasa3 }
            if (monto <= monto4   && monto >= monto2 && cuotas <= plazo4  && cuotas >= plazo3  ) { tasaFinal = tasa4 }
            log.debug("termino el each","terminoel each") 
            log.debug("tasaFinal", tasaFinal)
            log.debug("monto", monto)

            return true;
        });

        if (valorCuota && cuotas && monto) {

            // calculo de cuota x mes
            var ui = search.lookupFields({
                type: 'customrecord_sdb_ui',
                id: 1,
                columns: ['custrecord_ui_valor']
            });
            ui = ui.custrecord_ui_valor
            var gastototal = 0;
            tasaFinal = tasaFinal / 100 + 1
            var gabasico = ui * 8;
            var gaTope = ui * 120;
            var gaDesembolso = 40 * ui / cuotas;
            var gastosSumados = (gaDesembolso * cuotas) + (gabasico * cuotas)
            if (gastosSumados > gaTope) {
                gastototal = gaTope
            }
            else {
                gastototal = gastosSumados
            }
            gastototal = gastototal / cuotas;
            var gaIva = gastototal * 0.22;
            gastototal = gastototal + gaIva;
            var tasamensual = ((Math.pow(tasaFinal, 1 / 12)) - 1) * 1.22
            var tasadiaria = ((Math.pow(tasaFinal, 1 / 360)) - 1) * 1.22
            if(fechaPago){
               diasRecargo=diasRecargo *tasadiaria
               tasamensual=tasamensual+diasRecargo
               log.debug("tasamensual", tasamensual)
            }
            var interes = monto * tasamensual;
            var ptm = tasamensual * monto * Math.pow((1 + tasamensual), cuotas) / -(1 - Math.pow((1 + tasamensual), cuotas));
            var amortizacion = ptm - interes;
            var seguro = monto * 6 / 1000;
         
            var saldoInicial = monto 
            var calculosegurototal = 0;
            var count = cuotas;
            var iteresTotalSionIba=0;
            var saldoInicial2 = monto 
   
            for (var x = 0; x < count ; x++) {
             var interesFor2 = saldoInicial2 * tasamensual;
                iteresTotalSionIba=iteresTotalSionIba+interesFor2
                interesFor2 = ptm -interesFor2 ;
                interesFor2=saldoInicial2-interesFor2;
                saldoInicial2=interesFor2
                calculoFor = interesFor * 6 / 1000;
   
            }
            iteresTotalSionIba=iteresTotalSionIba/1.22
       
            for (var x = 0; x < count -1; x++) {
              var  interesFor = saldoInicial * tasamensual;               
                interesFor = ptm -interesFor ;
                interesFor=saldoInicial-interesFor;
                saldoInicial=interesFor
                calculoFor = interesFor * 6 / 1000;
                calculosegurototal = calculosegurototal+calculoFor
                // log.debug("calculosegurototal+", calculosegurototal)
            }
               calculosegurototal=calculosegurototal+seguro
               var seguroXcuota = calculosegurototal / cuotas;

            var cuota = amortizacion + gastototal + seguroXcuota + interes;
            cuota=cuota.toFixed(2)
            var mensaje1 = "Ese monto no esta diponible o la cantidad de Cuotas y valor de cuota";
            var mesaje2 = "test"
            var ibatotalTabal=((gastototal*cuotas)*.22)+(iteresTotalSionIba*.22);
            var totalCuotas= cuota*cuotas;
            //tabla de oferta
            var tabla = "<TABLE BORDER>";
            tabla += "<TR><TH>Monto solicitado</TH><TH>Cuotas</TH><TH>Valor Cuota</TH><TH>Valor Seguro total </TH><TH>interés total </TH><TH>gastos administrativos </TH><TH>iva total</TH><TH>total</TH>";
            tabla += "</TR><TR ><TD> " + monto + "</TD><TD>";
            tabla += cuotas + "</TD> <TD>"+cuota+"</TD><TD>"+(calculosegurototal).toFixed(2)+"</TD><TD>"+(iteresTotalSionIba).toFixed(2)+"</TD><TD>"+(gastototal*cuotas).toFixed(2)+"</TD><TD>"+ibatotalTabal.toFixed(2)+"</TD><TD>"+totalCuotas.toFixed(2)+"</TD></TR><TR>";
            tabla += "</TR>";
            tabla += "</TABLE>";
            if (cuotas < 37 && monto / cuotas < valorCuota) {
                newRecord.setValue({
                    fieldId: 'custentity_sdb_calculo_prestamo',
                    value: tabla,
                });
            } else {
                newRecord.setValue({
                    fieldId: 'custentity_sdb_calculo_prestamo',
                    value: mensaje1,
                });
            }
        }
        else {
            newRecord.setValue({
                fieldId: 'custentity_sdb_calculo_prestamo',
                value: "Por favor llenar los campos de Monto Solicitado y Cuotas ",
            });
        }
        function restaFechas(f1,f2)
            {
            var aFecha1 = f1.split('/');
            var aFecha2 = f2.split('/');
            var fFecha1 = Date.UTC(aFecha1[2],aFecha1[1]-1,aFecha1[0]);
            var fFecha2 = Date.UTC(aFecha2[2],aFecha2[1]-1,aFecha2[0]);
            var dif = fFecha2 - fFecha1;
            var dias = Math.floor(dif / (1000 * 60 * 60 * 24));
            return dias;
            }
    }
    return {
        onAction: onAction
    }
});