/**
 * 
 * Task                    Date                  Author                             
 *  Asignar Cliente         05/04/2024           Oscar Lopez                       
 * 
 *@NApiVersion 2.1
 *@NScriptType Suitelet
 */
 define(['N/ui/serverWidget', "N/record", "N/runtime"], (serverWidget, record, runtime) => {
     
    var EMPLEADO_ANALISIS_ID = '49821';

    function onRequest(context) {

        let method = context.request.method;
        if (method == "GET") {

            var form = serverWidget.createForm({ title : 'Adjuntar nota para analisis.', hideNavBar: true });

            var nota = form.addField({ id : 'custpage_nota', type : serverWidget.FieldType.TEXTAREA, label: 'Nota' });

            var customer = form.addField({ id : 'custpage_current_customer', type : serverWidget.FieldType.INLINEHTML, label: 'Cliente' });
            customer.defaultValue = '<input type="hidden" id="customer_id", name="customer_id" value="' + context.request.parameters["customer_id"] + '" />';
            
            form.addSubmitButton({ label : 'Enviar' });

            context.response.writePage(form);

        } else {

            var customer_id = context.request.parameters.customer_id;
            var nota = context.request.parameters.custpage_nota;
            var employee_id = EMPLEADO_ANALISIS_ID; // runtime.getCurrentUser();

            log.debug("onRequest", '************  start  ************');
            log.debug("onRequest", 'employee_id: ' + employee_id);
            log.debug("onRequest", 'customer_id: ' + customer_id);

            try {
                var employee = record.load({
                    type: record.Type.EMPLOYEE,
                    id: employee_id,
                    isDynamic: true,
                });

                var title = employee.getValue('title');
                var cuando = getFecha();

                record.submitFields({
                    type: record.Type.CUSTOMER,
                    id: customer_id,
                    values: {
                        custentity_cliente_asignado_a: employee_id,
                        custentity_cliente_departamento: title,
                        custentity_cliente_cuando: cuando,
                        custentity_cliente_nota: nota
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });         
            } catch (E) {
                log.error('Error', E);
            }   
            context.response.write('<script> close(); </script>');
        } 
    }

    function getFecha() {
        var fecha = new Date();
        var dia = String(fecha.getDate()).padStart(2, '0');
        var mes = String(fecha.getMonth() + 1).padStart(2, '0'); // Sumamos 1 porque los meses van de 0 a 11
        var anio = fecha.getFullYear();
        var hora = String(fecha.getHours()).padStart(2, '0');
        var minutos = String(fecha.getMinutes()).padStart(2, '0');
        
        return dia+"/"+mes+"/"+anio+" "+hora+":"+minutos;
    }

    return {
        onRequest
    }

 });
