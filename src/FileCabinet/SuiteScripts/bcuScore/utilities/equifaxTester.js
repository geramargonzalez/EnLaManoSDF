/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @description Utility para testear y switchear entre Sandbox/Producción de Equifax
 */

define(['N/ui/serverWidget', 'N/runtime', '../adapters/equifaxAdapter'], 
function (serverWidget, runtime, equifaxAdapter) {
    'use strict';

    function onRequest(context) {
        if (context.request.method === 'GET') {
            showTestForm(context);
        } else {
            processTest(context);
        }
    }

    function showTestForm(context) {
        const form = serverWidget.createForm({
            title: 'Equifax Environment Tester'
        });

        // Obtener configuración actual
        const script = runtime.getCurrentScript();
        const currentEnv = script.getParameter({ name: 'custscript_equifax_environment' }) || 'SANDBOX';
        const isSandbox = currentEnv.toUpperCase() === 'SANDBOX';

        // Field group: Configuración Actual
        const configGroup = form.addFieldGroup({
            id: 'custpage_config_group',
            label: 'Configuración Actual'
        });

        const envField = form.addField({
            id: 'custpage_current_env',
            type: serverWidget.FieldType.TEXT,
            label: 'Ambiente Activo',
            container: 'custpage_config_group'
        });
        envField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        envField.defaultValue = currentEnv + (isSandbox ? ' (Testing)' : ' (LIVE)');

        const urlField = form.addField({
            id: 'custpage_current_url',
            type: serverWidget.FieldType.TEXTAREA,
            label: 'API URL',
            container: 'custpage_config_group'
        });
        urlField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
        urlField.defaultValue = isSandbox 
            ? 'https://api.sandbox.equifax.com/business/interconnect/v1/decision-orchestrations/execute'
            : 'https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations/execute';

        // Field group: Test
        const testGroup = form.addFieldGroup({
            id: 'custpage_test_group',
            label: 'Probar Conexión'
        });

        const docField = form.addField({
            id: 'custpage_documento',
            type: serverWidget.FieldType.TEXT,
            label: 'Documento a Consultar',
            container: 'custpage_test_group'
        });
        docField.isMandatory = true;
        docField.defaultValue = '12345678';

        const actionField = form.addField({
            id: 'custpage_action',
            type: serverWidget.FieldType.SELECT,
            label: 'Acción',
            container: 'custpage_test_group'
        });
        actionField.addSelectOption({ value: 'test', text: 'Probar Consulta' });
        actionField.addSelectOption({ value: 'invalidate', text: 'Invalidar Caché de Token' });
        actionField.defaultValue = 'test';

        // Resultado (si existe)
        if (context.request.parameters.custpage_result) {
            const resultGroup = form.addFieldGroup({
                id: 'custpage_result_group',
                label: 'Resultado'
            });

            const resultField = form.addField({
                id: 'custpage_result',
                type: serverWidget.FieldType.TEXTAREA,
                label: 'Respuesta',
                container: 'custpage_result_group'
            });
            resultField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.INLINE });
            resultField.defaultValue = context.request.parameters.custpage_result;
        }

        form.addSubmitButton({ label: 'Ejecutar' });

        context.response.writePage(form);
    }

    function processTest(context) {
        const documento = context.request.parameters.custpage_documento;
        const action = context.request.parameters.custpage_action;

        let result = '';

        try {
            if (action === 'invalidate') {
                // Invalidar caché
                equifaxAdapter.invalidateTokenCache();
                result = '✅ Caché de token invalidado exitosamente.\n\n';
                result += 'El próximo request obtendrá un nuevo token.\n';
                result += 'Esto es útil después de cambiar entre SANDBOX y PRODUCTION.';
            } else {
                // Probar consulta
                const startTime = Date.now();
                const response = equifaxAdapter.fetch(documento, { debug: true });
                const elapsed = Date.now() - startTime;

                result = '✅ Consulta exitosa\n\n';
                result += '⏱️ Tiempo: ' + elapsed + 'ms\n\n';
                result += '📊 Respuesta:\n';
                result += JSON.stringify(response, null, 2);
            }
        } catch (error) {
            result = '❌ Error\n\n';
            result += 'Código: ' + (error.code || 'UNKNOWN') + '\n';
            result += 'Mensaje: ' + error.message + '\n\n';
            if (error.details) {
                result += 'Detalles:\n' + JSON.stringify(error.details, null, 2);
            }
        }

        // Redirect de vuelta con resultado
        context.response.sendRedirect({
            type: 'SUITELET',
            identifier: runtime.getCurrentScript().id,
            id: runtime.getCurrentScript().deploymentId,
            parameters: {
                custpage_result: result
            }
        });
    }

    return {
        onRequest: onRequest
    };
});
