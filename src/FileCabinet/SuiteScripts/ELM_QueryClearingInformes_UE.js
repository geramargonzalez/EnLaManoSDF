/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/https', 'N/log', 'N/encode', 'N/runtime'], (record, https, log, encode, runtime) => {
  
  function afterSubmit(context) {
    if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) return;

    const customerRecord = record.load({
      type: context.newRecord.type,
      id: context.newRecord.id
    });

    try {
      // Obtener datos del cliente desde NetSuite
      const nombre = customerRecord.getValue('firstname') || '';
      const apellido = customerRecord.getValue('lastname') || '';
      const documento = customerRecord.getValue('custentity_sdb_nrdocumento') || ''; // Ajustar field ID
      const empresa = customerRecord.getValue('companyname') || '';
      const monto = customerRecord.getValue('') || 10000;
      const telefono = customerRecord.getValue('phone') || '';
      
      // Campos personalizados - ajustar según tu configuración
      const fechaNacimiento = customerRecord.getValue('custentity_sdb_fechanac') || '1980-01-01';
      const sexo = customerRecord.getValue('') || 'M';
      const estadoCivil = customerRecord.getValue('') || 'S';
      const direccion = customerRecord.getValue('custentity_elm_direccion') || '';
      const departamento = customerRecord.getValue('') || 'MONTEVIDEO';
      const localidad = customerRecord.getValue('') || 'MONTEVIDEO';
      const codigoPostal = customerRecord.getValue('') || '11100';
      const ocupacion = customerRecord.getValue('') || '';
      const fechaIngreso = customerRecord.getValue('custentity_elm_fecha_ingreso') || '2020-01-01';
      const plazo = customerRecord.getValue('') || 12;

      // Validar datos obligatorios
      if (!documento || !nombre || !apellido) {
        log.error('Datos insuficientes', 'Faltan datos obligatorios: documento, nombre o apellido');
        return;
      }

      // Construir XML con datos reales del cliente
      const xmlDatosEntrada = `<Experto>
  <Datos>
    <integrante>1</integrante>
    <apellido1ero>${apellido}</apellido1ero>
    <nombre1ero>${nombre}</nombre1ero>
    <documento>${documento}</documento>
    <codigo_documento>CI</codigo_documento>
    <pais_documento>UY</pais_documento>
    <fecha_nacimiento>${fechaNacimiento}</fecha_nacimiento>
    <sexo>${sexo}</sexo>
    <estado_civil>${estadoCivil}</estado_civil>
    <direccion>${direccion}</direccion>
    <departamento>${departamento}</departamento>
    <localidad>${localidad}</localidad>
    <telefonos>${telefono}</telefonos>
    <codigo_postal>${codigoPostal}</codigo_postal>
    <ocupacion>${ocupacion}</ocupacion>
    <empresa>${empresa}</empresa>
    <fecha_ingreso>${fechaIngreso}</fecha_ingreso>
    <direccion_emp>${direccion}</direccion_emp>
    <departamento_emp>${departamento}</departamento_emp>
    <localidad_emp>${localidad}</localidad_emp>
    <telefonos_emp>${telefono}</telefonos_emp>
    <codigo_postal_emp>${codigoPostal}</codigo_postal_emp>
    <moneda>$</moneda>
    <monto>${monto}</monto>
    <plazo>${plazo}</plazo>
  </Datos>
</Experto>`;

      log.debug('XML Datos Entrada', xmlDatosEntrada);

      // Obtener credenciales desde Script Parameters
      const scriptObj = runtime.getCurrentScript();
      const afiliado = scriptObj.getParameter('custscript_elm_clearing_afiliado') || '30000';
      const sucursal = scriptObj.getParameter('custscript_elm_clearing_sucursal') || '00';
      const usuario = scriptObj.getParameter('custscript_elm_clearing_usuario') || 'T_USU';
      const clave = scriptObj.getParameter('custscript_elm_clearing_clave') || 'tu_contraseña';
  const producto = scriptObj.getParameter('custscript_elm_clearing_producto') || 'CONSUMO';
  const clearingUrl = scriptObj.getParameter('custscript_elm_clearing_url') || 'https://www.clearing.com.uy/WSExperto/wsExperto.asmx';
  const soapAction = scriptObj.getParameter('custscript_elm_clearing_soapaction') || 'http://clearing.com.uy/Modelo_Prescreening';

      const soapEnvelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="http://clearing.com.uy/">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:Modelo_Prescreening>
         <afiliado>${afiliado}</afiliado>
         <sucursal>${sucursal}</sucursal>
         <usuario>${usuario}</usuario>
         <clave>${clave}</clave>
         <producto>${producto}</producto>
         <ip>255.255.255.255</ip>
         <xml>${encode.escape({
           text: xmlDatosEntrada,
           type: encode.EncodingType.XML
         })}</xml>
      </urn:Modelo_Prescreening>
   </soapenv:Body>
</soapenv:Envelope>`;

      log.debug('SOAP Envelope', soapEnvelope);

      // Realizar la consulta al Clearing
    const response = https.post({
        url: clearingUrl,
        headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      // SOAP 1.1 expects SOAPAction header, often quoted
      'SOAPAction': `"${soapAction}"`
        },
        body: soapEnvelope
      });

      log.audit('Clearing Response Code', response.code);
      log.audit('Clearing Response Body', response.body);

      // Procesar la respuesta
      if (response.code === 200) {
        processResponse(customerRecord, response.body, context.newRecord.id);
      } else {
        log.error('Error en consulta Clearing', `Código de respuesta: ${response.code}, Body: ${response.body}`);
        
        // Marcar el registro con error
        record.submitFields({
          type: context.newRecord.type,
          id: context.newRecord.id,
          values: {
            'custentity_elm_clearing_status': 'ERROR',
            'custentity_elm_clearing_error': `Error ${response.code}: ${response.body}`
          }
        });
      }

    } catch (error) {
      log.error('Error al ejecutar consulta al Clearing', error);
      
      // Marcar el registro con error
      try {
        record.submitFields({
          type: context.newRecord.type,
          id: context.newRecord.id,
          values: {
            'custentity_elm_clearing_status': 'ERROR',
            'custentity_elm_clearing_error': error.message
          }
        });
      } catch (updateError) {
        log.error('Error al actualizar registro con error', updateError);
      }
    }
  }

  /**
   * Procesa la respuesta del Clearing y actualiza el registro del cliente
   * @param {Object} customerRecord - Registro del cliente
   * @param {string} responseBody - Respuesta XML del Clearing
   * @param {number} recordId - ID del registro
   */
  function processResponse(customerRecord, responseBody, recordId) {
    try {
      log.debug('Processing Response', responseBody);
      
      // Estado y datos por defecto
      let status = 'PROCESADO';
      let resultado = '';
      let score = '';

      // 1) Detectar Fault SOAP
  const faultRe = /<\w*:Fault>[\s\S]*?<faultstring>([\s\S]*?)<\/faultstring>[\s\S]*?<\/\w*:Fault>/i;
  const faultMatch = faultRe.exec(responseBody);
      if (faultMatch) {
        status = 'ERROR';
        // Reducir el tamaño del mensaje por seguridad
        const faultMsg = faultMatch[1].trim().substring(0, 500);
        safeUpdate(customerRecord.type, recordId, {
          'custentity_elm_clearing_status': status,
          'custentity_elm_clearing_error': `SOAP Fault: ${faultMsg}`,
          'custentity_elm_clearing_response': responseBody.substring(0, 3999),
          'custentity_elm_clearing_fecha': new Date()
        });
        return;
      }

      // 2) Extraer el XML resultado interno si viene escapado dentro de <Modelo_PrescreeningResult>
      let innerXml = '';
  const resultNodeRe = /<Modelo_PrescreeningResult>([\s\S]*?)<\/Modelo_PrescreeningResult>/i;
  const resultNodeMatch = resultNodeRe.exec(responseBody);
      if (resultNodeMatch) {
        innerXml = decodeXmlEntities(resultNodeMatch[1]);
      }

      const sourceToParse = innerXml || responseBody;

      // 3) Intentar extraer campos de negocio
  const resultadoRe = /<resultado>(.*?)<\/resultado>/i;
  const resultadoMatch = resultadoRe.exec(sourceToParse);
      if (resultadoMatch) resultado = resultadoMatch[1];

  const scoreRe = /<score>(.*?)<\/score>/i;
  const scoreMatch = scoreRe.exec(sourceToParse);
      if (scoreMatch) score = scoreMatch[1];

      // 4) Determinar estado básico si el servicio devuelve etiquetas comunes
      if (/\b(APROBADO)\b/i.test(sourceToParse)) {
        status = 'APROBADO';
      } else if (/\b(RECHAZADO)\b/i.test(sourceToParse)) {
        status = 'RECHAZADO';
      } else if (/\b(ERROR)\b/i.test(sourceToParse)) {
        status = 'ERROR';
      }

      // Actualizar el registro del cliente con los resultados
      safeUpdate(customerRecord.type, recordId, {
        'custentity_elm_clearing_status': status,
        'custentity_elm_clearing_resultado': resultado,
        'custentity_elm_clearing_score': score,
        'custentity_elm_clearing_fecha': new Date(),
        'custentity_elm_clearing_response': (innerXml || responseBody).substring(0, 3999)
      });

      log.audit('Clearing Result Updated', {
        recordId: recordId,
        status: status,
        resultado: resultado,
        score: score
      });

    } catch (error) {
      log.error('Error procesando respuesta del Clearing', error);
    }
  }

  // Decodificar entidades XML comunes (&lt; &gt; &amp; &quot; &apos;)
  function decodeXmlEntities(str) {
    if (!str) return '';
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  // Wrapper seguro para submitFields
  function safeUpdate(type, id, values) {
    try {
      record.submitFields({ type: type, id: id, values: values });
    } catch (e) {
      log.error('safeUpdate failed', e);
    }
  }

  return {
    afterSubmit
  };
});
