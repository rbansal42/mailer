# Phase 4 Followup Issues

**Date:** January 31, 2026
**Phase:** Phase 4 - Advanced Scheduling
**Status:** Documented for future work

## Fixed in This Phase

### Critical
1. **Cron parsing ignored day/month/week** - Fixed to handle dayOfWeek, dayOfMonth, and month parts
2. **Missing input validation** - Added validation for name, subject, recipient_source in routes

## Remaining Issues

### Important (Should Fix)

#### 1. Timezone Support Is Limited
- **Files:** `recurring-processor.ts`, `timezone-processor.ts`
- **Issue:** Timezone parameter is accepted but not fully utilized. The hardcoded offset table in `getUtcTimeForLocal()` doesn't handle DST and only covers 12 timezones.
- **Fix:** Use `Intl.DateTimeFormat` with `timeZone` option, or add `luxon`/`date-fns-tz` for proper timezone handling.

#### 2. Sequence Tracking Uses Negative Campaign IDs
- **File:** `sequence-processor.ts:215-216`
- **Issue:** `const syntheticCampaignId = -enrollment.sequence_id` is a hack that could cause issues with analytics queries and foreign key constraints.
- **Fix:** Add a `sequence_id` column to `tracking_tokens` or create a dedicated sequences tracking table.

#### 3. No Concurrency Protection on Processors
- **Files:** `recurring-processor.ts`, `sequence-processor.ts`
- **Issue:** If a processor takes >1 minute, the next cron tick could start processing the same items. Both select then update, creating a race window.
- **Fix:** Use `UPDATE ... WHERE ... RETURNING` pattern or add a `processing_at` timestamp column to lock rows.

#### 4. Timezone Batch Processor Doesn't Send Emails
- **File:** `timezone-processor.ts:149-154`
- **Issue:** `processScheduledBatches()` only counts ready batches but doesn't send them. The send flow needs integration.
- **Fix:** Implement the send logic or document the integration point with the main send flow.

#### 5. CSV Parsing Doesn't Handle Quoted Fields
- **File:** `recurring-processor.ts:110-129`
- **Issue:** `line.split(',')` breaks on CSV values containing commas, e.g., `"Smith, John",john@example.com`
- **Fix:** Use a CSV parsing library (like `papaparse`) or handle quoted fields properly.

#### 6. No Rate Limiting on Fetch Operations
- **File:** `recurring-processor.ts:77-100`
- **Issue:** `fetchRecipients()` makes external HTTP calls to user-provided URLs with no timeout or retry logic.
- **Fix:** Add `AbortController` timeout and consider running in a separate worker.

### Minor (Nice to Have)

1. **Unused `Sequence` interface** in `sequence-processor.ts:9-13`
2. **Duplicate step completion logic** in `sequence-processor.ts` - extract to helper
3. **API source credentials stored in plaintext** in `recipient_data`
4. **Step order gaps not renumbered** when a step is deleted

## Recommendations

1. Add `luxon` for proper timezone handling across all scheduling features
2. Consider using `bree` or `bull` for more robust job scheduling with concurrency control
3. Add integration tests for recurring and sequence workflows
4. Add rate limiting on fetch operations for security
