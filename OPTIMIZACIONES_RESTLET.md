# 🚀 Optimizaciones para Mejorar Velocidad del Restlet

## 📊 Análisis de Performance

### ⚠️ Problemas Actuales (en orden de impacto):

1. **🐌 CRÍTICO - Línea 42**: `deactivateLeadsByDocumentNumber()` 
   - Se ejecuta SIEMPRE, incluso para leads repetidos
   - Hace 2 searches + múltiples `submitFields`
   - **Impacto**: 500-2000ms por llamada

2. **🐌 ALTO - Línea 24**: `createLogRecord()` 
   - Se crea ANTES de validar documento
   - Desperdicia recursos en requests inválidos
   - **Impacto**: 100-300ms

3. **🐌 MEDIO - Línea 45**: `getInfoRepetido()`
   - Search complejo en toda la BD cada vez
   - **Impacto**: 200-800ms

4. **🐌 BAJO - Líneas 60-82**: Validaciones blacklist/mocasist
   - Se hacen DESPUÉS de crear preLead
   - Deberían ser lo primero
   - **Impacto**: 50-200ms

## ✅ Soluciones Propuestas

### **OPTIMIZACIÓN 1: Reordenar el flujo de validación**

```javascript
function post(body) {
  const params = getScriptParametersCached();
  const { docNumber, firstName, lastName, activityType, salary, dateOfBirth, workStartDate, source } = body || {};
  
  const response = { docNumber, success: false, result: 'Consulte nuevamente más tarde' };
  let idLog; // ⚡ Declarar pero no crear aún

  try {
    // ✅ PASO 1: Validación básica (0ms - local)
    if (isEmpty(docNumber) || !auxLib.validateCI(docNumber)) {
      idLog = auxLib.createLogRecord(docNumber, null, false, 1, source, body);
      response.result = 'Documento no válido';
      auxLib.updateLogWithResponse(idLog, response.result, false, response);
      return response;
    }

    // ✅ PASO 2: Blacklist/Mocasist PRIMERO (50-100ms - 2 searches simples)
    const blacklisted = auxLib.checkBlacklist(docNumber);
    const isMocasist = !blacklisted ? auxLib.checkMocasist(docNumber) : false;
    
    if (blacklisted || isMocasist) {
      idLog = auxLib.createLogRecord(docNumber, null, false, 1, source, body);
      response.result = blacklisted ? 'Blacklist' : 'Mocasist';
      // ... manejar rechazo y RETURN temprano
      return response; // ⚡ Exit rápido sin crear leads
    }

    // ✅ PASO 3: Crear log solo después de validaciones básicas
    idLog = auxLib.createLogRecord(docNumber, null, false, 1, source, body);

    // ✅ PASO 4: Calcular datos derivados
    const sourceId = auxLib.getProveedorId(source);
    const activity = auxLib.getActivityType(activityType);
    const age = auxLib.calculateYearsSinceDate(dateOfBirth);
    const yearsOfWork = workStartDate ? auxLib.calculateYearsSinceDate(workStartDate) : undefined;

    // ✅ PASO 5: Verificar info repetido (200-800ms)
    const infoRep = auxLib.getInfoRepetido(docNumber, null, false);
    const notLatente = infoRep?.approvalStatus !== params?.estadoLatente;

    // ✅ PASO 6: Deactivate SOLO si es necesario (500-2000ms - optimizado)
    // Solo deactivar si:
    // - NO es latente Y
    // - NO tiene info repetida reciente
    if (notLatente && !infoRep?.id) {
      auxLib.deactivateLeadsByDocumentNumber(docNumber);
    }

    // Resto del flujo...
  } catch (e) {
    // Error handling
  }
}
```

---

### **OPTIMIZACIÓN 2: Mejorar `deactivateLeadsByDocumentNumber`**

**Cambio en ELM_Aux_Lib.js - línea 1343:**

```javascript
// ❌ ANTES (muy lento - busca en TODO el historial):
['datecreated', 'before', 'lastmonthtodate'],

// ✅ OPCIÓN A - Solo últimos 7 días (más rápido):
['datecreated', 'within', 'daysago7'],

// ✅ OPCIÓN B - Solo mes actual (balance):
['datecreated', 'within', 'thismonth'],

// ✅ OPCIÓN C - Eliminar filtro de fecha pero agregar límite:
// Remover línea de datecreated y agregar al search:
// .run().getRange({ start: 0, end: 100 }) // Solo primeros 100
```

---

### **OPTIMIZACIÓN 3: Cache de parámetros de script**

Ya está implementado con `getScriptParametersCached()` ✅

---

### **OPTIMIZACIÓN 4: Usar submitFields en lugar de load/save**

**Ya implementado en la mayoría de lugares** ✅

---

### **OPTIMIZACIÓN 5: Agregar índices en campos customizados** (Nivel NetSuite Admin)

En NetSuite Admin:
1. `custentity_sdb_nrdocumento` → **Marcar como "Store Value"**
2. `custentity_elm_lead_repetido_original` → **Indexar**
3. `custentity_elm_aprobado` → **Indexar**

---

## 📈 Impacto Estimado

| Optimización | Tiempo Ahorrado | Dificultad |
|--------------|----------------|------------|
| **Reordenar validaciones** | 500-1500ms | 🟢 Fácil |
| **Optimizar deactivate** | 500-1800ms | 🟢 Fácil |
| **Crear log después** | 100-300ms | 🟢 Fácil |
| **Índices en BD** | 200-600ms | 🟡 Media (Admin) |
| **TOTAL ESTIMADO** | **1300-4200ms** | |

---

## 🎯 Implementación Recomendada (Orden de Prioridad)

### **FASE 1 - Cambios Rápidos (5-10 min):**
1. ✅ Mover validaciones de blacklist/mocasist al inicio
2. ✅ Crear log solo después de validaciones básicas
3. ✅ Condicionar `deactivateLeadsByDocumentNumber()` solo cuando sea necesario

### **FASE 2 - Optimización Media (10-15 min):**
4. ✅ Cambiar filtro de fecha en `deactivateLeadsByDocumentNumber` a `thismonth` o `daysago7`
5. ✅ Agregar límite `.getRange()` en los searches de deactivate

### **FASE 3 - Optimización Avanzada (Requiere Admin):**
6. 🔧 Agregar índices en campos customizados
7. 🔧 Considerar cache de `getInfoRepetido` con TTL de 1 minuto

---

## 🧪 Cómo Medir Mejora

Agregar al final del `post()`:

```javascript
finally {
  const duration = Date.now() - startTs;
  log.debug(`${LOG_PREFIX} Performance`, {
    docNumber,
    duration: duration + 'ms',
    result: response.result
  });
  
  auxLib.updateLogWithResponse(idLog, response.result, response.success, response);
}
```

---

## 📝 Código Completo Optimizado

Ver archivo adjunto: `rest1NewVersion_OPTIMIZED.js`

---

## ⚡ Quick Win - Implementar YA

El cambio MÁS RÁPIDO con MAYOR IMPACTO:

```javascript
// En línea ~45 del restlet, CAMBIAR:
// ❌ ANTES:
auxLib.deactivateLeadsByDocumentNumber(docNumber);
const infoRep = auxLib.getInfoRepetido(docNumber, null, false);

// ✅ DESPUÉS:
const infoRep = auxLib.getInfoRepetido(docNumber, null, false);
const notLatente = infoRep?.approvalStatus !== params?.estadoLatente;
if (notLatente && !infoRep?.id) {
  auxLib.deactivateLeadsByDocumentNumber(docNumber); // Solo si es necesario
}
```

**Ahorro estimado: 500-2000ms en ~70% de los requests** 🚀
