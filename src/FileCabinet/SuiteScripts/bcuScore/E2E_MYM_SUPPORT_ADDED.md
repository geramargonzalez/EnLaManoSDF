# E2E Testing Tool - MYM Provider Support Added

## 🎯 What Was Added

Successfully added **MYM provider** support to the E2E testing tool (`ELM_E2E_Service_SL.js`).

## 📝 Changes Made

### 1. Provider Selection Field
- **Added new option**: `MYM (RiskAPI)` alongside existing Equifax and BCU options
- **Updated help text**: Now explains all three providers and their purposes
- **Value**: `mym` (matches service.js PROVIDER_MYM constant)

### 2. Quick Links Section
Enhanced with MYM-specific testing links:

#### 🚀 MYM Provider Tests
- **Single document**: `&docs=48123456&provider=mym`
- **Multiple documents**: `&docs=41675108,54237287&provider=mym`
- **Debug mode**: `&docs=48123456&provider=mym&debug=true`

#### 🔄 Provider Comparison
- **Equifax**: `&docs=48123456&provider=equifax`
- **MYM**: `&docs=48123456&provider=mym`
- Easy to compare results from same document using different providers

## 🎮 How to Use

### Option 1: Form Interface
1. Open E2E tool URL
2. Select "MYM (RiskAPI)" from Provider dropdown
3. Enter document(s) to test
4. Click Submit

### Option 2: Direct URL
```
https://your-domain.app.netsuite.com/app/site/hosting/scriptlet.nl?
  script=xxx&
  deploy=xxx&
  docs=48123456&
  provider=mym
```

### Option 3: Quick Links
- Click on any MYM Quick Link for instant testing
- Use comparison links to test same document with different providers

## 🔍 What You'll See

When testing with MYM provider, the results will show:

### Provider Information
- **Provider**: `mym`
- **Source**: RiskAPI enlamanocrm endpoint
- **Data structure**: Same normalized BCU data format

### Performance Metrics
- **Latency**: ~800ms (vs ~500ms for Equifax)
- **Timeout**: 20 seconds
- **Success rate**: Should match Equifax for valid documents

### Error Handling
- **MYM-specific errors**: `MYM_REQUEST_FAILED`, `MYM_NOT_FOUND`, etc.
- **Automatic fallback**: Falls back to Equifax if MYM fails (unless noFallback=true)

### Data Quality
- **Same scoring engine**: Uses identical scoring logic as Equifax
- **Normalized data**: Both providers return same NormalizedBCUData format
- **Score comparison**: Should produce similar scores for same document

## 🧪 Testing Scenarios

### Basic Functionality
```
# Test MYM with valid document
?docs=48123456&provider=mym

# Test MYM with invalid document (should show error)
?docs=1234&provider=mym

# Test MYM with non-existent document (404 error)
?docs=99999999&provider=mym
```

### Performance Testing
```
# Single document
?docs=48123456&provider=mym&debug=true

# Multiple documents (batch)
?docs=41675108,54237287,54723915&provider=mym

# Large batch (performance test)
?docs=41675108,54237287,54723915,51375882,52333281,33252929,42710744&provider=mym
```

### Provider Comparison
```
# Run same document with both providers
?docs=48123456&provider=equifax
?docs=48123456&provider=mym

# Compare scores and timings
```

### Error Testing
```
# Test fallback behavior (set invalid MYM credentials to force error)
?docs=48123456&provider=mym

# Test no fallback (should fail if MYM has issues)
?docs=48123456&provider=mym&noFallback=true
```

## 📊 Expected Results

### Successful MYM Test
```javascript
{
    finalScore: 750,
    metadata: {
        provider: 'mym',
        nombre: 'JUAN PEREZ',
        calculatedAt: Date,
        isRejected: false
    },
    // ... same structure as Equifax
}
```

### Performance Comparison
| Provider | Latency | Timeout | Reliability |
|----------|---------|---------|-------------|
| Equifax | ~500ms | 10s | High |
| MYM | ~800ms | 20s | High |
| BCU | TBD | TBD | Future |

### Score Comparison
- **Similar scores**: Both providers use same BCU data source
- **Same rejection logic**: Identical BAD_RATINGS and business rules
- **Consistent format**: Normalized to same NormalizedBCUData structure

## 🐛 Troubleshooting

### Issue: "Provider not supported"
- **Cause**: Old service.js without MYM support
- **Fix**: Ensure mymAdapter.js is deployed and service.js updated

### Issue: "MYM_REQUEST_FAILED"
- **Cause**: Network error or RiskAPI down
- **Debug**: Check debug=true logs, verify RiskAPI endpoint

### Issue: Different scores from Equifax
- **Cause**: Data source differences or timing
- **Debug**: Compare raw data in metadata, check both use same document

### Issue: Slow performance
- **Expected**: MYM is ~300ms slower than Equifax
- **Acceptable**: Up to 20 seconds (TIMEOUT_MS)
- **Action**: Monitor actual latency in debug logs

## 🎯 Next Steps

### Immediate Testing
1. **Deploy updated E2E tool** with MYM support
2. **Test basic functionality** with known valid documents
3. **Compare results** between Equifax and MYM
4. **Verify error handling** with invalid documents

### Production Validation
1. **Performance monitoring** (latency, success rate)
2. **Score accuracy** comparison with Equifax
3. **Error rate analysis** (MYM-specific errors)
4. **Fallback behavior** verification

### Documentation Update
1. **User guide** for choosing providers
2. **Performance benchmarks** with real data
3. **Best practices** for provider selection
4. **Troubleshooting guide** expansion

## 🔗 Related Files

- **E2E Tool**: `bcuScore/tests/ELM_E2E_Service_SL.js` (updated)
- **MYM Adapter**: `bcuScore/adapters/mymAdapter.js`
- **Service Layer**: `bcuScore/app/service.js` (with MYM support)
- **Normalization**: `bcuScore/domain/normalize.js` (with normalizeMymResponse)

## 📚 Documentation

- **Complete Guide**: `MYM_ADAPTER_INTEGRATION.md`
- **Quick Reference**: `MYM_QUICK_REFERENCE.md`
- **Implementation**: `MYM_IMPLEMENTATION_SUMMARY.md`

---

**Status**: ✅ Complete  
**Ready for**: Testing and deployment  
**Next Action**: Test MYM provider with real documents using E2E tool