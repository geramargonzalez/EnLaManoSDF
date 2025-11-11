# Alprestamo Postback - Map/Reduce Script

## Descripción

Script Map/Reduce que procesa leads de Alprestamo y envía postbacks (callbacks) a su API para trackear el funnel completo de conversión. Permite a Alprestamo recibir notificaciones de eventos importantes en el ciclo de vida del lead.

## Estados Soportados

| Estado | Descripción | Cuándo se envía |
|--------|-------------|-----------------|
| `denied` | Lead denegado | Cuando el lead es rechazado por algún motivo |
| `validated` | Usuario validado | Cuando el usuario completa la validación de datos |
| `offered` | Oferta mostrada | Cuando se le presenta una oferta al usuario |
| `granted` | Producto otorgado | Cuando se aprueba y otorga el producto final |

## Configuración en NetSuite

### 1. Campos Personalizados Requeridos

Debes crear los siguientes campos custom en el entity Customer/Lead:

| Script ID | Tipo | Descripción | Obligatorio |
|-----------|------|-------------|-------------|
| `custentity_elm_alprestamo_tracking_id` | Free-Form Text | Tracking ID único de Alprestamo | ✅ Sí |
| `custentity_elm_alprestamo_postback_status` | List/Record | Estado actual para postback (denied/validated/offered/granted) | ✅ Sí |
| `custentity_elm_alprestamo_postback_sent` | Checkbox | Indica si el postback ya fue enviado | ✅ Sí |
| `custentity_elm_monto_oferta_final` | Decimal Number | Monto otorgado | ⭕ Opcional |
| `custentity_elm_plazo_oferta_final` | Integer Number | Cantidad de cuotas | ⭕ Opcional |
| `custentity_elm_producto` | Free-Form Text | Descripción del producto | ⭕ Opcional |
| `custentity_elm_validated_timestamp` | Integer Number | Timestamp UNIX de validación | ⭕ Opcional |
| `custentity_elm_offered_timestamp` | Integer Number | Timestamp UNIX de oferta | ⭕ Opcional |
| `custentity_elm_granted_timestamp` | Integer Number | Timestamp UNIX de otorgamiento | ⭕ Opcional |

### 2. Lista Personalizada para Estados

Crear una Custom List llamada "Alprestamo Postback Status" con estos valores:

```
ID: 1 - Name: denied
ID: 2 - Name: validated  
ID: 3 - Name: offered
ID: 4 - Name: granted
```

### 3. Deployment del Script

1. **Subir el script** a `SuiteScripts/` en NetSuite
2. **Crear Script Record:**
   - Type: Map/Reduce
   - ID: `customscript_elm_callback_alprestamo_mr`
   - Name: `ELM - Alprestamo Postback MR`
   
3. **Script Parameters:**
   - **custscript_elm_postback_days** (Integer)
     - Días hacia atrás para buscar leads (default: 7)

4. **Deploy el script:**
   - Status: Testing/Released
   - Log Level: Debug (inicial), Audit (producción)
   - Frequency: Hourly / Daily (según necesidad)

## Configuración de Ambientes

En el archivo del script, modificar la constante `IS_PRODUCTION`:

```javascript
const CONFIG = {
    IS_PRODUCTION: false,  // false = Testing, true = Producción
    // ...
}
```

### Endpoints

- **Testing**: `https://sandbox.api.uy.alprestamo.io/bid/postback/only-by-url`
- **Producción**: `https://api.uy.alprestamo.io/bid/postback/only-by-url`

## Flujo de Funcionamiento

### getInputData (Stage 1)
Busca leads que cumplan:
- Canal = Alprestamo (ID: 2)
- Tiene `tracking_id` de Alprestamo
- Postback NO enviado (`postback_sent` = false o vacío)
- Tiene un estado válido definido
- Creado en los últimos N días (configurable)

### map (Stage 2)
Por cada lead:
1. Extrae todos los datos relevantes
2. Construye la URL del postback con parámetros
3. Envía HTTP GET a la API de Alprestamo
4. Si HTTP 200 y `status: "success"` → Marca `postback_sent = true`
5. Si error → Registra en comments del lead

### summarize (Stage 3)
- Contabiliza éxitos y errores
- Registra logs de auditoría
- Genera reporte de ejecución

## Ejemplos de URL Generadas

### Postback Completo (granted)
```
https://api.uy.alprestamo.io/bid/postback/only-by-url?tracking_id=ix2DxfgReXMCNvb2tXXSNX1E&status=granted&amount=15000&installments=24&product=Prestamo Personal&validated_email=user@example.com&validated_phone=099123456&validated_timestamp=1656349021&offered_timestamp=1656349437&granted_timestamp=1656349145
```

### Postback Mínimo (validated)
```
https://sandbox.api.uy.alprestamo.io/bid/postback/only-by-url?tracking_id=8wCfLK5drtJNd46sdf&status=validated
```

## Respuestas de la API

### Éxito (HTTP 200)
```json
{
  "status": "success"
}
```

### Error (HTTP != 200)
```json
{
  "status": "error",
  "error_code": "INVALID_TRACKING_ID",
  "error_message": "Tracking ID not found or invalid"
}
```

## Monitoreo y Debugging

### Logs a Revisar

1. **Execution Log** del Map/Reduce:
   - getInputData: Cantidad de leads encontrados
   - map: URL enviada y respuesta por cada lead
   - summarize: Totales de éxitos/errores

2. **System Notes** en el Lead:
   - Se registran errores en el campo `comments`
   
3. **Script Execution Log**:
   - Filtrar por `customscript_elm_callback_alprestamo_mr`

### Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `MISSING_TRACKING_ID` | Lead sin tracking_id | Verificar integración de ingreso de leads |
| `MISSING_STATUS` | No se definió el estado | Asegurar que el workflow setee el estado |
| `HTTP 404` | Tracking ID no existe en Alprestamo | Verificar que sea del ambiente correcto (testing/prod) |
| `HTTP 400` | Parámetros inválidos | Revisar formato de datos enviados |

## Testing

### Paso 1: Crear Lead de Prueba
```javascript
// Ejecutar en consola de NetSuite
var leadId = record.create({
    type: record.Type.CUSTOMER,
    isDynamic: true
});

leadId.setValue({ fieldId: 'custentity_elm_canal', value: '2' }); // Alprestamo
leadId.setValue({ fieldId: 'custentity_elm_alprestamo_tracking_id', value: 'TEST_TRACKING_123' });
leadId.setValue({ fieldId: 'custentity_elm_alprestamo_postback_status', value: '2' }); // validated
leadId.setValue({ fieldId: 'custentity_elm_alprestamo_postback_sent', value: false });
leadId.setValue({ fieldId: 'firstname', value: 'Test' });
leadId.setValue({ fieldId: 'lastname', value: 'Alprestamo' });

var id = leadId.save();
console.log('Lead creado:', id);
```

### Paso 2: Solicitar Tracking IDs de Testing
⚠️ **IMPORTANTE**: Contactar al referente de Alprestamo para obtener tracking IDs válidos del ambiente de testing.

### Paso 3: Ejecutar el Script
- Ir a Scripts > Scheduled
- Buscar el deployment
- Click en "Run Now"

### Paso 4: Verificar Resultados
- Revisar Execution Log
- Verificar que `postback_sent` = true en el lead
- Confirmar con Alprestamo que recibieron el postback

## Mantenimiento

### Ajustar Campos Custom
Si los IDs de tus campos son diferentes, actualizar en la sección CONFIG:

```javascript
FIELDS: {
    TRACKING_ID: 'custentity_elm_alprestamo_tracking_id', // ← Cambiar aquí
    POSTBACK_STATUS: 'custentity_elm_alprestamo_postback_status',
    // ...
}
```

### Ajustar Mapeo de Estados
Si usas IDs diferentes para la custom list de estados:

```javascript
function getStatusText(statusValue) {
    const statusMap = {
        '1': CONFIG.STATUS.DENIED,      // ← Ajustar IDs
        '2': CONFIG.STATUS.VALIDATED,
        '3': CONFIG.STATUS.OFFERED,
        '4': CONFIG.STATUS.GRANTED
    };
    return statusMap[statusValue] || CONFIG.STATUS.DENIED;
}
```

## Integración con Workflow

Para automatizar el proceso, crear un workflow que:

1. **Al recibir el lead** → Setear `postback_status = 'validated'`
2. **Al generar oferta** → Setear `postback_status = 'offered'` + timestamp
3. **Al aprobar** → Setear `postback_status = 'granted'` + monto + cuotas + timestamp
4. **Al denegar** → Setear `postback_status = 'denied'`

El Map/Reduce se ejecutará periódicamente y enviará los postbacks pendientes.

## Soporte

**Autor**: Gerardo Gonzalez  
**Versión**: 2.0  
**Fecha**: Noviembre 2025

---

## Checklist de Implementación

- [ ] Crear campos custom en Customer/Lead
- [ ] Crear Custom List de estados
- [ ] Actualizar IDs de campos en CONFIG si es necesario
- [ ] Subir script a NetSuite
- [ ] Crear Script Record
- [ ] Crear Deployment con parámetros
- [ ] Configurar IS_PRODUCTION según ambiente
- [ ] Solicitar tracking IDs de testing a Alprestamo
- [ ] Ejecutar test con lead de prueba
- [ ] Verificar logs de ejecución
- [ ] Confirmar recepción con Alprestamo
- [ ] Configurar schedule (Hourly/Daily)
- [ ] Crear workflow para setear estados automáticamente
- [ ] Pasar a producción y cambiar IS_PRODUCTION = true
