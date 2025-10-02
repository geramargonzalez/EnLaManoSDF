# 🎨 Guía Visual: Formulario Dinámico de Test E2E

## 🚀 Nueva Funcionalidad

Se ha agregado un **formulario interactivo** al test E2E para que puedas configurar y ejecutar tests dinámicamente sin necesidad de construir URLs manualmente.

---

## 📋 3 Modos de Operación

### Modo 1: Formulario Interactivo (GET sin parámetros) ⭐ NUEVO
**URL:** `https://[account].app.netsuite.com/app/site/hosting/scriptlet.nl?script=customscript_test_e2e_service&deploy=1`

**¿Qué ves?**
```
┌─────────────────────────────────────────────────────────────┐
│  TEST END-TO-END: BCU Score Service (Multiple Documents)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📝 Configurar Test                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Completa los campos abajo y haz click en           │   │
│  │ "Ejecutar Test" para probar el servicio.           │   │
│  │                                                     │   │
│  │ Formatos soportados:                               │   │
│  │ • Un documento: 48123456                           │   │
│  │ • Múltiples (CSV): 41675108,54237287,54723915      │   │
│  │ • Múltiples (JSON): ["41675108","54237287"]        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Documentos * [Campo de texto multilínea]                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 41675108,54237287,54723915,51375882,52333281,       │  │
│  │ 33252929,42710744                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  💡 Ingresa uno o más documentos separados por comas       │
│                                                             │
│  Provider * [Dropdown]                                     │
│  [Equifax ▼]                                               │
│  💡 Selecciona el proveedor de datos                       │
│                                                             │
│  ☐ Force Refresh                                           │
│  💡 Marcar para forzar consulta fresca (bypass cache)      │
│                                                             │
│  ☑ Debug Mode                                              │
│  💡 Marcar para ver logs detallados                        │
│                                                             │
│  [🚀 Ejecutar Test]  [Limpiar]                            │
│                                                             │
│  ⚡ Quick Links                                            │
│  • Test con 1 documento                                    │
│  • Test con 3 documentos                                   │
│  • Test con 7 documentos (completo)                        │
│  • Test con force refresh                                  │
└─────────────────────────────────────────────────────────────┘
```

**Acciones:**
1. ✏️ Edita los documentos en el textarea
2. 🔽 Selecciona el provider (Equifax/BCU)
3. ☑️ Marca/desmarca opciones (Force Refresh, Debug)
4. 🚀 Click en "Ejecutar Test"
5. → Te lleva a los resultados

---

### Modo 2: Ejecución Directa por URL (GET con parámetros)
**URL:** `?script=xxx&deploy=1&docs=41675108,54237287,54723915`

**¿Qué ves?**
Directamente los **resultados del test** (stats grid + tabla + gráfico).

**Ventaja:** Copiar/pegar URLs para tests repetibles.

---

### Modo 3: Submit del Formulario (POST)
**Después de hacer click en "Ejecutar Test" desde el formulario.**

**¿Qué ves?**
Los **resultados del test** con dos botones arriba:
- `⬅️ Volver al Formulario`: Regresa al form con valores por default
- `🔄 Re-ejecutar Test`: Vuelve a ejecutar con los mismos parámetros

---

## 🎨 Interfaz del Formulario

### 📝 Campo: Documentos (Textarea)
```
┌──────────────────────────────────────────────────────┐
│ 41675108,54237287,54723915,51375882,52333281,       │
│ 33252929,42710744                                    │
│                                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
💡 Ingresa uno o más documentos separados por comas.
   Ejemplo: 41675108,54237287,54723915
```

**Características:**
- ✅ Campo multilínea (puedes usar Enter para separar)
- ✅ Mandatory (obligatorio)
- ✅ Acepta 3 formatos:
  - CSV: `41675108,54237287,54723915`
  - JSON: `["41675108","54237287","54723915"]`
  - Single: `48123456`
- ✅ Help text con ejemplo

---

### 🔽 Campo: Provider (Select)
```
Provider *
[Equifax          ▼]

Opciones:
- Equifax
- BCU
```

**Características:**
- ✅ Dropdown con 2 opciones
- ✅ Default: Equifax
- ✅ Help text explicativo

---

### ☑️ Campo: Force Refresh (Checkbox)
```
☐ Force Refresh
💡 Marcar para forzar consulta fresca (bypass cache)
```

**Comportamiento:**
- Desmarcado (default): Usa cache si está disponible
- Marcado: Bypass cache, consulta fresca al provider

---

### ☑️ Campo: Debug Mode (Checkbox)
```
☑ Debug Mode
💡 Marcar para ver logs detallados en Execution Log
```

**Comportamiento:**
- Marcado (default): Logs detallados en Execution Log
- Desmarcado: Solo logs esenciales

---

### 🚀 Botones

**Ejecutar Test** (Submit):
- Color: Azul
- Acción: Ejecuta el test con los valores del form
- POST al mismo Suitelet

**Limpiar** (Reset):
- Color: Gris
- Acción: Resetea el formulario a valores default

---

### ⚡ Quick Links (Enlaces Rápidos)

Al final del formulario, links para ejecución directa:

```
⚡ Quick Links

También puedes ejecutar el test directamente con URL:

• Test con 1 documento
  → ?docs=48123456

• Test con 3 documentos
  → ?docs=41675108,54237287,54723915

• Test con 7 documentos (completo)
  → ?docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744

• Test con force refresh
  → ?docs=48123456&forceRefresh=true
```

**Ventaja:** Copiar estos links para bookmarks o documentación.

---

## 🎯 Flujo de Uso Típico

### Escenario 1: Primera Vez (Usuario Nuevo)
```
1. Usuario abre URL base (sin parámetros)
   → Ve el formulario

2. Usuario ingresa: 48123456,54237287,54723915

3. Usuario selecciona Provider: Equifax

4. Usuario marca Force Refresh: ☑

5. Usuario click: "Ejecutar Test"
   → Ve resultados (stats grid, tabla, gráfico)

6. Usuario click: "Volver al Formulario"
   → Vuelve al form para nuevo test
```

---

### Escenario 2: Usuario con URL (Avanzado)
```
1. Usuario tiene URL guardada:
   ?docs=41675108,54237287&provider=equifax

2. Usuario abre URL
   → Ve resultados directamente (sin ver form)

3. Usuario click: "Re-ejecutar Test"
   → Re-ejecuta con mismos parámetros
   → Útil para ver diferencia con cache

4. Usuario click: "Volver al Formulario"
   → Ve form pre-poblado con esos documentos
```

---

### Escenario 3: Test de Regresión
```
1. Guarda URL con tus 7 docs de test:
   ?docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744

2. Ejecuta cada vez que hagas cambios al código

3. Compara benchmarks:
   - Total Time
   - Avg Time
   - Success Rate
   - Cache Hit Rate

4. Si los números cambian mucho → investigar
```

---

## 📊 Página de Resultados (Después de Submit)

```
┌─────────────────────────────────────────────────────────────┐
│  TEST END-TO-END: BCU Score Service (Multiple Documents)   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [⬅️ Volver al Formulario]  [🔄 Re-ejecutar Test]         │
│                                                             │
│  📋 Test Parameters                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Documentos: 41675108, 54237287, 54723915 (3 total) │   │
│  │ Provider: equifax                                   │   │
│  │ Force Refresh: Yes                                  │   │
│  │ Debug Mode: Yes                                     │   │
│  │ Method: POST                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📊 Multi-Document Test Summary                            │
│  ┌─────────────┬────────────────┬──────────────┬────────┐ │
│  │ Total Time  │ Avg Time/Doc   │ Success Rate │ Good   │ │
│  │ 687ms       │ 229ms          │ 100%         │ 2      │ │
│  └─────────────┴────────────────┴──────────────┴────────┘ │
│                                                             │
│  📋 Individual Results                                     │
│  [Tabla con los 3 documentos...]                          │
│                                                             │
│  📈 Performance Chart                                      │
│  [Gráfico de barras...]                                   │
│                                                             │
│  💡 Performance Analysis                                   │
│  [Análisis automático...]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Botones en la parte superior:**

1. **⬅️ Volver al Formulario**
   - Regresa al formulario con valores default
   - Para hacer un nuevo test diferente

2. **🔄 Re-ejecutar Test**
   - Vuelve a ejecutar con los mismos parámetros
   - Útil para:
     - Ver diferencia de performance con cache
     - Validar que el resultado es consistente
     - Comparar tiempo de primera ejecución vs segunda

---

## 🔄 Backward Compatibility

✅ **Todas las URLs anteriores siguen funcionando:**

```
# URL antigua (sigue funcionando):
?script=xxx&deploy=1&doc=48123456
→ Va directo a resultados (no muestra form)

# URL con múltiples docs:
?script=xxx&deploy=1&docs=41675108,54237287,54723915
→ Va directo a resultados

# URL sin parámetros (NUEVO):
?script=xxx&deploy=1
→ Muestra formulario interactivo
```

---

## ✨ Ventajas del Formulario

### 1. **Más Fácil para Usuarios No Técnicos**
- No necesitan construir URLs manualmente
- Interfaz visual clara con labels y help text
- Validation de campos mandatory

### 2. **Más Rápido para Tests Ad-Hoc**
- Editar documentos directamente en textarea
- Cambiar provider con dropdown
- Toggle checkboxes

### 3. **Quick Links para Tests Comunes**
- Links pre-configurados para casos típicos
- Copiar/pegar para bookmarks
- Documentación de ejemplos

### 4. **Botón Re-ejecutar**
- Comparar performance con/sin cache
- Validar consistencia de resultados
- No necesitas recargar o editar URL

### 5. **Mantiene URL Pattern**
- URLs siguen siendo legibles
- Se pueden compartir
- Se pueden guardar en bookmarks/documentación

---

## 📝 Valores por Default

| Campo | Default | Editable | Fuente |
|-------|---------|----------|--------|
| **Documentos** | `41675108,54237287,...` (7 docs) | ✅ Sí | Textarea |
| **Provider** | `equifax` | ✅ Sí | Dropdown |
| **Force Refresh** | `false` (desmarcado) | ✅ Sí | Checkbox |
| **Debug Mode** | `true` (marcado) | ✅ Sí | Checkbox |
| **Parallel** | `true` | ❌ No (fijo) | — |

**Nota:** Si vienes de una URL con parámetros (ej: `?docs=123`), el formulario se pre-pobla con esos valores.

---

## 🎯 Ejemplos de Uso

### Ejemplo 1: Test Rápido con 1 Documento
```
1. Abre formulario (URL base)
2. Borra el textarea
3. Escribe: 48123456
4. Click "Ejecutar Test"
```

### Ejemplo 2: Test con BCU Provider
```
1. Abre formulario
2. Mantén documentos default (7 docs)
3. Cambia dropdown a: BCU
4. Click "Ejecutar Test"
```

### Ejemplo 3: Test Force Refresh (Sin Cache)
```
1. Abre formulario
2. Mantén documentos default
3. Marca checkbox: Force Refresh
4. Click "Ejecutar Test"
5. Compara tiempo con test anterior (sin force refresh)
```

### Ejemplo 4: Test con JSON Array
```
1. Abre formulario
2. En textarea, escribe:
   ["41675108","54237287","54723915"]
3. Click "Ejecutar Test"
4. El parser detecta JSON y lo convierte
```

---

## 🚀 Próximos Pasos

### Inmediato:
1. ✅ Re-desplegar `TEST_E2E_Service_SL.js` actualizado
2. ✅ Abrir URL base (sin parámetros) para ver formulario
3. ✅ Probar flujo completo:
   - Editar documentos → Submit → Ver resultados
   - Click "Volver" → Editar → Submit de nuevo
   - Click "Re-ejecutar" → Ver diferencia con cache

### Testing:
1. 🧪 Probar con 1 documento
2. 🧪 Probar con 7 documentos (default)
3. 🧪 Probar con JSON array
4. 🧪 Probar con Force Refresh
5. 🧪 Probar Quick Links
6. 🧪 Validar que URLs antiguas siguen funcionando

### Mejoras Futuras (Opcionales):
1. 💡 Agregar campo "Parallel" como checkbox (si lo necesitas)
2. 💡 Guardar últimos valores en local storage (browser)
3. 💡 Exportar resultados como CSV/JSON
4. 💡 Historial de tests ejecutados en la sesión

---

**Creado:** 2025-10-01  
**Feature:** Formulario Interactivo de Test E2E  
**Versión:** 2.1
