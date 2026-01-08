/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */

define([ 'N/runtime', 'N/search', 'N/error', 'N/record',"./ELM_Aux_Lib.js" ],
   ( runtime, search, error, record,auxLib) => {

   
     /**
     * @author  Gerardo Gonzalez
     * @desc afterSubmit - This function creates a new etapa record when the estado de gestion of a solicitud changes.
     * @param {object} scriptContext 
     */
      const afterSubmit = (scriptContext) => {
        const {newRecord, oldRecord} = scriptContext;
        const user = runtime.getCurrentUser();
         try {
            
            if (scriptContext.type === scriptContext.UserEventType.DELETE) return

            const estadoGestion = newRecord.getValue({ fieldId: 'custrecord_elm_sol_est_gestion' });
            const estadoGestionOld = oldRecord.getValue({ fieldId: 'custrecord_elm_sol_est_gestion' });
            const solicitudId = newRecord.id;
            const operadorId = newRecord.getValue({ fieldId: 'custrecord_elm_sol_operador' });
            const motivoRechazado = newRecord.getValue({ fieldId: 'custrecord_elm_sol_motivo_rechazo' });

            if (estadoGestion !== estadoGestionOld && estadoGestion) {
                  const etapaId = auxLib.createEtapaSolicitud({
                    solicitudId: solicitudId,
                    estadoGestion: estadoGestion,
                    usuarioId: operadorId ? operadorId : user.id,
                    motivoRechazoId: motivoRechazado ? motivoRechazado : null
                    });
                    log.debug('afterSubmit', 'Etapa creada con ID: ' + etapaId + ' para la solicitud ID: ' + solicitudId);
            }


         } catch (e) {
            log.error('afterSubmit', e);
            throw error.create({
                name: 'AFTER_SUBMIT_ERROR',
                message: 'Error en afterSubmit: ' + e.message,
                notifyOff: false
            });
         }
      };




        
      return { 
        afterSubmit 
    };
   });
