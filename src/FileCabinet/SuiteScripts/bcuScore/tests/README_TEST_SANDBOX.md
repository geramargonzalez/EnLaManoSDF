# Test de Performance: Scoring Rules en NetSuite Sandbox

Este script valida la optimización de `scoringRules.js` con `lookupFields` en tu entorno NetSuite Sandbox.

## 📋 Pre-requisitos

1. **NetSuite Sandbox** con acceso de Administrator
2. **Custom Record** `customrecord_sdb_score` creado con ID interno = 1
3. **Campos custom** en el record con los nombres exactos:
   - `custrecord_sdb_score_base_score` (Decimal Number)
   - `custrecord_sdb_score_rejection_rules` (Long Text - JSON)
   - `custrecord_sdb_banco_binned` (Decimal Number)
   - `custrecord_sdb_ent_t6_binned` (Decimal Number)
   - `custrecord_sdb_intercept` (Decimal Number)
   - ... (todos los campos binned WOE - ver scoringRules.js línea 120-138)

## 🚀 Pasos de Despliegue

### 1. Subir el script a NetSuite

**Opción A: File Cabinet manual**
1. Ve a `Documents > Files > File Cabinet`
2. Navega a: `SuiteScripts/bcuScore/tests/`
3. Sube `TEST_ScoringRulesPerformance_SL.js`

**Opción B: SDF Deploy (recomendado)**
```bash
# Desde el directorio raíz del proyecto
suitecloud file:upload -p src/FileCabinet/SuiteScripts/bcuScore/tests/TEST_ScoringRulesPerformance_SL.js
```

### 2. Crear el Script Record

1. Ve a `Customization > Scripting > Scripts > New`
2. Selecciona `TEST_ScoringRulesPerformance_SL.js` del File Cabinet
3. Configura:
   - **Name:** TEST Scoring Rules Performance
   - **ID:** `customscript_test_scoring_rules_perf`
   - **Script File:** `TEST_ScoringRulesPerformance_SL.js`
4. Guarda

### 3. Crear el Script Deployment

1. En el Script Record, ve a la pestaña **Deployments**
2. Click **New Deployment**
3. Configura:
   - **Title:** TEST Scoring Rules Performance - Public
   - **ID:** `customdeploy_test_scoring_rules_perf`
   - **Status:** Testing
   - **Audience:** All Roles (o específico)
   - **Execute as Role:** Administrator
4. Guarda y copia la **URL externa**

### 4. Ejecutar el Test

1. Abre la URL en tu navegador:
   ```
   https://[tu-account-id].app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_test_scoring_rules_perf&deploy=customdeploy_test_scoring_rules_perf
   ```

2. Verás una página HTML con los resultados:
   - ✅ Tests passed/failed
   - ⏱️ Tiempos de ejecución
   - 📊 Validaciones de estructura
   - 💡 Recomendaciones

### 5. Revisar Execution Logs

1. Ve a `System > System Information > System Notes`
2. Filtra por:
   - **Script:** TEST Scoring Rules Performance
   - **Date:** Hoy
3. Revisa los logs de Audit para detalles completos

## 📊 Tests Ejecutados

| # | Test | Descripción | Métrica |
|---|------|-------------|---------|
| 1 | getDefaultRules() | Reglas por defecto (sin I/O) | < 5ms |
| 2 | First Load | Primera carga desde NetSuite | < 100ms ⭐ |
| 3 | Cached Load | Segunda carga (cache hit) | < 5ms |
| 4 | Invalidate & Reload | Recarga después de invalidar | < 100ms |
| 5 | Validate Structure | Validación de estructura completa | Pass/Fail |

**⭐ Test 2 es el más importante:** Mide la latencia real de `lookupFields` en producción.

## ✅ Criterios de Éxito

- **First Load (Test 2):** < 100ms
  - Excelente: < 50ms
  - Bueno: 50-100ms
  - Mejorable: 100-200ms
  - Lento: > 200ms

- **Cached Load (Test 3):** < 5ms
  - Si es > 10ms, el cache no está funcionando

- **Structure Validation (Test 5):** PASS
  - Debe tener 18 coeficientes binned
  - Todos los campos críticos presentes

## 🔍 Troubleshooting

### Error: "Type error: Cannot call method 'lookupFields'"
**Causa:** El custom record no existe o no tiene ID = 1  
**Solución:**
1. Ve a `Customization > Lists, Records & Fields > Record Types`
2. Busca `customrecord_sdb_score`
3. Verifica que existe un registro con Internal ID = 1
4. O ajusta `scoreNetsuiteID` en `scoringRules.js` línea 69

### Error: "Field not found: custrecord_sdb_banco_binned"
**Causa:** Faltan campos custom en el record  
**Solución:**
1. Ve al Custom Record Type `customrecord_sdb_score`
2. Crea los campos faltantes (ver lista en Pre-requisitos)
3. Asegúrate de que los IDs de campo coincidan exactamente

### Test 2 tarda > 200ms
**Causa:** Posibles cuellos de botella  
**Solución:**
1. Verifica que `lookupFields` se está usando (no `search.create`)
2. Revisa Execution Log para ver llamadas a APIs
3. Considera usar un record más pequeño si tienes muchos campos

### Cache no funciona (Test 3 > 10ms)
**Causa:** Cache invalidado entre tests  
**Solución:**
1. Verifica que `_cachedRules` no se está limpiando
2. Revisa que `CACHE_DURATION_MS` no sea muy corto
3. Ejecuta los tests en secuencia rápida

## 📈 Benchmarks Esperados

Basado en tests locales:

| Operación | Local (Node) | NetSuite Sandbox | NetSuite Production |
|-----------|-------------|------------------|---------------------|
| lookupFields | ~0.05ms | ~30-80ms | ~20-50ms |
| Cache hit | ~0.01ms | ~1-5ms | ~0.5-2ms |

**Nota:** NetSuite Production suele ser más rápido que Sandbox.

## 🎯 Próximos Pasos

Si todos los tests pasan:
1. ✅ La optimización con `lookupFields` funciona
2. ✅ El cache es efectivo
3. ✅ Listo para usar en producción

Si algún test falla:
1. Revisa los logs detallados
2. Verifica la estructura del custom record
3. Ajusta campos faltantes o IDs incorrectos
4. Re-ejecuta el test

## 📝 Notas

- **No ejecutar en producción sin probar en Sandbox primero**
- Este script NO modifica datos, solo lee
- Puedes ejecutarlo múltiples veces sin problema
- Los resultados se muestran en la página y en Execution Log

## 🔗 Archivos Relacionados

- `scoringRules.js` - Módulo optimizado con lookupFields
- `test_scoring_rules.js` - Test local en Node (para desarrollo)
- `perf_test.js` - Benchmark de performance local

## 📞 Soporte

Si encuentras problemas:
1. Revisa Execution Log completo
2. Verifica pre-requisitos
3. Compara con resultados de test local en Node
