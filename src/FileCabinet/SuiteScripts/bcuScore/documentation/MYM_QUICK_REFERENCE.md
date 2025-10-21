# MYM Adapter - Quick Reference Card

## 🚀 Quick Start

### Use MYM Provider
```javascript
var score = service.calculateScore('12345678', { provider: 'mym' });
```

### Test via E2E Tool
```
?provider=mym&docs=12345678
```

## 📋 Available Providers

| Provider | Code | Source | Status |
|----------|------|--------|--------|
| Equifax | `equifax` | Equifax IC GCP | ✅ Production |
| BCU | `bcu` | BCU Direct API | 🚧 Stub |
| MYM | `mym` | RiskAPI enlamanocrm | ✅ Ready |

## 🔧 Key Files

### Created
- `bcuScore/adapters/mymAdapter.js` - MYM adapter implementation
- `bcuScore/MYM_ADAPTER_INTEGRATION.md` - Complete guide
- `bcuScore/MYM_IMPLEMENTATION_SUMMARY.md` - Implementation summary

### Modified
- `bcuScore/domain/normalize.js` - Added normalizeMymResponse()
- `bcuScore/app/service.js` - Added MYM provider case

## 🎯 Usage Examples

### Single Document
```javascript
// Using MYM provider
var result = service.calculateScore('12345678', { provider: 'mym' });

// Access score
var finalScore = result.finalScore;
var isRejected = result.metadata.isRejected;
var rejectionReason = result.metadata.rejectionReason;
```

### Batch Documents
```javascript
var results = service.calculateBatchScores(
    ['12345678', '87654321', '11223344'], 
    { provider: 'mym' }
);

// Access summary
var successRate = results.summary.successRate;
var successful = results.results; // Array of successful scores
var errors = results.errors; // Array of errors
```

### With Debug Mode
```javascript
var result = service.calculateScore('12345678', { 
    provider: 'mym',
    debug: true  // Enables detailed logging
});
```

### Disable Fallback
```javascript
var result = service.calculateScore('12345678', { 
    provider: 'mym',
    noFallback: true  // Don't fallback to Equifax on error
});
```

## 🔍 Response Structure

```javascript
{
    finalScore: 750,           // Final credit score (0-999)
    rawScore: 723.45,          // Raw calculated score
    baseScore: 700,            // Base score before adjustments
    contributions: {           // Factor contributions
        vigente: 50,
        vencido: -30,
        entities: 10
    },
    metadata: {
        calculatedAt: Date,
        isRejected: false,
        rejectionReason: null,
        provider: 'mym',
        nombre: 'JUAN PEREZ',
        worstRating: '1'
    },
    flags: {
        hasRejectableRating: false,
        isDeceased: false
    },
    validation: {
        hasValidData: true,
        dataQuality: { level: 'HIGH', score: 95 },
        confidence: { level: 'HIGH', score: 90 }
    }
}
```

## ⚠️ Error Handling

### Common Errors

| Error Code | Meaning | Action |
|------------|---------|--------|
| `MYM_REQUEST_FAILED` | Network error | Check connectivity |
| `MYM_NOT_FOUND` | Document not in BCU | Normal for new clients |
| `MYM_UNAUTHORIZED` | Auth failed | Check credentials |
| `MYM_TIMEOUT` | Request timed out | Retry or increase timeout |
| `MYM_INVALID_RESPONSE` | Bad response structure | Check API version |

### Handling Errors
```javascript
try {
    var result = service.calculateScore('12345678', { provider: 'mym' });
    
    if (result.metadata.isRejected) {
        log.debug('Rejected', result.metadata.rejectionReason);
    }
} catch (error) {
    if (error.code === 'MYM_NOT_FOUND') {
        // Handle document not found
        log.debug('Document not in BCU');
    } else {
        // Handle other errors
        log.error('Score Error', error.message);
    }
}
```

## 🧪 Testing Checklist

### Basic Tests
- [ ] Valid document (8 digits)
- [ ] Invalid document format
- [ ] Non-existent document (404)
- [ ] Compare with Equifax results

### Advanced Tests
- [ ] Batch processing (multiple docs)
- [ ] Error scenarios (timeout, auth)
- [ ] Fallback behavior
- [ ] Performance (latency)

### E2E Tool Tests
```
# Single document
?provider=mym&docs=12345678

# Multiple documents
?provider=mym&docs=12345678,87654321

# Compare providers
?provider=equifax,mym&docs=12345678
```

## 🔧 Configuration

### Timeout (mymAdapter.js)
```javascript
const TIMEOUT_MS = 20000;  // 20 seconds
```

### API Endpoint (mymAdapter.js)
```javascript
const MYM_API_URL = 'https://riskapi.info/api/models/v2/enlamanocrm/execute';
```

### Authentication (mymAdapter.js)
```javascript
const MYM_AUTH_BASIC = 'cHJvZDJfZW5sYW1hbm86ZGZlcjRlZHI=';
```

## 📊 Performance

| Provider | Avg Latency | Timeout |
|----------|-------------|---------|
| Equifax | ~500ms | 10s |
| MYM | ~800ms | 20s |
| BCU | TBD | TBD |

## 🎓 Best Practices

### 1. Provider Selection
```javascript
// Default to Equifax (fastest)
var score = service.calculateScore(doc);

// Use MYM for testing or comparison
var score = service.calculateScore(doc, { provider: 'mym' });

// Use MYM when Equifax unavailable (automatic fallback)
```

### 2. Error Handling
```javascript
// Always check for rejection
if (result.metadata.isRejected) {
    var reason = result.metadata.rejectionReason;
    // Handle rejection: SERVICE_ERROR, DECEASED, BAD_RATING, etc.
}
```

### 3. Logging
```javascript
// Use debug mode for detailed logs
var result = service.calculateScore(doc, { 
    provider: 'mym',
    debug: true 
});
```

### 4. Batch Processing
```javascript
// Process multiple documents efficiently
var results = service.calculateBatchScores(documents, { 
    provider: 'mym' 
});

// Check success rate
if (results.summary.successRate < 80) {
    log.audit('Low success rate', results.summary);
}
```

## 🔗 Related Documentation

- **Complete Guide**: `MYM_ADAPTER_INTEGRATION.md`
- **Implementation Summary**: `MYM_IMPLEMENTATION_SUMMARY.md`
- **Analytics Guide**: `ADVANCED_ANALYSIS_GUIDE.md`
- **What's New v3.0**: `WHATS_NEW_V3.md`
- **Navigation Fix**: `FIX_MISSING_PARAMETER.md`

## 📞 Support

1. Check logs: `N/log.debug`
2. Use E2E testing tool
3. Review documentation
4. Check RiskAPI status
5. Contact development team

## 🎯 Migration from SDB-Enlamano-score.js

### Before
```javascript
// Old way (SDB-Enlamano-score.js)
var response = https.post({...});
var datosBcu = JSON.parse(response.datosBcu);
// Manual parsing and scoring
```

### After
```javascript
// New way (MYM adapter)
var result = service.calculateScore(doc, { provider: 'mym' });
var score = result.finalScore;
```

**Benefits**: Less code, automatic error handling, consistent interface, built-in analytics

---

**Version:** 1.0  
**Status:** ✅ Ready for Testing  
**Next:** Test with real production documents
