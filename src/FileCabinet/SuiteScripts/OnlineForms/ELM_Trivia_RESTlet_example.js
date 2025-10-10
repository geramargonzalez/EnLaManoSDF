/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define(['N/record'], (record) => {
  /**
   * Maneja POST desde el fetch del formulario de la trivia.
   * Espera cuerpo JSON con: { nombre, apellido, cedula, telefono, puntaje }
   */
  const post = (body) => {
    try {
      const data = typeof body === 'string' ? JSON.parse(body || '{}') : (body || {});
      const required = ['nombre', 'apellido', 'cedula', 'telefono', 'puntaje'];
      for (const f of required) {
        if (data[f] == null || data[f] === '') {
          return { success: false, message: `Falta el campo obligatorio: ${f}` };
        }
      }

      const rec = record.create({ type: 'customrecord_trivia', isDynamic: true });
      rec.setValue({ fieldId: 'custrecord_nombre', value: String(data.nombre).substring(0, 120) });
      rec.setValue({ fieldId: 'custrecord_apellido', value: String(data.apellido).substring(0, 120) });
      rec.setValue({ fieldId: 'custrecord_cedula', value: String(data.cedula).substring(0, 120) });
      rec.setValue({ fieldId: 'custrecord_telefono', value: String(data.telefono).substring(0, 120) });
      rec.setValue({ fieldId: 'custrecord_puntaje', value: Number(data.puntaje) || 0 });

      const id = rec.save({ enableSourcing: true, ignoreMandatoryFields: false });
      return { success: true, id };
    } catch (e) {
      return { success: false, message: e && e.message ? e.message : 'Error interno' };
    }
  };

  return { post };
});

