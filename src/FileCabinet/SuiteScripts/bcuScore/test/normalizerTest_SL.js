/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description Test rápido del normalizer con samples
 */

define([
    'N/log',
    '../samples/equifaxSamples',
    '../domain/normalize'
], function(log, equifaxSamples, normalize) {
    'use strict';

    function onRequest(context) {
        const tests = [
            {
                name: 'BOX_FASE0_PER - Normal (1C)',
                sample: equifaxSamples.EQUIFAX_BOX_FASE0_RESPONSE
            },
            {
                name: 'BOX_FASE0_PER - Fallecido',
                sample: equifaxSamples.EQUIFAX_BOX_DECEASED_RESPONSE
            },
            {
                name: 'BOX_FASE0_PER - Mala Calificación (5)',
                sample: equifaxSamples.EQUIFAX_BOX_BAD_RATING_RESPONSE
            },
            {
                name: 'Legacy - Normal',
                sample: equifaxSamples.EQUIFAX_SAMPLE_RESPONSE
            }
        ];
        
        const results = [];
        
        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            try {
                const normalized = normalize.normalizeEquifaxResponse(test.sample);
                
                results.push({
                    test: test.name,
                    success: true,
                    summary: {
                        provider: normalized.provider,
                        documento: normalized.documento,
                        isDeceased: normalized.flags.isDeceased,
                        hasRejectableRating: normalized.flags.hasRejectableRating,
                        worstRating: normalized.metadata.worstRating,
                        nombre: normalized.metadata.nombre,
                        entitiesCount: normalized.periodData.t0.entities.length,
                        vigenteTotal: normalized.periodData.t0.aggregates.vigente.total,
                        vencidoTotal: normalized.periodData.t0.aggregates.vencido.total,
                        castigadoTotal: normalized.periodData.t0.aggregates.castigado.total
                    },
                    normalized: normalized
                });
                
                log.audit('Test OK', test.name);
            } catch (error) {
                results.push({
                    test: test.name,
                    success: false,
                    error: error.toString(),
                    stack: error.stack
                });
                
                log.error('Test FAILED', test.name + ': ' + error.toString());
            }
        }
        
        // Generar reporte HTML
        const html = generateReport(results);
        
        context.response.write(html);
    }
    
    function generateReport(results) {
        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Equifax Normalizer Test Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 30px auto;
            padding: 20px;
            background: #f0f2f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            flex: 1;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 36px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        .test-result {
            background: white;
            padding: 25px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-result.success {
            border-left: 5px solid #4caf50;
        }
        .test-result.failed {
            border-left: 5px solid #f44336;
        }
        .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .test-name {
            font-size: 18px;
            font-weight: 600;
            color: #333;
        }
        .badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge.success {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .badge.failed {
            background: #ffebee;
            color: #c62828;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-top: 15px;
        }
        .summary-item {
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            font-size: 13px;
        }
        .summary-label {
            font-weight: 600;
            color: #666;
        }
        .summary-value {
            color: #333;
            margin-top: 3px;
        }
        .error-box {
            background: #ffebee;
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
            color: #c62828;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
        }
        details {
            margin-top: 15px;
        }
        summary {
            cursor: pointer;
            font-weight: 600;
            color: #667eea;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 4px;
        }
        summary:hover {
            background: #e8eaf6;
        }
        pre {
            background: #263238;
            color: #aed581;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Equifax Normalizer Test Report</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Validación de normalización de respuestas Equifax</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${results.length}</div>
            <div class="stat-label">Total Tests</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #4caf50;">${results.filter(r => r.success).length}</div>
            <div class="stat-label">Passed</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #f44336;">${results.filter(r => !r.success).length}</div>
            <div class="stat-label">Failed</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Math.round((results.filter(r => r.success).length / results.length) * 100)}%</div>
            <div class="stat-label">Success Rate</div>
        </div>
    </div>
`;
        
        results.forEach(function(result) {
            const statusClass = result.success ? 'success' : 'failed';
            const statusBadge = result.success ? '✅ PASSED' : '❌ FAILED';
            
            html += `
    <div class="test-result ${statusClass}">
        <div class="test-header">
            <div class="test-name">${escapeHtml(result.test)}</div>
            <div class="badge ${statusClass}">${statusBadge}</div>
        </div>
`;
            
            if (result.success && result.summary) {
                html += `
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-label">Provider</div>
                <div class="summary-value">${escapeHtml(result.summary.provider)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Documento</div>
                <div class="summary-value">${escapeHtml(result.summary.documento)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Nombre</div>
                <div class="summary-value">${escapeHtml(result.summary.nombre)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Rating</div>
                <div class="summary-value">${escapeHtml(result.summary.worstRating)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Entidades</div>
                <div class="summary-value">${result.summary.entitiesCount}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">¿Fallecido?</div>
                <div class="summary-value">${result.summary.isDeceased ? '⚰️ SÍ' : '✅ NO'}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Vigente</div>
                <div class="summary-value">$${formatNumber(result.summary.vigenteTotal)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Vencido</div>
                <div class="summary-value">$${formatNumber(result.summary.vencidoTotal)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Castigado</div>
                <div class="summary-value">$${formatNumber(result.summary.castigadoTotal)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">¿Rechazable?</div>
                <div class="summary-value">${result.summary.hasRejectableRating ? '❌ SÍ' : '✅ NO'}</div>
            </div>
        </div>
        
        <details>
            <summary>📋 Ver datos normalizados completos</summary>
            <pre>${escapeHtml(JSON.stringify(result.normalized, null, 2))}</pre>
        </details>
`;
            } else if (!result.success) {
                html += `
        <div class="error-box">
${escapeHtml(result.error)}

${result.stack ? escapeHtml(result.stack) : ''}
        </div>
`;
            }
            
            html += `
    </div>
`;
        });
        
        html += `
</body>
</html>
        `;
        
        return html;
    }
    
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('es-UY');
    }

    return {
        onRequest: onRequest
    };
});
