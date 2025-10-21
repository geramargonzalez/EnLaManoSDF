/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description Script de prueba para validar integración Equifax BOX_FASE0_PER
 */

define([
    'N/log',
    '../bcuScore/app/service',
    '../bcuScore/samples/equifaxSamples',
    '../bcuScore/domain/normalize'
], function(log, bcuService, equifaxSamples, normalize) {
    'use strict';

    function onRequest(context) {
        const method = context.request.method;
        
        if (method === 'GET') {
            // Mostrar formulario de prueba
            const html = buildTestForm();
            context.response.write(html);
        } else {
            // Procesar prueba
            const testType = context.request.parameters.testType;
            const documento = context.request.parameters.documento;
            
            let result;
            
            try {
                if (testType === 'sample') {
                    // Probar con sample data
                    result = testWithSample(context.request.parameters.sampleType);
                } else if (testType === 'live' && documento) {
                    // Probar con API real
                    result = testWithLiveAPI(documento);
                } else {
                    result = {
                        error: true,
                        message: 'Parámetros inválidos'
                    };
                }
            } catch (error) {
                result = {
                    error: true,
                    message: error.toString(),
                    stack: error.stack
                };
            }
            
            context.response.write({
                contentType: 'application/json',
                output: JSON.stringify(result, null, 2)
            });
        }
    }
    
    function testWithSample(sampleType) {
        log.audit('Test Equifax', 'Testing with sample: ' + sampleType);
        
        let sample;
        switch (sampleType) {
            case 'normal':
                sample = equifaxSamples.EQUIFAX_BOX_FASE0_RESPONSE;
                break;
            case 'deceased':
                sample = equifaxSamples.EQUIFAX_BOX_DECEASED_RESPONSE;
                break;
            case 'bad_rating':
                sample = equifaxSamples.EQUIFAX_BOX_BAD_RATING_RESPONSE;
                break;
            case 'legacy':
                sample = equifaxSamples.EQUIFAX_SAMPLE_RESPONSE;
                break;
            default:
                throw new Error('Sample type inválido: ' + sampleType);
        }
        
        // Normalizar
        const normalized = normalize.normalizeEquifaxResponse(sample);
        
        return {
            success: true,
            sampleType: sampleType,
            raw: sample,
            normalized: normalized,
            summary: {
                provider: normalized.provider,
                documento: normalized.documento,
                isDeceased: normalized.flags.isDeceased,
                hasRejectableRating: normalized.flags.hasRejectableRating,
                worstRating: normalized.metadata.worstRating,
                entitiesCount: normalized.periodData.t0.entities.length,
                totals: normalized.periodData.t0.aggregates
            }
        };
    }
    
    function testWithLiveAPI(documento) {
        log.audit('Test Equifax', 'Testing with live API: ' + documento);
        
        // Llamar al servicio real
        const scoreResult = bcuService.calculateScore(documento, {
            provider: 'equifax',
            debug: true
        });
        
        return {
            success: true,
            documento: documento,
            scoreResult: scoreResult,
            summary: {
                finalScore: scoreResult.finalScore,
                isRejected: scoreResult.metadata.isRejected,
                rejectionReason: scoreResult.metadata.rejectionReason,
                provider: scoreResult.metadata.provider,
                timings: scoreResult.metadata.timings
            }
        };
    }
    
    function buildTestForm() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Equifax BOX_FASE0_PER - Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
            margin-top: 30px;
        }
        .test-section {
            background: #f9f9f9;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
            border-left: 4px solid #4CAF50;
        }
        button {
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        button:hover {
            background: #45a049;
        }
        button.secondary {
            background: #2196F3;
        }
        button.secondary:hover {
            background: #0b7dda;
        }
        input[type="text"] {
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            width: 200px;
            margin-right: 10px;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 4px;
            max-height: 500px;
            overflow-y: auto;
        }
        .result pre {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .warning {
            background: #fff3cd;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #ffc107;
        }
        .info {
            background: #d1ecf1;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            border-left: 4px solid #17a2b8;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Equifax BOX_FASE0_PER - Test Suite</h1>
        
        <div class="info">
            <strong>ℹ️ Información:</strong> Esta página permite probar la integración con Equifax BOX_FASE0_PER.
            Puedes probar con datos de ejemplo (sample) o hacer consultas reales a la API.
        </div>
        
        <h2>📋 Test con Sample Data (sin llamar API)</h2>
        <div class="test-section">
            <p>Prueba el normalizer con datos de ejemplo predefinidos:</p>
            <button onclick="testSample('normal')">✅ Caso Normal (1C)</button>
            <button onclick="testSample('bad_rating')" class="secondary">❌ Mala Calificación (5)</button>
            <button onclick="testSample('deceased')" class="secondary">⚰️ Persona Fallecida</button>
            <button onclick="testSample('legacy')" class="secondary">📜 Formato Legacy</button>
        </div>
        
        <h2>🌐 Test con API Real (requiere configuración)</h2>
        <div class="test-section">
            <div class="warning">
                <strong>⚠️ Advertencia:</strong> Esto hará una llamada real a la API de Equifax.
                Asegúrate de tener configurados los parámetros del script.
            </div>
            <p>
                <input type="text" id="documento" placeholder="1111111-1" value="1111111-1">
                <button onclick="testLive()">🚀 Consultar API Real</button>
            </p>
            <p style="font-size: 12px; color: #666;">
                Documentos de prueba del manual: 1111111-1 (normal), 3796548-3 (fallecida)
            </p>
        </div>
        
        <div id="result"></div>
    </div>
    
    <script>
        function testSample(sampleType) {
            showLoading();
            const url = window.location.href + '?testType=sample&sampleType=' + sampleType;
            fetch(url, { method: 'POST' })
                .then(response => response.json())
                .then(data => showResult(data))
                .catch(error => showError(error));
        }
        
        function testLive() {
            const documento = document.getElementById('documento').value.trim();
            if (!documento) {
                alert('Ingrese un documento');
                return;
            }
            showLoading();
            const url = window.location.href + '?testType=live&documento=' + encodeURIComponent(documento);
            fetch(url, { method: 'POST' })
                .then(response => response.json())
                .then(data => showResult(data))
                .catch(error => showError(error));
        }
        
        function showLoading() {
            document.getElementById('result').innerHTML = '<div class="result">⏳ Procesando...</div>';
        }
        
        function showResult(data) {
            const resultDiv = document.getElementById('result');
            const json = JSON.stringify(data, null, 2);
            resultDiv.innerHTML = '<div class="result"><h3>📊 Resultado:</h3><pre>' + escapeHtml(json) + '</pre></div>';
        }
        
        function showError(error) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result" style="background:#ffebee;"><h3>❌ Error:</h3><pre>' + escapeHtml(error.toString()) + '</pre></div>';
        }
        
        function escapeHtml(text) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    </script>
</body>
</html>
        `;
    }

    return {
        onRequest: onRequest
    };
});
