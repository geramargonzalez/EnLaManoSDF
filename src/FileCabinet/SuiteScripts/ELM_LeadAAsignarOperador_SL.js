/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/runtime', 'N/ui/serverWidget', 'N/redirect', 'N/error', 'N/search', 'N/record'], function(runtime, serverWidget, redirect, error, search, record) {
    
     /**
     * @author  Gerardo Gonzalez
     * @desc onRequest - This function handles the GET and POST requests for the Suitelet.
     * @param {object} scriptContext 
     */
    function onRequest(context) {
        try {
            if (context.request.method === 'GET') {
            const form = createForm();
            let leadyByOperador = [];
            const objParametersGenral = context.request.parameters;
            form.addSubmitButton({
                label: 'Asignar'
            });
            uiFilters(form, objParametersGenral);
            const operador = objParametersGenral.operador || '';
            if (operador) {
                leadyByOperador = ssGetLeadByOperador(operador); 
            }
            createSublist(form, leadyByOperador.length > 0 ? leadyByOperador.length : 0);
            if (objParametersGenral.action == 'update_sublist') {
                populateLeadsSublist(form, leadyByOperador);
            }
           context.response.writePage(form);
            } else {
                const form = createForm();
                const objParametersGenral = context.request.parameters;
                const operador = objParametersGenral.custpage_operador || '';
                let msg = 'Revise que todos los leads hayan sido asignados correctamente.';
                if (objParametersGenral.custpage_reasignaroperadores == 'T') {
                const arraySellers =  getAvailableSeller();
                    msg = reDistributeAllOperators(arraySellers, context.request, objParametersGenral?.custentity_elm_operador);
                } else {
                    getServerRequestSublistData(context.request, objParametersGenral?.custpage_operadorasignar);
                }
                const txtMssge = form.addField({
                    id: 'custpage_txt_msg',
                    label: 'Mensaje',
                    type: serverWidget.FieldType.INLINEHTML
                });
                 txtMssge.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.DISABLED
                });
                form.addButton({
                    id: 'reloadBtn',
                    label: 'Volver al Formulario',
                    functionName: `goBack('${runtime.getCurrentScript().id}','${runtime.getCurrentScript().deploymentId}','${operador}')`
                });
               
                form.updateDefaultValues({
                    custpage_txt_msg: msg || ''
                });
                context.response.writePage(form);
            }
        } catch (e) {
             throw error.create({
                name: 'EROR_GET_REQUEST',
                message: 'Error processing GET request: ' + e.message,
                notifyOff: true
            });
        }

    } 
      /**
     * @author  Gerardo Gonzalez
     * @desc uiFilters - This function creates the UI filters for the Suitelet form.
     * @param {object} form
     * @param {object} objParametersGenral - The parameters from the request.
     */
    function uiFilters(form, objParametersGenral) {
        try {
            const operadorField = form.addField({
                id: 'custpage_operador',
                label: 'Operador',
                type: serverWidget.FieldType.SELECT
            })
            keyPairValuesOptions(operadorField);
            operadorField.defaultValue = objParametersGenral.operador || '';
            const operadorAAsignar = form.addField({
                id: 'custpage_operadorasignar',
                label: 'Operador a Asignar',
                type: serverWidget.FieldType.SELECT
            })
            keyPairValuesOptions(operadorAAsignar);
            const reDistrubateFrom = form.addField({
                id: 'custpage_reasignaroperadores',
                label: 'Re-asignar a todos los Operadores',
                type: serverWidget.FieldType.CHECKBOX
            })
            reDistrubateFrom.updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.STARTROW
            });

            form.addField({
                id: 'custpage_leads_disponibles',
                label: 'Leads disponibles para asignar',
                type: serverWidget.FieldType.TEXT
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.INLINE
            }).updateLayoutType({
                layoutType: serverWidget.FieldLayoutType.STARTROW
            });

        } catch (e) {
            throw error.create({
                name: 'UI_FILTERS_ERROR',
                message: 'Error creating UI filters: ' + e.message,
                notifyOff: true
            });
        }
    }
    /**
     * @author  Gerardo Gonzalez
     * @desc createForm - This function creates the Suitelet form.
     */
    function createForm() {
        try {
            const form = serverWidget.createForm({
                title: 'Re-Asignar Operador'
            });
            form.clientScriptModulePath = './ELM_ReAsignarOperador_CL.js';
            return form;
        } catch (e) {
            throw error.create({
                name: 'CREATE_FORM_ERROR',
                message: 'Error creating form: ' + e.message,
                notifyOff: true
            });
        }
    }
    /**
     * @author  Gerardo Gonzalez
     * @desc createSublist - This function creates a sublist in the Suitelet form to display leads to be reassigned.
     * @param {object} form
     * @return {void}
     * */
    function createSublist(form, leadCount) {
        try {
            const sublist = form.addSublist({
                id: 'custpage_leads',
                label: 'Leads: ' + (leadCount > 0 ? ` (${leadCount})` : ''),
                type: serverWidget.SublistType.LIST
            });

            sublist.addButton({
                id: 'mark_all',
                label: 'Marcar todos',
                functionName: 'markbutton(true)'
            });
            sublist.addButton({
                id: 'unmark_all',
                label: 'Desmarcar todos',
                functionName: 'markbutton(false)'
            });

            // Add fields to the sublist
            sublist.addField({
                id: 'custpage_lead_select',
                label: 'Select',
                type: serverWidget.FieldType.CHECKBOX
            });

            sublist.addField({
                id: 'custpage_lead_id',
                label: 'Internal ID',
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'custpage_nro_documento',
                label: 'Nro Documento',
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'custpage_lead_name',
                label: 'Lead Name',
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'custpage_estado_gestion',
                label: 'Estado de Gestión',
                type: serverWidget.FieldType.TEXT
            });

             sublist.addField({
                id: 'custpage_canal',
                label: 'Canal',
                type: serverWidget.FieldType.TEXT
            });


            // Add more fields as needed
        } catch (e) {
            throw error.create({
                name: 'CREATE_SUBLIST_ERROR',
                message: 'Error creating sublist: ' + e.message,
                notifyOff: true
            });
        }
    }
     /**
     * @desc populateLeadsSublist - Populates the leads sublist with data from a specific operator
     * @param {object} form - The form object containing the sublist
     * @param {array} leadyByOperador - An array of leads associated with the operator
     */
    function populateLeadsSublist(form, leadyByOperador) {
        try {
            if (leadyByOperador.length > 0) {
                const sublist = form.getSublist({ id: 'custpage_leads' });
                leadyByOperador.forEach((lead, index) => {
                    sublist.setSublistValue({
                        id: 'custpage_lead_id',
                        line: index,
                        value: lead?.id
                    });
                    sublist.setSublistValue({
                        id: 'custpage_nro_documento',
                        line: index,
                        value: lead?.nroDocumento || ''
                    });
                    sublist.setSublistValue({
                        id: 'custpage_lead_name',
                        line: index,
                        value: lead?.name || 'John Doe'
                    });
                    sublist.setSublistValue({
                        id: 'custpage_estado_gestion',
                        line: index,
                        value: lead?.estadoGestion || 'Aprobado'
                    });
                    sublist.setSublistValue({
                        id: 'custpage_canal',
                        line: index,
                        value: lead?.canal || ''
                    });
                });
            }
        } catch (e) {
            log.error('Error populating leads sublist:', e);
            throw error.create({
                name: 'POPULATE_SUBLIST_ERROR',
                message: 'Error populating leads sublist: ' + e.message,
                notifyOff: true
            });
        }
    }
     /**
     * @author  Gerardo Gonzalez
     * @desc keyPairValuesOptions - This function returns a key-value pair of the status of the sellers.
     * @param {object} fieldToAdd - The field to which the options will be added.
     */
    function keyPairValuesOptions(fieldToAdd) {
        try {
            const keyPaiValues = {};
            const ssEmployees = search.create({
                type: "employee",
                filters:
                [
                    ["custentity_elm_activo","is","T"]
                ],
                columns:
                [
                    search.createColumn({name: "altname", label: "Name"})
                ]
                });
           
            ssEmployees.run().each(function(result){
            // .run().each has a limit of 4,000 results
            keyPaiValues[result.getValue({name: "altname"})] = result.id;
            return true;
            });

            fieldToAdd.addSelectOption({
                value : '',
                text : ''
            });
            Object.entries(keyPaiValues).forEach(([key, value]) => {
                fieldToAdd.addSelectOption({
                    value : value,
                    text : key
                });
            });
        } catch (e) {
            log.error('Error keyPairValuesOptions:', e);
        }
    }

     /**
     * @author  Gerardo Gonzalez
     * @desc ssGetLeadByOperador - This function retrieves leads associated with a specific operator.
     * @param {number} operadorId - The internal ID of the operator.
     */
    function ssGetLeadByOperador(operadorId) {
        try {
            const ssLeads = search.create({
                type: "lead",
                filters:[
                    ["stage","anyof","LEAD"], 
                    "AND", 
                    ["custentity_elm_operador","anyof",operadorId],
                    "AND",
                    ["custentity_elm_aprobado","anyof","25","8","9","7","3","22","2"],
                    "AND",
                    ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
                ],
                columns:
                [
                    search.createColumn({name: "altname", label: "Name"}),
                    search.createColumn({name: "custentity_sdb_nrdocumento", label: "Nro Documento"}),
                    search.createColumn({name: "custentity_elm_aprobado", label: "Estado de Gestión"}),
                    search.createColumn({name: "custentity_elm_channel", label: "Canal"}),
                ]
            });

            const leads = [];
            ssLeads.run().each(function(result) {
                leads.push({
                    id: result.id,
                    name: result.getValue({ name: "altname" }) || 'John Doe',
                    nroDocumento: result.getValue({ name: "custentity_sdb_nrdocumento" }) || 'N/A',
                    estadoGestion: result.getText({ name: "custentity_elm_aprobado" }) || 'Desconocido',
                    canal: result.getText({ name: "custentity_elm_channel" }) || 'Desconocido',
                });
                return true;
            });
            return leads;
        } catch (e) {
            log.error('Error fetching leads by operator:', e);
            throw error.create({
                name: 'LEAD_FETCH_ERROR',
                message: 'Error fetching leads by operator: ' + e.message,
                notifyOff: true
            });
        }
    }

       /**
     * getServerRequestSublistData - this function processes the sublist data from the server request and assigns leads to a specified operator.    
     * @param {object} serverRequest 
     * @param {number} operadorAAsignar - The internal ID of the operator to whom the leads will be assigned.
     * @returns an array with data.
     */
    function getServerRequestSublistData(serverRequest , operadorAAsignar) {
        const logTitle = 'getServerRequestSublistData()';
        try {
            const sublistLineCount = serverRequest.getLineCount({ group: 'custpage_leads' });
            for (let i = 0; i < sublistLineCount; i++) {
               
                const isSelect = serverRequest.getSublistValue({
                    group: 'custpage_leads',
                    name: 'custpage_lead_select',
                    line: i
                });
                const id = serverRequest.getSublistValue({
                    group: 'custpage_leads',
                    name: 'custpage_lead_id',
                    line: i
                });
                if (isSelect == 'T' && operadorAAsignar) {
                    const idLeadAssigned = record.submitFields({
                    type: record.Type.LEAD,
                    id: id,
                    values: {
                        custentity_elm_operador: operadorAAsignar
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                    });
                    log.audit(logTitle, `Lead ${idLeadAssigned} assigned to operator ${operadorAAsignar}`); 
                }
            }


        } catch (error) {
            log.error(logTitle, error.message);
        }
    
    }
    /**
     * reDistributeAllOperators - This function re-distributes leads among available operators.  
     * @param {array} availableSeller the array of available sellers (operators).
     * @param {object} serverRequest - The server request object containing the sublist data.
     * @param {number} operador - The internal ID of the operator to whom the leads will be assigned.
     * @returns an array with data.
     */
    function reDistributeAllOperators(availableSeller, serverRequest, operador) {
        try {
            let iteration = 0;
            log.audit('Available Seller before updated', 'Available Seller updated: ' + JSON.stringify(availableSeller));
             const sublistLineCount = serverRequest.getLineCount({ group: 'custpage_leads' });
             for (let index = 0; index < availableSeller.length; index++) {
                    const element = availableSeller[index];
                    const availableSellerID = element;
                    const currentLeadCount = search.create({
                        type: 'lead',
                        filters: [
                            ["stage", "anyof", "LEAD"],
                            "AND",
                            ['custentity_elm_operador', 'anyof', availableSellerID],
                            "AND",
                            ["custentity_elm_aprobado","anyof","2"],
                            "AND",
                            ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
                        ]
                    }).runPaged().count;

                    if (currentLeadCount < 20) {
                        const isSelect = serverRequest.getSublistValue({
                                group: 'custpage_leads',
                                name: 'custpage_lead_select',
                                line: iteration
                        });
                        const id = serverRequest.getSublistValue({
                            group: 'custpage_leads',
                            name: 'custpage_lead_id',
                            line: iteration
                        });

                        log.audit('Available Seller', `Available Seller ID: ${availableSellerID}, Lead ID: ${id}, Selected: ${isSelect}`);
                        if (isSelect == 'T' && (operador != availableSellerID)) {
                            const idLead = record.submitFields({
                                type: record.Type.LEAD,
                                id: id,
                                values: {
                                    custentity_elm_operador: availableSellerID
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });
                        log.audit('Lead Assigned', 'Lead ' + idLead + ' assigned to employee ' + availableSellerID);

                         const removedElement = availableSeller.splice(index, 1)[0];
        
                            // Add it to the end of the array
                            availableSeller.push(removedElement);
                            log.audit('Available Seller Updated', 'Available Seller updated: ' + JSON.stringify(availableSeller));
                            const IDSeller = record.submitFields({
                                type: 'customrecord_elm_vend_disponibles',
                                id: 1,
                                values: {
                                    custrecord_elm_vend_disp_array: JSON.stringify(availableSeller)
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });
                            log.audit('Available seller updated: ' + IDSeller); 
                        }
                    }
                    iteration++;
                    if (iteration >= sublistLineCount) {
                        log.error('No more leads to assign, All leads have been assigned to operators.');
                        return 'Todos los operadores han sido asignados.';
                    }
                }

                return 'Todos los leads han sido distribuidos correctamente.';
            
        } catch (e) {
            log.error('Error re-distributing all operators:', e);
        }
    }

      /**
     * @author  Gerardo Gonzalez
     * @desc getAvailableSeller - This function retrieves the available sellers from the custom record.
     * @param {object} objScriptParam 
     */
      const getAvailableSeller = () => {
        try {
            const fieldAvailableSeller = search.lookupFields({
               type: 'customrecord_elm_vend_disponibles',
               id: 1,
               columns: ['custrecord_elm_vend_disp_array']
            });
            return JSON.parse(fieldAvailableSeller.custrecord_elm_vend_disp_array);
        } catch (e) {
            throw error.create({
               name: 'GET_AVAILABLE_SELLER_ERROR',
               message: `Something failed when its getting available seller error: ${e.message}`,
               notifyUser: true,
            });
         }
      }

    return {
        onRequest: onRequest
    };
});
