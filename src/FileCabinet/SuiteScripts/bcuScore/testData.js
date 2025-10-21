/**
 * @NApiVersion 2.1
 * @fileOverview Test data samples for MYM and Equifax providers
 * 
 * Este archivo contiene objetos de prueba que simulan las respuestas
 * de las APIs de MYM y Equifax para facilitar el testing sin llamar
 * a las APIs reales.
 * 
 * Uso:
 * - Importar este módulo en tus tests
 * - Pasar los objetos directamente al normalizer
 * - Comparar resultados normalizados
 */

define([], function() {
    
    /**
     * MUESTRA 1: Respuesta MYM (RiskAPI)
     * Caso: Cliente con deuda normal, rating 1C, entidades BROU y BBVA
     */
    const MYM_SAMPLE_NORMAL = {
        "status": "success",
        "data": {
            "documento": "12345678",
            "periodos": {
                "t0": {
                    "periodo": "2024-10",
                    "entidadesRubrosValores": [
                        {
                            "entidad": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY",
                            "rating": "1C",
                            "rubros": [
                                {
                                    "rubro": "PRESTAMOS PERSONALES",
                                    "vigente": { "mn": 150000, "me": 5000 },
                                    "vencido": { "mn": 0, "me": 0 },
                                    "castigado": { "mn": 0, "me": 0 },
                                    "cont": false
                                },
                                {
                                    "rubro": "TARJETAS DE CREDITO",
                                    "vigente": { "mn": 80000, "me": 2000 },
                                    "vencido": { "mn": 0, "me": 0 },
                                    "castigado": { "mn": 0, "me": 0 },
                                    "cont": false
                                }
                            ]
                        },
                        {
                            "entidad": "BBVA URUGUAY S.A.",
                            "rating": "1A",
                            "rubros": [
                                {
                                    "rubro": "PRESTAMOS HIPOTECARIOS",
                                    "vigente": { "mn": 2500000, "me": 0 },
                                    "vencido": { "mn": 0, "me": 0 },
                                    "castigado": { "mn": 0, "me": 0 },
                                    "cont": false
                                }
                            ]
                        }
                    ],
                    "totales": {
                        "vigente": { "mn": 2730000, "me": 7000 },
                        "vencido": { "mn": 0, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 2730000, "me": 7000 }
                    }
                },
                "t6": {
                    "periodo": "2024-04",
                    "entidadesRubrosValores": [
                        {
                            "entidad": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY",
                            "rating": "1C",
                            "rubros": [
                                {
                                    "rubro": "PRESTAMOS PERSONALES",
                                    "vigente": { "mn": 180000, "me": 6000 },
                                    "vencido": { "mn": 0, "me": 0 },
                                    "castigado": { "mn": 0, "me": 0 },
                                    "cont": false
                                }
                            ]
                        }
                    ],
                    "totales": {
                        "vigente": { "mn": 180000, "me": 6000 },
                        "vencido": { "mn": 0, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 180000, "me": 6000 }
                    }
                }
            }
        }
    };

    /**
     * MUESTRA 2: Respuesta MYM con deuda vencida
     * Caso: Cliente con rating malo (4), deuda vencida en Santander
     */
    const MYM_SAMPLE_BAD_RATING = {
        "status": "success",
        "data": {
            "documento": "98765432",
            "periodos": {
                "t0": {
                    "periodo": "2024-10",
                    "entidadesRubrosValores": [
                        {
                            "entidad": "BANCO SANTANDER S.A.",
                            "rating": "4",
                            "rubros": [
                                {
                                    "rubro": "TARJETAS DE CREDITO",
                                    "vigente": { "mn": 50000, "me": 0 },
                                    "vencido": { "mn": 25000, "me": 0 },
                                    "castigado": { "mn": 0, "me": 0 },
                                    "cont": false
                                }
                            ]
                        }
                    ],
                    "totales": {
                        "vigente": { "mn": 50000, "me": 0 },
                        "vencido": { "mn": 25000, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 75000, "me": 0 }
                    }
                },
                "t6": {
                    "periodo": "2024-04",
                    "entidadesRubrosValores": [],
                    "totales": {
                        "vigente": { "mn": 0, "me": 0 },
                        "vencido": { "mn": 0, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 0, "me": 0 }
                    }
                }
            }
        }
    };

    /**
     * MUESTRA 3: Respuesta Equifax BOX_FASE0_PER
     * Caso: Cliente con deuda normal, rating 1C, múltiples instituciones
     */
    const EQUIFAX_SAMPLE_NORMAL = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "bcu_calificacion": "1C",
                "bcu_cant_ent_vig": "2",
                "bcu_cant_ent_venc": "0",
                "bcu_cant_ent_cast": "0",
                "bcu_instituciones": "BANCO DE LA REPUBLICA ORIENTAL DEL URUGUAY, BBVA URUGUAY S.A.",
                "bcu_periodo": "OCT2024",
                "bcu_suma_creditos_mn_vig_u1m": "2730000",
                "bcu_suma_creditos_me_vig_u1m": "7000",
                "bcu_suma_creditos_mn_venc_u1m": "0",
                "bcu_suma_creditos_me_venc_u1m": "0",
                "bcu_suma_creditos_mn_cast_u1m": "0",
                "bcu_suma_creditos_me_cast_u1m": "0",
                "bcu_vigente": "Mn: 2730000 Me: 7000",
                "bcu_vencido": "Mn: 0 Me: 0",
                "bcu_castigado": "Mn: 0 Me: 0",
                "bcu_periodo_u6m": "ABR2024",
                "bcu_suma_creditos_mn_vig_u6m": "180000",
                "bcu_suma_creditos_me_vig_u6m": "6000",
                "bcu_suma_creditos_mn_venc_u6m": "0",
                "bcu_suma_creditos_me_venc_u6m": "0",
                "bcu_suma_creditos_mn_cast_u6m": "0",
                "bcu_suma_creditos_me_cast_u6m": "0"
            }
        }
    };

    /**
     * MUESTRA 4: Respuesta Equifax con deuda vencida
     * Caso: Cliente con rating malo (4), deuda vencida
     */
    const EQUIFAX_SAMPLE_BAD_RATING = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "bcu_calificacion": "4",
                "bcu_cant_ent_vig": "1",
                "bcu_cant_ent_venc": "1",
                "bcu_cant_ent_cast": "0",
                "bcu_instituciones": "BANCO SANTANDER S.A.",
                "bcu_periodo": "OCT2024",
                "bcu_suma_creditos_mn_vig_u1m": "50000",
                "bcu_suma_creditos_me_vig_u1m": "0",
                "bcu_suma_creditos_mn_venc_u1m": "25000",
                "bcu_suma_creditos_me_venc_u1m": "0",
                "bcu_suma_creditos_mn_cast_u1m": "0",
                "bcu_suma_creditos_me_cast_u1m": "0",
                "bcu_vigente": "Mn: 50000 Me: 0",
                "bcu_vencido": "Mn: 25000 Me: 0",
                "bcu_castigado": "Mn: 0 Me: 0",
                "bcu_periodo_u6m": "ABR2024",
                "bcu_suma_creditos_mn_vig_u6m": "0",
                "bcu_suma_creditos_me_vig_u6m": "0",
                "bcu_suma_creditos_mn_venc_u6m": "0",
                "bcu_suma_creditos_me_venc_u6m": "0",
                "bcu_suma_creditos_mn_cast_u6m": "0",
                "bcu_suma_creditos_me_cast_u6m": "0"
            }
        }
    };

    /**
     * MUESTRA 5: Respuesta Equifax persona fallecida
     * Caso: Persona fallecida detectada por Equifax
     */
    const EQUIFAX_SAMPLE_DECEASED = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "bcu_calificacion": "1C",
                "bcu_cant_ent_vig": "0",
                "bcu_cant_ent_venc": "0",
                "bcu_cant_ent_cast": "0",
                "bcu_instituciones": "",
                "bcu_periodo": "",
                "fallecido": "S",
                "bcu_suma_creditos_mn_vig_u1m": "0",
                "bcu_suma_creditos_me_vig_u1m": "0",
                "bcu_suma_creditos_mn_venc_u1m": "0",
                "bcu_suma_creditos_me_venc_u1m": "0",
                "bcu_suma_creditos_mn_cast_u1m": "0",
                "bcu_suma_creditos_me_cast_u1m": "0",
                "bcu_vigente": "Mn: 0 Me: 0",
                "bcu_vencido": "Mn: 0 Me: 0",
                "bcu_castigado": "Mn: 0 Me: 0"
            }
        }
    };

    /**
     * MUESTRA 6: Respuesta MYM sin historial crediticio
     * Caso: Cliente nuevo sin deudas previas
     */
    const MYM_SAMPLE_NO_HISTORY = {
        "status": "success",
        "data": {
            "documento": "11111111",
            "periodos": {
                "t0": {
                    "periodo": "2024-10",
                    "entidadesRubrosValores": [],
                    "totales": {
                        "vigente": { "mn": 0, "me": 0 },
                        "vencido": { "mn": 0, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 0, "me": 0 }
                    }
                },
                "t6": {
                    "periodo": "2024-04",
                    "entidadesRubrosValores": [],
                    "totales": {
                        "vigente": { "mn": 0, "me": 0 },
                        "vencido": { "mn": 0, "me": 0 },
                        "castigado": { "mn": 0, "me": 0 },
                        "total": { "mn": 0, "me": 0 }
                    }
                }
            }
        }
    };

    /**
     * MUESTRA 7: Respuesta Equifax sin historial crediticio
     * Caso: Cliente nuevo sin deudas previas
     */
    const EQUIFAX_SAMPLE_NO_HISTORY = {
        "interconnectResponse": {
            "variablesDeSalida": {
                "bcu_calificacion": "",
                "bcu_cant_ent_vig": "0",
                "bcu_cant_ent_venc": "0",
                "bcu_cant_ent_cast": "0",
                "bcu_instituciones": "",
                "bcu_periodo": "OCT2024",
                "bcu_suma_creditos_mn_vig_u1m": "0",
                "bcu_suma_creditos_me_vig_u1m": "0",
                "bcu_suma_creditos_mn_venc_u1m": "0",
                "bcu_suma_creditos_me_venc_u1m": "0",
                "bcu_suma_creditos_mn_cast_u1m": "0",
                "bcu_suma_creditos_me_cast_u1m": "0",
                "bcu_vigente": "Mn: 0 Me: 0",
                "bcu_vencido": "Mn: 0 Me: 0",
                "bcu_castigado": "Mn: 0 Me: 0",
                "bcu_periodo_u6m": "ABR2024",
                "bcu_suma_creditos_mn_vig_u6m": "0",
                "bcu_suma_creditos_me_vig_u6m": "0",
                "bcu_suma_creditos_mn_venc_u6m": "0",
                "bcu_suma_creditos_me_venc_u6m": "0",
                "bcu_suma_creditos_mn_cast_u6m": "0",
                "bcu_suma_creditos_me_cast_u6m": "0"
            }
        }
    };

    // Exportar todos los samples
    return {
        // MYM Samples
        MYM_SAMPLE_NORMAL: MYM_SAMPLE_NORMAL,
        MYM_SAMPLE_BAD_RATING: MYM_SAMPLE_BAD_RATING,
        MYM_SAMPLE_NO_HISTORY: MYM_SAMPLE_NO_HISTORY,
        
        // Equifax Samples
        EQUIFAX_SAMPLE_NORMAL: EQUIFAX_SAMPLE_NORMAL,
        EQUIFAX_SAMPLE_BAD_RATING: EQUIFAX_SAMPLE_BAD_RATING,
        EQUIFAX_SAMPLE_DECEASED: EQUIFAX_SAMPLE_DECEASED,
        EQUIFAX_SAMPLE_NO_HISTORY: EQUIFAX_SAMPLE_NO_HISTORY,
        
        // Helper: Get all samples as array
        getAllSamples: function() {
            return [
                { name: 'MYM Normal', provider: 'mym', data: MYM_SAMPLE_NORMAL },
                { name: 'MYM Bad Rating', provider: 'mym', data: MYM_SAMPLE_BAD_RATING },
                { name: 'MYM No History', provider: 'mym', data: MYM_SAMPLE_NO_HISTORY },
                { name: 'Equifax Normal', provider: 'equifax', data: EQUIFAX_SAMPLE_NORMAL },
                { name: 'Equifax Bad Rating', provider: 'equifax', data: EQUIFAX_SAMPLE_BAD_RATING },
                { name: 'Equifax Deceased', provider: 'equifax', data: EQUIFAX_SAMPLE_DECEASED },
                { name: 'Equifax No History', provider: 'equifax', data: EQUIFAX_SAMPLE_NO_HISTORY }
            ];
        },
        
        // Helper: Get sample by name
        getSample: function(name) {
            const samples = this.getAllSamples();
            const found = samples.find(function(s) { return s.name === name; });
            return found ? found.data : null;
        }
    };
});
