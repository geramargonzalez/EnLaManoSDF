
/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @description Script programado para asignar leads a operadores disponibles
 */

define(['N/search','N/email','N/runtime','N/log','N/format','N/file'],
function(search, email, runtime, log, format, file) {

    function buildFullReportHtml(summaryArray, timeOffArray, periodLabel) {
        // summaryArray: [{ setBy, setByNombre, total, uniqueLeads, gestionado, pendienteDoc, enValidacion, sinRespuesta, rechazadoAsesor, daysActive, avg, dailyAvg, median, percentile25, percentile75, pctGestionado, pctPendienteDoc, pctEnValidacion, pctSinRespuesta, pctRechazadoAsesor }]
        const css = 'body{font-family: Arial, Helvetica, sans-serif; color:#333;} .report-title{text-align:center; font-size:18px; margin-bottom:12px;} table.report{width:100%; border-collapse:collapse; margin-bottom:6px;} table.report th{background:#f0f0f0; padding:6px; text-align:left; border:1px solid #ddd;} table.report td{padding:6px; border:1px solid #eee;}';

        let html = '<html><head><meta charset="utf-8"/><style>' + css + '</style></head><body>';
        const todayLabel = periodLabel || (format ? format.format({ value: new Date(), type: format.Type.DATE }) : (new Date()).toLocaleDateString());
        html += '<div class="report-title">Reporte Gestión de Ventas — ' + todayLabel + '</div>';

        try {
            if (!summaryArray || !summaryArray.length) {
                html += '<p>No se encontraron leads para el período seleccionado.</p>';
                html += '</body></html>';
                return html;
            }
            
            // Primera tabla: Métricas principales
            html += '<h3 style="margin-top:10px; text-align:center; color:#2f6f9f;">Resumen de Gestiones por Operador</h3>';
            html += '<table class="report" style="margin-top:10px;"><thead><tr><th>Operador</th><th style="text-align:right;">Total Gestiones</th><th style="text-align:right;">Leads Únicos</th><th style="text-align:right;">Gestionado</th><th style="text-align:right;">Pendiente Doc</th><th style="text-align:right;">En Validación</th><th style="text-align:right;">Sin Respuesta</th><th style="text-align:right;">Rechazado</th><th style="text-align:right;">Mediana</th><th style="text-align:right;">P25</th><th style="text-align:right;">P75</th><th style="text-align:right;">Promedio</th></tr></thead><tbody>';
            
            summaryArray.forEach(function(s) {
                const operatorName = s.setByNombre || s.setBy || 'Sin Operador';
                const total = s.total || 0;
                const uniqueLeads = s.uniqueLeads || 0;
                const gestionado = s.gestionado || 0;
                const pendienteDoc = s.pendienteDoc || 0;
                const enValidacion = s.enValidacion || 0;
                const sinRespuesta = s.sinRespuesta || 0;
                const rechazadoAsesor = s.rechazadoAsesor || 0;
                const avg = (typeof s.avg === 'number') ? s.avg.toFixed(2) : '0.00';
                const median = (typeof s.median === 'number') ? s.median.toFixed(2) : '0.00';
                const p25 = (typeof s.percentile25 === 'number') ? s.percentile25.toFixed(2) : '0.00';
                const p75 = (typeof s.percentile75 === 'number') ? s.percentile75.toFixed(2) : '0.00';
                
                html += '<tr>' +
                    '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>' +
                    '<td style="text-align:right;">' + total + '</td>' +
                    '<td style="text-align:right; background:#fff3e0; font-weight:bold;">' + uniqueLeads + '</td>' +
                    '<td style="text-align:right;">' + gestionado + '</td>' +
                    '<td style="text-align:right;">' + pendienteDoc + '</td>' +
                    '<td style="text-align:right;">' + enValidacion + '</td>' +
                    '<td style="text-align:right;">' + sinRespuesta + '</td>' +
                    '<td style="text-align:right;">' + rechazadoAsesor + '</td>' +
                    '<td style="text-align:right;">' + median + '</td>' +
                    '<td style="text-align:right;">' + p25 + '</td>' +
                    '<td style="text-align:right;">' + p75 + '</td>' +
                    '<td style="text-align:right;">' + avg + '</td>' +
                    '</tr>';
            });
            html += '</tbody></table>';
            
            // Segunda tabla: Métricas de productividad y conversión
            html += '<h3 style="margin-top:20px; text-align:center; color:#2f6f9f;">Métricas de Productividad y Tasas de Conversión</h3>';
            html += '<table class="report" style="margin-top:10px;"><thead><tr><th>Operador</th><th style="text-align:right;">Días Activos</th><th style="text-align:right;">Prom/Día Activo</th><th style="text-align:right;">% Gestionado</th><th style="text-align:right;">% Pendiente Doc</th><th style="text-align:right;">% En Validación</th><th style="text-align:right;">% Sin Respuesta</th><th style="text-align:right;">% Rechazado</th></tr></thead><tbody>';
            
            summaryArray.forEach(function(s) {
                const operatorName = s.setByNombre || s.setBy || 'Sin Operador';
                const daysActive = s.daysActive || 0;
                const dailyAvg = (typeof s.dailyAvg === 'number') ? s.dailyAvg.toFixed(2) : '0.00';
                const pctGestionado = (typeof s.pctGestionado === 'number') ? s.pctGestionado.toFixed(1) : '0.0';
                const pctPendienteDoc = (typeof s.pctPendienteDoc === 'number') ? s.pctPendienteDoc.toFixed(1) : '0.0';
                const pctEnValidacion = (typeof s.pctEnValidacion === 'number') ? s.pctEnValidacion.toFixed(1) : '0.0';
                const pctSinRespuesta = (typeof s.pctSinRespuesta === 'number') ? s.pctSinRespuesta.toFixed(1) : '0.0';
                const pctRechazadoAsesor = (typeof s.pctRechazadoAsesor === 'number') ? s.pctRechazadoAsesor.toFixed(1) : '0.0';
                
                const sinRespuestaStyle = parseFloat(pctSinRespuesta) > 20 ? ' style="background:#ffebee; font-weight:bold;"' : '';
                const gestionadoStyle = parseFloat(pctGestionado) > 50 ? ' style="background:#e8f5e9; font-weight:bold;"' : '';
                
                html += '<tr>' +
                    '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>' +
                    '<td style="text-align:right;">' + daysActive + '</td>' +
                    '<td style="text-align:right;">' + dailyAvg + '</td>' +
                    '<td style="text-align:right;"' + gestionadoStyle + '>' + pctGestionado + '%</td>' +
                    '<td style="text-align:right;">' + pctPendienteDoc + '%</td>' +
                    '<td style="text-align:right;">' + pctEnValidacion + '%</td>' +
                    '<td style="text-align:right;"' + sinRespuestaStyle + '>' + pctSinRespuesta + '%</td>' +
                    '<td style="text-align:right;">' + pctRechazadoAsesor + '%</td>' +
                    '</tr>';
            });
            html += '</tbody></table>';
            
            // Resumen del equipo
            const totalGestiones = summaryArray.reduce(function(sum, s) { return sum + (s.total || 0); }, 0);
            const totalLeadsUnicos = summaryArray.reduce(function(sum, s) { return sum + (s.uniqueLeads || 0); }, 0);
            const avgPerOperator = summaryArray.length > 0 ? (totalGestiones / summaryArray.length).toFixed(2) : '0.00';
            const totalOperators = summaryArray.length;
            
            html += '<div style="margin-top:20px; padding:10px; background:#f5f5f5; border-left:4px solid #2f6f9f;">';
            html += '<strong>Resumen del Equipo:</strong><br/>';
            html += 'Total Gestiones: <strong>' + totalGestiones + '</strong><br/>';
            html += 'Total Leads Únicos Gestionados: <strong>' + totalLeadsUnicos + '</strong><br/>';
            html += 'Total Operadores Activos: <strong>' + totalOperators + '</strong><br/>';
            html += 'Promedio Gestiones por Operador: <strong>' + avgPerOperator + '</strong>';
            html += '</div>';
            
            // Tercera tabla: Tiempo Off por Operador
            if (timeOffArray && timeOffArray.length > 0) {
                html += '<h3 style="margin-top:20px; text-align:center; color:#2f6f9f;">Tiempo Off por Operador</h3>';
                
                // Recopilar todos los motivos únicos (excluyendo Fin de Jornada)
                const allMotivos = {};
                timeOffArray.forEach(function(t) {
                    Object.keys(t.motivos || {}).forEach(function(motivoKey) {
                        const motivo = t.motivos[motivoKey];
                        if (!allMotivos[motivoKey]) {
                            allMotivos[motivoKey] = motivo.nombre;
                        }
                    });
                });
                
                // Construir encabezados dinámicamente
                html += '<table class="report" style="margin-top:10px;"><thead><tr><th>Operador</th><th style="text-align:right;">Total Horas</th>';
                Object.keys(allMotivos).forEach(function(motivoKey) {
                    html += '<th style="text-align:right;">% ' + allMotivos[motivoKey] + '</th>';
                });
                html += '</tr></thead><tbody>';
                
                // Datos por operador
                timeOffArray.forEach(function(t) {
                    const operatorName = t.operatorName || t.operatorId || 'Sin Operador';
                    const totalHours = t.totalHours || '0.00';
                    const totalMinutes = t.totalMinutes || 0;
                    
                    html += '<tr>';
                    html += '<td style="text-align:left; font-weight:bold; background:#f7fbff;">' + operatorName + '</td>';
                    html += '<td style="text-align:right; background:#fff3e0; font-weight:bold;">' + totalHours + '</td>';
                    
                    // Calcular porcentajes por motivo
                    Object.keys(allMotivos).forEach(function(motivoKey) {
                        const motivo = t.motivos[motivoKey];
                        const minutos = motivo ? motivo.minutos : 0;
                        const porcentaje = totalMinutes > 0 ? ((minutos / totalMinutes) * 100).toFixed(1) : '0.0';
                        html += '<td style="text-align:right;">' + porcentaje + '%</td>';
                    });
                    
                    html += '</tr>';
                });
                
                html += '</tbody></table>';
                
                // Resumen de tiempo off
                const totalTimeOffMinutes = timeOffArray.reduce(function(sum, t) { return sum + (t.totalMinutes || 0); }, 0);
                const totalTimeOffHours = (totalTimeOffMinutes / 60).toFixed(2);
                
                html += '<div style="margin-top:10px; padding:10px; background:#fff3e0; border-left:4px solid #ff9800;">';
                html += '<strong>Total Tiempo Off del Equipo:</strong> ' + totalTimeOffHours + ' horas (' + totalTimeOffMinutes.toFixed(0) + ' minutos)';
                html += '</div>';
            }

        } catch (e) {
            log.error('buildFullReportHtml', e);
            html += '<p>Error construyendo reporte.</p>';
        }

        html += '</body></html>';
        return html;
    }

    function sendReport(subject, body, recipients, attachments) {
        try {
            const currentScript = runtime.getCurrentScript();
            const sender = 50331/* currentScript ? currentScript.getParameter({ name: 'custscript_gestion_report_sender' }) :  */;
            const author = sender ? parseInt(sender, 10) : runtime.getCurrentUser ? runtime.getCurrentUser().id : null;
    
            if (!recipients) {
                log.error('sendReport', 'No recipients configured. Set script parameter custscript_gestion_report_recipient');
                return false;
            }
            // const toList = String(to).split(',').map(function(v){ return v.trim(); }).filter(Boolean).join(',');
            const mailOptions = {
                author: author || runtime.getCurrentUser().id,
                recipients: recipients,
                subject: subject,
                body: body
            };
            if (attachments && Array.isArray(attachments) && attachments.length) {
                mailOptions.attachments = attachments;
            }
            email.send(mailOptions);
            log.audit('sendReport', 'Email sent to: ' + String(recipients));
            return true;
        } catch (e) {
            log.error('sendReport', e);
            return false;
        }
    }

    function getPeriodDates(period) {
        // returns { startDate: Date, endDate: Date, label: string }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (!period) period = 'daily';
        period = String(period).toLowerCase();

        if (period === 'weekly') {
            // 7 días atrás desde hoy
            const endDate = new Date(today); // Hoy
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - 7); // 7 días atrás
            return { 
                startDate: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0), 
                endDate: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59), 
                label: format.format({ value: startDate, type: format.Type.DATE }) + ' - ' + format.format({ value: endDate, type: format.Type.DATE }) 
            };
        }

        if (period === 'monthly') {
            // 30 días atrás desde hoy
            const endDate = new Date(today); // Hoy
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - 30); // 30 días atrás
            return { 
                startDate: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0), 
                endDate: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59), 
                label: format.format({ value: startDate, type: format.Type.DATE }) + ' - ' + format.format({ value: endDate, type: format.Type.DATE }) 
            };
        }

        // default daily
        return { startDate: today, endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23,59,59), label: format.format({ value: today, type: format.Type.DATE }) };
    }

    function getDateFiltersForPeriod(period) {
        try {
            if (!period) period = 'daily';
            period = String(period).toLowerCase();
            
            // Use relative date filters - most reliable in NetSuite
            if (period === 'daily') {
                log.debug('getDateFiltersForPeriod', 'Using filter: today');
                return [ ['created', 'within', 'today'] ];
            }
            
            if (period === 'weekly') {
                log.debug('getDateFiltersForPeriod', 'Using filter: last 7 days');
                // Use "within" with relative keyword for last 7 days
                return [ ['created', 'within', 'thisweek'] ];
            }
            
            if (period === 'monthly') {
                log.debug('getDateFiltersForPeriod', 'Using filter: this month');
                return [ ['created', 'within', 'thismonth'] ];
            }
            
            // Default to today
            log.debug('getDateFiltersForPeriod', 'Using filter: today (default)');
            return [ ['created', 'within', 'today'] ];
        } catch (e) {
            log.error('getDateFiltersForPeriod', e);
            return null;
        }
    }

    function getAdvisorDailyCounts(period) {
        // Returns array of { setBy, setByNombre, dateStr, count, enValidacion, allCounts }
        // Gets individual records and aggregates by operator for better statistics
        try {
            log.debug('getAdvisorDailyCounts', 'Period: ' + period);
            
            // Use relative date filters from getDateFiltersForPeriod
            const dateFilters = getDateFiltersForPeriod(period);
            if (!dateFilters) {
                log.error('getAdvisorDailyCounts', 'No filters returned for period: ' + period);
                return [];
            }
            
            // Add role filter: 1010 (Asesor Ventas), 1006 (Supervisor Ventas), 1012 (Gerente Comercial)
            const filters = [
                dateFilters,
                'AND',
                ['custrecord_elm_gestion_set_by.role', 'anyof', '1010', '1006', '1012']
            ];
            
            log.debug('getAdvisorDailyCounts', 'Filters: ' + JSON.stringify(filters));
            
            // Get individual records (no GROUP BY)
            const cols = [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'custrecord_elm_gestion_set_by', label: 'Actualizado Por' }),
                search.createColumn({ name: 'custrecord_elm_gestion_estado_', label: 'Estado de Gestion' }),
                search.createColumn({ name: 'custrecord_elm_gestion_lead', label: 'Lead/Cliente' }), // ID del lead
                search.createColumn({ name: 'created', label: 'Date Created' })
            ];
            
            const s = search.create({ type: 'customrecord_elm_gestion_leads', filters: filters, columns: cols });
            
            // Check total count first
            let searchCount = 0;
            try {
                searchCount = s.runPaged().count;
                log.debug('getAdvisorDailyCounts', 'Total search results: ' + searchCount);
            } catch (countErr) {
                log.error('getAdvisorDailyCounts_count', countErr);
            }
            
            if (searchCount === 0) {
                log.audit('getAdvisorDailyCounts', 'No records found for period: ' + period);
                return [];
            }
            
            // Map to aggregate by operator AND day: key = "operatorId|YYYY-MM-DD"
            const dailyMap = {}; // key = "operatorId|dateStr", value = { count, uniqueLeads: Set, gestionado, pendienteDoc, enValidacion, sinRespuesta, rechazadoAsesor }
            const operatorNames = {}; // key = operatorId, value = nombre
            
            try {
                let pageIndex = 0;
                let hasMoreResults = true;
                let totalRecords = 0;
                
                // Paginate through all results
                while (hasMoreResults && pageIndex < 10) { // Limit to 10,000 records max
                    const searchResults = s.run().getRange({ start: pageIndex * 1000, end: (pageIndex + 1) * 1000 });
                    
                    if (searchResults.length === 0) {
                        hasMoreResults = false;
                        break;
                    }
                    
                    for (let i = 0; i < searchResults.length; i++) {
                        totalRecords++;
                        const r = searchResults[i];
                        const setBy = r.getValue({ name: 'custrecord_elm_gestion_set_by' }) || '';
                        const setByNombre = r.getText({ name: 'custrecord_elm_gestion_set_by' }) || '';
                        const estado = r.getValue({ name: 'custrecord_elm_gestion_estado_' }) || '';
                        const leadId = r.getValue({ name: 'custrecord_elm_gestion_lead' }) || ''; // ID del lead
                        const createdValue = r.getValue({ name: 'created' });
                        
                        // Log first record to debug
                        if (i === 0 && pageIndex === 0) {
                            log.debug('getAdvisorDailyCounts_firstRecord', 'Created value: ' + createdValue + ' | Type: ' + typeof createdValue + ' | SetBy: ' + setBy + ' | LeadID: ' + leadId);
                        }
                        
                        // Extract date (YYYY-MM-DD)
                        let dateStr = '';
                        if (createdValue) {
                            // NetSuite returns dates as strings in format "DD/MM/YYYY HH:MM am/pm"
                            // Try to parse it directly
                            try {
                                const d = format.parse({ value: createdValue, type: format.Type.DATE });
                                dateStr = format.format({ value: d, type: format.Type.DATE });
                                // Convert to YYYY-MM-DD
                                const parts = dateStr.split('/');
                                if (parts.length === 3) {
                                    dateStr = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
                                }
                            } catch (parseErr) {
                                log.error('getAdvisorDailyCounts_dateParse', 'Error parsing date: ' + createdValue + ' | ' + parseErr);
                            }
                        }
                        
                        if (!dateStr) {
                            if (pageIndex === 0 && i < 5) {
                                log.debug('getAdvisorDailyCounts_skipRecord', 'Skipping record with no valid date. Created: ' + createdValue);
                            }
                            continue; // Skip if no valid date
                        }
                        
                        const operatorKey = setBy || '__none';
                        const dailyKey = operatorKey + '|' + dateStr;
                        
                        // Store operator name
                        if (!operatorNames[operatorKey]) {
                            operatorNames[operatorKey] = setByNombre;
                        }
                        
                        // Initialize daily aggregation
                        if (!dailyMap[dailyKey]) {
                            dailyMap[dailyKey] = {
                                count: 0,
                                uniqueLeads: new Set(), // Set para contar leads únicos
                                gestionado: 0,        // ID 5
                                pendienteDoc: 0,      // ID 6
                                enValidacion: 0,      // ID 7
                                sinRespuesta: 0,      // ID 8
                                rechazadoAsesor: 0    // ID 24
                            };
                        }
                        
                        dailyMap[dailyKey].count++;
                        
                        // Agregar lead ID al Set (automáticamente maneja duplicados)
                        if (leadId) {
                            dailyMap[dailyKey].uniqueLeads.add(leadId);
                        }
                        
                        // Count estados donde Asesor de Ventas = Yes
                        if (estado === '5') {
                            dailyMap[dailyKey].gestionado++;
                        } else if (estado === '6') {
                            dailyMap[dailyKey].pendienteDoc++;
                        } else if (estado === '7') {
                            dailyMap[dailyKey].enValidacion++;
                        } else if (estado === '8') {
                            dailyMap[dailyKey].sinRespuesta++;
                        } else if (estado === '24') {
                            dailyMap[dailyKey].rechazadoAsesor++;
                        }
                    }
                    
                    pageIndex++;
                    if (searchResults.length < 1000) hasMoreResults = false;
                }
                
                log.debug('getAdvisorDailyCounts', 'Processed ' + totalRecords + ' individual records');
                log.debug('getAdvisorDailyCounts', 'Daily map keys count: ' + Object.keys(dailyMap).length);
            } catch (searchErr) {
                log.error('getAdvisorDailyCounts_search', searchErr);
            }
            
            // Convert map to array: one row per operator per day
            const results = [];
            Object.keys(dailyMap).forEach(function(dailyKey) {
                const parts = dailyKey.split('|');
                const operatorKey = parts[0];
                const dateStr = parts[1];
                const data = dailyMap[dailyKey];
                
                results.push({
                    setBy: operatorKey === '__none' ? null : operatorKey,
                    setByNombre: operatorNames[operatorKey] || '',
                    dateStr: dateStr,
                    count: data.count,
                    uniqueLeadsCount: data.uniqueLeads.size, // Cantidad de leads únicos
                    gestionado: data.gestionado,
                    pendienteDoc: data.pendienteDoc,
                    enValidacion: data.enValidacion,
                    sinRespuesta: data.sinRespuesta,
                    rechazadoAsesor: data.rechazadoAsesor
                });
            });
            
            log.debug('getAdvisorDailyCounts', 'Generated ' + results.length + ' daily rows (operator-day combinations)');
            return results;
        } catch (e) {
            log.error('getAdvisorDailyCounts', e);
            return [];
        }
    }

    function getOperatorTimeOff(period) {
        // Returns array of { operatorId, operatorName, totalMinutes, motivoBreakdown: { motivoId: { nombre, minutos } } }
        try {
            log.debug('getOperatorTimeOff', 'Period: ' + period);
            
            const dateFilters = getDateFiltersForPeriod(period);
            if (!dateFilters) {
                log.error('getOperatorTimeOff', 'No filters returned for period: ' + period);
                return [];
            }
            
            const cols = [
                search.createColumn({ name: 'internalid', label: 'Internal ID' }),
                search.createColumn({ name: 'created', label: 'Date Created' }),
                search.createColumn({ name: 'custrecord_elm_comienzo', label: 'Comienzo' }),
                search.createColumn({ name: 'custrecord_elm_finalizacion', label: 'Finalizacion' }),
                search.createColumn({ name: 'custrecord_elm_motivo_ausencia', label: 'Motivo de Ausencia' }),
                search.createColumn({ 
                    name: 'formulanumeric',
                    formula: "((TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'J')) * 1440 + TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'HH24')) * 60 + TO_NUMBER(TO_CHAR({custrecord_elm_finalizacion}, 'MI')))-(TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'J')) * 1440 + TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'HH24')) * 60 + TO_NUMBER(TO_CHAR({custrecord_elm_comienzo}, 'MI'))))",
                    label: 'Minutos'
                }),
                search.createColumn({ name: 'custrecord_elm_estado_operador', label: 'Operador' })
            ];
            
            const s = search.create({ type: 'customrecord_elm_est_vend', filters: dateFilters, columns: cols });
            
            let searchCount = 0;
            try {
                searchCount = s.runPaged().count;
                log.debug('getOperatorTimeOff', 'Total search results: ' + searchCount);
            } catch (countErr) {
                log.error('getOperatorTimeOff_count', countErr);
            }
            
            if (searchCount === 0) {
                log.audit('getOperatorTimeOff', 'No time off records found for period: ' + period);
                return [];
            }
            
            const operatorMap = {}; // key = operatorId, value = { totalMinutes, motivos: { motivoId: { nombre, minutos } } }
            
            let pageIndex = 0;
            let hasMoreResults = true;
            
            while (hasMoreResults && pageIndex < 10) {
                const searchResults = s.run().getRange({ start: pageIndex * 1000, end: (pageIndex + 1) * 1000 });
                
                if (searchResults.length === 0) {
                    hasMoreResults = false;
                    break;
                }
                
                for (let i = 0; i < searchResults.length; i++) {
                    const r = searchResults[i];
                    const operatorId = r.getValue({ name: 'custrecord_elm_estado_operador' }) || '';
                    const operatorName = r.getText({ name: 'custrecord_elm_estado_operador' }) || '';
                    const motivoId = r.getValue({ name: 'custrecord_elm_motivo_ausencia' }) || '';
                    const motivoNombre = r.getText({ name: 'custrecord_elm_motivo_ausencia' }) || '';
                    const minutos = parseFloat(r.getValue({ name: 'formulanumeric' })) || 0;
                    
                    // Excluir registros relacionados con "Fin de Jornada"
                    if (motivoNombre && motivoNombre.toLowerCase().indexOf('fin de jornada') !== -1) {
                        continue;
                    }
                    
                    const operatorKey = operatorId || '__none';
                    
                    if (!operatorMap[operatorKey]) {
                        operatorMap[operatorKey] = {
                            operatorId: operatorId,
                            operatorName: operatorName,
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
            
            // Convert to array
            const results = [];
            Object.keys(operatorMap).forEach(function(key) {
                const data = operatorMap[key];
                results.push({
                    operatorId: data.operatorId,
                    operatorName: data.operatorName,
                    totalMinutes: data.totalMinutes,
                    totalHours: (data.totalMinutes / 60).toFixed(2),
                    motivos: data.motivos
                });
            });
            
            log.debug('getOperatorTimeOff', 'Processed ' + results.length + ' operators with time off');
            return results;
        } catch (e) {
            log.error('getOperatorTimeOff', e);
            return [];
        }
    }

    function computeMetricsFromDailyCounts(dailyCounts, period) {
        // dailyCounts: [{ setBy, setByNombre, dateStr, count, uniqueLeadsCount, gestionado, pendienteDoc, enValidacion, sinRespuesta, rechazadoAsesor }]
        const p = getPeriodDates(period);
        const daysInPeriod = Math.max(1, Math.round((p.endDate - new Date(p.startDate.getFullYear(), p.startDate.getMonth(), p.startDate.getDate())) / (1000*60*60*24)) + 1);
        const map = {};
        (dailyCounts || []).forEach(function(r) {
            const key = (r.setBy === undefined || r.setBy === null) ? '__none' : String(r.setBy);
            if (!map[key]) {
                map[key] = { 
                    setBy: r.setBy, 
                    setByNombre: r.setByNombre || '', 
                    totals: 0,
                    uniqueLeadsTotal: 0,
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
            map[key].uniqueLeadsTotal += (r.uniqueLeadsCount || 0);
            map[key].gestionado += (r.gestionado || 0);
            map[key].pendienteDoc += (r.pendienteDoc || 0);
            map[key].enValidacion += (r.enValidacion || 0);
            map[key].sinRespuesta += (r.sinRespuesta || 0);
            map[key].rechazadoAsesor += (r.rechazadoAsesor || 0);
            map[key].dailyCounts.push(r.count || 0);
            if (r.count && r.count > 0) map[key].daysActiveSet.add(r.dateStr);
        });
        
        // Helper function to calculate percentile
        function calculatePercentile(arr, percentile) {
            if (!arr || arr.length === 0) return 0;
            const sorted = arr.slice().sort(function(a, b) { return a - b; });
            const index = (percentile / 100) * (sorted.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const weight = index - lower;
            if (lower === upper) return sorted[lower];
            return sorted[lower] * (1 - weight) + sorted[upper] * weight;
        }
        
        const metrics = Object.keys(map).map(function(k){
            const item = map[k];
            const total = item.totals;
            const uniqueLeads = item.uniqueLeadsTotal;
            const gestionado = item.gestionado;
            const pendienteDoc = item.pendienteDoc;
            const enValidacion = item.enValidacion;
            const sinRespuesta = item.sinRespuesta;
            const rechazadoAsesor = item.rechazadoAsesor;
            const daysActive = item.daysActiveSet.size;
            const avg = total / daysInPeriod;
            const dailyAvg = daysActive > 0 ? total / daysActive : 0; // Promedio por día activo
            
            // Calculate median and percentiles
            const median = calculatePercentile(item.dailyCounts, 50);
            const percentile25 = calculatePercentile(item.dailyCounts, 25);
            const percentile75 = calculatePercentile(item.dailyCounts, 75);
            
            // Calculate percentages
            const pctGestionado = total > 0 ? (gestionado / total) * 100 : 0;
            const pctPendienteDoc = total > 0 ? (pendienteDoc / total) * 100 : 0;
            const pctEnValidacion = total > 0 ? (enValidacion / total) * 100 : 0;
            const pctSinRespuesta = total > 0 ? (sinRespuesta / total) * 100 : 0;
            const pctRechazadoAsesor = total > 0 ? (rechazadoAsesor / total) * 100 : 0;
            
            return { 
                setBy: item.setBy, 
                setByNombre: item.setByNombre, 
                total: total,
                uniqueLeads: uniqueLeads,
                gestionado: gestionado,
                pendienteDoc: pendienteDoc,
                enValidacion: enValidacion,
                sinRespuesta: sinRespuesta,
                rechazadoAsesor: rechazadoAsesor,
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
        // sort by total desc
        metrics.sort(function(a,b){ return (b.total || 0) - (a.total || 0); });
        return { metrics: metrics, daysInPeriod: daysInPeriod };
    }

    function execute(context) {
         log.audit('ELM_GestionLeadsReport', 'Start');
        // 1. Determinar periodo (parametro del script en cada deployment): daily|weekly|monthly
        const currentScript = runtime.getCurrentScript();
        const periodParam = currentScript.getParameter({ name: 'custscript_gestion_report_period' });
        const period = periodParam ? String(periodParam).toLowerCase() : 'monthly';
        const periodInfo = getPeriodDates(period);


        // 2. Obtener conteos diarios por asesor dentro del periodo y calcular métricas
        const dailyCounts = getAdvisorDailyCounts(period);
        const computed = computeMetricsFromDailyCounts(dailyCounts, period);
        const metricsArray = computed.metrics || [];

        // 2b. Obtener tiempo off por operador
        const timeOffArray = getOperatorTimeOff(period);

        // 3. Construir HTML del reporte agrupado por operador usando las métricas
        const html = buildFullReportHtml(metricsArray, timeOffArray, periodInfo && periodInfo.label ? periodInfo.label : null);
        
        // 4. Enviar email
        const recipients =  currentScript.getParameter({ name: 'custscript_elm_recipients' }) ;
        const subject = 'ELM - Reporte Gestion Leads - ' + (periodInfo && periodInfo.label ? periodInfo.label : (format ? format.format({ value: new Date(), type: format.Type.DATE }) : (new Date()).toISOString()));

        // Optionally create CSV attachment from metrics
        const attachments = [];
        try {
            const attachCsvParam = currentScript ? currentScript.getParameter({ name: 'custscript_gestion_report_attach_csv' }) : null;
            const attachCsv = attachCsvParam === true || String(attachCsvParam) === 'T' || String(attachCsvParam) === 'true' || String(attachCsvParam) === '1';
            if (attachCsv && Array.isArray(metricsArray) && metricsArray.length) {
                // Build CSV: Todas las columnas incluyendo métricas adicionales
                const headers = ['Operador','Total Gestiones','Leads Únicos','Gestionado','Pendiente Doc','En Validación','Sin Respuesta','Rechazado Asesor','Mediana','P25','P75','Promedio','Días Activos','Prom/Día Activo','%Gestionado','%Pendiente Doc','%En Validación','%Sin Respuesta','%Rechazado'];
                const rows = [headers.join(',')];
                metricsArray.forEach(function(m){
                    const name = '"' + String(m.setByNombre || m.setBy || '').replace(/"/g,'""') + '"';
                    const total = m.total || 0;
                    const uniqueLeads = m.uniqueLeads || 0;
                    const gestionado = m.gestionado || 0;
                    const pendienteDoc = m.pendienteDoc || 0;
                    const enValidacion = m.enValidacion || 0;
                    const sinRespuesta = m.sinRespuesta || 0;
                    const rechazadoAsesor = m.rechazadoAsesor || 0;
                    const avg = (typeof m.avg === 'number') ? m.avg.toFixed(2) : (m.avg || 0);
                    const median = (typeof m.median === 'number') ? m.median.toFixed(2) : (m.median || 0);
                    const p25 = (typeof m.percentile25 === 'number') ? m.percentile25.toFixed(2) : (m.percentile25 || 0);
                    const p75 = (typeof m.percentile75 === 'number') ? m.percentile75.toFixed(2) : (m.percentile75 || 0);
                    const daysActive = m.daysActive || 0;
                    const dailyAvg = (typeof m.dailyAvg === 'number') ? m.dailyAvg.toFixed(2) : '0.00';
                    const pctGestionado = (typeof m.pctGestionado === 'number') ? m.pctGestionado.toFixed(1) : '0.0';
                    const pctPendienteDoc = (typeof m.pctPendienteDoc === 'number') ? m.pctPendienteDoc.toFixed(1) : '0.0';
                    const pctEnValidacion = (typeof m.pctEnValidacion === 'number') ? m.pctEnValidacion.toFixed(1) : '0.0';
                    const pctSinRespuesta = (typeof m.pctSinRespuesta === 'number') ? m.pctSinRespuesta.toFixed(1) : '0.0';
                    const pctRechazadoAsesor = (typeof m.pctRechazadoAsesor === 'number') ? m.pctRechazadoAsesor.toFixed(1) : '0.0';
                    rows.push([name, total, uniqueLeads, gestionado, pendienteDoc, enValidacion, sinRespuesta, rechazadoAsesor, median, p25, p75, avg, daysActive, dailyAvg, pctGestionado, pctPendienteDoc, pctEnValidacion, pctSinRespuesta, pctRechazadoAsesor].join(','));
                });
                const csvContent = rows.join('\r\n');
                try {
                    const safeLabel = (periodInfo && periodInfo.label) ? String(periodInfo.label).replace(/[^a-z0-9\-\_\s]/gi,'_') : (new Date()).toISOString().replace(/[^a-z0-9\-\_\s]/gi,'_');
                    const fileName = 'ELM_Gestion_Report_' + safeLabel + '.csv';
                    const f = file.create({ name: fileName, fileType: file.Type.CSV, contents: csvContent });
                    // Save and reload to get a proper file object for email attachments
                    try {
                        const savedId = f.save();
                        const fileObj = file.load({ id: savedId });
                        attachments.push(fileObj);
                    } catch (fe) {
                        // If saving fails, attempt to attach the in-memory file object (may work in some accounts)
                        log.warn('csvAttachment', 'Unable to save file to cabinet, will try to attach in-memory file object: ' + (fe && fe.message));
                        attachments.push(f);
                    }
                } catch (e1) {  
                    log.error('createCsv', e1);
                }
            } 
        } catch (e) {
            log.error('attachCsv', e);
        }

        const ok = sendReport(subject, html, recipients, attachments.length ? attachments : null);

        log.audit('ELM_GestionLeadsReport', 'End. Email sent: ' + ok);
        
    
    }

    return {
        execute: execute
    };
});
