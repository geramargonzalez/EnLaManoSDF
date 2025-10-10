/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
 define([
    "N/record",
    "N/runtime",
    "N/log",
    "N/cache",
    "N/file",
    "N/search",
  ], function (record, runtime, log, cache, file, search) {

    //* MAIN MR STARTS
    function getInputData() {
        var scriptObj = runtime.getCurrentScript();
      
        var idfiles=[];
      try {
        // Load the file
        var folderSearchObj = search.create({
          type: "folder",
          filters:
          [
             ["internalidnumber","equalto","7"]
          ],
          columns:
          [
             search.createColumn({
                name: "name",
                sort: search.Sort.ASC,
                label: "Nombre"
             }),
             search.createColumn({name: "foldersize", label: "Tamaño (KB)"}),
             search.createColumn({name: "lastmodifieddate", label: "Última modificación"}),
             search.createColumn({name: "parent", label: "Sub de"}),
             search.createColumn({name: "numfiles", label: "N.º de archivos"}),
             search.createColumn({
                name: "internalid",
                join: "file",
                label: "ID interno"
             })
          ]
       });
       var searchResultCount = folderSearchObj.runPaged().count;
       log.debug("folderSearchObj result count",searchResultCount);
        var myResultSet = folderSearchObj.run();
        var resultRange = myResultSet.getRange({
        start: 0,
        end: 50
        });
        for (var i = 0; i < resultRange.length; i++) {
              //  log.debug("log debug file 22", resultRange[i].getValue(resultRange[i].columns[5]));
                idfiles.push(resultRange[i].getValue(resultRange[i].columns[5]))
        }
      //  folderSearchObj.run().each(function(result){
      //   log.debug("reslt value ",result.values["file.internalid"][0].value);
      //   log.debug("recordType",result.getValue("recordType"));

        
      //      var idcsv =result.getValue("file.internalid")
      //      log.debug("idcsv",idcsv);
      //     return true;
      //  });
      var csvLines = [];


        for(var index = 0; index < idfiles.length; index++) {
            var csvFile = file.load({
                id: idfiles[index]
            });
            var iterator = csvFile.lines.iterator();
            // var csvHeaders = [];  
            // var headerCount = 0;
            iterator.each(function (line) {
             //   log.debug('line value', line.value)

                csvLines.push(line.value);
                return true;

            });
        }
        // csvLines= csvLines.splice(0,3)
      } catch (e) {
        log.debug("error in reading lines of csv", JSON.stringify(e));
      }
 
    return csvLines;
    }
    function map(context) {
      
        try{
             var details= context.value.split(";")
             var ide=details[2]
             var name=details[3]
             var pais=details[0]
   
//ss de record existentes de lista negra
var customrecord_sdb_lista_negraSearchObj = search.create({
  type: "customrecord_sdb_lista_negra",
  filters:
  [
     ["name","is",ide]
  ],
  columns:
  [
     search.createColumn({
        name: "name",
        sort: search.Sort.ASC,
        label: "Nombre"
     }),
     search.createColumn({name: "id", label: "ID"}),
     search.createColumn({name: "scriptid", label: "ID de script"})
  ]
});
var listaNegra = customrecord_sdb_lista_negraSearchObj.runPaged().count;
log.debug("customrecord_sdb_lista_negraSearchObj result count",listaNegra);
//ss de prestamos activos

var customrecord_prestamo_activoSearchObj = search.create({
  type: "customrecord_prestamo_activo",
  filters:
  [
     ["name","is",ide]
  ],
  columns:
  [
     search.createColumn({
        name: "name",
        sort: search.Sort.ASC,
        label: "Nombre"
     }),
     search.createColumn({name: "scriptid", label: "ID de script"})
  ]
});
var prestamoActivo = customrecord_prestamo_activoSearchObj.runPaged().count;
log.debug("customrecord_prestamo_activoSearchObj result count",prestamoActivo);

                 if(pais=="PAIS"){
               }else{
               if(name=="PRESTAMO ACTIVO" && prestamoActivo==0){       
               var rcd= record.create({
                type: 'customrecord_prestamo_activo',
                 });
                 rcd.setValue({
                  fieldId: 'name',
                  value: ide
              });

              rcd.setValue({
                fieldId: 'custrecord_sdb_ide',
                value: ide
            });
                var rcd = rcd.save();
                }else{
              if(listaNegra==0){
              var rcd= record.create({
                type: 'customrecord_sdb_lista_negra', 
                 });
                 rcd.setValue({
                  fieldId: 'name',
                  value: ide
              });
                 rcd.setValue({
                  fieldId: 'custrecord_sdb_pais',
                  value: pais
              });
              rcd.setValue({
                fieldId: 'custrecord_sdb_nrodoc',
                value: ide
            });
            rcd.setValue({
              fieldId: 'custrecord_sdb_nombre',
              value: name
          });
      
               var rcd = rcd.save();
                }
              }
              }

            log.debug('record created', context);         

        } catch(e){
            log.error('Failed to create record', e.message);
        }
    }
    
    function summarize(summary) {
        var errors = "";
        summary.mapSummary.errors.iterator().each(function(key, value){
          errors+= "Error in record creation: "+key+". Error was: "+JSON.parse(value).message+ "/n";
          return true;
        });
        if (errors) {
          log.error('Errors in Summarize',errors);
        }
        log.debug('summarize', 'end');
    }
    return {
      getInputData: getInputData,
      map: map,
      summarize: summarize,
    };
  });
  