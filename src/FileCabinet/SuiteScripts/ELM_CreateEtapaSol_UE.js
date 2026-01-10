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
            const solicitudId = newRecord.id;
            const estadoGestion = newRecord.getValue({ fieldId: 'custrecord_elm_sol_est_gestion' });
            const estadoGestionOld = oldRecord.getValue({ fieldId: 'custrecord_elm_sol_est_gestion' });
            const subEstado = newRecord.getValue({ fieldId: 'custrecord_elm_sol_sub_estado' });
            const subEstadoOld = oldRecord.getValue({ fieldId: 'custrecord_elm_sol_sub_estado' });
            const motivoRechazado = newRecord.getValue({ fieldId: 'custrecord_elm_motivo_rechazo' });
            const motivoRechazoOld = newRecord.getValue({ fieldId: 'custrecord_elm_motivo_rechazo' });
         
            
            const operadorId = newRecord.getValue({ fieldId: 'custrecord_elm_sol_operador' });
            const clientID = newRecord.getValue({ fieldId: 'custrecord_elm_sol_cliente' });
            const values = {};

            if (estadoGestion !== estadoGestionOld && estadoGestion) {
                  const etapaId = auxLib.createEtapaSolicitud({
                    solicitudId: solicitudId,
                    estadoGestion: estadoGestion,
                    usuarioId: operadorId ? operadorId : user.id,
                    motivoRechazoId: motivoRechazado ? motivoRechazado : null
                    });
                    log.debug('afterSubmit', 'Etapa creada con ID: ' + etapaId + ' para la solicitud ID: ' + solicitudId);
                    values.custentity_elm_aprobado = estadoGestion;

            }

            if (subEstado != subEstadoOld && subEstado) {
                values.custentity_elm_sub_estado = subEstado;
            }

            if (motivoRechazado != motivoRechazoOld && motivoRechazado) {
                values.custentity_elm_reject_reason = motivoRechazado;
            }

            if(clientID){
               const ClientsFields = search.lookupFields({
                  type: 'customer',
                  id: clientID,
                  columns: ['custentity_elm_sol_vig']
                });

                const solVig = ClientsFields.custentity_elm_sol_vig[0].value;

                log.debug('afterSubmit', 'solVig: ' + solVig + ' solicitudId: ' + solicitudId);
               
                  if(solVig == solicitudId && values){
                     const id = record.submitFields({
                        type: 'customer',
                        id: clientID,
                        values: values
                        });
                        log.debug('afterSubmit', 'ID Lead/Client actualizado: ' + id);
                  }
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
