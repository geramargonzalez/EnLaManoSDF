define(['N/log', 'N/record', 'N/search', 'N/runtime', 'N/render', 'N/email', 'N/https',"./ELM_Aux_Lib.js"], 
    function (log, record, search, runtime, render, email, https, auxLib) {

    
    function scoreFinal(dni) {
        let logTxt = '<P>En scoring...</P>';
        try {
            log.debug('start score final');
            const objectCalification = { "1A": 1, "1C": 2, "2A": 3, "0": 4, "N/C": 5, "N": 6, "2B": 7, "3": 8, "4": 9, "5": 10 };

            // levato el record de los rate por entidad
            const scoreRecord = record.load({
                type: "customrecord_sdb_score",
                id: 1,
            });

            let score = 0;
            const banco_binned = scoreRecord.getValue("custrecord_sdb_banco_binned");
            const ent_t6_binned = scoreRecord.getValue("custrecord_sdb_ent_t6_binned");
            //const intercept = scoreRecord.getValue("custrecord_sdb_intercept");
            const t6_cred_dir_comp_binned = scoreRecord.getValue('custrecord_sdb_t6_cred_dir_comp_binned');
            const vig_noauto_t6_coop_binned = scoreRecord.getValue('custrecord_sdb_vig_noauto_t6_coop_binned');
            const t0_bbva_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_bbva_binned');
            const cont_t0_fucac_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_fucac_binned');
            const t0_scotia_binned = scoreRecord.getValue('custrecord_sdb_woe_cont_t0_scotia_binned');
            const t0_asi_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_asi_binned');
            const brou_grupo_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_brou_grupo_binned');
            const emp_valor_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_emp_valor_binned');
            const t0_fnb_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_fnb_binned');
            const t0_santa_binned = scoreRecord.getValue('custrecord_sdb_woe_t0_santa_binned');
            const t6_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_binned');
            const cred_dir_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_cred_dir_binned');
            const t6_creditel_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_creditel_binned')
            const t6_oca_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_oca_binned');
            const t6_pronto_binned = scoreRecord.getValue('custrecord_sdb_woe_t6_pronto_binned');
            let cred_dir_binned_res = 0;
            let ent_t6_binned_res = 0;
            let t6_binned_res = 0;
            let t6_creditel_binned_res = 0;
            let t6_oca_binned_res = 0;
            let t0_fnb_binned_res = 0;
            let t0_scotia_binned_res = 0;
            let t0_asi_binned_res = 0;
            let t0_bbva_binned_res = 0;
            let t6_cred_dir_comp_binned_res = 0;
            let t6_banco_binned_res = 0;
            let vig_noauto_t6_coop_binned_res = 0;
            let t0_santa_binned_res = 0;
            let emp_valor_binned_res = 0;
            let cont_t0_fucac_binned_res = 0;
            let brou_grupo_binned_res = 0;
            let t6_pronto_binned_res = 0;
            const mensaje = "No tenemos prestamo disponible en este momento"
            const t6 = {};
            const t2 = {};
            let calificacionMinima = "0"

            //test 
            var headers = {
                "Content-Type": "application/json",
                "Authorization": "Basic ZW5tbF90ZXN0OmVubG1fdGVzdF80ODM2NQ=="
            }

            var urlRequest = "https://riskapi.info:1443/api/models/v2/ENLAMANOCRM/execute";

            // const urlRequest = "https://riskapi.info/api/models/v2/enlamanocrm/execute";
            //const BCU_ENDPOINT = 'https://bcu.prod.prometeoapi.com/report';
            //const urlRequest = "https://ws-azure.enlamano.com.uy/api/models/v2/enlamanocrm/execute";
            const body = { "Documento": dni, "TipoDocumento": "IDE" }
            //const body = { "document": dni, "document_type": "IDE" }
            const objResponse = https.post({
                body: JSON.stringify(body),
                url: urlRequest,
                headers: headers
            });

            const responseBody = JSON.parse(objResponse?.body);

            log.debug('Response body', responseBody);

            auxLib.createLogRecord(dni,'M&M Response', objResponse.code === 200, 6, null, objResponse);

            
            // Manejo estructurado de errores usando la nueva función
            const apiError = handleApiError(objResponse, responseBody, dni);
            if (apiError) {
                return apiError;
            }

            // Si llegamos aquí, el status es 200 y podemos procesar los datos
            // Manejar la nueva estructura de respuesta donde los datos vienen directamente parseados
            let data = responseBody.datosBcu ? JSON.parse(responseBody.datosBcu) : responseBody;

            const nombre = data.data?.nombre || data.data?.Nombre
            logTxt += '<P> => datosBcu: </P>' + JSON.stringify(data) + "<P/>";

            // Validar datos del BCU T0 usando la nueva función
            const bcuT0Error = validateBcuData(data, 'T0', nombre);
            if (bcuT0Error) {
                logTxt += '<P> !!!! ERROR T0: ' + bcuT0Error.detail + "<P/>";
                return bcuT0Error;
            }

            let data2 = responseBody.datosBcu_T6 ? JSON.parse(responseBody.datosBcu_T6) : { errors: [{ status: 404, detail: 'No data available' }] };


            logTxt += '<P> => datosBcu_T6: </P>' + JSON.stringify(data2) + "<P/>";
            
            let isT6Valid = false;

            if (data2?.errors) {
                isT6Valid = data2?.errors[0]?.status == 404;
            }

            // Validar datos del BCU T6 usando la nueva función
            const bcuT6Error = validateBcuData(data2, 'T6', nombre);
            if (bcuT6Error) {
                logTxt += '<P> !!!! ERROR T6: ' + bcuT6Error.detail + "<P/>";
                return bcuT6Error;
            }

            let t2_mnPesos = -1;
            let t2_mePesos = -1;
            let t6_mnPesos = -1;
            let t6_mePesos = -1;

            try {
                // Try new structure first, then legacy structure
                t2_mnPesos = data?.data?.rubrosValoresGenerales?.[0]?.mnPesos || responseBody?.rubrosValoresGenerales_t0?.[0]?.mnPesos || data?.RubrosValoresGenerales?.[0]?.MnPesos || data?.data?.RubrosValoresGenerales?.[0]?.MnPesos;
            } catch (E) {
                log.debug('Error reading t2_mnPesos', E);
            }
            try {
                t2_mePesos = data?.data?.rubrosValoresGenerales?.[0]?.mePesos || responseBody?.rubrosValoresGenerales_t0?.[0]?.mePesos || data?.RubrosValoresGenerales?.[0]?.MePesos || data?.data?.RubrosValoresGenerales?.[0]?.MePesos;
            } catch (E) {
                log.debug('Error reading t2_mePesos', E);
            }
            try {
                t6_mnPesos = data2?.data?.rubrosValoresGenerales?.[0]?.mnPesos || responseBody?.rubrosValoresGenerales_t6?.[0]?.mnPesos || data2?.RubrosValoresGenerales?.[0]?.MnPesos || data2?.data?.RubrosValoresGenerales?.[0]?.MnPesos;
            } catch (E) {
                log.debug('Error reading t6_mnPesos', E);
            }
            try {
                t6_mePesos = data2?.data?.rubrosValoresGenerales?.[0]?.mePesos || responseBody?.rubrosValoresGenerales_t6?.[0]?.mePesos || data2?.RubrosValoresGenerales?.[0]?.MePesos || data2?.data?.RubrosValoresGenerales?.[0]?.MePesos;
            } catch (E) {
                log.debug('Error reading t6_mePesos', E);
            }

            logTxt += '<P> ***************** ENDEUDAMIENTO comienzo ****************** </P>';
            logTxt += '<P> +++++ t2_mnPesos: ' + t2_mnPesos + "<P/>";
            logTxt += '<P> +++++ t2_mePesos: ' + t2_mePesos + "<P/>";
            logTxt += '<P> +++++ t6_mnPesos: ' + t6_mnPesos + "<P/>";
            logTxt += '<P> +++++ t6_mePesos: ' + t6_mePesos + "<P/>";


            let endeudamiento = -314;
            try {

                endeudamiento = ((t2_mnPesos + t2_mePesos) / (t6_mnPesos + t6_mePesos)) - 1;
                logTxt += '<P> +++++ endeudamiento: ' + endeudamiento + "<P/>";

            } catch (E) {
                logTxt += '<P> !!!! ERROR: ' + E + "<P/>";
                log.error('Error calculando el endeudamiento', E);
            }
            
            logTxt += '<P> ***************** ENDEUDAMIENTO fin ****************** </P>';

            //primera llamada a  currentt2

            //armar la primera data currentt2
            const entidadesT0 = data?.data?.entidadesRubrosValores || responseBody?.entidadesRubrosValores_t0 || data?.data?.EntidadesRubrosValores || [];
            for (let i = 0; i < entidadesT0.length; i++) {

                const calif = entidadesT0[i].calificacion || entidadesT0[i].Calificacion;
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
                    NombreEntidad: entidadesT0[i].nombreEntidad || entidadesT0[i].NombreEntidad,
                    Calificacion: entidadesT0[i].calificacion || entidadesT0[i].Calificacion,
                    CalificacionMinima0: objectCalification[entidadesT0[i].calificacion || entidadesT0[i].Calificacion],
                    Cont: containsConting(entidadesT0[i].rubrosValores || entidadesT0[i].RubrosValores),
                    vig: containsVigencia(entidadesT0[i].rubrosValores || entidadesT0[i].RubrosValores),
                };


                if ((entidadesT0[i].calificacion || entidadesT0[i].Calificacion) && calificacionMinima == "0") {

                    calificacionMinima = entidadesT0[i].calificacion || entidadesT0[i].Calificacion
                }

                if (calificacionMinima == "1A" && (entidadesT0[i].calificacion || entidadesT0[i].Calificacion) == "1C") calificacionMinima = "1C"
                if (calificacionMinima == "1C" && (entidadesT0[i].calificacion || entidadesT0[i].Calificacion) == "2A") calificacionMinima = "2A"

            }
            // segunda llamada a t6
            const entidadesT6 = data2?.data?.entidadesRubrosValores || responseBody?.entidadesRubrosValores_t6 || data2?.data?.EntidadesRubrosValores || [];
            for (let p = 0; p < entidadesT6.length; p++) {

                t6[p] = {
                    NombreEntidad: entidadesT6[p].nombreEntidad || entidadesT6[p].NombreEntidad,
                    Calificacion: entidadesT6[p].calificacion || entidadesT6[p].Calificacion,
                    CalificacionMinima: objectCalification[entidadesT6[p].calificacion || entidadesT6[p].Calificacion],
                    Cont: containsConting(entidadesT6[p].rubrosValores || entidadesT6[p].RubrosValores),
                    vig: containsVigencia(entidadesT6[p].rubrosValores || entidadesT6[p].RubrosValores),
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
            let contador = 0
            let min = 0;
            let object = {};
            for (const key in t6) {
                const current = t6[key]
                if (current.CalificacionMinima >= min) {
                    min = current.CalificacionMinima;
                    object = current;
                }
            }


            //minima calificacion en t0
            let min0 = 0;
            let object0 = {};
            for (const key in t2) {
                const current0 = t2[key]
                if (current0.CalificacionMinima0 >= min0) {
                    min0 = current0.CalificacionMinima0;
                    object0 = current0;
                }
            }


            if (object.CalificacionMinima >= 5) {
                t6_binned_res = -9.95;
            }
            for (const key in t6) {
                const current = t6[key]
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

                } else if (current.NombreEntidad.indexOf("CREDITOS DIRECTOS") > -1 && cred_dir_binned_res != 30.77 && (current.Calificacion != "2A" || current.Calificacion != "1C") && !current.Calificacion) {
                    cred_dir_binned_res = -90.18

                }
                if (cred_dir_binned_res != 30.77 || cred_dir_binned_res != -90.18 && !current.calificacion) {
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

                if (!current.vig && current.Calificacion) {

                    if ( // current.NombreEntidad.indexOf("FUCAC") > -1 || 
                        current.NombreEntidad.indexOf("ANDA") > -1 ||
                        current.NombreEntidad.indexOf("FUCEREP") > -1 ||
                        current.NombreEntidad.indexOf("ACAC") > -1
                    ) {
                        vig_noauto_t6_coop_binned_res = 48.55;

                    } else if (!current.vig && vig_noauto_t6_coop_binned_res != 48.55) {
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
            for (const key in t2) {
                const currentt2 = t2[key]
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
            const test = 1 * 0.211
            const total = test + ent_t6_binned_res + t6_binned_res + t6_creditel_binned_res + t6_oca_binned_res + t0_fnb_binned_res + t0_asi_binned_res + t0_bbva_binned_res + t6_cred_dir_comp_binned_res + t6_banco_binned_res + vig_noauto_t6_coop_binned_res + t0_santa_binned_res + emp_valor_binned_res + cont_t0_fucac_binned_res + brou_grupo_binned_res + t6_pronto_binned_res + t0_scotia_binned_res + cred_dir_binned_res;
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

             if(!endeudamiento && isT6Valid) {
                endeudamiento = 1;
            } 

            const objetos = {
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
            log.error("ERROR - Score Lib:  ", e)
             const obj = {
                tipo: 2,
                usuario: 99353,
                record: 'Lead',
                notas:  'Error - Score Lib: ' + dni + ' - details: ' + e,
                };
            auxLib.createRecordAuditCambios(obj);
            return {
                title: "Error en el BCU",
                error_reglas: 500,
                detail: e.message,
                score: 0
            };
        }
    }

    /**
     * Maneja los errores de respuesta del API de scoring
     * @param {Object} objResponse - Respuesta HTTP del API
     * @param {Object} responseBody - Cuerpo de la respuesta parseado
     * @param {string} dni - Documento para logging
     * @returns {Object|null} - Objeto de error estructurado o null si no hay error
     */
    function handleApiError(objResponse, responseBody, dni) {
           const statusCode = objResponse.code;
          try {
            
            // 200 - Éxito, no hay error
            if (statusCode === 200) {
                return null;
            }
            
            // 401 - No autorizado
            if (statusCode === 401) {
                log.error('Error de autenticación API', `DNI: ${dni}, Status: ${statusCode}`);
                return {
                    title: "Error de autenticación",
                    error_reglas: 401,
                    detail: "Credenciales de acceso incorrectas",
                    score: 0
                };
            }
            
            // 422 - Contenido no procesable
            if (statusCode === 422) {
                let errorDetail = "Error de validación";
                
                if (responseBody && responseBody.errores && responseBody.errores.length > 0) {
                    const error = responseBody.errores[0];
                    if (error.codigo === "Body") {
                        errorDetail = "Body vacío o con formato incorrecto";
                    } else if (error.codigo === "Documento") {
                        errorDetail = `El documento ${dni} no es válido`;
                    } else {
                        errorDetail = error.mensaje || errorDetail;
                    }
                }
                
                log.error('Error de validación API', `DNI: ${dni}, Detail: ${errorDetail}`);
                return {
                    title: "Error de validación",
                    error_reglas: 422,
                    detail: errorDetail,
                    score: 0
                };
            }

          } catch (error) {
            log.error('Error manejando error API', `DNI: ${dni}, Error: ${error.message}`);
            return {
                title: "Error inesperado",
                error_reglas: 500,
                detail: "Error inesperado en la consulta",
                score: 0
            };
        }
        
        
        // 500 - Error interno del servidor
        if (statusCode === 500) {
            
            let errorDetail = "Error interno del servidor";
            
            if (responseBody?.errores && responseBody?.errores.length > 0) {
                const error = responseBody.errores[0];
                if (error.codigo === "InternalError") {
                    if (error.mensaje.includes("Error al obtener datos del BCU")) {
                        errorDetail = "Error al obtener datos del BCU";
                    } else if (error.mensaje.includes("contacte soporte")) {
                        errorDetail = error.mensaje; // Incluye el ID de operación
                    } else {
                        errorDetail = error.mensaje;
                    }
                }
            }
            
            log.error('Error interno API', `DNI: ${dni}, Detail: ${errorDetail}`);
            return {
                title: "Error interno del servidor",
                error_reglas: 500,
                detail: errorDetail,
                score: 0
            };
        }
        
        // Otros códigos de error no esperados
        log.error('Error API inesperado', `DNI: ${dni}, Status: ${statusCode}, Response: ${JSON.stringify(responseBody)}`);
        return {
            title: "Error inesperado",
            error_reglas: statusCode || 500,
            detail: "Error inesperado en la consulta",
            score: 0
        };
    }

    /**
     * Valida si la respuesta del BCU contiene datos válidos
     * @param {Object} data - Datos del BCU
     * @param {string} dataType - Tipo de datos ('T0' o 'T6')
     * @param {string} nombre - Nombre extraído de los datos
     * @returns {Object|null} - Objeto de error o null si es válido
     */
    function validateBcuData(data, dataType, nombre) {
        if (data?.errors && !nombre) {
            if (data.errors[0]?.status == 404) {
                const errorDetail = data.errors[0].detail || `No se encontraron datos ${dataType}`;
                log.error(`Error en datos BCU ${dataType}`, errorDetail);
                return {
                    title: data.errors[0].title || `Error de datos ${dataType}`,
                    error_reglas: 404,
                    detail: errorDetail,
                    score: 0
                };
            }
        }
        return null;
    }

    function containsConting(object) {
        for (const key in object) {
            const myobject = object[key];
            if ((myobject.Rubro || myobject.rubro) == 'CONTINGENCIAS') {
                return true;
            };
        }
        return false;
    }
    
    function containsVigencia(object) {
        for (const key in object) {
            const myobject = object[key];
            if ((myobject.Rubro || myobject.rubro) == 'VIGENTE') {
                return true;
            };
        }
        return false;
    }



    return {
        scoreFinal: scoreFinal,

    }

});