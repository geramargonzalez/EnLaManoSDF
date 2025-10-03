/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description TEST END-TO-END: Validación completa del servicio de scoring BCU
 * 
 * Este script ejecuta el flujo completo de scoring desde el servicio principal:
 * 1. Carga de reglas (scoringRules)
 * 2. Fetch de datos del proveedor (Equifax/BCU)
 * 3. Normalización de datos
 * 4. Cálculo de score (computeScore)
 * 5. Cache y respuesta
 * 
 * URL: https://7564430-sb1.app.netsuite.com/app/site/hosting/scriptlet.nl?script=725&deploy=1&doc=12345678
 */

define([
    'N/log',
    'N/ui/serverWidget',
    'N/runtime',
    '../app/service'
], function(log, serverWidget, runtime, scoreService) {
    'use strict';

    /**
     * Renderiza la página con resultados del test
     */
    function onRequest(context) {
        const form = serverWidget.createForm({
            title: ' BCU Score Service (Multiple Documents) '
        });

        // Detectar modo de operación:
        // - POST: Submit del form → ejecutar test
        // - GET con parámetro 'docs' o 'doc': Ejecución directa por URL → ejecutar test
        // - GET sin parámetros: Mostrar formulario de input
        const isPost = context.request.method === 'POST';
        const hasDocParams = context.request.parameters.docs || context.request.parameters.doc;

        if (!isPost && !hasDocParams) {
            // MODO 1: GET sin parámetros → Mostrar formulario de input
            renderInputForm(form, context);
        } else {
            // MODO 2: POST (form submit) o GET con docs → Ejecutar test
            renderTestResults(form, context);
        }

        context.response.writePage(form);
    }

    /**
     * Renderiza el formulario de input (GET)
     */
    function renderInputForm(form, context) {
        // Valores por default o de URL
        const defaultDocs = context.request.parameters.docs || '46175108,54237287,54723915,51375882,52333281,33252929,42710744';
        const defaultProvider = context.request.parameters.provider || 'equifax';
        const defaultForceRefresh = context.request.parameters.forceRefresh === 'true';
        const defaultDebug = context.request.parameters.debug !== 'false'; // default true

        // Instrucciones
        const instructionsField = form.addField({
            id: 'custpage_instructions',
            type: serverWidget.FieldType.INLINEHTML,
            label: 'Instructions'
        });

        instructionsField.defaultValue = '<div style="background-color: #fff3cd; padding: 15px; margin-bottom: 20px; border-radius: 5px; border: 2px solid #ffc107;">' +
            '<h3 style="margin-top: 0;">📝 Configurar Test</h3>' +
            '<p>Completa los campos abajo y haz click en <strong>"Ejecutar Test"</strong> para probar el servicio de scoring.</p>' +
            '<p><strong>Formatos soportados para documentos:</strong></p>' +
            '<ul>' +
            '<li>Un documento: <code>48123456</code></li>' +
            '<li>Múltiples (CSV): <code>41675108,54237287,54723915</code></li>' +
            '<li>Múltiples (JSON): <code>["41675108","54237287","54723915"]</code></li>' +
            '</ul>' +
            '</div>';

        // Campo: Documentos
        const docsField = form.addField({
            id: 'custpage_docs',
            type: serverWidget.FieldType.TEXTAREA,
            label: 'Documentos'
        });
        docsField.defaultValue = defaultDocs;
        docsField.isMandatory = true;
        docsField.setHelpText({
            help: 'Ingresa uno o más documentos separados por comas. Ejemplo: 41675108,54237287,54723915'
        });

        // Campo: Provider
        const providerField = form.addField({
            id: 'custpage_provider',
            type: serverWidget.FieldType.SELECT,
            label: 'Provider'
        });
        providerField.addSelectOption({
            value: 'equifax',
            text: 'Equifax'
        });
        providerField.addSelectOption({
            value: 'bcu',
            text: 'BCU'
        });
        providerField.addSelectOption({
            value: 'mym',
            text: 'MYM (RiskAPI)'
        });
        providerField.defaultValue = defaultProvider;
        providerField.setHelpText({
            help: 'Selecciona el proveedor de datos de scoring: Equifax (producción), BCU (futuro), MYM (RiskAPI via enlamanocrm)'
        });

        // Campo: Force Refresh
        const forceRefreshField = form.addField({
            id: 'custpage_force_refresh',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Force Refresh'
        });
        forceRefreshField.defaultValue = defaultForceRefresh ? 'T' : 'F';
        forceRefreshField.setHelpText({
            help: 'Marcar para forzar consulta fresca (bypass cache)'
        });

        // Campo: Debug
        const debugField = form.addField({
            id: 'custpage_debug',
            type: serverWidget.FieldType.CHECKBOX,
            label: 'Debug Mode'
        });
        debugField.defaultValue = defaultDebug ? 'T' : 'F';
        debugField.setHelpText({
            help: 'Marcar para ver logs detallados en Execution Log'
        });

        // Botón Submit
        form.addSubmitButton({
            label: '🚀 Ejecutar Test'
        });

        // Botón Reset
        form.addResetButton({
            label: 'Limpiar'
        });

        // Links rápidos
        const quickLinksField = form.addField({
            id: 'custpage_quick_links',
            type: serverWidget.FieldType.INLINEHTML,
            label: 'Quick Links'
        });

        // Construir URL base con script y deploy
        const script = runtime.getCurrentScript();
        const scriptId = script.id;
        const deploymentId = script.deploymentId;
        const baseUrl = '?script=' + scriptId + '&deploy=' + deploymentId;

        quickLinksField.defaultValue = '<div style="background-color: #e7f3ff; padding: 15px; margin-top: 20px; border-radius: 5px;">' +
            '<h3 style="margin-top: 0;">⚡ Quick Links</h3>' +
            '<p>También puedes ejecutar el test directamente con URL:</p>' +
            '<ul>' +
            '<li><a href="' + baseUrl + '&docs=48123456" target="_blank">Test con 1 documento (Equifax)</a></li>' +
            '<li><a href="' + baseUrl + '&docs=41675108,54237287,54723915" target="_blank">Test con 3 documentos (Equifax)</a></li>' +
            '<li><a href="' + baseUrl + '&docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744" target="_blank">Test con 7 documentos (completo)</a></li>' +
            '<li><a href="' + baseUrl + '&docs=48123456&forceRefresh=true" target="_blank">Test con force refresh</a></li>' +
            '</ul>' +
            '<h4>🚀 MYM Provider (RiskAPI)</h4>' +
            '<ul>' +
            '<li><a href="' + baseUrl + '&docs=48123456&provider=mym" target="_blank">Test MYM con 1 documento</a></li>' +
            '<li><a href="' + baseUrl + '&docs=41675108,54237287&provider=mym" target="_blank">Test MYM con 2 documentos</a></li>' +
            '<li><a href="' + baseUrl + '&docs=48123456&provider=mym&debug=true" target="_blank">Test MYM con debug</a></li>' +
            '</ul>' +
            '<h4>🔄 Comparación de Providers</h4>' +
            '<ul>' +
            '<li><a href="' + baseUrl + '&docs=48123456&provider=equifax" target="_blank">Mismo documento - Equifax</a></li>' +
            '<li><a href="' + baseUrl + '&docs=48123456&provider=mym" target="_blank">Mismo documento - MYM</a></li>' +
            '</ul>' +
            '</div>';
    }

    /**
     * Ejecuta el test y renderiza resultados (POST o GET con params)
     */
    function renderTestResults(form, context) {
        // Obtener parámetros del form (POST) o URL (GET)
        const isFormSubmit = context.request.method === 'POST';
        const docsParam = isFormSubmit ? 
            (context.request.parameters.custpage_docs || '12345678') :
            (context.request.parameters.docs || context.request.parameters.doc || '12345678');
        const provider = isFormSubmit ?
            (context.request.parameters.custpage_provider || 'equifax') :
            (context.request.parameters.provider || 'equifax');
        const forceRefresh = isFormSubmit ?
            (context.request.parameters.custpage_force_refresh === 'T') :
            (context.request.parameters.forceRefresh === 'true');
        const debug = isFormSubmit ?
            (context.request.parameters.custpage_debug === 'T') :
            (context.request.parameters.debug !== 'false'); // default true
        const parallel = true; // Siempre true

        // Parsear documentos (puede ser array JSON o CSV)
        const documentos = parseDocumentos(docsParam);

        log.audit({
            title: 'E2E Test Started',
            details: 'Testing ' + documentos.length + ' documentos: ' + JSON.stringify(documentos) + ', provider: ' + provider + ', method: ' + context.request.method
        });

        // Botón para volver al form
        const backButtonField = form.addField({
            id: 'custpage_back_button',
            type: serverWidget.FieldType.INLINEHTML,
            label: ' '
        });

        // Construir URL correcta con script y deploy
        const script = runtime.getCurrentScript();
        const scriptId = script.id;
        const deploymentId = script.deploymentId;

        const baseUrl = context.request.url.split('?')[0];
        const backUrl = baseUrl + '?script=' + scriptId + '&deploy=' + deploymentId;
        const rerunUrl = backUrl + '&docs=' + encodeURIComponent(docsParam) + '&provider=' + provider + '&forceRefresh=' + forceRefresh + '&debug=' + debug;

        backButtonField.defaultValue = '<div style="margin-bottom: 20px;">' +
            '<a href="' + backUrl + '" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">⬅️ Volver al Formulario</a>' +
            ' ' +
            '<a href="' + rerunUrl + '" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">🔄 Re-ejecutar Test</a>' +
            '</div>';

        // Campo de parámetros
        const paramsField = form.addField({
            id: 'custpage_params',
            type: serverWidget.FieldType.INLINEHTML,
            label: 'Test Parameters'
        });

        paramsField.defaultValue = '<div style="background-color: #e7f3ff; padding: 15px; margin-bottom: 20px; border-radius: 5px;">' +
            '<h3 style="margin-top: 0;">📋 Test Parameters</h3>' +
            '<p><strong>Documentos:</strong> ' + documentos.join(', ') + ' (' + documentos.length + ' total)</p>' +
            '<p><strong>Provider:</strong> ' + provider + '</p>' +
            '<p><strong>Force Refresh:</strong> ' + (forceRefresh ? 'Yes' : 'No') + '</p>' +
            '<p><strong>Parallel:</strong> ' + (parallel ? 'Yes (faster)' : 'No (sequential)') + '</p>' +
            '<p><strong>Debug Mode:</strong> ' + (debug ? 'Yes' : 'No') + '</p>' +
            '<p><strong>Script:</strong> ' + runtime.getCurrentScript().id + '</p>' +
            '<p><strong>User:</strong> ' + runtime.getCurrentUser().name + '</p>' +
            '<p><strong>Method:</strong> ' + context.request.method + '</p>' +
            '</div>';

        // Ejecutar test
        const testResults = runMultipleDocumentsTest(documentos, provider, forceRefresh, debug, parallel);

        // Mostrar resultados
        const resultsField = form.addField({
            id: 'custpage_results',
            type: serverWidget.FieldType.INLINEHTML,
            label: 'Test Results'
        });

        resultsField.defaultValue = generateMultiDocHTML(testResults);
    }

    /**
     * Parsea documentos desde parámetro (JSON array, CSV, o single doc)
     */
    function parseDocumentos(docsParam) {
        // Intentar parsear como JSON array
        try {
            var parsed = JSON.parse(docsParam);
            if (Array.isArray(parsed)) {
                return parsed.map(function(doc) { 
                    return String(doc).replace(/[^\d]/g, ''); 
                });
            }
        } catch (e) {
            // No es JSON, continuar
        }

        // Intentar parsear como CSV
        if (docsParam.indexOf(',') > -1) {
            return docsParam.split(',').map(function(doc) {
                return doc.trim().replace(/[^\d]/g, '');
            }).filter(function(doc) {
                return doc.length >= 7;
            });
        }

        // Single documento
        return [docsParam.replace(/[^\d]/g, '')];
    }

    /**
     * Ejecuta test para múltiples documentos
     */
    function runMultipleDocumentsTest(documentos, provider, forceRefresh, debug, parallel) {
        var multiResults = {
            documentos: documentos,
            totalDocuments: documentos.length,
            provider: provider,
            timestamp: new Date().toISOString(),
            parallel: parallel,
            results: [],
            stats: {
                totalTime: 0,
                avgTime: 0,
                minTime: Infinity,
                maxTime: 0,
                successCount: 0,
                failedCount: 0,
                rejectedCount: 0,
                goodCount: 0,
                cachedCount: 0
            },
            error: null
        };

        var overallStart = Date.now();

        try {
            log.audit({
                title: 'Multi-Document Test Started',
                details: documentos.length + ' documentos, parallel=' + parallel
            });

            // Ejecutar tests (en paralelo o secuencial da igual en SuiteScript, no hay async)
            // Pero medimos tiempos individuales
            for (var i = 0; i < documentos.length; i++) {
                var doc = documentos[i];
                
                log.audit({
                    title: 'Testing Document ' + (i + 1) + '/' + documentos.length,
                    details: doc
                });

                var result = runEndToEndTest(doc, provider, forceRefresh, debug);
                multiResults.results.push(result);

                // Actualizar stats
                if (result.success) {
                    multiResults.stats.successCount++;
                    
                    if (result.scoreResult) {
                        if (result.scoreResult.metadata && result.scoreResult.metadata.isRejected) {
                            multiResults.stats.rejectedCount++;
                        }
                        if (result.scoreResult.metadata && result.scoreResult.metadata.isGood) {
                            multiResults.stats.goodCount++;
                        }
                        if (result.scoreResult.metadata && result.scoreResult.metadata.fromCache) {
                            multiResults.stats.cachedCount++;
                        }
                    }
                } else {
                    multiResults.stats.failedCount++;
                }

                multiResults.stats.minTime = Math.min(multiResults.stats.minTime, result.totalTime);
                multiResults.stats.maxTime = Math.max(multiResults.stats.maxTime, result.totalTime);
            }

            multiResults.stats.totalTime = Date.now() - overallStart;
            multiResults.stats.avgTime = Math.round(multiResults.stats.totalTime / documentos.length);

            log.audit({
                title: 'Multi-Document Test Completed',
                details: 'Success: ' + multiResults.stats.successCount + '/' + documentos.length + 
                        ', Total time: ' + multiResults.stats.totalTime + 'ms, Avg: ' + multiResults.stats.avgTime + 'ms'
            });

        } catch (error) {
            log.error({
                title: 'Multi-Document Test Error',
                details: error.toString()
            });

            multiResults.error = {
                message: error.toString(),
                stack: error.stack || 'No stack trace'
            };
        }

        return multiResults;
    }

    /**
     * Ejecuta el test end-to-end completo para un solo documento
     */
    function runEndToEndTest(documento, provider, forceRefresh, debug) {
        const results = {
            documento: documento,
            provider: provider,
            timestamp: new Date().toISOString(),
            steps: [],
            totalTime: 0,
            success: false,
            scoreResult: null,
            error: null
        };

        const overallStart = Date.now();

        try {
            // PASO 1: Validar entrada
            results.steps.push(executeStep(
                'Step 1: Input Validation',
                function() {
                    if (!documento || documento.length < 7) {
                        throw new Error('Invalid documento: must be at least 7 digits');
                    }
                    return {
                        valid: true,
                        cleanDoc: documento.replace(/[^\d]/g, ''),
                        length: documento.length
                    };
                }
            ));

            // PASO 2: Llamar al servicio principal
            results.steps.push(executeStep(
                'Step 2: Call service.calculateScore()',
                function() {
                    var options = {
                        provider: provider,
                        forceRefresh: forceRefresh,
                        debug: debug,
                        timeout: 15000
                    };

                    log.audit({
                        title: 'Calling calculateScore',
                        details: 'doc: ' + documento + ', options: ' + JSON.stringify(options)
                    });

                    var scoreResult = scoreService.calculateScore(documento, options);

                    log.audit({
                        title: 'Score Result',
                        details: JSON.stringify(scoreResult, null, 2)
                    });

                    return scoreResult;
                }
            ));

            // Guardar resultado del scoring
            var lastStep = results.steps[results.steps.length - 1];
            if (lastStep.success && lastStep.result) {
                results.scoreResult = lastStep.result;
            }

            // PASO 3: Validar resultado
            results.steps.push(executeStep(
                'Step 3: Validate Score Result',
                function() {
                    var score = results.scoreResult;
                    if (!score) {
                        throw new Error('Score result is null');
                    }

                    var validations = {
                        hasFinalScore: typeof score.finalScore === 'number',
                        hasMetadata: !!score.metadata,
                        hasValidation: !!score.validation,
                        isRejected: score.metadata && score.metadata.isRejected === true,
                        scoreValue: score.finalScore,
                        scoreRounded: score.score || Math.round(score.finalScore * 1000),
                        isGood: score.metadata && score.metadata.isGood
                    };

                    // Validar estructura requerida
                    if (!validations.hasFinalScore) {
                        throw new Error('Missing finalScore in result');
                    }
                    if (!validations.hasMetadata) {
                        throw new Error('Missing metadata in result');
                    }

                    return validations;
                }
            ));

            // PASO 4: Analizar metadata
            results.steps.push(executeStep(
                'Step 4: Analyze Metadata',
                function() {
                    var score = results.scoreResult;
                    var metadata = score.metadata || {};

                    var analysis = {
                        provider: metadata.provider || 'unknown',
                        calculatedAt: metadata.calculatedAt,
                        fromCache: metadata.fromCache === true,
                        isRejected: metadata.isRejected === true,
                        rejectionReason: metadata.rejectionReason || 'N/A',
                        goodThreshold: metadata.goodThreshold || 'N/A',
                        isGood: metadata.isGood === true,
                        requestId: metadata.requestId || 'N/A'
                    };

                    if (analysis.isRejected) {
                        analysis.warning = 'Score was REJECTED: ' + analysis.rejectionReason;
                    }

                    return analysis;
                }
            ));

            // PASO 5: Analizar contributions (si existen)
            results.steps.push(executeStep(
                'Step 5: Analyze Contributions',
                function() {
                    var score = results.scoreResult;
                    var contributions = score.contributions || {};

                    var analysis = {
                        totalContributions: Object.keys(contributions).length,
                        hasVigente: 'vigente' in contributions,
                        hasVencido: 'vencido' in contributions,
                        hasCastigado: 'castigado' in contributions,
                        contributionsList: []
                    };

                    // Listar las primeras 10 contribuciones
                    var keys = Object.keys(contributions);
                    for (var i = 0; i < Math.min(keys.length, 10); i++) {
                        var key = keys[i];
                        var contrib = contributions[key];
                        analysis.contributionsList.push({
                            name: key,
                            value: contrib.value || contrib.rawValue || contrib,
                            type: typeof contrib
                        });
                    }

                    if (keys.length > 10) {
                        analysis.warning = 'Showing first 10 of ' + keys.length + ' contributions';
                    }

                    return analysis;
                }
            ));

            // PASO 6: Validar flags
            results.steps.push(executeStep(
                'Step 6: Check Flags',
                function() {
                    var score = results.scoreResult;
                    var flags = score.flags || {};

                    return {
                        totalFlags: Object.keys(flags).length,
                        isDeceased: flags.isDeceased === true,
                        hasRejectableRating: flags.hasRejectableRating === true,
                        allFlags: flags
                    };
                }
            ));

            results.success = true;

        } catch (error) {
            log.error({
                title: 'E2E Test Error',
                details: error.toString() + '\n' + (error.stack || '')
            });

            results.error = {
                message: error.toString(),
                stack: error.stack || 'No stack trace',
                name: error.name || 'Error'
            };

            results.steps.push({
                name: 'ERROR OCCURRED',
                success: false,
                error: error.toString(),
                elapsedMs: 0
            });
        }

        results.totalTime = Date.now() - overallStart;

        log.audit({
            title: 'E2E Test Completed',
            details: 'Success: ' + results.success + ', Total time: ' + results.totalTime + 'ms'
        });

        return results;
    }

    /**
     * Ejecuta un paso individual y mide tiempo
     */
    function executeStep(stepName, stepFunction) {
        var step = {
            name: stepName,
            success: false,
            elapsedMs: 0,
            result: null,
            error: null
        };

        var start = Date.now();

        try {
            log.audit({
                title: 'Executing Step',
                details: stepName
            });

            step.result = stepFunction();
            step.success = true;

            log.audit({
                title: 'Step Completed',
                details: stepName + ' - Success'
            });

        } catch (error) {
            step.error = error.toString();
            step.success = false;

            log.error({
                title: 'Step Failed',
                details: stepName + ' - ' + error.toString()
            });
        }

        step.elapsedMs = Date.now() - start;
        return step;
    }

    /**
     * Genera HTML para múltiples documentos
     */
    function generateMultiDocHTML(multiResults) {
        let html = '<style>';
        html += 'body { font-family: Arial, sans-serif; }';
        html += '.summary { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }';
        html += '.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }';
        html += '.stat-box { background-color: white; padding: 15px; border-radius: 5px; border: 2px solid #007bff; text-align: center; }';
        html += '.stat-box.success { border-color: #28a745; }';
        html += '.stat-box.warning { border-color: #ffc107; }';
        html += '.stat-box.danger { border-color: #dc3545; }';
        html += '.stat-value { font-size: 32px; font-weight: bold; margin: 10px 0; }';
        html += '.stat-label { font-size: 12px; color: #666; text-transform: uppercase; }';
        html += '.comparison-table { width: 100%; border-collapse: collapse; margin: 20px 0; }';
        html += '.comparison-table th { background-color: #007bff; color: white; padding: 12px; text-align: left; }';
        html += '.comparison-table td { padding: 10px; border-bottom: 1px solid #ddd; }';
        html += '.comparison-table tr:hover { background-color: #f5f5f5; }';
        html += '.score-badge { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }';
        html += '.score-badge.good { background-color: #d4edda; color: #155724; }';
        html += '.score-badge.bad { background-color: #f8d7da; color: #721c24; }';
        html += '.score-badge.rejected { background-color: #fff3cd; color: #856404; }';
        html += '.time-badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 11px; }';
        html += '.time-badge.fast { background-color: #d4edda; color: #155724; }';
        html += '.time-badge.medium { background-color: #fff3cd; color: #856404; }';
        html += '.time-badge.slow { background-color: #f8d7da; color: #721c24; }';
        html += '.detail-section { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }';
        html += '.chart-bar { background-color: #007bff; height: 20px; border-radius: 3px; margin: 5px 0; }';
        html += '.expand-btn { cursor: pointer; color: #007bff; text-decoration: underline; margin: 10px 0; display: inline-block; }';
        html += '.hidden { display: none; }';
        html += '</style>';

        // Global Summary
        html += '<div class="summary">';
        html += '<h2>📊 Multi-Document Test Summary</h2>';
        html += '<p><strong>Timestamp:</strong> ' + multiResults.timestamp + '</p>';
        html += '<p><strong>Total Documents:</strong> ' + multiResults.totalDocuments + '</p>';
        html += '<p><strong>Provider:</strong> ' + multiResults.provider + '</p>';
        html += '<p><strong>Parallel Mode:</strong> ' + (multiResults.parallel ? 'Yes' : 'No (Sequential)') + '</p>';
        html += '</div>';

        // Stats Grid
        let stats = multiResults.stats;
        html += '<div class="stats-grid">';
        
        // Total Time
        html += '<div class="stat-box">';
        html += '<div class="stat-label">Total Time</div>';
        html += '<div class="stat-value">' + stats.totalTime + '<small>ms</small></div>';
        html += '<div class="stat-label">' + (stats.totalTime / 1000).toFixed(2) + 's</div>';
        html += '</div>';

        // Avg Time
        html += '<div class="stat-box ' + (stats.avgTime < 200 ? 'success' : stats.avgTime < 1000 ? 'warning' : 'danger') + '">';
        html += '<div class="stat-label">Avg Time/Doc</div>';
        html += '<div class="stat-value">' + stats.avgTime + '<small>ms</small></div>';
        html += '<div class="stat-label">Min: ' + stats.minTime + 'ms | Max: ' + stats.maxTime + 'ms</div>';
        html += '</div>';

        // Success Rate
        let successRate = Math.round((stats.successCount / multiResults.totalDocuments) * 100);
        html += '<div class="stat-box ' + (successRate === 100 ? 'success' : successRate > 70 ? 'warning' : 'danger') + '">';
        html += '<div class="stat-label">Success Rate</div>';
        html += '<div class="stat-value">' + successRate + '<small>%</small></div>';
        html += '<div class="stat-label">' + stats.successCount + ' / ' + multiResults.totalDocuments + ' successful</div>';
        html += '</div>';

        // Good Scores
        html += '<div class="stat-box success">';
        html += '<div class="stat-label">Good Scores</div>';
        html += '<div class="stat-value">' + stats.goodCount + '</div>';
        html += '<div class="stat-label">Rejected: ' + stats.rejectedCount + ' | Cached: ' + stats.cachedCount + '</div>';
        html += '</div>';

        html += '</div>';

        // Comparison Table
        html += '<h2>📋 Individual Results</h2>';
        html += '<table class="comparison-table">';
        html += '<thead><tr>';
        html += '<th>#</th>';
        html += '<th>Documento</th>';
        html += '<th>Score</th>';
        html += '<th>Status</th>';
        html += '<th>Time</th>';
        html += '<th>Cache</th>';
        html += '<th>Details</th>';
        html += '</tr></thead>';
        html += '<tbody>';

        for (let i = 0; i < multiResults.results.length; i++) {
            let result = multiResults.results[i];
            let docNum = i + 1;

            html += '<tr>';
            html += '<td><strong>' + docNum + '</strong></td>';
            html += '<td><code>' + result.documento + '</code></td>';

            // Score
            if (result.scoreResult && result.success) {
                let score = result.scoreResult.score || Math.round((result.scoreResult.finalScore || 0) * 1000);
                let isRejected = result.scoreResult.metadata && result.scoreResult.metadata.isRejected;
                let isGood = result.scoreResult.metadata && result.scoreResult.metadata.isGood;

                if (isRejected) {
                    html += '<td><span class="score-badge rejected">REJECTED</span></td>';
                    html += '<td>' + (result.scoreResult.metadata.rejectionReason || 'Unknown') + '</td>';
                } else {
                    html += '<td><strong>' + score + '</strong></td>';
                    html += '<td><span class="score-badge ' + (isGood ? 'good' : 'bad') + '">' + 
                            (isGood ? '✅ GOOD' : '⚠️ LOW') + '</span></td>';
                }
            } else {
                html += '<td>—</td>';
                html += '<td><span class="score-badge rejected">ERROR</span></td>';
            }

            // Time
            var timeBadge = 'fast';
            if (result.totalTime > 1000) timeBadge = 'slow';
            else if (result.totalTime > 200) timeBadge = 'medium';
            
            html += '<td><span class="time-badge ' + timeBadge + '">' + result.totalTime + 'ms</span></td>';

            // Cache
            let fromCache = result.scoreResult && result.scoreResult.metadata && result.scoreResult.metadata.fromCache;
            html += '<td>' + (fromCache ? '🚀 Yes' : '📡 No') + '</td>';

            // Details link
            html += '<td><span class="expand-btn" onclick="toggleDetail(' + i + ')">Ver detalles</span></td>';
            html += '</tr>';

            // Hidden detail row
            html += '<tr id="detail_' + i + '" class="hidden">';
            html += '<td colspan="7">';
            html += '<div class="detail-section">';
            html += generateHTML(result); // Usar la función existente para mostrar detalles
            html += '</div>';
            html += '</td>';
            html += '</tr>';
        }

        html += '</tbody>';
        html += '</table>';

        // Performance Chart
        html += '<h2>📈 Performance Chart</h2>';
        html += '<div class="summary">';
        let maxTime = stats.maxTime || 1;
        for (var i = 0; i < multiResults.results.length; i++) {
            var result = multiResults.results[i];
            var barWidth = (result.totalTime / maxTime) * 100;
            var color = result.totalTime < 200 ? '#28a745' : result.totalTime < 1000 ? '#ffc107' : '#dc3545';
            
            html += '<div style="margin: 10px 0;">';
            html += '<div style="display: flex; align-items: center;">';
            html += '<div style="width: 100px; font-size: 12px;"><code>' + result.documento + '</code></div>';
            html += '<div style="flex: 1;">';
            html += '<div class="chart-bar" style="width: ' + barWidth + '%; background-color: ' + color + ';"></div>';
            html += '</div>';
            html += '<div style="width: 80px; text-align: right; font-size: 12px; font-weight: bold;">' + result.totalTime + 'ms</div>';
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';

        // Recommendations
        html += '<div class="summary">';
        html += '<h2>💡 Performance Analysis</h2>';
        html += '<ul>';
        
        if (stats.avgTime < 200) {
            html += '<li>✅ <strong>Excellent:</strong> Average time ' + stats.avgTime + 'ms < 200ms (muy rápido)</li>';
        } else if (stats.avgTime < 1000) {
            html += '<li>✅ <strong>Good:</strong> Average time ' + stats.avgTime + 'ms < 1000ms</li>';
        } else {
            html += '<li>⚠️ <strong>Slow:</strong> Average time ' + stats.avgTime + 'ms > 1000ms - Review performance</li>';
        }

        if (stats.cachedCount > 0) {
            let cacheRate = Math.round((stats.cachedCount / stats.successCount) * 100);
            html += '<li>🚀 <strong>Cache Hit Rate:</strong> ' + cacheRate + '% (' + stats.cachedCount + '/' + stats.successCount + ' from cache)</li>';
        }

        if (stats.failedCount > 0) {
            html += '<li>❌ <strong>Failed:</strong> ' + stats.failedCount + ' documentos fallaron - Review Execution Log</li>';
        }

        if (stats.rejectedCount > 0) {
            var rejectRate = Math.round((stats.rejectedCount / stats.successCount) * 100);
            html += '<li>⚠️ <strong>Rejected:</strong> ' + stats.rejectedCount + ' documentos rechazados (' + rejectRate + '%)</li>';
        }

        let throughput = Math.round((multiResults.totalDocuments / stats.totalTime) * 1000);
        html += '<li>⚡ <strong>Throughput:</strong> ~' + throughput + ' documentos/segundo</li>';

        html += '<li>📊 Min time: ' + stats.minTime + 'ms | Max time: ' + stats.maxTime + 'ms | Range: ' + (stats.maxTime - stats.minTime) + 'ms</li>';
        html += '</ul>';
        html += '</div>';

        // NUEVO: Score Distribution Analysis
        html += generateScoreDistribution(multiResults);

        // NUEVO: Rejection Reason Breakdown
        html += generateRejectionAnalysis(multiResults);

        // Pie Charts Section
        html += generatePieCharts(multiResults);

        // JavaScript for toggle details
        html += '<script>';
        html += 'function toggleDetail(index) {';
        html += '  var row = document.getElementById("detail_" + index);';
        html += '  if (row.classList.contains("hidden")) {';
        html += '    row.classList.remove("hidden");';
        html += '  } else {';
        html += '    row.classList.add("hidden");';
        html += '  }';
        html += '}';
        html += '</script>';

        return html;
    }

    /**
     * Genera gráficos de torta para visualizar distribuciones
     */
    function generatePieCharts(multiResults) {
        let html = '';
        let stats = multiResults.stats;

        // Calcular correctamente los estados
        let goodCount = stats.goodCount || 0;
        let rejectedCount = stats.rejectedCount || 0;
        let failedCount = stats.failedCount || 0;
        let successCount = stats.successCount || 0;
        
        // Low score = successful pero no good ni rejected
        let lowScoreCount = Math.max(0, successCount - goodCount - rejectedCount);

        log.debug('PIE_CHART_DEBUG', {
            total: multiResults.totalDocuments,
            good: goodCount,
            rejected: rejectedCount,
            failed: failedCount,
            success: successCount,
            lowScore: lowScoreCount
        });
        
        html += '<h2>📊 Distribución de Resultados</h2>';
        html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0;">';
        
        // Pie Chart 1: Status Distribution
        html += '<div class="summary" style="text-align: center;">';
        html += '<h3>Estado de Documentos</h3>';
        
        let statusData = [];
        if (goodCount > 0) statusData.push({ label: 'Good', value: goodCount, color: '#28a745' });
        if (rejectedCount > 0) statusData.push({ label: 'Rejected', value: rejectedCount, color: '#ffc107' });
        if (lowScoreCount > 0) statusData.push({ label: 'Low Score', value: lowScoreCount, color: '#dc3545' });
        if (failedCount > 0) statusData.push({ label: 'Failed', value: failedCount, color: '#6c757d' });
        
        html += generatePieChartSVG(statusData, 'status-chart');
        
        html += '<div style="margin-top: 10px; font-size: 12px; text-align: left;">';
        if (goodCount > 0) {
            html += '<div>🟢 <strong>Good:</strong> ' + goodCount + ' (' + Math.round((goodCount / multiResults.totalDocuments) * 100) + '%)</div>';
        }
        if (rejectedCount > 0) {
            html += '<div>🟡 <strong>Rejected:</strong> ' + rejectedCount + ' (' + Math.round((rejectedCount / multiResults.totalDocuments) * 100) + '%)</div>';
        }
        if (lowScoreCount > 0) {
            html += '<div>🔴 <strong>Low:</strong> ' + lowScoreCount + ' (' + Math.round((lowScoreCount / multiResults.totalDocuments) * 100) + '%)</div>';
        }
        if (failedCount > 0) {
            html += '<div>⚫ <strong>Failed:</strong> ' + failedCount + ' (' + Math.round((failedCount / multiResults.totalDocuments) * 100) + '%)</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // Pie Chart 2: Cache Distribution
        let cachedCount = stats.cachedCount || 0;
        let freshCount = Math.max(0, successCount - cachedCount);

        html += '<div class="summary" style="text-align: center;">';
        html += '<h3>Origen de Datos</h3>';
        
        let cacheData = [];
        if (cachedCount > 0) cacheData.push({ label: 'Cached', value: cachedCount, color: '#007bff' });
        if (freshCount > 0) cacheData.push({ label: 'Fresh', value: freshCount, color: '#17a2b8' });
        
        html += generatePieChartSVG(cacheData, 'cache-chart');
        
        html += '<div style="margin-top: 10px; font-size: 12px; text-align: left;">';
        let cacheRate = successCount > 0 ? Math.round((cachedCount / successCount) * 100) : 0;
        if (cachedCount > 0) {
            html += '<div>🚀 <strong>Cached:</strong> ' + cachedCount + ' (' + cacheRate + '%)</div>';
        }
        if (freshCount > 0) {
            html += '<div>📡 <strong>Fresh:</strong> ' + freshCount + ' (' + (100 - cacheRate) + '%)</div>';
        }
        html += '</div>';
        html += '</div>';
        
        // Pie Chart 3: Performance Distribution
        let fastCount = 0;
        let mediumCount = 0;
        let slowCount = 0;

        for (let i = 0; i < multiResults.results.length; i++) {
            let result = multiResults.results[i];
            if (result.success) {
                let time = result.totalTime;
                if (time < 200) fastCount++;
                else if (time < 1000) mediumCount++;
                else slowCount++;
            }
        }
        
        html += '<div class="summary" style="text-align: center;">';
        html += '<h3>Performance</h3>';
        
        let perfData = [];
        if (fastCount > 0) perfData.push({ label: 'Fast', value: fastCount, color: '#28a745' });
        if (mediumCount > 0) perfData.push({ label: 'Medium', value: mediumCount, color: '#ffc107' });
        if (slowCount > 0) perfData.push({ label: 'Slow', value: slowCount, color: '#dc3545' });
        
        html += generatePieChartSVG(perfData, 'performance-chart');
        
        html += '<div style="margin-top: 10px; font-size: 12px; text-align: left;">';
        let perfTotal = fastCount + mediumCount + slowCount;
        if (fastCount > 0) {
            html += '<div>🟢 <strong>Fast (&lt;200ms):</strong> ' + fastCount + ' (' + Math.round((fastCount / perfTotal) * 100) + '%)</div>';
        }
        if (mediumCount > 0) {
            html += '<div>🟡 <strong>Medium (200-1000ms):</strong> ' + mediumCount + ' (' + Math.round((mediumCount / perfTotal) * 100) + '%)</div>';
        }
        if (slowCount > 0) {
            html += '<div>🔴 <strong>Slow (&gt;1000ms):</strong> ' + slowCount + ' (' + Math.round((slowCount / perfTotal) * 100) + '%)</div>';
        }
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        return html;
    }

    /**
     * Genera análisis de distribución de scores por rangos
     */
    function generateScoreDistribution(multiResults) {
        let html = '';
        html += '<div class="summary">';
        html += '<h2>📊 Distribución de Scores</h2>';
        
        // Definir rangos
        let ranges = [
            { label: 'Muy Bajo (0-199)', min: 0, max: 199, color: '#dc3545', count: 0 },
            { label: 'Bajo (200-399)', min: 200, max: 399, color: '#fd7e14', count: 0 },
            { label: 'Aceptable (400-499)', min: 400, max: 499, color: '#ffc107', count: 0 },
            { label: 'Bueno (500-599)', min: 500, max: 599, color: '#28a745', count: 0 },
            { label: 'Muy Bueno (600-699)', min: 600, max: 699, color: '#20c997', count: 0 },
            { label: 'Excelente (700+)', min: 700, max: 9999, color: '#0dcaf0', count: 0 }
        ];
        
        // Contar documentos por rango (solo los exitosos)
        for (let i = 0; i < multiResults.results.length; i++) {
            let result = multiResults.results[i];
            if (result.success && result.score && !result.score.metadata.isRejected) {
                let finalScore = result.score.finalScore || 0;

                for (let j = 0; j < ranges.length; j++) {
                    if (finalScore >= ranges[j].min && finalScore <= ranges[j].max) {
                        ranges[j].count++;
                        break;
                    }
                }
            }
        }
        
        // Calcular total de scores válidos
        let totalValidScores = 0;
        for (let k = 0; k < ranges.length; k++) {
            totalValidScores += ranges[k].count;
        }
        
        if (totalValidScores === 0) {
            html += '<p style="color: #6c757d; font-style: italic;">⚠️ No hay scores válidos para analizar (todos rechazados o fallidos)</p>';
            html += '</div>';
            return html;
        }
        
        // Encontrar el máximo para escalar barras
        let maxCount = 0;
        for (let m = 0; m < ranges.length; m++) {
            if (ranges[m].count > maxCount) maxCount = ranges[m].count;
        }
        
        // Generar gráfico de barras horizontal
        html += '<div style="margin: 20px 0;">';
        for (let n = 0; n < ranges.length; n++) {
            let range = ranges[n];
            if (range.count === 0) continue; // Skip vacíos

            let percentage = Math.round((range.count / totalValidScores) * 100);
            let barWidth = maxCount > 0 ? (range.count / maxCount) * 100 : 0;
            
            html += '<div style="margin: 10px 0;">';
            html += '<div style="display: flex; align-items: center; gap: 10px;">';
            html += '<div style="width: 150px; font-size: 12px; font-weight: bold;">' + range.label + '</div>';
            html += '<div style="flex: 1;">';
            html += '<div class="chart-bar" style="width: ' + barWidth + '%; background-color: ' + range.color + '; display: flex; align-items: center; padding-left: 10px; color: white; font-weight: bold; font-size: 12px; min-height: 25px;">';
            if (barWidth > 15) {
                html += range.count + ' (' + percentage + '%)';
            }
            html += '</div>';
            html += '</div>';
            if (barWidth <= 15) {
                html += '<div style="width: 80px; text-align: left; font-size: 12px; font-weight: bold;">' + range.count + ' (' + percentage + '%)</div>';
            }
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
        
        // Estadísticas adicionales
        html += '<h3>📈 Estadísticas de Score</h3>';
        html += '<ul>';
        
        // Calcular promedio, min, max de scores válidos
        let scores = [];
        for (let p = 0; p < multiResults.results.length; p++) {
            let res = multiResults.results[p];
            if (res.success && res.score && !res.score.metadata.isRejected) {
                scores.push(res.score.finalScore || 0);
            }
        }
        
        if (scores.length > 0) {
            scores.sort(function(a, b) { return a - b; });
            var avgScore = Math.round(scores.reduce(function(sum, s) { return sum + s; }, 0) / scores.length);
            var minScore = scores[0];
            var maxScore = scores[scores.length - 1];
            var medianScore = scores.length % 2 === 0 
                ? Math.round((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2)
                : scores[Math.floor(scores.length / 2)];
            
            html += '<li>📊 <strong>Promedio:</strong> ' + avgScore + ' puntos</li>';
            html += '<li>📉 <strong>Mínimo:</strong> ' + minScore + ' puntos</li>';
            html += '<li>📈 <strong>Máximo:</strong> ' + maxScore + ' puntos</li>';
            html += '<li>📍 <strong>Mediana:</strong> ' + medianScore + ' puntos</li>';
            html += '<li>📏 <strong>Rango:</strong> ' + (maxScore - minScore) + ' puntos</li>';
            
            // Percentiles
            let p25 = scores[Math.floor(scores.length * 0.25)];
            let p75 = scores[Math.floor(scores.length * 0.75)];
            html += '<li>📊 <strong>P25:</strong> ' + p25 + ' | <strong>P75:</strong> ' + p75 + '</li>';
        }
        
        html += '</ul>';
        html += '</div>';
        
        return html;
    }

    /**
     * Genera análisis de motivos de rechazo
     */
    function generateRejectionAnalysis(multiResults) {
        let html = '';
        
        html += '<div class="summary">';
        html += '<h2>🚫 Análisis de Rechazos</h2>';
        
        // Contar rechazos
        let rejectedResults = [];
        for (let i = 0; i < multiResults.results.length; i++) {
            let result = multiResults.results[i];
            if (result.success && result.score && result.score.metadata.isRejected) {
                rejectedResults.push(result);
            }
        }
        
        if (rejectedResults.length === 0) {
            html += '<p style="color: #28a745; font-weight: bold;">✅ No hay documentos rechazados</p>';
            html += '</div>';
            return html;
        }
        
        // Agrupar por motivo de rechazo
        let reasonCounts = {};
        let reasonMessages = {};
        
        for (let j = 0; j < rejectedResults.length; j++) {
            let rejected = rejectedResults[j];
            let reason = rejected.score.metadata.rejectionReason || 'UNKNOWN';
            let message = rejected.score.metadata.rejectionMessage || 'Sin mensaje';
            
            if (!reasonCounts[reason]) {
                reasonCounts[reason] = 0;
                reasonMessages[reason] = message;
            }
            reasonCounts[reason]++;
        }
        
        // Convertir a array y ordenar por frecuencia
        let reasonArray = [];
        for (let reason in reasonCounts) {
            if (reasonCounts.hasOwnProperty(reason)) {
                reasonArray.push({
                    reason: reason,
                    count: reasonCounts[reason],
                    message: reasonMessages[reason],
                    percentage: Math.round((reasonCounts[reason] / rejectedResults.length) * 100)
                });
            }
        }
        
        reasonArray.sort(function(a, b) { return b.count - a.count; });
        
        // Alerta si hay muchos rechazos
        let rejectRate = Math.round((rejectedResults.length / multiResults.totalDocuments) * 100);
        if (rejectRate > 50) {
            html += '<div style="background-color: #f8d7da; border: 2px solid #dc3545; border-radius: 5px; padding: 15px; margin-bottom: 20px;">';
            html += '<h3 style="color: #721c24; margin-top: 0;">⚠️ ALTA TASA DE RECHAZO</h3>';
            html += '<p style="color: #721c24;"><strong>' + rejectRate + '%</strong> de los documentos fueron rechazados (' + rejectedResults.length + '/' + multiResults.totalDocuments + ')</p>';
            html += '<p style="color: #721c24;">Esto puede indicar un problema con:</p>';
            html += '<ul style="color: #721c24;">';
            html += '<li>Las reglas de scoring son demasiado estrictas</li>';
            html += '<li>Los documentos de prueba no son representativos</li>';
            html += '<li>Hay un error en la configuración del provider</li>';
            html += '</ul>';
            html += '</div>';
        }
        
        // Tabla de motivos de rechazo
        html += '<h3>📋 Motivos de Rechazo</h3>';
        html += '<table class="comparison-table">';
        html += '<thead><tr>';
        html += '<th>#</th>';
        html += '<th>Motivo</th>';
        html += '<th>Mensaje</th>';
        html += '<th>Cantidad</th>';
        html += '<th>%</th>';
        html += '<th>Visual</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        for (let k = 0; k < reasonArray.length; k++) {
            let item = reasonArray[k];
            let barWidth = (item.count / rejectedResults.length) * 100;
            
            html += '<tr>';
            html += '<td><strong>' + (k + 1) + '</strong></td>';
            html += '<td><code style="color: #dc3545; font-weight: bold;">' + escapeHtml(item.reason) + '</code></td>';
            html += '<td style="font-size: 11px;">' + escapeHtml(item.message) + '</td>';
            html += '<td><strong>' + item.count + '</strong></td>';
            html += '<td><strong>' + item.percentage + '%</strong></td>';
            html += '<td>';
            html += '<div style="background-color: #dc3545; width: ' + barWidth + '%; height: 20px; border-radius: 3px;"></div>';
            html += '</td>';
            html += '</tr>';
        }
        
        html += '</tbody>';
        html += '</table>';
        
        // Recomendaciones específicas por motivo
        html += '<h3>💡 Recomendaciones</h3>';
        html += '<ul>';
        
        for (let m = 0; m < reasonArray.length; m++) {
            let rec = reasonArray[m];
            html += '<li><strong>' + escapeHtml(rec.reason) + ':</strong> ';
            
            // Recomendaciones específicas según el motivo
            switch (rec.reason) {
                case 'SERVICE_ERROR':
                    html += 'Revisa los logs de ejecución para ver el error técnico. Puede ser un problema de conectividad o configuración.';
                    break;
                case 'INVALID_DATA':
                    html += 'Los datos del provider son inválidos o incompletos. Verifica que el documento existe en el sistema del provider.';
                    break;
                case 'MISSING_REQUIRED_FIELDS':
                    html += 'Faltan campos obligatorios. Revisa la configuración de las reglas y los campos requeridos.';
                    break;
                case 'SCORE_TOO_LOW':
                    html += 'El score calculado está por debajo del umbral mínimo. Revisa las variables que están bajando el score.';
                    break;
                case 'BUSINESS_RULE_VIOLATION':
                    html += 'Se violó una regla de negocio específica (ej: atraso_max > umbral). Revisa las reglas activas.';
                    break;
                default:
                    html += 'Revisa la documentación de este motivo de rechazo o consulta los logs para más detalles.';
            }
            
            html += ' <em>(' + rec.count + ' documento' + (rec.count > 1 ? 's' : '') + ' afectado' + (rec.count > 1 ? 's' : '') + ')</em></li>';
        }
        
        html += '</ul>';
        
        // Pie Chart de motivos (si hay más de 1 motivo)
        if (reasonArray.length > 1) {
            html += '<h3>📊 Distribución de Motivos</h3>';
            let pieData = [];
            let colors = ['#dc3545', '#fd7e14', '#ffc107', '#6c757d', '#e83e8c'];
            for (let n = 0; n < reasonArray.length && n < 5; n++) {
                pieData.push({
                    label: reasonArray[n].reason,
                    value: reasonArray[n].count,
                    color: colors[n]
                });
            }
            html += '<div style="text-align: center;">';
            html += generatePieChartSVG(pieData, 'rejection-reasons');
            html += '</div>';
        }
        
        html += '</div>';
        
        return html;
    }

    /**
     * Genera un gráfico de torta en SVG
     */
    function generatePieChartSVG(data, chartId) {
        let html = '';
        let total = 0;
        
        // Calcular total
        for (let i = 0; i < data.length; i++) {
            total += data[i].value || 0;
        }
        
        log.debug('SVG_DEBUG_' + chartId, {
            data: data,
            total: total
        });
        
        if (total === 0 || !data || data.length === 0) {
            html += '<div style="width: 200px; height: 200px; margin: 0 auto; display: flex; align-items: center; justify-content: center; background-color: #f8f9fa; border-radius: 50%; border: 2px solid #dee2e6;">';
            html += '<span style="color: #6c757d; font-size: 14px;">Sin datos</span>';
            html += '</div>';
            return html;
        }
        
        // Si hay solo 1 segmento con 100%, dibujar un círculo completo
        if (data.length === 1 || (data.length === 2 && (data[0].value === 0 || data[1].value === 0))) {
            let singleSegment = data[0].value > 0 ? data[0] : data[1];
            html += '<svg width="200" height="200" viewBox="0 0 200 200" style="margin: 0 auto; display: block;">';
            html += '<circle cx="100" cy="100" r="80" fill="' + singleSegment.color + '" stroke="white" stroke-width="2">';
            html += '<title>' + singleSegment.label + ': ' + singleSegment.value + ' (100%)</title>';
            html += '</circle>';
            html += '<text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="white" font-weight="bold" font-size="16">100%</text>';
            html += '</svg>';
            return html;
        }
        
        // Crear SVG
        let size = 200;
        let radius = 80;
        let centerX = size / 2;
        let centerY = size / 2;
        
        html += '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="margin: 0 auto; display: block;">';
        
        let currentAngle = -90; // Empezar desde arriba (12 o'clock)

        for (let i = 0; i < data.length; i++) {
            let segment = data[i];
            if (!segment || segment.value === 0) continue;

            let percentage = (segment.value / total) * 100;
            let angle = (segment.value / total) * 360;

            // Calcular path del segmento
            let startAngle = currentAngle * Math.PI / 180;
            let endAngle = (currentAngle + angle) * Math.PI / 180;

            let x1 = centerX + radius * Math.cos(startAngle);
            let y1 = centerY + radius * Math.sin(startAngle);
            let x2 = centerX + radius * Math.cos(endAngle);
            let y2 = centerY + radius * Math.sin(endAngle);

            let largeArcFlag = angle > 180 ? 1 : 0;

            let pathData = 'M ' + centerX + ',' + centerY + ' ' +
                          'L ' + x1 + ',' + y1 + ' ' +
                          'A ' + radius + ',' + radius + ' 0 ' + largeArcFlag + ',1 ' + x2 + ',' + y2 + ' Z';
            
            html += '<path d="' + pathData + '" fill="' + segment.color + '" stroke="white" stroke-width="2">';
            html += '<title>' + segment.label + ': ' + segment.value + ' (' + percentage.toFixed(1) + '%)</title>';
            html += '</path>';
            
            // Añadir porcentaje en el segmento si es > 10%
            if (percentage > 10) {
                let labelAngle = (currentAngle + angle / 2) * Math.PI / 180;
                let labelRadius = radius * 0.6;
                let labelX = centerX + labelRadius * Math.cos(labelAngle);
                let labelY = centerY + labelRadius * Math.sin(labelAngle);

                html += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" dominant-baseline="middle" ' +
                       'fill="white" font-weight="bold" font-size="14">' +
                       percentage.toFixed(0) + '%</text>';
            }
            
            currentAngle += angle;
        }
        
        html += '</svg>';
        
        return html;
    }

    /**
     * Genera análisis detallado del score con variables importantes
     */
    function generateScoreAnalysis(score) {
        let html = '';
        let contributions = score.contributions || {};
        let rawData = score.rawData || {};
        let validation = score.validation || {};
        
        html += '<div class="summary">';
        html += '<h2>📊 Análisis de Score - Variables Importantes</h2>';
        
        // Variables Clave del Score
        html += '<h3>🔑 Variables Clave</h3>';
        html += '<table class="comparison-table">';
        html += '<thead><tr>';
        html += '<th>Variable</th>';
        html += '<th>Valor Raw</th>';
        html += '<th>Contribución</th>';
        html += '<th>Impacto</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        // Definir las variables más importantes en orden
        var importantVars = [
            { key: 'vigente', label: 'Créditos Vigentes', format: 'currency' },
            { key: 'vencido', label: 'Créditos Vencidos', format: 'currency' },
            { key: 'castigado', label: 'Créditos Castigados', format: 'currency' },
            { key: 'rating', label: 'Rating (Calificación)', format: 'number' },
            { key: 'atraso_max', label: 'Atraso Máximo (días)', format: 'number' },
            { key: 'cantidad_entidades', label: 'Cantidad Entidades', format: 'number' },
            { key: 'banco', label: 'Deuda Bancaria', format: 'currency' },
            { key: 'ent_t6', label: 'Entidades Tipo 6', format: 'number' },
            { key: 'linea_credito', label: 'Línea de Crédito', format: 'currency' },
            { key: 'consultas', label: 'Consultas Recientes', format: 'number' },
            { key: 'monto_operacion', label: 'Monto Operación', format: 'currency' },
            { key: 'nuevos', label: 'Créditos Nuevos', format: 'currency' }
        ];
        
        for (var i = 0; i < importantVars.length; i++) {
            var varInfo = importantVars[i];
            var varKey = varInfo.key;
            
            // Buscar en contributions
            var contribution = contributions[varKey];
            var rawValue = rawData[varKey];
            
            // Solo mostrar si existe
            if (contribution !== undefined || rawValue !== undefined) {
                html += '<tr>';
                html += '<td><strong>' + varInfo.label + '</strong><br><small><code>' + varKey + '</code></small></td>';
                
                // Valor Raw
                if (rawValue !== undefined) {
                    var formattedValue = formatValue(rawValue, varInfo.format);
                    html += '<td>' + formattedValue + '</td>';
                } else {
                    html += '<td><em>N/A</em></td>';
                }
                
                // Contribución (WOE score)
                if (contribution !== undefined) {
                    var contribValue = contribution.value || contribution.rawValue || contribution;
                    var contribFormatted = typeof contribValue === 'number' ? contribValue.toFixed(4) : String(contribValue);
                    
                    // Color según impacto
                    var color = 'inherit';
                    if (typeof contribValue === 'number') {
                        if (contribValue > 0.05) color = '#28a745'; // Verde (positivo)
                        else if (contribValue < -0.05) color = '#dc3545'; // Rojo (negativo)
                        else color = '#6c757d'; // Gris (neutral)
                    }
                    
                    html += '<td style="color: ' + color + '; font-weight: bold;">' + contribFormatted + '</td>';
                    
                    // Impacto visual
                    html += '<td>';
                    if (typeof contribValue === 'number') {
                        var impactWidth = Math.min(Math.abs(contribValue) * 500, 100);
                        var impactColor = contribValue > 0 ? '#28a745' : '#dc3545';
                        html += '<div style="background-color: ' + impactColor + '; width: ' + impactWidth + '%; height: 10px; border-radius: 3px;"></div>';
                        html += '<small>' + (contribValue > 0 ? '📈 Sube' : '📉 Baja') + ' el score</small>';
                    } else {
                        html += '<em>N/A</em>';
                    }
                    html += '</td>';
                } else {
                    html += '<td colspan="2"><em>N/A</em></td>';
                }
                
                html += '</tr>';
            }
        }
        
        html += '</tbody>';
        html += '</table>';
        
        // Top Positive Contributions
        html += '<h3>📈 Top Variables que SUBEN el Score</h3>';
        html += generateTopContributions(contributions, true, 5);
        
        // Top Negative Contributions
        html += '<h3>📉 Top Variables que BAJAN el Score</h3>';
        html += generateTopContributions(contributions, false, 5);
        
        // Validation Issues
        if (validation.issues && validation.issues.length > 0) {
            html += '<h3>⚠️ Validaciones y Advertencias</h3>';
            html += '<ul>';
            for (var j = 0; j < validation.issues.length; j++) {
                html += '<li>' + escapeHtml(validation.issues[j]) + '</li>';
            }
            html += '</ul>';
        }
        
        // Data Quality
        html += '<h3>✅ Calidad de Datos</h3>';
        html += '<p><strong>Completitud:</strong> ';
        var totalVars = importantVars.length;
        var presentVars = 0;
        for (var k = 0; k < importantVars.length; k++) {
            if (rawData[importantVars[k].key] !== undefined) presentVars++;
        }
        var completeness = Math.round((presentVars / totalVars) * 100);
        html += completeness + '% (' + presentVars + '/' + totalVars + ' variables presentes)</p>';
        
        html += '<p><strong>Fuente de Datos:</strong> ' + (score.metadata && score.metadata.provider ? score.metadata.provider : 'N/A') + '</p>';
        html += '<p><strong>Fecha de Consulta:</strong> ' + (score.metadata && score.metadata.calculatedAt ? score.metadata.calculatedAt : 'N/A') + '</p>';
        
        html += '</div>';
        
        return html;
    }

    /**
     * Genera tabla de top contributions (positivas o negativas)
     */
    function generateTopContributions(contributions, positive, limit) {
        let html = '';
        let sorted = [];
        
        // Convertir a array y filtrar
        for (let key in contributions) {
            if (contributions.hasOwnProperty(key)) {
                const contrib = contributions[key];
                const value = contrib.value || contrib.rawValue || contrib;
                if (typeof value === 'number') {
                    if ((positive && value > 0) || (!positive && value < 0)) {
                        sorted.push({ key: key, value: value });
                    }
                }
            }
        }
        
        // Ordenar por valor absoluto descendente
        sorted.sort(function(a, b) {
            return Math.abs(b.value) - Math.abs(a.value);
        });
        
        // Limitar a top N
        sorted = sorted.slice(0, limit);
        
        if (sorted.length === 0) {
            html += '<p><em>No hay contribuciones ' + (positive ? 'positivas' : 'negativas') + '</em></p>';
            return html;
        }
        
        html += '<table class="comparison-table">';
        html += '<thead><tr>';
        html += '<th>#</th>';
        html += '<th>Variable</th>';
        html += '<th>Contribución</th>';
        html += '<th>Impacto Visual</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        for (var i = 0; i < sorted.length; i++) {
            var item = sorted[i];
            var color = positive ? '#28a745' : '#dc3545';
            
            html += '<tr>';
            html += '<td><strong>' + (i + 1) + '</strong></td>';
            html += '<td><code>' + item.key + '</code></td>';
            html += '<td style="color: ' + color + '; font-weight: bold;">' + item.value.toFixed(4) + '</td>';
            
            // Barra visual
            var barWidth = Math.min(Math.abs(item.value) * 500, 100);
            html += '<td>';
            html += '<div style="background-color: ' + color + '; width: ' + barWidth + '%; height: 15px; border-radius: 3px;"></div>';
            html += '</td>';
            
            html += '</tr>';
        }
        
        html += '</tbody>';
        html += '</table>';
        
        return html;
    }

    /**
     * Formatea valores según tipo
     */
    function formatValue(value, format) {
        if (value === null || value === undefined) return '<em>N/A</em>';
        
        if (format === 'currency') {
            var num = parseFloat(value);
            if (isNaN(num)) return String(value);
            return '$' + num.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } else if (format === 'number') {
            var num2 = parseFloat(value);
            if (isNaN(num2)) return String(value);
            return num2.toLocaleString('es-UY');
        }
        
        return String(value);
    }

    /**
     * Genera HTML para mostrar resultados de un solo documento
     */
    function generateHTML(results) {
        let html = '<style>';
        html += 'body { font-family: Arial, sans-serif; }';
        html += '.step { border: 1px solid #ccc; margin: 10px 0; padding: 15px; border-radius: 5px; }';
        html += '.step.success { background-color: #d4edda; border-color: #c3e6cb; }';
        html += '.step.failed { background-color: #f8d7da; border-color: #f5c6cb; }';
        html += '.step h3 { margin-top: 0; }';
        html += '.detail { margin: 5px 0; padding-left: 20px; font-family: monospace; font-size: 12px; }';
        html += '.summary { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; }';
        html += '.score-box { background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #ffc107; }';
        html += '.score-box h2 { margin-top: 0; color: #856404; }';
        html += '.score-value { font-size: 48px; font-weight: bold; color: #856404; }';
        html += '.json-viewer { background-color: #f8f9fa; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 11px; overflow-x: auto; max-height: 400px; overflow-y: auto; }';
        html += '.warning { color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 3px; margin: 10px 0; }';
        html += '.error { color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 3px; margin: 10px 0; }';
        html += '</style>';

        // Summary
        html += '<div class="summary">';
        html += '<h2>📊 Test Summary</h2>';
        html += '<p><strong>Timestamp:</strong> ' + results.timestamp + '</p>';
        html += '<p><strong>Documento:</strong> ' + results.documento + '</p>';
        html += '<p><strong>Provider:</strong> ' + results.provider + '</p>';
        html += '<p><strong>Total Time:</strong> ' + results.totalTime + 'ms</p>';
        html += '<p><strong>Status:</strong> ' + (results.success ? '✅ SUCCESS' : '❌ FAILED') + '</p>';
        html += '</div>';

        // Score Box (si existe)
        if (results.scoreResult && !results.error) {
            const score = results.scoreResult;
            const isRejected = score.metadata && score.metadata.isRejected;
            const scoreValue = score.score || Math.round((score.finalScore || 0) * 1000);
            const isGood = score.metadata && score.metadata.isGood;

            html += '<div class="score-box">';
            html += '<h2>🎯 Score Result</h2>';
            if (isRejected) {
                html += '<div class="error">';
                html += '<strong>❌ REJECTED</strong><br>';
                html += 'Reason: ' + (score.metadata.rejectionReason || 'Unknown');
                html += '</div>';
            } else {
                html += '<div class="score-value">' + scoreValue + '</div>';
                html += '<p><strong>Final Score:</strong> ' + (score.finalScore || 0).toFixed(4) + '</p>';
                html += '<p><strong>Status:</strong> ' + (isGood ? '✅ GOOD (≥ 499)' : '⚠️ BELOW THRESHOLD (< 499)') + '</p>';
            }
            html += '<p><strong>Provider:</strong> ' + (score.metadata ? score.metadata.provider : 'N/A') + '</p>';
            html += '<p><strong>From Cache:</strong> ' + (score.metadata && score.metadata.fromCache ? 'Yes 🚀' : 'No') + '</p>';
            html += '</div>';

            // Score Analysis Section - Variables Importantes
            html += generateScoreAnalysis(score);
        }

        // Steps
        html += '<h2>📋 Execution Steps</h2>';
        for (let i = 0; i < results.steps.length; i++) {
            let step = results.steps[i];
            html += '<div class="step ' + (step.success ? 'success' : 'failed') + '">';
            html += '<h3>' + (step.success ? '✅' : '❌') + ' ' + step.name + '</h3>';
            html += '<p><strong>⏱️ Time:</strong> ' + step.elapsedMs + 'ms</p>';

            if (step.error) {
                html += '<div class="error"><strong>Error:</strong> ' + escapeHtml(step.error) + '</div>';
            }

            if (step.result && step.success) {
                html += '<div class="detail">';
                html += '<strong>Result:</strong><br>';
                html += '<div class="json-viewer">' + escapeHtml(JSON.stringify(step.result, null, 2)) + '</div>';
                html += '</div>';
            }

            html += '</div>';
        }

        // Error global (si existe)
        if (results.error) {
            html += '<div class="error">';
            html += '<h2>❌ Error Details</h2>';
            html += '<p><strong>Message:</strong> ' + escapeHtml(results.error.message) + '</p>';
            html += '<p><strong>Name:</strong> ' + escapeHtml(results.error.name) + '</p>';
            html += '<pre>' + escapeHtml(results.error.stack) + '</pre>';
            html += '</div>';
        }

        // Raw Result (full JSON)
        if (results.scoreResult) {
            html += '<div class="summary">';
            html += '<h2>📄 Full Score Result (JSON)</h2>';
            html += '<div class="json-viewer">' + escapeHtml(JSON.stringify(results.scoreResult, null, 2)) + '</div>';
            html += '</div>';
        }

        // Recommendations
        html += '<div class="summary">';
        html += '<h2>💡 Performance Analysis</h2>';
        html += '<ul>';
        
        var totalTime = results.totalTime;
        if (totalTime < 100) {
            html += '<li>✅ <strong>Excellent:</strong> Total time ' + totalTime + 'ms < 100ms (cache hit or very fast)</li>';
        } else if (totalTime < 500) {
            html += '<li>✅ <strong>Good:</strong> Total time ' + totalTime + 'ms < 500ms</li>';
        } else if (totalTime < 2000) {
            html += '<li>⚠️ <strong>Acceptable:</strong> Total time ' + totalTime + 'ms < 2s (includes provider call)</li>';
        } else {
            html += '<li>❌ <strong>Slow:</strong> Total time ' + totalTime + 'ms > 2s - Review performance</li>';
        }

        if (results.scoreResult && results.scoreResult.metadata) {
            if (results.scoreResult.metadata.fromCache) {
                html += '<li>🚀 <strong>Cache Hit:</strong> Result served from cache (very fast)</li>';
            } else {
                html += '<li>📡 <strong>Fresh Data:</strong> Result fetched from provider (slower but fresh)</li>';
            }
        }

        html += '<li>📊 Check Execution Log for detailed timing of each operation</li>';
        html += '<li>🔄 Run again with <code>?forceRefresh=true</code> to bypass cache</li>';
        html += '<li>🧪 Try different documentos to test various scenarios</li>';
        html += '</ul>';
        html += '</div>';

        return html;
    }

    /**
     * Escapa HTML para seguridad
     */
    function escapeHtml(text) {
        if (!text) return '';
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    return {
        onRequest: onRequest
    };
});
