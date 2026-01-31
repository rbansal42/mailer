# Phase 3 Followup Issues

**Date:** January 31, 2026
**Phase:** Phase 3 - Analytics & Tracking
**Status:** Documented for future work

## Fixed in This Phase

### Critical
1. **Open redirect vulnerability** - Fixed by validating redirect URLs are HTTP/HTTPS only

### Important
1. **Missing authMiddleware on analytics routes** - Fixed by adding authMiddleware
2. **No validation on tracking settings baseUrl** - Fixed by validating URL format
3. **Open rate calculation used wrong denominator** - Fixed to use `sent` only, not `sent + failed`

## Minor Issues (Nice to Have)

### 1. Settings Routes Repeated Query Pattern
- **File:** `server/src/routes/settings.ts:52-60` and `107-115`
- **Issue:** Both GET and PUT fetch all settings individually
- **Fix:** Create a helper function `getTrackingSettingsFromDb()`

### 2. Per-Recipient Query Could Be Slow for Large Campaigns
- **File:** `server/src/services/tracking.ts:233-251`
- **Issue:** Subqueries in recipients SELECT run for each row (N+1-ish pattern)
- **Fix:** Restructure with JOINs if performance becomes an issue

### 3. Missing Index on campaign_id in tracking_tokens
- **Issue:** Queries frequently join on `campaign_id`
- **Fix:** Add index:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_tracking_tokens_campaign ON tracking_tokens(campaign_id)
  ```

### 4. Hardcoded 48-Hour Window for opensOverTime
- **File:** `server/src/services/tracking.ts:217`
- **Issue:** Fixed 48-hour window for opens chart
- **Fix:** Make configurable via query parameter

## Recommendations

1. Add unit tests for tracking service functions
2. Consider storing original URLs in database rather than passing in query params (more secure)
3. Add rate limiting on tracking endpoints to prevent abuse
4. Add data retention job to delete old tracking events per `tracking_retention_days` setting
