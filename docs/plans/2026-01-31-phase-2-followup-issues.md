# Phase 2 Followup Issues

**Date:** January 31, 2026
**Phase:** Phase 2 - Scheduling Foundation
**Status:** Documented for future work

## Important Issues (Should Fix)

### 1. Missing Tests for Backup and Circuit-Breaker Services
- **Files:** `server/src/services/backup.ts`, `server/src/services/circuit-breaker.ts`
- **Issue:** No test files for these services; only `retry.test.ts` exists
- **Impact:** Backup/restore and circuit breaker are critical reliability features. Without tests, regressions could go undetected.
- **Fix:** Add `backup.test.ts` and `circuit-breaker.test.ts` covering:
  - Backup create/list/prune/restore
  - Circuit state transitions (open/close)
  - Cooldown expiry logic
  - DB persistence of circuit state

### 2. Signature Mismatch in `withRetry` Context Parameter
- **Files:** `server/src/services/retry.ts:63`, `server/src/routes/send.ts:232`
- **Issue:** Plan specifies `context: { accountId?: number; recipient?: string }`, but implementation uses `context: string`
- **Impact:** Less structured logging context; harder to query logs by accountId or recipient
- **Fix:** Update implementation to match plan's object signature, or document string format as intentional

### 3. Circuit Breaker `getOpenCircuits()` Logic
- **File:** `server/src/services/circuit-breaker.ts:182-200`
- **Issue:** Logic is convoluted with array includes check
- **Impact:** Minor performance issue and code clarity
- **Fix:** Use a `Set` instead of array, or simplify by just querying DB

### 4. Scheduled Campaign Queue Entry Date Truncation
- **File:** `server/src/routes/send.ts:106`
- **Issue:** `scheduledFor.split('T')[0]` truncates datetime to just date
- **Impact:** Could cause timing issues if queue processor expects full datetime
- **Fix:** Store consistent datetime format in both tables

### 5. Restore Backup Doesn't Reinitialize DB Connection
- **Files:** `server/src/services/backup.ts:164-176`, `server/src/routes/backups.ts:49-59`
- **Issue:** After restore, in-memory `db` object still references old file
- **Impact:** Queries after restore may return stale data until server restart
- **Fix:** Either force process exit, reinitialize db connection, or add explicit warning

## Minor Issues (Nice to Have)

### 1. Magic Numbers for Circuit Breaker
- **File:** `server/src/services/circuit-breaker.ts:5-6`
- **Issue:** `FAILURE_THRESHOLD = 5` and `COOLDOWN_MINUTES = 5` are hardcoded
- **Fix:** Make configurable via settings table

### 2. Inconsistent Default for retry_count
- **File:** `server/src/db/index.ts:111` vs migration at line 170
- **Issue:** Table creation uses `DEFAULT 1`, migration uses `'0'`
- **Fix:** Align both to same value

### 3. `createBackup` Return Type Deviation
- **File:** `server/src/services/backup.ts:26`
- **Issue:** Returns `string` (filename), plan specified `BackupInfo` object
- **Fix:** Consider if full info is needed by callers

### 4. Provider Type Widening
- **File:** `server/src/providers/index.ts:26`
- **Issue:** Changed from `type: 'gmail' | 'smtp'` to `type: string` for TS fix
- **Fix:** Keep original union type; fix caller to narrow type

### 5. No Validation of Cron Schedule Format in Settings API
- **File:** `server/src/routes/backups.ts:75-76`
- **Issue:** Schedule validated only as string type, not cron format
- **Fix:** Add `cron.validate(schedule)` check in route handler

## Recommendations

1. Add integration test for scheduled campaign flow
2. Consider adding jitter to retry delays (prevent thundering herd)
3. Add circuit breaker API endpoint for operational visibility
4. Document backup schedule cron format in API docs or UI
