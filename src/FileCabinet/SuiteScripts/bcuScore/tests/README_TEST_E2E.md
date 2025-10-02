# TEST END-TO-END: BCU Score Service

## 🎯 Propósito

Este Suitelet ejecuta el **flujo completo** del servicio de scoring BCU, mostrando:
- ✅ Validación de entrada
- 📡 Llamada a `service.calculateScore()`
- 🧮 Cálculo completo del score
- 📊 Análisis de metadata, contributions y flags
- ⏱️ Timing detallado de cada paso
- 🚀 Indicador de cache hit/miss

Es ideal para:
- Validar que el servicio funciona end-to-end
- Diagnosticar problemas de integración
- Medir performance real con datos de producción
- Entender el flujo completo de scoring

---

## 📋 Prerequisitos

1. **Script dependencies** (en este orden):
   - `../app/service.js` (servicio principal)
   - `../config/scoringRules.js` (reglas de scoring)
   - `../domain/score.js` (cálculo puro)
   - `../domain/rejection.js` (lógica de rechazo)
   - `../domain/validation.js` (validación de datos)
   - Módulo de provider (Equifax/BCU) configurado

2. **Custom Record** `customrecord_sdb_score` con ID=1:
   - Campo `custrecord_sdb_score_base_score`
   - Campo `custrecord_sdb_score_rejection_rules`
   - 18 campos binned WOE (`custrecord_sdb_*_binned`)

3. **Provider configurado** (Equifax o BCU):
   - REST endpoint configurado
   - Credenciales válidas
   - Timeout adecuado (15s recomendado)

---

## 🚀 Despliegue

### Opción A: Despliegue Manual (File Cabinet)

1. **Subir script a NetSuite**:
   - Ir a: **Documents > Files > File Cabinet**
   - Navegar a: `SuiteScripts/bcuScore/tests/`
   - Subir: `TEST_E2E_Service_SL.js`

2. **Crear Script Record**:
   - Ir a: **Customization > Scripting > Scripts > New**
   - Seleccionar archivo: `TEST_E2E_Service_SL.js`
   - **Script ID**: `customscript_test_e2e_service`
   - **Name**: `TEST E2E Service - BCU Score`
   - Guardar

3. **Crear Deployment**:
   - En el Script Record, pestaña **Deployments**
   - Click **Add Deployment**
   - **Status**: Testing
   - **Log Level**: Debug
   - **Deployed**: Marcar checkbox
   - **Audience**: Administrator o All Roles
   - Guardar
   - **Copiar URL externa** (External URL)

### Opción B: Despliegue SDF

```powershell
# Desde el directorio raíz del proyecto
suitecloud file:import --paths "/SuiteScripts/bcuScore/tests/TEST_E2E_Service_SL.js"
suitecloud project:deploy --accountid YOUR_ACCOUNT
```

---

## 🧪 Uso

### URL Base
```
https://[ACCOUNT].app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_test_e2e_service&deploy=1
```

### Parámetros

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `docs` o `doc` | string/array | `12345678` | Documento(s) a consultar - Ver formatos abajo |
| `provider` | string | `equifax` | Provider a usar: `equifax` o `bcu` |
| `forceRefresh` | boolean | `false` | `true` para bypass cache y forzar consulta fresca |
| `parallel` | boolean | `true` | `true` para modo paralelo (más rápido) |
| `debug` | boolean | `true` | `true` para ver logs detallados en Execution Log |

### Formatos de Documentos

**Un solo documento**:
```
?docs=48123456
```

**Múltiples documentos (JSON array)**:
```
?docs=["41675108","54237287","54723915","51375882","52333281","33252929","42710744"]
```

**Múltiples documentos (CSV)**:
```
?docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744
```

### Ejemplos

**Test básico con un documento**:
```
?script=customscript_test_e2e_service&deploy=1&docs=48123456
```

**Test con múltiples documentos (JSON)**:
```
?script=customscript_test_e2e_service&deploy=1&docs=["41675108","54237287","54723915"]
```

**Test con múltiples documentos (CSV)**:
```
?script=customscript_test_e2e_service&deploy=1&docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744
```

**Test secuencial (sin paralelo)**:
```
?script=customscript_test_e2e_service&deploy=1&docs=41675108,54237287,54723915&parallel=false
```

**Forzar refresh en todos los documentos**:
```
?script=customscript_test_e2e_service&deploy=1&docs=41675108,54237287&forceRefresh=true
```

**Test completo con provider BCU**:
```
?script=customscript_test_e2e_service&deploy=1&docs=41675108,54237287&provider=bcu&forceRefresh=true
```

---

## 📊 Interpretación de Resultados

### 1. Multi-Document Test Summary
```
📊 Multi-Document Test Summary
Timestamp: 2025-10-01T10:30:45.123Z
Total Documents: 7
Provider: equifax
Parallel Mode: Yes

📊 Stats Grid:
┌─────────────┬────────────────┬──────────────┬─────────────┐
│ Total Time  │ Avg Time/Doc   │ Success Rate │ Good Scores │
│ 1,847ms     │ 264ms          │ 100%         │ 5           │
│ 1.85s       │ Min: 45ms      │ 7/7 success  │ Rejected: 2 │
│             │ Max: 567ms     │              │ Cached: 3   │
└─────────────┴────────────────┴──────────────┴─────────────┘
```

**Análisis**:
- ✅ **< 100ms avg**: Excelente (mayoría desde cache)
- ✅ **100-500ms avg**: Bueno (mix de cache y consultas frescas)
- ⚠️ **500-1000ms avg**: Aceptable (provider lento)
- ❌ **> 1000ms avg**: Revisar performance

### 2. Individual Results Table
```
# | Documento | Score | Status      | Time     | Cache | Details
--|-----------|-------|-------------|----------|-------|--------
1 | 41675108  | 542   | ✅ GOOD     | 245ms    | 📡 No | Ver detalles
2 | 54237287  | 387   | ⚠️ LOW      | 198ms    | 🚀 Yes| Ver detalles
3 | 54723915  | —     | REJECTED    | 156ms    | 🚀 Yes| Ver detalles
4 | 51375882  | 601   | ✅ GOOD     | 567ms    | 📡 No | Ver detalles
5 | 52333281  | 499   | ✅ GOOD     | 45ms     | 🚀 Yes| Ver detalles
6 | 33252929  | 445   | ⚠️ LOW      | 89ms     | 🚀 Yes| Ver detalles
7 | 42710744  | 523   | ✅ GOOD     | 134ms    | 📡 No | Ver detalles
```

**Interpretación**:
- **Score**: Valor entre 0-1000 (finalScore * 1000)
- **✅ GOOD**: Score ≥ 499 (configurable en threshold)
- **⚠️ LOW**: Score < 499
- **REJECTED**: Cliente rechazado por reglas (fallecido, calificación 5, etc.)
- **Time badges**:
  - 🟢 Verde (< 200ms): Excelente
  - 🟡 Amarillo (200-1000ms): Bueno
  - 🔴 Rojo (> 1000ms): Lento
- **Cache**: 
  - 🚀 Yes: Respuesta desde cache (muy rápido)
  - 📡 No: Consulta fresca al provider (más lento pero actualizado)

### 3. Test Summary (Documento Individual)
```
📊 Test Summary
Timestamp: 2025-10-01T10:30:45.123Z
Documento: 48123456
Provider: equifax
Total Time: 245ms
Status: ✅ SUCCESS
```

**Análisis para documento individual**:
- ✅ **< 100ms**: Excelente (cache hit o muy rápido)
- ✅ **100-500ms**: Bueno (incluye consulta a provider)
- ⚠️ **500-2000ms**: Aceptable (provider lento)
- ❌ **> 2000ms**: Revisar performance

### 2. Score Result
```
🎯 Score Result
542
Final Score: 0.5420
Status: ✅ GOOD (≥ 499)
Provider: equifax
From Cache: Yes 🚀
```

**Interpretación**:
- **Score**: Valor final entre 0-1000
- **GOOD**: Score ≥ 499 (umbral configurable)
- **REJECTED**: Si hay razón de rechazo (ver metadata.rejectionReason)
- **From Cache**: `Yes` = respuesta muy rápida, `No` = consulta fresca

### 3. Execution Steps

#### Step 1: Input Validation
```json
{
  "valid": true,
  "cleanDoc": "48123456",
  "length": 8
}
```
✅ Valida que el documento tenga formato correcto (7-8 dígitos).

#### Step 2: Call service.calculateScore()
```json
{
  "finalScore": 0.542,
  "score": 542,
  "metadata": {
    "provider": "equifax",
    "fromCache": true,
    "isRejected": false,
    "isGood": true,
    "goodThreshold": 499
  },
  "contributions": { ... },
  "flags": { ... }
}
```
✅ Resultado completo del servicio (el más importante).

#### Step 3: Validate Score Result
```json
{
  "hasFinalScore": true,
  "hasMetadata": true,
  "hasValidation": true,
  "scoreValue": 0.542,
  "scoreRounded": 542,
  "isGood": true
}
```
✅ Confirma estructura correcta del resultado.

#### Step 4: Analyze Metadata
```json
{
  "provider": "equifax",
  "calculatedAt": "2025-10-01T10:30:45.123Z",
  "fromCache": true,
  "isRejected": false,
  "rejectionReason": "N/A",
  "goodThreshold": 499,
  "isGood": true,
  "requestId": "req_abc123"
}
```
- **fromCache**: Si es `true`, el resultado vino de cache (muy rápido)
- **isRejected**: Si es `true`, ver `rejectionReason`
- **isGood**: Si el score supera el threshold

#### Step 5: Analyze Contributions
```json
{
  "totalContributions": 18,
  "hasVigente": true,
  "hasVencido": true,
  "hasCastigado": true,
  "contributionsList": [
    { "name": "vigente", "value": 0.15, "type": "number" },
    { "name": "vencido", "value": -0.08, "type": "number" }
  ]
}
```
- Muestra las primeras 10 contribuciones al score
- Cada contribución puede ser positiva (sube score) o negativa (baja score)

#### Step 6: Check Flags
```json
{
  "totalFlags": 2,
  "isDeceased": false,
  "hasRejectableRating": false,
  "allFlags": { ... }
}
```
- **isDeceased**: Si la persona está marcada como fallecida
- **hasRejectableRating**: Si tiene calificación que causa rechazo automático

---

## 🔍 Troubleshooting

### Error: "Score result is null"
**Causa**: `service.calculateScore()` devolvió `null` o `undefined`.

**Solución**:
1. Verificar que el provider (Equifax/BCU) esté configurado
2. Revisar Execution Log para errores del provider
3. Verificar credenciales y endpoint del provider
4. Probar con `forceRefresh=true` para bypass cache

### Error: "Missing finalScore in result"
**Causa**: El resultado no tiene estructura correcta.

**Solución**:
1. Verificar que `scoringRules.js` cargue correctamente
2. Confirmar que el custom record de scoring existe (ID=1)
3. Revisar que todos los campos binned estén presentes
4. Ver Execution Log para errores de `computeScore`

### Error: "Invalid documento: must be at least 7 digits"
**Causa**: Documento tiene menos de 7 dígitos.

**Solución**:
- Usar documento válido: `?doc=12345678` (7-8 dígitos)

### Warning: "Score was REJECTED"
**No es error**, es comportamiento esperado si el cliente cumple reglas de rechazo.

**Ver**:
- `rejectionReason` en metadata para saber por qué fue rechazado
- Ejemplos: `"Cliente fallecido"`, `"Calificación 5"`, etc.

### Performance: Total Time > 2000ms
**Causa**: Consulta al provider muy lenta.

**Solución**:
1. Verificar latencia de red al provider
2. Aumentar timeout en opciones (default 15s)
3. Revisar si el provider está caído o lento
4. Considerar usar cache más agresivamente

---

## 📈 Benchmarks Esperados

### Documento Individual

| Scenario | Expected Time | Status |
|----------|---------------|--------|
| **Cache Hit** (fromCache=true) | < 50ms | ✅ Excelente |
| **First Call** (cache miss) | 100-500ms | ✅ Bueno |
| **Provider Slow** | 500-2000ms | ⚠️ Aceptable |
| **Provider Timeout** | > 2000ms | ❌ Revisar |

### Múltiples Documentos (7 docs)

| Scenario | Total Time | Avg Time/Doc | Throughput | Status |
|----------|------------|--------------|------------|--------|
| **All Cached** | < 500ms | < 70ms | ~14 docs/s | ✅ Excelente |
| **Mix (some cached)** | 1-3s | 150-450ms | 2-7 docs/s | ✅ Bueno |
| **All Fresh** | 2-5s | 300-700ms | 1-3 docs/s | ✅ Aceptable |
| **Provider Slow** | > 5s | > 700ms | < 1 doc/s | ⚠️ Revisar |

### Desglose Típico (Primera Llamada - Individual)
- Validación entrada: **< 1ms**
- Load scoring rules (cache miss): **30-100ms**
- Fetch provider data: **100-400ms**
- Compute score: **< 1ms**
- Total: **130-500ms**

### Desglose Típico (Cache Hit - Individual)
- Validación entrada: **< 1ms**
- Load scoring rules (cached): **< 5ms**
- Fetch provider data (cached): **10-30ms**
- Compute score: **< 1ms**
- Total: **11-36ms**

### Desglose Típico (7 Documentos - Mix)
- Validación entrada: **< 7ms** (1ms × 7)
- Load scoring rules (cached): **< 5ms** (solo primera vez)
- Fetch provider data: **700-2800ms** (100-400ms × 7, algunos cacheados)
- Compute score: **< 7ms** (1ms × 7)
- **Total: 700-2820ms** (~1-3s)
- **Throughput: 2-10 docs/segundo**

### Performance Chart Example
```
41675108: ████████████████████ 245ms
54237287: ████████████████ 198ms
54723915: █████████████ 156ms
51375882: ██████████████████████████████ 567ms (slowest)
52333281: ████ 45ms (fastest)
33252929: ██████ 89ms
42710744: ███████████ 134ms

Avg: 264ms | Min: 45ms | Max: 567ms | Range: 522ms
```

---

## 🔐 Seguridad

- ⚠️ **Este script expone datos sensibles**: scores, documentos, metadata
- 🔒 **Recomendación**: Limitar audience a **Administrator** o roles específicos
- 🚫 **NO usar en producción** con audience=All Roles
- 📝 **Log Level**: Usar Debug solo en Sandbox/Testing, Debug en Production

---

## 📝 Execution Log

Para ver detalles completos:

1. Ir a: **System > Management > System Information > Execution Logs**
2. Filtrar por:
   - **Script**: `TEST E2E Service - BCU Score`
   - **Type**: Suitelet
   - **Date**: Today
3. Ver logs:
   - `E2E Test Started`: Inicio del test
   - `Executing Step`: Cada paso ejecutado
   - `Calling calculateScore`: Parámetros enviados al servicio
   - `Score Result`: Resultado completo del scoring
   - `E2E Test Completed`: Resumen final

---

## ✅ Criterios de Éxito

**Test considerado exitoso si**:
- ✅ Status: SUCCESS
- ✅ Total Time < 2000ms (primera llamada) o < 100ms (cache hit)
- ✅ Score Result tiene `finalScore` entre 0 y 1
- ✅ Metadata tiene `provider`, `calculatedAt`, `isRejected`
- ✅ Contributions tiene al menos 10 campos
- ✅ Todos los 6 steps completados sin errores

**Test con advertencias (pero válido)**:
- ⚠️ Score REJECTED (si el cliente cumple reglas de rechazo)
- ⚠️ Total Time 500-2000ms (provider lento pero dentro de timeout)
- ⚠️ fromCache=false (primera llamada, esperado)

**Test fallido si**:
- ❌ Status: FAILED
- ❌ Error: "Score result is null"
- ❌ Error: "Missing finalScore in result"
- ❌ Total Time > 15000ms (timeout)
- ❌ Algún step con error crítico

---

## 🔗 Próximos Pasos

Después de validar este test:

1. **Test de Performance** (scoringRules):
   - Ejecutar: `TEST_ScoringRulesPerformance_SL.js`
   - Validar: Load rules < 100ms, cache < 5ms

2. **Test de Integración**:
   - Crear Lead real en NetSuite
   - Llamar al servicio desde formulario
   - Verificar que el score se calcule correctamente

3. **Test de Producción**:
   - Configurar ambiente de producción
   - Ejecutar con documentos reales
   - Monitorear performance y errores

4. **Optimizaciones**:
   - Si Total Time > 500ms, revisar provider
   - Si cache no funciona, revisar TTL
   - Si hay errores, revisar logs detallados

---

## 📞 Soporte

Si encuentras problemas:

1. Revisar Execution Log para detalles
2. Verificar prerequisitos (custom record, campos, provider)
3. Probar con `debug=true` para ver más información
4. Probar con `forceRefresh=true` para bypass cache
5. Contactar al equipo de desarrollo con:
   - URL del test ejecutado
   - Documento usado
   - Screenshot del error
   - Execution Log ID

---

**Creado**: 2025-10-01  
**Versión**: 1.0.0  
**Autor**: BCU Score Team
