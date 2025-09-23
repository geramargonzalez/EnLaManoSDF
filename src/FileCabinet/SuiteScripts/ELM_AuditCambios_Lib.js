/**
 * @NApiVersion 2.1
 * @NScriptType Library
 * @description Library for creating Record Audit Cambios records
 */

define(['N/record', 'N/log', 'N/runtime', 'N/search'], 
function(record, log, runtime, search) {

    /**
     * Create a Record Audit Cambios record
     * @param {Object} options - Configuration object
     * @param {string} options.notas - Notes/comments about the change
     * @param {string} options.usuario - User who made the change (employee internal ID)
     * @param {string} options.record - Record reference or ID
     * @param {string} options.tipo - Type of record audit
     * @param {string} options.changeDetails - Additional change details (optional)
     * @param {string} options.recordType - Type of the record being audited (optional)
     * @param {string} options.recordId - Internal ID of the record being audited (optional)
     * @returns {string|null} Internal ID of created record or null if failed
     */
    function createRecordAuditCambios(options) {
        const stLogTitle = 'createRecordAuditCambios';
        
        try {
            if (!options) {
                throw new Error('Options parameter is required');
            }

            // Validate required fields
            if (!options.notas) {
                throw new Error('Notas field is required');
            }

            // Create the custom record
            const auditRecord = record.create({
                type: 'customrecord_audit_cambios',
                isDynamic: false
            });

            // Set the fields based on what I can see in the image
            
            // Notes field - Long Text field
            auditRecord.setValue({
                fieldId: 'custrecord_elm_notas_cambios',
                value: options.notas
            });

            // Usuario field - Employee reference
            if (options.usuario) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_usuario_cambios',
                    value: options.usuario
                });
            } else {
                // Use current user if not specified
                const currentUser = runtime.getCurrentUser();
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_usuario_cambios',
                    value: currentUser.id
                });
            }

            // Record field - Free-Form Text field
            if (options.record) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_record_cambios',
                    value: options.record
                });
            }

            // Tipo field - appears to be a list/select field
            if (options.tipo) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_tipo_cambios',
                    value: options.tipo
                });
            }

            // Additional optional fields
            if (options.changeDetails) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_details_cambios',
                    value: options.changeDetails
                });
            }

            if (options.recordType) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_record_type_cambios',
                    value: options.recordType
                });
            }

            if (options.recordId) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_record_id_cambios',
                    value: options.recordId
                });
            }

            // Set automatic timestamp if field exists
            try {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_fecha_cambios',
                    value: new Date()
                });
            } catch (dateError) {
                // Field might not exist or might be auto-populated
                log.debug(stLogTitle, 'Date field not set: ' + dateError.message);
            }

            // Save the record
            const recordId = auditRecord.save();
            
            log.audit(stLogTitle, `Record Audit Cambios created successfully with ID: ${recordId}`);
            
            return recordId;

        } catch (error) {
            log.error(stLogTitle, error);
            return null;
        }
    }

    /**
     * Create a change audit record for a specific NetSuite record
     * @param {Object} options - Configuration object
     * @param {string} options.recordType - Type of record being audited
     * @param {string} options.recordId - Internal ID of record being audited
     * @param {string} options.changeType - Type of change (CREATE, EDIT, DELETE, etc.)
     * @param {string} options.description - Description of the change
     * @param {Object} options.oldValues - Old field values (optional)
     * @param {Object} options.newValues - New field values (optional)
     * @param {string} options.userId - User making the change (optional, defaults to current user)
     * @returns {string|null} Internal ID of created audit record
     */
    function createChangeAudit(options) {
        const stLogTitle = 'createChangeAudit';
        
        try {
            const currentUser = runtime.getCurrentUser();
            
            // Build detailed notes
            let notes = `${options.changeType}: ${options.description}\n`;
            notes += `Record Type: ${options.recordType}\n`;
            notes += `Record ID: ${options.recordId}\n`;
            notes += `Date: ${new Date().toISOString()}\n`;
            notes += `User: ${currentUser.name} (${currentUser.id})\n`;
            
            if (options.oldValues) {
                notes += `\nOld Values:\n${JSON.stringify(options.oldValues, null, 2)}\n`;
            }
            
            if (options.newValues) {
                notes += `\nNew Values:\n${JSON.stringify(options.newValues, null, 2)}\n`;
            }

            return createRecordAuditCambios({
                notas: notes,
                usuario: options.userId || currentUser.id,
                record: `${options.recordType}:${options.recordId}`,
                tipo: getAuditTypeId(options.changeType),
                recordType: options.recordType,
                recordId: options.recordId,
                changeDetails: options.description
            });

        } catch (error) {
            log.error(stLogTitle, error);
            return null;
        }
    }

    /**
     * Get audit type ID based on change type
     * @param {string} changeType - Type of change
     * @returns {string} Audit type ID
     */
    function getAuditTypeId(changeType) {
        const typeMap = {
            'CREATE': '1',
            'EDIT': '2', 
            'DELETE': '3',
            'APPROVE': '4',
            'REJECT': '5',
            'ASSIGN': '6',
            'STATUS_CHANGE': '7',
            'FIELD_UPDATE': '8'
        };
        
        return typeMap[changeType] || '1'; // Default to CREATE
    }

    /**
     * Search for audit records by criteria
     * @param {Object} filters - Search filters
     * @param {string} filters.recordType - Record type to search for
     * @param {string} filters.recordId - Record ID to search for
     * @param {string} filters.usuario - User ID to search for
     * @param {Date} filters.dateFrom - Start date
     * @param {Date} filters.dateTo - End date
     * @returns {Array} Array of audit records
     */
    function searchAuditRecords(filters) {
        const stLogTitle = 'searchAuditRecords';
        
        try {
            const searchFilters = [];
            
            if (filters.recordType) {
                searchFilters.push(['custrecord_elm_record_type_cambios', 'is', filters.recordType]);
            }
            
            if (filters.recordId) {
                if (searchFilters.length > 0) searchFilters.push('AND');
                searchFilters.push(['custrecord_elm_record_id_cambios', 'is', filters.recordId]);
            }
            
            if (filters.usuario) {
                if (searchFilters.length > 0) searchFilters.push('AND');
                searchFilters.push(['custrecord_elm_usuario_cambios', 'anyof', filters.usuario]);
            }
            
            if (filters.dateFrom) {
                if (searchFilters.length > 0) searchFilters.push('AND');
                searchFilters.push(['created', 'onorafter', filters.dateFrom]);
            }
            
            if (filters.dateTo) {
                if (searchFilters.length > 0) searchFilters.push('AND');
                searchFilters.push(['created', 'onorbefore', filters.dateTo]);
            }

            const auditSearch = search.create({
                type: 'customrecord_audit_cambios',
                filters: searchFilters,
                columns: [
                    'internalid',
                    'custrecord_elm_notas_cambios',
                    'custrecord_elm_usuario_cambios', 
                    'custrecord_elm_record_cambios',
                    'custrecord_elm_tipo_cambios',
                    'created'
                ]
            });

            const results = [];
            auditSearch.run().each(function(result) {
                results.push({
                    id: result.getValue('internalid'),
                    notes: result.getValue('custrecord_elm_notas_cambios'),
                    user: result.getText('custrecord_elm_usuario_cambios'),
                    userId: result.getValue('custrecord_elm_usuario_cambios'),
                    record: result.getValue('custrecord_elm_record_cambios'),
                    type: result.getText('custrecord_elm_tipo_cambios'),
                    typeId: result.getValue('custrecord_elm_tipo_cambios'),
                    created: result.getValue('created')
                });
                return true;
            });

            return results;

        } catch (error) {
            log.error(stLogTitle, error);
            return [];
        }
    }

    return {
        createRecordAuditCambios: createRecordAuditCambios,
        createChangeAudit: createChangeAudit,
        searchAuditRecords: searchAuditRecords
    };
});
