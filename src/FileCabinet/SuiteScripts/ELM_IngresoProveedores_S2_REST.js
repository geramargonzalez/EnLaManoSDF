/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

define(['N/record', './ELM_Aux_Lib.js', 'N/runtime'],
   function (record, auxLib, runtime) {
      function post(requestBody) {
         const logTitle = 'post';
         const objScriptParam = getScriptParameters();
         const docNumber = requestBody?.docNumber;
         const mobilephone = requestBody?.mobilephone || requestBody?.phone;
         const email = requestBody?.email;
         const source = requestBody?.source;
         log.debug('RESTlet working', 'Documento: ' + docNumber + ' - Telefono: ' + mobilephone + ' - Email: ' + email);
         const idLog = auxLib.createLogRecord(docNumber, null, false, 2, source || null, requestBody);
         const response = {
            docNumber: docNumber,
            success: false,
            result: null
         };
         try {
             const isValid = auxLib.validateCI(docNumber);
             if (!isValid) {
               log.audit('Error', 'El documento ' + docNumber + ' no es válido.'); 
               response.result = 'Documento no válido';
               log.debug('Response S1  ' + docNumber, JSON.stringify(response));
               auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
               return response;
            } 

            if (!mobilephone) {
               log.audit('Error', 'El documento ' + docNumber + ' no tiene un telefono valido.');
               response.result = 'Telefono no válido';
               log.debug('Response S2  ' + docNumber, JSON.stringify(response));
               auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
               return response;
               
            }
            const lead = auxLib.findEntityWithState(docNumber);
            log.debug(logTitle, 'Lead: ' + JSON.stringify(lead));

           if (lead?.id) {
               
               let approvalStatus = lead.status

               let channel = '';
               if (lead.status === objScriptParam.leadStatusLat) {
                     
                  approvalStatus = objScriptParam.leadStatusApr;
                  response.success = true;
                  const canal = auxLib.getProveedorId(source)

                  auxLib.snapshotAprobados(docNumber, lead.id, approvalStatus, canal || '');
                  if (source) {
                   channel = auxLib.getProveedorId(source);
                }

                if (lead.solID) {
                     auxLib.updateSolicitudVale({
                        solicitudId: lead.solID,
                        estadoGestion: approvalStatus,
                        canal: source ? channel : ''
               
                  });
                }


               }
               
               const values = {
                  mobilephone: mobilephone,
                  email: email,
                  custentity_elm_aprobado: approvalStatus,
               };

               if (channel) {
                  values.custentity_elm_channel = channel;
               }

               log.debug('Updating Lead', 'ID: ' + lead.id + ' - Values: ' + JSON.stringify(values));

               record.submitFields({
                  type: record.Type.LEAD,
                  id: lead?.id,
                  values: values
               });
            } else {
               log.audit('Error', 'El documento ' + docNumber + ' no tiene un Lead creado');
               response.result = 'Lead no existe';
               response.success = false;
            }
         } catch (e) {
            log.error(logTitle, e);
            response.success = false;
            response.result = e.message;
            const user = runtime.getCurrentUser().id;
            const obj = {
               tipo: 2,
               usuario: user,
               record: 'Lead',
               notas:  'Error - Servicio 2: ' + docNumber + ' - details: ' + e, 
            };
            auxLib.createRecordAuditCambios(obj);
         }
         log.debug('Response S2 ' + docNumber, JSON.stringify(response));
         auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
         return response;
      }

      function getScriptParameters() {
         const scriptObj = runtime.getCurrentScript();
         const objParams = {
            leadStatusLat: scriptObj.getParameter({
               name: 'custscript_elm_estado_latente_pm'
            }),
            leadStatusApr: scriptObj.getParameter({
               name: 'custscript_elm_estado_aprobado'
            })
         };
         return objParams;
      }

      return {
         post: post
      };

   });
