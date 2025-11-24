/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/runtime', 'N/task'],
  function (record, search, runtime, task) {

      function getInputData() {
          const logTitle = 'Get Input Data';

          try {
              log.debug(logTitle, '**** START *****');
              const searchId = runtime.getCurrentScript().getParameter('custscript_mocasist_delete');
              return search.load({ id: searchId });
          } catch (e) {
              log.error(logTitle, e.message);
          }
      }

      function map(context) {
          const logTitle = 'Map';
          try {
              log.debug(logTitle, 'MAP context: ' + JSON.stringify(context));
              const mapResult = JSON.parse(context.value);
              const stRecordId = mapResult.id;
              const stRecordType = mapResult.recordType;
              context.write(stRecordId, stRecordType);
          } catch (e) {
              log.error(logTitle, e.message);
          }
      }

      function reduce(context) {
          const logTitle = 'Reduce';
          log.debug(logTitle, 'REDUCE context: ' + JSON.stringify(context));
          const stRecordId = context.key;
          const stRecordType = context.values[0];
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
          const logTitle = 'Summarize';
          log.audit(logTitle, 'Usage Consumed ' + summary.usage + ' Number of Queues ' + summary.concurrency + ' Number of Yields ' + summary.yields);

            const scriptTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: '',
                deploymentId: ''
            });
            const taskId = scriptTask.submit();
            log.audit(logTitle, 'Mocasist Creation submitted new Map/Reduce task with ID: ' + taskId);

   
      }

      return {
          getInputData: getInputData,
          map: map,
          reduce: reduce,
          summarize: summarize
      };
  });
