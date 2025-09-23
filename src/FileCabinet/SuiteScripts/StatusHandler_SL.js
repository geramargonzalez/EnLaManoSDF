/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/ui/serverWidget', 'N/log', 'N/redirect', 'N/cache'], 
function(serverWidget, log, redirect, cache) {

    /**
     * Handles GET requests
     * @param {Object} context
     * @param {ServerRequest} context.request
     * @param {ServerResponse} context.response
     */
    function onRequest(context) {
        const stLogTitle = 'onRequest';
        
        try {
            const request = context.request;
            const response = context.response;
            const action = request.parameters.action;
            
            log.debug(stLogTitle, 'Action received: ' + action);
            
            switch (action) {
                case 'refresh':
                    handleRefresh(response);
                    break;
                case 'toggle':
                    handleToggle(response);
                    break;
                default:
                    handleDefault(response);
                    break;
            }
            
        } catch (error) {
            log.error(stLogTitle, error);
            context.response.write('Error: ' + error.message);
        }
    }
    
    /**
     * Handle refresh action
     * @param {ServerResponse} response
     */
    function handleRefresh(response) {
        const stLogTitle = 'handleRefresh';
        
        try {
            log.audit(stLogTitle, 'Status refresh requested');
            
            // Clear any cached status
            const statusCache = cache.getCache({
                name: 'system_status',
                scope: cache.Scope.PROTECTED
            });
            
            statusCache.remove('current_status');
            statusCache.remove('last_checked');
            
            // Redirect back to dashboard
            redirect.toTaskLink({
                id: 'CARD_-29' // Dashboard task link
            });
            
        } catch (error) {
            log.error(stLogTitle, error);
            response.write('Error refreshing status: ' + error.message);
        }
    }
    
    /**
     * Handle toggle action
     * @param {ServerResponse} response
     */
    function handleToggle(response) {
        const stLogTitle = 'handleToggle';
        
        try {
            log.audit(stLogTitle, 'Status toggle requested');
            
            // Get current status from cache
            const statusCache = cache.getCache({
                name: 'system_status',
                scope: cache.Scope.PROTECTED
            });
            
            const currentStatus = statusCache.get('current_status') || 'online';
            const newStatus = currentStatus === 'online' ? 'offline' : 'online';
            
            // Update status in cache
            statusCache.put({
                key: 'current_status',
                value: newStatus,
                ttl: 3600 // 1 hour
            });
            
            statusCache.put({
                key: 'last_checked',
                value: new Date().toISOString(),
                ttl: 3600
            });
            
            log.audit(stLogTitle, 'Status toggled from ' + currentStatus + ' to ' + newStatus);
            
            // Redirect back to dashboard
            redirect.toTaskLink({
                id: 'CARD_-29' // Dashboard task link
            });
            
        } catch (error) {
            log.error(stLogTitle, error);
            response.write('Error toggling status: ' + error.message);
        }
    }
    
    /**
     * Handle default action
     * @param {ServerResponse} response
     */
    function handleDefault(response) {
        const stLogTitle = 'handleDefault';
        
        try {
            // Create a simple status page
            const form = serverWidget.createForm({
                title: 'System Status Handler'
            });
            
            form.addFieldGroup({
                id: 'status_group',
                label: 'Status Information'
            });
            
            const statusField = form.addField({
                id: 'current_status',
                type: serverWidget.FieldType.TEXT,
                label: 'Current Status',
                container: 'status_group'
            });
            
            const statusCache = cache.getCache({
                name: 'system_status',
                scope: cache.Scope.PROTECTED
            });
            
            const currentStatus = statusCache.get('current_status') || 'online';
            statusField.defaultValue = currentStatus.toUpperCase();
            statusField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.INLINE
            });
            
            const lastCheckedField = form.addField({
                id: 'last_checked',
                type: serverWidget.FieldType.TEXT,
                label: 'Last Checked',
                container: 'status_group'
            });
            
            const lastChecked = statusCache.get('last_checked') || new Date().toISOString();
            lastCheckedField.defaultValue = new Date(lastChecked).toLocaleString();
            lastCheckedField.updateDisplayType({
                displayType: serverWidget.FieldDisplayType.INLINE
            });
            
            response.writePage(form);
            
        } catch (error) {
            log.error(stLogTitle, error);
            response.write('Error loading status page: ' + error.message);
        }
    }

    return {
        onRequest: onRequest
    };
});
