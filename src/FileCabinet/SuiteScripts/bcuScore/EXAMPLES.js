/**
 * EJEMPLOS DE USO - Equifax Environment Switcher
 * @NApiVersion 2.1
 */

// ============================================================================
// EJEMPLO 1: Uso básico (el adapter detecta automáticamente el ambiente)
// ============================================================================

define(['../adapters/equifaxAdapter'], function(equifaxAdapter) {
    
    function consultarClienteSandbox() {
        // No necesitás hacer nada especial, el adapter usa el ambiente configurado
        try {
            const resultado = equifaxAdapter.fetch('12345678');
            
            log.audit({
                title: 'Consulta Equifax Exitosa',
                details: JSON.stringify({
                    documento: '12345678',
                    score: resultado.score,
                    riesgo: resultado.riesgo
                })
            });
            
            return resultado;
            
        } catch (error) {
            log.error({
                title: 'Error en Consulta Equifax',
                details: error.message
            });
            throw error;
        }
    }
    
    return { consultarClienteSandbox };
});

// ============================================================================
// EJEMPLO 2: Validar ambiente antes de ejecutar lógica crítica
// ============================================================================

define(['N/runtime', '../adapters/equifaxAdapter'], function(runtime, equifaxAdapter) {
    
    function procesarSolicitudCredito(solicitudId, documento) {
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        // Validación: No permitir solicitudes reales en Sandbox
        if (environment === 'SANDBOX') {
            log.audit({
                title: 'Test Mode Activo',
                details: 'Usando Equifax SANDBOX - Esta no es una consulta real'
            });
        }
        
        // La consulta funciona igual independientemente del ambiente
        const resultado = equifaxAdapter.fetch(documento);
        
        // Agregar flag de test si estamos en sandbox
        resultado.isTestMode = (environment === 'SANDBOX');
        
        return resultado;
    }
    
    return { procesarSolicitudCredito };
});

// ============================================================================
// EJEMPLO 3: Manejo de caché al cambiar ambientes (Scheduled Script)
// ============================================================================

/**
 * @NScriptType ScheduledScript
 */
define(['N/runtime', 'N/log', '../adapters/equifaxAdapter'], 
function(runtime, log, equifaxAdapter) {
    
    function execute(context) {
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        log.audit({
            title: 'Proceso Iniciado',
            details: 'Ambiente: ' + environment
        });
        
        // Si detectás que el ambiente cambió (guardando el último usado)
        const lastEnvironment = script.getParameter({ name: 'custscript_last_environment' });
        
        if (lastEnvironment && lastEnvironment !== environment) {
            log.audit({
                title: 'Cambio de Ambiente Detectado',
                details: 'De ' + lastEnvironment + ' a ' + environment
            });
            
            // Invalidar caché de token
            equifaxAdapter.invalidateTokenCache();
            
            log.audit({
                title: 'Caché Invalidado',
                details: 'Token caché cleared for environment switch'
            });
        }
        
        // Tu lógica de procesamiento aquí
        // ...
    }
    
    return { execute };
});

// ============================================================================
// EJEMPLO 4: RESTlet para consultas externas con validación de ambiente
// ============================================================================

/**
 * @NScriptType Restlet
 */
define(['N/runtime', '../adapters/equifaxAdapter'], function(runtime, equifaxAdapter) {
    
    function post(requestBody) {
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        // Validar request
        if (!requestBody.documento) {
            return {
                success: false,
                error: 'Documento requerido'
            };
        }
        
        try {
            // Consultar Equifax (usa ambiente configurado automáticamente)
            const resultado = equifaxAdapter.fetch(requestBody.documento, {
                debug: true
            });
            
            // Respuesta con metadata del ambiente
            return {
                success: true,
                data: resultado,
                metadata: {
                    environment: environment,
                    timestamp: new Date().toISOString(),
                    testMode: environment === 'SANDBOX'
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                code: error.code,
                environment: environment
            };
        }
    }
    
    function get(requestParams) {
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        // Endpoint para verificar configuración
        return {
            service: 'Equifax Adapter',
            status: 'active',
            environment: environment,
            baseUrl: environment === 'SANDBOX' 
                ? 'https://api.sandbox.equifax.com' 
                : 'https://api.latam.equifax.com',
            version: '1.0'
        };
    }
    
    return {
        post: post,
        get: get
    };
});

// ============================================================================
// EJEMPLO 5: User Event Script con logging detallado
// ============================================================================

/**
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', '../adapters/equifaxAdapter'], 
function(record, runtime, equifaxAdapter) {
    
    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE) {
            return;
        }
        
        const leadRecord = context.newRecord;
        const documento = leadRecord.getValue({ fieldId: 'custentity_sdb_nrdocumento' });
        
        if (!documento) {
            return;
        }
        
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        try {
            // Consulta Equifax
            const startTime = Date.now();
            const resultado = equifaxAdapter.fetch(documento);
            const elapsed = Date.now() - startTime;
            
            // Guardar resultado en el lead
            record.submitFields({
                type: leadRecord.type,
                id: leadRecord.id,
                values: {
                    custentity_equifax_score: resultado.score,
                    custentity_equifax_riesgo: resultado.riesgo,
                    custentity_equifax_environment: environment // Para trazabilidad
                }
            });
            
            log.audit({
                title: 'Equifax Consulta Exitosa',
                details: JSON.stringify({
                    leadId: leadRecord.id,
                    documento: documento.substr(-4), // Solo últimos 4 dígitos por seguridad
                    environment: environment,
                    responseTime: elapsed + 'ms',
                    score: resultado.score
                })
            });
            
        } catch (error) {
            log.error({
                title: 'Error Consulta Equifax',
                details: JSON.stringify({
                    leadId: leadRecord.id,
                    environment: environment,
                    error: error.message,
                    code: error.code
                })
            });
            
            // Marcar el lead con error para revisión manual
            record.submitFields({
                type: leadRecord.type,
                id: leadRecord.id,
                values: {
                    custentity_equifax_error: error.message,
                    custentity_equifax_environment: environment
                }
            });
        }
    }
    
    return { afterSubmit };
});

// ============================================================================
// EJEMPLO 6: Map/Reduce para procesamiento masivo
// ============================================================================

/**
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/runtime', 'N/record', '../adapters/equifaxAdapter'], 
function(search, runtime, record, equifaxAdapter) {
    
    function getInputData() {
        // Buscar leads sin score de Equifax
        return search.create({
            type: search.Type.CUSTOMER,
            filters: [
                ['custentity_equifax_score', search.Operator.ISEMPTY, ''],
                'AND',
                ['custentity_sdb_nrdocumento', search.Operator.ISNOTEMPTY, '']
            ],
            columns: ['internalid', 'custentity_sdb_nrdocumento']
        });
    }
    
    function map(context) {
        const searchResult = JSON.parse(context.value);
        const leadId = searchResult.id;
        const documento = searchResult.values.custentity_sdb_nrdocumento;
        
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        try {
            // Consultar Equifax
            const resultado = equifaxAdapter.fetch(documento);
            
            // Actualizar lead
            record.submitFields({
                type: record.Type.CUSTOMER,
                id: leadId,
                values: {
                    custentity_equifax_score: resultado.score,
                    custentity_equifax_riesgo: resultado.riesgo,
                    custentity_equifax_environment: environment,
                    custentity_equifax_updated: new Date()
                }
            });
            
            context.write({
                key: leadId,
                value: {
                    success: true,
                    score: resultado.score,
                    environment: environment
                }
            });
            
        } catch (error) {
            log.error({
                title: 'Error en Map - Lead ' + leadId,
                details: error.message
            });
            
            context.write({
                key: leadId,
                value: {
                    success: false,
                    error: error.message,
                    environment: environment
                }
            });
        }
    }
    
    function summarize(context) {
        const script = runtime.getCurrentScript();
        const environment = script.getParameter({ name: 'custscript_equifax_environment' });
        
        let totalSuccess = 0;
        let totalErrors = 0;
        
        context.output.iterator().each(function(key, value) {
            const result = JSON.parse(value);
            if (result.success) {
                totalSuccess++;
            } else {
                totalErrors++;
            }
            return true;
        });
        
        log.audit({
            title: 'Proceso Masivo Finalizado',
            details: JSON.stringify({
                environment: environment,
                totalProcessed: totalSuccess + totalErrors,
                successful: totalSuccess,
                errors: totalErrors,
                successRate: ((totalSuccess / (totalSuccess + totalErrors)) * 100).toFixed(2) + '%'
            })
        });
    }
    
    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});

// ============================================================================
// EJEMPLO 7: Client Script con validación de ambiente (informativo)
// ============================================================================

/**
 * @NScriptType ClientScript
 * Nota: Client Scripts no pueden acceder directamente a Script Parameters,
 * pero pueden recibir el ambiente desde un Suitelet/RESTlet
 */
define(['N/ui/message'], function(message) {
    
    function pageInit(context) {
        // Este valor vendría de un campo oculto o mediante AJAX
        const environment = context.currentRecord.getValue({ 
            fieldId: 'custpage_equifax_environment' 
        });
        
        if (environment === 'SANDBOX') {
            // Mostrar banner de test mode
            message.create({
                title: '🧪 Modo de Prueba',
                message: 'Las consultas a Equifax están usando el ambiente SANDBOX (testing). Los datos no son reales.',
                type: message.Type.WARNING
            }).show({ duration: 10000 });
        }
    }
    
    return { pageInit };
});

// ============================================================================
// NOTAS IMPORTANTES
// ============================================================================

/**
 * PERFORMANCE TIPS:
 * 
 * 1. El token se cachea automáticamente por 55 minutos
 * 2. El primer request después de iniciar será más lento (obtiene token)
 * 3. Requests subsecuentes usan el token cacheado (muy rápidos)
 * 4. Timeout de 15 segundos para máxima velocidad
 * 
 * SEGURIDAD:
 * 
 * 1. NUNCA loguear tokens completos
 * 2. NUNCA hardcodear credenciales de producción
 * 3. Usar Script Parameters tipo Password para secrets
 * 4. Rotar credenciales cada 90 días
 * 
 * TESTING:
 * 
 * 1. Probar en SANDBOX primero siempre
 * 2. Usar el Equifax Tester Suitelet para validar
 * 3. Invalidar caché después de cambiar ambiente
 * 4. Monitorear logs en las primeras horas después de go-live
 */
