/**
 * @NApiVersion 2.1
 * @NScriptType MassUpdateScript
 */
define(['N/record'], (record) => {

    /**
     * @author  Gerardo Gonzalez
     * @desc each - This function deletes all leads record.
     * @param {string} params - Purpose name
     */
    const each = (params) => {
        try {
            // params.id es el Internal ID del lead
            const idLead = record.submitFields({
                type: record.Type.LEAD,
                id: params.id,
                values: {
                    isinactive: true
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            log.audit('Lead ' + idLead + ' was successfully deactivated');

        } catch (e) {
            log.error('Error Deleting Lead', `ID: ${params.id} - Error: ${e.message}`);
        }
    };

    return { each };
});
