# Integración Equifax BOX_FASE0_PER - Resumen de Implementación

## ✅ Lo que se ha hecho

### 1. **Actualización del equifaxAdapter.js**
- ✅ Modificado request para usar endpoint `/decision-orchestrations/execute`
- ✅ Nueva estructura con `applicants.primaryConsumer.personalInformation`
- ✅ Agregado `productData` con parámetros BOX_FASE0_PER
- ✅ Formateo automático de documento (xxxxxxx-x)
- ✅ Envío automático de año/mes actual
- ✅ Actualizado scope de OAuth2 token
- ✅ Configuración lazy-loaded con nuevos parámetros

### 2. **Actualización del normalize.js**
- ✅ Función `normalizeEquifaxResponse` actualizada para soportar DOS formatos:
  - **Formato legacy**: con `entidadesRubrosValores_t0/t6` (antiguo)
  - **Formato nuevo BOX_FASE0_PER**: con `variablesDeSalida` agregadas
- ✅ Parsing de strings "Me: X Mn: Y" (orden invertido)
- ✅ Creación de entidades sintéticas desde datos agregados
- ✅ Compatible con el motor de scoring existente (`score.js`)
- ✅ Manejo de persona fallecida
- ✅ Detección automática de formato de respuesta

### 3. **Samples de Prueba**
- ✅ Agregados en `equifaxSamples.js`:
  - `EQUIFAX_BOX_FASE0_RESPONSE` - Caso normal (calificación 1C)
  - `EQUIFAX_BOX_DECEASED_RESPONSE` - Persona fallecida
  - `EQUIFAX_BOX_BAD_RATING_RESPONSE` - Mala calificación (5)
- ✅ Mantiene compatibilidad con samples legacy

### 4. **Documentación**
- ✅ `EQUIFAX_SETUP.md` - Guía completa de configuración
- ✅ Listado de todos los parámetros de Script requeridos
- ✅ Ejemplos de request/response
- ✅ Códigos de error
- ✅ Documentos de prueba del manual

### 5. **Testing**
- ✅ Suitelet de prueba: `equifaxTest_SL.js`
- ✅ UI web para testing con samples
- ✅ Testing con API real
- ✅ Visualización de resultados JSON

## 📋 Parámetros de Script Requeridos

Debes crear estos parámetros en NetSuite:

| ID | Tipo | Valor Default | Descripción |
|----|------|---------------|-------------|
| `custscript_equifax_client_id` | Text | - | Client ID de Equifax |
| `custscript_equifax_client_secret` | Password | - | Client Secret de Equifax |
| `custscript_equifax_token_url` | URL | `https://api.latam.equifax.com/v2/oauth/token` | URL token OAuth2 |
| `custscript_equifax_api_url` | URL | `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations` | URL API (sin /execute) |
| `custscript_equifax_billto` | Text | `UY004277B001` | Bill To code |
| `custscript_equifax_shipto` | Text | `UY004277B001S3642` | Ship To code |
| `custscript_equifax_product_name` | Text | `UYICBOX` | Producto |
| `custscript_equifax_product_orch` | Text | `boxFase0Per` | Orquestación |
| `custscript_equifax_customer` | Text | `UYICMANDAZY` | Cliente |
| `custscript_equifax_model` | Text | `boxFase0PerMandazy` | Modelo |
| `custscript_equifax_configuration` | Text | `Config` | Configuración |

## 🔄 Flujo de Integración

```
Usuario solicita scoring
    ↓
service.js (selecciona provider: 'equifax')
    ↓
equifaxAdapter.js
    ├─ Obtiene token OAuth2 (caché 55 min)
    ├─ Formatea documento (1234567 → 1234567-x)
    ├─ Agrega año/mes actual
    ├─ Construye payload con productData
    └─ Llama a API /decision-orchestrations/execute
    ↓
normalize.js
    ├─ Detecta formato (legacy vs nuevo)
    ├─ Parsea "Me: X Mn: Y"
    ├─ Crea entidades sintéticas
    └─ Genera estructura normalizada
    ↓
score.js (calcula puntaje)
    ↓
Retorna resultado
```

## 🧪 Testing

### Opción 1: Testing con Samples (sin API)
```javascript
// En navegador o consola NetSuite
require(['../bcuScore/domain/normalize', '../bcuScore/samples/equifaxSamples'], 
function(normalize, samples) {
    var normalized = normalize.normalizeEquifaxResponse(samples.EQUIFAX_BOX_FASE0_RESPONSE);
    console.log(normalized);
});
```

### Opción 2: Testing con Suitelet
1. Desplegar `equifaxTest_SL.js` como Suitelet en NetSuite
2. Abrir en navegador
3. Probar con samples o API real
4. Ver resultados en formato JSON

### Opción 3: Testing con API Real
```javascript
// En script NetSuite
var scoreResult = bcuService.calculateScore('1111111-1', {
    provider: 'equifax',
    debug: true
});
log.debug('Score', scoreResult);
```

## 📊 Estructura de Datos Normalizada

La respuesta normalizada tiene esta estructura compatible con `score.js`:

```javascript
{
    provider: 'equifax',
    documento: '1111111-1',
    periodData: {
        t0: {
            totals: [
                { rubro: 'VIGENTE', vigente: 2530, vencido: 0, castigado: 0, total: 2530 },
                { rubro: 'VENCIDO', vigente: 0, vencido: 0, castigado: 0, total: 0 },
                { rubro: 'CASTIGADO', vigente: 0, vencido: 0, castigado: 0, total: 0 }
            ],
            entities: [
                {
                    entidad: 'Banco de la República Oriental del Uruguay',
                    rating: '1C',
                    vigente: 2530,
                    vencido: 0,
                    castigado: 0,
                    total: 2530,
                    rubros: [...]
                }
            ],
            aggregates: {
                vigente: { mn: 2530, me: 0, total: 2530 },
                vencido: { mn: 0, me: 0, total: 0 },
                castigado: { mn: 0, me: 0, total: 0 },
                sumVigenteU1m: 23062,
                sumVencidoU1m: 0,
                sumCastigadoU1m: 0
            },
            rubrosValoresGenerales: [...] // Para compatibilidad con score.js
        },
        t6: { ... } // Vacío en BOX_FASE0_PER (no tiene datos T6)
    },
    flags: {
        isDeceased: false,
        hasRejectableRating: false
    },
    metadata: {
        nombre: 'MARIA ANA SOLAR',
        worstRating: '1C',
        fechaConsulta: '2025-10-16',
        periodo: '2023',
        codigo_institucion: '0001'
    }
}
```

## ⚠️ Diferencias con Formato Legacy

| Aspecto | Legacy | BOX_FASE0_PER |
|---------|--------|---------------|
| **Entidades** | Array `entidadesRubrosValores_t0` | String `bcu_instituciones` (CSV) |
| **Rubros** | Array detallado por entidad | Valores agregados "Me: X Mn: Y" |
| **Períodos** | t0 y t6 explícitos | Solo actual (t0) |
| **Calificación** | Por entidad | Agregada `bcu_calificacion` |
| **Formato montos** | `{ mnPesos: X, mePesos: Y }` | String `"Me: Y Mn: X"` |

## 🚀 Próximos Pasos

1. **Configurar parámetros en NetSuite** (ver lista arriba)
2. **Desplegar archivos actualizados**:
   - `equifaxAdapter.js`
   - `normalize.js`
   - `equifaxSamples.js`
   - `equifaxTest_SL.js`
3. **Testing**:
   - Probar normalizer con samples
   - Probar API real con documento 1111111-1
   - Validar scoring con score.js
4. **Validación en UAT**
5. **Deploy a Producción**

## 📝 Notas Importantes

- ✅ **Retrocompatible**: Sigue funcionando con formato legacy si lo recibe
- ✅ **Auto-detección**: Detecta automáticamente qué formato usar
- ✅ **Sin breaking changes**: No afecta código existente de MYM o BCU
- ✅ **Optimizado**: Caché de token, timeouts cortos, lazy loading
- ⚠️ **Persona fallecida**: Se detecta automáticamente y rechaza sin scoring
- ⚠️ **Mala calificación**: Se detecta calificación 2B, 3, 4, 5 y marca flag

## 🔗 Archivos Modificados/Creados

### Modificados:
- `src/FileCabinet/SuiteScripts/bcuScore/adapters/equifaxAdapter.js`
- `src/FileCabinet/SuiteScripts/bcuScore/domain/normalize.js`
- `src/FileCabinet/SuiteScripts/bcuScore/samples/equifaxSamples.js`

### Creados:
- `src/FileCabinet/SuiteScripts/bcuScore/EQUIFAX_SETUP.md` (documentación)
- `src/FileCabinet/SuiteScripts/bcuScore/EQUIFAX_INTEGRATION_SUMMARY.md` (este archivo)
- `src/FileCabinet/SuiteScripts/bcuScore/test/equifaxTest_SL.js` (suitelet de prueba)

## 📞 Soporte

Si tienes problemas:
1. Revisa `EQUIFAX_SETUP.md` para configuración detallada
2. Usa `equifaxTest_SL.js` para debugging
3. Verifica logs en NetSuite (Search: Script Execution Log)
4. Contacta a Equifax para dudas sobre `billTo`, `shipTo`, credenciales

---

**Estado**: ✅ Implementación completa - Lista para configurar y probar
