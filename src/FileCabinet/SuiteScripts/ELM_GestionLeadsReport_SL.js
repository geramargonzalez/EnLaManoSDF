/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description Suitelet para visualizar/exportar/enviar por email el reporte de stats de gestión de vendedoras.
 */

define([
    'N/ui/serverWidget',
    'N/search',
    'N/format',
    'N/runtime',
    'N/email',
    'N/file',
    'N/log'
], function (serverWidget, search, format, runtime, email, file, log) {

    const ROLE_IDS = ['1010', '1006', '1012']; // Asesor Ventas Externo, Asesor Ventas, Backoffice Ventas

    function safeLogError(title, err) {
        try {
            const parts = [];
            if (err && err.name) parts.push('name=' + err.name);
            if (err && err.type) parts.push('type=' + err.type);
            if (err && err.code) parts.push('code=' + err.code);
            if (err && err.message) parts.push('message=' + err.message);
            if (err && err.details) parts.push('details=' + (typeof err.details === 'string' ? err.details : JSON.stringify(err.details)));

            log.error({
                title: title,
                details:
                    (parts.length ? parts.join(' | ') + '\n' : '') +
                    ((err && err.stack) ? err.stack : ((err && err.message) ? err.message : String(err)))
            });
        } catch (e) {
            // never throw from error logging
        }
    }

    function parseDateField(value) {
        if (!value) return null;
        try {
            if (value instanceof Date) return value;
            return format.parse({ value: value, type: format.Type.DATE });
        } catch (e) {
            safeLogError('parseDateField', e);
            return null;
        }
    }

    function startOfMonth(d) {
        return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    function endOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    }

    function normalizeDateRange(startDate, endDate) {
        const now = new Date();
        let start = startDate || startOfMonth(now);
        let end = endDate || endOfDay(now);

        start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
        end = endOfDay(end);

        if (start > end) {
            const tmp = start;
            start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0);
            end = endOfDay(tmp);
        }

        const label = format.format({ value: start, type: format.Type.DATE }) + ' - ' + format.format({ value: end, type: format.Type.DATE });
        return { start: start, end: end, label: label };
    }

    function buildCreatedDateFilters(startDate, endDate) {
        // En NetSuite, 'within' suele ser más estable con strings formateados según preferencias de cuenta.
        // Además, created es DateTime y pasar Date objects puede disparar UNEXPECTED_ERROR en algunos accounts.
        const startStr = format.format({ value: startDate, type: format.Type.DATE });
        const endStr = format.format({ value: endDate, type: format.Type.DATE });
        return ['created', 'within', startStr, endStr];
    }

    function keyPairValuesOptions(fieldToAdd) {
        try {
            const keyPaiValues = {};
            const ssEmployees = search.create({
                type: 'employee',
                filters: [["custentity_elm_activo", 'is', 'T']],
                columns: [search.createColumn({ name: 'altname', label: 'Name' })]
            });

            ssEmployees.run().each(function (result) {
                keyPaiValues[result.getValue({ name: 'altname' })] = result.id;
                return true;
            });

            fieldToAdd.addSelectOption({ value: '', text: '' });
            Object.entries(keyPaiValues).forEach(function (pair) {
                fieldToAdd.addSelectOption({ value: pair[1], text: pair[0] });
            });
        } catch (e) {
            safeLogError('keyPairValuesOptions', e);
        }
    }

    function getAdvisorDailyCountsByRange(startDate, endDate, operatorId) {
        // Returns array of { setBy, setByNombre, dateStr, count, uniqueLeadsSet, gestionado, pendienteDoc, enValidacion, sinRespuesta, rechazadoAsesor }
        try {
            const dateFilters = buildCreatedDateFilters(startDate, endDate);

            const filters = [
                dateFilters,
                'AND',
                ['custrecord_elm_gestion_set_by.role', 'anyof', ROLE_IDS[0], ROLE_IDS[1], ROLE_IDS[2]]
            ];

            if (operatorId) {
                filters.push('AND');
                filters.push(['custrecord_elm_gestion_set_by', 'anyof', operatorId]);
            }

            const cols = [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'custrecord_elm_gestion_set_by', label: 'Actualizado Por' }),
                search.createColumn({ name: 'custrecord_elm_gestion_estado_', label: 'Estado de Gestion' }),
                search.createColumn({ name: 'custrecord_elm_gestion_lead', label: 'Lead/Cliente' }),
                search.createColumn({ name: 'created', label: 'Date Created' })
            ];

            const s = search.create({ type: 'customrecord_elm_gestion_leads', filters: filters, columns: cols });
            const count = s.runPaged().count;
            if (!count) return [];

            const dailyMap = {};
            const operatorNames = {};

            let pageIndex = 0;
            let hasMoreResults = true;
            while (hasMoreResults && pageIndex < 10) {
                const searchResults = s.run().getRange({ start: pageIndex * 1000, end: (pageIndex + 1) * 1000 });
                if (!searchResults || !searchResults.length) break;

                for (let i = 0; i < searchResults.length; i++) {
                    const r = searchResults[i];
                    const setBy = r.getValue({ name: 'custrecord_elm_gestion_set_by' }) || '';
                    const setByNombre = r.getText({ name: 'custrecord_elm_gestion_set_by' }) || '';
                    const estado = r.getValue({ name: 'custrecord_elm_gestion_estado_' }) || '';
                    const leadId = r.getValue({ name: 'custrecord_elm_gestion_lead' }) || '';
                    const createdValue = r.getValue({ name: 'created' });

                    let dateStr = '';
                    if (createdValue) {
                        try {
                            const d = format.parse({ value: createdValue, type: format.Type.DATE });
                            const formatted = format.format({ value: d, type: format.Type.DATE });
                            const parts = String(formatted).split('/');
                            if (parts.length === 3) {
                                dateStr = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
                            }
                        } catch (parseErr) {
                            safeLogError('getAdvisorDailyCountsByRange_dateParse', parseErr);
                        }
                    }

                    if (!dateStr) continue;

                    const operatorKey = setBy || '__none';
                    const dailyKey = operatorKey + '|' + dateStr;

                    if (!operatorNames[operatorKey]) operatorNames[operatorKey] = setByNombre;

                    if (!dailyMap[dailyKey]) {
                        dailyMap[dailyKey] = {
                            count: 0,
                            uniqueLeads: new Set(),
                            gestionado: 0,
                            pendienteDoc: 0,
                            enValidacion: 0,
                            sinRespuesta: 0,
                            rechazadoAsesor: 0
                        };
                    }

                    dailyMap[dailyKey].count++;
                    if (leadId) dailyMap[dailyKey].uniqueLeads.add(leadId);

                    if (estado === '5') dailyMap[dailyKey].gestionado++;
                    else if (estado === '6') dailyMap[dailyKey].pendienteDoc++;
                    else if (estado === '7') dailyMap[dailyKey].enValidacion++;
                    else if (estado === '8') dailyMap[dailyKey].sinRespuesta++;
                    else if (estado === '24') dailyMap[dailyKey].rechazadoAsesor++;
                }

                pageIndex++;
                if (searchResults.length < 1000) hasMoreResults = false;
            }

            const results = [];
            Object.keys(dailyMap).forEach(function (dailyKey) {
                const parts = dailyKey.split('|');
                const operatorKey = parts[0];
                const dateStr = parts[1];
                const data = dailyMap[dailyKey];

                results.push({
                    setBy: operatorKey === '__none' ? null : operatorKey,
                    setByNombre: operatorNames[operatorKey] || '',
                    dateStr: dateStr,
                    count: data.count,
                    uniqueLeadsSet: data.uniqueLeads,
                    gestionado: data.gestionado,
                    pendienteDoc: data.pendienteDoc,
                    enValidacion: data.enValidacion,
                    sinRespuesta: data.sinRespuesta,
                    rechazadoAsesor: data.rechazadoAsesor
                });
            });

            return results;
        } catch (e) {
            safeLogError('getAdvisorDailyCountsByRange', e);
            return [];
        }
    }

    function calculatePercentile(arr, percentile) {
        if (!arr || arr.length === 0) return 0;
        const sorted = arr.slice().sort(function (a, b) { return a - b; });
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;
        if (lower === upper) return sorted[lower];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }

    function computeMetricsFromDailyCountsByRange(dailyCounts, startDate, endDate) {
        const daysInRange = Math.max(1, Math.round((endDate - new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) / (1000 * 60 * 60 * 24)) + 1);

        const map = {};
        (dailyCounts || []).forEach(function (r) {
            const key = (r.setBy === undefined || r.setBy === null) ? '__none' : String(r.setBy);
            if (!map[key]) {
                map[key] = {
                    setBy: r.setBy,
                    setByNombre: r.setByNombre || '',
                    totals: 0,
                    uniqueLeadsSet: new Set(),
                    gestionado: 0,
                    pendienteDoc: 0,
                    enValidacion: 0,
                    sinRespuesta: 0,
                    rechazadoAsesor: 0,
                    daysActiveSet: new Set(),
                    dailyCounts: []
                };
            }

            map[key].totals += (r.count || 0);
            if (r.uniqueLeadsSet && r.uniqueLeadsSet.size > 0) {
                r.uniqueLeadsSet.forEach(function (leadId) {
                    map[key].uniqueLeadsSet.add(leadId);
                });
            }

            map[key].gestionado += (r.gestionado || 0);
            map[key].pendienteDoc += (r.pendienteDoc || 0);
            map[key].enValidacion += (r.enValidacion || 0);
            map[key].sinRespuesta += (r.sinRespuesta || 0);
            map[key].rechazadoAsesor += (r.rechazadoAsesor || 0);
            map[key].dailyCounts.push(r.count || 0);
            if (r.count && r.count > 0) map[key].daysActiveSet.add(r.dateStr);
        });

        const metrics = Object.keys(map).map(function (k) {
            const item = map[k];
            const total = item.totals;
            const uniqueLeads = item.uniqueLeadsSet.size;
            const daysActive = item.daysActiveSet.size;

            const median = calculatePercentile(item.dailyCounts, 50);
            const percentile25 = calculatePercentile(item.dailyCounts, 25);
            const percentile75 = calculatePercentile(item.dailyCounts, 75);

            const avg = total / daysInRange;
            const dailyAvg = daysActive > 0 ? total / daysActive : 0;

            const pctGestionado = total > 0 ? (item.gestionado / total) * 100 : 0;
            const pctPendienteDoc = total > 0 ? (item.pendienteDoc / total) * 100 : 0;
            const pctEnValidacion = total > 0 ? (item.enValidacion / total) * 100 : 0;
            const pctSinRespuesta = total > 0 ? (item.sinRespuesta / total) * 100 : 0;
            const pctRechazadoAsesor = total > 0 ? (item.rechazadoAsesor / total) * 100 : 0;

            return {
                setBy: item.setBy,
                setByNombre: item.setByNombre,
                total: total,
                uniqueLeads: uniqueLeads,
                gestionado: item.gestionado,
                pendienteDoc: item.pendienteDoc,
                enValidacion: item.enValidacion,
                sinRespuesta: item.sinRespuesta,
                rechazadoAsesor: item.rechazadoAsesor,
                daysActive: daysActive,
                avg: avg,
                dailyAvg: dailyAvg,
                median: median,
                percentile25: percentile25,
                percentile75: percentile75,
                pctGestionado: pctGestionado,
                pctPendienteDoc: pctPendienteDoc,
                pctEnValidacion: pctEnValidacion,
                pctSinRespuesta: pctSinRespuesta,
                pctRechazadoAsesor: pctRechazadoAsesor
            };
        });

        metrics.sort(function (a, b) { return (b.total || 0) - (a.total || 0); });
        return { metrics: metrics, daysInRange: daysInRange };
    }

    function getOperatorTimeOffByRange(startDate, endDate, operatorId) {
        try {
            const dateFilters = buildCreatedDateFilters(startDate, endDate);
            const filters = [dateFilters];

            if (operatorId) {
                filters.push('AND');
                filters.push(['custrecord_elm_estado_operador', 'anyof', operatorId]);
            }

            const cols = [
                search.createColumn({ name: 'custrecord_elm_motivo_ausencia', label: 'Motivo de Ausencia' }),
                search.createColumn({
                    name: 'formulanumeric',
                    formula: "((TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'J')) * 1440 + TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'HH24')) * 60 + TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'MI')))-(TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'J')) * 1440 + TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'HH24')) * 60 + TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'MI'))))",
                    label: 'Minutos'
                }),
                search.createColumn({ name: 'custrecord_elm_estado_operador', label: 'Operador' })
            ];

            const s = search.create({ type: 'customrecord_elm_est_vend', filters: filters, columns: cols });
            const count = s.runPaged().count;
            if (!count) return [];

            const operatorMap = {};

            let pageIndex = 0;
            let hasMoreResults = true;
            while (hasMoreResults && pageIndex < 10) {
                const searchResults = s.run().getRange({ start: pageIndex * 1000, end: (pageIndex + 1) * 1000 });
                if (!searchResults || !searchResults.length) break;

                for (let i = 0; i < searchResults.length; i++) {
                    const r = searchResults[i];
                    const opId = r.getValue({ name: 'custrecord_elm_estado_operador' }) || '';
                    const opName = r.getText({ name: 'custrecord_elm_estado_operador' }) || '';
                    const motivoId = r.getValue({ name: 'custrecord_elm_motivo_ausencia' }) || '';
                    const motivoNombre = r.getText({ name: 'custrecord_elm_motivo_ausencia' }) || '';
                    const minutos = parseFloat(r.getValue({ name: 'formulanumeric' })) || 0;

                    if (motivoNombre && String(motivoNombre).toLowerCase().indexOf('fin de jornada') !== -1) continue;

                    const operatorKey = opId || '__none';
                    if (!operatorMap[operatorKey]) {
                        operatorMap[operatorKey] = {
                            operatorId: opId,
                            operatorName: opName,
                            totalMinutes: 0,
                            motivos: {}
                        };
                    }

                    operatorMap[operatorKey].totalMinutes += minutos;

                    const motivoKey = motivoId || '__none';
                    if (!operatorMap[operatorKey].motivos[motivoKey]) {
                        operatorMap[operatorKey].motivos[motivoKey] = {
                            nombre: motivoNombre || 'Sin Motivo',
                            minutos: 0
                        };
                    }
                    operatorMap[operatorKey].motivos[motivoKey].minutos += minutos;
                }

                pageIndex++;
                if (searchResults.length < 1000) hasMoreResults = false;
            }

            const results = [];
            Object.keys(operatorMap).forEach(function (key) {
                const data = operatorMap[key];
                results.push({
                    operatorId: data.operatorId,
                    operatorName: data.operatorName,
                    totalMinutes: data.totalMinutes,
                    totalHours: (data.totalMinutes / 60).toFixed(2),
                    motivos: data.motivos
                });
            });

            return results;
        } catch (e) {
            safeLogError('getOperatorTimeOffByRange', e);
            return [];
        }
    }

    function getLeadsAssignedByRange(startDate, endDate, operatorId) {
        try {
            const dateFilters = buildCreatedDateFilters(startDate, endDate);
            const filters = [dateFilters];
            if (operatorId) {
                filters.push('AND');
                filters.push(['custrecord_elm_operador_operador', 'anyof', operatorId]);
            }

            const cols = [
                search.createColumn({ name: 'custrecord_elm_operador_operador', summary: 'GROUP', label: 'Operador' }),
                search.createColumn({ name: 'custrecord_elm_operador_cliente', summary: 'COUNT', label: 'Lead/Cliente' })
            ];

            const s = search.create({ type: 'customrecord_elm_operador_lead', filters: filters, columns: cols });
            const count = s.runPaged().count;
            if (!count) return [];

            const results = [];
            s.run().each(function (result) {
                results.push({
                    operatorId: result.getValue({ name: 'custrecord_elm_operador_operador', summary: 'GROUP' }) || '',
                    operatorName: result.getText({ name: 'custrecord_elm_operador_operador', summary: 'GROUP' }) || '',
                    leadsAssigned: parseInt(result.getValue({ name: 'custrecord_elm_operador_cliente', summary: 'COUNT' }), 10) || 0
                });
                return true;
            });

            results.sort(function (a, b) { return (b.leadsAssigned || 0) - (a.leadsAssigned || 0); });
            return results;
        } catch (e) {
            safeLogError('getLeadsAssignedByRange', e);
            return [];
        }
    }

    function buildHtmlReport(metricsArray, timeOffArray, leadsAssignedArray, label) {
        // Reusa estilo del scheduled; sirve para cuerpo de email.
        const css = 'body{font-family: Arial, Helvetica, sans-serif; color:#333;} .report-title{text-align:center; font-size:18px; margin-bottom:12px;} table.report{width:100%; border-collapse:collapse; margin-bottom:6px;} table.report th{background:#f0f0f0; padding:6px; text-align:left; border:1px solid #ddd;} table.report td{padding:6px; border:1px solid #eee;}';
        let html = '<html><head><meta charset="utf-8"/><style>' + css + '</style></head><body>';
        html += '<div class="report-title">Reporte Gestión de Ventas — ' + (label || '') + '</div>';

        if (!metricsArray || !metricsArray.length) {
            html += '<p>No se encontraron leads para el período seleccionado.</p>';
            html += '</body></html>';
            return html;
        }

        html += '<h3 style="margin-top:10px; text-align:center; color:#2f6f9f;">Resumen de Gestiones por Operador</h3>';
        html += '<table class="report"><thead><tr><th>Operador</th><th style="text-align:right;">Total Gestiones</th><th style="text-align:right;">Leads Únicos</th><th style="text-align:right;">Gestionado</th><th style="text-align:right;">Pendiente Doc</th><th style="text-align:right;">En Validación</th><th style="text-align:right;">Sin Respuesta</th><th style="text-align:right;">Rechazado</th><th style="text-align:right;">Mediana</th><th style="text-align:right;">Cuartil Inferior</th><th style="text-align:right;">Máximo Típico</th><th style="text-align:right;">Promedio</th></tr></thead><tbody>';

        metricsArray.forEach(function (s) {
            const operatorName = s.setByNombre || s.setBy || 'Sin Operador';
            const avg = (typeof s.avg === 'number') ? s.avg.toFixed(2) : '0.00';
            const median = (typeof s.median === 'number') ? s.median.toFixed(2) : '0.00';
            const p25 = (typeof s.percentile25 === 'number') ? s.percentile25.toFixed(2) : '0.00';
            const p75 = (typeof s.percentile75 === 'number') ? s.percentile75.toFixed(2) : '0.00';

            html += '<tr>' +
                '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>' +
                '<td style="text-align:right;">' + (s.total || 0) + '</td>' +
                '<td style="text-align:right; background:#fff3e0; font-weight:bold;">' + (s.uniqueLeads || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.gestionado || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.pendienteDoc || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.enValidacion || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.sinRespuesta || 0) + '</td>' +
                '<td style="text-align:right;">' + (s.rechazadoAsesor || 0) + '</td>' +
                '<td style="text-align:right;">' + median + '</td>' +
                '<td style="text-align:right;">' + p25 + '</td>' +
                '<td style="text-align:right;">' + p75 + '</td>' +
                '<td style="text-align:right;">' + avg + '</td>' +
                '</tr>';
        });
        html += '</tbody></table>';

        html += '<h3 style="margin-top:20px; text-align:center; color:#2f6f9f;">Métricas de Productividad y Tasas de Conversión</h3>';
        html += '<table class="report"><thead><tr><th>Operador</th><th style="text-align:right;">Días Activos</th><th style="text-align:right;">Prom/Día Activo</th><th style="text-align:right;">% Gestionado</th><th style="text-align:right;">% Pendiente Doc</th><th style="text-align:right;">% En Validación</th><th style="text-align:right;">% Sin Respuesta</th><th style="text-align:right;">% Rechazado</th></tr></thead><tbody>';

        metricsArray.forEach(function (s) {
            const operatorName = s.setByNombre || s.setBy || 'Sin Operador';
            const dailyAvg = (typeof s.dailyAvg === 'number') ? s.dailyAvg.toFixed(2) : '0.00';
            const pctGestionado = (typeof s.pctGestionado === 'number') ? s.pctGestionado.toFixed(1) : '0.0';
            const pctPendienteDoc = (typeof s.pctPendienteDoc === 'number') ? s.pctPendienteDoc.toFixed(1) : '0.0';
            const pctEnValidacion = (typeof s.pctEnValidacion === 'number') ? s.pctEnValidacion.toFixed(1) : '0.0';
            const pctSinRespuesta = (typeof s.pctSinRespuesta === 'number') ? s.pctSinRespuesta.toFixed(1) : '0.0';
            const pctRechazado = (typeof s.pctRechazadoAsesor === 'number') ? s.pctRechazadoAsesor.toFixed(1) : '0.0';

            html += '<tr>' +
                '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>' +
                '<td style="text-align:right;">' + (s.daysActive || 0) + '</td>' +
                '<td style="text-align:right;">' + dailyAvg + '</td>' +
                '<td style="text-align:right;">' + pctGestionado + '%</td>' +
                '<td style="text-align:right;">' + pctPendienteDoc + '%</td>' +
                '<td style="text-align:right;">' + pctEnValidacion + '%</td>' +
                '<td style="text-align:right;">' + pctSinRespuesta + '%</td>' +
                '<td style="text-align:right;">' + pctRechazado + '%</td>' +
                '</tr>';
        });
        html += '</tbody></table>';

        if (timeOffArray && timeOffArray.length) {
            html += '<h3 style="margin-top:20px; text-align:center; color:#2f6f9f;">Tiempo Off por Operador</h3>';

            const allMotivos = {};
            timeOffArray.forEach(function (t) {
                Object.keys(t.motivos || {}).forEach(function (motivoKey) {
                    const motivo = t.motivos[motivoKey];
                    if (!allMotivos[motivoKey]) allMotivos[motivoKey] = motivo.nombre;
                });
            });

            html += '<table class="report"><thead><tr><th>Operador</th><th style="text-align:right;">Total Tiempo</th>';
            Object.keys(allMotivos).forEach(function (motivoKey) {
                html += '<th style="text-align:right;">% ' + allMotivos[motivoKey] + '</th>';
            });
            html += '</tr></thead><tbody>';

            timeOffArray.forEach(function (t) {
                const operatorName = t.operatorName || t.operatorId || 'Sin Operador';
                const totalMinutes = t.totalMinutes || 0;
                const displayTime = totalMinutes < 60 ? totalMinutes.toFixed(0) + ' min' : (totalMinutes / 60).toFixed(2) + ' hrs';

                html += '<tr>';
                html += '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>';
                html += '<td style="text-align:right; background:#fff3e0; font-weight:bold;">' + displayTime + '</td>';

                Object.keys(allMotivos).forEach(function (motivoKey) {
                    const motivo = t.motivos[motivoKey];
                    const minutos = motivo ? motivo.minutos : 0;
                    const porcentaje = totalMinutes > 0 ? ((minutos / totalMinutes) * 100).toFixed(1) : '0.0';
                    html += '<td style="text-align:right;">' + porcentaje + '%</td>';
                });

                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        if (leadsAssignedArray && leadsAssignedArray.length) {
            html += '<h3 style="margin-top:20px; text-align:center; color:#2f6f9f;">Leads Asignados por Operador</h3>';
            html += '<table class="report"><thead><tr><th>Operador</th><th style="text-align:right;">Leads Asignados</th></tr></thead><tbody>';
            leadsAssignedArray.forEach(function (l) {
                const operatorName = l.operatorName || l.operatorId || 'Sin Operador';
                html += '<tr><td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td><td style="text-align:right; background:#e3f2fd; font-weight:bold;">' + (l.leadsAssigned || 0) + '</td></tr>';
            });
            html += '</tbody></table>';
        }

        html += '</body></html>';
        return html;
    }

    function buildCsv(metricsArray, timeOffArray, leadsAssignedArray) {
        const lines = [];

        lines.push('Resumen de Gestiones por Operador');
        lines.push(['Operador', 'Total Gestiones', 'Leads Únicos', 'Gestionado', 'Pendiente Doc', 'En Validación', 'Sin Respuesta', 'Rechazado', 'Mediana', 'Cuartil Inferior', 'Máximo Típico', 'Promedio'].join(','));
        (metricsArray || []).forEach(function (m) {
            const name = '"' + String(m.setByNombre || m.setBy || '').replace(/"/g, '""') + '"';
            lines.push([
                name,
                m.total || 0,
                m.uniqueLeads || 0,
                m.gestionado || 0,
                m.pendienteDoc || 0,
                m.enValidacion || 0,
                m.sinRespuesta || 0,
                m.rechazadoAsesor || 0,
                (typeof m.median === 'number') ? m.median.toFixed(2) : (m.median || 0),
                (typeof m.percentile25 === 'number') ? m.percentile25.toFixed(2) : (m.percentile25 || 0),
                (typeof m.percentile75 === 'number') ? m.percentile75.toFixed(2) : (m.percentile75 || 0),
                (typeof m.avg === 'number') ? m.avg.toFixed(2) : (m.avg || 0)
            ].join(','));
        });

        lines.push('');
        lines.push('Métricas de Productividad y Tasas de Conversión');
        lines.push(['Operador', 'Días Activos', 'Prom/Día Activo', '% Gestionado', '% Pendiente Doc', '% En Validación', '% Sin Respuesta', '% Rechazado'].join(','));
        (metricsArray || []).forEach(function (m) {
            const name = '"' + String(m.setByNombre || m.setBy || '').replace(/"/g, '""') + '"';
            lines.push([
                name,
                m.daysActive || 0,
                (typeof m.dailyAvg === 'number') ? m.dailyAvg.toFixed(2) : (m.dailyAvg || 0),
                (typeof m.pctGestionado === 'number') ? m.pctGestionado.toFixed(1) : (m.pctGestionado || 0),
                (typeof m.pctPendienteDoc === 'number') ? m.pctPendienteDoc.toFixed(1) : (m.pctPendienteDoc || 0),
                (typeof m.pctEnValidacion === 'number') ? m.pctEnValidacion.toFixed(1) : (m.pctEnValidacion || 0),
                (typeof m.pctSinRespuesta === 'number') ? m.pctSinRespuesta.toFixed(1) : (m.pctSinRespuesta || 0),
                (typeof m.pctRechazadoAsesor === 'number') ? m.pctRechazadoAsesor.toFixed(1) : (m.pctRechazadoAsesor || 0)
            ].join(','));
        });

        if (timeOffArray && timeOffArray.length) {
            lines.push('');
            lines.push('Tiempo Off por Operador');

            const allMotivos = {};
            timeOffArray.forEach(function (t) {
                Object.keys(t.motivos || {}).forEach(function (motivoKey) {
                    const motivo = t.motivos[motivoKey];
                    if (!allMotivos[motivoKey]) allMotivos[motivoKey] = motivo.nombre;
                });
            });

            const header = ['Operador', 'Total Minutos'].concat(Object.keys(allMotivos).map(function (k) { return '% ' + allMotivos[k]; }));
            lines.push(header.join(','));

            timeOffArray.forEach(function (t) {
                const name = '"' + String(t.operatorName || t.operatorId || '').replace(/"/g, '""') + '"';
                const totalMinutes = t.totalMinutes || 0;
                const row = [name, totalMinutes];
                Object.keys(allMotivos).forEach(function (motivoKey) {
                    const motivo = t.motivos[motivoKey];
                    const minutos = motivo ? motivo.minutos : 0;
                    const porcentaje = totalMinutes > 0 ? ((minutos / totalMinutes) * 100).toFixed(1) : '0.0';
                    row.push(porcentaje);
                });
                lines.push(row.join(','));
            });
        }

        if (leadsAssignedArray && leadsAssignedArray.length) {
            lines.push('');
            lines.push('Leads Asignados por Operador');
            lines.push(['Operador', 'Leads Asignados'].join(','));
            leadsAssignedArray.forEach(function (l) {
                const name = '"' + String(l.operatorName || l.operatorId || '').replace(/"/g, '""') + '"';
                lines.push([name, l.leadsAssigned || 0].join(','));
            });
        }

        return lines.join('\r\n');
    }

    function safeLabelForFilename(label) {
        return String(label || '').replace(/[^a-z0-9\-\_\s]/gi, '_').trim().replace(/\s+/g, '_');
    }

    function addSummarySublist(form) {
        const sublist = form.addSublist({
            id: 'custpage_summary',
            label: 'Resumen de Gestiones por Operador',
            type: serverWidget.SublistType.LIST
        });

        sublist.addField({ id: 'custpage_sum_operador', label: 'Operador', type: serverWidget.FieldType.TEXT });
        sublist.addField({ id: 'custpage_sum_total', label: 'Total Gestiones', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_unique', label: 'Leads Únicos', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_gestionado', label: 'Gestionado', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_pendiente', label: 'Pendiente Doc', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_validacion', label: 'En Validación', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_sinresp', label: 'Sin Respuesta', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_rechazado', label: 'Rechazado', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_sum_mediana', label: 'Mediana', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_sum_p25', label: 'Cuartil Inferior', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_sum_p75', label: 'Máximo Típico', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_sum_avg', label: 'Promedio', type: serverWidget.FieldType.FLOAT });

        return sublist;
    }

    function addProductivitySublist(form) {
        const sublist = form.addSublist({
            id: 'custpage_productivity',
            label: 'Métricas de Productividad y Tasas de Conversión',
            type: serverWidget.SublistType.LIST
        });

        sublist.addField({ id: 'custpage_prod_operador', label: 'Operador', type: serverWidget.FieldType.TEXT });
        sublist.addField({ id: 'custpage_prod_days', label: 'Días Activos', type: serverWidget.FieldType.INTEGER });
        sublist.addField({ id: 'custpage_prod_dailyavg', label: 'Prom/Día Activo', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_prod_pct_gest', label: '% Gestionado', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_prod_pct_pend', label: '% Pendiente Doc', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_prod_pct_val', label: '% En Validación', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_prod_pct_sin', label: '% Sin Respuesta', type: serverWidget.FieldType.FLOAT });
        sublist.addField({ id: 'custpage_prod_pct_rech', label: '% Rechazado', type: serverWidget.FieldType.FLOAT });

        return sublist;
    }

    function addTimeOffSublist(form, timeOffArray) {
        const sublist = form.addSublist({
            id: 'custpage_timeoff',
            label: 'Tiempo Off por Operador',
            type: serverWidget.SublistType.LIST
        });

        sublist.addField({ id: 'custpage_to_operador', label: 'Operador', type: serverWidget.FieldType.TEXT });
        sublist.addField({ id: 'custpage_to_total', label: 'Total Tiempo', type: serverWidget.FieldType.TEXT });

        const allMotivos = {};
        (timeOffArray || []).forEach(function (t) {
            Object.keys(t.motivos || {}).forEach(function (motivoKey) {
                const motivo = t.motivos[motivoKey];
                if (!allMotivos[motivoKey]) allMotivos[motivoKey] = motivo.nombre;
            });
        });

        const motivoKeys = Object.keys(allMotivos);
        motivoKeys.forEach(function (motivoKey) {
            const fieldId = 'custpage_to_m_' + String(motivoKey).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
            sublist.addField({ id: fieldId, label: '% ' + allMotivos[motivoKey], type: serverWidget.FieldType.FLOAT });
        });

        return { sublist: sublist, motivoKeys: motivoKeys, allMotivos: allMotivos };
    }

    function addLeadsAssignedSublist(form) {
        const sublist = form.addSublist({
            id: 'custpage_leadsassigned',
            label: 'Leads Asignados por Operador',
            type: serverWidget.SublistType.LIST
        });

        sublist.addField({ id: 'custpage_la_operador', label: 'Operador', type: serverWidget.FieldType.TEXT });
        sublist.addField({ id: 'custpage_la_count', label: 'Leads Asignados', type: serverWidget.FieldType.INTEGER });

        return sublist;
    }

    function populateSublists(form, metricsArray, timeOffArray, leadsAssignedArray) {
        const summary = addSummarySublist(form);
        const productivity = addProductivitySublist(form);
        const timeOffInfo = addTimeOffSublist(form, timeOffArray);
        const leadsAssigned = addLeadsAssignedSublist(form);

        (metricsArray || []).forEach(function (m, idx) {
            summary.setSublistValue({ id: 'custpage_sum_operador', line: idx, value: String(m.setByNombre || m.setBy || 'Sin Operador') });
            summary.setSublistValue({ id: 'custpage_sum_total', line: idx, value: String(m.total || 0) });
            summary.setSublistValue({ id: 'custpage_sum_unique', line: idx, value: String(m.uniqueLeads || 0) });
            summary.setSublistValue({ id: 'custpage_sum_gestionado', line: idx, value: String(m.gestionado || 0) });
            summary.setSublistValue({ id: 'custpage_sum_pendiente', line: idx, value: String(m.pendienteDoc || 0) });
            summary.setSublistValue({ id: 'custpage_sum_validacion', line: idx, value: String(m.enValidacion || 0) });
            summary.setSublistValue({ id: 'custpage_sum_sinresp', line: idx, value: String(m.sinRespuesta || 0) });
            summary.setSublistValue({ id: 'custpage_sum_rechazado', line: idx, value: String(m.rechazadoAsesor || 0) });
            summary.setSublistValue({ id: 'custpage_sum_mediana', line: idx, value: String((typeof m.median === 'number') ? m.median.toFixed(2) : (m.median || 0)) });
            summary.setSublistValue({ id: 'custpage_sum_p25', line: idx, value: String((typeof m.percentile25 === 'number') ? m.percentile25.toFixed(2) : (m.percentile25 || 0)) });
            summary.setSublistValue({ id: 'custpage_sum_p75', line: idx, value: String((typeof m.percentile75 === 'number') ? m.percentile75.toFixed(2) : (m.percentile75 || 0)) });
            summary.setSublistValue({ id: 'custpage_sum_avg', line: idx, value: String((typeof m.avg === 'number') ? m.avg.toFixed(2) : (m.avg || 0)) });

            productivity.setSublistValue({ id: 'custpage_prod_operador', line: idx, value: String(m.setByNombre || m.setBy || 'Sin Operador') });
            productivity.setSublistValue({ id: 'custpage_prod_days', line: idx, value: String(m.daysActive || 0) });
            productivity.setSublistValue({ id: 'custpage_prod_dailyavg', line: idx, value: String((typeof m.dailyAvg === 'number') ? m.dailyAvg.toFixed(2) : (m.dailyAvg || 0)) });
            productivity.setSublistValue({ id: 'custpage_prod_pct_gest', line: idx, value: String((typeof m.pctGestionado === 'number') ? m.pctGestionado.toFixed(1) : (m.pctGestionado || 0)) });
            productivity.setSublistValue({ id: 'custpage_prod_pct_pend', line: idx, value: String((typeof m.pctPendienteDoc === 'number') ? m.pctPendienteDoc.toFixed(1) : (m.pctPendienteDoc || 0)) });
            productivity.setSublistValue({ id: 'custpage_prod_pct_val', line: idx, value: String((typeof m.pctEnValidacion === 'number') ? m.pctEnValidacion.toFixed(1) : (m.pctEnValidacion || 0)) });
            productivity.setSublistValue({ id: 'custpage_prod_pct_sin', line: idx, value: String((typeof m.pctSinRespuesta === 'number') ? m.pctSinRespuesta.toFixed(1) : (m.pctSinRespuesta || 0)) });
            productivity.setSublistValue({ id: 'custpage_prod_pct_rech', line: idx, value: String((typeof m.pctRechazadoAsesor === 'number') ? m.pctRechazadoAsesor.toFixed(1) : (m.pctRechazadoAsesor || 0)) });
        });

        (timeOffArray || []).forEach(function (t, idx) {
            const operatorName = String(t.operatorName || t.operatorId || 'Sin Operador');
            const totalMinutes = t.totalMinutes || 0;
            const displayTime = totalMinutes < 60 ? totalMinutes.toFixed(0) + ' min' : (totalMinutes / 60).toFixed(2) + ' hrs';

            timeOffInfo.sublist.setSublistValue({ id: 'custpage_to_operador', line: idx, value: operatorName });
            timeOffInfo.sublist.setSublistValue({ id: 'custpage_to_total', line: idx, value: displayTime });

            timeOffInfo.motivoKeys.forEach(function (motivoKey) {
                const fieldId = 'custpage_to_m_' + String(motivoKey).replace(/[^a-z0-9_]/gi, '_').toLowerCase();
                const motivo = t.motivos ? t.motivos[motivoKey] : null;
                const minutos = motivo ? motivo.minutos : 0;
                const porcentaje = totalMinutes > 0 ? ((minutos / totalMinutes) * 100).toFixed(1) : '0.0';
                timeOffInfo.sublist.setSublistValue({ id: fieldId, line: idx, value: String(porcentaje) });
            });
        });

        (leadsAssignedArray || []).forEach(function (l, idx) {
            leadsAssigned.setSublistValue({ id: 'custpage_la_operador', line: idx, value: String(l.operatorName || l.operatorId || 'Sin Operador') });
            leadsAssigned.setSublistValue({ id: 'custpage_la_count', line: idx, value: String(l.leadsAssigned || 0) });
        });
    }

    function createForm(defaults, message) {
        const form = serverWidget.createForm({ title: 'Reporte Gestión de Ventas (Stats)' });
        form.clientScriptModulePath = './ELM_GestionLeadsReport_CL.js'; 

        const fldOperator = form.addField({
            id: 'custpage_operator',
            label: 'Operador',
            type: serverWidget.FieldType.SELECT
        });
        keyPairValuesOptions(fldOperator);

        const fldStart = form.addField({
            id: 'custpage_startdate',
            label: 'Fecha desde',
            type: serverWidget.FieldType.DATE
        });
        const fldEnd = form.addField({
            id: 'custpage_enddate',
            label: 'Fecha hasta',
            type: serverWidget.FieldType.DATE
        });

        const fldEmail = form.addField({
            id: 'custpage_email_to',
            label: 'Enviar a (emails separados por coma)',
            type: serverWidget.FieldType.TEXT
        });
        fldEmail.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.STARTROW });

        const fldAction = form.addField({
            id: 'custpage_action',
            label: 'Action',
            type: serverWidget.FieldType.TEXT
        });
        fldAction.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        if (message) {
            const msgField = form.addField({
                id: 'custpage_msg',
                label: 'Mensaje',
                type: serverWidget.FieldType.INLINEHTML
            });
            msgField.defaultValue = '<div style="padding:8px; background:#f5f5f5; border-left:4px solid #2f6f9f;">' + message + '</div>';
        }

        form.addSubmitButton({ label: 'Filtrar' });
        form.addButton({ id: 'custpage_btn_csv', label: 'Exportar CSV', functionName: 'elmExportCsv' });
        form.addButton({ id: 'custpage_btn_xls', label: 'Exportar Excel', functionName: 'elmExportExcel' });
        form.addButton({ id: 'custpage_btn_email', label: 'Enviar por Email', functionName: 'elmSendEmail' });

        if (defaults) {
            form.updateDefaultValues(defaults);
        }

        return form;
    }

    function sendEmailReport(recipients, subject, htmlBody, attachments) {
        const author = (runtime.getCurrentUser && runtime.getCurrentUser()) ? runtime.getCurrentUser().id : null;
        if (!recipients) throw new Error('Debe indicar destinatarios.');

        const toList = String(recipients).split(',').map(function (v) { return v.trim(); }).filter(Boolean);
        if (!toList.length) throw new Error('Debe indicar destinatarios válidos.');

        email.send({
            author: author,
            recipients: toList,
            subject: subject,
            body: htmlBody,
            attachments: attachments && attachments.length ? attachments : undefined
        });
    }

    function onRequest(context) {
        const req = context.request;
        const params = req.parameters || {};

        const operatorId = params.custpage_operator || params.operator || '';
        const startDate = parseDateField(params.custpage_startdate || params.startdate);
        const endDate = parseDateField(params.custpage_enddate || params.enddate);
        const emailTo = params.custpage_email_to || params.email_to || '';
        const action = params.custpage_action || params.action || '';

        const range = normalizeDateRange(startDate, endDate);

        const defaults = {
            custpage_operator: operatorId || '',
            custpage_startdate: format.format({ value: range.start, type: format.Type.DATE }),
            custpage_enddate: format.format({ value: range.end, type: format.Type.DATE }),
            custpage_email_to: emailTo || ''
        };

        if (req.method === 'GET') {
            const form = createForm(defaults);
            context.response.writePage(form);
            return;
        }

        // POST: filtrar / exportar / email
        const dailyCounts = getAdvisorDailyCountsByRange(range.start, range.end, operatorId);
        const computed = computeMetricsFromDailyCountsByRange(dailyCounts, range.start, range.end);
        const metricsArray = computed.metrics || [];

        const timeOffArray = getOperatorTimeOffByRange(range.start, range.end, operatorId);
        const leadsAssignedArray = getLeadsAssignedByRange(range.start, range.end, operatorId);

        const periodLabel = range.label;
        const safeLabel = safeLabelForFilename(periodLabel || 'reporte');

        if (String(action).toLowerCase() === 'export_csv') {
            const csvContent = buildCsv(metricsArray, timeOffArray, leadsAssignedArray);
            const csvFile = file.create({
                name: 'ELM_Gestion_Report_' + safeLabel + '.csv',
                fileType: file.Type.CSV,
                contents: csvContent
            });
            context.response.writeFile({ file: csvFile, isInline: false });
            return;
        }

        if (String(action).toLowerCase() === 'export_excel') {
            // Excel abre HTML como .xls (compat). No depende de file.Type.EXCEL.
            const html = buildHtmlReport(metricsArray, timeOffArray, leadsAssignedArray, periodLabel);
            const xlsFile = file.create({
                name: 'ELM_Gestion_Report_' + safeLabel + '.xls',
                fileType: file.Type.HTMLDOC,
                contents: html
            });
            context.response.writeFile({ file: xlsFile, isInline: false });
            return;
        }

        if (String(action).toLowerCase() === 'send_email') {
            try {
                const html = buildHtmlReport(metricsArray, timeOffArray, leadsAssignedArray, periodLabel);
                const csvContent = buildCsv(metricsArray, timeOffArray, leadsAssignedArray);
                const csvFile = file.create({
                    name: 'ELM_Gestion_Report_' + safeLabel + '.csv',
                    fileType: file.Type.CSV,
                    contents: csvContent
                });
                const subject = 'ELM - Reporte Gestión de Ventas - ' + periodLabel;

                sendEmailReport(emailTo, subject, html, [csvFile]);

                const form = createForm(defaults, 'Email enviado a: <strong>' + String(emailTo) + '</strong>');
                populateSublists(form, metricsArray, timeOffArray, leadsAssignedArray);
                context.response.writePage(form);
                return;
            } catch (e) {
                const form = createForm(defaults, 'Error enviando email: <strong>' + (e && e.message ? e.message : String(e)) + '</strong>');
                populateSublists(form, metricsArray, timeOffArray, leadsAssignedArray);
                context.response.writePage(form);
                return;
            }
        }

        // Default: mostrar en pantalla
        const form = createForm(defaults);
        populateSublists(form, metricsArray, timeOffArray, leadsAssignedArray);
        context.response.writePage(form);
    }

    return {
        onRequest: onRequest
    };
});
