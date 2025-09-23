/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/task', 'N/ui/serverWidget', 'N/redirect'], function(task, serverWidget, redirect) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({
                title: 'Crear Mocasist'
            });
            form.addSubmitButton({
                label: 'Crear Mocasist'
            });
            context.response.writePage(form);
        } else {
            var scriptTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_elm_bulk_mocasist_mr',
                deploymentId: 'customdeploy_elm_bulk_mocasist_mr'
            });

            var taskId = scriptTask.submit();

            redirect.toSavedSearchResult({
                id: 116
            });
        }
    }

    return {
        onRequest: onRequest
    };
});
