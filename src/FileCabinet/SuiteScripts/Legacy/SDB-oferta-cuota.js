/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define(['N/log', 'N/search', 'N/runtime', 'N/record'], function (log, search, runtime, record) {

    function onAction(scriptContext) {
        log.debug({
            title: 'Start Script'
        });
        var newRecord = scriptContext.newRecord;
        //    log.debug("newRecord", scriptContext.newRecord);
        var edad = newRecord.getValue("custentity_sdb_edad");
        var importe = newRecord.getValue("custentity_sdb_infolab_importe");
        var score = newRecord.getValue("custentity_score");
        var entidades = newRecord.getValue("custentity_sdb_entidades");
        var calificacion = newRecord.getValue("custentity_calificacion");
        var actividadId = newRecord.getValue("custentity_sdb_actividad");
        var actividad;
        if (actividadId = 1) actividad = 'Privado';
        if (actividadId = 2) actividad = 'Publico';
        if (actividadId = 3) actividad = 'Jubilado';
        if (actividadId = 4) actividad = 'banco';
        if (actividadId = 5) actividad = 'financiera';
        if (actividadId = 6) actividad = 'carta contador';
        if (actividadId = 7) actividad = 'policia';

        edad = '' + edad;
        importe = "" + importe;
        score = "" + score;
        entidades = "" + entidades;
        log.debug("test", actividad)

        if (edad && importe && score && entidades && calificacion && actividad) {

            ///
            var customrecord_oferta_finalSearchObj = search.create({
                type: "customrecord_oferta_final",
                filters:
                    [
                        ["custrecord_actividad", "startswith", actividad],
                        "AND",
                        ["custrecord_peor_calif_bcu", "startswith", calificacion]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({ name: "custrecord_edad", label: "Edad Inicial" }),
                        search.createColumn({ name: "custrecord_edad_final", label: "Edad Final" }),
                        search.createColumn({ name: "custrecord_actividad", label: "Actividad" }),
                        search.createColumn({ name: "custrecord_peor_calif_bcu", label: "Peor Calif. BCU" }),
                        search.createColumn({ name: "custrecord_salario_inicial", label: "Salario inicial" }),
                        search.createColumn({ name: "custrecord_salario_final", label: "Salario Final" }),
                        search.createColumn({ name: "custrecord_entidades_bcu_inicial", label: "Entidades BCU Inicial" }),
                        search.createColumn({ name: "custrecord_entidades_bcu_final", label: "Entidades BCU Final" }),
                        search.createColumn({ name: "custrecord_score_final", label: "Score Final" }),
                        search.createColumn({ name: "custrecord_score", label: "Score Inicial" }),
                        search.createColumn({ name: "custrecord_ponderador", label: "Ponderador" })
                    ]
            });
            var ponderadorFinal = 0;
            var flag = true;
            var searchResultCount = customrecord_oferta_finalSearchObj.runPaged().count;
            customrecord_oferta_finalSearchObj.run().each(function (result) {
                var record_edad = result.getValue('custrecord_edad')
                var record_edad_final = result.getValue('custrecord_edad_final')
                var record_actividad = result.getValue('custrecord_actividad')
                var record_peor_calif_bcu = result.getValue('custrecord_peor_calif_bcu')
                var record_peor_calif_bcu = result.getValue('custrecord_peor_calif_bcu')
                var record_salario_inicial = result.getValue('custrecord_salario_inicial')
                var record_salario_final = result.getValue('custrecord_salario_final')
                var record_entidades_bcu_inicial = result.getValue('custrecord_entidades_bcu_inicial')
                var record_entidades_bcu_final = result.getValue('custrecord_entidades_bcu_final')
                var record_score_final = result.getValue('custrecord_score_final')
                var record_score = result.getValue('custrecord_score')
                var Ponderador = result.getValue('custrecord_ponderador')

                if (edad >= record_edad && edad <= record_edad_final && importe >= record_salario_inicial && importe <= record_salario_final && score >= record_score && score <= record_score_final && entidades >= record_entidades_bcu_inicial && entidades <= record_entidades_bcu_final) {
                    ponderadorFinal = Ponderador;
                    //    log.debug("Ponderador result count", Ponderador);
                    flag = false;
                    return true;
                }
                else if (flag) {
                    //    log.debug("Ponderador result count", "no se encontro resultado")
                }
                // .run().each has a limit of 4,000 results
                return true;
            });
            log.debug("ponderadorFinal", ponderadorFinal)
            log.debug("importe", importe)
            if (ponderadorFinal == "0") ponderadorFinal = 0.1
            var valorCuota = ponderadorFinal * importe



            var customrecord_sdb_oferta_finalSearchObj = search.create({
                type: "customrecord_sdb_oferta_final",
                filters:
                    [
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "custrecord_monto_cuota",
                            sort: search.Sort.DESC,
                            label: "Monto Cuota"
                        }),
                        search.createColumn({ name: "custrecord_monto_cuota", label: "Monto Cuota" }),
                        search.createColumn({ name: "custrecord_oferta", label: "Oferta" }),
                        search.createColumn({ name: "custrecord_plazo", label: "Plazo" }),
                        search.createColumn({ name: "custrecordmonto_cuota_final", label: "Cuota Final" })
                    ]
            });
            var plazo = 0;
            var oferta = 0;
            var montoCuota = 0;
            var searchResultCount = customrecord_sdb_oferta_finalSearchObj.runPaged().count;
            //   log.debug("customrecord_sdb_oferta_finalSearchObj result count",searchResultCount);
            customrecord_sdb_oferta_finalSearchObj.run().each(function (result) {
                var monto_cuota = result.getValue('custrecord_monto_cuota')
                record_oferta = result.getValue('custrecord_oferta')
                record_plazo = result.getValue('custrecord_plazo')
                record_cuota_final = result.getValue('custrecordmonto_cuota_final')
                if (valorCuota <= monto_cuota) {
                    plazo = record_plazo;
                    oferta = record_oferta
                    montoCuota = record_cuota_final;
                    // log.debug("oferta",oferta);
                    return true;
                }

                // .run().each has a limit of 4,000 results

                return true;
            });

            //tabla de oferta
            log.debug('oferta', oferta);
            log.debug('plazo', plazo);
            log.debug('montoCuota', montoCuota);
            var tabla = "<TABLE BORDER>";
            tabla += "<TR><TH>Monto Total</TH><TH>Cuotas</TH><TH>Monto Cuota</TH>";
            tabla += "</TR><TR><TD>" + oferta + "</TD><TD>";
            tabla += plazo + "</TD><TD>" + montoCuota + "</TD>";
            tabla += "</TR>";
            tabla += "</TABLE>";


            newRecord.setValue({
                fieldId: 'custentity_sdb_montoofrecido',
                value: oferta,
            });

            newRecord.setValue({
                fieldId: 'custentity_sdb_valor_cuota',
                value: valorCuota,
            });

            newRecord.setValue({
                fieldId: 'custentity_sdb_tabla_oferta',
                value: tabla,
            });

        } else {

            var mensaje = "<h3><b>Por favor ingresar los campos de SCORE,ENTIDADES,CALIFICACION,ACTIVIDAD,EDAD y IMPORTE DECL. INGRESOS </b> </h3>"
            newRecord.setValue({
                fieldId: 'custentity_sdb_tabla_oferta',
                value: mensaje,
            });
        }
    }
    return {
        onAction: onAction
    }
});