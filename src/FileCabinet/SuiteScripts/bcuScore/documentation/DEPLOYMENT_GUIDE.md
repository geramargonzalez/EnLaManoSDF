# 🚀 Guía de Deployment - Equifax BOX_FASE0_PER

## ✅ Archivos Listos para Deployment

### Archivos Modificados (reemplazar en NetSuite):
```
src/FileCabinet/SuiteScripts/bcuScore/adapters/equifaxAdapter.js
src/FileCabinet/SuiteScripts/bcuScore/domain/normalize.js
src/FileCabinet/SuiteScripts/bcuScore/samples/equifaxSamples.js
```

### Archivos Nuevos (subir a NetSuite):
```
src/FileCabinet/SuiteScripts/bcuScore/test/equifaxTest_SL.js
src/FileCabinet/SuiteScripts/bcuScore/test/normalizerTest_SL.js
src/FileCabinet/SuiteScripts/bcuScore/EQUIFAX_SETUP.md (opcional, documentación)
src/FileCabinet/SuiteScripts/bcuScore/EQUIFAX_INTEGRATION_SUMMARY.md (opcional, documentación)
```

---

## 📝 Paso 1: Crear Parámetros de Script

En NetSuite, ve a **Customization > Scripting > Script Parameters** y crea los siguientes:

### Parámetros de Autenticación:

| ID | Nombre Display | Tipo | Valor Default |
|----|----------------|------|---------------|
| `custscript_equifax_client_id` | Equifax Client ID | Free-Form Text | *(dejar vacío, configurar después)* |
| `custscript_equifax_client_secret` | Equifax Client Secret | Password | *(dejar vacío, configurar después)* |
| `custscript_equifax_token_url` | Equifax Token URL | URL | `https://api.latam.equifax.com/v2/oauth/token` |
| `custscript_equifax_api_url` | Equifax API Base URL | URL | `https://api.latam.equifax.com/business/interconnect/v1/decision-orchestrations` |

### Parámetros de ProductData:

| ID | Nombre Display | Tipo | Valor Default |
|----|----------------|------|---------------|
| `custscript_equifax_billto` | Equifax Bill To | Free-Form Text | `UY004277B001` |
| `custscript_equifax_shipto` | Equifax Ship To | Free-Form Text | `UY004277B001S3642` |
| `custscript_equifax_product_name` | Equifax Product Name | Free-Form Text | `UYICBOX` |
| `custscript_equifax_product_orch` | Equifax Product Orch | Free-Form Text | `boxFase0Per` |
| `custscript_equifax_customer` | Equifax Customer | Free-Form Text | `UYICMANDAZY` |
| `custscript_equifax_model` | Equifax Model | Free-Form Text | `boxFase0PerMandazy` |
| `custscript_equifax_configuration` | Equifax Configuration | Free-Form Text | `Config` |

**Nota**: Los valores default de ProductData son referenciales. Confirmar con Equifax si son correctos para producción.

---

## 📦 Paso 2: Subir Archivos a NetSuite

### Opción A: Usar SuiteCloud CLI (recomendado)
```bash
cd "g:\Other computers\Mi Portátil (1)\Documents\EnLaMano\EnLaManoSDF"

# Deploy archivos modificados
suitecloud file:upload --paths src/FileCabinet/SuiteScripts/bcuScore/adapters/equifaxAdapter.js
suitecloud file:upload --paths src/FileCabinet/SuiteScripts/bcuScore/domain/normalize.js
suitecloud file:upload --paths src/FileCabinet/SuiteScripts/bcuScore/samples/equifaxSamples.js

# Deploy archivos nuevos
suitecloud file:upload --paths src/FileCabinet/SuiteScripts/bcuScore/test/equifaxTest_SL.js
suitecloud file:upload --paths src/FileCabinet/SuiteScripts/bcuScore/test/normalizerTest_SL.js
```

### Opción B: Usar NetSuite UI
1. Ir a **Documents > Files > SuiteScripts > bcuScore**
2. Buscar cada archivo y usar **Replace** para los modificados
3. Usar **New > File** para subir los nuevos en la carpeta `test/`

---

## 🧪 Paso 3: Crear y Desplegar Suitelet de Test del Normalizer

1. En NetSuite: **Customization > Scripting > Scripts > New**
2. Seleccionar `normalizerTest_SL.js`
3. **Script ID**: `customscript_equifax_normalizer_test`
4. **Name**: `Equifax Normalizer Test`
5. Crear un **Deployment**:
   - **Status**: Testing
   - **Audience**: All Roles
   - **Log Level**: Debug
6. **Guardar y anotar URL del Suitelet**

### Ejecutar Test:
1. Abrir la URL del Suitelet en el navegador
2. Debe mostrar un reporte con 4 tests:
   - ✅ BOX_FASE0_PER - Normal (1C)
   - ✅ BOX_FASE0_PER - Fallecido
   - ✅ BOX_FASE0_PER - Mala Calificación (5)
   - ✅ Legacy - Normal
3. **Verificar que todos los tests pasen (4/4)** ✅

**Si algún test falla**: Revisar el error en el reporte y verificar que los archivos se subieron correctamente.

---

## 🔐 Paso 4: Configurar Credenciales de Equifax

1. Contactar a Equifax para obtener:
   - **Client ID**
   - **Client Secret**
   - Confirmar valores de `billTo`, `shipTo`, etc.

2. En NetSuite, editar el Script que usa el adapter:
   - Ir a **Customization > Scripting > Scripts**
   - Buscar tu script (ej: `ELM_IngresoProveedores_S1_REST`)
   - En la pestaña **Parameters**:
     - `custscript_equifax_client_id` = *(pegar Client ID)*
     - `custscript_equifax_client_secret` = *(pegar Client Secret)*
   - **Guardar**

---

## 🌐 Paso 5: Crear y Desplegar Suitelet de Test con API Real

1. En NetSuite: **Customization > Scripting > Scripts > New**
2. Seleccionar `equifaxTest_SL.js`
3. **Script ID**: `customscript_equifax_api_test`
4. **Name**: `Equifax API Test`
5. En la pestaña **Parameters**, configurar:
   - Todos los parámetros creados en el Paso 1
   - Especialmente `custscript_equifax_client_id` y `custscript_equifax_client_secret`
6. Crear un **Deployment**:
   - **Status**: Testing
   - **Audience**: Administrator (solo para testing)
   - **Log Level**: Debug
7. **Guardar y anotar URL del Suitelet**

### Ejecutar Test con API Real:
1. Abrir la URL del Suitelet en el navegador
2. Hacer clic en **"🚀 Consultar API Real"** con documento `1111111-1`
3. Debe retornar un JSON con:
   - `success: true`
   - `scoreResult` con el puntaje calculado
   - `timings` con métricas de performance

**Si falla**:
- Revisar logs: **Customization > Scripting > Script Execution Log**
- Buscar errores de autenticación (401) o configuración (400)
- Verificar que las credenciales son correctas

---

## ✅ Paso 6: Validación Final

### Test de Integración Completa:

Ejecutar desde consola de NetSuite o script:

```javascript
require(['N/https', '../bcuScore/app/service'], function(https, bcuService) {
    // Test 1: Caso normal
    var result1 = bcuService.calculateScore('1111111-1', {
        provider: 'equifax',
        debug: true
    });
    console.log('Test 1 (Normal):', result1);
    
    // Test 2: Persona fallecida
    var result2 = bcuService.calculateScore('3796548-3', {
        provider: 'equifax',
        debug: true
    });
    console.log('Test 2 (Fallecido):', result2);
});
```

### Checklist de Validación:

- [ ] **Test 1**: Normalizer funciona con samples (4/4 tests pasan)
- [ ] **Test 2**: API real retorna token correctamente
- [ ] **Test 3**: Consulta documento 1111111-1 exitosa
- [ ] **Test 4**: Score se calcula correctamente
- [ ] **Test 5**: Persona fallecida se rechaza automáticamente
- [ ] **Test 6**: Performance < 3 segundos por consulta
- [ ] **Test 7**: Logs no muestran errores

---

## 🔄 Paso 7: Actualizar Script de Producción

Si ya tienes un RESTlet o script que usa scoring BCU:

```javascript
// Antes (solo MYM):
var scoreResult = bcuService.calculateScore(documento, {
    provider: 'mym'
});

// Ahora (con Equifax):
var scoreResult = bcuService.calculateScore(documento, {
    provider: 'equifax'  // <-- Cambiar a 'equifax'
});
```

O implementar lógica de fallback:

```javascript
var scoreResult;
try {
    // Intentar con Equifax primero
    scoreResult = bcuService.calculateScore(documento, {
        provider: 'equifax'
    });
} catch (equifaxError) {
    // Fallback a MYM
    log.debug('Equifax failed, using MYM', equifaxError.toString());
    scoreResult = bcuService.calculateScore(documento, {
        provider: 'mym'
    });
}
```

---

## 📊 Paso 8: Monitoreo Post-Deployment

### Métricas a monitorear:

1. **Script Execution Log**:
   - Buscar errores de Equifax
   - Verificar tiempos de respuesta

2. **Governance**:
   - Límites de API calls
   - Uso de governance units

3. **Success Rate**:
   - Porcentaje de consultas exitosas
   - Errores 401 (token), 400 (request), 500 (server)

### Logs Importantes:

```
BCU Score - Equifax Adapter Fast Error
BCU Score Provider Fallback
BCU Score Cache Invalidated
BCU Score Error
```

---

## 🆘 Troubleshooting

### Error: "TOKEN_ERROR"
- Verificar `client_id` y `client_secret`
- Verificar `token_url` es correcta
- Contactar a Equifax para verificar credenciales

### Error: "Missing 'productData.customer,productData.configuration,productData.model'"
- Verificar que todos los parámetros de ProductData estén configurados
- Revisar `billTo`, `shipTo`, `customer`, `model`, etc.

### Error: "404 - Not Found"
- Verificar valores de `productName`, `productOrch`, `customer`
- Contactar a Equifax para confirmar valores correctos

### Error: "Documento inválido"
- El adapter formatea automáticamente, pero verificar que el documento sea válido
- Debe ser 7-8 dígitos

### Score siempre retorna 0:
- Revisar logs de `score.js`
- Verificar que `normalized.periodData.t0.entities` tenga datos
- Usar Suitelet de test para ver estructura normalizada

---

## 📞 Contactos

- **Equifax Soporte**: *(agregar contacto)*
- **Desarrollador**: *(tu nombre/email)*

---

## 🎉 ¡Deployment Completado!

Si todos los tests pasan, la integración está lista para usar en producción.

**Próximos pasos**:
1. Monitorear logs por 1-2 semanas
2. Ajustar timeouts si es necesario
3. Optimizar caché según volumetría
4. Documentar casos de uso específicos
