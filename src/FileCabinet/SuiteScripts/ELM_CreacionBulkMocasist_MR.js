/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/file', 'N/search'],
    function (record, file, search) {

        function getInputData() {
            var logTitle = 'Get Input Data';
            try {
                log.debug(logTitle, '**** START *****');
                var csvFile = file.load({ id: '../Mocasist - Documento/Mocasist.csv' });
                var lines = [];
                csvFile.lines.iterator().each(function (line) {
                    lines.push(line.value);
                    return true;
                });

                return lines;
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        function map(context) {
            var logTitle = 'Map';
            try {
                log.debug(logTitle, 'MAP context: ' + JSON.stringify(context));
                var line = context.value;
                var fields = line.split(';');

                var customRecord = record.create({
                    type: 'customrecord_elm_mocasist',
                    isDynamic: true
                });

                customRecord.setValue({
                    fieldId: 'custrecord_elm_mocasist_doc',
                    value: fields[0]
                });

                customRecord.setValue({
                    fieldId: 'custrecord_elm_mocasist_name',
                    value: fields[1]
                });

                try {
                    customRecord.save();
                } catch (e) {
                    log.error('Error al guardar', e.message);
                }
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        function summarize(summary) {
            var logTitle = 'Summarize';
            try {
                var fileSearch = search.create({
                    type: search.Type.FOLDER,
                    filters: [
                        ['internalid', 'is', 17]
                    ],
                    columns: [
                        search.createColumn({
                        name: "internalid",
                        join: "file"
                     })
                    ]
                });
                
                var fileId = null;
                fileSearch.run().each(function(result) {
                    fileId = result.getValue({
                        name: 'internalid',
                        join: 'file'
                    });
                    log.debug('fileId', fileId);
                    return false;
                });
                
                if (fileId) {
                    file.delete({
                        id: fileId
                    });
                    log.debug('Success', 'File deleted successfully. File ID: ' + fileId);
                }
                log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
            } catch (e) {
                log.error(logTitle, e.message);
            }
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
