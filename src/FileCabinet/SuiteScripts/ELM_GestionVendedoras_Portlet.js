/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/record', 'N/cache'], 
    function(serverWidget, search, runtime, record, cache) {

    /**
     * @author Gerardo Gonzalez
     * @desc render - This function renders the portlet for managing seller status
     * @param {object} params - The portlet parameters
     */
    function render(params) {
        try {
            const portlet = params.portlet;
            portlet.title = 'Usuario : ' + runtime.getCurrentUser().name;

            // Get current user
            const currentUser = runtime.getCurrentUser();
            const currentUserId = currentUser.id;
            
            // Create daily initial record if needed (first time loading portlet today)
             createDailyInitialRecord(currentUserId);
            
            // Get current seller status
            const sellerStatus = getCurrentSellerStatus(currentUserId);
            const isOnline = sellerStatus.isOnline;
            
            // Create the HTML content for the portlet
            const htmlContent = createPortletHTML(currentUserId, isOnline, sellerStatus);
            
            // Add the HTML field to display the content 
            portlet.addField({
                id: 'custpage_portlet_content',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Content'
            }).updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
            }).defaultValue = htmlContent;

        } catch (error) {
            log.error('Portlet Render Error', error);
            params.portlet.addField({
                id: 'custpage_error',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'Error'
            }).defaultValue = '<div style="color: red;">Error loading portlet: ' + error.message + '</div>';
        }
    }

    /**
     * @desc createDailyInitialRecord - Creates initial daily record for status tracking in reports
     * @param {number} userId - The current user ID
     */
    function createDailyInitialRecord(userId) {
        try {

            log.debug('createDailyInitialRecord', `Creating daily initial record for user: ${userId}`);
            
            // Check if there's already any status record for today
            const dailyStatusSearch =  search.create({
                type: "customrecord_elm_est_vend",
                filters:
                [
                    ["created","onorafter","today"], 
                    "AND", 
                    ["custrecord_elm_estado_operador","anyof",userId], 
                    "AND", 
                    ["custrecord_elm_comienzo","isnotempty",""]
                ],
                columns:
                [
                    search.createColumn({name: "internalid", label: "Internal ID"})
                ]
            });

            let searchResultCount = dailyStatusSearch.runPaged().count;
            log.debug("dailyStatusSearch result count",     searchResultCount);

            log.debug('Daily Status Search', `User: ${userId}, Has Record Today: ${searchResultCount}`);
            // If no record exists for today, create the initial "daily start" record
            if (searchResultCount === 0) {
                const initialRecord = record.create({
                    type: 'customrecord_elm_est_vend'
                });
                
                // Set both start and end time to the same value (beginning of work day)
                initialRecord.setValue('custrecord_elm_estado_operador', userId);
                initialRecord.setValue('custrecord_elm_online', true);
                initialRecord.setValue('custrecord_elm_comienzo', new Date());
                initialRecord.setValue('custrecord_elm_finalizacion', new Date());

                const newInitialRecordId = initialRecord.save();
                log.debug('Daily Initial Record', `Created for user: ${userId}, Record ID: ${newInitialRecordId}, Time: ${new Date()}`);
            } else {
                log.debug('Daily Initial Record', `Already exists for today for user: ${userId}`);
            }
            
        } catch (error) {
            log.error('createDailyInitialRecord Error', error);
            // Don't throw error to avoid breaking the portlet render
        }
    }

    /**
     * @desc getCurrentSellerStatus - Gets the current status of the seller
     * @param {number} userId - The current user ID
     * @returns {object} Status information
     */
    function getCurrentSellerStatus(userId) {
        try {
            // Search for the most recent status record for this user
            const statusSearch = search.create({
                type: 'customrecord_elm_est_vend',
                filters: [
                    ['custrecord_elm_estado_operador', 'anyof', userId]
                ],
                columns: [
                    search.createColumn({ name: 'custrecord_elm_comienzo' }),
                    search.createColumn({ name: 'custrecord_elm_finalizacion' }),
                    search.createColumn({ name: 'custrecord_elm_motivo_ausencia' }),
                    search.createColumn({ name: 'custrecord_elm_online' }),
                    search.createColumn({ name: 'created', sort: search.Sort.DESC }) // Get most recent record
                ]
            });

            let status = {
                isOnline: false,
                dateIn: null,
                dateOut: null,
                reason: null,
                reasonId: null,
                recordId: null
            };

            statusSearch.run().each(function(result) {
                const onlineValue = result.getValue('custrecord_elm_online');
                const dateOut = result.getValue('custrecord_elm_finalizacion');
                const dateIn = result.getValue('custrecord_elm_comienzo');
                
                // Lógica del flujo corregida:
                // - Si el último registro tiene isOnline = false Y NO tiene fecha de finalización, está offline (sesión activa offline)
                // - Si el último registro tiene isOnline = true Y tiene fecha de finalización, está online (sesión cerrada - online)
                // - Por defecto, si no hay registros o lógica no clara, está offline
                let isCurrentlyOnline;
                
                if ((onlineValue === false || onlineValue === 'F') && !dateOut) {
                    // Registro offline activo (sin fecha de finalización) = usuario está offline
                    isCurrentlyOnline = false;
                } else if ((onlineValue === true || onlineValue === 'T') && dateOut) {
                    // Registro offline cerrado (con fecha de finalización) = usuario está online
                    isCurrentlyOnline = true;
                } else {
                    // Cualquier otro caso, asumir offline por defecto
                    isCurrentlyOnline = false;
                }
                
                status = {
                    dateIn: dateIn,
                    dateOut: dateOut,
                    reason: result.getText('custrecord_elm_motivo_ausencia'),
                    reasonId: result.getValue('custrecord_elm_motivo_ausencia'),
                    recordId: result.id,
                    isOnline: isCurrentlyOnline
                };
                
                log.debug('Date Values', `dateIn: ${dateIn} (${typeof dateIn}), dateOut: ${dateOut} (${typeof dateOut})`);
                log.debug('Status Check', `User ${userId}: onlineValue=${onlineValue}, dateOut=${dateOut}, isOnline=${isCurrentlyOnline}`);
                return false; // Get only the first (most recent) result
            });

            return status;
        } catch (error) {
            log.error('getCurrentSellerStatus Error', error);
            return { isOnline: false, dateIn: null, dateOut: null, reason: null, reasonId: null, recordId: null };
        }
    }

    /**
     * @desc formatNetSuiteDate - Safely formats a NetSuite date value
     * @param {any} dateValue - Date value from NetSuite
     * @returns {string} Formatted date string or empty string if invalid
     */
    function formatNetSuiteDate(dateValue) {
        log.debug('formatNetSuiteDate Input', `Date value: ${dateValue}, Type: ${typeof dateValue}`);
        
        if (!dateValue) {
            log.debug('formatNetSuiteDate', 'Date value is null or undefined');
            return '';
        }
        
        try {
            // NetSuite might return dates in different formats
            let dateObj;
            if (dateValue instanceof Date) {
                dateObj = dateValue;
                log.debug('formatNetSuiteDate', 'Date is already a Date object');
            } else if (typeof dateValue === 'string') {
                dateObj = new Date(dateValue);
                log.debug('formatNetSuiteDate', `Converted string "${dateValue}" to Date object`);
            } else {
                log.debug('formatNetSuiteDate', `Unsupported date type: ${typeof dateValue}`);
                return '';
            }
            
            // Check if date is valid
            if (isNaN(dateObj.getTime())) {
                log.debug('formatNetSuiteDate', `Invalid date created from: ${dateValue}`);
                return '';
            }
            const formattedDate = dateObj.toLocaleString();
            log.debug('formatNetSuiteDate Success', `Formatted date: ${formattedDate}`);
            return formattedDate;
        } catch (error) {
            log.debug('formatNetSuiteDate Error', `Failed to format date: ${dateValue}, Error: ${error.message}`);
            return '';
        }
    }

    /**
     * @desc getOfflineReasons - Gets the list of offline reasons for the dropdown
     * @returns {array} Array of reason options
     */
    function getOfflineReasons() {
        try {
            const reasonsSearch = search.create({
                type: 'customlist_elm_aus_ventas',
                filters: [
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    'name'
                ]
            });

            const reasons = [];
            reasonsSearch.run().each(function(result) {
                reasons.push({
                    id: result.id,
                    name: result.getValue('name')
                });
                return true;
            });

            return reasons;
        } catch (error) {
            log.error('getOfflineReasons Error', error);
            return [];
        }
    }

    /**
     * @desc createPortletHTML - Creates the HTML content for the portlet
     * @param {number} userId - Current user ID  
     * @param {boolean} isOnline - Current online status
     * @param {object} sellerStatus - Current seller status object
     * @returns {string} HTML content
     */
    function createPortletHTML(userId, isOnline, sellerStatus) {
        try {
            const reasons = getOfflineReasons();
            
            // Build dropdown options
            let reasonOptions = '<option value="">Seleccionar motivo...</option>';
            reasons.forEach(function(reason) {
                const selected = sellerStatus.reasonId === reason.id ? 'selected' : '';
                reasonOptions += `<option value="${reason.id}" ${selected}>${reason.name}</option>`;
            });

            const statusText = isOnline ? 'Online' : 'Offline';
            const buttonClass = isOnline ? 'online-btn' : 'offline-btn';
            
            let statusInfo = '';
            
            // Debug: Log the current status and date values
            log.debug('Status Info Debug', `isOnline: ${isOnline}, dateIn: ${sellerStatus.dateIn}, dateOut: ${sellerStatus.dateOut}`);
            
            if (isOnline) {
                // Usuario está online - buscar el último registro cerrado para mostrar cuándo se conectó
                if (sellerStatus.dateOut) {
                    const formattedDate = formatNetSuiteDate(sellerStatus.dateOut);
                    if (formattedDate) {
                        statusInfo = `<small>Conectado desde: ${formattedDate}</small>`;
                    } else {
                        statusInfo = '<small>Conectado (fecha no disponible)</small>';
                    }
                } else {
                    // Si no hay fecha de finalización, significa que se acaba de conectar
                    statusInfo = '<small>Conectado recientemente</small>';
                }
            } else {
                // Usuario está offline - mostrar desde cuándo se desconectó
                if (sellerStatus.dateIn) {
                    const formattedDate = formatNetSuiteDate(sellerStatus.dateIn);
                    if (formattedDate) {
                        statusInfo = `<small>Desconectado desde: ${formattedDate}</small>`;
                    } else {
                        statusInfo = '<small>Desconectado (fecha no disponible)</small>';
                    }
                } else {
                    statusInfo = '<small>Estado desconectado</small>';
                }
            }

            return `
                <div id="seller-status-portlet" style="padding: 10px; font-family: Arial, sans-serif;">
                    <style>
                        .status-container {
                            text-align: center;
                            margin-bottom: 15px;
                        }
                        .status-button {
                            padding: 10px 20px;
                            border: none;
                            border-radius: 5px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                            min-width: 120px;
                            transition: all 0.3s ease;
                        }
                        .online-btn {
                            background-color: #28a745;
                            color: white;
                        }
                        .online-btn:hover {
                            background-color: #218838;
                        }
                        .offline-btn {
                            background-color: #dc3545;
                            color: white;
                        }
                        .offline-btn:hover {
                            background-color: #c82333;
                        }
                        .reason-container {
                            margin-top: 15px;
                            display: ${isOnline ? 'none' : 'block'};
                        }
                        .reason-select {
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            font-size: 14px;
                        }
                        .status-info {
                            margin-top: 10px;
                            color: #666;
                            font-size: 12px;
                        }
                    </style>
                    
                    <div class="status-container">
                        <button id="status-toggle-btn" class="status-button ${buttonClass}" 
                                onclick="toggleSellerStatus(${userId}, ${isOnline})">
                            ${statusText}
                        </button>
                        <div class="status-info">${statusInfo}</div>
                    </div>

                    <div id="reason-container" class="reason-container">
                        <label for="offline-reason"><strong>Motivo de desconexión:</strong></label>
                        <select id="offline-reason" class="reason-select" onchange="updateOfflineReason(${userId})">
                            ${reasonOptions}
                        </select>
                    </div>
                </div>

                <script>
                    // Load NetSuite modules and client script
                    require(['N/runtime'], function(runtime) {
                        try {
                            // For Client Scripts in NetSuite, we need to load them differently
                            // Since we can't directly require a Client Script in a portlet,
                            // we'll include the essential functions inline as fallback
                            
                            // Essential functions for seller status management
                            window.toggleSellerStatus = function(userId, currentStatus) {
                                const newStatus = !currentStatus;
                                const reasonContainer = document.getElementById('reason-container');
                                const button = document.getElementById('status-toggle-btn');
                                
                                // Show/hide reason dropdown based on new status
                                if (newStatus) {
                                    reasonContainer.style.display = 'none';
                                } else {
                                    reasonContainer.style.display = 'block';
                                }
                                
                                // Update button appearance immediately
                                if (newStatus) {
                                    button.textContent = 'Online';
                                    button.className = 'status-button online-btn';
                                } else {
                                    button.textContent = 'Offline';
                                    button.className = 'status-button offline-btn';
                                }
                                
                                // Disable button temporarily
                                button.disabled = true;
                                button.style.opacity = '0.6';
                                
                                // Get reason ID if going offline
                                const reasonId = newStatus ? '' : document.getElementById('offline-reason').value;
                                
                                // Update the status
                                updateSellerStatus(userId, newStatus, reasonId);
                            };
                            
                            window.updateOfflineReason = function(userId) {
                                const reasonId = document.getElementById('offline-reason').value;
                                if (reasonId) {
                                    // Actualizar el último registro offline con el motivo de ausencia
                                    require(['N/record', 'N/search'], function(record, search) {
                                        try {
                                            // Buscar el último registro offline para este usuario
                                            const statusSearch = search.create({
                                                type: 'customrecord_elm_est_vend',
                                                filters:
                                                [
                                                    ["custrecord_elm_estado_operador","anyof",userId], 
                                                    "AND", 
                                                    ["custrecord_elm_online","is","F"], 
                                                    "AND", 
                                                    ["custrecord_elm_finalizacion","isempty",""]
                                                ],
                                                    columns: [
                                                    search.createColumn({ name: 'internalid' }),
                                                    search.createColumn({ name: 'created', sort: search.Sort.DESC })
                                                ]
                                            });
                                            
                                            let recordId = null;
                                            statusSearch.run().each(function(result) {
                                                recordId = result.id;
                                                return false; // Solo el más reciente
                                            });
                                            
                                            if (recordId) {
                                                // Actualizar el registro con el motivo de ausencia
                                                const statusRecord = record.load({
                                                    type: 'customrecord_elm_est_vend',
                                                    id: recordId
                                                });
                                                
                                                statusRecord.setValue('custrecord_elm_motivo_ausencia', reasonId);
                                                statusRecord.save();
                                                
                                                // Mostrar mensaje de éxito
                                                const statusContainer = document.querySelector('.status-container');
                                                const successMsg = document.createElement('div');
                                                successMsg.innerHTML = '<small style="color: green;">Motivo de ausencia actualizado</small>';
                                                statusContainer.appendChild(successMsg);
                                                setTimeout(() => {
                                                    if (successMsg.parentNode) {
                                                        successMsg.parentNode.removeChild(successMsg);
                                                    }
                                                }, 2000);
                                            }
                                            
                                        } catch (error) {
                                            console.error('Error updating offline reason:', error);
                                            alert('Error al actualizar motivo: ' + error.message);
                                        }
                                    });
                                }
                            };
                            
                            window.updateSellerStatus = function(userId, isOnline, reasonId) {
                                console.log('Updating status:', { userId, isOnline, reasonId });
                                
                                require(['N/record', 'N/search'], function(record, search) {
                                    try {
                                        updateSellerStatusDirect(userId, isOnline, reasonId, record, search);
                                    } catch (error) {
                                        console.error('Error updating status:', error);
                                        handleStatusUpdateError(error, isOnline);
                                    }
                                });
                            };
                            
                            function updateSellerStatusDirect(userId, isOnline, reasonId, record, search) {
                                const currentDateTime = new Date();
                                
                                if (isOnline) {
                                    // Usuario va de OFFLINE a ONLINE
                                    // Buscar el último registro offline activo (sin fecha de finalización) y cerrarlo
                                    const statusSearch = search.create({
                                        type: 'customrecord_elm_est_vend',
                                        filters:
                                        [
                                            ["custrecord_elm_estado_operador","anyof",userId], 
                                            "AND", 
                                            ["custrecord_elm_online","is","F"], 
                                            "AND", 
                                            ["custrecord_elm_finalizacion","isempty",""]
                                        ],
                                        columns: [
                                            search.createColumn({ name: 'internalid' }),
                                            search.createColumn({ name: 'created', sort: search.Sort.DESC })
                                        ]
                                    });
                                    
                                    let recordId = null;
                                    statusSearch.run().each(function(result) {
                                        recordId = result.id;
                                        return false; // Solo el más reciente
                                    });
                                    
                                    if (recordId) {
                                        // SOLO actualizar el registro existente: poner fecha de finalización y cambiar a online
                                        record.submitFields({
                                            id: recordId,
                                            type: 'customrecord_elm_est_vend',
                                            values: {
                                                custrecord_elm_online: true,
                                                custrecord_elm_finalizacion: currentDateTime
                                            }
                                        });
                                        console.log('Status updated to ONLINE for user:', userId, 'Record ID:', recordId);  
                                    } else {
                                        console.log('No active offline record found for user:', userId);
                                    }
                                    
                                } else {
                                    // Usuario va de ONLINE a OFFLINE
                                    // Crear un nuevo registro con fecha de comienzo, isOnline false, sin fecha de finalización
                                    const statusRecord = record.create({
                                        type: 'customrecord_elm_est_vend'
                                    });
                                    
                                    statusRecord.setValue('custrecord_elm_estado_operador', userId);
                                    statusRecord.setValue('custrecord_elm_online', false);
                                    statusRecord.setValue('custrecord_elm_comienzo', currentDateTime);
                                    // No establecer custrecord_elm_finalizacion (queda vacío)
                                    
                                    // Si ya viene con reasonId, lo establecemos
                                    if (reasonId) {
                                        statusRecord.setValue('custrecord_elm_motivo_ausencia', reasonId);
                                    }
                                    
                                    const newRecordId = statusRecord.save();
                                    console.log('New offline record created for user:', userId, 'Record ID:', newRecordId);
                                }
                                
                                // Update employee active status based on online/offline status
                                try {
                                    if (userId == 49828 || userId == 65143) {
                                        record.submitFields({
                                            id: userId,
                                            type: record.Type.EMPLOYEE,
                                            values: {
                                                custentity_elm_activo: isOnline
                                            }
                                        });
                                    }
                                    console.log('Employee active status updated for user:', userId, 'Active:', isOnline);
                                } catch (employeeUpdateError) {
                                    console.error('Error updating employee active status:', employeeUpdateError);
                                }
                                
                                // Update UI on success - pass userId to the function
                                updateUIAfterStatusChange(isOnline, currentDateTime, userId);
                            }
                            
                            function handleStatusUpdateError(error, isOnline) {
                                const button = document.getElementById('status-toggle-btn');
                                alert('Error updating status: ' + error.message);
                                
                                // Revert button state
                                if (isOnline) {
                                    button.textContent = 'Offline';
                                    button.className = 'status-button offline-btn';
                                    document.getElementById('reason-container').style.display = 'block';
                                } else {
                                    button.textContent = 'Online';
                                    button.className = 'status-button online-btn';
                                    document.getElementById('reason-container').style.display = 'none';
                                }
                                
                                button.disabled = false;
                                button.style.opacity = '1';
                            }
                            
                            function updateUIAfterStatusChange(isOnline, currentDateTime, userId) {
                                const button = document.getElementById('status-toggle-btn');
                                button.disabled = false;
                                button.style.opacity = '1';
                                
                                // IMPORTANT: Update the onclick handler with the new status
                                button.setAttribute('onclick', 'toggleSellerStatus(' + userId + ', ' + isOnline + ')');
                                
                                // Show success message
                                const statusContainer = document.querySelector('.status-container');
                                const successMsg = document.createElement('div');
                                successMsg.innerHTML = '<small style="color: green;">Estado actualizado correctamente</small>';
                                statusContainer.appendChild(successMsg);
                                setTimeout(() => {
                                    if (successMsg.parentNode) {
                                        successMsg.parentNode.removeChild(successMsg);
                                    }
                                }, 3000);
                                
                                // Update status info based on new status
                                const statusInfoDiv = document.querySelector('.status-info');
                                if (statusInfoDiv) {
                                    try {
                                        const timeString = currentDateTime.toLocaleString();
                                        if (isOnline) {
                                            // Usuario acaba de conectarse - mostrar desde cuándo está conectado
                                            statusInfoDiv.innerHTML = '<small>Conectado desde: ' + timeString + '</small>';
                                        } else {
                                            // Usuario acaba de desconectarse - mostrar desde cuándo está desconectado
                                            statusInfoDiv.innerHTML = '<small>Desconectado desde: ' + timeString + '</small>';
                                        }
                                    } catch (dateError) {
                                        console.log('Error formatting date:', currentDateTime);
                                        statusInfoDiv.innerHTML = '<small>Estado actualizado</small>';
                                    }
                                }
                                
                                // Update reason container visibility
                                const reasonContainer = document.getElementById('reason-container');
                                if (reasonContainer) {
                                    if (isOnline) {
                                        reasonContainer.style.display = 'none';
                                    } else {
                                        reasonContainer.style.display = 'block';
                                        // Clear the reason selection when going offline
                                        const reasonSelect = document.getElementById('offline-reason');
                                        if (reasonSelect) {
                                            reasonSelect.value = '';
                                        }
                                    }
                                }
                            }
                            
                        } catch (error) {
                            console.error('Script initialization error:', error);
                        }
                    });
                </script>
            `;
        } catch (error) {
            log.error('createPortletHTML Error', error);
            return '<div style="color: red;">Error creating portlet content</div>';
        }
    }

    return {
        render: render
    };
});
