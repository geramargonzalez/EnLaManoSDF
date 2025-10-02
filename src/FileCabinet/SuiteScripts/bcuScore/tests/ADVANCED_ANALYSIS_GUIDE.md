# 🔬 Guía de Análisis Avanzados - BCU Score Testing Tool

## 📊 Análisis Implementados

### 1. **Distribución de Scores** 📊

#### ¿Qué muestra?
Agrupa los scores válidos (no rechazados) en 6 rangos y muestra la distribución mediante:
- Gráfico de barras horizontales con colores por rango
- Porcentaje de documentos en cada rango
- Estadísticas agregadas: promedio, min, max, mediana, percentiles (P25, P75)

#### Rangos definidos:
```
🔴 Muy Bajo (0-199):     Clientes de muy alto riesgo
🟠 Bajo (200-399):       Alto riesgo, probablemente no califican
🟡 Aceptable (400-499):  Riesgo medio-alto, puede ser rechazado
🟢 Bueno (500-599):      Riesgo medio, probablemente califica
🟢 Muy Bueno (600-699):  Bajo riesgo, muy buen cliente
🔵 Excelente (700+):     Mínimo riesgo, cliente premium
```

#### Casos de uso:
1. **Ajuste de umbrales**: Ver dónde se concentran los scores para ajustar el umbral de aprobación (ej: si muchos están en 480-499, quizás bajar el umbral a 480).
2. **Segmentación de productos**: Asignar productos según rangos (ej: producto A para 500-599, producto B para 600+).
3. **Detección de anomalías**: Si todos los scores están en un solo rango, puede indicar un problema.
4. **QA de reglas**: Validar que el modelo genera distribución razonable (no todos en un extremo).

#### Ejemplo de salida:
```
📊 Distribución de Scores

Muy Bajo (0-199)     ███░░░░░░░ 2 (29%)
Bajo (200-399)       █████░░░░░ 3 (43%)
Aceptable (400-499)  ███░░░░░░░ 2 (29%)
Bueno (500-599)      ░░░░░░░░░░ 0 (0%)
Muy Bueno (600-699)  ░░░░░░░░░░ 0 (0%)
Excelente (700+)     ░░░░░░░░░░ 0 (0%)

📈 Estadísticas de Score
• Promedio: 327 puntos
• Mínimo: 145 puntos
• Máximo: 485 puntos
• Mediana: 320 puntos
• Rango: 340 puntos
• P25: 180 | P75: 450
```

#### Interpretación:
- **Distribución concentrada en bajo**: Puede indicar que las reglas son demasiado estrictas o que los clientes de prueba son de alto riesgo.
- **Distribución normal (campana)**: Ideal, el modelo discrimina bien entre buenos y malos clientes.
- **Distribución bimodal (dos picos)**: Puede indicar dos poblaciones distintas (ej: clientes nuevos vs antiguos).
- **Todos en un extremo**: Problema con las reglas o los datos.

---

### 2. **Análisis de Rechazos** 🚫

#### ¿Qué muestra?
Analiza en detalle todos los documentos rechazados:
- Tabla de motivos de rechazo con frecuencia y porcentaje
- Alerta visual si la tasa de rechazo > 50%
- Recomendaciones específicas por motivo
- Pie chart de distribución de motivos (si hay múltiples)

#### Motivos de rechazo comunes:

| Motivo | Descripción | Acción Recomendada |
|--------|-------------|-------------------|
| **SERVICE_ERROR** | Error técnico (timeout, conexión, bug) | Revisar logs de ejecución, verificar conectividad con provider |
| **INVALID_DATA** | Datos del provider inválidos/incompletos | Verificar que el documento existe en el sistema del provider |
| **MISSING_REQUIRED_FIELDS** | Faltan campos obligatorios | Revisar configuración de reglas, campos requeridos |
| **SCORE_TOO_LOW** | Score < umbral mínimo (ej: 499) | Analizar variables que bajan el score, considerar ajustar umbral |
| **BUSINESS_RULE_VIOLATION** | Violación de regla específica | Revisar reglas activas (ej: atraso_max > 90 días) |
| **DATA_QUALITY_LOW** | Calidad de datos insuficiente | Mejorar completitud de datos del provider |
| **BLACKLIST** | Cliente en lista negra | Verificar listas de bloqueo, validar si es correcto |
| **FRAUDULENT_PATTERN** | Patrón de fraude detectado | Revisar reglas antifraude, validar falsos positivos |

#### Casos de uso:
1. **Debugging masivo**: Si tienes 100% rechazo (como en tu screenshot), este análisis te dice exactamente POR QUÉ.
2. **Optimización de reglas**: Identificar si una regla está rechazando demasiado y ajustarla.
3. **Mejora de calidad de datos**: Si muchos son rechazados por `INVALID_DATA`, trabajar con el provider.
4. **Reportes de negocio**: Explicar a stakeholders por qué ciertos clientes no califican.

#### Ejemplo de salida:
```
🚫 Análisis de Rechazos

⚠️ ALTA TASA DE RECHAZO
100% de los documentos fueron rechazados (7/7)

Esto puede indicar un problema con:
• Las reglas de scoring son demasiado estrictas
• Los documentos de prueba no son representativos
• Hay un error en la configuración del provider

📋 Motivos de Rechazo

#  Motivo              Mensaje                           Cantidad  %    Visual
1  SERVICE_ERROR       Error interno del servicio        7         100% ██████████

💡 Recomendaciones
• SERVICE_ERROR: Revisa los logs de ejecución para ver el error técnico. 
  Puede ser un problema de conectividad o configuración. (7 documentos afectados)

📊 Distribución de Motivos
[Pie chart mostrando 100% SERVICE_ERROR en rojo]
```

#### Interpretación:
- **100% SERVICE_ERROR**: Problema técnico serio (provider caído, credenciales incorrectas, timeout).
- **50%+ SCORE_TOO_LOW**: Reglas muy estrictas o población de alto riesgo.
- **30%+ MISSING_REQUIRED_FIELDS**: Problema de integración con el provider.
- **Mix de motivos**: Situación normal, diferentes clientes tienen diferentes problemas.

---

## 🎯 Casos de Uso Combinados

### Caso 1: Ajuste de Umbral de Aprobación
**Problema**: Tasa de aprobación muy baja (10%)

**Análisis**:
1. Ver **Distribución de Scores**: ¿Dónde se concentran los scores?
2. Ver **Análisis de Rechazos**: ¿Cuántos son rechazados por `SCORE_TOO_LOW` vs otras razones?

**Decisión**:
- Si muchos scores están en 480-499 y son rechazados por `SCORE_TOO_LOW`:
  → Considerar bajar el umbral de 500 a 480
- Si muchos son rechazados por `BUSINESS_RULE_VIOLATION`:
  → No es cuestión de umbral, sino de reglas específicas

---

### Caso 2: Validación de Nueva Versión de Reglas
**Objetivo**: Validar que las nuevas reglas no cambien drásticamente la distribución

**Análisis**:
1. Ejecutar test con reglas v1.0 → guardar **Distribución de Scores**
2. Ejecutar test con reglas v2.0 → comparar **Distribución de Scores**
3. Comparar **Análisis de Rechazos** para ver si cambiaron los motivos

**Decisión**:
- Si la distribución cambió mucho (ej: promedio bajó de 550 a 400):
  → Revisar las nuevas reglas, pueden ser demasiado estrictas
- Si aumentó el % de `BUSINESS_RULE_VIOLATION`:
  → Nueva regla está rechazando más de lo esperado

---

### Caso 3: Debugging de 100% Rechazo (tu caso actual)
**Problema**: Todos los documentos son rechazados

**Análisis**:
1. Ver **Análisis de Rechazos** → identificar el motivo principal
2. En tu screenshot: 100% `SERVICE_ERROR`

**Posibles causas**:
- Provider Equifax no responde (timeout, 500 error)
- Credenciales incorrectas en Sandbox
- Error en el adapter (bug en código)
- Documento de prueba no existe en el sistema del provider

**Siguiente paso**:
1. Revisar Execution Log para ver el error específico
2. Verificar conectividad: `curl https://api.equifax.com/test`
3. Validar que los documentos existen en el provider
4. Probar con `forceRefresh=false` para ver si el cache funciona

---

## 📈 Métricas y KPIs

### KPIs de Negocio (derivados de estos análisis):

#### 1. **Tasa de Aprobación**
```
Tasa = (Documentos con score ≥ 500 / Total) × 100%
```
- **Meta**: > 30% (depende del negocio)
- **Análisis**: Ver **Distribución de Scores** → contar cuántos están en rangos Bueno+ (500+)

#### 2. **Tasa de Rechazo por Reglas de Negocio**
```
Tasa = (Rechazados por BUSINESS_RULE / Total rechazados) × 100%
```
- **Meta**: < 20% (la mayoría deberían rechazarse por score bajo, no por reglas hard)
- **Análisis**: Ver **Análisis de Rechazos** → buscar `BUSINESS_RULE_VIOLATION`

#### 3. **Calidad de Datos del Provider**
```
Calidad = 100% - (Rechazados por INVALID_DATA / Total) × 100%
```
- **Meta**: > 95%
- **Análisis**: Ver **Análisis de Rechazos** → buscar `INVALID_DATA` o `MISSING_REQUIRED_FIELDS`

#### 4. **Score Promedio de Aprobados**
```
Promedio = Suma(scores ≥ 500) / Cantidad(scores ≥ 500)
```
- **Meta**: > 550 (indica buena calidad de cartera aprobada)
- **Análisis**: Ver **Distribución de Scores** → estadísticas

---

## 🔧 Troubleshooting

### Problema: "No hay scores válidos para analizar"
**Causa**: Todos los documentos fueron rechazados o fallaron

**Solución**:
1. Ver **Análisis de Rechazos** para identificar el motivo
2. Corregir el problema (ej: arreglar provider, cambiar reglas)
3. Re-ejecutar el test

---

### Problema: Distribución muy concentrada en un rango
**Causa**: Reglas no discriminan bien o población homogénea

**Solución**:
1. Si todos están en "Bajo" (200-399):
   - Revisar si las reglas son demasiado estrictas
   - Validar que los coeficientes sean correctos
2. Si todos están en "Excelente" (700+):
   - Reglas demasiado permisivas
   - O los documentos de prueba son todos clientes premium

---

### Problema: Muchos rechazos por SERVICE_ERROR
**Causa**: Problema técnico con el provider o el servicio

**Solución**:
1. Revisar logs de NetSuite (Execution Log)
2. Buscar el error específico:
   - "timeout" → Aumentar timeout o mejorar conectividad
   - "401" → Credenciales incorrectas
   - "500" → Provider caído
3. Contactar soporte del provider si es necesario

---

## 💡 Best Practices

### 1. **Ejecutar tests periódicos**
- Diario: Con documentos de producción recientes (sample aleatorio)
- Semanal: Con suite completa de test cases (edge cases)
- Después de cada cambio de reglas: Validar impacto

### 2. **Guardar histórico de distribuciones**
- Exportar resultados a Excel/CSV
- Comparar distribuciones mes a mes
- Detectar tendencias (ej: score promedio bajando)

### 3. **Definir alertas**
- Si tasa de rechazo > 70%: Alerta a QA
- Si `SERVICE_ERROR` > 5%: Alerta a DevOps
- Si score promedio < 400: Alerta a negocio

### 4. **Documentar cambios**
- Cada cambio de reglas debe tener:
  - Distribución ANTES del cambio
  - Distribución DESPUÉS del cambio
  - Justificación del cambio

---

## 🚀 Próximos Análisis (Roadmap)

Otros análisis que podrías agregar en el futuro:

### 3. **Performance Percentiles** ⏱️
- P50, P75, P90, P95, P99 de latencia
- Identificar outliers de performance
- Detectar degradación progresiva

### 4. **Provider Reliability** 🔄
- Tasa de éxito por provider
- Tiempo promedio por provider
- Comparación Equifax vs BCU

### 5. **Variable Impact Ranking** 📊
- Top 10 variables con mayor impacto agregado
- Frecuencia de aparición
- Impacto promedio por variable

### 6. **Data Quality Heatmap** 🚨
- Matriz de completitud variable × documento
- % de completitud por variable
- Identificar variables que nunca vienen

### 7. **Business Impact Simulation** 💰
- Cuántos califican para cada producto
- Valor estimado de aprobación
- ROI de cambios de reglas

### 8. **Outlier Detection** 🔍
- Scores alejados de la media (±2σ)
- Tiempos anómalos
- Variables con valores extremos

### 9. **Trend Analysis** 📈
- Score promedio vs tiempo
- Latencia promedio vs tiempo
- Detección de degradación

### 10. **What-If Simulator** 🎲
- Cambiar valores de variables
- Recalcular score en tiempo real
- Ver impacto de mejoras

---

## 📞 Soporte

Si necesitas agregar más análisis o tienes preguntas:
1. Revisa este documento
2. Consulta los logs de ejecución
3. Prueba con diferentes documentos
4. Ajusta las reglas y re-ejecuta

---

**Versión**: 1.0  
**Última actualización**: 2025-10-02  
**Análisis implementados**: 2/10 (Score Distribution, Rejection Analysis)
