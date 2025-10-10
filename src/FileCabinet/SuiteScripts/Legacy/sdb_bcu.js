/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
 define(['N/log', 'N/search', 'N/runtime', 'N/record',"./SDB-Enlamano-score.js"], function (log, search, runtime, record, scorelib) {

    function onAction(scriptContext) {

        var newRecord = scriptContext.newRecord;
        var dni = newRecord.getText("custentity_sdb_nrdocumento");
        log.debug(newRecord)
        log.debug(dni)
        var score = scorelib.scoreFinal(dni);
        log.debug(newRecord)
        log.debug(dni)
        log.debug('score', score)
        newRecord.setValue({
            fieldId: 'custentity_score',
            value: score.score
        });
        newRecord.setValue({
            fieldId: 'custentity_sdb_entidades',
            value: score.contador
        });

        newRecord.setValue({
            fieldId: 'custentity_calificacion',
            value: score.calificacionMinima
        });

    }
    return {
        onAction: onAction
    }
});