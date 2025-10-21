# 🚀 ELM BCU Score - Optimizaciones de Performance

## ⚡ **OPTIMIZACIONES IMPLEMENTADAS**

### 1. **Caché Agresivo**
```javascript
// Cache TTL aumentado de 5min → 30min
CACHE_TTL_SECONDS = 1800

// Cache de reglas aumentado de 5min → 30min  
CACHE_DURATION_MS = 1800000

// Token cache en MEMORIA (sin NetSuite cache I/O)
var _tokenCache = null; // Evita roundtrips a NetSuite cache
```

### 2. **Timeouts Reducidos**
```javascript
// Equifax API timeout: 30s → 15s
TIMEOUT_MS = 15000

// Token request timeout: default → 10s
tokenTimeout = 10
```

### 3. **Scoring Engine O(n) Ultra-Optimizado**

**Antes (múltiples loops):**
```javascript
// 6+ loops separados para cada cálculo
extractTotalByType() // Loop 1
extractEntityCount() // Loop 2  
extractWorstRating() // Loop 3
calculateDebtContribution() // Más procesamiento
```

**Después (single loop O(n)):**
```javascript
// TODO en UN SOLO LOOP
for (var i = 0; i < entities.length; i++) {
    totals.vigente += entity.vigente;
    totals.vencido += entity.vencido; 
    totals.castigado += entity.castigado;
    // + worst rating calculation en mismo loop
}
```

### 4. **Pre-compilación de Lookups**
```javascript
// Lookup tables pre-compiladas para O(1)
var RATING_ORDER = { '1A': 1, '1C': 2, '2A': 3... }; 
var BAD_RATINGS_SET = { '2B': true, '3': true... };
var DOCUMENT_REGEX = /^\d{7,8}$/; // Pre-compilada
```

### 5. **Early Exits Optimizados**
```javascript
// Early exit por casos más comunes primero
if (flags.isDeceased) return rejected; // #1 más común
if (flags.hasRejectableRating) return rejected; // #2
if (!hasData) return rejected; // #3

// Skip trending por defecto (trending.enabled = false)
// Skip validaciones complejas en producción
```

### 6. **Logging Condicional**
```javascript
// Solo log si debug=true o hay errores
var isDebugMode = options.debug === true;
if (isDebugMode || scoreResult.metadata.isRejected) {
    log.audit(...);
}

// Log solo últimos 4 dígitos documento
doc: documento.substr(-4)
```

### 7. **Configuración Lazy-Loaded**
```javascript
// Config Equifax cargada solo una vez
if (!_config) {
    _config = getEquifaxConfig(); // Solo primera vez
}

// Basic Auth pre-compilado (sin encoding repetido)
basicAuth: encode.convert({...}) // Solo una vez
```

---

## 📊 **TARGETS DE PERFORMANCE**

### Tiempos Esperados (producción)
| Escenario | Target | Optimización |
|-----------|--------|--------------|
| **Cache Hit** | <100ms | Caché NetSuite directo |
| **Cache Miss + Equifax** | <2000ms | Timeout 15s, token cache |
| **Scoring Puro** | <5ms | O(n) single loop |
| **Validación** | <1ms | Regex pre-compilada |
| **Error Handling** | <10ms | Early exits |

### Throughput Targets
- **Scoring Engine**: >2000 ops/seg
- **Con Cache Hit**: >500 requests/seg  
- **Con API Call**: >50 requests/seg

---

## ⚙️ **CONFIGURACIÓN PARA MÁXIMA VELOCIDAD**

### Script Parameters
```javascript
// Timeouts agresivos
custscript_equifax_timeout = 15000

// URLs optimizadas (sin redirects)
custscript_equifax_api_url = "https://api.equifax.com/ic-gcp-reporte"
custscript_equifax_token_url = "https://api.equifax.com/oauth/token"
```

### Reglas de Scoring Optimizadas
```javascript
// En customrecord_sdb_score
trending.enabled = false  // Deshabilitar trending por defecto
validation.enabled = false // Skip validaciones complejas
logging.level = "ERROR"   // Solo errores críticos
```

### Opciones de Llamada
```javascript
// Para máxima velocidad
const options = {
    provider: 'equifax',
    forceRefresh: false,    // SIEMPRE usar cache
    debug: false,           // Sin logging detallado
    timeout: 15000,         // Timeout agresivo
    includePeriods: false,  // Solo t0 (skip t6 si no es necesario)
    skipTrending: true      // Skip análisis trending
};

const result = ELM_SCORE_BCU_LIB.scoreFinal(documento, options);
```

---

## 🔧 **TESTING DE PERFORMANCE**

### Benchmark Rápido
```javascript
// En RESTlet/User Event
const start = Date.now();
const result = ELM_SCORE_BCU_LIB.scoreFinal('12345670', { debug: false });
const duration = Date.now() - start;

log.audit('Performance Test', {
    duration: duration + 'ms',
    score: result.finalScore,
    fromCache: result.metadata.fromCache
});
```

### Batch Testing
```javascript
const documents = ['12345670', '12345671', '12345672']; // Testing docs
const startTime = Date.now();

documents.forEach(doc => {
    ELM_SCORE_BCU_LIB.scoreFinal(doc, { debug: false });
});

const totalTime = Date.now() - startTime;
const avgTime = totalTime / documents.length;

log.audit('Batch Performance', {
    totalTime: totalTime + 'ms',
    avgTime: avgTime + 'ms',
    throughput: (documents.length / totalTime * 1000) + ' ops/sec'
});
```

---

## 📈 **MONITORING EN PRODUCCIÓN**

### Métricas Clave
```javascript
// Dashboard queries
SELECT 
    AVG(duration_ms) as avg_response_time,
    COUNT(*) as total_requests,
    SUM(CASE WHEN from_cache = true THEN 1 ELSE 0 END) as cache_hits,
    (cache_hits / total_requests * 100) as cache_hit_rate
FROM elm_score_logs 
WHERE timestamp > NOW() - INTERVAL 1 HOUR;
```

### Alertas de Performance
- Response time > 3000ms
- Cache hit rate < 70%
- Error rate > 5%
- Equifax timeout rate > 10%

---

## 🎯 **RESULTADOS ESPERADOS**

### Antes vs Después
| Métrica | Antes | Después | Mejora |
|---------|-------|---------|---------|
| Cache Hit | ~200ms | **<100ms** | 50%↑ |
| API Call | ~4000ms | **<2000ms** | 50%↑ |
| Scoring | ~20ms | **<5ms** | 75%↑ |
| Throughput | ~100 ops/sec | **>500 ops/sec** | 400%↑ |

### Casos de Uso Críticos
1. **RESTlet alta concurrencia**: 500+ requests/min
2. **User Event batch processing**: 100+ records/min
3. **Map/Reduce scoring masivo**: 1000+ documents/hour

---

## 🛠️ **TROUBLESHOOTING PERFORMANCE**

### Si el response time es alto:
1. Verificar cache hit rate: `service.getCacheStats()`
2. Revisar timeouts Equifax en logs
3. Validar token cache: `equifaxAdapter.invalidateTokenCache()`

### Si hay muchos timeouts:
1. Reducir timeout: `TIMEOUT_MS = 10000`
2. Implementar retry logic con backoff
3. Considerar circuit breaker pattern

### Si el cache no funciona:
1. Verificar permisos NetSuite cache
2. Revisar TTL configuration
3. Validar cache key generation

---

**🚀 Con estas optimizaciones, el script debería responder en <100ms para cache hits y <2000ms para API calls, logrando throughput >500 ops/sec.**