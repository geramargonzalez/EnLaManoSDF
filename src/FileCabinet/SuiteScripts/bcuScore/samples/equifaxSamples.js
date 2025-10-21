/**
 * Ejemplo de respuesta Equifax IC GCP REPORTE basado en el manual de integración
 * Soporta dos formatos:
 * 1. Formato legacy: con entidadesRubrosValores_t0/t6
 * 2. Formato nuevo BOX_FASE0_PER: con variablesDeSalida agregadas
 */
define([], function() {
    // FORMATO LEGACY (antiguo)
    var EQUIFAX_SAMPLE_RESPONSE = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "nombre": "JUAN CARLOS RODRIGUEZ",
                "bcu_calificacion": "1C",
                "vigente": "Mn: 93769126.0 Me: 0.0",
                "vencido": "Mn: 0.0 Me: 0.0", 
                "castigado": "Mn: 0.0 Me: 0.0",
                "bcu_sum_vigente_u1m": "93769126.0",
                "bcu_sum_vencido_u1m": "0.0",
                "bcu_sum_castigado_u1m": "0.0",
                "bcu_cant_entidades_vigente": "5",
                "bcu_cant_entidades_vencido": "0",
                "bcu_cant_entidades_castigado": "0",
                // Datos para t0 (periodo actual)
                "entidadesRubrosValores_t0": [
                    {
                        "nombreEntidad": "BANCO DE LA REPÚBLICA ORIENTAL DEL URUGUAY",
                        "calificacion": "1C",
                        "rubrosValores": [
                            {
                                "rubro": "VIGENTE",
                                "mnPesos": 27131523.0,
                                "mePesos": 0.0,
                                "mnDolares": 0.0,
                                "meDolares": 0.0
                            },
                            {
                                "rubro": "CONTINGENCIAS", 
                                "mnPesos": 433702.0,
                                "mePesos": 0.0,
                                "mnDolares": 0.0,
                                "meDolares": 0.0
                            }
                        ]
                    },
                    {
                        "nombreEntidad": "BANCO SANTANDER S.A.",
                        "calificacion": "1C",
                        "rubrosValores": [
                            {
                                "rubro": "VIGENTE",
                                "mnPesos": 43844562.0,
                                "mePesos": 0.0,
                                "mnDolares": 0.0,
                                "meDolares": 0.0
                            }
                        ]
                    }
                ],
                // Datos para t6 (6 meses atrás)
                "entidadesRubrosValores_t6": [
                    {
                        "nombreEntidad": "BANCO SANTANDER S.A.",
                        "calificacion": "1C", 
                        "rubrosValores": [
                            {
                                "rubro": "VIGENTE",
                                "mnPesos": 44745949.0,
                                "mePesos": 0.0,
                                "mnDolares": 0.0,
                                "meDolares": 0.0
                            }
                        ]
                    }
                ],
                "rubrosValoresGenerales_t0": [
                    {
                        "rubro": "VIGENTE",
                        "mnPesos": 93769126.0,
                        "mePesos": 0.0,
                        "mnDolares": 0.0,
                        "meDolares": 0.0
                    },
                    {
                        "rubro": "CONTINGENCIAS",
                        "mnPesos": 712688.0,
                        "mePesos": 0.0,
                        "mnDolares": 0.0,
                        "meDolares": 0.0
                    }
                ],
                "rubrosValoresGenerales_t6": [
                    {
                        "rubro": "VIGENTE",
                        "mnPesos": 62056122.0,
                        "mePesos": 0.0,
                        "mnDolares": 0.0,
                        "meDolares": 0.0
                    }
                ]
            },
            "infoConsulta": {
                "fallecido": "N",
                "fechaConsulta": "2025-09-26",
                "horaConsulta": "14:30:25"
            }
        }
    };

    var EQUIFAX_DECEASED_SAMPLE = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "nombre": "MARIA ELENA GARCIA",
                "bcu_calificacion": "N/A",
                "vigente": "Mn: 0.0 Me: 0.0",
                "vencido": "Mn: 0.0 Me: 0.0",
                "castigado": "Mn: 0.0 Me: 0.0"
            },
            "infoConsulta": {
                "fallecido": "S",
                "fechaConsulta": "2025-09-26",
                "horaConsulta": "14:30:25"
            }
        }
    };

    var EQUIFAX_BAD_RATING_SAMPLE = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "nombre": "CARLOS ALBERTO LOPEZ",
                "bcu_calificacion": "3",
                "vigente": "Mn: 50000.0 Me: 0.0",
                "vencido": "Mn: 25000.0 Me: 0.0",
                "castigado": "Mn: 10000.0 Me: 0.0",
                "entidadesRubrosValores_t0": [
                    {
                        "nombreEntidad": "CREDITOS DIRECTOS",
                        "calificacion": "3",
                        "rubrosValores": [
                            {
                                "rubro": "VENCIDO",
                                "mnPesos": 25000.0,
                                "mePesos": 0.0
                            }
                        ]
                    }
                ]
            },
            "infoConsulta": {
                "fallecido": "N"
            }
        }
    };

    // FORMATO NUEVO BOX_FASE0_PER (con datos agregados BCU)
    var EQUIFAX_BOX_FASE0_RESPONSE = {
        "transactionId": "8fb18f7f-2bef-4499-bba9-b97905805f38",
        "status": "completed",
        "interconnectResponse": {
            "personalInformation": {
                "documento": "1111111-1",
                "paisDocumento": "UY",
                "tipoDocumento": "CI",
                "anio": "2025",
                "mes": "05"
            },
            "variablesDeSalida": {
                "accion": "Salida",
                "periodo": "2023",
                "nombre": "MARIA ANA SOLAR",
                "documento": "1111111-1",
                "bcu_instituciones": "Banco de la República Oriental del Uruguay",
                "bcu_calificacion": "1C",
                "castigado": "Me: 0 Mn: 0",
                "castigado_atraso": "Me: 0 Mn: 0",
                "castigado_prescripcion": "Me: 0 Mn: 0",
                "castigado_quita_desistimiento": "Me: 0 Mn: 0",
                "contingencias": "Me: 0 Mn: 0",
                "contrato_suscriptos_no_adj": "Me: 0 Mn: 0",
                "creditos_reestructurados": "Me: 0 Mn: 0",
                "garantias_computables": "Me: 0 Mn: 0",
                "garantias_no_computables": "Me: 0 Mn: 0",
                "otorgante_garantias": "Me: 0 Mn: 0",
                "previsiones_totales": "Me: 0 Mn: 2530",
                "vencido": "Me: 0 Mn: 0",
                "vencido_colocacion_vencida": "Me: 0 Mn: 0",
                "vencido_gestion": "Me: 0 Mn: 0",
                "vencido_morosos": "Me: 0 Mn: 0",
                "vigente": "Me: 0 Mn: 2530",
                "bcu_peor_calif_u1m": "1C",
                "bcu_sum_novigente_u1m": "0",
                "bcu_sum_vigente_u1m": "23062",
                "bcu_sum_castigado_u1m": "0",
                "codigo_institucion": "0001"
            },
            "infoConsulta": {
                "nombre": "MARIA SOLAR",
                "documento": "1111111-1",
                "fallecido": "N"
            }
        },
        "originalTransactionId": "8fb18f7f-2bef-4499-bba9-b97905805f38"
    };

    // Persona fallecida - Formato BOX_FASE0_PER
    var EQUIFAX_BOX_DECEASED_RESPONSE = {
        "transactionId": "8fb18f7f-2bef-4499-bba9-b97905805f39",
        "status": "completed",
        "interconnectResponse": {
            "personalInformation": {
                "documento": "3796548-3",
                "paisDocumento": "UY",
                "tipoDocumento": "CI",
                "anio": "2025",
                "mes": "05"
            },
            "variablesDeSalida": {
                "accion": "PERSONA_FALLECIDA",
                "periodo": "",
                "nombre": "",
                "documento": "",
                "bcu_instituciones": "",
                "bcu_calificacion": "",
                "castigado": "",
                "vigente": "",
                "vencido": "",
                "contingencias": "",
                "bcu_peor_calif_u1m": "",
                "bcu_sum_novigente_u1m": "",
                "bcu_sum_vigente_u1m": "",
                "bcu_sum_castigado_u1m": "",
                "codigo_institucion": ""
            },
            "infoConsulta": {
                "nombre": "ANA PEREZ",
                "documento": "3796548-3",
                "fallecido": "S"
            }
        },
        "originalTransactionId": "8fb18f7f-2bef-4499-bba9-b97905805f39"
    };

    // Ejemplo con mala calificación BCU (5)
    var EQUIFAX_BOX_BAD_RATING_RESPONSE = {
        "transactionId": "8fb18f7f-2bef-4499-bba9-b97905805f40",
        "status": "completed",
        "interconnectResponse": {
            "personalInformation": {
                "documento": "2222222-2",
                "paisDocumento": "UY",
                "tipoDocumento": "CI",
                "anio": "2025",
                "mes": "10"
            },
            "variablesDeSalida": {
                "accion": "Salida",
                "periodo": "2023",
                "nombre": "PEDRO GONZALEZ",
                "documento": "2222222-2",
                "bcu_instituciones": "Banco de la República Oriental del Uruguay,ITAU",
                "bcu_calificacion": "5",
                "castigado": "Me: 0 Mn: 15000",
                "vigente": "Me: 0 Mn: 5000",
                "vencido": "Me: 0 Mn: 8000",
                "contingencias": "Me: 0 Mn: 0",
                "bcu_peor_calif_u1m": "5",
                "bcu_sum_novigente_u1m": "8000",
                "bcu_sum_vigente_u1m": "5000",
                "bcu_sum_castigado_u1m": "15000",
                "codigo_institucion": "0001"
            },
            "infoConsulta": {
                "nombre": "PEDRO GONZALEZ",
                "documento": "2222222-2",
                "fallecido": "N"
            }
        },
        "originalTransactionId": "8fb18f7f-2bef-4499-bba9-b97905805f40"
    };

    return {
        // Legacy format (antiguo con entidadesRubrosValores)
        EQUIFAX_SAMPLE_RESPONSE: EQUIFAX_SAMPLE_RESPONSE,
        EQUIFAX_DECEASED_SAMPLE: EQUIFAX_DECEASED_SAMPLE,
        EQUIFAX_BAD_RATING_SAMPLE: EQUIFAX_BAD_RATING_SAMPLE,
        
        // New BOX_FASE0_PER format (nuevo con datos agregados)
        EQUIFAX_BOX_FASE0_RESPONSE: EQUIFAX_BOX_FASE0_RESPONSE,
        EQUIFAX_BOX_DECEASED_RESPONSE: EQUIFAX_BOX_DECEASED_RESPONSE,
        EQUIFAX_BOX_BAD_RATING_RESPONSE: EQUIFAX_BOX_BAD_RATING_RESPONSE,
        
        // Alias para compatibilidad
        EQUIFAX_NORMAL_RESPONSE: EQUIFAX_BOX_FASE0_RESPONSE,
        EQUIFAX_DECEASED_RESPONSE: EQUIFAX_BOX_DECEASED_RESPONSE,
        EQUIFAX_BAD_RATING_RESPONSE: EQUIFAX_BOX_BAD_RATING_RESPONSE
    };
});