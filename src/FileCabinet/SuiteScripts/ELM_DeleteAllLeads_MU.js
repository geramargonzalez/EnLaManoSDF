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
                type: record.Type.LEAD,
                id: params.id
            });
            log.audit('Lead Deleted', `Lead with ID ${params.id} deleted.`);
        } catch (e) {
            log.error('Error Deleting Lead', `ID: ${params.id} - Error: ${e.message}`);
        }
    };

    return { each };
});
