 /**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 */

define(['N/ui/serverWidget', 'N/log', 'N/url', 'N/runtime', 'N/cache'], 
function(serverWidget, log, url, runtime, cache) {

    /**
     * Render the portlet
     * @param {Object} params
     * @param {serverWidget.Portlet} params.portlet - The portlet object used to render the portlet
     * @param {number} params.column - Specifies whether portlet is in left (1), center (2) or right (3) column of the dashboard
     * @param {string} params.entity - (For custom portlets only) references the customer ID for the selected customer
     */
    function render(params) {
        const stLogTitle = 'render';
        
        try {
            const portlet = params.portlet;
            
            // Set portlet title
            portlet.title = 'System Status Monitor';
            
            // Get current status
            const statusInfo = getSystemStatus();
            const isOnline = statusInfo.isOnline;
            const statusText = isOnline ? 'ONLINE' : 'OFFLINE';
            const statusColor = isOnline ? 'green' : 'red';
            const lastChecked = statusInfo.lastChecked;
            
            // Create the HTML content
            const htmlContent = `
                <div style="padding: 15px; font-family: Arial, sans-serif;">
                    <div style="margin-bottom: 15px;">
                        <h3 style="margin: 0 0 10px 0; color: #333;">System Status</h3>
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="
                                background-color: ${statusColor}; 
                                color: white; 
                                padding: 5px 15px; 
                                border-radius: 20px; 
                                font-weight: bold; 
                                font-size: 14px;
                                margin-right: 10px;
                            ">${statusText}</span>
                            <span style="color: #666; font-size: 12px;">
                                Last checked: ${lastChecked}
                            </span>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <button 
                            id="refreshStatusBtn"
                            onclick="refreshStatus()" 
                            style="
                                background-color: #4CAF50; 
                                color: white; 
                                padding: 10px 20px; 
                                border: none; 
                                border-radius: 5px; 
                                cursor: pointer; 
                                font-size: 14px;
                                margin-right: 10px;
                            "
                            onmouseover="this.style.backgroundColor='#45a049'" 
                            onmouseout="this.style.backgroundColor='#4CAF50'"
                        >
                            Refresh Status
                        </button>
                        
                        <button 
                            id="toggleStatusBtn"
                            onclick="toggleStatus()" 
                            style="
                                background-color: #008CBA; 
                                color: white; 
                                padding: 10px 20px; 
                                border: none; 
                                border-radius: 5px; 
                                cursor: pointer; 
                                font-size: 14px;
                            "
                            onmouseover="this.style.backgroundColor='#007BB5'" 
                            onmouseout="this.style.backgroundColor='#008CBA'"
                        >
                            Toggle Status
                        </button>
                    </div>
                    
                    <div style="
                        background-color: #f9f9f9; 
                        padding: 10px; 
                        border-radius: 5px; 
                        border-left: 4px solid ${statusColor};
                        font-size: 12px;
                        color: #666;
                    ">
                        <strong>Status Details:</strong><br>
                        Server Response: ${isOnline ? 'Active' : 'No Response'}<br>
                        Connection: ${isOnline ? 'Stable' : 'Interrupted'}<br>
                        Last Update: ${lastChecked}<br>
                        Source: ${statusInfo.source}
                    </div>
                </div>
                
                <script type="text/javascript">
                    function refreshStatus() {
                        try {
                            var refreshUrl = '${getRefreshUrl()}';
                            window.location.href = refreshUrl;
                        } catch (e) {
                            console.error('Error refreshing status:', e);
                            alert('Error refreshing status. Please try again.');
                        }
                    }
                    
                    function toggleStatus() {
                        try {
                            var toggleUrl = '${getToggleUrl()}';
                            window.location.href = toggleUrl;
                        } catch (e) {
                            console.error('Error toggling status:', e);
                            alert('Error toggling status. Please try again.');
                        }
                    }
                    
                    // Auto-refresh every 30 seconds
                    setTimeout(function() {
                        refreshStatus();
                    }, 30000);
                </script>
            `;
            
            // Add the HTML content to the portlet
            portlet.addLine({
                text: htmlContent
            });
            
            log.debug(stLogTitle, 'Portlet rendered successfully - Status: ' + statusText);
            
        } catch (error) {
            log.error(stLogTitle, error);
            
            // Display error message in portlet
            params.portlet.addLine({
                text: '<div style="color: red; padding: 10px;">Error loading status portlet: ' + error.message + '</div>'
            });
        }
    }
    
    /**
     * Get system status from cache or determine new status
     * @returns {Object} Status information
     */
    function getSystemStatus() {
        try {
            const statusCache = cache.getCache({
                name: 'system_status',
                scope: cache.Scope.PROTECTED
            });
            
            let cachedStatus = statusCache.get('current_status');
            let cachedTime = statusCache.get('last_checked');
            
            if (!cachedStatus) {
                // Determine initial status
                const isOnline = checkSystemStatus();
                const currentTime = new Date().toISOString();
                
                statusCache.put({
                    key: 'current_status',
                    value: isOnline ? 'online' : 'offline',
                    ttl: 3600 // 1 hour
                });
                
                statusCache.put({
                    key: 'last_checked',
                    value: currentTime,
                    ttl: 3600
                });
                
                return {
                    isOnline: isOnline,
                    lastChecked: new Date(currentTime).toLocaleString(),
                    source: 'Auto-detected'
                };
            }
            
            return {
                isOnline: cachedStatus === 'online',
                lastChecked: cachedTime ? new Date(cachedTime).toLocaleString() : 'Unknown',
                source: 'Cached'
            };
            
        } catch (error) {
            log.error('getSystemStatus', error);
            return {
                isOnline: false,
                lastChecked: new Date().toLocaleString(),
                source: 'Error'
            };
        }
    }
    
    /**
     * Check system status (customize this logic based on your needs)
     * @returns {boolean} True if system is online, false if offline
     */
    function checkSystemStatus() {
        try {
            // Example logic - you can customize this
            const currentHour = new Date().getHours();
            const isBusinessHours = currentHour >= 8 && currentHour <= 18;
            
            // You could check:
            // - External API availability
            // - Database connectivity
            // - Custom record counts
            // - Integration status
            // - Business hours
            
            // For demo purposes, return online during business hours
            return isBusinessHours;
            
        } catch (error) {
            log.error('checkSystemStatus', error);
            return false;
        }
    }
    
    /**
     * Get URL for refresh action
     * @returns {string} Refresh URL
     */
    function getRefreshUrl() {
        try {
            // You can create a suitelet to handle the refresh action
            return url.resolveScript({
                scriptId: 'customscript_status_handler', // Replace with your suitelet script ID
                deploymentId: 'customdeploy_status_handler', // Replace with your deployment ID
                params: {
                    action: 'refresh'
                }
            });
        } catch (error) {
            log.error('getRefreshUrl', error);
            return 'javascript:location.reload();'; // Fallback to page reload
        }
    }
    
    /**
     * Get URL for toggle action
     * @returns {string} Toggle URL
     */
    function getToggleUrl() {
        try {
            // You can create a suitelet to handle the toggle action
            return url.resolveScript({
                scriptId: 'customscript_status_handler', // Replace with your suitelet script ID
                deploymentId: 'customdeploy_status_handler', // Replace with your deployment ID
                params: {
                    action: 'toggle'
                }
            });
        } catch (error) {
            log.error('getToggleUrl', error);
            return 'javascript:alert("Toggle functionality not available");'; // Fallback
        }
    }

    return {
        render: render
    };
});
