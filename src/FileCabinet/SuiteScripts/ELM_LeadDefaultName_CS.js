/**
* @NApiVersion 2.1
* @NScriptType clientscript
* @NModuleScope public
*/

define(['N/currentRecord', "./ELM_Aux_Lib.js", 'N/runtime', 'N/search'],
    function (currentRecord, auxLib, runtime, search) {

        /**
         * @author  Gerardo Gonzalez
         * @desc pageInit - This function is triggered when the page is initialized. 
         * @param {object} scriptContext 
         */
        function pageInit(context) {
            console.log('pageInit');
            try {
                 const objRecord = currentRecord.get();
                  const docNumber = context.currentRecord.getValue('custentity_sdb_nrdocumento');
                  if (docNumber) {
                        const arrayVale = auxLib.checkVale(docNumber);
                        let tieneVale = '';
                        if (arrayVale.length > 0 && arrayVale[0]?.activo) {
                            tieneVale = '1';
                        } 
                        if (arrayVale.length > 0 && !arrayVale[0]?.activo) {
                            tieneVale = '2'
                        } 
                        if (arrayVale.length == 0) {
                            tieneVale = '3' 
                        }
                        objRecord.setValue('custentity_elm_tiene_vale', tieneVale);
                  }
                  const montoCuota = objRecord.getValue({ fieldId: 'custentity_elm_monto_cuota' });

                 if (montoCuota) {
                    objRecord.setValue('custentity_elm_monto_cuota_ven', montoCuota);
                 }
                if (context.mode !== 'create') return;
                if(runtime.executionContext == 'USERINTERFACE') {
                    //const operator = objRecord.getValue({ fieldId: 'custentity_elm_operador' });
                    const user = runtime.getCurrentUser();
                   // const isActive = isEmployeActive(user.id);
                   // if (isActive && !operator) {
                     objRecord.setValue('custentity_elm_operador', user.id);
                  //  }
                }
                 
                objRecord.setValue('firstname', 'Default');
                objRecord.setValue('lastname', 'Default');
                return true;
            } catch (error) {
                console.log('Error pageInit', error);
            }
        }


        return {
            pageInit: pageInit
        };
    });
