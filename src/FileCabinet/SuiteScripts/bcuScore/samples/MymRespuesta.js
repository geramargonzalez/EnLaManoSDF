define(['N/record', 'N/search'], function (record, search) {
   const MYM_SAMPLE_RESPONSE = {
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
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
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
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 43844562.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "ANDA",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 7586894.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 7586894.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "CONTINGENCIAS",
                    "mnPesos": 207797.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "PASS CARD S.A.",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 3228811.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 3228811.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "CONTINGENCIAS",
                    "mnPesos": 71189.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "FUCAC VERDE COOPERATIVA DE AHORRO Y CRÉDITO",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 11977336.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 11977336.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        }
    ],
    "entidadesRubrosValores_t6": [
        {
            "nombreEntidad": "BANCO DE LA REPÚBLICA ORIENTAL DEL URUGUAY",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 2832519.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 2832519.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "CONTINGENCIAS",
                    "mnPesos": 5642618.0,
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
                    "mnPesos": 44745949.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 44745949.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "ANDA",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 10180399.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 10180399.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "PASS CARD S.A.",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 2995955.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 2995955.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "CONTINGENCIAS",
                    "mnPesos": 304045.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                }
            ]
        },
        {
            "nombreEntidad": "FUCAC VERDE COOPERATIVA DE AHORRO Y CRÉDITO",
            "calificacion": "1C",
            "rubrosValores": [
                {
                    "rubro": "VIGENTE",
                    "mnPesos": 1301300.0,
                    "mePesos": 0.0,
                    "mnDolares": 0.0,
                    "meDolares": 0.0
                },
                {
                    "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
                    "mnPesos": 1301300.0,
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
            "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
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
        },
        {
            "rubro": "VIGENTE - NO AUTOLIQUIDABLE",
            "mnPesos": 62056122.0,
            "mePesos": 0.0,
            "mnDolares": 0.0,
            "meDolares": 0.0
        },
        {
            "rubro": "CONTINGENCIAS",
            "mnPesos": 5946663.0,
            "mePesos": 0.0,
            "mnDolares": 0.0,
            "meDolares": 0.0
        }
    ],
    "documento": "44368234",
    "tipoDocumento": "IDE"
}

});