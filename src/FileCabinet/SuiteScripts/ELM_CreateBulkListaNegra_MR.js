/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/runtime', 'N/file', 'N/error'],
  function (record, search, runtime, file, error) {
        
    /**
     * @author  Gerardo Gonzalez
     * @desc getInputData - This function loads the CSV file containing Lista Negra data.
     * @param {object} scriptContext 
     */
      function getInputData() {
          const logTitle = 'Get Input Data';

          try {
              log.debug(logTitle, '**** START *****');
              // Retrieve the file ID from script parameter or use a default/hardcoded one
              const fileId = runtime.getCurrentScript().getParameter({ name: 'customscript_elm_crea_lista_negra' });
              // var csvFile = file.load({ id: '../Mocasist - Documento/Mocasist.csv' });

              
              if (!fileId) {
                  throw new Error('File ID is missing');
              }

              const csvFile = file.load({
                  id: fileId
              });
              
              log.debug('csvFile', 'Loaded file: ' + csvFile.name);
              
              // Iterate over the lines of the file
              return csvFile.lines.iterator();
          } catch (e) {
              log.error(logTitle, e.message);
              throw error.create({
                  name: 'GET_INPUT_DATA_ERROR_MOCASIST',
                  message: 'Error in getInputData: ' + e.message
              });
          }
      }


        /**
     * @author  Gerardo Gonzalez
     * @desc map - This function processes each line of the CSV file containing Lista Negra data.
     * @param {object} scriptContext 
     */
      function map(context) {
          const logTitle = 'Map';

          try {
              const line = context.value;
              if (!line) return;

              // Assuming CSV format: Documento,Nombre
              // Adjust the separator if needed (e.g., ';')
              const columns = line.split(','); 
              
              // Basic validation to skip empty lines or headers
              // You might want to add a check for headers here, e.g.:
              // if (columns[0] === 'Documento') return;
              if (columns.length < 2) return;

              const docNumber = columns[0].trim();
              const name = columns[1].trim();

              if (!docNumber) return;

              log.debug(logTitle, 'Processing Doc: ' + docNumber + ', Name: ' + name);

              // Check if record already exists
              const existingSearch = search.create({
                  type: 'customrecord_sdb_lista_negra',
                  filters: [
                      ['custrecord_sdb_nrodoc', 'equalto', docNumber]
                  ]
              });

              const searchResults = existingSearch.run().getRange({ start: 0, end: 1 });

              if (searchResults && searchResults.length > 0) {
                  log.debug(logTitle, 'Record already exists for document: ' + docNumber);
                  return;
              }

              // Create new MOCASIST record
              const newRecord = record.create({
                  type: 'customrecord_sdb_lista_negra'
              });

              newRecord.setValue({
                  fieldId: 'custrecord_sdb_nrodoc',
                  value: docNumber
              });

              newRecord.setValue({
                  fieldId: 'custrecord_sdb_nombre',
                  value: name
              });

              const recordId = newRecord.save();
              log.audit(logTitle, 'Created MOCASIST record ID: ' + recordId + ' for document: ' + docNumber);

          } catch (e) {
                log.error(logTitle, 'Error processing line: ' + context.value + ' - ' + e.message);
                throw error.create({
                    name: 'MAP_ERROR_MOCASIST',
                    message: 'Error in map function: ' + e.message
                });
            }
      }

    /**
     * @author  Gerardo Gonzalez
     * @desc summarize - This function summarizes the results of the Map/Reduce script.
     * @param {object} summary 
     */
      function summarize(summary) {
        const logTitle = 'Summarize';
       try {
             const fileIdFindIT = runtime.getCurrentScript().getParameter({ name: 'customscript_elm_crea_lista_negra' });
            /*  const fileSearch = search.create({
                type: search.Type.FOLDER,
                filters: [
                    ['internalid', 'is', fileIdFindIT]
                ],
                columns: [
                    search.createColumn({
                    name: "internalid",
                    join: "file"
                    })
                ]
            });
                
            let fileId = null;
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
              */
          
          log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
         } catch (e) {
            log.error(logTitle, 'Error in summarize: ' + e.message);
            throw error.create({
                name: 'SUMMARIZE_ERROR_LISTA_NEGRA',
                message: 'Error in summarize function: ' + e.message
            }); 
         }
     
        }

      return {
          getInputData: getInputData,
          map: map,
          summarize: summarize
      };
  });
