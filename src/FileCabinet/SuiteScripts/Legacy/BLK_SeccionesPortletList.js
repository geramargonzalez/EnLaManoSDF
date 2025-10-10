/**
 * @NApiVersion 2.x
 * @NScriptType Portlet
 */
define(['N/log', 'N/search', 'N/runtime', 'N/record'], function (log, search, runtime, record) {

    const BANDEJA_RECORD_TYPE = 'customrecord_blk_bandeja';

    function render(params) {
        try {

            var scriptObj = runtime.getCurrentScript();
            var bandeja_id = scriptObj.getParameter({name: 'custscript_blk_bandeja'});
            
            var bandeja = record.load({
                type: BANDEJA_RECORD_TYPE,
                id: bandeja_id,
                isDynamic: true,
            });

            var ss_id = bandeja.getValue('custrecord_blk_ss_id')
            var agregar_filtro_usuario = bandeja.getValue('custrecord_blk_agregar_filtro_usuario')

            log.error('--------------', '--------------------------------------------------');
            log.error('ss_id', ss_id);
            log.error('agregar_filtro_usuario', agregar_filtro_usuario);

            var userObj = runtime.getCurrentUser();

            var mySearch = search.load({
                id: ss_id
            });

            if (agregar_filtro_usuario) {
                var filters = mySearch.filters;

                var campo_id = bandeja.getValue('custrecord_blk_campo_id');

                var employeeId = userObj.id;

                filters[filters.length] = search.createFilter({
                    name: campo_id,
                    operator: search.Operator.ANYOF,
                    values: 50938 //employeeId
                })
            }

            var resultCount = mySearch.runPaged({
                pageSize: 50
            }).count;
            log.error('resultCount', resultCount);

            var searchResult = mySearch.run().getRange({
                start: 0,
                end: 25
            });

            params.portlet.title = bandeja.getValue('name') + ' (' + resultCount + ')'

            for (var i = 0; i < searchResult.length; i++) {
                
                if (i == 0) {
                    params.portlet.addColumn(
                        {
                            id: 'custpage_link',
                            type: 'text',
                            label: 'VER',
                            align: 'RIGHT'
                        }
                    );
                }

                var resultObj = searchResult[i];

                var row = {};
                row['custpage_link'] = '<a href="/app/common/entity/custjob.nl?id='+resultObj.id+'" target="_blank">Ver</a>';

                var columns = resultObj.columns;

                for (var c = 0; c < columns.length; c++) {
                    if (i == 0) {
                        params.portlet.addColumn(
                            {
                                id: 'custpage_' + c,
                                type: 'text',
                                label: columns[c].label,
                                align: 'RIGHT'
                            }
                        );
                    }

                    row['custpage_'+c] = searchResult[i].getValue({ name: columns[c] });
                }
                /*
                var name = searchResult[i].getValue({ name: 'altname' });
                var email = searchResult[i].getValue({ name: 'email' });

                row['custpage_nombre'] = name;
                row['custpage_email'] = email;
                */
                params.portlet.addRow( { row: row } );	
            }

        } catch (E) {
            log.error('ERROR', E);
        }
    }

    return {
        render: render
    };

});
