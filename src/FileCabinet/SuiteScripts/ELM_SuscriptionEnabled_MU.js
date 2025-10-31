/**
 * @NApiVersion 2.1
 * @NScriptType MassUpdateScript
 */
define(['N/record'], (record) => {

  function each(context) {
    const leadId = context.id;
    try {
      const rec = record.load({
        type: record.Type.LEAD,
        id: leadId,
        isDynamic: true
      });
      const globalsubscriptionstatus = rec.getValue({ fieldId: 'globalsubscriptionstatus' });
      if (globalsubscriptionstatus == '2') {
        log.audit('Omitido', `Lead ${leadId} está UNSUBSCRIBED globalmente`);
        rec.setValue({
          fieldId: 'globalsubscriptionstatus',
          value: 1
      });
      }

      const lineCount = rec.getLineCount({ sublistId: 'subscriptions' });
      for (let i = 0; i < lineCount; i++) {
        const subName = rec.getSublistText({ sublistId: 'subscriptions', fieldId: 'subscription', line: i });
        if (subName && subName.toLowerCase().includes('boletines')) {
          rec.selectLine({ sublistId: 'subscriptions', line: i });
          rec.setCurrentSublistValue({ sublistId: 'subscriptions', fieldId: 'subscribed', value: true });
          rec.commitLine({ sublistId: 'subscriptions' });
          log.audit('Actualizado', `Lead ${leadId} → Boletines=Yes`);
        }
      }
      rec.save({ ignoreMandatoryFields: true });
    } catch (e) {
      log.error('Error en lead ' + leadId, e);
    }
  }

  return { each };
});
