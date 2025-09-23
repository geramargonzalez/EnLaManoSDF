/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/task', 'N/ui/serverWidget', 'N/redirect'], function(task, serverWidget, redirect) {
    function onRequest(context) {
        if (context.request.method === 'GET') {
            var form = serverWidget.createForm({
                title: 'Borrado Lista Negra'
            });
            form.addSubmitButton({
                label: 'Borrar Lista Negra'
            });
            context.response.writePage(form);
        } else {
            var scriptTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_elm_borrado_list_negra',
                deploymentId: 'customdeploy_elm_borrado_list_negra'
            });

            var taskId = scriptTask.submit();

            redirect.toSavedSearchResult({
                id: 115
            });
        }
    }

    return {
        onRequest: onRequest
    };
});
