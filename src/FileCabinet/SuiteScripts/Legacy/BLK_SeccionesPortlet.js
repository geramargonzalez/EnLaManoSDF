/**
 * @NApiVersion 2.x
 * @NScriptType Portlet
 */
define(['N/log', 'N/record', 'N/search', 'N/ui/serverWidget'], function (log, record, search, serverWidget) {

    function render(params) {

        var customer = record.load({
            type: record.Type.CUSTOMER,
            id: 50629,
            isDynamic: true,
        });

        var email = customer.getValue('email');

        params.portlet.title = 'Test Title',
        params.portlet.html = '<html><body><h1>' + email + '</h1></body></html>';

    }

    return {
        render: render
    };

});
