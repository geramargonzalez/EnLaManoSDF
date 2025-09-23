/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/log'], (record, log) => {

    function beforeLoad(scriptContext) {
        try {
            const recCurrent = scriptContext.newRecord;
            const objForm = scriptContext.form;

            var suiteletURL = '/app/site/hosting/scriptlet.nl?script=34&deploy=1&customer_id='+recCurrent.id;

            objForm.addButton({
                id: 'custpage_suiteletbutton',
                label: 'Enviar a Analisis',
                functionName : 'window.open("' + suiteletURL + '")',
            });
        } catch(error) {
            log.error({
                title: 'beforeLoad_addButton',
                details: error.message
            });
        }
    }

    function beforeSubmit(scriptContext) {
        var newRecord = scriptContext.newRecord;
        var oldRecord = scriptContext.oldRecord;

        if (
            newRecord != null && 
            oldRecord != null && 
            oldRecord.getValue('custentity_cliente_asignado_a') != newRecord.getValue('custentity_cliente_asignado_a')
        ) {

            var employee_id = newRecord.getValue('custentity_cliente_asignado_a');
            var employee = record.load({
                type: record.Type.EMPLOYEE,
                id: employee_id,
                isDynamic: true,
            });

            var title = employee.getValue('title');
            var cuando = getFecha();
            var nota = 'Asignacion automatica generada por el sistema.';

            newRecord.setValue('custentity_cliente_departamento', title);
            newRecord.setValue('custentity_cliente_cuando', cuando);
            newRecord.setValue('custentity_cliente_nota', nota);
        }
    }

    function afterSubmit(scriptContext) {

        var newRecord = scriptContext.newRecord;
        var oldRecord = scriptContext.oldRecord;

        if (
            newRecord != null && 
            oldRecord != null && 
            oldRecord.getValue('custentity_cliente_asignado_a') != newRecord.getValue('custentity_cliente_asignado_a')
        ) {
            var newEmployeeId = newRecord.getValue('custentity_cliente_asignado_a');
            var customer_id = newRecord.id;
            var cuando = newRecord.getValue('custentity_cliente_cuando');
            var departamento = newRecord.getValue('custentity_cliente_departamento');
            var nota = newRecord.getValue('custentity_cliente_nota');

            crearAsignacionHistorial(newEmployeeId, customer_id, cuando, departamento, nota)
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

    function crearAsignacionHistorial(employeeId, customer_id, cuando, departamento, nota) {
        var asignacion_trabajo = record.create({
            type: 'customrecord_asignaciones_trabajo',
            isDynamic: true
        });
        asignacion_trabajo.setValue('custrecord_asignaciones_cliente', customer_id);
        asignacion_trabajo.setValue('custrecord_asignacion_fecha_creado', cuando);
        asignacion_trabajo.setValue('custrecord_asignacion_asignado_a', employeeId);
        asignacion_trabajo.setValue('custrecord_asignaciones_area', departamento);
        asignacion_trabajo.setValue('custrecord_asignaciones_nota', nota);

        asignacion_trabajo.save();
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
});