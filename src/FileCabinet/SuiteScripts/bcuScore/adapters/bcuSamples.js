/**
 * @NApiVersion 2.1
 * @description Muestras de respuestas BCU Direct para testing
 */

define([], function () {
    'use strict';

    /**
     * Respuesta BCU exitosa con datos normales
     */
    var BCU_NORMAL_RESPONSE = {
        documento: "12345678",
        nombre: "JUAN CARLOS PEREZ RODRIGUEZ",
        fechaConsulta: "2024-01-15",
        fallecido: "N",
        status: {
            codigo: "200",
            mensaje: "Consulta exitosa"
        },
        periodData: {
            t0: {
                rubrosGenerales: [
                    {
                        rubro: "PRESTAMOS PERSONALES",
                        vigente: 450000,
                        vencido: 25000,
                        castigado: 0
                    },
                    {
                        rubro: "TARJETAS DE CREDITO",
                        vigente: 120000,
                        vencido: 0,
                        castigado: 15000
                    },
                    {
                        rubro: "PRESTAMOS HIPOTECARIOS",
                        vigente: 2800000,
                        vencido: 0,
                        castigado: 0
                    }
                ],
                entidades: [
                    {
                        nombreEntidad: "BANCO REPUBLICA",
                        calificacion: "1A",
                        vigente: 2950000,
                        vencido: 0,
                        castigado: 0,
                        rubros: [
                            {
                                rubro: "PRESTAMOS HIPOTECARIOS", 
                                vigente: 2800000,
                                vencido: 0,
                                castigado: 0
                            },
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 150000,
                                vencido: 0,
                                castigado: 0
                            }
                        ]
                    },
                    {
                        nombreEntidad: "BANCO SANTANDER",
                        calificacion: "2A",
                        vigente: 420000,
                        vencido: 25000,
                        castigado: 15000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 300000,
                                vencido: 25000,
                                castigado: 0
                            },
                            {
                                rubro: "TARJETAS DE CREDITO",
                                vigente: 120000,
                                vencido: 0,
                                castigado: 15000
                            }
                        ]
                    }
                ]
            },
            t6: {
                rubrosGenerales: [
                    {
                        rubro: "PRESTAMOS PERSONALES",
                        vigente: 380000,
                        vencido: 45000,
                        castigado: 20000
                    },
                    {
                        rubro: "TARJETAS DE CREDITO", 
                        vigente: 95000,
                        vencido: 8000,
                        castigado: 35000
                    },
                    {
                        rubro: "PRESTAMOS HIPOTECARIOS",
                        vigente: 2750000,
                        vencido: 0,
                        castigado: 0
                    }
                ],
                entidades: [
                    {
                        nombreEntidad: "BANCO REPUBLICA",
                        calificacion: "1A",
                        vigente: 2880000,
                        vencido: 0,
                        castigado: 0,
                        rubros: [
                            {
                                rubro: "PRESTAMOS HIPOTECARIOS",
                                vigente: 2750000,
                                vencido: 0,
                                castigado: 0
                            },
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 130000,
                                vencido: 0,
                                castigado: 0
                            }
                        ]
                    },
                    {
                        nombreEntidad: "BANCO SANTANDER",
                        calificacion: "2B",
                        vigente: 345000,
                        vencido: 53000,
                        castigado: 55000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 250000,
                                vencido: 45000,
                                castigado: 20000
                            },
                            {
                                rubro: "TARJETAS DE CREDITO",
                                vigente: 95000,
                                vencido: 8000,
                                castigado: 35000
                            }
                        ]
                    }
                ]
            }
        },
        aggregates: {
            totalVigente: 3370000,
            totalVencido: 25000,
            totalCastigado: 15000,
            cantEntidadesVigente: 2,
            cantEntidadesVencido: 1,
            cantEntidadesCastigado: 1
        }
    };

    /**
     * Respuesta BCU para persona fallecida
     */
    var BCU_DECEASED_RESPONSE = {
        documento: "87654321",
        nombre: "MARIA ELENA GONZALEZ SILVA",
        fechaConsulta: "2024-01-15",
        fallecido: "S",
        status: {
            codigo: "200",
            mensaje: "Consulta exitosa - Persona fallecida"
        },
        periodData: {
            t0: { rubrosGenerales: [], entidades: [] },
            t6: { rubrosGenerales: [], entidades: [] }
        },
        aggregates: {
            totalVigente: 0,
            totalVencido: 0,
            totalCastigado: 0,
            cantEntidadesVigente: 0,
            cantEntidadesVencido: 0,
            cantEntidadesCastigado: 0
        }
    };

    /**
     * Respuesta BCU con calificación mala (rechazo automático)
     */
    var BCU_BAD_RATING_RESPONSE = {
        documento: "11223344",
        nombre: "CARLOS ALBERTO MARTINEZ LOPEZ",
        fechaConsulta: "2024-01-15",
        fallecido: "N",
        status: {
            codigo: "200",
            mensaje: "Consulta exitosa"
        },
        periodData: {
            t0: {
                rubrosGenerales: [
                    {
                        rubro: "PRESTAMOS PERSONALES",
                        vigente: 0,
                        vencido: 180000,
                        castigado: 520000
                    },
                    {
                        rubro: "TARJETAS DE CREDITO",
                        vigente: 0,
                        vencido: 45000,
                        castigado: 230000
                    }
                ],
                entidades: [
                    {
                        nombreEntidad: "BANCO ITAU",
                        calificacion: "3", // Calificación mala = rechazo
                        vigente: 0,
                        vencido: 125000,
                        castigado: 420000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 0,
                                vencido: 125000,
                                castigado: 420000
                            }
                        ]
                    },
                    {
                        nombreEntidad: "PREX",
                        calificacion: "4", // También mala calificación
                        vigente: 0,
                        vencido: 100000,
                        castigado: 330000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 0,
                                vencido: 55000,
                                castigado: 100000
                            },
                            {
                                rubro: "TARJETAS DE CREDITO",
                                vigente: 0,
                                vencido: 45000,
                                castigado: 230000
                            }
                        ]
                    }
                ]
            },
            t6: {
                rubrosGenerales: [
                    {
                        rubro: "PRESTAMOS PERSONALES",
                        vigente: 0,
                        vencido: 120000,
                        castigado: 480000
                    },
                    {
                        rubro: "TARJETAS DE CREDITO",
                        vigente: 0,
                        vencido: 35000,
                        castigado: 180000
                    }
                ],
                entidades: [
                    {
                        nombreEntidad: "BANCO ITAU",
                        calificacion: "4",
                        vigente: 0,
                        vencido: 95000,
                        castigado: 380000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 0,
                                vencido: 95000,
                                castigado: 380000
                            }
                        ]
                    },
                    {
                        nombreEntidad: "PREX",
                        calificacion: "5", // Peor calificación posible
                        vigente: 0,
                        vencido: 60000,
                        castigado: 280000,
                        rubros: [
                            {
                                rubro: "PRESTAMOS PERSONALES",
                                vigente: 0,
                                vencido: 25000,
                                castigado: 100000
                            },
                            {
                                rubro: "TARJETAS DE CREDITO",
                                vigente: 0,
                                vencido: 35000,
                                castigado: 180000
                            }
                        ]
                    }
                ]
            }
        },
        aggregates: {
            totalVigente: 0,
            totalVencido: 225000,
            totalCastigado: 750000,
            cantEntidadesVigente: 0,
            cantEntidadesVencido: 2,
            cantEntidadesCastigado: 2
        }
    };

    /**
     * Respuesta BCU sin datos (perfil sin historial crediticio)
     */
    var BCU_NO_DATA_RESPONSE = {
        documento: "55667788",
        nombre: "ANA LUCIA RODRIGUEZ FERNANDEZ",
        fechaConsulta: "2024-01-15",
        fallecido: "N",
        status: {
            codigo: "204",
            mensaje: "Sin datos de historial crediticio"
        },
        periodData: {
            t0: { rubrosGenerales: [], entidades: [] },
            t6: { rubrosGenerales: [], entidades: [] }
        },
        aggregates: {
            totalVigente: 0,
            totalVencido: 0,
            totalCastigado: 0,
            cantEntidadesVigente: 0,
            cantEntidadesVencido: 0,
            cantEntidadesCastigado: 0
        }
    };

    /**
     * Respuesta BCU con error de sistema
     */
    var BCU_ERROR_RESPONSE = {
        documento: "99887766",
        status: {
            codigo: "500",
            mensaje: "Error interno del servicio BCU"
        },
        error: {
            type: "INTERNAL_ERROR",
            description: "Timeout en consulta a base de datos BCU",
            timestamp: "2024-01-15T10:30:45.123Z"
        }
    };

    /**
     * Respuesta BCU con documento inválido
     */
    var BCU_INVALID_DOCUMENT_RESPONSE = {
        documento: "INVALID",
        status: {
            codigo: "400",
            mensaje: "Documento inválido"
        },
        error: {
            type: "VALIDATION_ERROR",
            description: "El documento proporcionado no tiene formato válido",
            timestamp: "2024-01-15T10:30:45.123Z"
        }
    };

    // Public API
    return {
        // Casos exitosos
        BCU_NORMAL_RESPONSE: BCU_NORMAL_RESPONSE,
        BCU_NO_DATA_RESPONSE: BCU_NO_DATA_RESPONSE,
        
        // Casos de rechazo
        BCU_DECEASED_RESPONSE: BCU_DECEASED_RESPONSE,
        BCU_BAD_RATING_RESPONSE: BCU_BAD_RATING_RESPONSE,
        
        // Casos de error
        BCU_ERROR_RESPONSE: BCU_ERROR_RESPONSE,
        BCU_INVALID_DOCUMENT_RESPONSE: BCU_INVALID_DOCUMENT_RESPONSE,

        /**
         * Obtiene muestra por tipo para testing
         * @param {string} type - Tipo de muestra
         * @returns {Object}
         */
        getSample: function(type) {
            switch (type.toLowerCase()) {
                case 'normal': return BCU_NORMAL_RESPONSE;
                case 'deceased': return BCU_DECEASED_RESPONSE;
                case 'bad_rating': return BCU_BAD_RATING_RESPONSE;
                case 'no_data': return BCU_NO_DATA_RESPONSE;
                case 'error': return BCU_ERROR_RESPONSE;
                case 'invalid_document': return BCU_INVALID_DOCUMENT_RESPONSE;
                default: return BCU_NORMAL_RESPONSE;
            }
        },

        /**
         * Lista todos los tipos de muestra disponibles
         */
        getAvailableTypes: function() {
            return [
                'normal', 
                'deceased', 
                'bad_rating', 
                'no_data', 
                'error', 
                'invalid_document'
            ];
        }
    };
});