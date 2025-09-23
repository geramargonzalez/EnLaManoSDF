/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define([ 'N/runtime', 'N/search', 'N/error', 'N/record',"./ELM_Aux_Lib.js"],
   ( runtime, search, error, record,auxLib) => {


     /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function saved the record deletion information in a custom record when a record is deleted.
     * @param {object} scriptContext 
     */
      const afterSubmit = (scriptContext) => {
         try {
            const {newRecord} = scriptContext;
            if (scriptContext.type !== scriptContext.UserEventType.DELETE) return;
            const typeRecord = newRecord.type;
            if (typeRecord == 'customrecord_sdb_lista_negra' || typeRecord == 'customrecord_elm_mocasist' || typeRecord == 'customrecord_elm_record_cambios') return;
            const idDeletions = newRecord.id;
            const user = runtime.getCurrentUser().id;
            log.debug('afterSubmit', 'Record deleted: ' + idDeletions + ' - Type: ' + typeRecord + ' - User: ' + user);
            let notas = 'Se elimino el record ' + typeRecord + ' con ID: ' + idDeletions;
            if(typeRecord == 'lead'){

               const obj = {
                  docNumber: newRecord.getValue({fieldId: 'custentity_sdb_nrdocumento'}),
                  mobilePhone: newRecord.getValue({fieldId: 'phone'}),
                  email: newRecord.getValue({fieldId: 'email'}),
                  activityType: newRecord.getValue({fieldId: 'custentity_sdb_actividad'}),
                  ingreso: newRecord.getValue({fieldId: 'custentity_sdb_infolab_importe'}),
                  fechaNacimiento: newRecord.getValue({fieldId: 'custentity_sdb_fechanac'}),
                  id: idDeletions
               };

               notas = ' Lead: ' + JSON.stringify(obj);
            }

            const obj = {
               tipo: 1,
               usuario: user,
               record: typeRecord,
               notas:  notas, 
            };
            auxLib.createRecordAuditCambios(obj);

         } catch (e) {
            log.error('afterSubmit', e);
         }
      };
  

      return {
        afterSubmit
    };
   });
