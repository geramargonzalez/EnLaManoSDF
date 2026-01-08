define(['N/query', 'N/record', 'N/search', 'N/error'],
   function (query, record, search, errorModule) {
      
      /**  
       * formatDate - formate date 
       * @param {date} date -  The date of birth of the pre-lead.
       */
      function calculateYearsSinceDate(date) {
         var stLogTitle = 'calculateYearsSinceDate';
         try {
            var dob;
            if (typeof date === 'string') {
               var [day, month, year] = date.split('/').map(Number);
               dob = new Date(year, month - 1, day);
            } else if (date instanceof Date) {
               dob = date;
            } else {
               return
            }

            var today = new Date();
            var age = today.getFullYear() - dob.getFullYear();
            var monthDifference = today.getMonth() - dob.getMonth();
            var dayDifference = today.getDate() - dob.getDate();
            if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
               age--;
            }
            return age;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CALCULATE_YEARS_SINCE_DATE_ERROR',
               message: 'Error calculating years since date: ' + date + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
        /**  
       * formatDate - formate date 
       * @param {date} activityType -  The date of birth of the pre-lead.
       */
      function getActivityType(activityType) {
         var stLogTitle = 'getActivityType';
         try {
            var activity;
            switch (activityType) {
               case 'Privado':
                  activity = 1;
                  break;
               case "Público":
                  activity = 2;
                  break;
               case "Jubilado":
                  activity = 3;
                  break;
               case "Independiente":
                  activity = 6; 
                  break;
               default:
                  activity = 8;
            }
            return activity;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'GET_ACTIVITY_TYPE_ERROR',
               message: 'Error getting activity type for: ' + activityType + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
      /**
       *  createPreLead - Creates a new pre-lead record.
       * @param {string} service - The service associated with the pre-lead.
       * @param {string} docNumber - The document number of the pre-lead.
       * @param {string} mobilePhone - The mobile phone number of the pre-lead.
       * @param {string} firstName - The first name of the pre-lead.
       * @param {string} lastName - The last name of the pre-lead.
       * @param {number} activity - The activity type of the pre-lead.
       * @param {number} salary - The salary of the pre-lead.
       * @param {string} dateOfBirth - The date of birth of the pre-lead in 'DD/MM/YYYY' format.
       * @param {number} yearsOfWork - The years of work experience of the pre-lead.
       * @param {number} age - The age of the pre-lead.
       * @param {number} sourceId - The source ID of the pre-lead
       * @param {string} workStartDate - The work start date of the pre-lead in 'DD/MM/YYYY' format.
       * @param {string} estadoGestion - The approval status of the pre-lead.
       * @param {string} ingresoPor - The source of income for the pre-lead.
       * @returns {number|null} The ID of the provider if found, otherwise null.
       */
      function createPreLead(service, docNumber, mobilePhone, firstName, lastName, activity, salary, dateOfBirth, yearsOfWork, age, sourceId, workStartDate, estadoGestion, ingresoPor, source, activityName, trackingId) { 
         const stLogTitle = 'createPreLead';
         try {
            var preLead = record.create({
               type: record.Type.LEAD,
               isDynamic: true
            });
            if (service) {
               preLead.setValue({
                  fieldId: 'custentity_elm_service',
                  value: service
               });
            }
            preLead.setValue({
               fieldId: 'custentity_sdb_nrdocumento',
               value: docNumber
            });
            if (mobilePhone) {
               preLead.setValue({
                  fieldId: 'mobilephone',
                  value: mobilePhone
               });
            }
            preLead.setValue({
               fieldId: 'firstname',
               value: firstName ? firstName : 'Default'
            });
            preLead.setValue({
               fieldId: 'lastname',
               value: lastName ? validateAndFormatLastName(lastName) : 'Default'
            });

            preLead.setValue({
               fieldId: 'custentity_sdb_actividad',
               value: activity
            });
            preLead.setValue({
               fieldId: 'custentity_sdb_infolab_importe',
               value: salary
            });

            if (dateOfBirth) {
               dateOfBirth = new Date(formatDate(dateOfBirth));
               preLead.setValue({
                  fieldId: 'custentity_sdb_fechanac',
                  value: dateOfBirth
               });
            }

            preLead.setValue({
               fieldId: 'custentity_sdb_edad',
               value: age
            });
            if (dateOfBirth) {
               preLead.setValue({
                  fieldId: 'custentity_elm_years_work',
                  value: yearsOfWork
               });
            }
            if (workStartDate) {
               workStartDate = new Date(formatDate(workStartDate));
               preLead.setValue({
                  fieldId: 'custentity_elm_fecha_ingreso',
                  value: workStartDate
               });
            }
            preLead.setValue({
               fieldId: 'custentity_elm_channel',
               value: sourceId
            });
            if (estadoGestion) {
               preLead.setValue({
               fieldId: 'custentity_elm_aprobado',
               value: estadoGestion
               });
            }
 
            if (ingresoPor) {
               preLead.setValue({
                  fieldId: 'custentity_elm_sub_estado',
                  value: ingresoPor
               });
            }

            if (trackingId) {
               preLead.setValue({
                  fieldId: 'custentity_track_id_al_prestamo',
                  value: trackingId
               });
            }
            const preLeadId = preLead.save();
            log.audit('Success', 'Pre Lead creado para el documento ' + docNumber + ' con el siguiente id:  ' + preLeadId);
            return preLeadId;
         } catch (error) {
            log.error(stLogTitle, error);
            const info = {
               documentNumber: docNumber,
               service: service,
               mobilePhone: mobilePhone,
               firstName: firstName,
               lastName: lastName,
               salary: salary,
               dateOfBirth: dateOfBirth,
               yearsOfWork: yearsOfWork,
               workStartDate: workStartDate,
               source: source,
               activity: activityName
            };
            throw errorModule.create({
               name: 'CREATE_PRE_LEAD_ERROR',
               message: 'Error creating pre-lead for NEW LEAD: '  + JSON.stringify(info) + '. Details: ' + error.message,
               notifyOff: true
            });

         }
      }
        /**  
       * formatDate - formate date 
       * @param {date} dateOfBirth -  The date of birth of the pre-lead.
       */
      function formatDate(dateOfBirth) {
         var stLogTitle = 'formatDate';
         try {
            var parts = dateOfBirth.split('/');
            var month = parts[1];
            var day = parts[0];
            var year = parts[2];
            return month + '/' + day + '/' + year;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'FORMAT_DATE_ERROR',
               message: 'Error formatting date of birth: ' + dateOfBirth + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
         /**  
       * checkBlacklist - check if the lead is in the blacklist 
       * @param {object} docNumber -  The document number of the pre-lead.
       */
      function checkBlacklist(docNumber) {
         var stLogTitle = 'checkBlacklist';
         try {
            var blackListSS = search.create({
               type: "customrecord_sdb_lista_negra",
               filters:
                  [
                     ["custrecord_sdb_nrodoc", "equalto", docNumber]
                  ]
            });
            return (blackListSS.runPaged().count > 0);
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CHECK_BLACKLIST_ERROR',
               message: 'Error checking blacklist for document number: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
       /**  
       * isClientActive - check if the lead is client active
       * @param {object} docNumber -  The document number of the pre-lead.
       */
      function isClientActive(docNumber) {
         const stLogTitle = 'isClientActive';
         try {
            let isClient = false;
            const listaNegra = search.create({
                  type: "customrecord_sdb_lista_negra",
                  filters:
                  [
                     ["custrecord_sdb_nrodoc","equalto",docNumber]
                  ],
                  columns:
                  [
                     search.createColumn({name: "custrecord_sdb_nombre", label: "Nombre"})
                  ]
               });
               var searchResultCount = listaNegra.runPaged().count;
               log.debug("listaNegra result count",searchResultCount);
               listaNegra.run().each(function(result){
                  // Process each result
                  // .run().each has a limit of 4,000 results
                  if(result.getValue('custrecord_sdb_nombre') == 'prest_act'){
                     isClient = true;
                  }
                  return true;
               });

               return isClient;

         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'IS_CLIENT_ERROR',
               message: 'Error checking if document number is client: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }

      /**  
       * checkMocasist -  Updates an entity with various fields.
       * @param {object} docNumber -  The document number of the pre-lead.
       */
      function checkMocasist(docNumber) {
         var stLogTitle = 'checkMocasist';
         try {
            var mocasistSS = search.create({
               type: "customrecord_elm_mocasist",
               filters:
                  [
                     ["custrecord_elm_mocasist_doc", "equalto", docNumber]
                  ]
            });
            return (mocasistSS.runPaged().count > 0);
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CHECK_MOCASIST_ERROR',
               message: 'Error checking Mocasist for document number: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }

        /**  
       * getInfoRepetido -  Updates an entity with various fields.
       * @param {object} docNumber -  The document number of the pre-lead.
       * @param {integer} preLeadId - The ID of the pre-lead to exclude from the search.
       * @param {string} special - Special flag for additional filtering.
       * @param {string} canal - The source identifier to search for the provider.
       */
       function getInfoRepetido(docNumber, preLeadId, special, canal) {
         try {

            const filters =  [
                     ["stage","anyof","LEAD"], 
                     "AND", 
                     ["custentity_sdb_nrdocumento","is",docNumber], 
                     "AND", 
                     ["isinactive","is","F"], 
                     "AND", 
                     ["datecreated","within","monthsago1","secondsago0"],  
                     "AND", 
                     ["custentity_elm_lead_repetido_original","anyof","@NONE@"]
                  ]
                  if (canal) {
                     filters.push("AND");
                     filters.push(["custentity_elm_channel","anyof", canal]);
                  }

            var leadsInCurrentPeriodSS = search.create({
               type: "customer",
               filters: filters,
               columns:
                  [
                     search.createColumn({ name: "entitystatus" }),
                     search.createColumn({ name: "custentity_elm_aprobado" }),
                     search.createColumn({ name: "custentity_elm_service" }),
                     search.createColumn({ name: "firstname" }),
                     search.createColumn({ name: "lastname" }),
                     search.createColumn({ name: "custentity_sdb_actividad" }),
                     search.createColumn({ name: "custentity_sdb_infolab_importe" }),
                     search.createColumn({ name: "custentity_sdb_fechanac" }),
                     search.createColumn({ name: "custentity_elm_years_work" }),
                     search.createColumn({ name: "email" }),
                     search.createColumn({ name: "custentity_sdb_edad" }),
                     search.createColumn({ name: "custentity_score" }),
                     search.createColumn({ name: "custentity_calificacion" }),
                     search.createColumn({ name: "custentity_elm_reject_reason" }),
                     search.createColumn({ name: "custentity_response_score_bcu" }),
                     search.createColumn({ name: "custentity_elm_channel" }),
                     search.createColumn({ name: "custentity_elm_lead_repetido_original" }),
                     search.createColumn({ name: "isinactive" }),
                     search.createColumn({ name: "mobilephone" }),
                     search.createColumn({ name: "custentity_sdb_montoofrecido" }),
                     search.createColumn({ name: "datecreated", sort: search.Sort.DESC}),
                  ]
            });
            if (preLeadId) {
               const internalIdFilter = search.createFilter({
                  name: "internalid",
                  operator: search.Operator.NONEOF,
                  values: preLeadId
               });
               leadsInCurrentPeriodSS.filters.push(internalIdFilter);
            }
            let infoRepetido = {};
            let searchResultCount = leadsInCurrentPeriodSS.runPaged().count;
            log.debug("leadSearchObj result count",  searchResultCount);
            leadsInCurrentPeriodSS.run().each(function (result) {
              let endeudamiento = null;
              let califMinima = null;
               const scoreBcuResponse = result.getValue('custentity_response_score_bcu');
               
               if (scoreBcuResponse) {
                  try {
                     const parsedResponse = JSON.parse(scoreBcuResponse);
                     endeudamiento = parsedResponse?.endeudamiento || null;
                     califMinima = parsedResponse?.calificacionMinima || null;
                  } catch (e) {
                     log.error('Error parsing custentity_response_score_bcu', e);
                  }
               }
               infoRepetido = {
                  id: result?.id,
                  status: result.getValue('entitystatus'),
                  approvalStatus: result.getValue('custentity_elm_aprobado'),
                  service: result.getValue('custentity_elm_service'),
                  firstName: result.getValue('firstname'),
                  lastName: result.getValue('lastname'),
                  activity: result.getValue('custentity_sdb_actividad'),
                  salary: result.getValue('custentity_sdb_infolab_importe'),
                  dateOfBirth: result.getValue('custentity_sdb_fechanac'),
                  yearsOfWork: result.getValue('custentity_elm_years_work'),
                  email: result.getValue('email'),
                  age: result.getValue('custentity_sdb_edad'),
                  score: result.getValue('custentity_score'),
                  calificacion: result.getValue('custentity_calificacion'),
                  rejectionReason: result.getValue('custentity_elm_reject_reason'),
                  endeudamiento: endeudamiento,
                  canal: result.getValue('custentity_elm_channel'),
                  leadRepetidoOriginal: result.getValue('custentity_elm_lead_repetido_original'),
                  isinactive: result.getValue('isinactive'),
                  mobilephone: result.getValue('mobilephone'),
                  calificacionMinima: califMinima,
                  montoOfrecido: result.getValue('custentity_sdb_montoofrecido'),
               }
            }); 

            return infoRepetido;

         } catch (error) {
            log.error('getInfoRepetido', error);
            throw errorModule.create({
               name: 'GET_INFO_REPETIDO_ERROR',
               message: 'Error getting repeated lead information: ' + error.message,
               notifyOff: true
            });
         }
      }

            /**
       * getInfoRepetido - Busca si existe un lead repetido y opcionalmente devuelve toda la info.
       * @param {string|number} docNumber    - El documento del lead/pre-lead.
       * @param {number}        preLeadId    - ID del pre-lead a excluir de la búsqueda.
       * @param {string}        special      - Si es 'exists', sólo verifica existencia (modo liviano).
       * @param {string|number} canal        - Canal / fuente para filtrar (opcional).
       * @returns {boolean|object|null} 
       *          - si special === 'exists' → true/false
       *          - si no → objeto con info del lead o null si no hay.
       */
       function getInfoRepetidoLight(docNumber, preLeadId, special, canal) {
         try {
            var filters = [
               ["stage", "anyof", "LEAD"],
               "AND",
               ["custentity_sdb_nrdocumento", "is", docNumber],
               "AND",
               ["isinactive", "is", "F"],
               "AND",
               ["datecreated", "within", "monthsago1", "secondsago0"],
               "AND",
               ["custentity_elm_lead_repetido_original", "anyof", "@NONE@"]
            ];

            if (canal) {
               filters.push("AND");
               filters.push(["custentity_elm_channel", "anyof", canal]);
            }

            var onlyExists = (special === 'exists');

            // Si sólo queremos saber si existe, no necesitamos todas las columnas
            var columns;
            if (onlyExists) {
               columns = [
                  search.createColumn({ name: "internalid" }),
                  search.createColumn({ name: "custentity_elm_aprobado" })
               ];
            } else {
               columns = [
                  search.createColumn({ name: "entitystatus" }),
                  search.createColumn({ name: "custentity_elm_aprobado" }),
                  search.createColumn({ name: "custentity_elm_service" }),
                  search.createColumn({ name: "firstname" }),
                  search.createColumn({ name: "lastname" }),
                  search.createColumn({ name: "custentity_sdb_actividad" }),
                  search.createColumn({ name: "custentity_sdb_infolab_importe" }),
                  search.createColumn({ name: "custentity_sdb_fechanac" }),
                  search.createColumn({ name: "custentity_elm_years_work" }),
                  search.createColumn({ name: "email" }),
                  search.createColumn({ name: "custentity_sdb_edad" }),
                  search.createColumn({ name: "custentity_score" }),
                  search.createColumn({ name: "custentity_calificacion" }),
                  search.createColumn({ name: "custentity_elm_reject_reason" }),
                  search.createColumn({ name: "custentity_response_score_bcu" }),
                  search.createColumn({ name: "custentity_elm_channel" }),
                  search.createColumn({ name: "custentity_elm_lead_repetido_original" }),
                  search.createColumn({ name: "isinactive" }),
                  search.createColumn({ name: "mobilephone" }),
                  search.createColumn({ name: "custentity_sdb_montoofrecido" }),
                  search.createColumn({ 
                     name: "datecreated", 
                     sort: search.Sort.DESC
                  })
               ];
            }

            var leadsInCurrentPeriodSS = search.create({
               type: "customer",
               filters: filters,
               columns: columns
            });

            if (preLeadId) {
               leadsInCurrentPeriodSS.filters.push(
                  search.createFilter({
                     name: "internalid",
                     operator: search.Operator.NONEOF,
                     values: preLeadId
                  })
               );
            }

            // 🔹 OPTIMIZACIÓN CLAVE:
            // No usamos runPaged().count ni .each.
            // Solo traemos el PRIMER resultado ordenado por datecreated DESC.
            var results = leadsInCurrentPeriodSS.run().getRange({
               start: 0,
               end: 1
            });

            var firstResult = results && results[0];

            log.debug('getInfoRepetido', 'firstResult: ' +  JSON.stringify(firstResult)); 

            // Modo liviano: sólo existencia
            if (onlyExists) {
               log.debug('getInfoRepetido', 'Existence check result: ' + !!firstResult);
               return !!firstResult;
            }

            // Modo completo: devolver info o null si no hay
            if (!firstResult) {
               return null;
            }

            var endeudamiento = null;
            var califMinima = null;
            var scoreBcuResponse = firstResult.getValue('custentity_response_score_bcu');

            if (scoreBcuResponse) {
               try {
                  var parsedResponse = JSON.parse(scoreBcuResponse);
                  endeudamiento = parsedResponse && parsedResponse.endeudamiento || null;
                  califMinima = parsedResponse && parsedResponse.calificacionMinima || null;
               } catch (e) {
                  log.error('Error parsing custentity_response_score_bcu', e);
               }
            }

            var infoRepetido = {
               id: firstResult.id,
               status: firstResult.getValue('entitystatus'),
               approvalStatus: firstResult.getValue('custentity_elm_aprobado'),
               service: firstResult.getValue('custentity_elm_service'),
               firstName: firstResult.getValue('firstname'),
               lastName: firstResult.getValue('lastname'),
               activity: firstResult.getValue('custentity_sdb_actividad'),
               salary: firstResult.getValue('custentity_sdb_infolab_importe'),
               dateOfBirth: firstResult.getValue('custentity_sdb_fechanac'),
               yearsOfWork: firstResult.getValue('custentity_elm_years_work'),
               email: firstResult.getValue('email'),
               age: firstResult.getValue('custentity_sdb_edad'),
               score: firstResult.getValue('custentity_score'),
               calificacion: firstResult.getValue('custentity_calificacion'),
               rejectionReason: firstResult.getValue('custentity_elm_reject_reason'),
               endeudamiento: endeudamiento,
               canal: firstResult.getValue('custentity_elm_channel'),
               leadRepetidoOriginal: firstResult.getValue('custentity_elm_lead_repetido_original'),
               isinactive: firstResult.getValue('isinactive'),
               mobilephone: firstResult.getValue('mobilephone'),
               calificacionMinima: califMinima,
               montoOfrecido: firstResult.getValue('custentity_sdb_montoofrecido')
            };

            log.debug('getInfoRepetido', 'Found repeated lead info: ' + JSON.stringify(infoRepetido));
            return infoRepetido;

         } catch (error) {
            log.error('getInfoRepetido', error);
            throw errorModule.create({
               name: 'GET_INFO_REPETIDO_ERROR',
               message: 'Error getting repeated lead information: ' + error.message,
               notifyOff: true
            });
         }
      }


      /**
       * getInfoRepetido - Busca si existe un lead repetido y opcionalmente devuelve toda la info.
       * @param {string|number} docNumber - Nro de documento.
       * @param {number} preLeadId        - ID del pre-lead a excluir.
       * @param {string} special          - Si es 'exists', solo chequea existencia.
       * @param {string|number} canal     - Canal / source (opcional).
       * @returns {boolean|object|null}
       *          - special === 'exists' → true/false
       *          - otro caso → objeto con info o null si no hay registro.
       */
      function getInfoRepetidoSql(docNumber, preLeadId, special, canal) {
      try {
         const onlyExists = (special === 'exists');

         // WHERE base compartido
         let whereClause = `
            customer.custentity_sdb_nrdocumento = '${docNumber}'
            AND customer.isinactive = 'F'
         `;

        /*  AND customer.datecreated >= SYSDATE - 30
            AND (customer.custentity_elm_lead_repetido_original IS NULL OR customer.custentity_elm_lead_repetido_original = 0) */

         //    customer.searchStage = 'Lead'
         if (canal) {
            whereClause += ` AND custentity_elm_channel = '${canal}' `;
         }

         if (preLeadId) {
            whereClause += ` AND id <> ${preLeadId} `;
            
         }

         let sql;

         if (onlyExists) {
            // 🔹 Modo liviano: devuelve el ID y custentity_elm_aprobado del customer encontrado
            sql = `
               SELECT
                  id,
                  custentity_elm_aprobado
               FROM
                  customer
               WHERE
                  ${whereClause}
               ORDER BY
                  datecreated DESC
            `;
         } else {
            // 🔹 Modo completo: todas las columnas necesarias
            sql = `
               SELECT
                  id,
                  entitystatus,
                  custentity_elm_aprobado,
                  custentity_elm_service,
                  firstname,
                  lastname,
                  custentity_sdb_actividad,
                  custentity_sdb_infolab_importe,
                  custentity_sdb_fechanac,
                  custentity_elm_years_work,
                  email,
                  custentity_sdb_edad,
                  custentity_score,
                  custentity_calificacion,
                  custentity_elm_reject_reason,
                  custentity_response_score_bcu,
                  custentity_elm_channel,
                  custentity_elm_lead_repetido_original,
                  isinactive,
                  mobilephone,
                  custentity_sdb_montoofrecido,
                  datecreated
               FROM
                  customer
               WHERE
                  ${whereClause}
               ORDER BY
                  datecreated DESC
            `;
         }

         const resultSet = query.runSuiteQL({
            query: sql
         });

         const rows = resultSet.asMappedResults();

         // 🔹 Modo "exists": devolver objeto con id y custentity_elm_aprobado, o null
         if (onlyExists) {
            if (rows.length > 0) {
               return {
                  id: rows[0].id,
                  approvalStatus: rows[0].custentity_elm_aprobado
               };
            }
            return null;
         }

         // 🔹 Modo full: devolver objeto o null
         if (!rows.length) {
            return null;
         }

         const row = rows[0];

         // Parseo del JSON de BCU
         let endeudamiento = null;
         let califMinima = null;
         const scoreBcuResponse = row.custentity_response_score_bcu;

         if (scoreBcuResponse) {
            try {
               const parsedResponse = JSON.parse(scoreBcuResponse);
               endeudamiento = parsedResponse?.endeudamiento || null;
               califMinima  = parsedResponse?.calificacionMinima || null;
            } catch (e) {
               log.error('Error parsing custentity_response_score_bcu', e);
            }
         }

         const infoRepetido = {
            id: row.id,
            status: row.entitystatus,
            approvalStatus: row.custentity_elm_aprobado,
            service: row.custentity_elm_service,
            firstName: row.firstname,
            lastName: row.lastname,
            activity: row.custentity_sdb_actividad,
            salary: row.custentity_sdb_infolab_importe,
            dateOfBirth: row.custentity_sdb_fechanac,
            yearsOfWork: row.custentity_elm_years_work,
            email: row.email,
            age: row.custentity_sdb_edad,
            score: row.custentity_score,
            calificacion: row.custentity_calificacion,
            rejectionReason: row.custentity_elm_reject_reason,
            endeudamiento: endeudamiento,
            canal: row.custentity_elm_channel,
            leadRepetidoOriginal: row.custentity_elm_lead_repetido_original,
            isinactive: row.isinactive,
            mobilephone: row.mobilephone,
            calificacionMinima: califMinima,
            montoOfrecido: row.custentity_sdb_montoofrecido
         };

         return infoRepetido;

      } catch (error) {
         log.error('getInfoRepetidoSQL', error);
         throw errorModule.create({
            name: 'GET_INFO_REPETIDO_ERROR',
            message: 'Error getting repeated lead information: ' + error.message,
            notifyOff: true
         });
      }
      }

       /**  
       * convertToLead -  Converts a pre-lead to a lead with various fields.
       * @param {integer} preLeadId - The ID of the pre-lead to convert.
       * @param {object} score - The score object containing scoring information.
       * @param {string} leadStatus - The status to set for the lead.
       * @param {string} approvalStatus - The approval status to set for the lead.
       * @param {string} firstName - The first name of the lead.
       * @param {string} lastName - The last name of the lead.
       * @param {number} activity - The activity type of the lead.
       * @param {number} salary - The salary of the lead.
       * @param {string} dateOfBirth - The date of birth of the lead in 'DD/MM/YYYY' format.
       * @param {number} yearsOfWork - The years of work experience of the lead.
       * @param {string} email - The email address of the lead.
       * @param {number} age - The age of the lead.
       * @param {number} sourceId - The source ID of the lead.
       * @param {string} workStartDate - The work start date of the lead in 'DD/MM/YYYY' format.
       * @returns {number} The ID of the converted lead.
       */
      function convertToLead(preLeadId, score, leadStatus, approvalStatus, firstName, lastName, activity, salary, dateOfBirth, yearsOfWork, email, age, sourceId, workStartDate) {
         var stLogTitle = 'convertToLead';
         try {
            var rec = record.load({
               type: record.Type.LEAD,
               id: preLeadId
            });
            if (activity) rec.setValue('custentity_sdb_actividad', activity);
            if (salary) rec.setValue('custentity_sdb_infolab_importe', salary);
            if (dateOfBirth) {
               dateOfBirth = new Date(formatDate(dateOfBirth));
               rec.setValue('custentity_sdb_fechanac', dateOfBirth);
            }
            if (yearsOfWork) rec.setValue('custentity_elm_years_work', yearsOfWork);
            if (email) rec.setValue('email', email);
            if (leadStatus) rec.setValue('entitystatus', leadStatus);
            if (age) rec.setValue('custentity_sdb_edad', age);
            if (approvalStatus) rec.setValue('custentity_elm_aprobado', approvalStatus);
            if (sourceId) rec.setValue('custentity_elm_channel', sourceId);
            if (workStartDate) {
               workStartDate = new Date(formatDate(workStartDate));
               rec.setValue('custentity_elm_fecha_ingreso', workStartDate);
            }

            if (rec.getValue('firstname') === 'Default') {
               rec.setValue('firstname', firstName ? firstName : 'Default');
               rec.setValue('lastname', lastName ? validateAndFormatLastName(lastName) : 'Default');
            }
            if (score) {
               rec.setValue('custentity_score', score.score);

               try {
                  rec.setValue('custentity_response_score_bcu', JSON.stringify(score));
               } catch (error) {
                  log.error('Error al guardar la respuesta de BCU', error);
               }

               rec.setValue('custentity_calificacion', score.calificacionMinima);
               var name = score.nombre;
               if (name) {
                  var split = name.split(',');
                  rec.setValue('firstname', split[1] ? split[1].trim() : 'Default');
                  rec.setValue('lastname', split[0] ? validateAndFormatLastName(split[0].trim()) : 'Default');
               }
            }
            return rec.save();

         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CONVERT_TO_LEAD_ERROR',
               message: 'Error converting pre-lead to lead. Details: ' + error.message,
               notifyOff: true
            });

         }
      }

       /**  
       * updateEntity -  Updates an entity with various fields.
       * @param {object} options - Options object containing parameters for updating the entity.
       */
      function updateEntity(options) {
         const {
            entity,
            approvalStatus,
            rejectReason,
            score,
            entityStatus,
            montoCuota,
            ofertaFinal,
            montoCuotaName,
            firstName,
            lastName,
            activity,
            salary,
            dateOfBirth,
            yearsOfWork,
            email,
            infoRepetido,
            plazo,
            endeudamientoT2,
            endeudamientoT6,
            cantEntidadesT2,
            cantEntidadesT6,
            peroCalifT2,
            peroCalifT6,
            endeudamiento
         } = options;

         const stLogTitle = 'updateEntity';
         try {
            const repetidoId = infoRepetido?.id || null;

            log.debug('score original at updateEntity', score);

            const scentitystatusoreValue = score?.score ?? infoRepetido?.score;
            const calificacionMinimaValue = score?.calificacionMinima ?? infoRepetido?.calificacion;

            log.debug('scoreValue at updateEntity', score?.score);
            log.debug('calificacionMinimaValue at updateEntity', calificacionMinimaValue);

            // If score has 'nombre', override name fields
            let parsedFirstName = firstName || 'Default';
            let parsedLastName = lastName || 'Default';
            if (score?.nombre) {
               const [last, first] = score.nombre.split(',');
               parsedFirstName = first?.trim() || 'Default';
               parsedLastName = last?.trim() ? validateAndFormatLastName(last.trim()) : 'Default';
            }

            const fieldMap = {
               'custentity_elm_aprobado': approvalStatus,
               'custentity_elm_reject_reason': rejectReason,
               'custentity_score': score?.score || 0,
               'custentity_calificacion': calificacionMinimaValue,
               'custentity_response_score_bcu': score ? JSON.stringify(score) : null,
               'entitystatus': entityStatus,
               'custentity_sdb_valor_cuota': montoCuota,
               'custentity_sdb_montoofrecido': ofertaFinal,
               'custentity_elm_monto_cuota': montoCuotaName,
               'firstname': parsedFirstName,
               'lastname': validateAndFormatLastName(parsedLastName),
               'custentity_sdb_actividad': activity,
               'custentity_sdb_infolab_importe': salary,
               'custentity_sdb_fechanac': dateOfBirth,
               'custentity_elm_years_work': yearsOfWork,
               'email': email,
               'custentity_elm_lead_repetido_original': repetidoId,
               'custentity_elm_plazo': plazo,
               'custentity_elm_t2_endeudamiento': endeudamientoT2 || null,
               'custentity_elm_t6_endeudamiento': endeudamientoT6 || null,
               'custentity_elm_t2_cantidad_entidades': cantEntidadesT2 || null,
               'custentity_elm_t6_cant_de_enti': cantEntidadesT6 || null,
               'custentity_elm_peor_calif': peroCalifT2 || null,
               'custentity_t6_elm_pero_cal': peroCalifT6 || null,
               'custentity_elm_end_lead': endeudamiento || null   
            };

            // Apply all non-null values
            for (const [fieldId, value] of Object.entries(fieldMap)) {
               if (value != null) {
                  entity.setValue({ fieldId, value });
               }
            }

         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'UPDATE_ENTITY_ERROR',
               message: 'Error updating entity with ID: ' + entity.id + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
      /**
       * submitFieldsEntity -  Submits fields for a given entity.
       * @param {string} entity - The internal ID of the entity to update.
       * @param {string} approvalStatus - The approval status to set.
       * @param {string} rejectReason - The rejection reason to set.
       * @param {string} newEntityStatus - The new entity status to set.
       * @param {Object} infoRepetido - Information about repeated lead, if any.
       * @param {number} montoCuota - The quota amount to set.
       * @param {number} ofertaFinal - The final offer amount to set.
       * @param {string} montoCuotaName - The name of the quota amount to set.
       * @param {Object} score - The score object containing score details.
       * @param {number} plazo - The term to set.
       * @param {number} endeudamientoT2 - The T2 indebtedness to set.
       * @param {number} endeudamientoT6 - The T6 indebtedness to set.
       */
      function submitFieldsEntity(entity, approvalStatus, rejectReason, newEntityStatus, infoRepetido, montoCuota, ofertaFinal, montoCuotaName, score, plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
         cantEntidadesT6, peroCalifT2, peroCalifT6, canal, endeudamiento, solID) {
         let stLogTitle = 'submitFieldsEntity';
         try {
            let firstName;
            let lastName;
            if (score) {
               let name = score.nombre;
               if (name) {
                  let split = name.split(',');
                  firstName = split[1] ? split[1].trim() : 'Default';
                  lastName = split[0] ? validateAndFormatLastName(split[0].trim()) : 'Default';
               }
            }
            if (infoRepetido) {
               firstName = infoRepetido ? (infoRepetido.firstName || 'Default') : (firstName || 'Default');
               if (infoRepetido.lastName) {
                  lastName = validateAndFormatLastName(infoRepetido.lastName);
               } else {
                  lastName = lastName ? validateAndFormatLastName(lastName) : 'Default';
               }
            }


            const valuesToUpdate = {
               custentity_elm_aprobado: approvalStatus,
               custentity_elm_reject_reason: rejectReason,
               custentity_sdb_valor_cuota: montoCuota,
               custentity_sdb_montoofrecido: ofertaFinal,
               custentity_elm_monto_cuota: montoCuotaName,
               custentity_score: score ? score.score : '',
               custentity_calificacion: score ? score.calificacionMinima : '',
               custentity_elm_plazo: plazo ? plazo : '',
               custentity_response_score_bcu: score ? JSON.stringify(score) : '',
               custentity_elm_t2_endeudamiento: endeudamientoT2 || null,
               custentity_elm_t6_endeudamiento: endeudamientoT6 || null,
               custentity_elm_t2_cantidad_entidades: cantEntidadesT2 || null,
               custentity_elm_t6_cant_de_enti: cantEntidadesT6 || null,
               custentity_elm_peor_calif: peroCalifT2 || null,
               custentity_t6_elm_pero_cal: peroCalifT6 || null,
               custentity_elm_end_lead: endeudamiento || null,
               custentity_elm_sol_vig: solID   

            }

            if (canal) {
               valuesToUpdate.custentity_elm_canal = canal;
            }

            if (infoRepetido) {
               valuesToUpdate.custentity_sdb_actividad = infoRepetido ? infoRepetido.activity : '',
                  valuesToUpdate.custentity_sdb_infolab_importe = infoRepetido ? infoRepetido.salary : '',
                  valuesToUpdate.custentity_sdb_fechanac = infoRepetido ? infoRepetido.dateOfBirth : '',
                  valuesToUpdate.custentity_elm_years_work = infoRepetido ? infoRepetido.yearsOfWork : '',
                  valuesToUpdate.email = infoRepetido ? infoRepetido.email : '',
                  valuesToUpdate.custentity_sdb_edad = infoRepetido ? infoRepetido.age : '',
                  valuesToUpdate.custentity_score = infoRepetido ? infoRepetido.score : '',
                  valuesToUpdate.custentity_calificacion = infoRepetido ? infoRepetido.calificacion : '',
                  valuesToUpdate.custentity_elm_lead_repetido_original = infoRepetido ? infoRepetido.id : null
            }
            if (firstName) valuesToUpdate.firstname = firstName || 'Default';
            if (lastName) valuesToUpdate.lastname = lastName ? validateAndFormatLastName(lastName) : 'Default';
            if (newEntityStatus) valuesToUpdate.entitystatus = newEntityStatus;

            record.submitFields({
               type: record.Type.LEAD,
               id: entity,
               values: valuesToUpdate
            });
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'SUBMIT_FIELDS_ENTITY_ERROR',
               message: 'Error submitting fields for entity with ID: ' + entity + '. Details: ' + error.message,
               notifyOff: true
            });
         }

      }
      /**
       * findEntity -  Finds an entity with the given document number and status, returning its ID.
       * @param {string} docNumber - The source identifier to search for the provider.
       * @param {string} status - The source identifier to search for the provider.  
       */
      function findEntity(docNumber, status) {
         const stLogTitle = 'findLead';
         try {
            let lead;
            let leadSearch = search.create({
               type: "customer",
               filters:
                  [
                     ["status", "anyof", status],
                     "AND",
                     ["custentity_sdb_nrdocumento", "is", docNumber],
                     "AND", 
                     ["isinactive","is","F"]
                  ]
            });
            leadSearch.run().each(function (result) {
               lead = result.id;
            });
            return lead;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'FIND_ENTITY_ERROR',
               message: 'Error finding entity with document number: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
      /**
       * findEntityWithState -  Finds an entity with the given document number and canal, returning its ID and approval status.
       * @param {string} docNumber - The source identifier to search for the provider.
       * @param {string} canal - The source identifier to search for the provider.  
       */
      function findEntityWithState(docNumber, canal) { 
         const stLogTitle = 'findEntityWithState';
         try {
            const lead = {};

            const filters = [
                     ["stage","anyof","LEAD"], 
                     "AND", 
                     ["custentity_sdb_nrdocumento","is",docNumber], 
                     "AND", 
                     ["isinactive","is","F"], 
                     "AND", 
                     ["datecreated","within","monthsago1","secondsago0"],  
                     "AND", 
                     ["custentity_elm_lead_repetido_original","anyof","@NONE@"]
                  ]

            if (canal) {
               filters.push("AND");
               filters.push(["custentity_elm_channel","anyof", canal]);
            }

            const leadSearch = search.create({
               type: "customer",
               filters:
                  filters,
               columns:
                  [
                     search.createColumn({ name: "custentity_elm_aprobado" }),
                     search.createColumn({ name: "custentity_score" }),
                     search.createColumn({ name: "custentity_elm_sol_vig" })
                  ]
            });
            leadSearch.run().each(function (result) {
               lead.id = result.id;
               lead.status = result.getValue('custentity_elm_aprobado');
               lead.score = result.getValue('custentity_score');
               lead.solID = result.getValue('custentity_elm_sol_vig');
            });
            return lead;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'FIND_ENTITY_WITH_STATE_ERROR',
               message: 'Error finding entity with document number: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
       /**
       * getOfertaFinal -  gets the oferta final record that matches the given monto_cuota.
       * @param {string} monto_cuota - The source identifier to search for the provider.
       */
      function getOfertaFinal(monto_cuota) {
         const stLogTitle = 'getOfertaFinal';
         try {
            if (!monto_cuota || isNaN(monto_cuota)) {
               log.error(stLogTitle, 'Invalid monto_cuota ');
               return null;
            }
            const customrecord_sdb_oferta_finalSearchObj = search.create({
               type: "customrecord_sdb_oferta_final",
               filters: [["custrecord_monto_cuota", "lessthanorequalto", monto_cuota]],
               columns: [
                  search.createColumn({ name: "internalid" }),
                  search.createColumn({ name: "name" }),
                  search.createColumn({ name: "custrecord_monto_cuota", sort: search.Sort.DESC }),
                  search.createColumn({ name: "custrecord_oferta" }),
                  search.createColumn({ name: "custrecord_plazo" }),
                  search.createColumn({ name: "custrecord_monto_cuota_final" })
               ]
            });
            let ofertaFinal = null;
            customrecord_sdb_oferta_finalSearchObj.run().each(function (result) {
               ofertaFinal = {};
               ofertaFinal.internalid = result.getValue('internalid');
               ofertaFinal.name = result.getValue('name');
               ofertaFinal.montoCuota = result.getValue('custrecord_monto_cuota');
               ofertaFinal.oferta = result.getValue('custrecord_oferta');
               ofertaFinal.plazo = result.getValue('custrecord_plazo');
               ofertaFinal.cuotaFinal = result.getValue('custrecord_monto_cuota_final');
               return false;
            });
            return ofertaFinal;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'GET_OFERTA_FINAL_ERROR',
               message: 'Error getting oferta final for monto_cuota: ' + monto_cuota + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
       /**
       * getPonderador - Gets the ponderador record that matches the given filters.
       * @param {string} score - The source identifier to search for the provider.
       * @param {string} peor_calif_bcu - The source identifier to search for the provider.
       * @param {string} endeudamiento - The source identifier to search for the provider.
       * @param {string} salario - The source identifier to search for the provider.
       * @param {string} actividad - The source identifier to search for the provider.
       * @param {string} edad - The source identifier to search for the provider.
       * @param {string} canal - The source identifier to search for the provider.
       * @returns {boolean} True if records exist, otherwise false.
       */
      function getPonderador(score, peor_calif_bcu, endeudamiento, salario, actividad, edad, canal) {
         const stLogTitle = 'getPonderador';
         try {
            
            const montoCuotaObj = {
               montoCuotaId: -1,
               ponderador: -1
            }

            const filters = [
               ["custrecord_score", "lessthanorequalto", score], "AND",
               ["custrecord_score_final", "greaterthanorequalto", score], "AND",
               ["custrecord_peor_calif_bcu", "is", peor_calif_bcu], "AND",
               ["custrecord_salario_inicial", "lessthanorequalto", salario], "AND",
               ["custrecord_salario_final", "greaterthanorequalto", salario], "AND",
               [["custrecord_actividad", "anyof", "8"], "OR", ["custrecord_actividad", "anyof", actividad]], "AND",
               ["custrecord_edad", "lessthanorequalto", edad], "AND",
               ["custrecord_edad_final", "greaterthanorequalto", edad]
            ]

            if (endeudamiento) {
               filters.push("AND");
               filters.push(["custrecord_endeudamiento_inicial", "lessthanorequalto", endeudamiento]);
               filters.push("AND");
               filters.push(["custrecord_endeudamiento_final", "greaterthanorequalto", endeudamiento]);
            }

            if (canal && (canal == '2' || canal == 'AlPrestamo')) {
               filters.push("AND");
               filters.push(["custrecord_monto_cuota_source", "anyof", '2']);
            } else {
               filters.push("AND");
               filters.push( ["custrecord_monto_cuota_source","anyof","@NONE@"]);
            }

            
            const montoCuotaSS = search.create({
               type: "customrecord_monto_cuota",
               filters: filters,
               columns: [
                  search.createColumn({ name: "custrecord_ponderador" }),
                  search.createColumn({ name: "name" })
               ]
            });
            
            // Add canal filter only if canal has a value

            montoCuotaSS.run().each(function (result) {
               montoCuotaObj.montoCuotaId = result.id;
               montoCuotaObj.montoCuotaName = result.getValue('name');
               montoCuotaObj.ponderador = result.getValue('custrecord_ponderador');
               return true;
            });
            return montoCuotaObj;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'GET_PONDERADOR_ERROR',
               message: 'Error getting ponderador for filters: ' + JSON.stringify(filters) + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
       /**
       * checkSourceOfertaFinalDataExists - Checks if there is any record in the custom record type "Oferta Final" that matches the given source.
       * @param {string} proveedorId - The source identifier to search for the provider.
       * @returns {boolean} True if records exist, otherwise false.
       */
      function checkSourceOfertaFinalDataExists(proveedorId) {
         const sql = `
            SELECT 
               BUILTIN_RESULT.TYPE_INTEGER(CUSTOMRECORD_SDB_OFERTA_FINAL.ID) AS ID 
            FROM 
               CUSTOMRECORD_SDB_OFERTA_FINAL
            WHERE 
               CUSTOMRECORD_SDB_OFERTA_FINAL.custrecord_source IN ('${proveedorId}')`;

         const resultSet = query.runSuiteQL({ query: sql }).asMappedResults();
         return resultSet.length > 0;
      } 
      /**
       * checkSourceMontoCuotaDataExists - Checks if there is any record in the custom record type "Monto Cuota" that matches the given source. 
       * @param {integer} proveedorId - The ID of the provider to check against.
       * @returns {number|null} The ID of the provider if found, otherwise null.
       */
      function checkSourceMontoCuotaDataExists(proveedorId) {
         const sql = `
            SELECT 
               BUILTIN_RESULT.TYPE_INTEGER(customrecord_monto_cuota.ID) AS ID 
            FROM 
               customrecord_monto_cuota
            WHERE 
               customrecord_monto_cuota.custrecord_monto_cuota_source IN ('${proveedorId}')`;

         const resultSet = query.runSuiteQL({ query: sql }).asMappedResults();
         return resultSet.length > 0;
      }

      /**
       * getProveedorId - Retrieves the ID of a provider based on the given source.
       * @param {string} source - The source identifier to search for the provider.
       * @returns {number|null} The ID of the provider if found, otherwise null.
       */
      function getProveedorId(source) {
         let proveedorId;

         const sql = `
                  SELECT 
                     BUILTIN_RESULT.TYPE_INTEGER(customrecord_elm_source.ID) AS ID
                  FROM 
                     customrecord_elm_source
                  WHERE 
                     customrecord_elm_source.custrecord_elm_source_codigo = '${source}'`;

         const results = query.runSuiteQL({ query: sql }).asMappedResults();
         proveedorId = results.length > 0 ? results[0].id : null

         return proveedorId;
      }
      /**
       * createListRepetido - Create a new record in the custom record type "Lista Repetido" if it does not already exist.
       * @param {string} nroDocument - The source identifier to search for the provider.
       * @param {string} nombre - The name associated with the document number.
       * @returns {number|null} The ID of the provider if found, otherwise null.
       */
      function createListRepetido(nroDocument, nombre){
         const stLogTitle = 'createListRepetido';
         try {
             const listRepetidoCount = search.create({
               type: "customrecord_elm_repetido_lead",
               filters: [
                  ["custrecord_elm_repetido_doc", "is", nroDocument]
               ]
            }).runPaged().count;

            if (listRepetidoCount < 1) { 
               const recRep = record.create({
                  type: "customrecord_elm_repetido_lead",
                  isDynamic: false
               })
               
               recRep.setValue({
                  fieldId: "custrecord_elm_repetido_doc",
                  value: nroDocument
               })
               recRep.setValue({
                  fieldId: "custrecord_elm_repetido_nombre",
                  value: nombre
               })

                const today = new Date();
                recRep.setValue({
                  fieldId: "custrecord_elm_repetido_fecha_creado",
                  value: today
               })
               
               const idRep = recRep.save();
               log.audit(stLogTitle, 'Lista Repetido creada con ID: ' + idRep);
            }
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CREATE_LIST_REPETIDO_ERROR',
               message: 'Error creating Lista Repetido for document number: ' + nroDocument + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
      /**
       * Copies data from one record to another using submitFields for efficiency
       * @param {Object} options Configuration options
       * @param {string} options.sourceType - Source record type
       * @param {string} options.sourceId - Source record internal ID
       * @param {string} [options.targetType] - Target record type (defaults to sourceType if not specified)
       * @param {string} options.targetId - Target record ID to update
       * @param {Array} [options.fieldsToCopy] - Array of field IDs to copy (copies all if not specified)
       * @param {Object} [options.fieldMap] - Object mapping source field IDs to target field IDs
       * @param {Object} [options.defaultValues] - Default values for target record
       * @returns {string} ID of the target record
       */
      function copyRecordToRecord(options) {
         try {

            const fieldMap = [
               'custrecord_sdb_nrodoc',
               'custentity_elm_aprobado',
               'custentity_elm_reject_reason',
               'custentity_score',
               'custentity_calificacion',
               'custentity_response_score_bcu',
               'entitystatus',
               'custentity_sdb_valor_cuota',
               'custentity_sdb_montoofrecido',
               'custentity_elm_monto_cuota',
               'firstname',
               'lastname',
               'custentity_sdb_actividad',
               'custentity_sdb_infolab_importe',
               'custentity_sdb_fechanac',
               'custentity_elm_years_work',
               'email',
               'custentity_elm_lead_repetido_original',
               'isinactive',
            ]
               
            // Load source record to get field values
            const sourceRecord = record.load({
               type: options.sourceType,
               id: options.sourceId,
               isDynamic: false
            });
            
            // Prepare values object for submitFields
            const valuesToSubmit = {};
            
            // Add default values if provided
            if (options.defaultValues) {
               Object.assign(valuesToSubmit, options.defaultValues);
            }
            
            // Get fields to copy
            const fieldsToCopy = fieldMap;
            
            // Copy values from source record
            fieldsToCopy.forEach(sourceFieldId => {
               try {
                     const targetFieldId = options.fieldMap ? 
                        (options.fieldMap[sourceFieldId] || sourceFieldId) : 
                        sourceFieldId;
                     
                     // Skip if this field shouldn't be copied
                     if (targetFieldId === null) return;
                     
                     const value = sourceRecord.getValue({
                        fieldId: sourceFieldId
                     });
                     
                     // Only set if value exists
                     if (value !== '' && value !== null && value !== undefined) {
                        valuesToSubmit[targetFieldId] = value;
                     }
               } catch (fieldError) {
                     log.debug('Field copy error', 
                        'Could not copy field ' + sourceFieldId + ': ' + fieldError.message);
               }
            });
            // Validate targetId exists
            if (!options.targetId) {
               throw errorModule.create({
                  name: 'MISSING_TARGET_ID',
                  message: 'targetId is required for copyRecordToRecord',
                  notifyOff: true
               });
            }
            
            // Submit all values at once
            const resultId = record.submitFields({
               type: options.targetType || options.sourceType,
               id: options.targetId,
               values: valuesToSubmit,
               options: {
                     enableSourcing: true,
                     ignoreMandatoryFields: true
               }
            });
            
            log.audit('Record copied', 
               'Copied from ' + options.sourceType + ' ID: ' + options.sourceId + 
               ' to ' + (options.targetType || options.sourceType) + ' ID: ' + resultId);
            
            return resultId;
            
         } catch (e) {
            log.error('copyRecordToRecord error', e);
            throw errorModule.create({
               name: 'COPY_RECORD_TO_RECORD_ERROR',
               message: 'Error copying record from ' + options.sourceType + 
                        ' ID: ' + options.sourceId + 
                        ' to ' + (options.targetType || options.sourceType) + 
                        '. Details: ' + e.message,
               notifyOff: true
            });
         }
      }



      /**
       * checkVale - Checks if a record with the given document number exists in the Vale custom record type.
       * @param {string} docNumber - The document number to check.
       * @returns {Array} An array of objects containing the record ID, document number, and active status.
       */
      function checkVale(docNumber) {
         const stLogTitle = 'checkVale';
         try {
            const arrayDocNumber = [];
            const tieneValSS = search.create({
               type: "customrecord_elm_leads_con_vale",
               filters:
                  [
                  ["custrecord_elm_lead_nrodoc_vale","is",docNumber]
            ],
               columns:
                  [
                  search.createColumn({ name: "custrecord_elm_lead_activo_vale", sort: search.Sort.DESC }),
                  ]
            });

            tieneValSS.run().each(function (result) {
            const activo = result.getValue('custrecord_elm_lead_activo_vale');
               arrayDocNumber.push({
                  id: result.id,
                  docNumber: docNumber,
                  activo: activo 
               });
            return true; // Continue iterating  
            });

            return arrayDocNumber;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'CHECK_VALE_ERROR',
               message: 'Error checking Vale for document number: ' + docNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
     
     /**
       * validation_digit - Checks if a record with the given document number exists in the Vale custom record type.
       * @param {string} ci - The document number to check.
       * @returns {integer} 
       */
      function validation_digit(ci){
         try {
            let a = 0;
            let i = 0;
            if(ci.length <= 6){
               for(i = ci.length; i < 7; i++){
                  ci = '0' + ci;
               }
            }
            for(i = 0; i < 7; i++){
               a += (parseInt("2987634"[i]) * parseInt(ci[i])) % 10;
            }
            if(a%10 === 0){
               return 0;
            }else{
               return 10 - a % 10;
            }
         } catch (error) {
            log.error('validation_digit', error);
            throw errorModule.create({
               name: 'VALIDATION_DIGIT_ERROR',
               message: 'Error validating digit for CI: ' + ci + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }
       /**
       * validateCI - This function validates a document number to ensure it meets the minimum length requirement.
       * @param {string} docNumber - The document number to validate.
       * @returns {boolean} The number of years since the date.
       */
      function validateCI(ci){
        try {
            if (!/^\d+$/.test(ci)) {
               log.error( `CI contains invalid characters: ${ci}`);
               return false;
            }
          let dig = ci[ci.length - 1];
          ci = ci.replace(/[0-9]$/, '');
         return (dig == validation_digit(ci));
        } catch (error) {
          log.error(stLogTitle, error);
            return false;
        }
      }

      /**
       * validateAndFormatLastName - Validates and formats last name if it exceeds 32 characters
       * @param {string} lastName - The last name to validate
       * @returns {string} The formatted last name (cut to 32 chars if longer)
       */
      function validateAndFormatLastName(lastName) {
         const stLogTitle = 'validateAndFormatLastName';
         try {
            if (!lastName || typeof lastName !== 'string') {
               return lastName;
            }

            // Check if lastName exceeds 32 characters
            if (lastName.length > 32) {
               const truncatedName = lastName.substring(0, 32);
               log.debug(stLogTitle, `Last name exceeds 32 characters. Original: "${lastName}" (${lastName.length} chars), Truncated: "${truncatedName}"`);
               return truncatedName;
            }

            return lastName;
         } catch (error) {
            log.error(stLogTitle, error);
            return lastName; // Return original if validation fails
         }
      }

      /**
       * calculateTotalDebt - Helper function to calculate total debt (MN + ME) from rubrosValoresGenerales
       * Suma VIGENTE + VENCIDO + CASTIGADO (excluye CONTINGENCIAS)
       * This matches the logic used in score.js for calculating t2_mnPesos, t2_mePesos, etc.
       * @param {Array} rubrosGenerales - Array of rubros from BCU data
       * @returns {object} Object with totalMnPesos and totalMePesos
       */
      function calculateTotalDebt(rubrosGenerales) {
         if (!Array.isArray(rubrosGenerales) || rubrosGenerales.length === 0) {
            return { totalMnPesos: 0, totalMePesos: 0 };
         }

         let totalMnPesos = 0;
         let totalMePesos = 0;

         // Solo sumar VIGENTE, VENCIDO, CASTIGADO (excluir CONTINGENCIAS)
         const rubrosAIncluir = ['VIGENTE', 'VENCIDO', 'CASTIGADO'];

         rubrosGenerales.forEach(rubro => {
            const rubroNombre = (rubro.Rubro || rubro.rubro || '').toUpperCase();
            
            // Solo procesar rubros que no sean CONTINGENCIAS
            if (rubrosAIncluir.includes(rubroNombre)) {
               // Handle both camelCase and PascalCase properties
               const mnPesos = rubro.MnPesos || rubro.mnPesos || 0;
               const mePesos = rubro.MePesos || rubro.mePesos || 0;
               
               totalMnPesos += parseFloat(mnPesos) || 0;
               totalMePesos += parseFloat(mePesos) || 0;
            }
         });

         return { totalMnPesos, totalMePesos };
      }

      /**
       * getBcuPeriodInfo - This function extracts BCU period information from a given BCU data object.
       * @param {object} bcuData - The BCU data object (can be the full response or a specific period object).
       * @param {string} period - The period for which to extract the information ('t2' or 't6').
       * @returns {object} The extracted BCU data.
       */
      function getBcuPeriodInfo(bcuData, period) {
         const stLogTitle = 'getBcuPeriodInfo';
         try {
            // Si bcuData es null/undefined, retornar null
            if (!bcuData) {
               log.debug(stLogTitle, `No bcuData provided for period ${period}`);
               return null;
            }

            // bcuData ya ES el objeto del período (t2 o t6) directamente
            // Estructura esperada: { totals, entities, aggregates, rubrosValoresGenerales }
            const data = bcuData;
            
            // Intentar obtener rubrosValoresGenerales
            let rubrosGenerales = data?.rubrosValoresGenerales || data?.RubrosValoresGenerales;
            let totals = calculateTotalDebt(rubrosGenerales);
            
            log.debug(stLogTitle, `Period ${period}: rubrosGenerales=${rubrosGenerales?.length || 0}, totals=${JSON.stringify(totals)}`);
            
            // Si rubrosValoresGenerales está vacío o no tiene datos, usar aggregates
            if ((!totals.totalMnPesos && !totals.totalMePesos) && data?.aggregates) {
               const agg = data.aggregates;
               totals.totalMnPesos = (agg.vigente?.mn || 0) + (agg.vencido?.mn || 0) + (agg.castigado?.mn || 0);
               totals.totalMePesos = (agg.vigente?.me || 0) + (agg.vencido?.me || 0) + (agg.castigado?.me || 0);
               log.debug(stLogTitle, `Using aggregates for ${period}: MN=${totals.totalMnPesos}, ME=${totals.totalMePesos}`);
            }
            
            return {
               nombre: data?.nombre,
               documento: data?.documento,
               sectorActividad: data?.sectorActividad,
               periodo: data?.periodo,
               rubrosGenerales: rubrosGenerales,
               entidades: data?.entidadesRubrosValores || data?.entities,
               totalMnPesos: totals.totalMnPesos,
               totalMePesos: totals.totalMePesos,
               totalVigentePesos: rubrosGenerales?.find(r => (r.rubro || r.Rubro) === 'VIGENTE')?.mnPesos || rubrosGenerales?.find(r => (r.rubro || r.Rubro) === 'VIGENTE')?.MnPesos || 0,
               totalVigenteDolares: rubrosGenerales?.find(r => (r.rubro || r.Rubro) === 'VIGENTE')?.mnDolares || rubrosGenerales?.find(r => (r.rubro || r.Rubro) === 'VIGENTE')?.MnDolares || 0,
               errors: data?.errors || null
            };

         } catch (error) {
            log.error(stLogTitle, error);
            return null;
         }
      }

      /**
       * extractBcuData - This function extracts BCU data from a score response object.
       * @param {object} scoreResponse - The score response object.
       * @returns {object} The extracted BCU data.
       */
      function extractBcuData(scoreResponse) {
         const stLogTitle = 'extractBcuData';
         try {
            // Handle new structure with t2/t6 objects
            if (scoreResponse && (scoreResponse.t2 || scoreResponse.t6)) {
               const t2Data = scoreResponse.t2?.data || null;
               const t6Data = scoreResponse.t6?.data || null;

               // Extract qualifications from both periods
               const t2Qualifications = extractQualifications({ data: t2Data });
               const t6Qualifications = extractQualifications({ data: t6Data });

               return {
                  t2: scoreResponse.t2,
                  t6: scoreResponse.t6,
                  t2Qualifications: t2Qualifications,
                  t6Qualifications: t6Qualifications,
                  endeudamiento: scoreResponse.endeudamiento,
                  score: scoreResponse.score,
                  calificacionMinima: scoreResponse.calificacionMinima
               };
            }

            // Handle legacy structure with logTxt
            if (!scoreResponse?.logTxt) {
               log.debug(stLogTitle, 'No logTxt found in score response');
               return { t2: null, t6: null };
            }

            const logText = scoreResponse.logTxt;
            let t2Data = null;
            let t6Data = null;

            // Extract datosBcu (t2 data)
            const t2Match = logText.match(/=> datosBcu: <\/P>({.*?})<P\//s);
            if (t2Match?.[1]) {
               try {
                  t2Data = JSON.parse(t2Match[1]);
                  log.debug(stLogTitle, 'T2 data extracted successfully');
               } catch (e) {
                  log.error(stLogTitle, 'Error parsing T2 data: ' + e.message);
               }
            }

            // Extract datosBcu_T6 (t6 data)
            const t6Match = logText.match(/=> datosBcu_T6: <\/P>({.*?})<P\//s);
            if (t6Match?.[1]) {
               try {
                  t6Data = JSON.parse(t6Match[1]);
                  log.debug(stLogTitle, 'T6 data extracted successfully');
               } catch (e) {
                  log.error(stLogTitle, 'Error parsing T6 data: ' + e.message);
               }
            }

            // Extract qualifications from both periods
            const t2Qualifications = extractQualifications(t2Data);
            const t6Qualifications = extractQualifications(t6Data);

            return {
               t2: t2Data,
               t6: t6Data,
               t2Qualifications: t2Qualifications,
               t6Qualifications: t6Qualifications,
               endeudamiento: scoreResponse.endeudamiento,
               score: scoreResponse.score,
               calificacionMinima: scoreResponse.calificacionMinima
            };

         } catch (error) {
            log.error(stLogTitle, error);
            return { t2: null, t6: null };
         }
      }

      /**
       * extractBcuVariables - Extrae todas las variables BCU (T2/T6) desde un scoreResponse
       * Devuelve un objeto listo para usar con las 6 variables principales
       * @param {object} scoreResponse - El objeto de respuesta del score BCU
       * @returns {object} Objeto con: endeudT2, endeudT6, cantEntT2, cantEntT6, peorCalifT2, peorCalifT6
       */
      function extractBcuVariables(scoreResponse) {
         const stLogTitle = 'extractBcuVariables';
         
         // Valores por defecto
         const result = {
            endeudT2: 0,
            endeudT6: 0,
            cantEntT2: 0,
            cantEntT6: 0,
            peorCalifT2: '',
            peorCalifT6: ''
         };

         try {
            if (!scoreResponse) {
               log.debug(stLogTitle, 'No scoreResponse provided');
               return result;
            }

            // Orden de calificaciones de peor a mejor
            const RATING_ORDER = ['5', '4', '3', '2D', '2C', '2B', '2A', '1C', '1B', '1A'];
            
            // Helper: obtener la peor calificación de un array de entidades
            const getWorstRating = (entities) => {
               if (!Array.isArray(entities) || entities.length === 0) return '';
               let worstIndex = RATING_ORDER.length;
               entities.forEach(ent => {
                  const calif = ent.Calificacion || ent.calificacion || '';
                  const idx = RATING_ORDER.indexOf(calif);
                  if (idx !== -1 && idx < worstIndex) {
                     worstIndex = idx;
                  }
               });
               return worstIndex < RATING_ORDER.length ? RATING_ORDER[worstIndex] : '';
            };

            // Helper: convertir a número
            const toNum = (val) => parseFloat(val) || 0;

            // ============ PROCESAR T2 ============
            const t2Data = scoreResponse.t2;
            if (t2Data) {
               const t2Info = getBcuPeriodInfo(t2Data, 't2');
               if (t2Info) {
                  result.endeudT2 = toNum(t2Info.totalMnPesos) + toNum(t2Info.totalMePesos);
               }
               
               // Cantidad de entidades T2
               const t2Entities = t2Data.entities || t2Data.entidadesRubrosValores || [];
               result.cantEntT2 = Array.isArray(t2Entities) ? t2Entities.length : 0;
               
               // Peor calificación T2
               result.peorCalifT2 = getWorstRating(t2Entities);
            }

            // ============ PROCESAR T6 ============
            const t6Data = scoreResponse.t6;
            if (t6Data) {
               const t6Info = getBcuPeriodInfo(t6Data, 't6');
               if (t6Info) {
                  result.endeudT6 = toNum(t6Info.totalMnPesos) + toNum(t6Info.totalMePesos);
               }
               
               // Cantidad de entidades T6
               let t6Entities = t6Data.entities || t6Data.entidadesRubrosValores || [];
               
               // Fallback: si t6.entities está vacío, intentar extraer de logTxt
               if ((!Array.isArray(t6Entities) || t6Entities.length === 0) && scoreResponse.logTxt) {
                  const logText = scoreResponse.logTxt;
                  
                  // Intentar extraer t6_cantEntidades del logTxt
                  const cantEntMatch = logText.match(/t6_cantEntidades:\s*(\d+)/);
                  if (cantEntMatch) {
                     result.cantEntT6 = parseInt(cantEntMatch[1], 10) || 0;
                  }
                  
                  // Intentar extraer t6_peorCalif del logTxt
                  const peorCalifMatch = logText.match(/t6_peorCalif:\s*(\S+)/);
                  if (peorCalifMatch) {
                     result.peorCalifT6 = peorCalifMatch[1];
                  }
                  
                  log.debug(stLogTitle, `T6 from logTxt: cantEnt=${result.cantEntT6}, peorCalif=${result.peorCalifT6}`);
               } else {
                  result.cantEntT6 = Array.isArray(t6Entities) ? t6Entities.length : 0;
                  result.peorCalifT6 = getWorstRating(t6Entities);
               }
            }
            
            // ============ FALLBACK FINAL: extraer de logTxt si endeudT6 es 0 ============
            if (result.endeudT6 === 0 && scoreResponse.logTxt) {
               const logText = scoreResponse.logTxt;
               
               // Buscar t6_mnPesos y t6_mePesos en logTxt (formato: <P>t6_mnPesos: VALOR</P>)
               const t6MnMatch = logText.match(/t6_mnPesos:\s*([\d.-]+)/i);
               const t6MeMatch = logText.match(/t6_mePesos:\s*([\d.-]+)/i);
               if (t6MnMatch || t6MeMatch) {
                  const t6Mn = toNum(t6MnMatch?.[1]);
                  const t6Me = toNum(t6MeMatch?.[1]);
                  // Solo usar valores positivos (el score usa -1 como indicador de no disponible)
                  if (t6Mn > 0 || t6Me > 0) {
                     result.endeudT6 = (t6Mn > 0 ? t6Mn : 0) + (t6Me > 0 ? t6Me : 0);
                     log.debug(stLogTitle, `T6 endeud from logTxt: mn=${t6Mn}, me=${t6Me}, total=${result.endeudT6}`);
                  }
               }
               
               // Si cantEntT6 sigue en 0, intentar extraer de logTxt (formato: <P>t6.entities.length: VALOR</P>)
               if (result.cantEntT6 === 0) {
                  const cantEntMatch = logText.match(/t6\.entities\.length:\s*(\d+)/i);
                  if (cantEntMatch) {
                     result.cantEntT6 = parseInt(cantEntMatch[1], 10) || 0;
                     log.debug(stLogTitle, `T6 cantEnt from logTxt: ${result.cantEntT6}`);
                  }
               }
               
               // Si peorCalifT6 sigue vacío, buscar en T6 Entity en logTxt (formato: T6 Entity[X]: NAME | Calif: CALIFICACION)
               if (!result.peorCalifT6) {
                  const t6CalifMatches = logText.match(/T6 Entity\[\d+\]:[^|]+\|\s*Calif:\s*([^|\s<]+)/gi);
                  if (t6CalifMatches && t6CalifMatches.length > 0) {
                     const t6Califs = t6CalifMatches.map(m => {
                        const califMatch = m.match(/Calif:\s*([^|\s<]+)/i);
                        return califMatch ? califMatch[1] : null;
                     }).filter(c => c);
                     
                     // Encontrar la peor calificación
                     if (t6Califs.length > 0) {
                        result.peorCalifT6 = getWorstRating(t6Califs.map(c => ({ Calificacion: c })));
                        log.debug(stLogTitle, `T6 peorCalif from logTxt: ${result.peorCalifT6}`);
                     }
                  }
               }
            }

            log.debug(stLogTitle, `BCU Variables: endeudT2=${result.endeudT2}, endeudT6=${result.endeudT6}, ` +
               `cantEntT2=${result.cantEntT2}, cantEntT6=${result.cantEntT6}, ` +
               `peorCalifT2=${result.peorCalifT2}, peorCalifT6=${result.peorCalifT6}`);

            return result;

         } catch (error) {
            log.error(stLogTitle, `Error extracting BCU variables: ${error.message}`);
            return result;
         }
      }

      /**
       * deactivateLeadsByDocumentNumber - Deactivates all leads with the specified document number.
       * @param {string} documentNumber - The document number to search for.
       * @returns {boolean} True if any leads were deactivated, false otherwise.
       */
      function deactivateLeadsByDocumentNumberSQL(documentNumber) {
      const stLogTitle = 'deactivateLeadsByDocumentNumberSQL';
      try {
         if (!documentNumber) return false;

         // 1) Buscar IDs de leads “padre” activos que cumplen la condición
         //    Equivalente a tu saved search de padres:
         //    - stage = LEAD
         //    - status in (7,6)
         //    - datecreated before lastmonthtodate (aprox con ADD_MONTHS/TRUNC)
         //    - nro documento
         //    - lead_repetido_original IS NULL
         //    - activo
         const parentSql = `
            SELECT
               id
            FROM
               customer
            WHERE
               stage = 'LEAD'
               AND entitystatus IN (6, 7)
               AND datecreated < ADD_MONTHS(TRUNC(SYSDATE), -1)
               AND custentity_sdb_nrdocumento = '${documentNumber}'
               AND custentity_elm_lead_repetido_original IS NULL
               AND isinactive = 'F'
         `;

         const parentResult = query.runSuiteQL({
            query: parentSql,
            params: [documentNumber]
         });

         const parentRows = parentResult.asMappedResults() || [];
         const parentIds = parentRows.map(r => r.id);

         let parentsUpdated = 0;
         parentIds.forEach(id => {
            record.submitFields({
               type: record.Type.LEAD,
               id: id,
               values: { isinactive: true },
               options: { enableSourcing: false, ignoreMandatoryFields: true }
            });
            parentsUpdated++;
         });

         // 2) Buscar hijos (leads que referencian a alguno de esos padres)
         //    Equivalente a tu segunda saved search:
         //    - stage = LEAD
         //    - nro documento
         //    - activo
         //    - custentity_elm_lead_repetido_original anyof parentIds
         let childrenUpdated = 0;

         if (parentIds.length) {
            const inPlaceholders = parentIds.map(() => '?').join(',');
            const childSql = `
               SELECT
                  id
               FROM
                  customer
               WHERE
                  stage = 'LEAD'
                  AND custentity_sdb_nrdocumento = '${documentNumber}'
                  AND isinactive = 'F'
                  AND custentity_elm_lead_repetido_original IN (${inPlaceholders})
            `;

            const childParams = [documentNumber].concat(parentIds);

            const childResult = query.runSuiteQL({
               query: childSql,
               params: childParams
            });

            const childRows = childResult.asMappedResults() || [];

            childRows.forEach(r => {
               record.submitFields({
                  type: record.Type.LEAD,
                  id: r.id,
                  values: { isinactive: true },
                  options: { enableSourcing: false, ignoreMandatoryFields: true }
               });
               childrenUpdated++;
            });
         }

         const totalDeactivated = parentsUpdated + childrenUpdated;
         log.debug(stLogTitle, {
            documentNumber: documentNumber,
            parentsUpdated: parentsUpdated,
            childrenUpdated: childrenUpdated,
            totalDeactivated: totalDeactivated,
            allLeadsDeactivated: totalDeactivated > 0
         });

         return totalDeactivated > 0;

      } catch (error) {
         log.error(stLogTitle, error);
         return false;
      }
      }

      /**
       * extractQualifications - Extracts qualification values from BCU data
       * @param {object} bcuData - The BCU data object
       * @returns {Array} Array of qualification values
       */
      function extractQualifications(bcuData) {
         const stLogTitle = 'extractQualifications';
         try {
            // Handle new structure
            if (bcuData?.data?.entidadesRubrosValores) {
               const qualifications = [];
               bcuData.data.entidadesRubrosValores.forEach(entidad => {
                  if (entidad.calificacion) {
                     qualifications.push({
                        entidad: entidad.nombreEntidad,
                        calificacion: entidad.calificacion
                     });
                  }
               });
               return qualifications;
            }

            // Handle legacy structure
            if (!bcuData?.data?.EntidadesRubrosValores) {
               return [];
            }

            const qualifications = [];
            bcuData.data.EntidadesRubrosValores.forEach(entidad => {
               if (entidad.Calificacion) {
                  qualifications.push({
                     entidad: entidad.NombreEntidad,
                     calificacion: entidad.Calificacion
                  });
               }
            });

            return qualifications;
         } catch (error) {
            log.error(stLogTitle, error);
            return [];
         }
      }
 
      /**
       * deactivateLeadsByDocumentNumber - Deactivates all leads with the specified document number.
       * @param {string} documentNumber - The document number to search for.
       * @returns {boolean} True if any leads were deactivated (indicating all active leads are now inactive), false otherwise.
       */
      function deactivateLeadsByDocumentNumber(documentNumber) {
         const stLogTitle = 'deactivateLeadsByDocumentNumber';
         try {
            if (!documentNumber) return false;

            // 1) Buscar leads “padre” activos y desactivarlos
            const parentIds = [];
            const parentSearch = search.create({
               type: 'lead',
               filters: [
                  ['stage', 'anyof', 'LEAD'],
                  'AND',
                  ['status', 'anyof', '7', '6'],
                  'AND',
                  ['datecreated', 'before', 'lastmonthtodate'],
                  'AND',
                  ['custentity_sdb_nrdocumento', 'is', documentNumber],
                  'AND',
                  ['custentity_elm_lead_repetido_original', 'anyof', '@NONE@'],
                  'AND',
                  ['isinactive', 'is', 'F']
               ],
               columns: [ search.createColumn({ name: 'internalid' }) ]
            });

            let parentsUpdated = 0;
            parentSearch.run().each(function (res) {
               const id = res.getValue({ name: 'internalid' }) || res.id;
               parentIds.push(id);
               record.submitFields({
                  type: record.Type.LEAD,
                  id: id,
                  values: { isinactive: true },
                  options: { enableSourcing: false, ignoreMandatoryFields: true }
               });
               parentsUpdated++;
               return true;
            });

            // 2) Desactivar “hijos” en lotes usando anyof
            let childrenUpdated = 0;
            if (parentIds.length) {
               const childSearch = search.create({
                  type: 'lead',
                  filters: [
                     ['stage', 'anyof', 'LEAD'],
                     'AND',
                     ['custentity_sdb_nrdocumento', 'is', documentNumber],
                     'AND',
                     ['isinactive', 'is', 'F'],
                     'AND',
                     ['custentity_elm_lead_repetido_original', 'anyof', parentIds]
                  ],
                  columns: [ search.createColumn({ name: 'internalid' }) ]
               });

               childSearch.run().each(function (res) {
                  const cid = res.getValue({ name: 'internalid' }) || res.id;
                  record.submitFields({
                     type: record.Type.LEAD,
                     id: cid,
                     values: { isinactive: true },
                     options: { enableSourcing: false, ignoreMandatoryFields: true }
                  });
                  childrenUpdated++;
                  return true;
               });
            }

            const totalDeactivated = parentsUpdated + childrenUpdated;
            log.debug(stLogTitle, { 
               parentsUpdated: parentsUpdated, 
               childrenUpdated: childrenUpdated,
               totalDeactivated: totalDeactivated,
               allLeadsDeactivated: totalDeactivated > 0
            });

            // Retornar true si se desactivó al menos 1 lead (indica que todos los activos están ahora inactivos)
            return totalDeactivated > 0;

         } catch (error) {
            log.error(stLogTitle, error);
            // En caso de error, retornar false (asumir que no se desactivó nada)
            return false;
         }
      }
      /**
       * findLeadsByDocumentNumber - Finds all leads with the specified document number.
       * @param {string} documentNumber - The document number to search for.
       */
       function findLeadsByDocumentNumber(documentNumber, leadInternald) {
         const stLogTitle = 'findLeadsByDocumentNumber';
         try {
            const leads = [];
            const leadSearch = search.create({
                  type: "lead",
                  filters:
                  [
                     ["stage","anyof","LEAD"/* ,"CUSTOMER" */], 
                     "AND",
                     ["custentity_sdb_nrdocumento", "is", documentNumber],
                     "AND",
                     ["isinactive", "is", false],
                     "AND",
                     ["custentity_elm_lead_repetido_original", "anyof", leadInternald]
               ],
               columns: [
                  search.createColumn({ name: "internalid" })
               ]
            });
            leadSearch.run().each(function (result) {
               leads.push({
                  id: result.getValue('internalid')
               });
               return true;
            });
            return leads;
         } catch (error) {
            log.error(stLogTitle, error);
            throw errorModule.create({
               name: 'FIND_LEADS_BY_DOCUMENT_NUMBER_ERROR',
               message: 'Error finding leads by document number: ' + documentNumber + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }

      /**
       * snapchotAprobados - Crea un registro de snapshot de aprobados si no existe para la combinación (doc, lead, estado)
       * Basado en createListRepetido
       * @param {string} docNumber - Nro de Documento (custrecord_elm_apr_doc)
       * @param {number|string} leadId - Internal ID del Lead/Customer (custrecord_elm_apr_lead)
       * @param {number|string} estadoGestionId - Internal ID del estado de gestión (custrecord_elm_apr_gestion)
       * @param {string} canal - Canal de origen (custrecord_elm_apr_canal)
       * @returns {string|null} ID del registro creado o existente; null si falla
       */
      function snapshotAprobados(docNumber, leadId, estadoGestionId, canal) {
         const stLogTitle = 'snapshotAprobados';
         try {
            if (!docNumber) {
               throw errorModule.create({
                  name: 'SNAPSHOT_PARAMS_ERROR',
                  message: 'Parámetros requeridos: docNumber',
                  notifyOff: true
               });
            }

            const count = search.create({
               type: 'customrecord_elm_apr_lead_his',
               filters: [
                  ['custrecord_elm_apr_doc', 'is', docNumber],
                  "AND", 
                  ["created","within","monthsago1","secondsago0"],
               ],
               columns: [search.createColumn({ name: 'internalid', sort: search.Sort.DESC })]
            }).runPaged().count;

            if (count > 0) {
               // Recuperar el último ID existente por claridad
               let existingId = null;
               search.create({
                  type: 'customrecord_elm_apr_lead_his',
                  filters: [
                     ['custrecord_elm_apr_doc', 'is', docNumber]
                  ],
                  columns: [search.createColumn({ name: 'internalid', sort: search.Sort.DESC })]
               }).run().each(function (result) {
                  existingId = result.id; return false;
               });
               log.debug(stLogTitle, 'Snapshot ya existente. ID: ' + existingId);
               return existingId;
            }

            const recSnap = record.create({ type: 'customrecord_elm_apr_lead_his', isDynamic: false });
            recSnap.setValue({ fieldId: 'custrecord_elm_apr_doc', value: String(docNumber) });
            if (leadId) {
                recSnap.setValue({ fieldId: 'custrecord_elm_apr_lead', value: parseInt(leadId, 10) || String(leadId) });
            }

            if (canal) {
               recSnap.setValue({ fieldId: 'custrecord_elm_apr_canal', value: canal });
            }
           
            recSnap.setValue({ fieldId: 'custrecord_elm_apr_gestion', value: parseInt(estadoGestionId, 10) || String(estadoGestionId) });
            const snapId = recSnap.save();
            log.audit(stLogTitle, 'Snapshot creado con ID: ' + snapId);
            return snapId;
         } catch (error) {
            log.error(stLogTitle, error);
            return null;
         }
      }

      /**
       * createLogRecord - Creates a log record for the service request.   
       * @param {string} nroDocumento - The document number associated with the request.
       * @param {string} responseDetail - The details of the response from the service.
       * @param {boolean} success - Indicates whether the request was successful.
       * @param {string} service - The name of the service being logged.
       * @param {string} proveedorId - The ID of the provider associated with the request.
       * @param {object} dataRow - The raw data row associated with the request.
       */
      function createLogRecord(nroDocumento, responseDetail, success, service, proveedorId, dataRow) {
         const logTitle = 'createLog';
         try {
            const post = record.create({
               type: 'customrecord_elm_serv_logs',
               isDynamic: true
            });
            post.setValue({
               fieldId: 'custrecord_logs_nrodocum',
               value: nroDocumento
            });
            post.setValue({
               fieldId: 'custrecord_elm_logs_resp',
               value: responseDetail
            });
            post.setValue({
               fieldId: 'custrecord_elm_logs_success',
               value: success
            });
            post.setValue({
               fieldId: 'custrecord_elm_logs_serv_script',
               value: service
            });
            if (proveedorId) {
                post.setValue({
                  fieldId: 'custrecord_elm_logs_serv_proveedor',
                  value: proveedorId
               });
            }

            if (dataRow) {
                post.setValue({
                  fieldId: 'custrecord_elm_logs_info_bruta',
                  value: dataRow
               });
            }
           
            return post.save();
         } catch (error) {
            log.error(logTitle, 'Error creating log: ' + error);
            throw errorModule.create({
               name: 'CREATE_LOG_ERROR',
               message: 'Error creating log for document number: ' + nroDocumento + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }  
      /**
       * createLogRecord - Creates a log record for the service request.   
       * @param {string} logId - The document number associated with the request.
       * @param {string} responseDetail - The details of the response from the service.
       * @param {boolean} success - Indicates whether the request was successful.
       * @param {string} responseRaw - The name of the service being logged.
       * @param {object} dataRow - The raw data row associated with the request.
       */
      function updateLogWithResponse(logId, responseDetail, success, responseRaw, dataRow) {
         const logTitle = 'updateLogWithResponse';
         try {

           const values = {
               'custrecord_elm_logs_resp': responseDetail,
               'custrecord_elm_logs_success': success,
               'custrecord_logs_respuesta': responseRaw
            };

            if (dataRow) {
               values['custrecord_elm_logs_info_bruta'] = dataRow;
            }

           record.submitFields({
               type: 'customrecord_elm_serv_logs',
               id: logId,
               values: values,
               options: {
                  enableSourcing: false,
                  ignoreMandatoryFields: true
               }
            });
         } catch (error) {
            log.error(logTitle, 'Error updating log: ' + error);
            throw errorModule.create({
               name: 'UPDATE_LOG_ERROR',
               message: 'Error updating log for document number: ' + logId + '. Details: ' + error.message,
               notifyOff: true
            });
         }
      }

      /**
       * isEmployeActive - Checks if an employee is active based on their internal ID.
       * @param {number} employeeId - The internal ID of the employee to check.
       * @return {boolean} True if the employee is active, otherwise false.
       * */
         function isEmployeActive(employeeId) {
         try {
               const employeeSearchObj = search.create({
                  type: "employee",
                  filters:
                  [
                     ["internalid","anyof",employeeId], 
                     "AND", 
                     ["custentity_elm_activo","is","T"]
                  ],
                  columns:
                  [
                     search.createColumn({name: "internalid", label: "Inernal ID"}),
                  ]
                  });
                  const searchResultCount = employeeSearchObj.runPaged().count;

                  return searchResultCount > 0;

         } catch (error) {
               return false;
         }
      }

        /**
       * Create a Record Audit Cambios record
       * @param {Object} options - Configuration object
       * @param {string} options.notas - Notes/comments about the change
       * @param {string} options.usuario - User who made the change (employee internal ID)
       * @param {string} options.record - Record reference or ID
       * @param {string} options.tipo - Type of record audit
       * @param {string} options.changeDetails - Additional change details (optional)
       * @param {string} options.recordType - Type of the record being audited (optional)
       * @param {string} options.recordId - Internal ID of the record being audited (optional)
       * @returns {string|null} Internal ID of created record or null if failed
       */
    function createRecordAuditCambios(options) {
        const stLogTitle = 'createRecordAuditCambios'; 
        try {
            if (!options) {
                throw new Error('Options parameter is required');
            }
            // Validate required fields
            if (!options.notas) {
                throw new Error('Notas field is required');
            }
            // Create the custom record
            const auditRecord = record.create({
                type: 'customrecord_elm_record_cambios',
                isDynamic: false
            });

            // Notes field - Long Text field
            auditRecord.setValue({
                fieldId: 'custrecord_elm_notas_cambios',
                value: options.notas
            });

            // Usuario field - Employee reference
            if (options.usuario) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_usuario_cambios',
                    value: options.usuario
                });
            } 

            // Record field - Free-Form Text field
            if (options.record) {
                auditRecord.setValue({
                    fieldId: 'custrecord_elm_record_cambios',
                    value: options.record
                });
            }

            // Tipo field - appears to be a list/select field
            if (options.tipo) {
                auditRecord.setValue({
                    fieldId: 'custrecord_list_type_cambios',
                    value: options.tipo
                });
            }
            // Save the record
            const recordId = auditRecord.save();
            log.audit(stLogTitle, `Record Audit Cambios created successfully with ID: ${recordId}`);
            return recordId;

        } catch (error) {
            log.error(stLogTitle, error);
            return null;
        }
    }

   /**
    * Crea un registro de Solicitud Vale (padre) y automáticamente crea la Etapa Solicitud (hijo)
    * @param {Object} options - Objeto con los valores para el registro
    * @param {number|string} [options.leadId] - Internal ID del Lead/Cliente (custrecord_elm_sol_cliente)
    * @param {number|string} [options.estadoGestion] - Internal ID del Estado de Gestión (custrecord_elm_sol_est_gestion)
    * @param {number|string} [options.operadorId] - Internal ID del Operador/Employee (custrecord_elm_sol_operador)
    * @param {number|string} [options.canalId] - Internal ID del Canal/Source (custrecord_elm_sol_canal)
    * @param {number|string} [options.servicioId] - Internal ID del Servicio (custrecord_elm_sol_servicio)
    * @param {number|string} [options.motivoRechazoId] - Internal ID del Motivo de Rechazo (custrecord_elm_motivo_rechazo)
    * @param {number|string} [options.montoCuotaId] - Internal ID del Monto Cuota (custrecord_elm_sol_monto_cuota)
    * @param {number|string} [options.productoId] - Internal ID del Producto (custrecord_elm_sol_producto)
    * @param {number} [options.montoSolicitado] - Monto Solicitado (custrecord_elm_sol_monto_sol)
    * @param {number} [options.montoOtorgado] - Monto Otorgado (custrecord_elm_sol_monto_otorgado)
    * @param {number} [options.plazo] - Plazo en meses (custrecord_elm_sol_plazo)
    * @param {number|string} [options.subEstadoId] - Internal ID del Sub-Estado (custrecord_elm_sol_sub_estado)
    * @param {string} [options.batchId] - Batch ID (custrecord_elm_sol_batch_id)
    * @param {number} [options.valorCuota] - Valor de la Cuota (custrecord_elm_sol_valor_cuota_)
    * @param {string} [options.tablaCalculoPrestamo] - HTML Tabla Cálculo Préstamo (custrecord_calculo_prestamo)
    * @param {string} [options.tablaResultados] - HTML Tabla de Resultados (custrecordelm_sol_tabla_oferta)
    * @param {string|number} [options.score] - Score BCU (custrecord_elm_sol_score)
    * @param {string} [options.calificacion] - Calificación BCU (custrecord_elm_cal_d)
    * @param {string|number} [options.entidades] - Cantidad de Entidades (custrecord_elm_slol_entidades)
    * @param {string} [options.nroDocumento] - Número de Documento (custrecord_elm_sol_nro_doc)
    * @param {number|string} [options.actividadId] - Internal ID de la Actividad (custrecord_elm_sol_acti)
    * @param {string|number} [options.salario] - Salario (custrecord_elm_sol_salario)
    * @param {string} [options.comentarioEtapa] - Comentario para la etapa inicial (custrecord_elm_etapa_comentario)
    * @param {boolean} [options.crearEtapa=true] - Si debe crear automáticamente la etapa hijo
    * @returns {Object|null} Objeto con { solicitudId, etapaId } o null si falla
    */
   function createSolicitudVale(options) {
      const stLogTitle = 'createSolicitudVale';
      options = options || {};
      
      try {
         const rec = record.create({
            type: 'customrecord_elm_solicitud',
            isDynamic: false
         });

         // Lead/Cliente - List/Record (Customer)
         if (options.leadId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_cliente', value: options.leadId });
         }

         // Estado de Gestión - List/Record (Estados)
         if (options.estadoGestion) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_est_gestion', value: options.estadoGestion });
         }

         // Operador - List/Record (Employee)
         if (options.operadorId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_operador', value: options.operadorId });
         }

         // Canal - List/Record (Source)
         if (options.canalId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_canal', value: options.canalId });
         }

         // Servicio - List/Record (Servicios)
         if (options.servicioId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_servicio', value: options.servicioId });
         }

         // Motivo de Rechazo - List/Record
         if (options.motivoRechazoId) {
            rec.setValue({ fieldId: 'custrecord_elm_motivo_rechazo', value: options.motivoRechazoId });
         }

         // Monto Cuota - List/Record
         if (options.montoCuotaId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_monto_cuota', value: options.montoCuotaId });
         }

         // Producto - List/Record
         if (options.productoId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_producto', value: options.productoId });
         }

         // Monto Solicitado - Currency
         if (options.montoSolicitado !== undefined && options.montoSolicitado !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_monto_sol', value: options.montoSolicitado });
         }

         // Monto Otorgado - Currency
         if (options.montoOtorgado !== undefined && options.montoOtorgado !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_monto_otorgado', value: options.montoOtorgado });
         }

         // Plazo - Integer Number
         if (options.plazo !== undefined && options.plazo !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_plazo', value: parseInt(options.plazo, 10) });
         }

         // Sub-Estado - List/Record
         if (options.subEstadoId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_sub_estado', value: options.subEstadoId });
         }

         // Batch ID - Free-Form Text
         if (options.batchId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_batch_id', value: String(options.batchId) });
         }

         // Valor Cuota - Decimal Number
         if (options.valorCuota !== undefined && options.valorCuota !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_valor_cuota_', value: options.valorCuota });
         }

         // Tabla Cálculo Préstamo - Rich Text
         if (options.tablaCalculoPrestamo) {
            rec.setValue({ fieldId: 'custrecord_calculo_prestamo', value: options.tablaCalculoPrestamo });
         }

         // Tabla de Resultados - Rich Text
         if (options.tablaResultados) {
            rec.setValue({ fieldId: 'custrecordelm_sol_tabla_oferta', value: options.tablaResultados });
         }

         // Score - Free-Form Text (Tab: Información Cliente Historico)
         if (options.score !== undefined && options.score !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_score', value: String(options.score) });
         }

         // Calificación - Free-Form Text (Tab: Información Cliente Historico)
         if (options.calificacion) {
            rec.setValue({ fieldId: 'custrecord_elm_cal_d', value: String(options.calificacion) });
         }

         // Entidades - Free-Form Text (Tab: Información Cliente Historico)
         if (options.entidades !== undefined && options.entidades !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_slol_entidades', value: String(options.entidades) });
         }

         // Nro de Documento - Free-Form Text (Tab: Información Cliente Historico)
         if (options.nroDocumento) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_nro_doc', value: String(options.nroDocumento) });
         }

         // Actividad - List/Record (Tab: Información Cliente Historico)
         if (options.actividadId) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_acti', value: options.actividadId });
         }

         // Salario - Free-Form Text (Tab: Información Cliente Historico)
         if (options.salario !== undefined && options.salario !== null) {
            rec.setValue({ fieldId: 'custrecord_elm_sol_salario', value: String(options.salario) });
         }

         // Guardar registro padre (Solicitud Vale)
         const solicitudId = rec.save();
         log.audit(stLogTitle, 'Solicitud Vale created with id: ' + solicitudId);

         // Crear etapa hijo automáticamente (si no se indica lo contrario)
         let etapaId = null;
         if (options.crearEtapa && solicitudId) {
            etapaId = createEtapaSolicitud({
               solicitudId: solicitudId,
               estadoGestion: options.estadoGestion,
               usuarioId: options.operadorId,
               comentario: options.comentarioEtapa,
               motivoRechazoId: options.motivoRechazoId
            });
         }

         return solicitudId;

      } catch (error) {
         log.error(stLogTitle, 'Error creating Solicitud Vale: ' + error.message);
         return null;
      }
   }


   function findSolicitudVigenteByLead(leadId) {
      const stLogTitle = 'findSolicitudVigenteByLead';
      try {
         const solicitudes = [];
         const solicitudSearch = search.create({
               type: "customrecord_elm_solicitud",
               filters:
               [
                  ["custrecord_elm_sol_cliente","anyof",leadId],
                  "AND",
                 ["created","within","monthsago1","secondsago0"],  
            ],
            columns: [
               search.createColumn({ name: "internalid" })
            ]
         });
         solicitudSearch.run().each(function (result) {
            solicitudes.push({
               id: result.getValue('internalid')
            });
            return true;
         });
         return solicitudes;
      } catch (error) {
         log.error(stLogTitle, error);
         throw errorModule.create({
            name: 'FIND_SOLICITUD_VIGENTE_BY_LEAD_ERROR',
            message: 'Error finding Solicitud Vigente by Lead ID: ' + leadId + '. Details: ' + error.message,
            notifyOff: true
         });
      }
   }


   /**
    * Crea un registro de Etapa Solicitud (hijo de Solicitud Vale)
    * @param {Object} options - Objeto con los valores para el registro
    * @param {number|string} options.solicitudId - Internal ID de la Solicitud Vale padre (custrecord_elm_etapa_sol)
    * @param {number|string} [options.estadoGestion] - Internal ID del Estado de Gestión (custrecord_elm_est_gestion_etapa)
    * @param {number|string} [options.usuarioId] - Internal ID del Usuario/Employee (custrecord_elm_etapa_usuario)
    * @param {string} [options.comentario] - Comentario (custrecord_elm_etapa_comentario)
    * @param {number|string} [options.motivoRechazoId] - Internal ID del Motivo de Rechazo (custrecord_elm_etapa_motivo_rechazo)
    * @returns {number|null} Internal ID del registro creado o null si falla
    */
   function createEtapaSolicitud(options) {
      const stLogTitle = 'createEtapaSolicitud';
      options = options || {};
      
      try {
         if (!options.solicitudId) {
            log.error(stLogTitle, 'solicitudId es requerido');
            return null;
         }

         const rec = record.create({
            type: 'customrecord_elm_etapa_sol',
            isDynamic: false
         });

         // Solicitud - List/Record (Solicitud Vale) - REQUERIDO
         rec.setValue({ fieldId: 'custrecord_elm_etapa_sol', value: options.solicitudId });

         // Estado de Gestión (Etapa) - List/Record (Estados)
         if (options.estadoGestion) {
            rec.setValue({ fieldId: 'custrecord_elm_est_gestion_etapa', value: options.estadoGestion });
         }

         // Usuario - List/Record (Employee)
         if (options.usuarioId) {
            rec.setValue({ fieldId: 'custrecord_elm_etapa_usuario', value: options.usuarioId });
         }

         // Comentario - Long Text
         if (options.comentario) {
            rec.setValue({ fieldId: 'custrecord_elm_etapa_comentario', value: String(options.comentario) });
         }

         // Motivo de Rechazo (Etapa) - List/Record
         if (options.motivoRechazoId) {
            rec.setValue({ fieldId: 'custrecord_elm_etapa_motivo_rechazo', value: options.motivoRechazoId });
         }

         // Guardar registro
         const etapaId = rec.save();
         log.audit(stLogTitle, 'Etapa Solicitud created with id: ' + etapaId + ' for Solicitud: ' + options.solicitudId);
         return etapaId;

      } catch (error) {
         log.error(stLogTitle, 'Error creating Etapa Solicitud: ' + error.message);
         return null;
      }
   }

   /**
    * Actualiza un registro de Solicitud Vale (padre) y crea una nueva Etapa Solicitud (hijo) si el estado de gestión cambia
    * @param {Object} options - Objeto con los valores para actualizar el registro
    * @param {number|string} options.solicitudId - Internal ID de la Solicitud Vale a actualizar (REQUERIDO)
    * @param {number|string} [options.leadId] - Internal ID del Lead/Cliente (custrecord_elm_sol_cliente)
    * @param {number|string} [options.estadoGestion] - Internal ID del Estado de Gestión (custrecord_elm_sol_est_gestion)
    * @param {number|string} [options.operadorId] - Internal ID del Operador/Employee (custrecord_elm_sol_operador)
    * @param {number|string} [options.canalId] - Internal ID del Canal/Source (custrecord_elm_sol_canal)
    * @param {number|string} [options.servicioId] - Internal ID del Servicio (custrecord_elm_sol_servicio)
    * @param {number|string} [options.motivoRechazoId] - Internal ID del Motivo de Rechazo (custrecord_elm_motivo_rechazo)
    * @param {number|string} [options.montoCuotaId] - Internal ID del Monto Cuota (custrecord_elm_sol_monto_cuota)
    * @param {number|string} [options.productoId] - Internal ID del Producto (custrecord_elm_sol_producto)
    * @param {number} [options.montoSolicitado] - Monto Solicitado (custrecord_elm_sol_monto_sol)
    * @param {number} [options.montoOtorgado] - Monto Otorgado (custrecord_elm_sol_monto_otorgado)
    * @param {number} [options.plazo] - Plazo en meses (custrecord_elm_sol_plazo)
    * @param {number|string} [options.subEstadoId] - Internal ID del Sub-Estado (custrecord_elm_sol_sub_estado)
    * @param {string} [options.batchId] - Batch ID (custrecord_elm_sol_batch_id)
    * @param {number} [options.valorCuota] - Valor de la Cuota (custrecord_elm_sol_valor_cuota_)
    * @param {string} [options.tablaCalculoPrestamo] - HTML Tabla Cálculo Préstamo (custrecord_calculo_prestamo)
    * @param {string} [options.tablaResultados] - HTML Tabla de Resultados (custrecordelm_sol_tabla_oferta)
    * @param {string|number} [options.score] - Score BCU (custrecord_elm_sol_score)
    * @param {string} [options.calificacion] - Calificación BCU (custrecord_elm_cal_d)
    * @param {string|number} [options.entidades] - Cantidad de Entidades (custrecord_elm_slol_entidades)
    * @param {string} [options.nroDocumento] - Número de Documento (custrecord_elm_sol_nro_doc)
    * @param {number|string} [options.actividadId] - Internal ID de la Actividad (custrecord_elm_sol_acti)
    * @param {string|number} [options.salario] - Salario (custrecord_elm_sol_salario)
    * @param {string} [options.comentarioEtapa] - Comentario para la nueva etapa (si se crea)
    * @param {boolean} [options.forzarCrearEtapa=false] - Si es true, crea etapa aunque el estado no cambie
    * @returns {Object|null} Objeto con { solicitudId, etapaId, estadoCambiado } o null si falla
    */
   function updateSolicitudVale(options) {
      const stLogTitle = 'updateSolicitudVale';
      options = options || {};
      
      try {

         log.debug(stLogTitle, 'Update options: ' + JSON.stringify(options));
         if (!options.solicitudId) {
            log.error(stLogTitle, 'solicitudId es requerido');
            return null;
         }

         // Obtener el estado de gestión actual para comparar
         const lookupResult = search.lookupFields({
            type: 'customrecord_elm_solicitud',
            id: options.solicitudId,
            columns: ['custrecord_elm_sol_est_gestion']
         });
         
         // Normalizar a string para comparación consistente
         const estadoActualRaw = lookupResult.custrecord_elm_sol_est_gestion && lookupResult.custrecord_elm_sol_est_gestion[0] 
            ? lookupResult.custrecord_elm_sol_est_gestion[0].value 
            : null;
         const estadoActual = estadoActualRaw ? String(estadoActualRaw) : null;

         // Construir objeto de valores a actualizar
         const values = {};

         // Lead/Cliente
         if (options.leadId) {
            values['custrecord_elm_sol_cliente'] = options.leadId;
         }

         // Estado de Gestión
         if (options.estadoGestion) {
            values['custrecord_elm_sol_est_gestion'] = options.estadoGestion;
         }

         // Operador
         if (options.operadorId) {
            values['custrecord_elm_sol_operador'] = options.operadorId;
         }

         // Canal
         if (options.canalId) {
            values['custrecord_elm_sol_canal'] = options.canalId;
         }

         // Servicio
         if (options.servicioId) {
            values['custrecord_elm_sol_servicio'] = options.servicioId;
         }

         // Motivo de Rechazo
         if (options.motivoRechazoId) {
            values['custrecord_elm_motivo_rechazo'] = options.motivoRechazoId;
         }

         // Monto Cuota
         if (options.montoCuotaId) {
            values['custrecord_elm_sol_monto_cuota'] = options.montoCuotaId;
         }

         // Producto
         if (options.productoId) {
            values['custrecord_elm_sol_producto'] = options.productoId;
         }

         // Monto Solicitado
         if (options.montoSolicitado) {
            values['custrecord_elm_sol_monto_sol'] = options.montoSolicitado;
         }

         // Monto Otorgado
         if (options.montoOtorgado) {
            values['custrecord_elm_sol_monto_otorgado'] = options.montoOtorgado;
         }

         // Plazo
         if (options.plazo) {
            values['custrecord_elm_sol_plazo'] = parseInt(options.plazo, 10);
         }

         // Sub-Estado
         if (options.subEstadoId) {
            values['custrecord_elm_sol_sub_estado'] = options.subEstadoId;
         }

         // Batch ID
         if (options.batchId) {
            values['custrecord_elm_sol_batch_id'] = String(options.batchId);
         }

         // Valor Cuota
         if (options.valorCuota) {
            values['custrecord_elm_sol_valor_cuota_'] = options.valorCuota;
         }

         // Tabla Cálculo Préstamo
         if (options.tablaCalculoPrestamo) {
            values['custrecord_calculo_prestamo'] = options.tablaCalculoPrestamo;
         }

         // Tabla de Resultados
         if (options.tablaResultados) {
            values['custrecordelm_sol_tabla_oferta'] = options.tablaResultados;
         }

         // Score
         if (options.score) {
            values['custrecord_elm_sol_score'] = String(options.score);
         }

         // Calificación
         if (options.calificacion) {
            values['custrecord_elm_cal_d'] = String(options.calificacion);
         }

         // Entidades
         if (options.entidades) {
            values['custrecord_elm_slol_entidades'] = String(options.entidades);
         }

         // Nro de Documento
         if (options.nroDocumento) {
            values['custrecord_elm_sol_nro_doc'] = String(options.nroDocumento);
         }

         // Actividad
         if (options.actividadId) {
            values['custrecord_elm_sol_acti'] = options.actividadId;
         }

         // Salario
         if (options.salario) {
            values['custrecord_elm_sol_salario'] = String(options.salario);
         }

         log.debug(stLogTitle, 'Values to update: ' + JSON.stringify(values));

         // Actualizar registro si hay campos para actualizar
         if (Object.keys(values).length > 0) {
            record.submitFields({
               type: 'customrecord_elm_solicitud',
               id: options.solicitudId,
               values: values,
               options: {
                  enableSourcing: false,
                  ignoreMandatoryFields: true
               }
            });
            log.audit(stLogTitle, 'Solicitud Vale updated with id: ' + options.solicitudId);
         }

         // Determinar si el estado de gestión cambió
         const nuevoEstado = options.estadoGestion ? String(options.estadoGestion) : null;
         const estadoCambiado = estadoActual !== nuevoEstado;

         // Crear nueva etapa si el estado cambió o si se fuerza la creación
         let etapaId = null;
         if (estadoCambiado) {
            etapaId = createEtapaSolicitud({
               solicitudId: options.solicitudId,
               estadoGestion: options.estadoGestion,
               usuarioId: options.operadorId,
               comentario: options.comentarioEtapa,
               motivoRechazoId: options.motivoRechazoId
            });
            log.audit(stLogTitle, 'Nueva etapa creada por cambio de estado. Anterior: ' + estadoActual + ', Nuevo: ' + nuevoEstado);
         }

         return {
            solicitudId: options.solicitudId,
            etapaId: etapaId,
            estadoCambiado: estadoCambiado
         };

      } catch (error) {
         log.error(stLogTitle, 'Error updating Solicitud Vale: ' + error.message);
         return null;
      }
   }

   /**
    * Crea un registro en customrecord_elm_gestion_leads
    * @param {Object} options
    * @param {number|string} [options.leadId] - Internal id del Lead/Cliente (customer)
    * @param {string} [options.nroDocumento] - Número de documento
    * @param {number|string} [options.estado] - Valor de lista para Estado de Gestión
    * @param {number|string} [options.setBy] - Employee internal id que actualiza
    * @returns {boolean} true si se creó correctamente, false en caso de error
    */
   function createGestionLead(options) {
      const stLogTitle = 'createGestionLead';
      options = options || {};
      try {
         const rec = record.create({
            type: 'customrecord_elm_gestion_leads',
            isDynamic: false
         });

         if (options.leadId) {
            rec.setValue({ fieldId: 'custrecord_elm_gestion_lead', value: options.leadId });
         }

         if (options.nroDocumento) {
            rec.setValue({ fieldId: 'custrecord_elm_gestion_nro_documento', value: String(options.nroDocumento) });
         }

         if (options.estado) {
            rec.setValue({ fieldId: 'custrecord_elm_gestion_estado_', value: options.estado });
         }

         if (options.setBy) {
            rec.setValue({ fieldId: 'custrecord_elm_gestion_set_by', value: options.setBy });
         }

         // Guardar registro
         const newId = rec.save();
         log.audit(stLogTitle, 'Gestion Leads created with id: ' + newId);
         return newId > 0;
      } catch (error) {
         log.error(stLogTitle, error);
         return false;
      }
   }

   /**
    * Crea un registro en customrecord_elm_operador_lead para asociar un operador a un lead/cliente
    * @param {Object} options
    * @param {number|string} [options.leadId] - Internal id del Lead/Cliente (custrecord_elm_operador_cliente)
    * @param {number|string} [options.operadorId] - Internal id del Operador/Employee (custrecord_elm_operador_operador)
    * @param {number|string} [options.estadoGestion] - Internal id del Estado de Gestión (custrecord_elm_operador_estado_gestion)
    * @returns {number|boolean} Internal ID del registro creado si éxito, false en caso de error
    */
   function operadorByLead(options) {
      const stLogTitle = 'operadorByLead';
      options = options || {};
      try {
         const rec = record.create({
            type: 'customrecord_elm_operador_lead',
            isDynamic: false
         });

         if (options.leadId) {
            rec.setValue({ fieldId: 'custrecord_elm_operador_cliente', value: options.leadId });
         }

         if (options.operadorId) {
            rec.setValue({ fieldId: 'custrecord_elm_operador_operador', value: options.operadorId });
         }

         if (options.estadoGestion) {
            rec.setValue({ fieldId: 'custrecord_elm_operador_estado_gestion', value: options.estadoGestion });
         }

         // Guardar registro
         const newId = rec.save();
         log.audit(stLogTitle, 'Operador Lead record created with id: ' + newId);
         return newId;
      } catch (error) {
         log.error(stLogTitle, error);
         return false;
      }
   }


   /**
    * Crea un registro en customrecord_elm_score_historico para guardar el historial de scores BCU
    * @param {Object} options - Objeto con los valores para el registro
    * @param {number|string} [options.leadId] - Internal ID del Lead/Cliente (custrecord_elm_score_hist_cli)
    * @param {string|number} [options.score] - Score calculado (custrecord_elm_score_hist_score)
    * @param {number|string} [options.calificacion] - Internal ID de la calificación (custrecord_elm_score_hist_cali)
    * @param {string} [options.respuesta] - Respuesta completa del score en JSON (custrecord_score_hist_respuesta)
    * @param {string|number} [options.t2CantEntidades] - Cantidad de entidades T2 (custrecord_score_hist_ent_t2)
    * @param {string|number} [options.t2Endeudamiento] - Endeudamiento T2 (custrecord_elm_score_hist_t2_endeud)
    * @param {string} [options.t2PeorCalificacion] - Peor calificación T2 (custrecord_elm_score_hist_t2_peorcalif)
    * @param {string|number} [options.t6CantEntidades] - Cantidad de entidades T6 (custrecord_score_hist_ent_t6)
    * @param {string|number} [options.t6Endeudamiento] - Endeudamiento T6 (custrecord_score_hist_ent_t6_endeud)
    * @param {string} [options.t6PeorCalificacion] - Peor calificación T6 (custrecord_elm_score_hist_ent_t6_peorcalif)
    * @param {string|number} [options.endeudamiento] - Endeudamiento general (custrecord_score_hist_endeudamiento)
    * @returns {number|null} Internal ID del registro creado o null si falla
    */
   function createScoreHistoryRecord(options) {
      const stLogTitle = 'createScoreHistoryRecord';
      options = options || {};
      try {
         const rec = record.create({
            type: 'customrecord_elm_score_historico',
            isDynamic: false
         });

         // Lead/Cliente - List/Record (Customer)
         if (options.leadId) {
            rec.setValue({ fieldId: 'custrecord_elm_score_hist_cli', value: options.leadId });
         }

         // Score - Free-Form Text
         if (options.score) {
            rec.setValue({ fieldId: 'custrecord_elm_score_hist_score', value: String(options.score) });
         }

         // Calificación - List/Record (Calificaciones)
         if (options.calificacion) {
            const califId = getCalificacionId(options.calificacion);
            if (califId) {
               rec.setValue({ fieldId: 'custrecord_elm_score_hist_cali', value: califId });  
            }
         }

         // Score Respuesta - Long Text
         if (options.respuesta) {
            rec.setValue({ fieldId: 'custrecord_score_hist_respuesta', value: String(options.respuesta) });
         }

         // T2 - Cantidad de Entidades - Free-Form Text
         if (options.t2CantEntidades) {
            rec.setValue({ fieldId: 'custrecord_score_hist_ent_t2', value: String(options.t2CantEntidades) });
         }

         // T2 - Endeudamiento - Free-Form Text
         if (options.t2Endeudamiento) {
            rec.setValue({ fieldId: 'custrecord_elm_score_hist_t2_endeud', value: String(options.t2Endeudamiento) });
         }

         // T2 - Peor calificación - Free-Form Text
         if (options.t2PeorCalificacion) {
            rec.setValue({ fieldId: 'custrecord_elm_score_hist_t2_peorcalif', value: String(options.t2PeorCalificacion) });
         }

         // T6 - Cantidad de Entidades - Free-Form Text
         if (options.t6CantEntidades) {
            rec.setValue({ fieldId: 'custrecord_score_hist_ent_t6', value: String(options.t6CantEntidades) });
         }

         // T6 - Endeudamiento - Free-Form Text
         if (options.t6Endeudamiento) {
            rec.setValue({ fieldId: 'custrecord_score_hist_ent_t6_endeud', value: String(options.t6Endeudamiento) });
         }

         // T6 - Peor Calificación - Free-Form Text
         if (options.t6PeorCalificacion) {
            rec.setValue({ fieldId: 'custrecord_score_hist_ent_t6_peorcalif', value: String(options.t6PeorCalificacion) });
         }

         // Endeudamiento general - Free-Form Text
         if (options.endeudamiento) {
            rec.setValue({ fieldId: 'custrecord_score_hist_ent_endeudamiento', value: String(options.endeudamiento) });
         }

         // Guardar registro
         const newId = rec.save();
         log.audit(stLogTitle, 'Score History record created with id: ' + newId);
         return newId;

      } catch (error) {
         log.error(stLogTitle, 'Error creating Score History record: ' + error.message);
         return null;
      }
   }

   /**
    * Obtiene el Internal ID de una calificación BCU por su nombre
    * Lista: customlist_elm_list_calificacion
    * @param {string} nombreCalificacion - Nombre de la calificación (ej: "1A", "1C", "2A", "2B", "3", "5", "N/C")
    * @returns {number|null} Internal ID de la calificación o null si no se encuentra
    */
   function getCalificacionId(nombreCalificacion) {
      // Mapeo de calificaciones a Internal IDs según customlist_elm_list_calificacion
      const CALIFICACION_MAP = {
         '1C': 1,
         '2A': 2,
         '2B': 3,
         '3': 4,
         '5': 5,
         'N/C': 6,
         '1A': 7
      };

      if (!nombreCalificacion) {
         return null;
      }

      // Normalizar: eliminar espacios y convertir a mayúsculas
      const calificacionNormalizada = String(nombreCalificacion).trim().toUpperCase();
      
      return CALIFICACION_MAP[calificacionNormalizada] || null;
   }

   /**
    * getSolicitudVidente - Obtiene la solicitud vigente de Vidente para un número de documento dado
    * Lista: customlist_elm_list_calificacion
    * @param {string} nroDocument - Nombre de la calificación (ej: "1A", "1C", "2A", "2B", "3", "5", "N/C")
    * @returns {obhect} Internal ID de la calificación o null si no se encuentra
    */
   function getSolicitudVidente (nroDocument){
       const stLogTitle = 'getSolicitudVidente';
        try {
            const solicitudes = {};
            const leadSearchObj = search.create({
            type: "lead",
            filters:
            [
               ["stage","anyof","LEAD"], 
               "AND", 
               ["custentity_elm_sol_vig","noneof","@NONE@"], 
               "AND", 
               ["custentity_sdb_nrdocumento","is", nroDocument], 
               "AND", 
               ["custentity_elm_sol_vig.created","within","monthsago1","daysago0"]
            
            ],
            columns:
            [
               search.createColumn({
                  name: "internalid",
                  join: "CUSTENTITY_ELM_SOL_VIG",
                  label: "Internal ID"
               }),
               search.createColumn({
                  name: "custrecord_elm_sol_est_gestion",
                  join: "CUSTENTITY_ELM_SOL_VIG",
                  label: "Estado de Gestión"
               }),
               search.createColumn({
                  name: "created",
                  join: "CUSTENTITY_ELM_SOL_VIG",
                  label: "Date Created"
               }),
               search.createColumn({
                  name: "custrecord_elm_sol_nro_doc",
                  join: "CUSTENTITY_ELM_SOL_VIG",
                  label: "Nro de Documento"
               }),
               search.createColumn({
                  name: "custrecord_elm_sol_operador",
                  join: "CUSTENTITY_ELM_SOL_VIG",
                  label: "Operador"
               })
            ]
            });
            const searchResultCount = leadSearchObj.runPaged().count;
            log.debug("leadSearchObj result count",searchResultCount);
            leadSearchObj.run().each(function(result){
               // .run().each has a limit of 4,000 results
               solicitudes.id = result.id;
               solicitudes.solID = result.getValue({ name: "internalid", join: "CUSTENTITY_ELM_SOL_VIG" });
               solicitudes.approvalStatus = result.getValue({ name: "custrecord_elm_sol_est_gestion", join: "CUSTENTITY_ELM_SOL_VIG" });
               solicitudes.created = result.getValue({ name: "created", join: "CUSTENTITY_ELM_SOL_VIG" });
               solicitudes.nroDocumento = result.getValue({ name: "custrecord_elm_sol_nro_doc", join: "CUSTENTITY_ELM_SOL_VIG" });
               solicitudes.operador = result.getValue({ name: "custrecord_elm_sol_operador", join: "CUSTENTITY_ELM_SOL_VIG" });
            });

      return solicitudes;
         

        } catch (error) {
         log.error(stLogTitle, error);
         throw errorModule.create({
            name: 'GET_SOLICITUD_VIDENTE_ERROR',
            message: 'Error getting Solicitud Vidente by Nro Documento: ' + nroDocument + '. Details: ' + error.message,
            notifyOff: true
         });
        }
}


   /**
    * getMontoCuotaId - Obtiene la solicitud vigente de Vidente para un número de documento dado
    * @param {string} nombreMontoCuota
    * @param {number} canal
    * @returns {integer}
    */
   function getMontoCuotaId(nombreMontoCuota, canal) {
         // Mapeo de montos de cuota a Internal IDs según customlist_elm_list_monto_cuota
         try {
            let idMonto = 0;
            const filters = [
                  ["name","is",nombreMontoCuota]
               ];
            if(canal >= 2){
               filters.push ("AND",
                  ["custrecord_monto_cuota_source","anyof",canal]
               );
            } else{
               filters.push ("AND",
                  ["custrecord_monto_cuota_source","anyof","@NONE@"]
               );
            }
            const customrecord_monto_cuotaSearchObj = search.create({
               type: "customrecord_monto_cuota",
               filters: filters,
               columns:
               [
                  search.createColumn({name: "internalid", label: "Internal ID"})
               ]
            });
            customrecord_monto_cuotaSearchObj.run().each(function(result){
               // .run().each has a limit of 4,000 results
               idMonto = result.getValue({name: "internalid", label: "Internal ID"});
            });

            return idMonto;
         } catch (error) {
            log.error('GET_MONTO_CUOTA_ID_ERROR', error);
            throw errorModule.create({
               name: 'GET_MONTO_CUOTA_ID_ERROR',
               message: 'Error getting Monto Cuota ID by Nombre: ' + nombreMontoCuota + '. Details: ' + error.message,
               notifyOff: true
            }); 
         }
   }

   /**
    * getScoreHistorico - Obtiene el último registro de score histórico asociado a un lead
    * @param {number|string} leadId - Internal ID del Lead/Cliente
    * @returns {Object|null} Objeto con { id, score } o null si no se encuentra
    */
   function getScoreHistorico(leadId) {
      const stLogTitle = 'getScoreHistorico';
      try {
         if (!leadId) {
            log.error(stLogTitle, 'leadId es requerido');
            return null;
         }

         let resultado = null;
         const scoreSearch = search.create({
            type: 'customrecord_elm_score_historico',
            filters: [
               ['custrecord_elm_score_hist_cli', 'anyof', leadId]
            ],
            columns: [
               search.createColumn({ name: 'internalid' }),
               search.createColumn({ name: 'custrecord_elm_score_hist_score' }),
               search.createColumn({ name: 'created', sort: search.Sort.DESC })
            ]
         });

         scoreSearch.run().each(function(result) {
            resultado = {
               id: result.getValue('internalid'),
               score: result.getValue('custrecord_elm_score_hist_score')
            };
            return false; // Solo obtener el primero (más reciente)
         });

         return resultado;

      } catch (error) {
         log.error(stLogTitle, 'Error getting Score Historico: ' + error.message);
         return null;
      }
   }
   


   return {
      calculateYearsSinceDate: calculateYearsSinceDate,
      getActivityType: getActivityType,
      createPreLead: createPreLead,
      checkBlacklist: checkBlacklist,
      checkMocasist: checkMocasist,
      getInfoRepetido: getInfoRepetido,
      convertToLead: convertToLead,
      updateEntity: updateEntity,
      findEntity: findEntity,
      getOfertaFinal: getOfertaFinal,
      getPonderador: getPonderador,
      submitFieldsEntity: submitFieldsEntity,
      checkSourceOfertaFinalDataExists: checkSourceOfertaFinalDataExists,
      checkSourceMontoCuotaDataExists: checkSourceMontoCuotaDataExists,
      getProveedorId: getProveedorId,
      createListRepetido: createListRepetido,
      copyRecordToRecord: copyRecordToRecord,
      findEntityWithState: findEntityWithState,
      checkVale: checkVale,
      validateCI: validateCI,
      validateAndFormatLastName: validateAndFormatLastName,
      getBcuPeriodInfo: getBcuPeriodInfo,
      extractBcuData: extractBcuData,
      extractBcuVariables: extractBcuVariables,
      operadorByLead: operadorByLead,
      extractQualifications: extractQualifications,
      deactivateLeadsByDocumentNumber: deactivateLeadsByDocumentNumber,
      createLogRecord: createLogRecord,
      isEmployeActive: isEmployeActive,
      updateLogWithResponse: updateLogWithResponse,
      createRecordAuditCambios:createRecordAuditCambios,
      createEtapaSolicitud: createEtapaSolicitud,
      createSolicitudVale: createSolicitudVale,
      updateSolicitudVale: updateSolicitudVale,
      createGestionLead: createGestionLead,
      snapshotAprobados: snapshotAprobados,
      isClientActive: isClientActive,
      createGestionLead: createGestionLead,
      operadorByLead: operadorByLead,
      getInfoRepetidoSql: getInfoRepetidoSql,
      deactivateLeadsByDocumentNumberSQL: deactivateLeadsByDocumentNumberSQL,
      getInfoRepetidoLight: getInfoRepetidoLight,
      createScoreHistoryRecord: createScoreHistoryRecord,
      getCalificacionId: getCalificacionId,
      findSolicitudVigenteByLead: findSolicitudVigenteByLead,
      getSolicitudVidente: getSolicitudVidente,
      getMontoCuotaId: getMontoCuotaId,
      getScoreHistorico: getScoreHistorico,
      createEtapaSolicitud: createEtapaSolicitud
   }
});

