/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/runtime'],
  function (record, search, runtime) {

      function getInputData() {
          var logTitle = 'Get Input Data';

          try {
              log.debug(logTitle, '**** START *****');
              var searchId = runtime.getCurrentScript().getParameter('custscript_lista_negra_delete');
              return search.load({ id: searchId });
          } catch (e) {
              log.error(logTitle, e.message);
          }
      }

      function map(context) {
          var logTitle = 'Map';

          try {
              log.debug(logTitle, 'MAP context: ' + JSON.stringify(context));
              var mapResult = JSON.parse(context.value);
              var stRecordId = mapResult.id;
              var stRecordType = mapResult.recordType;
              context.write(stRecordId, stRecordType);
          } catch (e) {
              log.error(logTitle, e.message);
          }
      }

      function reduce(context) {
          var logTitle = 'Reduce';

          log.debug(logTitle, 'REDUCE context: ' + JSON.stringify(context));
          var stRecordId = context.key;
          var stRecordType = context.values[0];
          try {
              record.delete({
                  type: stRecordType,
                  id: stRecordId,
              });
              log.debug(logTitle, 'Record deleted: ' + stRecordType + ' - ' + stRecordId);
          } catch (e) {
              log.error(logTitle, e.message);
          }
      }

      function summarize(summary) {
          var logTitle = 'Summarize';
          log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);
      }

      return {
          getInputData: getInputData,
          map: map,
          reduce: reduce,
          summarize: summarize
      };
  });
