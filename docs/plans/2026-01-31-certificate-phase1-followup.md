# Certificate Generator Phase 1 - Followup Issues

Issues identified during code review that should be addressed in future iterations.

## Important (Should Fix Soon)

### 1. Browser Memory Leak Risk
**File:** `server/src/services/pdf-generator.ts`
**Issue:** Puppeteer browser instance kept alive indefinitely with no health monitoring
**Recommendation:** Add browser health checks, restart after N operations or on error

### 2. Sequential PDF Generation in Bulk Endpoint
**File:** `server/src/routes/certificates.ts`
**Issue:** PDFs generated sequentially - 100+ recipients could timeout
**Recommendation:** Add batch size limits, pagination, or parallel processing with concurrency control

### 3. No Transaction for Bulk Insert
**File:** `server/src/routes/certificates.ts`
**Issue:** Partial failures leave orphan records
**Recommendation:** Wrap bulk operations in transaction

### 4. Silent Skip of Invalid Recipients
**File:** `server/src/routes/certificates.ts`
**Issue:** Recipients without names silently skipped, no visibility to caller
**Recommendation:** Track and return skipped recipients in response

### 5. Missing URL Validation for Images
**File:** `server/src/routes/certificates.ts`
**Issue:** Logo/signature URLs not validated, potential SSRF risk
**Recommendation:** Validate HTTPS URLs from allowed domains or require base64 data URIs

### 6. PUT Returns Misleading 404
**File:** `server/src/routes/certificates.ts`
**Issue:** Update runs then select - if ID doesn't exist, confusing 404
**Recommendation:** Check existence before update

## Minor (Nice to Have)

1. **No tests for certificate routes** - Add unit and integration tests
2. **Hardcoded font import** - Google Fonts may fail in air-gapped environments
3. **Magic numbers in template HTML** - Extract A4 dimensions to constants
4. **Template registry unused** - `registerTemplate()` pattern not utilized
5. **No rate limiting** - CPU-intensive endpoints unprotected
6. **Duplicate rendering logic** - Logo/signatory HTML duplicated
7. **No browser cleanup on shutdown** - `closeBrowser()` not called on SIGINT/SIGTERM
8. **Email field inconsistency** - `CertificateData` type missing email field
