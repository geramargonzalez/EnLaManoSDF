/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/email', 'N/format', 'N/log'], function (search, email, format, log) {

  const DIAS_HISTORICOS = 30;
  const RECIPIENTES_ALERTA = ['tucorreo@empresa.com'];

  function getInputData() {
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - DIAS_HISTORICOS);
    const fechaInicioStr = format.format({ value: fechaInicio, type: format.Type.DATE });

    const canalSearch = search.create({
      type: search.Type.CUSTOMER,
      filters: [
        ['status', 'anyof', 'LEAD'],
        'AND', ['createddate', 'onorafter', fechaInicioStr]
      ],
      columns: [
        search.createColumn({ name: 'custentity_canal_ingreso', summary: 'GROUP' })
      ]
    });

    const canales = [];
    canalSearch.run().each(function (result) {
      const canal = result.getValue({ name: 'custentity_canal_ingreso', summary: 'GROUP' });
      if (canal) canales.push(canal);
      return true;
    });

    return canales;
  }

  function map(context) {
    const canal = context.value;
    const ahora = new Date();
    const hoyStr = format.format({ value: ahora, type: format.Type.DATE });

    const horaActual = ahora.getHours();
    const minutosActual = ahora.getMinutes();

    const fechaInicio = new Date(ahora);
    fechaInicio.setDate(fechaInicio.getDate() - DIAS_HISTORICOS);
    const fechaInicioStr = format.format({ value: fechaInicio, type: format.Type.DATE });

    const mapaDias = {}; // { '2025-07-14': count }

    // Leads históricos (últimos 30 días, canal, hasta hora actual)
    const historicoSearch = search.create({
      type: search.Type.CUSTOMER,
      filters: [
        ['status', 'anyof', 'LEAD'], 'AND',
        ['createddate', 'onorafter', fechaInicioStr], 'AND',
        ['createddate', 'onorbefore', hoyStr], 'AND',
        ['custentity_canal_ingreso', 'is', canal]
      ],
      columns: ['internalid', 'created']
    });

    historicoSearch.run().each(function (result) {
      const fechaObj = new Date(result.getValue('created'));
      const fechaStr = format.format({ value: fechaObj, type: format.Type.DATE });

      const hora = fechaObj.getHours();
      const minutos = fechaObj.getMinutes();

      const antes = hora < horaActual || (hora === horaActual && minutos <= minutosActual);

      if (antes) {
        mapaDias[fechaStr] = (mapaDias[fechaStr] || 0) + 1;
      }

      return true;
    });

    const valores = Object.values(mapaDias).sort((a, b) => a - b);
    const percentil25 = calcularPercentil(valores, 25);

    // Leads de hoy hasta la hora actual
    const hoySearch = search.create({
      type: search.Type.CUSTOMER,
      filters: [
        ['status', 'anyof', 'LEAD'], 'AND',
        ['createddate', 'onor', hoyStr], 'AND',
        ['custentity_canal_ingreso', 'is', canal]
      ],
      columns: ['internalid', 'created']
    });

    let leadsHoy = 0;
    hoySearch.run().each(function (result) {
      const fechaObj = new Date(result.getValue('created'));
      const hora = fechaObj.getHours();
      const minutos = fechaObj.getMinutes();

      const antes = hora < horaActual || (hora === horaActual && minutos <= minutosActual);
      if (antes) leadsHoy++;

      return true;
    });

    context.write({
      key: canal,
      value: JSON.stringify({
        canal,
        leadsHoy,
        percentil25
      })
    });
  }

  function reduce(context) {
    const data = JSON.parse(context.values[0]);
    const { canal, leadsHoy, percentil25 } = data;

    if (leadsHoy < percentil25) {
      const mensaje = `⚠️ Baja performance para canal "${canal}"\nLeads hoy: ${leadsHoy}\nPercentil 25 histórico a esta hora: ${percentil25.toFixed(2)}`;

      email.send({
        author: -5,
        recipients: RECIPIENTES_ALERTA,
        subject: `[ALERTA] Canal con baja performance - "${canal}"`,
        body: mensaje
      });

      log.audit('Alerta enviada', mensaje);
    } else {
      log.audit(`Canal OK`, `${canal}: ${leadsHoy} leads >= P25 (${percentil25.toFixed(2)})`);
    }
  }

  /**
   * Calcula percentil interpolado como Excel / estadísticas
   * @param {number[]} valores Ordenados de menor a mayor
   * @param {number} percentil Número entre 0 y 100
   * @returns {number}
   */
  function calcularPercentil(valores, percentil) {
    if (!valores || valores.length === 0) return 0;

    const n = valores.length;
    const rank = (percentil / 100) * (n + 1);

    const k = Math.floor(rank);
    const d = rank - k;

    if (k <= 0) return valores[0];
    if (k >= n) return valores[n - 1];

    const valorK = valores[k - 1];
    const valorK1 = valores[k] || valorK;

    return valorK + d * (valorK1 - valorK);
  }

  return {
    getInputData,
    map,
    reduce
  };
});
