/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/log', 'N/http', 'N/record', 'N/format'], function (log, http, record, format) {

    const CODIGOS_PRODUCTO = {
        1: 8,
        2: 36,
        3: 28,
        4: 33,
        5: 17,
        6: 32
    }

    function onAction(scriptContext) {
        try {
            log.debug({
                title: 'Start Script'
            });
            var newRecord = scriptContext.newRecord;
            log.debug("newRecord", scriptContext.newRecord);
            newRecord.setValue({
                fieldId: 'custentity_sdb_check_data',
                value: true
            });
            var ci = newRecord.getValue("custentity_sdb_nrdocumento");
            var primerNombre = newRecord.getValue("firstname");
            var apellido = newRecord.getValue("lastname");
            var cel = newRecord.getValue("mobilephone");
            var email = newRecord.getValue("email");
            var phone = newRecord.getValue("phone");
            var homephone = newRecord.getValue("homephone");
            var direcion = newRecord.getValue("defaultaddress");
            var dicTrabajo = newRecord.getValue("custentity_sdb_infolab_direccion");
            var cargo = newRecord.getValue("custentity_sdb_infocustentity_sdb_infolab_cargolab_direccion");
            var importeIngresos = newRecord.getValue("homecustentity_sdb_infolab_importephone");
            var sexo = newRecord.getValue("custentity_sdb_personasexo");

            var address = newRecord.getCurrentSublistSubrecord({
                sublistId: 'addressbook',
                fieldId: 'addressbookaddress'
            });

            log.debug("cel", cel)
            log.debug("phone", phone)
            log.debug("ci", ci)
            log.debug("email", email)
            log.debug("homephone", homephone)
            log.debug("dicTrabajo", dicTrabajo)
            log.debug("importeIngresos", importeIngresos)


            var string = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cred="Creditos">';
            string += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cred="Creditos">';
            string += '<soapenv:Header/><soapenv:Body><cred:WSCrearCliente.Execute><cred:Sdtdatoscliente>';
            string += '<cred:DocumentoPais>UY</cred:DocumentoPais>';
            string += '<cred:DocumentoTipo>CI</cred:DocumentoTipo>';
            string += '<cred:DocumentoNumero>' + ci + '</cred:DocumentoNumero>';
            string += '<cred:DocumentoVencimiento>20300512</cred:DocumentoVencimiento>';
            string += '<cred:ClienteNombre1>' + primerNombre + '</cred:ClienteNombre1>';
            string += '<cred:ClienteNombre2>?</cred:ClienteNombre2>';
            string += '<cred:ClienteApellido1>' + apellido + '</cred:ClienteApellido1>';
            string += '<cred:ClienteApellido2>?</cred:ClienteApellido2>';
            string += '<cred:ClienteTelefono1>?</cred:ClienteTelefono1>';
            string += '<cred:ClienteTelefono2>?</cred:ClienteTelefono2>';
            string += '<cred:ClienteMovil1>' + cel + '</cred:ClienteMovil1>';
            string += '<cred:ClienteMovil2></cred:ClienteMovil2>';
            string += '<cred:ClienteMail1>' + email + '</cred:ClienteMail1>';
            string += '<cred:ClienteMail2></cred:ClienteMail2>';
            string += '<cred:ClienteFechaNacimiento>19630602</cred:ClienteFechaNacimiento>';
            string += '<cred:ClienteEstadoCivil>1</cred:ClienteEstadoCivil>';
            string += '<cred:ClienteSexo> ?</cred:ClienteSexo>';
            string += '<cred:DireccionPais>UY</cred:DireccionPais>';
            string += '<cred:DireccionDepartamento>1</cred:DireccionDepartamento>';
            string += '<cred:DireccionCiudad>1</cred:DireccionCiudad>';
            string += '<cred:DireccionLocalidad>?</cred:DireccionLocalidad>';
            string += '<cred:DireccionCalle>?</cred:DireccionCalle>';
            string += '<cred:DireccionPuerta>?</cred:DireccionPuerta>';
            string += '<cred:DireccionApartamento></cred:DireccionApartamento>';
            string += '<cred:DireccionCodigoPostal>11100</cred:DireccionCodigoPostal>';
            string += '<cred:ClienteMonedaIngresos>1</cred:ClienteMonedaIngresos>';
            string += '<cred:ClienteImporteIngresos>?</cred:ClienteImporteIngresos>';
            string += '<cred:ClienteTrabajoLugar>?</cred:ClienteTrabajoLugar>';
            string += '<cred:ClienteTrabajoDireccion>?</cred:ClienteTrabajoDireccion>';
            string += '<cred:ClienteTrabajoCargo>?</cred:ClienteTrabajoCargo>';
            string += '</cred:Sdtdatoscliente></cred:WSCrearCliente.Execute></soapenv:Body></soapenv:Envelope>';
            var headerObj = {
                "Content-Type": "application/xml",
                "Cookie": "ASP.NET_SessionId=ly0cehfeqvhxa5mmi2er42nj"
            };

            var response = http.post({
                url: 'http://200.125.41.106:444/CreditosTesting/awscrearcliente.aspx?wsdl',
                body: string,
                headers: headerObj
            });

            log.debug("response", response.body)

            var codigo = response.body;
            if (codigo) {
                codigo = codigo.split('<Clientecodigo xmlns="Creditos">')
                codigo = codigo[1].split("</Clientecodigo>")
                codigo = codigo[0]
                newRecord.setValue({
                    fieldId: 'custentity_sdb_cliente_codigo',
                    value: codigo
                });
                newRecord.setValue({
                    fieldId: 'entitystatus',
                    value: "13"
                });


                //Crear vale del lado de ellos
                var dateInField = newRecord.getValue('custentity8');
                var vencimiento;
                if (dateInField) {
                    vencimiento = JSON.stringify(newRecord.getValue('custentity8')).split('T')[0].split("-").join("/").slice(1);
                }
                else {
                    var newDate = new Date();
                    newDate.setDate(newDate.getDate() + 1)
                    newDate = newDate.toISOString().split('T')[0].split('-').reverse().join('/')
                    log.debug('Date', newDate)
                    var formatedDate = format.parse({
                        value: newDate,
                        type: format.Type.DATE
                    });
                    log.debug('formated date', formatedDate)
                    newRecord.setValue({
                        fieldId: 'custentity8',
                        value: formatedDate,
                    })
                    vencimiento = JSON.stringify(newRecord.getValue('custentity8')).split('T')[0].split("-").join("/").slice(1);
                }
                var montoOtorgado = newRecord.getValue('custentity_sdb_montosolicitado');
                var plazo = newRecord.getText('custentity_sdb_cuotas');
                var plazoID = newRecord.getValue('custentity_sdb_cuotas')
                var vencimientoDateFormat = newRecord.getValue('custentity8');
                var codProd = newRecord.getValue('custentity6')

                var string2 = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cred="Creditos">';
                string2 += '<soapenv:Header/><soapenv:Body><cred:WSCrearPrestamo.Execute>';
                string2 += '<cred:Idorigen>CRM</cred:Idorigen>';
                string2 += '<cred:Documentopais>UY</cred:Documentopais>';
                string2 += '<cred:Documentotipo>CI</cred:Documentotipo>';
                string2 += '<cred:Documentonumero>' + ci + '</cred:Documentonumero>';
                string2 += '<cred:Productocodigo>' + CODIGOS_PRODUCTO[codProd] + '</cred:Productocodigo>';
                string2 += '<cred:Capital>' + montoOtorgado + '</cred:Capital>';
                string2 += '<cred:Plazo>' + plazo + '</cred:Plazo>';
                string2 += '<cred:Vencimientoprimcuota>' + vencimiento + '</cred:Vencimientoprimcuota>';
                string2 += '</cred:WSCrearPrestamo.Execute></soapenv:Body></soapenv:Envelope>';
                var headerObj2 = {
                    "Content-Type": "application/xml",
                    "Cookie": "ASP.NET_SessionId=ly0cehfeqvhxa5mmi2er42nj"
                };
                log.debug('string 2', string2)

                var response2 = http.post({
                    url: 'http://200.125.41.106:444/CreditosTesting/awscrearprestamo.aspx?wsdl',
                    body: string2,
                    headers: headerObj2
                });

                log.debug("response2", response2.body);

                //Obtener codigo y valor de cuota
                var responseToSplit = response2.body

                var codigoPrestamo = responseToSplit.split(`<Nroprestamo xmlns="Creditos">`)[1];
                codigoPrestamo = codigoPrestamo.split("</Nroprestamo>")[0];
                var valorCuota = responseToSplit.split(`<Valorcuota xmlns="Creditos">`)[1];
                valorCuota = valorCuota.split("</Valorcuota>")[0];

                newRecord.setValue({
                    fieldId: 'custentity_sdb_valor_cuota_vale',
                    value: valorCuota,
                });
                newRecord.setValue({
                    fieldId: 'custentity_sdb_contrato_codigo',
                    value: codigoPrestamo,
                })
                newRecord.setValue({
                    fieldId: 'custentity_sdb_montootorgado',
                    value: montoOtorgado,
                })

                if (codigoPrestamo != 0) {
                    var newVale = record.create({
                        type: 'customrecord_sdb_vale',
                    });
                    newVale.setValue({
                        fieldId: 'custrecord_sdb_vale_monto',
                        value: montoOtorgado,
                    })
                    newVale.setValue({
                        fieldId: 'custrecord_sdb_vale_cuotas',
                        value: plazoID,
                    })
                    newVale.setValue({
                        fieldId: 'custrecord_sdb_vale_valor_cuota',
                        value: valorCuota,
                    })
                    newVale.setValue({
                        fieldId: 'custrecord_sdb_vale_fecha_pago',
                        value: vencimientoDateFormat ? vencimientoDateFormat : new Date(),
                    })
                    newVale.setValue({
                        fieldId: 'custrecordsdb_vale_numero_prestamo',
                        value: codigoPrestamo,
                    })
                    newVale.setValue({
                        fieldId: 'custrecord_sdb_vale_cliente',
                        value: newRecord.id
                    })
                    newVale.setValue({
                        fieldId: 'name',
                        value: 'Vale de prestamo ' + codigoPrestamo
                    })

                    var newValeID = newVale.save();
                    log.debug('Nuevo Vale', newValeID);
                }

            }
        } catch (error) {
            log.debug('error', error)
        }
    }

    return {
        onAction: onAction
    }
});