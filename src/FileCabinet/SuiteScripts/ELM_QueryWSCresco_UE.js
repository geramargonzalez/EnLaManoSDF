/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @description Script para conectarse al servicio WSCreditScoring - Actualizado según documentación oficial
 * @version 2.0
 * @author EnLaMano Development Team
 */

define(['N/record', 'N/https', 'N/log', 'N/encode', 'N/runtime', 'N/format'], (record, https, log, encode, runtime, format) => {
  
  function afterSubmit(context) {
    if (!isCreateOrEdit(context)) return;
    const customerRecord = loadCustomer(context);
    if (shouldSkipProcessing(context, customerRecord)) return;
    executeScoring(context, customerRecord);
  }

  function executeScoring(context, customerRecord) {
    try {
      const coreData = collectCoreData(customerRecord);
      if (!validateMandatory(coreData, context)) return;
      const fechaNacFormatted = formatBirthDate(coreData.fechaNacimiento);
      const payload = buildXmlPayload(coreData, fechaNacFormatted);
      const xmlRequest = buildWSCreditScoringXML(payload);
      log.debug('WSCreditScoring XML Request', xmlRequest);
      const cfg = loadConfig();
      const wsCreditScoringUrl = resolveUrl(cfg);
      logConfig(cfg, wsCreditScoringUrl);
      const postStr = buildSoapEnvelope(cfg, xmlRequest);
      log.debug('WSCreditScoring SOAP Envelope', postStr);
      const headers = buildHeaders(cfg, postStr);
      const response = doRequest(wsCreditScoringUrl, headers, postStr);
      handleHttpResponse(response, customerRecord, context, cfg.isTestMode);
    } catch (error) {
      log.error('WSCreditScoring - Error al ejecutar consulta', error);
      log.audit('Error Details', 'The call to the WSCreditScoring web service was not made properly.');
      markRecordWithError(context.newRecord.type, context.newRecord.id, 'SCRIPT_ERROR', 'Error en script: ' + error.message);
    }
  }

  // Helpers segregados para reducir complejidad de afterSubmit
  function isCreateOrEdit(context) {
    return context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT;
  }

  function loadCustomer(context) {
    return record.load({ type: context.newRecord.type, id: context.newRecord.id });
  }

  function shouldSkipProcessing(context, customerRecord) {
    if (context.type !== context.UserEventType.EDIT) return false;
    try {
      const prevStatus = customerRecord.getValue('custentity_elm_wscresco_status');
      if (prevStatus && prevStatus !== 'ERROR') {
        log.debug('WSCreditScoring - Skip', 'Registro ya procesado (status=' + prevStatus + ').');
        return true;
      }
    } catch (e) {
      log.debug('Skip guard error (continuando)', e);
    }
    return false;
  }

  function collectCoreData(customerRecord) {
    return {
      nombre: customerRecord.getValue('firstname') || '',
      apellido: customerRecord.getValue('lastname') || '',
      documento: customerRecord.getValue('custentity_sdb_nrdocumento') || '',
      telefono: customerRecord.getValue('phone') || '',
      email: customerRecord.getValue('email') || '',
      monto: customerRecord.getValue('custentity_sdb_montosolicitado') || 0,
      fechaNacimiento: customerRecord.getValue('custentity_sdb_fechanac'),
      sexo: customerRecord.getValue('custentity_sdb_personasexo') || 'M',
      estadoCivil: customerRecord.getValue('custentity_sdb_estado_civil') || 'S',
      direccion: customerRecord.getValue('custentity_elm_direccion') || '',
      departamento: customerRecord.getValue('custentity_elm_departamento') || '',
      localidad: customerRecord.getValue('custentity_elm_departamento') || '',
      ingresos: customerRecord.getValue('custentity_sdb_infolab_importe') || 0,
      empresa: customerRecord.getValue('companyname') || '',
      ocupacion: customerRecord.getValue('custentity_elm_ocupacion') || '',
      antiguedadLaboral: customerRecord.getValue('custentity_elm_fecha_ingreso'),
      tipoDocumento: 'CI',
      nacionalidad: customerRecord.getValue('custentity_elm_nacionalidad') || 'UY',
      plazoSolicitado: customerRecord.getValue('custentity_elm_plazo_solicitado') || 12,
      destinoCredito: customerRecord.getValue('custentity_elm_destino_credito') || 'CONSUMO'
    };
  }

  function validateMandatory(data, context) {
    if (!data.documento || !data.nombre || !data.apellido || !data.fechaNacimiento) {
      log.error('WSCreditScoring - Datos insuficientes', 'Faltan datos obligatorios: documento, nombre, apellido o fecha de nacimiento');
      markRecordWithError(context.newRecord.type, context.newRecord.id, 'DATOS_INSUFICIENTES', 'Faltan campos obligatorios para scoring');
      return false;
    }
    return true;
  }

  function formatBirthDate(fechaNacimiento) {
    if (!fechaNacimiento) return '';
    const date = new Date(fechaNacimiento);
    const isoDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return isoDate.toISOString().split('T')[0];
  }

  function buildXmlPayload(data, fechaNacFormatted) {
    return {
      tipoDocumento: data.tipoDocumento,
      numeroDocumento: data.documento,
      paisDocumento: data.nacionalidad,
      nombres: data.nombre,
      apellidos: data.apellido,
      fechaNacimiento: fechaNacFormatted,
      sexo: data.sexo,
      estadoCivil: data.estadoCivil,
      nacionalidad: data.nacionalidad,
      direccion: data.direccion,
      departamento: data.departamento,
      localidad: data.localidad,
      telefono: data.telefono,
      email: data.email,
      ingresos: data.ingresos,
      empresa: data.empresa,
      ocupacion: data.ocupacion,
      antiguedadLaboral: data.antiguedadLaboral,
      montoSolicitado: data.monto,
      plazoSolicitado: data.plazoSolicitado,
      destinoCredito: data.destinoCredito
    };
  }

  function loadConfig() {
    const scriptObj = runtime.getCurrentScript();
    return {
      usuario: scriptObj.getParameter('custscript_elm_wscresco_usuario') || '',
      password: scriptObj.getParameter('custscript_elm_wscresco_password') || '',
      institucion: scriptObj.getParameter('custscript_elm_wscresco_institucion') || '',
      apiKey: scriptObj.getParameter('custscript_elm_wscresco_api_key') || '',
      versionApi: scriptObj.getParameter('custscript_elm_wscresco_version') || '2.0',
      isTestMode: scriptObj.getParameter('custscript_elm_wscresco_test_mode') === 'T',
      soapActionParam: scriptObj.getParameter('custscript_elm_wscresco_soap_action') || '',
      testUrl: scriptObj.getParameter('custscript_elm_wscresco_test_url'),
      prodUrl: scriptObj.getParameter('custscript_elm_wscresco_prod_url')
    };
  }

  function resolveUrl(cfg) {
    const internalDefaultUrl = 'http://192.168.4.10/creditscoring/aWSCresoEnLaManoV1.aspx';
    return internalDefaultUrl;
  }

  function mask(val) {
    if (!val) return '';
    if (val.length <= 4) return '***';
    return val.substring(0,2) + '***' + val.substring(val.length-2);
  }

  function logConfig(cfg, url) {
    log.debug('WSCreditScoring Configuration', {
      testMode: cfg.isTestMode,
      url: url,
      usuario: mask(cfg.usuario),
      institucion: cfg.institucion,
      version: cfg.versionApi,
      soapActionParam: cfg.soapActionParam || '(default)'
    });
  }

  function buildSoapEnvelope(cfg, xmlRequest) {
    return '<?xml version="1.0" encoding="utf-8"?>'
      + '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
      + 'xmlns:xsd="http://www.w3.org/2001/XMLSchema" '
      + 'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
      + '<soap:Header>'
      + '<Authentication xmlns="http://creditscoring.com.uy/webservices/">'
      + '<Usuario>' + escapeXmlValue(cfg.usuario) + '</Usuario>'
      + '<Password>' + escapeXmlValue(cfg.password) + '</Password>'
      + '<Institucion>' + escapeXmlValue(cfg.institucion) + '</Institucion>'
      + '<ApiKey>' + escapeXmlValue(cfg.apiKey) + '</ApiKey>'
      + '<Version>' + escapeXmlValue(cfg.versionApi) + '</Version>'
      + '</Authentication>'
      + '</soap:Header>'
      + '<soap:Body>'
      + '<ConsultaScoring xmlns="http://creditscoring.com.uy/webservices/">'
      + '<DatosConsulta><![CDATA[' + xmlRequest + ']]></DatosConsulta>'
      + '</ConsultaScoring>'
      + '</soap:Body>'
      + '</soap:Envelope>';
  }

  function buildHeaders(cfg, postStr) {
    const headers = {};
    headers['Content-Type'] = 'text/xml; charset=utf-8';
    headers['Content-Length'] = postStr.length;
    const effectiveSoapAction = cfg.soapActionParam
    headers['SOAPAction'] = effectiveSoapAction;
    headers['SoapAction'] = effectiveSoapAction;
    headers['Accept'] = 'text/xml, application/xml';
    headers['User-Agent'] = 'NetSuite-WSCreditScoring-Client/2.0';
    if (cfg.apiKey) headers['Authorization'] = 'Bearer ' + cfg.apiKey;
    return headers;
  }

  function doRequest(url, headers, body) {
    const response = https.request({ method: https.Method.POST, url: url, headers: headers, body: body });
    log.audit('WSCreditScoring Response Code', response.code);
    log.audit('WSCreditScoring Response Headers', response.headers);
    log.audit('WSCreditScoring Response Body', response.body);
    log.debug('WSCreditScoring Full Response', JSON.stringify(response));
    return response;
  }
  /**
   * Función auxiliar para marcar registros con error
   * @param {string} recordType - Tipo de registro
   * @param {number} customerRecord - ID del registro
   * @param {string} context - Contexto de la solicitud
   * @param {boolean} isTestMode - Modo de prueba
   */
  function handleHttpResponse(response, customerRecord, context, isTestMode) {
    const code = String(response.code);
    switch (code) {
      case '200':
        processWSCreditScoringResponse(customerRecord, response.body, context.newRecord.id, isTestMode);
        break;
      case '401':
        log.error('WSCreditScoring - Error de autenticación', 'Credenciales inválidas. Código: ' + code);
        markRecordWithError(customerRecord.type, context.newRecord.id, 'AUTENTICACION_ERROR', 'Credenciales inválidas para WSCreditScoring');
        break;
      case '429':
        log.error('WSCreditScoring - Rate limit excedido', 'Demasiadas consultas. Código: ' + code);
        markRecordWithError(customerRecord.type, context.newRecord.id, 'RATE_LIMIT_ERROR', 'Límite de consultas excedido');
        break;
      case '500':
        log.error('WSCreditScoring - Error interno del servidor', 'Error del servidor. Código: ' + code);
        markRecordWithError(customerRecord.type, context.newRecord.id, 'SERVER_ERROR', 'Error interno del servidor de WSCreditScoring');
        break;
      default:
        log.error('WSCreditScoring - Error en consulta', 'Código de respuesta: ' + code + ', Body: ' + response.body);
        markRecordWithError(customerRecord.type, context.newRecord.id, 'HTTP_ERROR', 'Error ' + code + ': ' + (response.body ? response.body.substring(0,200) : 'Sin contenido'));
        break;
    }
  }

  /**
   * Función auxiliar para marcar registros con error
   * @param {string} recordType - Tipo de registro
   * @param {number} recordId - ID del registro
   * @param {string} errorCode - Código de error
   * @param {string} errorMessage - Mensaje de error
   */
  function markRecordWithError(recordType, recordId, errorCode, errorMessage) {
    try {
      record.submitFields({
        type: recordType,
        id: recordId,
        values: {
          'custentity_elm_wscresco_status': 'ERROR',
          'custentity_elm_wscresco_error_code': errorCode,
          'custentity_elm_wscresco_error': errorMessage,
          'custentity_elm_wscresco_fecha': new Date()
        }
      });
    } catch (e) {
      log.error('Error al marcar registro con error', e);
    }
  }

  /**
   * Construye el XML específico para WSCreditScoring v2.0
   * @param {Object} data - Datos del cliente
   * @returns {string} XML formateado para WSCreditScoring
   */
  function buildWSCreditScoringXML(data) {
    // Generar ID único para la consulta
    const consultaId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    return `<ConsultaScoring>
  <Solicitud>
    <Id>${consultaId}</Id>
    <FechaSolicitud>${new Date().toISOString()}</FechaSolicitud>
    <TipoConsulta>SCORING_COMPLETO</TipoConsulta>
    <Canal>NETSUITE</Canal>
  </Solicitud>
  <Solicitante>
    <Identificacion>
      <TipoDocumento>${data.tipoDocumento}</TipoDocumento>
      <NumeroDocumento>${data.numeroDocumento}</NumeroDocumento>
      <PaisEmision>${data.paisDocumento}</PaisEmision>
    </Identificacion>
    <DatosPersonales>
      <Nombres>${escapeXmlValue(data.nombres)}</Nombres>
      <Apellidos>${escapeXmlValue(data.apellidos)}</Apellidos>
      <FechaNacimiento>${data.fechaNacimiento}</FechaNacimiento>
      <Sexo>${data.sexo}</Sexo>
      <EstadoCivil>${data.estadoCivil}</EstadoCivil>
      <Nacionalidad>${data.nacionalidad}</Nacionalidad>
    </DatosPersonales>
    <Contacto>
      <Direccion>${escapeXmlValue(data.direccion)}</Direccion>
      <Departamento>${escapeXmlValue(data.departamento)}</Departamento>
      <Localidad>${escapeXmlValue(data.localidad)}</Localidad>
      <Telefono>${data.telefono}</Telefono>
      <Email>${data.email}</Email>
    </Contacto>
    <DatosLaborales>
      <Empresa>${escapeXmlValue(data.empresa)}</Empresa>
      <Ocupacion>${escapeXmlValue(data.ocupacion)}</Ocupacion>
      <IngresosMensuales>${data.ingresos}</IngresosMensuales>
      <AntiguedadMeses>${data.antiguedadLaboral}</AntiguedadMeses>
      <TipoContrato>PERMANENTE</TipoContrato>
    </DatosLaborales>
  </Solicitante>
  <ProductoSolicitado>
    <TipoProducto>PRESTAMO_PERSONAL</TipoProducto>
    <MontoSolicitado>${data.montoSolicitado}</MontoSolicitado>
    <PlazoSolicitado>${data.plazoSolicitado}</PlazoSolicitado>
    <Moneda>UYU</Moneda>
    <DestinoCredito>${data.destinoCredito}</DestinoCredito>
    <FinalidadPrestamo>CONSUMO</FinalidadPrestamo>
  </ProductoSolicitado>
  <ParametrosConsulta>
    <IncluirHistorialBCU>true</IncluirHistorialBCU>
    <IncluirDetalleCalificacion>true</IncluirDetalleCalificacion>
    <IncluirRecomendacion>true</IncluirRecomendacion>
    <IncluirSimulacionCuotas>true</IncluirSimulacionCuotas>
    <ValidarListasNegras>true</ValidarListasNegras>
    <GenerarReporteCompleto>true</GenerarReporteCompleto>
  </ParametrosConsulta>
</ConsultaScoring>`;
  }

  /**
   * Escapa caracteres especiales para XML
   * @param {string} value - Valor a escapar
   * @returns {string} Valor escapado
   */
  function escapeXmlValue(value) {
    if (!value) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Procesa la respuesta del WSCreditScoring v2.0 y actualiza el registro del cliente
   * @param {Object} customerRecord - Registro del cliente
   * @param {string} responseBody - Respuesta XML del WSCreditScoring
   * @param {number} recordId - ID del registro
   * @param {boolean} isTestMode - Indica si está en modo de testing
   */
  function processWSCreditScoringResponse(customerRecord, responseBody, recordId, isTestMode) {
    try {
      log.debug('Processing WSCreditScoring Response', responseBody);
      
      // Verificar errores SOAP primero
      if (handleSoapFaults(responseBody, customerRecord.type, recordId)) {
        return;
      }
      
      // Procesar respuesta válida
      processValidResponse(customerRecord.type, recordId, responseBody, isTestMode);

    } catch (error) {
      log.error('Error procesando respuesta del WSCreditScoring', error);
      markRecordWithError(customerRecord.type, recordId, 'PROCESSING_ERROR', 
        `Error procesando respuesta: ${error.message}`);
    }
  }

  /**
   * Procesa una respuesta válida (sin errores SOAP)
   * @param {string} recordType - Tipo de registro
   * @param {number} recordId - ID del registro
   * @param {string} responseBody - Cuerpo de la respuesta
   * @param {boolean} isTestMode - Modo de prueba
   */
  function processValidResponse(recordType, recordId, responseBody, isTestMode) {
    const responseData = extractResponseData(responseBody);
    const finalStatus = determineFinalStatus(responseBody, responseData.recomendacion);
    
    updateCustomerRecord(recordType, recordId, responseData, finalStatus, isTestMode, responseBody);
    logProcessingResult(recordId, responseData, finalStatus);
  }

  /**
   * Maneja errores SOAP en la respuesta
   * @param {string} responseBody - Cuerpo de la respuesta
   * @param {string} recordType - Tipo de registro
   * @param {number} recordId - ID del registro
   * @returns {boolean} true si hay error SOAP, false si no
   */
  function handleSoapFaults(responseBody, recordType, recordId) {
    const soapFaultRe = /<\w*:?Fault>[\s\S]*?<faultstring>([\s\S]*?)<\/faultstring>/i;
    const soapFaultMatch = soapFaultRe.exec(responseBody);
    
    if (soapFaultMatch) {
      log.error('SOAP Fault detectado', soapFaultMatch[1]);
      markRecordWithError(recordType, recordId, 'SOAP_FAULT', 
        `SOAP Fault: ${soapFaultMatch[1].trim()}`);
      return true;
    }
    return false;
  }

  /**
   * Extrae todos los datos relevantes de la respuesta XML
   * @param {string} responseBody - Cuerpo de la respuesta XML
   * @returns {Object} Objeto con todos los datos extraídos
   */
  function extractResponseData(responseBody) {
    const extractField = (fieldName) => {
      const regex = new RegExp(`<${fieldName}>(.*?)<\\/${fieldName}>`, 'i');
      const match = regex.exec(responseBody);
      return match ? match[1] : '';
    };

    return {
      consultaId: extractField('ConsultaId'),
      score: extractField('ScoreFinal'),
      nivelRiesgo: extractField('NivelRiesgo'),
      recomendacion: extractField('RecomendacionFinal'),
      montoRecomendado: extractField('MontoRecomendado'),
      plazoRecomendado: extractField('PlazoRecomendado'),
      tasaRecomendada: extractField('TasaRecomendada'),
      motivoRechazo: extractField('MotivoRechazo'),
      calificacionBCU: extractField('CalificacionBCU'),
      resultadoListasNegras: extractField('ResultadoListasNegras'),
      detalleRespuesta: (() => {
        const detalleRe = /<DetalleConsulta>(.*?)<\/DetalleConsulta>/is;
        const match = detalleRe.exec(responseBody);
        return match ? match[1] : '';
      })()
    };
  }

  /**
   * Determina el estado final basado en la respuesta
   * @param {string} responseBody - Cuerpo de la respuesta
   * @param {string} recomendacion - Recomendación extraída
   * @returns {string} Estado final
   */
  function determineFinalStatus(responseBody, recomendacion) {
    if (responseBody.includes('<Error>') || responseBody.includes('<ErrorCode>')) {
      return 'ERROR';
    }
    
    if (!recomendacion) return 'PROCESADO';
    
    const recUpper = recomendacion.toUpperCase();
    if (recUpper.includes('APROBAR') || recUpper.includes('OTORGAR') || recUpper.includes('CONCEDER')) {
      return 'APROBADO';
    }
    if (recUpper.includes('RECHAZAR') || recUpper.includes('DENEGAR') || recUpper.includes('NO_OTORGAR')) {
      return 'RECHAZADO';
    }
    if (recUpper.includes('REVISAR') || recUpper.includes('ANALIZAR') || recUpper.includes('MANUAL')) {
      return 'REVISION_MANUAL';
    }
    if (recUpper.includes('CONDICIONAL') || recUpper.includes('CON_CONDICIONES')) {
      return 'APROBADO_CONDICIONAL';
    }
    
    return 'PROCESADO';
  }

  /**
   * Actualiza el registro del cliente con los datos extraídos
   * @param {string} recordType - Tipo de registro
   * @param {number} recordId - ID del registro
   * @param {Object} responseData - Datos extraídos de la respuesta
   * @param {string} finalStatus - Estado final determinado
   * @param {boolean} isTestMode - Modo de prueba
   * @param {string} responseBody - Cuerpo completo de la respuesta
   */
  function updateCustomerRecord(recordType, recordId, responseData, finalStatus, isTestMode, responseBody) {
    const updateValues = {
      'custentity_elm_wscresco_status': finalStatus,
      'custentity_elm_wscresco_consulta_id': responseData.consultaId,
      'custentity_elm_wscresco_score': responseData.score,
      'custentity_elm_wscresco_riesgo': responseData.nivelRiesgo,
      'custentity_elm_wscresco_recomendacion': responseData.recomendacion,
      'custentity_elm_wscresco_fecha': new Date(),
      'custentity_elm_wscresco_test_mode': isTestMode,
      'custentity_elm_wscresco_calificacion_bcu': responseData.calificacionBCU,
      'custentity_elm_wscresco_response': responseBody.substring(0, 3999)
    };

    // Agregar campos numéricos solo si son válidos
    addNumericFieldIfValid(updateValues, 'custentity_elm_wscresco_monto_rec', responseData.montoRecomendado);
    addNumericFieldIfValid(updateValues, 'custentity_elm_wscresco_plazo_rec', responseData.plazoRecomendado, true);
    addNumericFieldIfValid(updateValues, 'custentity_elm_wscresco_tasa_rec', responseData.tasaRecomendada);
    
    // Agregar campos de texto si tienen contenido
    if (responseData.motivoRechazo) {
      updateValues['custentity_elm_wscresco_motivo_rechazo'] = responseData.motivoRechazo.substring(0, 999);
    }
    if (responseData.resultadoListasNegras) {
      updateValues['custentity_elm_wscresco_listas_negras'] = responseData.resultadoListasNegras;
    }
    if (responseData.detalleRespuesta) {
      updateValues['custentity_elm_wscresco_detalle'] = responseData.detalleRespuesta.substring(0, 3999);
    }

    record.submitFields({
      type: recordType,
      id: recordId,
      values: updateValues
    });
  }

  /**
   * Agrega un campo numérico al objeto de actualización si es válido
   * @param {Object} updateValues - Objeto de valores a actualizar
   * @param {string} fieldName - Nombre del campo
   * @param {string} value - Valor a validar
   * @param {boolean} isInteger - Si debe ser entero
   */
  function addNumericFieldIfValid(updateValues, fieldName, value, isInteger = false) {
    if (!value) return;
    
    const numValue = isInteger ? parseInt(value) : parseFloat(value);
    if (!isNaN(numValue)) {
      updateValues[fieldName] = numValue;
    }
  }

  /**
   * Registra el resultado del procesamiento en el log de auditoría
   * @param {number} recordId - ID del registro
   * @param {Object} responseData - Datos de la respuesta
   * @param {string} finalStatus - Estado final
   */
  function logProcessingResult(recordId, responseData, finalStatus) {
    log.audit('WSCreditScoring Result Updated', {
      recordId: recordId,
      consultaId: responseData.consultaId,
      status: finalStatus,
      score: responseData.score,
      riesgo: responseData.nivelRiesgo,
      recomendacion: responseData.recomendacion,
      montoRecomendado: responseData.montoRecomendado
    });
  }

  return {
    afterSubmit
  };
});
