# 📊 Análisis de Score - Herramienta de Consulta

## 🎯 Nueva Funcionalidad

Se ha agregado una **sección completa de análisis de score** que convierte el test E2E en una **herramienta de consulta** para analizar en detalle qué variables impactan cada score.

---

## 🔍 ¿Qué Muestra?

### 1. **Variables Clave del Score** (Tabla Principal)

Una tabla completa con las 12 variables más importantes:

```
┌─────────────────────────┬──────────────┬──────────────┬──────────────┐
│ Variable                │ Valor Raw    │ Contribución │ Impacto      │
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Créditos Vigentes       │ $250,000     │ +0.1523      │ ████████ 📈  │
│ vigente                 │              │              │ Sube el score│
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Créditos Vencidos       │ $15,000      │ -0.0823      │ ████ 📉      │
│ vencido                 │              │              │ Baja el score│
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Créditos Castigados     │ $0           │ +0.0500      │ ██ 📈        │
│ castigado               │              │              │ Sube el score│
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Rating (Calificación)   │ 1            │ +0.2100      │ ██████████ 📈│
│ rating                  │              │              │ Sube el score│
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Atraso Máximo (días)    │ 30           │ -0.0450      │ ██ 📉        │
│ atraso_max              │              │              │ Baja el score│
├─────────────────────────┼──────────────┼──────────────┼──────────────┤
│ Cantidad Entidades      │ 3            │ +0.0320      │ █ 📈         │
│ cantidad_entidades      │              │              │ Sube el score│
└─────────────────────────┴──────────────┴──────────────┴──────────────┘
```

**Columnas:**
- **Variable**: Nombre descriptivo + código técnico
- **Valor Raw**: Valor original de los datos (formato currency o número)
- **Contribución**: Valor WOE que suma/resta al score final
- **Impacto**: Barra visual coloreada (verde sube, rojo baja) + indicador

---

### 2. **Top 5 Variables que SUBEN el Score** 📈

Ranking de las contribuciones positivas más grandes:

```
📈 Top Variables que SUBEN el Score

┌────┬────────────────────┬──────────────┬─────────────────────┐
│ #  │ Variable           │ Contribución │ Impacto Visual      │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 1  │ rating             │ +0.2100      │ ██████████████████  │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 2  │ vigente            │ +0.1523      │ ████████████████    │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 3  │ banco              │ +0.0980      │ ████████████        │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 4  │ linea_credito      │ +0.0750      │ ██████████          │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 5  │ castigado          │ +0.0500      │ ████████            │
└────┴────────────────────┴──────────────┴─────────────────────┘
```

**Interpretación:**
- Estas variables están **ayudando** al score
- Las barras verdes son proporcionales al impacto positivo
- El cliente tiene buenos valores en estas variables

---

### 3. **Top 5 Variables que BAJAN el Score** 📉

Ranking de las contribuciones negativas más grandes:

```
📉 Top Variables que BAJAN el Score

┌────┬────────────────────┬──────────────┬─────────────────────┐
│ #  │ Variable           │ Contribución │ Impacto Visual      │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 1  │ vencido            │ -0.0823      │ ████████████        │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 2  │ atraso_max         │ -0.0450      │ ████████            │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 3  │ consultas          │ -0.0320      │ ██████              │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 4  │ ent_t6             │ -0.0210      │ ████                │
├────┼────────────────────┼──────────────┼─────────────────────┤
│ 5  │ nuevos             │ -0.0150      │ ███                 │
└────┴────────────────────┴──────────────┴─────────────────────┘
```

**Interpretación:**
- Estas variables están **perjudicando** al score
- Las barras rojas son proporcionales al impacto negativo
- El cliente tiene valores problemáticos en estas variables

---

### 4. **Validaciones y Advertencias** ⚠️

Si hay issues detectados durante el scoring:

```
⚠️ Validaciones y Advertencias

• Atraso máximo de 30 días detectado
• Créditos vencidos superiores al 5% del total
• Consultas recientes: 8 en los últimos 3 meses (alto)
```

---

### 5. **Calidad de Datos** ✅

Indicador de completitud de los datos:

```
✅ Calidad de Datos

Completitud: 92% (11/12 variables presentes)
Fuente de Datos: equifax
Fecha de Consulta: 2025-10-01T14:23:45.123Z
```

**Interpretación:**
- **100%**: Todos los datos presentes (ideal)
- **80-99%**: Buena calidad, algunas variables faltantes
- **< 80%**: Calidad baja, muchos datos faltantes

---

## 📋 Variables Incluidas

### 12 Variables Clave (por orden de importancia)

| # | Variable | Código | Tipo | Descripción |
|---|----------|--------|------|-------------|
| 1 | **Créditos Vigentes** | `vigente` | Currency | Monto total de créditos al día |
| 2 | **Créditos Vencidos** | `vencido` | Currency | Monto total de créditos vencidos |
| 3 | **Créditos Castigados** | `castigado` | Currency | Monto total de créditos castigados |
| 4 | **Rating** | `rating` | Number | Calificación crediticia (1-5) |
| 5 | **Atraso Máximo** | `atraso_max` | Number | Días de atraso máximo |
| 6 | **Cantidad Entidades** | `cantidad_entidades` | Number | Cantidad de instituciones |
| 7 | **Deuda Bancaria** | `banco` | Currency | Deuda con bancos |
| 8 | **Entidades Tipo 6** | `ent_t6` | Number | Cantidad de entidades tipo 6 |
| 9 | **Línea de Crédito** | `linea_credito` | Currency | Línea de crédito disponible |
| 10 | **Consultas** | `consultas` | Number | Consultas crediticias recientes |
| 11 | **Monto Operación** | `monto_operacion` | Currency | Monto de la operación actual |
| 12 | **Créditos Nuevos** | `nuevos` | Currency | Créditos nuevos en últimos 6 meses |

---

## 🎯 Casos de Uso

### Caso 1: Entender Por Qué un Cliente Tiene Score Bajo

**Problema:** Cliente con score 387 (< 499), ¿por qué?

**Solución:**
1. Ejecutar test con el documento del cliente
2. Ver sección "📉 Top Variables que BAJAN el Score"
3. Identificar:
   - `vencido: -0.0823` → Tiene $15,000 vencidos
   - `atraso_max: -0.0450` → Atraso de 30 días
   - `consultas: -0.0320` → 8 consultas recientes (alto)

**Acción:** Cliente necesita pagar deudas vencidas y evitar nuevas consultas.

---

### Caso 2: Validar Por Qué un Cliente Fue Rechazado

**Problema:** Cliente rechazado, ¿cuál fue el trigger?

**Solución:**
1. Ejecutar test con el documento
2. Ver Score Box: "❌ REJECTED - Reason: Cliente fallecido"
3. Ver Validaciones: Confirma que flag `isDeceased = true`

**Acción:** Cliente está marcado como fallecido en BCU, verificar identidad.

---

### Caso 3: Comparar Dos Clientes con Scores Similares

**Problema:** Cliente A (score 542) vs Cliente B (score 538), ¿diferencia?

**Solución:**
1. Ejecutar test con ambos documentos (CSV): `?docs=A,B`
2. Ver "Ver detalles" de cada uno
3. Comparar "Variables Clave":
   - Cliente A: `rating: 1` (+0.2100)
   - Cliente B: `rating: 2` (+0.1500)
   - **Diferencia:** Rating 1 vs 2 explica los 4 puntos

**Acción:** Ambos clientes son buenos, pero A tiene mejor rating.

---

### Caso 4: Identificar Qué Mejorar para Subir Score

**Problema:** Cliente con score 475 (borderline), ¿cómo llegar a 499?

**Solución:**
1. Ejecutar test con documento
2. Ver "📉 Top Variables que BAJAN el Score":
   - `vencido: -0.0823` → $15,000 vencidos
   - `atraso_max: -0.0450` → 30 días de atraso
3. **Cálculo:** Si paga vencidos y normaliza atrasos, gana ~0.13 (130 puntos)
4. Nuevo score estimado: 475 + 130 = 605 ✅

**Acción:** Cliente debe pagar $15,000 vencidos para subir score.

---

### Caso 5: Auditar Calidad de Datos del Provider

**Problema:** ¿Los datos del provider están completos?

**Solución:**
1. Ejecutar test con varios documentos
2. Ver sección "✅ Calidad de Datos"
3. Comparar completitud:
   - Cliente A: 100% (12/12)
   - Cliente B: 83% (10/12) - faltan `linea_credito` y `nuevos`
   - Cliente C: 67% (8/12) - faltan 4 variables

**Acción:** Si completitud < 80%, contactar provider o verificar documento.

---

## 🎨 Formato Visual

### Colores de Contribución

**Verde** (#28a745): Contribución positiva (> 0.05)
- Variable ayuda a subir el score
- Barra verde proporcional al impacto

**Rojo** (#dc3545): Contribución negativa (< -0.05)
- Variable baja el score
- Barra roja proporcional al impacto

**Gris** (#6c757d): Contribución neutral (-0.05 a 0.05)
- Variable no impacta significativamente
- Sin barra visual

---

### Barras de Impacto

El ancho de las barras es proporcional al valor absoluto de la contribución:

```
Fórmula: width = Math.min(|contribución| × 500, 100)%

Ejemplos:
- contribución = 0.2000 → 100% width (máximo)
- contribución = 0.1000 → 50% width
- contribución = 0.0500 → 25% width
- contribución = 0.0250 → 12.5% width
```

---

## 📊 Ejemplo Real de Análisis

### Cliente: 41675108

**Score:** 542 (GOOD ✅)

**Variables Clave:**
```
┌─────────────────────────┬──────────────┬──────────────┬──────────────┐
│ Créditos Vigentes       │ $350,000     │ +0.1850      │ █████████ 📈 │
│ Rating                  │ 1            │ +0.2100      │ ██████████ 📈│
│ Créditos Vencidos       │ $5,000       │ -0.0320      │ █ 📉         │
│ Atraso Máximo           │ 15           │ -0.0150      │ ▌ 📉         │
│ Deuda Bancaria          │ $180,000     │ +0.0980      │ ████ 📈      │
│ Línea de Crédito        │ $500,000     │ +0.0750      │ ███ 📈       │
└─────────────────────────┴──────────────┴──────────────┴──────────────┘
```

**Top Positivas:**
1. `rating: +0.2100` (rating 1 = excelente)
2. `vigente: +0.1850` ($350k créditos vigentes)
3. `banco: +0.0980` ($180k deuda bancaria manejable)

**Top Negativas:**
1. `vencido: -0.0320` ($5k vencidos, monto bajo)
2. `atraso_max: -0.0150` (15 días atraso, aceptable)

**Calidad:** 100% (12/12 variables)

**Conclusión:** Cliente excelente, solo tiene $5k vencidos que son manejables.

---

### Cliente: 54723915

**Score:** REJECTED ❌
**Reason:** Cliente fallecido

**No se muestran variables** porque el rechazo es automático antes del cálculo.

**Acción:** Verificar identidad del cliente.

---

## 🚀 Ventajas de Esta Herramienta

### 1. **Transparencia Total**
- Ver exactamente qué variables impactan el score
- Entender por qué un cliente tiene X score
- No es una "caja negra"

### 2. **Diagnóstico Rápido**
- Identificar variables problemáticas en segundos
- Ver top 5 positivas y negativas al instante
- Calidad de datos visible

### 3. **Consulta de Clientes**
- Ejecutar con documento del cliente → ver análisis completo
- Sin necesidad de base de datos o queries complejas
- Respuesta en < 500ms (con cache)

### 4. **Herramienta de Negocio**
- Call center puede consultar scores
- Vendedoras pueden ver por qué un cliente no califica
- Gerencia puede auditar decisiones de crédito

### 5. **Training y Documentación**
- Enseñar a nuevos empleados cómo funciona el scoring
- Mostrar ejemplos reales de buenos/malos clientes
- Documentar casos edge

---

## 🔧 Configuración

### Variables Incluidas

Puedes agregar más variables editando el array `importantVars` en la función `generateScoreAnalysis`:

```javascript
var importantVars = [
    { key: 'vigente', label: 'Créditos Vigentes', format: 'currency' },
    { key: 'nueva_variable', label: 'Mi Variable', format: 'number' },
    // ... más variables
];
```

**Formatos soportados:**
- `currency`: Moneda con símbolo $ y separador de miles
- `number`: Número con separador de miles
- Otros: String directo

---

## 📝 Próximos Pasos

### Mejoras Opcionales:

1. **Export a Excel**
   - Botón para descargar análisis como CSV/Excel
   - Útil para documentación o reportes

2. **Comparación Visual**
   - Si tienes múltiples docs, mostrar tabla comparativa
   - Highlight diferencias clave

3. **Histórico de Consultas**
   - Guardar últimas 10 consultas por usuario
   - Ver evolución del score del cliente

4. **Alertas Automáticas**
   - Si `vencido > X`, mostrar alerta roja
   - Si `rating = 5`, highlight en amarillo

5. **Recomendaciones Automáticas**
   - "Para subir score, pague $X vencidos"
   - "Evite nuevas consultas por 3 meses"

---

## ✅ Acceso Rápido

**URL para consultar un cliente:**
```
?script=customscript_test_e2e_service&deploy=1&docs=41675108
```

**Desde formulario:**
1. Abre URL base (sin params)
2. Ingresa documento en textarea
3. Click "Ejecutar Test"
4. Scroll hasta "📊 Análisis de Score - Variables Importantes"

---

**Creado:** 2025-10-01  
**Feature:** Score Analysis Tool  
**Versión:** 3.0
