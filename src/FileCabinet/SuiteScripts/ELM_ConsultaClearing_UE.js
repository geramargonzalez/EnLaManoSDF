/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @description User Event Script que agrega un botón para consultar Clearing de Informes
 */

define(['N/runtime', 'N/log'], function(runtime, log) {

    /**
     * @author Gerardo Gonzalez
     * @desc beforeLoad - Agrega el botón de consulta a Clearing en el formulario
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {string} context.type - Trigger type
     * @param {Form} context.form - Current form
     */
    function beforeLoad(context) {
        try {
            // Solo agregar botón en modo VIEW o EDIT
            if (context.type !== context.UserEventType.VIEW && context.type !== context.UserEventType.EDIT) {
                return;
            }

            const currentRecord = context.newRecord;
            const form = context.form;
    

            // Verificar que el registro tenga documento para consultar
            const documento = currentRecord.getValue('custentity_sdb_nrdocumento');
            if (!documento) {
                log.debug('ConsultaClearing', 'No hay documento para consultar');
                return;
            }

            // Verificar rol del usuario (opcional - ajustar según necesidad)
            const currentUser = runtime.getCurrentUser();
            const userRole = currentUser.role;

            if (userRole == 1006 || userRole == 1010) {
                return ; // Roles que no deben ver el botón
            }
            
            // Agregar botón para consultar Clearing
            form.addButton({
                id: 'custpage_btn_consulta_clearing',
                label: 'Consultar Clearing',
                functionName: 'consultarClearing(' + currentRecord.id + ', ' + documento + ')'
            });

            // Vincular el Client Script al formulario
            form.clientScriptModulePath = './ELM_ConsultaClearing_CL.js';

            log.debug('ConsultaClearing', 'Botón agregado correctamente para registro: ' + currentRecord.id);

        } catch (e) {
            log.error('Error en beforeLoad - ConsultaClearing', e.message);
        }
    }

    return {
        beforeLoad: beforeLoad
    };
});
