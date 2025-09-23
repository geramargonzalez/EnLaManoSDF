/**
 * @NApiVersion 2.1
 * @NScriptType MassUpdateScript
 */
define(['N/record', 'N/runtime'], (record, runtime) => {

    /**
     * @author  Gerardo Gonzalez
     * @desc each - This function deletes all leads record.
     * @param {string} params - Purpose name
     */
    const each = (params) => {
        try {
            // params.id es el Internal ID del lead
            const operador = runtime.getCurrentScript().getParameter({ name: 'custscript_elm_operador_pm' });
                const idLead = record.submitFields({
                type: record.Type.LEAD,
                id: params.id,
                values: {
                    custentity_elm_operador: operador
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit('Lead Assigned', 'Lead ' + idLead + ' assigned to employee ' + operador);

        } catch (e) {
            log.error('Error Deleting Lead', `ID: ${params.id} - Error: ${e.message}`);
        }
    };

    return { each };
});
