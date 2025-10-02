# MYM Adapter Implementation Summary

## What Was Done

Successfully integrated the existing RiskAPI connection (from `SDB-Enlamano-score.js`) as a new provider option called **MYM** into the BCU Score service architecture.

## Files Created

### 1. `bcuScore/adapters/mymAdapter.js` (~180 lines)
**Purpose:** Adapter for RiskAPI enlamanocrm endpoint

**Key Functions:**
- `fetch(documento, options)` - Main entry point
- `executeRiskApiRequest(documento, options)` - Makes HTTPS POST to RiskAPI
- `mapMymHttpError(httpStatus, responseBody)` - Maps HTTP codes to errors
- `createMymError(code, message, details)` - Creates structured errors

**Features:**
- Validates response structure (errores, datosBcu, datosBcu_T6)
- Parses nested JSON strings (response contains JSON within JSON)
- Handles 404 errors specifically (document not found)
- Timeout: 20 seconds
- Returns normalized format: `{ datosBcu: Object, datosBcuT6: Object, raw: Object }`

### 2. `bcuScore/MYM_ADAPTER_INTEGRATION.md`
**Purpose:** Complete integration guide

**Sections:**
- Architecture overview
- MYM adapter details
- RiskAPI response structure
- Normalization process
- Usage examples
- Configuration
- Error handling
- Troubleshooting
- Testing checklist

## Files Modified

### 1. `bcuScore/domain/normalize.js` (+200 lines)

**Added:**
- `PROVIDER_MYM` constant
- `normalizeMymResponse(mymResponse, documento)` - Main normalization function
- `normalizeMymRubrosList(rubros)` - Converts rubros format
- `normalizeMymEntitiesList(entities)` - Converts entities with ratings
- `normalizeMymEntityRubros(rubros)` - Converts entity-level rubros
- `extractMymAggregates(rubros)` - Extracts aggregates (vigente, vencido, castigado)

**Purpose:**
Normalizes MYM/RiskAPI response to uniform `NormalizedBCUData` format, allowing the same scoring engine to process data from Equifax, BCU, or MYM.

**Key Logic:**
- Extracts data from `datosBcu` (T0) and `datosBcu_T6` (T6)
- Converts `RubrosValoresGenerales` to normalized totals
- Converts `EntidadesRubrosValores` to normalized entities
- Detects worst rating using `findWorstRating()`
- Flags rejectable ratings using `BAD_RATINGS`

### 2. `bcuScore/app/service.js` (+5 lines)

**Added:**
- Import `mymAdapter` in define array
- `PROVIDER_MYM = 'mym'` constant
- Case `'mym'` in `fetchProviderData()` switch statement
- Export `PROVIDER_MYM` in `_internal` object

**Result:**
Three providers now available: `equifax`, `bcu`, `mym`

## How to Use

### Basic Usage

```javascript
// Default provider (Equifax)
var score = service.calculateScore('12345678');

// MYM provider
var score = service.calculateScore('12345678', { provider: 'mym' });

// MYM with debug mode
var score = service.calculateScore('12345678', { 
    provider: 'mym', 
    debug: true 
});
```

### E2E Testing Tool

```
https://your-domain.app.netsuite.com/app/site/hosting/scriptlet.nl?
  script=xxx&
  deploy=xxx&
  provider=mym&
  docs=12345678
```

### Batch Testing

```javascript
var results = service.calculateBatchScores(
    ['12345678', '87654321'], 
    { provider: 'mym' }
);
```

## Technical Details

### RiskAPI Endpoint
- **URL:** `https://riskapi.info/api/models/v2/enlamanocrm/execute`
- **Method:** POST
- **Auth:** Basic Auth (base64 encoded)
- **Timeout:** 20 seconds

### Request Format
```json
{
  "Documento": "12345678",
  "TipoDocumento": "IDE"
}
```

### Response Format
```json
{
  "datosBcu": "{\"data\":{...}}",  // JSON string (T0)
  "datosBcu_T6": "{\"data\":{...}}", // JSON string (T6)
  "errores": []
}
```

**Important:** Both `datosBcu` and `datosBcu_T6` are JSON strings that need `JSON.parse()`.

### Data Structure

**Inside datosBcu/datosBcu_T6:**
```json
{
  "data": {
    "Nombre": "JUAN PEREZ",
    "RubrosValoresGenerales": [
      { "Rubro": "VIGENTE", "MnPesos": 10000, "MePesos": 500 },
      { "Rubro": "VENCIDO", "MnPesos": 1000, "MePesos": 0 }
    ],
    "EntidadesRubrosValores": [
      {
        "NombreEntidad": "BANCO REPUBLIC",
        "Calificacion": "2",
        "Rubros": [
          { "Rubro": "VIGENTE", "MnPesos": 5000, "MePesos": 0 }
        ]
      }
    ]
  }
}
```

## Benefits

### 1. Unified Interface
- Same API for all providers (Equifax, BCU, MYM)
- Switch providers with single parameter: `options.provider = 'mym'`
- No code changes needed in calling code

### 2. Automatic Fallback
- If MYM fails, automatically falls back to Equifax
- Can disable fallback with `options.noFallback = true`
- Logged transparently for debugging

### 3. Consistent Error Handling
- Structured errors with code, name, message, details
- HTTP status codes mapped to specific error codes
- Easy to debug and monitor

### 4. Data Normalization
- All providers return same `NormalizedBCUData` format
- Scoring engine agnostic to data source
- Easy to compare results across providers

### 5. Reusability
- Leverages existing RiskAPI connection (proven in production)
- Reuses normalization helpers (normalizeRubroList, etc.)
- Follows established adapter pattern

## Error Handling

### MYM Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `MYM_REQUEST_FAILED` | N/A | Network error or timeout |
| `MYM_INVALID_RESPONSE` | N/A | Response structure invalid |
| `MYM_PARSE_ERROR` | N/A | JSON parsing failed |
| `MYM_NOT_FOUND` | 404 | Document not found in BCU |
| `MYM_UNAUTHORIZED` | 401 | Authentication failed |
| `MYM_FORBIDDEN` | 403 | Access denied |
| `MYM_RATE_LIMITED` | 429 | Too many requests |
| `MYM_SERVER_ERROR` | 500 | Internal server error |
| `MYM_SERVICE_UNAVAILABLE` | 503 | Service unavailable |

### Example Error

```javascript
{
    name: 'MymAdapterError',
    code: 'MYM_NOT_FOUND',
    message: 'Document not found in BCU',
    provider: 'mym',
    details: {
        documento: '12345678',
        httpStatus: 404,
        timestamp: '2024-01-15T10:30:00Z'
    }
}
```

## Testing Checklist

Before deploying to production:

- [x] Created mymAdapter.js with all required functions
- [x] Added normalizeMymResponse() to normalize.js
- [x] Integrated MYM into service.js fetchProviderData()
- [x] Exported PROVIDER_MYM constant
- [x] Created comprehensive documentation
- [ ] Test with valid document (8 digits)
- [ ] Test with invalid document (wrong format)
- [ ] Test with non-existent document (404 error)
- [ ] Compare scores: MYM vs Equifax for same document
- [ ] Verify fallback works when MYM fails
- [ ] Check normalized data structure
- [ ] Verify worst rating detection
- [ ] Test batch scoring
- [ ] Review logs for errors
- [ ] Performance testing (latency comparison)

## Next Steps

### Immediate (Before Production)
1. **Test with Real Data**: Use E2E tool to test with production documents
2. **Compare Results**: Verify MYM scores match expected values
3. **Verify Fallback**: Test error scenarios and fallback behavior
4. **Performance Check**: Measure latency (should be ~800ms)

### Short Term (1-2 weeks)
1. **Monitor Usage**: Track MYM provider usage and success rates
2. **Collect Metrics**: Latency, error rates, fallback frequency
3. **Optimize Timeout**: Adjust `TIMEOUT_MS` based on real data
4. **Document Findings**: Update docs with production insights

### Long Term (1-3 months)
1. **Provider Health Checks**: Monitor availability of all providers
2. **Automatic Selection**: Choose provider based on availability/latency
3. **A/B Testing**: Compare scoring accuracy across providers
4. **Metrics Dashboard**: Visualize provider performance
5. **Credential Rotation**: Automate MYM credential refresh

## Migration Path from SDB-Enlamano-score.js

### Old Approach
```javascript
// Direct RiskAPI call in each script
function scoreFinal(documento) {
    var response = https.post({
        url: 'https://riskapi.info/api/models/v2/enlamanocrm/execute',
        body: JSON.stringify({ Documento: documento, TipoDocumento: 'IDE' }),
        headers: { 'Authorization': 'Basic ...' }
    });
    
    var datosBcu = JSON.parse(response.datosBcu);
    // Custom parsing and scoring...
}
```

### New Approach
```javascript
// Use MYM adapter through service.js
var result = service.calculateScore(documento, { provider: 'mym' });
var score = result.finalScore;
```

### Migration Benefits
- **Less Code**: No need to manage HTTP requests manually
- **Error Handling**: Automatic error handling and fallback
- **Caching**: Optional caching (disabled for calculateScore per user requirement)
- **Testing**: Built-in E2E testing tools
- **Analytics**: Score distribution and rejection analysis
- **Consistency**: Same interface as other providers

## Related Context

### Previous Work
- **v1.0**: Initial BCU Score service with Equifax
- **v2.0**: Cache removal (per user requirement for unique calculations)
- **v3.0**: Added Score Distribution and Rejection Analysis
- **v3.1**: Navigation button fixes (script/deploy parameters)
- **v3.2**: MYM adapter integration (current)

### Cache Strategy
**Important:** Cache is **bypassed** for `calculateScore()` to ensure unique calculations per user requirement. This means:
- Every call to `calculateScore()` fetches fresh data
- No score results are cached (cache read/write commented out)
- Scoring rules are still cached (30 min TTL)
- MYM adapter respects this strategy

### Documentation Suite
- `MYM_ADAPTER_INTEGRATION.md` - This file (complete guide)
- `ADVANCED_ANALYSIS_GUIDE.md` - Score analytics features
- `WHATS_NEW_V3.md` - v3.0 features summary
- `FIX_MISSING_PARAMETER.md` - Navigation button fix
- `CHANGELOG_E2E.md` - Version history

## Support

For questions or issues:
1. Review `MYM_ADAPTER_INTEGRATION.md` (comprehensive guide)
2. Check NetSuite logs (`N/log.debug`)
3. Use E2E testing tool for debugging
4. Verify RiskAPI endpoint is reachable
5. Contact development team

---

**Implementation Date:** 2024  
**Implemented By:** EnLaMano Development Team  
**Status:** ✅ Complete, ready for testing  
**Next Action:** Test with real production documents
