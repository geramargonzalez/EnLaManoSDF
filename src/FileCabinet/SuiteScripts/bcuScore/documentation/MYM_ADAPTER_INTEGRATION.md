# MYM Adapter Integration Guide

## Overview

The **MYM adapter** integrates the existing RiskAPI connection (previously in `SDB-Enlamano-score.js`) as a new provider option for the BCU Score service. This allows the system to use three different data sources:

- **Equifax**: Via Equifax IC GCP API
- **BCU**: Direct BCU API (stub, pending implementation)
- **MYM**: Via RiskAPI `enlamanocrm` endpoint

## Architecture

```
service.js
    ↓
fetchProviderData(documento, options)
    ↓
switch(options.provider)
    ├── 'equifax' → equifaxAdapter.fetch()
    ├── 'bcu' → bcuAdapter.fetch()
    └── 'mym' → mymAdapter.fetch()
         ↓
    executeRiskApiRequest()
         ↓
    normalize.normalizeMymResponse()
         ↓
    scoreEngine.calculateScore()
```

## MYM Adapter Details

### File: `bcuScore/adapters/mymAdapter.js`

**Main Functions:**

1. **`fetch(documento, options)`**
   - Entry point for MYM provider
   - Calls `executeRiskApiRequest()` to fetch data from RiskAPI
   - Normalizes response using `normalize.normalizeMymResponse()`
   - Returns normalized BCU data

2. **`executeRiskApiRequest(documento, options)`**
   - Makes HTTPS POST to RiskAPI endpoint
   - Endpoint: `https://riskapi.info/api/models/v2/enlamanocrm/execute`
   - Authentication: Basic Auth (base64 encoded credentials)
   - Request body: `{ Documento: documento, TipoDocumento: 'IDE' }`
   - Parses nested JSON strings in response (`datosBcu`, `datosBcu_T6`)
   - Returns: `{ datosBcu: Object, datosBcuT6: Object, raw: Object }`

3. **Error Handling:**
   - Validates response structure (checks for `errores`, `datosBcu`, `datosBcu_T6`)
   - Maps HTTP status codes to structured errors
   - Handles 404 specifically (document not found in BCU)
   - Creates `MymAdapterError` with code, message, provider, and details

### RiskAPI Response Structure

```json
{
  "datosBcu": "{\"data\":{\"Nombre\":\"JUAN PEREZ\",\"RubrosValoresGenerales\":[...],\"EntidadesRubrosValores\":[...]}}",
  "datosBcu_T6": "{\"data\":{\"RubrosValoresGenerales\":[...],\"EntidadesRubrosValores\":[...]}}",
  "errores": []
}
```

**Note:** `datosBcu` and `datosBcu_T6` are JSON strings that need `JSON.parse()`.

### Normalization

**File:** `bcuScore/domain/normalize.js`

**Function:** `normalizeMymResponse(mymResponse, documento)`

**Input:**
```javascript
{
  datosBcu: {
    data: {
      Nombre: "JUAN PEREZ",
      RubrosValoresGenerales: [
        { Rubro: "VIGENTE", MnPesos: 10000, MePesos: 500 },
        { Rubro: "VENCIDO", MnPesos: 1000, MePesos: 0 },
        { Rubro: "CASTIGADO", MnPesos: 0, MePesos: 0 }
      ],
      EntidadesRubrosValores: [
        {
          NombreEntidad: "BANCO REPUBLIC",
          Calificacion: "2",
          Rubros: [
            { Rubro: "VIGENTE", MnPesos: 5000, MePesos: 0 },
            { Rubro: "VENCIDO", MnPesos: 0, MePesos: 0 }
          ]
        }
      ]
    }
  },
  datosBcuT6: { data: {...} },
  raw: {...}
}
```

**Output:**
```javascript
{
  provider: 'mym',
  documento: '12345678',
  periodData: {
    t0: {
      totals: [...],  // Normalized rubros from datosBcu
      entities: [...], // Normalized entities from datosBcu
      aggregates: {...} // Sums and counts
    },
    t6: {
      totals: [...],  // Normalized rubros from datosBcuT6
      entities: [...], // Normalized entities from datosBcuT6
      aggregates: {...}
    }
  },
  flags: {
    isDeceased: false,
    hasRejectableRating: true/false // Based on BAD_RATINGS
  },
  metadata: {
    nombre: "JUAN PEREZ",
    worstRating: "2",
    aggregates: {...}
  },
  normalizedAt: Date
}
```

### Helper Functions

- **`normalizeMymRubrosList(rubros)`**: Converts MYM rubros format to standard format
- **`normalizeMymEntitiesList(entities)`**: Converts MYM entities with ratings
- **`normalizeMymEntityRubros(rubros)`**: Converts entity-level rubros
- **`extractMymAggregates(rubros)`**: Extracts aggregates (vigente, vencido, castigado totals)

## Usage

### Basic Usage

```javascript
// Using Equifax (default)
var score = service.calculateScore('12345678');

// Using MYM provider
var score = service.calculateScore('12345678', { provider: 'mym' });

// Using MYM with debug mode
var score = service.calculateScore('12345678', { 
    provider: 'mym', 
    debug: true 
});
```

### Testing with E2E Tool

```
https://your-netsuite-domain.app.netsuite.com/app/site/hosting/scriptlet.nl?script=xxx&deploy=xxx&provider=mym&docs=12345678
```

**Query Parameters:**
- `provider=mym`: Use MYM provider
- `docs=12345678`: Single document to test
- `docs=12345678,87654321`: Multiple documents

### Batch Testing

```javascript
var results = service.calculateBatchScores(['12345678', '87654321'], { 
    provider: 'mym' 
});

// Results:
{
    results: [...],  // Successful calculations
    errors: [...],   // Failed calculations
    summary: {
        total: 2,
        successful: 2,
        failed: 0,
        successRate: 100
    }
}
```

## Configuration

### Constants

**File:** `bcuScore/adapters/mymAdapter.js`

```javascript
const TIMEOUT_MS = 20000; // 20 seconds
const MYM_API_URL = 'https://riskapi.info/api/models/v2/enlamanocrm/execute';
const MYM_AUTH_BASIC = 'cHJvZDJfZW5sYW1hbm86ZGZlcjRlZHI=';
```

### Provider Constants

**File:** `bcuScore/app/service.js`

```javascript
const PROVIDER_EQUIFAX = 'equifax';
const PROVIDER_BCU = 'bcu';
const PROVIDER_MYM = 'mym';
```

**File:** `bcuScore/domain/normalize.js`

```javascript
const PROVIDER_EQUIFAX = 'equifax';
const PROVIDER_BCU = 'bcu';
const PROVIDER_MYM = 'mym';
```

## Error Handling

### MYM-Specific Errors

```javascript
{
    name: 'MymAdapterError',
    code: 'MYM_*',
    message: 'Human-readable message',
    provider: 'mym',
    details: { ... }
}
```

**Error Codes:**

- `MYM_REQUEST_FAILED`: HTTP request failed
- `MYM_INVALID_RESPONSE`: Response structure invalid
- `MYM_PARSE_ERROR`: JSON parsing failed
- `MYM_NOT_FOUND`: Document not found in BCU (HTTP 404)
- `MYM_UNAUTHORIZED`: Authentication failed (HTTP 401)
- `MYM_FORBIDDEN`: Access denied (HTTP 403)
- `MYM_RATE_LIMITED`: Too many requests (HTTP 429)
- `MYM_SERVER_ERROR`: Internal server error (HTTP 500)
- `MYM_SERVICE_UNAVAILABLE`: Service unavailable (HTTP 503)

### Fallback Behavior

If MYM provider fails and `options.noFallback !== true`, the service will automatically fall back to Equifax:

```javascript
try {
    // Try MYM
    return mymAdapter.fetch(documento, options);
} catch (error) {
    // Fallback to Equifax
    log.debug('MYM failed, falling back to Equifax');
    return equifaxAdapter.fetch(documento, options);
}
```

## Data Quality Comparison

| Provider | Source | Latency | Coverage | Data Structure |
|----------|--------|---------|----------|----------------|
| Equifax  | Equifax IC GCP | ~500ms | High | Equifax format |
| BCU      | BCU Direct API | TBD | Highest | BCU native format |
| MYM      | RiskAPI → BCU | ~800ms | High | BCU format (via RiskAPI) |

**Recommendation:**
- Use **Equifax** for production (fastest, most reliable)
- Use **MYM** for testing or when Equifax is unavailable
- Use **BCU** when direct API becomes available (highest accuracy)

## Migration from SDB-Enlamano-score.js

### Before (Old Code)

```javascript
// SDB-Enlamano-score.js
function scoreFinal(documento) {
    var response = https.post({
        url: 'https://riskapi.info/api/models/v2/enlamanocrm/execute',
        body: JSON.stringify({ Documento: documento, TipoDocumento: 'IDE' }),
        headers: { 'Authorization': 'Basic ...' }
    });
    
    var datosBcu = JSON.parse(response.datosBcu);
    var datosBcuT6 = JSON.parse(response.datosBcu_T6);
    
    // Custom parsing and scoring logic...
}
```

### After (New Code)

```javascript
// Using MYM adapter
var result = service.calculateScore(documento, { provider: 'mym' });

// Same data, normalized and scored automatically
var score = result.finalScore;
var metadata = result.metadata;
```

### Benefits of Migration

1. **Unified Interface**: Same API for all providers
2. **Automatic Normalization**: No manual parsing needed
3. **Error Handling**: Structured errors with fallback
4. **Caching**: Optional caching for performance (disabled for calculateScore per user requirement)
5. **Testing Tools**: E2E testing interface
6. **Analytics**: Built-in score analysis and rejection breakdown

## Troubleshooting

### Issue: "MYM_REQUEST_FAILED"

**Cause:** Network error or timeout

**Solution:**
1. Check network connectivity
2. Verify RiskAPI endpoint is reachable
3. Increase `TIMEOUT_MS` if needed (currently 20 seconds)

### Issue: "MYM_UNAUTHORIZED"

**Cause:** Invalid credentials

**Solution:**
1. Verify `MYM_AUTH_BASIC` constant is correct
2. Check if credentials have expired
3. Contact RiskAPI support for new credentials

### Issue: "MYM_INVALID_RESPONSE"

**Cause:** Response structure changed or missing fields

**Solution:**
1. Check `response.datosBcu` exists
2. Check `response.datosBcu_T6` exists
3. Verify both are valid JSON strings
4. Review RiskAPI documentation for structure changes

### Issue: Score different from SDB-Enlamano-score.js

**Cause:** Different scoring logic or data interpretation

**Solution:**
1. Compare normalized data: `result.metadata.rawData`
2. Check scoring rules: `scoringRules.getScoringRules()`
3. Verify same BCU data is being processed
4. Review `scoreEngine.calculateScore()` logic

## Testing Checklist

- [ ] Test with valid document (8 digits)
- [ ] Test with invalid document (wrong format)
- [ ] Test with non-existent document (404 error)
- [ ] Compare scores: MYM vs Equifax for same document
- [ ] Verify fallback works when MYM fails
- [ ] Check normalized data structure matches expectations
- [ ] Verify worst rating detection works
- [ ] Test batch scoring with multiple documents
- [ ] Check cache behavior (should bypass for calculateScore)
- [ ] Review logs for errors or warnings

## Future Enhancements

1. **Provider Selection Logic**: Automatic provider selection based on availability
2. **Data Comparison**: Compare results from multiple providers
3. **Health Checks**: Monitor provider availability and latency
4. **Metrics Dashboard**: Track provider usage, success rates, latency
5. **A/B Testing**: Compare scoring accuracy across providers
6. **Caching Strategy**: Provider-specific cache TTLs
7. **Credential Rotation**: Automatic credential refresh for MYM
8. **Response Validation**: Schema validation for RiskAPI responses

## Related Documentation

- **Cache Strategy**: See root README (cache bypassed for calculateScore)
- **Score Distribution**: `ADVANCED_ANALYSIS_GUIDE.md` → Score Distribution section
- **Rejection Analysis**: `ADVANCED_ANALYSIS_GUIDE.md` → Rejection Breakdown section
- **E2E Testing**: `WHATS_NEW_V3.md` → Testing section
- **Navigation Fix**: `FIX_MISSING_PARAMETER.md`
- **Changelog**: `CHANGELOG_E2E.md` → v3.0 and MYM adapter

## Support

For issues or questions:
1. Check logs in NetSuite (`N/log.debug`)
2. Use E2E testing tool for debugging
3. Review this documentation
4. Check RiskAPI documentation: [RiskAPI Docs](https://riskapi.info/docs)
5. Contact development team

---

**Version:** 1.0  
**Last Updated:** 2024  
**Author:** EnLaMano Development Team
