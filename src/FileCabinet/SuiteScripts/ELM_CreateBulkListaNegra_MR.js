/**
 * @NApiVersion 2.1
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
              // Load the CSV file directly from File Cabinet path
              const csvFile = file.load({ 
                  id: '../Documento - Lista Negra/lista_negra.csv' 
              });

              if (!csvFile) {
                  throw new Error('CSV File could not be loaded');
              }
              
              log.debug('csvFile', 'Loaded file: ' + csvFile.name);
              
              // Iterate over the lines of the file
            const lines = [];
            csvFile.lines.iterator().each(function (line) {
                lines.push(line.value);
                return true;
            });

            return lines;
          } catch (e) {
              log.error(logTitle, e.message);
              throw error.create({
                  name: 'GET_INPUT_DATA_ERROR_LISTA_NEGRA',
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
              const columns = line.split(';'); 
                    // Skip header row and empty lines
              if (columns.length < 2) return;
        
              if (columns[0].toLowerCase().trim() === 'documento') {
                  log.debug(logTitle, 'Skipping header row');
                  return;
              }
              const country = columns[0].trim();
              const type = columns[1].trim();
              const docNumber = columns[2].trim();
              const name = columns[3].trim();

              log.debug(logTitle, 'Parsed line - Documento: ' + docNumber + ', Nombre: ' + name);

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

              // Create new Lista Negra record
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

              newRecord.setValue({
                  fieldId: 'custrecord_sdb_pais',
                  value: country
              });

              newRecord.setValue({
                  fieldId: 'custrecord_sdb_tipo',
                  value: type
              });

              const recordId = newRecord.save();
              log.audit(logTitle, 'Created Lista Negra record ID: ' + recordId + ' for document: ' + docNumber);

          } catch (e) {
                log.error(logTitle, 'Error processing line: ' + context.value + ' - ' + e.message);
                throw error.create({
                    name: 'MAP_ERROR_LISTA_NEGRA',
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
            const fileIdFindIT = runtime.getCurrentScript().getParameter({ name: 'custscript_elm_folder_lista_negra' });

             const fileSearch = search.create({
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
