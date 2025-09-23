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
            record.delete({
                type: "customrecord_elm_leads_con_vale",
                id: params.id
            });
            log.audit('Lead con Vale Deleted', `Lead con Vale with ID ${params.id} deleted.`);
        } catch (e) {
            log.error('Error Deleting Lead con Vale', `ID: ${params.id} - Error: ${e.message}`);
        }
    };

    return { each };
});
