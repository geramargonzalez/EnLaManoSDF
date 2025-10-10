/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(["N/record", "N/runtime", 'N/search', 'N/error'], function (record, runtime, search, error) {


    function saveRecord(context) {
        try {

            var newRecord = context.currentRecord;
            var revicion = newRecord.getValue('custentity_sdb_revision');
            var doc = newRecord.getValue('custentity_sdb_nrdocumento');

            log.debug('newRecord', JSON.stringify(newRecord));
            log.debug('revicion', revicion);
            log.debug('doc', doc);
            if (revicion == true) {
                log.debug('test', "test");
                var customrecord_sdb_lista_negraSearchObj = search.create({
                    type: "customrecord_sdb_lista_negra",
                    filters:
                        [
                            ["name", "is", doc]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "name",
                                sort: search.Sort.ASC,
                                label: "Nombre"
                            }),
                            search.createColumn({ name: "id", label: "ID" }),
                            search.createColumn({ name: "scriptid", label: "ID de script" })
                        ]
                });
                var listaNegra = customrecord_sdb_lista_negraSearchObj.runPaged().count;
                log.debug("customrecord_sdb_lista_negraSearchObj result count", listaNegra);
                if (listaNegra == 1)
                alert("No apto para prestasmo")
                    throw error.create({
                        name: 'MISSING_REQ_ARG',
                        message: 'No apto para prestasmo'
                    });
              
                return false;
                
            }
            return true;
        } catch (error) {
            log.debug('error', JSON.stringify(error));
        }
    }

    return {
        saveRecord: saveRecord
    }
});
