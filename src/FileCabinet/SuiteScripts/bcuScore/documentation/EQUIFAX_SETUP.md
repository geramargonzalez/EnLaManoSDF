# Configuración Equifax BOX_FASE0_PER para NetSuite

Este documento describe los parámetros de Script necesarios para la integración con la API de Equifax BOX_FASE0_PER (MANDAZY).

## Parámetros de Script Requeridos

### Autenticación OAuth2

| ID Parámetro | Nombre | Tipo | Descripción | Ejemplo |
|--------------|--------|------|-------------|---------|
| `custscript_equifax_client_id` | Equifax Client ID | Text | Client ID proporcionado por Equifax | `your-client-id` |
| `custscript_equifax_client_secret` | Equifax Client Secret | Password | Client Secret proporcionado por Equifax | `your-client-secret` |
| `custscript_equifax_token_url` | Equifax Token URL | URL | Endpoint para obtener token OAuth2 | `https://api.latam.equifax.com/v2/oauth/token` |

### Configuración API

| ID Parámetro | Nombre | Tipo | Descripción | Ejemplo |
|--------------|--------|------|-------------|---------|
| `custscript_equifax_api_url` | Equifax API URL | URL | Base URL del servicio Interconnect (sin /execute) | `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations` |

### Parámetros ProductData (BOX_FASE0_PER)

| ID Parámetro | Nombre | Tipo | Descripción | Valor Default |
|--------------|--------|------|-------------|---------------|
| `custscript_equifax_billto` | Equifax Bill To | Text | Código de facturación | `UY004277B001` |
| `custscript_equifax_shipto` | Equifax Ship To | Text | Código de envío | `UY004277B001S3642` |
| `custscript_equifax_product_name` | Equifax Product Name | Text | Nombre del producto | `UYICBOX` |
| `custscript_equifax_product_orch` | Equifax Product Orch | Text | Orquestación del producto | `boxFase0Per` |
| `custscript_equifax_customer` | Equifax Customer | Text | Nombre del cliente | `UYICMANDAZY` |
| `custscript_equifax_model` | Equifax Model | Text | Nombre del modelo/implementación | `boxFase0PerMandazy` |
| `custscript_equifax_configuration` | Equifax Configuration | Text | Configuración | `Config` |

## Ambientes

### UAT (Testing)
- **Token URL**: `https://api.uat.latam.equifax.com/v2/oauth/token`
- **API URL**: `https://api.uat.latam.equifax.com/business/interconnect/v1/decision-orchestrations`
- **Scope**: `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations`

### PROD (Producción)
- **Token URL**: `https://api.latam.equifax.com/v2/oauth/token`
- **API URL**: `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations`
- **Scope**: `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations`

## Estructura de Request

```json
{
    "applicants": {
        "primaryConsumer": {
            "personalInformation": {
                "documento": "1111111-1",
                "tipoDocumento": "CI",
                "paisDocumento": "UY",
                "anio": "2025",
                "mes": "10"
            }
        }
    },
    "productData": {
        "billTo": "UY004277B001",
        "shipTo": "UY004277B001S3642",
        "productName": "UYICBOX",
        "productOrch": "boxFase0Per",
        "configuration": "Config",
        "customer": "UYICMANDAZY",
        "model": "boxFase0PerMandazy"
    }
}
```

## Estructura de Response

```json
{
    "transactionId": "8fb18f7f-2bef-4499-bba9-b97905805f38",
    "status": "completed",
    "interconnectResponse": {
        "personalInformation": { ... },
        "variablesDeSalida": {
            "accion": "Salida",
            "periodo": "2023",
            "nombre": "MARIA ANA SOLAR",
            "documento": "1111111-1",
            "bcu_instituciones": "Banco de la República Oriental del Uruguay",
            "bcu_calificacion": "5",
            "vigente": "Me: 0 Mn: 2530",
            "vencido": "Me: 0 Mn: 0",
            "castigado": "Me: 0 Mn: 0",
            "contingencias": "Me: 0 Mn: 0",
            "bcu_peor_calif_u1m": "1C",
            "bcu_sum_vigente_u1m": "23062",
            "bcu_sum_novigente_u1m": "0",
            "bcu_sum_castigado_u1m": "0",
            "codigo_institucion": "0001"
        },
        "infoConsulta": {
            "nombre": "MARIA SOLAR",
            "documento": "1111111-1",
            "fallecido": "N"
        }
    }
}
```

## Flujo de Integración

1. **Token**: Se obtiene automáticamente usando OAuth2 Client Credentials
   - Cache: 55 minutos
   - Timeout: 10 segundos

2. **Consulta BCU**: Se ejecuta con el token obtenido
   - Formato documento: Se agrega guión automáticamente (xxxxxxx-x)
   - Fecha: Se envía año y mes actual automáticamente
   - Timeout: 15 segundos

3. **Normalización**: La respuesta se normaliza a formato compatible con `score.js`
   - Los valores "Me: X Mn: Y" se parsean automáticamente
   - Se crea una entidad sintética con los datos agregados
   - Compatible con el motor de scoring existente

4. **Scoring**: El motor de scoring calcula el puntaje final

## Casos Especiales

### Persona Fallecida
- `infoConsulta.fallecido = "S"`
- `variablesDeSalida.accion = "PERSONA_FALLECIDA"`
- Se retorna inmediatamente sin scoring

### Sin Antecedentes
- `variablesDeSalida.accion = "SIN_ANTECEDENTES"`
- Todos los campos BCU estarán vacíos o en cero

### Con Antecedentes
- `variablesDeSalida.accion = "CON_ANTECEDENTES"` o `"Salida"`
- Datos BCU disponibles para scoring

## Códigos de Error

| Código HTTP | Descripción |
|-------------|-------------|
| 400 | Bad Request - Parámetros faltantes o incorrectos |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos para el recurso |
| 404 | Not Found - Producto/configuración no encontrado |
| 500 | Server Error - Error interno de Equifax |

## Documentos de Prueba

Según el manual de integración:

- **Con antecedentes**: `1111111-1`
- **Persona fallecida**: `3796548-3`

## Notas Importantes

1. **Formato documento**: El adapter formatea automáticamente el documento al formato requerido (xxxxxxx-x)
2. **Periodo**: Los campos `anio` y `mes` se envían automáticamente con la fecha actual
3. **Cache**: No se recomienda cachear las consultas BCU (datos cambian frecuentemente)
4. **Timeout**: Los timeouts están optimizados para performance (10s token, 15s consulta)
5. **Normalización**: La respuesta se normaliza automáticamente para ser compatible con el motor de scoring existente

## Soporte

Para dudas sobre los valores de `billTo`, `shipTo` y otros parámetros de `productData`, contactar a Equifax ya que estos pueden variar según el contrato.
