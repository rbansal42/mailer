# Phase 1: Follow-up Issues

**Date:** January 31, 2026  
**Source:** Code review of Phase 1 implementation  
**Priority:** Address before Phase 2 or during Phase 2 development

---

## Important Issues

### 1. SQL Injection Risk in Dynamic Query
**File:** `server/src/services/attachment-matcher.ts:443-445`

**Problem:** Dynamic WHERE clause construction is fragile:
```typescript
const whereClause = campaignId ? 'campaign_id = ?' : 'draft_id = ?'
db.query(`SELECT filepath FROM attachments WHERE ${whereClause}`)
```

**Fix:** Use explicit parameterized queries:
```typescript
const query = campaignId 
  ? 'SELECT filepath FROM attachments WHERE campaign_id = ?'
  : 'SELECT filepath FROM attachments WHERE draft_id = ?'
db.query(query).all(campaignId ?? draftId)
```

---

### 2. Missing File Type Validation
**File:** `server/src/routes/attachments.ts:30-33`

**Problem:** No MIME type whitelist on uploads. Design doc specifies "Allowed MIME types: configurable whitelist".

**Fix:** Add file filter to multer config:
```typescript
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv'
]

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 500 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
  }
})
```

---

### 3. Log Rotation Not Implemented
**File:** `server/src/lib/logger.ts`

**Problem:** Design doc specifies "Log rotation (daily, keep 14 days)" and "Separate error log file". Current implementation writes only to console.

**Fix Options:**
1. Add file transport with rotation (winston or pino)
2. Use external log aggregation (Docker logs → Loki/CloudWatch)
3. Simple file append with logrotate.d config

---

### 4. Disk Health Check Incomplete
**File:** `server/src/index.ts:36-45`

**Problem:** Design doc shows `"freeGb": 45.2` but implementation only checks if directory exists.

**Fix:** Use Node.js `fs.statfs` (Node 18.15+):
```typescript
import { statfs } from 'fs/promises'

const diskStats = await statfs(dataDir)
const freeGb = (diskStats.bfree * diskStats.bsize) / (1024 ** 3)
diskInfo = { exists: true, freeGb: Math.round(freeGb * 10) / 10 }
```

---

### 5. Memory Issue with Large File Counts
**File:** `server/src/routes/attachments.ts:64-67`

**Problem:** With 500 files allowed per upload + ZIP extraction, memory could spike with many large ZIPs.

**Fix Options:**
1. Add total extracted size limit (e.g., 100MB total)
2. Stream ZIP extraction instead of loading all at once
3. Process files in batches

---

## Minor Issues

### 6. Inconsistent Request ID Access
**Files:** Multiple routes use `(req as any).requestId`

**Fix:** Create `server/src/types/express.d.ts`:
```typescript
declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}
export {}
```

---

### 7. Magic Numbers
**Files:** `attachment-matcher.ts:184`, `send.ts:233`

**Fix:** Extract to named constants:
```typescript
const SEND_DELAY_MS = 300
const UNIQUE_FILENAME_SEPARATOR = '_'
```

---

### 8. Missing Database Index
**File:** `server/src/db/index.ts`

**Problem:** `recipient_attachments` lacks index on `recipient_email`.

**Fix:** Add after table creation:
```sql
CREATE INDEX IF NOT EXISTS idx_recipient_attachments_email 
  ON recipient_attachments(recipient_email)
```

---

### 9. updateAccountSchema Missing
**File:** `server/src/routes/accounts.ts:103`

**Problem:** PUT uses `createAccountSchema` requiring all fields.

**Fix:** In `validation.ts`:
```typescript
export const updateAccountSchema = createAccountSchema.partial()
```

Then use in accounts.ts PUT handler.

---

### 10. Silent Catch Blocks
**File:** `server/src/routes/attachments.ts:82-84`

**Problem:** Errors swallowed silently.

**Fix:** Add debug logging:
```typescript
try {
  unlinkSync(file.path)
} catch (err) {
  logger.debug('Failed to cleanup temp file', { path: file.path, error: (err as Error).message })
}
```

---

## Tracking

| Issue | Priority | Effort | Phase |
|-------|----------|--------|-------|
| SQL injection risk | High | 15 min | Before Phase 2 |
| File type validation | High | 30 min | Before Phase 2 |
| Log rotation | Medium | 2 hrs | Phase 2 |
| Disk health check | Medium | 30 min | Phase 2 |
| Memory limits | Medium | 1 hr | Phase 2 |
| Request ID types | Low | 15 min | Any |
| Magic numbers | Low | 15 min | Any |
| Database index | Low | 5 min | Before Phase 2 |
| updateAccountSchema | Low | 10 min | Any |
| Silent catch blocks | Low | 10 min | Any |
