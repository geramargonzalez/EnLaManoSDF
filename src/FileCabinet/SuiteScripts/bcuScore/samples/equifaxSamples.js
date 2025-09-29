/**
 * Ejemplo de respuesta Equifax IC GCP REPORTE basado en el manual de integración
 */
define([], function() {
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

    return {
        EQUIFAX_SAMPLE_RESPONSE: EQUIFAX_SAMPLE_RESPONSE,
        EQUIFAX_DECEASED_SAMPLE: EQUIFAX_DECEASED_SAMPLE,
        EQUIFAX_BAD_RATING_SAMPLE: EQUIFAX_BAD_RATING_SAMPLE
    };
});