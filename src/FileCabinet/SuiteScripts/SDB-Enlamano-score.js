define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/render', 'N/email', 'N/https'], function (log, record, search, runtime, render, email, https) {

    
    function scoreFinal(dni) {
        var logTxt = '<P>En scoring...</P>';
        try {
            log.debug('start score final');
            var objectCalification = { "1A": 1, "1C": 2, "2A": 3, "0": 4, "N/C": 5, "N": 6, "2B": 7, "3": 8, "4": 9, "5": 10 };

            // levato el record de los rate por entidad
            var scoreRecord = record.load({
                type: "customrecord_sdb_score",
                id: 1,
            });

            var score = 0;
            var banco_binned = scoreRecord.getValue("custrecord_sdb_banco_binned");
            var ent_t6_binned = scoreRecord.getValue("custrecord_sdb_ent_t6_binned");
            var intercept = scoreRecord.getValue("custrecord_sdb_intercept");
            var t6_cred_dir_comp_binned = scoreRecord.getValue('custrecord_sdb_t6_cred_dir_comp_binned');
            var vig_noauto_t6_coop_binned = scoreRecord.getValue('custrecord_sdb_vig_noauto_t6_coop_binned');
            var t0_bbva_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_bbva_binned');
            var cont_t0_fucac_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_fucac_binned');
            var t0_scotia_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_scotia_binned');
            var t0_asi_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_asi_binned');
            var brou_grupo_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_brou_grupo_binned');
            var emp_valor_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_emp_valor_binned');
            var t0_fnb_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_fnb_binned');
            var t0_santa_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_santa_binned');
            var t6_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_binned');
            var cred_dir_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_cred_dir_binned');
            var t6_creditel_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_creditel_binned')
            var t6_oca_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_oca_binned');
            var t6_pronto_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_pronto_binned');
            var cred_dir_binned_res = 0;
            var ent_t6_binned_res = 0;
            var t6_binned_res = 0;
            var t6_creditel_binned_res = 0;
            var t6_oca_binned_res = 0;
            var t0_fnb_binned_res = 0;
            var t0_scotia_binned_res = 0;
            var t0_asi_binned_res = 0;
            var t0_bbva_binned_res = 0;
            var t6_cred_dir_comp_binned_res = 0;
            var t6_banco_binned_res = 0;
            var vig_noauto_t6_coop_binned_res = 0;
            var t0_santa_binned_res = 0;
            var emp_valor_binned_res = 0;
            var cont_t0_fucac_binned_res = 0;
            var brou_grupo_binned_res = 0;
            var t6_pronto_binned_res = 0;
            var mensaje = "No tenemos prestamo disponible en este momento"
            var t6 = {};
            var t2 = {};
            var calificacionMinima = "0"

            //test
            var dni = dni
            var headers = {
                "Content-Type": "application/json",
                "Authorization": "Basic cHJvZDJfZW5sYW1hbm86ZGZlcjRlZHI="
            }

            var urlRequest = "https://riskapi.info/api/models/v2/enlamanocrm/execute";
            //var urlRequest = "https://ws-azure.enlamano.com.uy/api/models/v2/enlamanocrm/execute";
            var body = { "Documento": dni, "TipoDocumento": "IDE" }
            var objResponse = https.post({
                body: JSON.stringify(body),
                url: urlRequest,
                headers: headers
            });

            var responseBody = JSON.parse(objResponse?.body);
           // log.debug('Response body', responseBody);

            // Check if response contains errors
            if (responseBody.hasOwnProperty('errores')) {
                // Handle error case
                return {
                    title: "Error de validación",
                    error_reglas: 400,
                    detail: responseBody.errores[0].mensaje,
                    score: 0
                };
            } 

           
            var data = JSON.parse(objResponse.body)
            // T6
           //log.debug('objResponse', data);

            if (data?.errors) {    
                if (data?.errors[0]?.status == 404) {
                    logTxt += '<P> !!!! ERROR: ' + data.errors[0].detail + "<P/>";
                return {
                    title: data.errors[0].title,
                    error_reglas: 404,
                    detail: data.errors[0].detail,
                    score: 0
                };
                }
            }

            data = JSON.parse(data?.datosBcu);
           // log.debug("datosBcu: ", data);
            var nombre = data.data?.Nombre
            logTxt += '<P> => datosBcu: </P>' + JSON.stringify(data) + "<P/>";

            if (data?.errors && !nombre) {    
                if (data?.errors[0]?.status == 404) {
                    logTxt += '<P> !!!! ERROR: ' + data.errors[0].detail + "<P/>";
                log.error('Error en la llamada a datosBcu', data.errors[0].detail);
                return {
                    title: data.errors[0].title,
                    error_reglas: 404,
                    detail: data.errors[0].detail,
                    score: 0
                };
                }
            }

            var data2 = JSON.parse(objResponse?.body).datosBcu_T6;
            data2 = JSON.parse(data2);
            log.debug("datosBcu_T6: ", data2);
            logTxt += '<P> => datosBcu_T6: </P>' + JSON.stringify(data2) + "<P/>";

            if (data2?.errors && !nombre) {
                if (data2?.errors[0]?.status == 404) {
                    logTxt += '<P> !!!! ERROR: ' + data2.errors[0].detail + "<P/>";
                log.error('Error en la llamada a datosBcu_T6', data2.errors[0].detail);
                return {
                    title: data2.errors[0].title,
                    error_reglas: 404,
                    detail: data2.errors[0].detail,
                    score: 0
                };
                }
                
            }

            var t2_mnPesos = -1;
            var t2_mePesos = -1;
            var t6_mnPesos = -1;
            var t6_mePesos = -1;

            try {
                t2_mnPesos = data?.RubrosValoresGenerales[0]?.MnPesos;
            } catch (E) {
                try { t2_mnPesos = data?.data?.RubrosValoresGenerales[0]?.MnPesos; } catch (E1) { }
            }
            try {
                t2_mePesos = data?.RubrosValoresGenerales[0]?.MePesos;
            } catch (E) {
                try { t2_mePesos = data?.data?.RubrosValoresGenerales[0]?.MePesos; } catch (E1) { }
            }
            try {
                t6_mnPesos = data2?.RubrosValoresGenerales[0]?.MnPesos;
            } catch (E) {
                try { t6_mnPesos = data2?.data?.RubrosValoresGenerales[0]?.MnPesos; } catch (E1) { }
            }
            try {
                t6_mePesos = data2?.RubrosValoresGenerales[0]?.MePesos;
            } catch (E) {
                try { t6_mePesos = data2?.data?.RubrosValoresGenerales[0]?.MePesos; } catch (E1) { }
            }

            logTxt += '<P> ***************** ENDEUDAMIENTO comienzo ****************** </P>';
            logTxt += '<P> +++++ t2_mnPesos: ' + t2_mnPesos + "<P/>";
            logTxt += '<P> +++++ t2_mePesos: ' + t2_mePesos + "<P/>";
            logTxt += '<P> +++++ t6_mnPesos: ' + t6_mnPesos + "<P/>";
            logTxt += '<P> +++++ t6_mePesos: ' + t6_mePesos + "<P/>";


            var endeudamiento = -314;
            try {

                endeudamiento = ((t2_mnPesos + t2_mePesos) / (t6_mnPesos + t6_mePesos)) - 1;
                logTxt += '<P> +++++ endeudamiento: ' + endeudamiento + "<P/>";

            } catch (E) {
                logTxt += '<P> !!!! ERROR: ' + E + "<P/>";
                log.error('Error calculando el endeudamiento', E);
            }
            log.debug("---------", '******************************');
            logTxt += '<P> ***************** ENDEUDAMIENTO fin ****************** </P>';

            //primera llamada a  currentt2

            //armar la primera data currentt2
            for (var i = 0; i < data?.data?.EntidadesRubrosValores.length; i++) {

                const calif = data.data.EntidadesRubrosValores[i].Calificacion;
                const malasCalificaciones = ["2B", "2", "3", "4", "5"];

                if (malasCalificaciones.includes(calif)) {
                    return {
                        error_reglas: true,
                        calificacionMinima: calif,
                        nombre: nombre,
                        endeudamiento: null || 0,
                        score: null,
                        logTxt: logTxt
                    };
                }

                t2[i] = {
                    NombreEntidad: data.data.EntidadesRubrosValores[i].NombreEntidad,
                    Calificacion: data.data.EntidadesRubrosValores[i].Calificacion,
                    CalificacionMinima0: objectCalification[data.data.EntidadesRubrosValores[i].Calificacion],
                    Cont: containsConting(data.data.EntidadesRubrosValores[i].RubrosValores),
                    vig: containsVigencia(data.data.EntidadesRubrosValores[i].RubrosValores),
                };


                if (data.data.EntidadesRubrosValores[i].Calificacion && calificacionMinima == "0") {

                    calificacionMinima = data.data.EntidadesRubrosValores[i].Calificacion
                }

                if (calificacionMinima == "1A" && data.data.EntidadesRubrosValores[i].Calificacion == "1C") calificacionMinima = "1C"
                if (calificacionMinima == "1C" && data.data.EntidadesRubrosValores[i].Calificacion == "2A") calificacionMinima = "2A"

            }
            // segunda llamada a t6

            for (var p = 0; p < data2?.data?.EntidadesRubrosValores.length; p++) {

                t6[p] = {
                    NombreEntidad: data2.data.EntidadesRubrosValores[p].NombreEntidad,
                    Calificacion: data2.data.EntidadesRubrosValores[p].Calificacion,
                    CalificacionMinima: objectCalification[data2.data.EntidadesRubrosValores[p].Calificacion],
                    Cont: containsConting(data2.data.EntidadesRubrosValores[p].RubrosValores),
                    vig: containsVigencia(data2.data.EntidadesRubrosValores[p].RubrosValores),
                };
            }

            //calculo de scores segun catidad de entidades
            // en t6 

            if (t6.length == 0 || t6.length == 1) ent_t6_binned_res = -63.64;
            if (t6.length == 2 || t6.length == 3) ent_t6_binned_res = 8;
            if (t6.length == 4 || t6.length == 5) ent_t6_binned_res = 34.84;
            if (t6.length > 5) ent_t6_binned_res = 72, 80;
            ////calculo de scores segun catidad de entidades
            //t6 por calificacion
            var contador = 0
            var min = 0;
            var object = {};
            for (var key in t6) {
                var current = t6[key]
                if (current.CalificacionMinima >= min) {
                    min = current.CalificacionMinima;
                    object = current;
                }
            }


            //minima calificacion en t0
            var min0 = 0;
            var object0 = {};
            for (var key in t2) {
                var current0 = t2[key]
                if (current0.CalificacionMinima0 >= min0) {
                    min0 = current0.CalificacionMinima0;
                    object0 = current0;
                }
            }


            if (object.CalificacionMinima >= 5) {
                t6_binned_res = -9.95;
            }
            for (var key in t6) {
                var current = t6[key]
                contador = contador + 1
                //t6 por calificacion
                if (t6_binned_res != -9.95) {
                    if (current.Calificacion == "" || !current.Calificacion) t6_binned_res = -68.53;
                    else if (current.Calificacion == "2B" && t6_binned_res != 14.88) { t6_binned_res = 14.88; }
                    else if (current.Calificacion == "1C" || current.Calificacion == "1A" || current.Calificacion == "2A" || current.Calificacion == "0") { t6_binned_res = 31.94; }
                }

                // else if (t6_binned_res = 0) {
                //     t6_binned_res = -9.95;
                // }
                // fin t6 por calificacion
                //t6 por calificacion creditel

                if (current.NombreEntidad.indexOf("SOCUR") > -1) {
                    t6_creditel_binned_res = 40.62;
                }
                else if (current.NombreEntidad.indexOf("SOCUR") && t6_creditel_binned_res != 40.62) {
                    t6_creditel_binned_res = -17.15;
                }
                // end t6 por calificacion creditel
                //t6 por calificacion oca
                if (current.NombreEntidad.indexOf("OCA") > -1 && (current.Calificacion == "1C" || current.Calificacion == "1A")) {
                    t6_oca_binned_res = 50.39;

                } else if (t6_oca_binned_res != 50.39) {

                    t6_oca_binned_res = -15.16;
                }
                //end t6 por calificacion oca
                // t6_cred_dir_comp.binned
                // log.debug("t6", current)
                logTxt += '<P> => t6: ' + current + '</P>';

                if (current.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1 && current.Calificacion == "1C" || current.Calificacion == "2A") {

                    cred_dir_binned_res = 30.77;

                } else if (current.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1 && cred_dir_binned_res != 30.77 && current.Calificacion != "2A" || current.Calificacion != "1C") {
                    cred_dir_binned_res = -90.18
                }
                if (cred_dir_binned_res != 30.77 || cred_dir_binned_res != -90.18) {
                    cred_dir_binned_res = -4.12;
                }

                if (current.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1) {
                    t6_cred_dir_comp_binned_res = 37.78;
                } else if (t6_cred_dir_comp_binned_res != 37.78) {
                    t6_cred_dir_comp_binned_res = -4.35;
                }
                // end t6_cred_dir_comp.binned
                // t6_banco_binned_res


                if (current.NombreEntidad.indexOf("Vizcaya") > -1 || current.NombreEntidad.indexOf("Bandes") > -1 || current.NombreEntidad.indexOf("Banco Ita") > -1 || current.NombreEntidad.indexOf("Santander") > -1 || current.NombreEntidad.indexOf("Scotiabank") > -1 || current.NombreEntidad.indexOf("HSBC") > -1 && (current.Calificacion == "1A" || current.Calificacion == "1C" || current.Calificacion == "2A")) {
                    t6_banco_binned_res = 51.06
                } else if (t6_banco_binned_res != 51.06) {
                    t6_banco_binned_res = -37.55;
                }
                //end t6_banco_binned_res

                if (!current.NombreEntidad.vig && current.Calificacion) {

                    if ( // current.NombreEntidad.indexOf("FUCAC") > -1 || 
                        current.NombreEntidad.indexOf("ANDA") > -1 ||
                        current.NombreEntidad.indexOf("FUCEREP") > -1 ||
                        current.NombreEntidad.indexOf("ACAC") > -1
                    ) {
                        vig_noauto_t6_coop_binned_res = 48.55;

                    } else if (!current.NombreEntidad.vig && vig_noauto_t6_coop_binned_res != 48.55) {
                        vig_noauto_t6_coop_binned_res = -23.52;

                    }
                }
                //end  vig_noauto_t6_coop_binned_res
                // t0_santa_binned_res
                //t6_pronto_binned
                if (current.NombreEntidad.indexOf("BAUTZEN") > -1 && current.Calificacion) {
                    t6_pronto_binned_res = 36.73;
                } else if (t6_pronto_binned_res != 36.73) {
                    t6_pronto_binned_res = -7.86;
                }
            } 
            if (contador == 0 || contador == 1) ent_t6_binned_res = -63.64;
            if (contador == 2 || contador == 3) ent_t6_binned_res = 8;
            if (contador == 4 || contador == 5) ent_t6_binned_res = 34.84;
            if (contador > 5) ent_t6_binned_res = 72, 80;
            // for t0 
            for (var key in t2) {
                var currentt2 = t2[key]
                //t0 asi.binned
                if (currentt2.NombreEntidad.indexOf("Integrales") > -1 && currentt2.Calificacion) {
                    t0_asi_binned_res = 67.86;
                } else if (t0_asi_binned_res != 67.86) {
                    t0_asi_binned_res = -4.94;
                }
                // end t0 asi
                //   t0_bbva_binned


                if (currentt2.Cont && currentt2.NombreEntidad.indexOf("Vizcaya") > -1) {
                    logTxt += '<P> => currentt2.NombreEntidad.Cont: ' + currentt2.NombreEntidad.Cont + '</P>';
                    logTxt += "<P/> tes currentt2.NombreEntidad.indexOf('Vizcaya') > -1 - " + (currentt2.NombreEntidad.indexOf("Vizcaya") > -1);

                    t0_bbva_binned_res = 79.39;
                } else if (t0_bbva_binned_res != 79.39) {
                    t0_bbva_binned_res = -3.65;
                }
                // end t0 bbva
                //currentt2 por calificacion fnb

                if (object0.CalificacionMinima0 == 2 || object0.CalificacionMinima0 == 1) {
                    if (currentt2.NombreEntidad.indexOf("Integrales") > -1 || currentt2.NombreEntidad.indexOf("BAUTZEN") > -1 || currentt2.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1 || currentt2.NombreEntidad.indexOf("Emprendimientos") > -1 || currentt2.NombreEntidad.indexOf("Microfinanzas") > -1 || currentt2.NombreEntidad.indexOf("OCA") > -1 || currentt2.NombreEntidad.indexOf("PASS CARD") > -1 || currentt2.NombreEntidad.indexOf("Promotora") > -1 || currentt2.NombreEntidad.indexOf("Republica Microfinazas") > -1 || currentt2.NombreEntidad.indexOf("RETOP") > -1 || currentt2.NombreEntidad.indexOf("CIA") > -1 || currentt2.NombreEntidad.indexOf("SOCUR") > -1 || currentt2.NombreEntidad.indexOf("VERENDY") > -1) {
                        t0_fnb_binned_res = 14.06;
                    }
                }
                else if (object0.CalificacionMinima0 == 3 && t0_fnb_binned_res != 14.06) {
                    if (currentt2.NombreEntidad.indexOf("Integrales") > -1 || currentt2.NombreEntidad.indexOf("BAUTZEN") > -1 || currentt2.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1 || currentt2.NombreEntidad.indexOf("Emprendimientos") > -1 || currentt2.NombreEntidad.indexOf("Microfinanzas") > -1 || currentt2.NombreEntidad.indexOf("OCA") > -1 || currentt2.NombreEntidad.indexOf("PASS CARD") > -1 || currentt2.NombreEntidad.indexOf("Promotora") > -1 || currentt2.NombreEntidad.indexOf("Republica Microfinazas") > -1 || currentt2.NombreEntidad.indexOf("RETOP") > -1 || currentt2.NombreEntidad.indexOf("CIA") > -1 || currentt2.NombreEntidad.indexOf("SOCUR") > -1 || currentt2.NombreEntidad.indexOf("VERENDY") > -1) {
                        t0_fnb_binned_res = -6.06;
                    }
                } else if (t0_fnb_binned_res != 14.06 || t0_fnb_binned_res != -6.06) {
                    t0_fnb_binned_res = -42.71;
                }
                //  end currentt2 por calificacion fnb
                //t0 scotia.binned             
                if (currentt2.Cont && currentt2.NombreEntidad.indexOf("Scotiabank") > -1) {
                    t0_scotia_binned_res = 74.04;
                } else if (t0_scotia_binned_res != 74.04) {

                    t0_scotia_binned_res = -4.16;

                }
                //  end currentt2 por calificacion scotia
                // t0 valor
                if (currentt2.NombreEntidad.indexOf("Emprendimientos") > -1 && currentt2.Calificacion) {
                    emp_valor_binned_res = 124.21;

                } else if (emp_valor_binned_res != 124.21) {

                    emp_valor_binned_res = -4.46;
                }
                // end t0 valor
                // t0_fucac_binned


                if (currentt2.NombreEntidad.indexOf("FUCAC") > -1 && currentt2.Cont) {
                    cont_t0_fucac_binned_res = 74.16;

                } else if (cont_t0_fucac_binned_res != 74.16) {
                    cont_t0_fucac_binned_res = -7.01;
                }
                //end fucac
                //  t0 brou_grupo_binned_res
                if (currentt2.NombreEntidad.indexOf("República") > -1 && currentt2.Calificacion) {
                    brou_grupo_binned_res = 33.61;
                } else if (brou_grupo_binned_res != 33.61) {
                    brou_grupo_binned_res = -15.44;
                }
                if (currentt2.NombreEntidad.indexOf("Santander") > -1) {
                    t0_santa_binned_res = 38.33;

                } else if (t0_santa_binned_res != 38.33) {
                    t0_santa_binned_res = -18.27;
                }

            }

            // calculo final de score
            ent_t6_binned_res = ent_t6_binned_res * ent_t6_binned;
            t6_binned_res = t6_binned_res * t6_binned;
            t6_creditel_binned_res = t6_creditel_binned_res * t6_creditel_binned;
            t6_oca_binned_res = t6_oca_binned_res * t6_oca_binned;
            t0_fnb_binned_res = t0_fnb_binned_res * t0_fnb_binned;
            t0_asi_binned_res = t0_asi_binned_res * t0_asi_binned;
            t0_bbva_binned_res = t0_bbva_binned_res * t0_bbva_binned;
            t6_cred_dir_comp_binned_res = t6_cred_dir_comp_binned_res * t6_cred_dir_comp_binned;
            t6_banco_binned_res = t6_banco_binned_res * banco_binned;
            vig_noauto_t6_coop_binned_res = vig_noauto_t6_coop_binned_res * vig_noauto_t6_coop_binned;
            t0_santa_binned_res = t0_santa_binned_res * t0_santa_binned;
            emp_valor_binned_res = emp_valor_binned_res * emp_valor_binned;
            cont_t0_fucac_binned_res = cont_t0_fucac_binned_res * cont_t0_fucac_binned;
            brou_grupo_binned_res = brou_grupo_binned_res * brou_grupo_binned;
            t6_pronto_binned_res = t6_pronto_binned_res * t6_pronto_binned;
            t0_scotia_binned_res = t0_scotia_binned_res * t0_scotia_binned;
            cred_dir_binned_res = cred_dir_binned_res * cred_dir_binned
            var test = 1 * 0.211
            var total = test + ent_t6_binned_res + t6_binned_res + t6_creditel_binned_res + t6_oca_binned_res + t0_fnb_binned_res + t0_asi_binned_res + t0_bbva_binned_res + t6_cred_dir_comp_binned_res + t6_banco_binned_res + vig_noauto_t6_coop_binned_res + t0_santa_binned_res + emp_valor_binned_res + cont_t0_fucac_binned_res + brou_grupo_binned_res + t6_pronto_binned_res + t0_scotia_binned_res + cred_dir_binned_res;
            score = (Math.exp(total) / (1 + Math.exp(total))) * 1000;
            score = Math.round(score)

            /////////////////////////////////////////////////////////////////////////////////
            logTxt += '<P/> ent_t6_binned_res: ' + ent_t6_binned_res;
            logTxt += '<P/> t6_binned_res: ' + t6_binned_res;
            logTxt += '<P/> t6_creditel_binned_res: ' + t6_creditel_binned_res;
            logTxt += '<P/> t6_oca_binned_res: ' + t6_oca_binned_res;
            logTxt += '<P/> t0_fnb_binned_res: ' + t0_fnb_binned_res;
            logTxt += '<P/> t0_asi_binned_res: ' + t0_asi_binned_res;
            logTxt += '<P/> t0_bbva_binned_res: ' + t0_bbva_binned_res;
            logTxt += '<P/> t6_cred_dir_comp_binned_res: ' + t6_cred_dir_comp_binned_res;
            logTxt += '<P/> t6_banco_binned_res: ' + t6_banco_binned_res;
            logTxt += '<P/> vig_noauto_t6_coop_binned_res: ' + vig_noauto_t6_coop_binned_res;
            logTxt += '<P/> t0_santa_binned_res: ' + t0_santa_binned_res;
            logTxt += '<P/> cont_t0_fucac_binned_res: ' + cont_t0_fucac_binned_res;
            logTxt += '<P/> brou_grupo_binned_res: ' + brou_grupo_binned_res;
            logTxt += '<P/> t6_pronto_binned_res: ' + t6_pronto_binned_res;
            logTxt += '<P/> t0_scotia_binned_res: ' + t0_scotia_binned_res;
            logTxt += '<P/> cred_dir_binned_res: ' + cred_dir_binned_res;

            logTxt += '<P/> total: ' + total;
            logTxt += '<P/> score: ' + score;

            /////////////////////////////////////////////////////////////////////////////////


            var objetos = {
                score: score,
                calificacionMinima: calificacionMinima,
                contador: contador,
                mensaje: mensaje,
                endeudamiento: endeudamiento,
                nombre: nombre
            }

            objetos.error_reglas = false;
            objetos.logTxt = logTxt;
            return objetos
        } catch (e) {
            log.error("ERROR:  ", e)
            return {
                title: "Error BCU",
                error_reglas: 500,
                detail: e.message,
                score: 0
            };
        }
    }
    function containsConting(object) {
        for (var key in object) {
            var myobject = object[key];
            if (myobject.Rubro == 'CONTINGENCIAS') {
                return true;
            };
        }
        return false;
    }
    function containsVigencia(object) {
        for (var key in object) {
            var myobject = object[key];
            if (myobject.Rubro == 'VIGENTE') {
                return true;
            };
        }
        return false;
    }



    return {
        scoreFinal: scoreFinal,

    }

});