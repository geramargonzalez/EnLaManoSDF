define(['N/query', 'N/record', 'N/search', 'N/error'],
   function (query, record, search, errorModule) {
      
      
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
      function createPreLead(service, docNumber, mobilePhone, firstName, lastName, activity, salary, dateOfBirth, yearsOfWork, age, sourceId, workStartDate, estadoGestion, ingresoPor, source, activityName) { 
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
 
            log.debug('getInfoRepetido filters', JSON.stringify(filters));
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
            peroCalifT6
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
               'custentity_t6_elm_pero_cal': peroCalifT6 || null
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
 
      function submitFieldsEntity(entity, approvalStatus, rejectReason, newEntityStatus, infoRepetido, montoCuota, ofertaFinal, montoCuotaName, score, plazo, endeudamientoT2, endeudamientoT6, cantEntidadesT2,
         cantEntidadesT6, peroCalifT2, peroCalifT6, canal) {
         var stLogTitle = 'submitFieldsEntity';
         try {
            var firstName;
            var lastName;
            if (score) {
               var name = score.nombre;
               if (name) {
                  var split = name.split(',');
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


            var valuesToUpdate = {
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
               custentity_t6_elm_pero_cal: peroCalifT6 || null

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

      function findEntity(docNumber, status) {
         var stLogTitle = 'findLead';
         try {
            var lead;
            var leadSearch = search.create({
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
                     search.createColumn({ name: "custentity_elm_aprobado" })
                  ]
            });
            leadSearch.run().each(function (result) {
               lead.id = result.id;
               lead.status = result.getValue('custentity_elm_aprobado');
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
       * checkSourceOfertaFinalDataExists - Checks if there is any record in the custom record type "Oferta Final" that matches the given source.
       * @param {string} proveedorId - The source identifier to search for the provider.
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
            // Submit all values at once
            const targetId = record.submitFields({
               type: options.sourceType,
               id: options.targetId,
               values: valuesToSubmit,
               options: {
                     enableSourcing: true,
                     ignoreMandatoryFields: true
               }
            });
            
            log.audit('Record copied', 
               'Copied from ' + options.sourceType + ' ID: ' + options.sourceId + 
               ' to ' + (options.targetType || options.sourceType) + ' ID: ' + targetId);
            
            return targetId;
            
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
       * getBcuPeriodInfo - This function extracts BCU period information from a given BCU data object.
       * @param {object} bcuData - The BCU data object (can be the full response or a specific period object).
       * @param {string} period - The period for which to extract the information ('t2' or 't6').
       * @returns {object} The extracted BCU data.
       */
      function getBcuPeriodInfo(bcuData, period) {
         const stLogTitle = 'getBcuPeriodInfo';
         try {
            // Handle new structure with t2/t6 objects
            if (bcuData && (bcuData.t2 || bcuData.t6)) {
               const periodData = period === 't6' ? bcuData.t6 : bcuData.t2;
               
               if (!periodData?.data) {
                  log.debug(stLogTitle, `No data found for period ${period}`);
                  return null;
               }

               const data = periodData.data;
               return {
                  nombre: data?.nombre,
                  documento: data?.documento,
                  sectorActividad: data?.sectorActividad,
                  periodo: data?.periodo,
                  rubrosGenerales: data?.rubrosValoresGenerales,
                  entidades: data?.entidadesRubrosValores,
                  totalVigentePesos: data?.rubrosValoresGenerales?.find(r => r.rubro === 'VIGENTE')?.mnPesos || 0,
                  totalVigenteDolares: data?.rubrosValoresGenerales?.find(r => r.rubro === 'VIGENTE')?.mnDolares || 0,
                  errors: periodData.errors || null
               };
            }

            // Handle legacy structure (backward compatibility)
            if (!bcuData?.data) {
               return null;
            }

            const data = bcuData.data;
            return {
               nombre: data.Nombre || data.nombre,
               documento: data.Documento || data.documento,
               sectorActividad: data.SectorActividad || data.sectorActividad,
               periodo: data.Periodo || data.periodo,
               rubrosGenerales: data.RubrosValoresGenerales || data.rubrosValoresGenerales,
               entidades: data.EntidadesRubrosValores || data.entidadesRubrosValores,
               totalVigentePesos: (data.RubrosValoresGenerales || data.rubrosValoresGenerales)?.find(r => (r.Rubro || r.rubro) === 'VIGENTE')?.MnPesos || (data.RubrosValoresGenerales || data.rubrosValoresGenerales)?.find(r => (r.Rubro || r.rubro) === 'VIGENTE')?.mnPesos || 0,
               totalVigenteDolares: (data.RubrosValoresGenerales || data.rubrosValoresGenerales)?.find(r => (r.Rubro || r.rubro) === 'VIGENTE')?.MnDolares || (data.RubrosValoresGenerales || data.rubrosValoresGenerales)?.find(r => (r.Rubro || r.rubro) === 'VIGENTE')?.mnDolares || 0
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
               return true; // Continue iterating
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
                  ['custrecord_elm_apr_doc', 'is', docNumber]
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

            const recSnap = record.create({ type: recordTypeId, isDynamic: false });
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
           
            const idPost = post.save();
            log.debug(logTitle, 'Log created with ID: ' + idPost);
            return idPost;
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

           const idLog = record.submitFields({
               type: 'customrecord_elm_serv_logs',
               id: logId,
               values: values,
               options: {
                  enableSourcing: false,
                  ignoreMandatoryFields: true
               }
            });
            log.debug(logTitle, 'Log updated with ID: ' + idLog);
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
       * Create a create Etapa Solicitud record
       * @param {Object} estadoGestion - Configuration object
       * @param {string} user - Notes/comments about the change
       * @param {string} solVigente - User who made the change (employee internal ID)
       */
    function createEtapaSolicitud(estadoGestion, user, solVigente){
      try {
         const etapaRecord = record.create({
               type: 'customrecord_elm_etapa_sol',
               isDynamic: false
            });

            // Notes field - Long Text field
            etapaRecord.setValue({
               fieldId: 'custrecord_elm_est_gestion_etapa',
               value: estadoGestion
            });

            // Usuario field - Employee reference
            etapaRecord.setValue({
               fieldId: 'custrecord_elm_etapa_sol',
               value: solVigente
            });

            etapaRecord.setValue({
               fieldId: 'custrecord_elm_etapa_usuario',
               value: user
            });

            if (motivoRechazado) {
               etapaRecord.setValue({
                  fieldId: 'custrecord_elm_etapa_motivo_rechazo',
                  value: motivoRechazado
               });
            }

            const etapaRecordId = etapaRecord.save();
            console.log('ID de registro de etapa creado:', etapaRecordId);
      } catch (error) {
         console.error('Error al crear registro de etapa:', error);
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
         operadorByLead: operadorByLead,
         extractQualifications: extractQualifications,
         deactivateLeadsByDocumentNumber: deactivateLeadsByDocumentNumber,
         createLogRecord: createLogRecord,
         isEmployeActive: isEmployeActive,
         updateLogWithResponse: updateLogWithResponse,
         createRecordAuditCambios:createRecordAuditCambios,
         createEtapaSolicitud: createEtapaSolicitud,
         createGestionLead: createGestionLead,
         snapshotAprobados: snapshotAprobados,
         isClientActive: isClientActive,
         createGestionLead: createGestionLead,
         operadorByLead: operadorByLead
      }
   });

