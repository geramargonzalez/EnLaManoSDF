/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/task', 'N/ui/serverWidget', 'N/redirect'], function(task, serverWidget, redirect) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({
                title: 'Borrado Mocasist'
            });
            form.addSubmitButton({
                label: 'Borrar Mocasist'
            });
            context.response.writePage(form);
        } else {
            var scriptTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_elm_borrado_mocasist',
                deploymentId: 'customdeploy_elm_borrado_mocasist'
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
