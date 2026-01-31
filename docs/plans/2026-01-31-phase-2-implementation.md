# Phase 2: Scheduling Foundation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one-time scheduled sends, database backups, and retry improvements with circuit breaker.

**Architecture:** New scheduler and backup services using node-cron. Enhanced retry logic in account-manager.

**Tech Stack:** Bun, node-cron (already installed for queue), SQLite

---

## Task 1: Add Database Columns for Scheduling and Retry

**Files:**
- Modify: `server/src/db/index.ts`

**Step 1: Add new columns**

Use the existing `addColumnIfNotExists` helper:

```typescript
// In initializeDatabase(), add:
addColumnIfNotExists('send_logs', 'retry_count', 'INTEGER', '0')
addColumnIfNotExists('sender_accounts', 'circuit_breaker_until', 'DATETIME', '')
```

Note: `scheduled_for` and `status` columns were already added in Phase 1.

**Step 2: Create backups directory**

```typescript
mkdirSync(join(DATA_DIR, 'backups'), { recursive: true })
```

**Step 3: Commit**

```bash
git commit -m "feat: add retry_count and circuit_breaker columns for scheduling"
```

---

## Task 2: Create Backup Service

**Files:**
- Create: `server/src/services/backup.ts`

**Implementation:**

```typescript
import { copyFileSync, readdirSync, unlinkSync, statSync } from 'fs'
import { join, basename } from 'path'
import { db } from '../db'
import { logger } from '../lib/logger'

const DATA_DIR = join(process.cwd(), 'data')
const BACKUP_DIR = join(DATA_DIR, 'backups')
const DB_PATH = join(DATA_DIR, 'mailer.db')

interface BackupInfo {
  filename: string
  path: string
  size: number
  createdAt: Date
}

// Create a backup
export function createBackup(): BackupInfo {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const filename = `mailer_${timestamp}.db`
  const backupPath = join(BACKUP_DIR, filename)
  
  // Close any active connections (Bun SQLite handles this)
  copyFileSync(DB_PATH, backupPath)
  
  const stats = statSync(backupPath)
  logger.info('Backup created', { filename, size: stats.size, service: 'backup' })
  
  return {
    filename,
    path: backupPath,
    size: stats.size,
    createdAt: new Date()
  }
}

// List existing backups
export function listBackups(): BackupInfo[] {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('mailer_') && f.endsWith('.db'))
      .map(filename => {
        const path = join(BACKUP_DIR, filename)
        const stats = statSync(path)
        return {
          filename,
          path,
          size: stats.size,
          createdAt: stats.mtime
        }
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    return files
  } catch {
    return []
  }
}

// Delete old backups beyond retention limit
export function pruneBackups(keepCount: number = 7): number {
  const backups = listBackups()
  let deleted = 0
  
  if (backups.length > keepCount) {
    const toDelete = backups.slice(keepCount)
    for (const backup of toDelete) {
      try {
        unlinkSync(backup.path)
        deleted++
        logger.info('Old backup deleted', { filename: backup.filename, service: 'backup' })
      } catch (err) {
        logger.warn('Failed to delete backup', { filename: backup.filename, service: 'backup' }, err as Error)
      }
    }
  }
  
  return deleted
}

// Restore from backup
export function restoreBackup(filename: string): boolean {
  const backupPath = join(BACKUP_DIR, filename)
  
  try {
    // Verify backup exists
    statSync(backupPath)
    
    // Copy backup over current DB
    copyFileSync(backupPath, DB_PATH)
    
    logger.info('Database restored from backup', { filename, service: 'backup' })
    return true
  } catch (err) {
    logger.error('Failed to restore backup', { filename, service: 'backup' }, err as Error)
    return false
  }
}

// Get backup settings from DB
export function getBackupSettings(): { schedule: string; retention: number } {
  try {
    const schedule = db.query("SELECT value FROM settings WHERE key = 'backup_schedule'").get() as any
    const retention = db.query("SELECT value FROM settings WHERE key = 'backup_retention'").get() as any
    
    return {
      schedule: schedule?.value || '0 2 * * *', // Daily at 2 AM
      retention: parseInt(retention?.value || '7', 10)
    }
  } catch {
    return { schedule: '0 2 * * *', retention: 7 }
  }
}

// Save backup settings
export function saveBackupSettings(schedule: string, retention: number): void {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_schedule', ?)", [schedule])
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_retention', ?)", [String(retention)])
}
```

**Step 4: Commit**

```bash
git commit -m "feat: add backup service with create, list, prune, restore"
```

---

## Task 3: Create Scheduler Service

**Files:**
- Create: `server/src/services/scheduler.ts`

**Implementation:**

```typescript
import cron from 'node-cron'
import { db } from '../db'
import { logger } from '../lib/logger'
import { createBackup, pruneBackups, getBackupSettings } from './backup'

let scheduledCampaignJob: cron.ScheduledTask | null = null
let backupJob: cron.ScheduledTask | null = null

// Check for scheduled campaigns every minute
function checkScheduledCampaigns(): void {
  const now = new Date().toISOString()
  
  try {
    const campaigns = db.query(`
      SELECT id, name, subject, template_id, recipients, cc, bcc
      FROM campaigns 
      WHERE status = 'scheduled' 
        AND scheduled_for <= ?
    `).all(now) as any[]
    
    for (const campaign of campaigns) {
      logger.info('Triggering scheduled campaign', { 
        campaignId: campaign.id, 
        name: campaign.name,
        service: 'scheduler' 
      })
      
      // Update status to sending
      db.run("UPDATE campaigns SET status = 'sending', started_at = CURRENT_TIMESTAMP WHERE id = ?", [campaign.id])
      
      // The actual sending will be handled by the existing queue processor
      // or we trigger it here - depends on architecture choice
      // For now, mark as ready for the queue processor to pick up
    }
    
    if (campaigns.length > 0) {
      logger.info('Processed scheduled campaigns', { count: campaigns.length, service: 'scheduler' })
    }
  } catch (err) {
    logger.error('Failed to check scheduled campaigns', { service: 'scheduler' }, err as Error)
  }
}

// Run backup and prune
function runScheduledBackup(): void {
  try {
    const settings = getBackupSettings()
    createBackup()
    pruneBackups(settings.retention)
  } catch (err) {
    logger.error('Scheduled backup failed', { service: 'scheduler' }, err as Error)
  }
}

// Start scheduler
export function startScheduler(): void {
  // Check for scheduled campaigns every minute
  scheduledCampaignJob = cron.schedule('* * * * *', checkScheduledCampaigns)
  logger.info('Campaign scheduler started', { interval: 'every minute', service: 'scheduler' })
  
  // Run backup on schedule
  const backupSettings = getBackupSettings()
  backupJob = cron.schedule(backupSettings.schedule, runScheduledBackup)
  logger.info('Backup scheduler started', { schedule: backupSettings.schedule, service: 'scheduler' })
  
  // Check for any campaigns that were 'sending' when server restarted
  resumeInterruptedCampaigns()
}

// Resume campaigns that were interrupted by server restart
function resumeInterruptedCampaigns(): void {
  try {
    const interrupted = db.query(`
      SELECT id, name FROM campaigns WHERE status = 'sending'
    `).all() as any[]
    
    if (interrupted.length > 0) {
      logger.warn('Found interrupted campaigns', { 
        count: interrupted.length, 
        ids: interrupted.map(c => c.id),
        service: 'scheduler' 
      })
      // These will be picked up by the queue processor
    }
  } catch (err) {
    logger.error('Failed to check interrupted campaigns', { service: 'scheduler' }, err as Error)
  }
}

// Stop scheduler
export function stopScheduler(): void {
  if (scheduledCampaignJob) {
    scheduledCampaignJob.stop()
    scheduledCampaignJob = null
  }
  if (backupJob) {
    backupJob.stop()
    backupJob = null
  }
  logger.info('Scheduler stopped', { service: 'scheduler' })
}

// Restart backup job with new schedule
export function updateBackupSchedule(schedule: string): void {
  if (backupJob) {
    backupJob.stop()
  }
  backupJob = cron.schedule(schedule, runScheduledBackup)
  logger.info('Backup schedule updated', { schedule, service: 'scheduler' })
}
```

**Step 5: Commit**

```bash
git commit -m "feat: add scheduler service for campaigns and backups"
```

---

## Task 4: Integrate Scheduler into Server

**Files:**
- Modify: `server/src/index.ts`

**Changes:**

```typescript
import { startScheduler } from './services/scheduler'

// After startQueueProcessor(), add:
startScheduler()
```

**Commit:**

```bash
git commit -m "feat: integrate scheduler into server startup"
```

---

## Task 5: Create Retry Logic with Exponential Backoff

**Files:**
- Create: `server/src/services/retry.ts`

**Implementation:**

```typescript
import { logger } from '../lib/logger'

interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  retryableErrors: string[]
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', '5xx']
}

export function isRetryableError(error: any, config: RetryConfig = DEFAULT_CONFIG): boolean {
  const code = error.code || ''
  const status = error.responseCode || error.status || 0
  
  // Check error codes
  if (config.retryableErrors.includes(code)) {
    return true
  }
  
  // Check 5xx status
  if (config.retryableErrors.includes('5xx') && status >= 500 && status < 600) {
    return true
  }
  
  return false
}

export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_CONFIG): number {
  // Exponential backoff: baseDelay * 2^attempt
  const delay = config.baseDelay * Math.pow(2, attempt - 1)
  return Math.min(delay, config.maxDelay)
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  context: { accountId?: number; recipient?: string },
  config: RetryConfig = DEFAULT_CONFIG
): Promise<{ success: boolean; result?: T; error?: Error; attempts: number }> {
  let lastError: Error | undefined
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation()
      return { success: true, result, attempts: attempt }
    } catch (err) {
      lastError = err as Error
      
      if (!isRetryableError(err, config) || attempt === config.maxAttempts) {
        logger.warn('Operation failed (not retrying)', {
          ...context,
          attempt,
          error: lastError.message,
          service: 'retry'
        })
        return { success: false, error: lastError, attempts: attempt }
      }
      
      const delay = calculateDelay(attempt, config)
      logger.debug('Retrying operation', {
        ...context,
        attempt,
        nextAttempt: attempt + 1,
        delay,
        error: lastError.message,
        service: 'retry'
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return { success: false, error: lastError, attempts: config.maxAttempts }
}

export { RetryConfig, DEFAULT_CONFIG }
```

**Commit:**

```bash
git commit -m "feat: add retry service with exponential backoff"
```

---

## Task 6: Create Circuit Breaker

**Files:**
- Create: `server/src/services/circuit-breaker.ts`

**Implementation:**

```typescript
import { db } from '../db'
import { logger } from '../lib/logger'

const FAILURE_THRESHOLD = 5
const COOLDOWN_MINUTES = 5

interface CircuitState {
  failures: number
  lastFailure: Date | null
  isOpen: boolean
  openUntil: Date | null
}

// In-memory state per account
const circuitStates: Map<number, CircuitState> = new Map()

export function getCircuitState(accountId: number): CircuitState {
  if (!circuitStates.has(accountId)) {
    // Load from DB if exists
    const row = db.query(
      'SELECT circuit_breaker_until FROM sender_accounts WHERE id = ?'
    ).get(accountId) as any
    
    const openUntil = row?.circuit_breaker_until ? new Date(row.circuit_breaker_until) : null
    const isOpen = openUntil ? openUntil > new Date() : false
    
    circuitStates.set(accountId, {
      failures: 0,
      lastFailure: null,
      isOpen,
      openUntil
    })
  }
  
  return circuitStates.get(accountId)!
}

export function isCircuitOpen(accountId: number): boolean {
  const state = getCircuitState(accountId)
  
  // Check if cooldown has passed
  if (state.isOpen && state.openUntil && state.openUntil <= new Date()) {
    closeCircuit(accountId)
    return false
  }
  
  return state.isOpen
}

export function recordSuccess(accountId: number): void {
  const state = getCircuitState(accountId)
  state.failures = 0
  state.lastFailure = null
  
  // If circuit was open, close it
  if (state.isOpen) {
    closeCircuit(accountId)
  }
}

export function recordFailure(accountId: number): boolean {
  const state = getCircuitState(accountId)
  state.failures++
  state.lastFailure = new Date()
  
  if (state.failures >= FAILURE_THRESHOLD) {
    openCircuit(accountId)
    return true // Circuit opened
  }
  
  return false
}

function openCircuit(accountId: number): void {
  const state = getCircuitState(accountId)
  const openUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000)
  
  state.isOpen = true
  state.openUntil = openUntil
  
  // Persist to DB
  db.run(
    'UPDATE sender_accounts SET circuit_breaker_until = ? WHERE id = ?',
    [openUntil.toISOString(), accountId]
  )
  
  logger.warn('Circuit breaker opened', {
    accountId,
    failures: state.failures,
    cooldownMinutes: COOLDOWN_MINUTES,
    openUntil: openUntil.toISOString(),
    service: 'circuit-breaker'
  })
}

function closeCircuit(accountId: number): void {
  const state = getCircuitState(accountId)
  
  state.isOpen = false
  state.openUntil = null
  state.failures = 0
  
  // Clear in DB
  db.run(
    'UPDATE sender_accounts SET circuit_breaker_until = NULL WHERE id = ?',
    [accountId]
  )
  
  logger.info('Circuit breaker closed', { accountId, service: 'circuit-breaker' })
}

export function getOpenCircuits(): number[] {
  const openIds: number[] = []
  
  for (const [accountId, state] of circuitStates) {
    if (isCircuitOpen(accountId)) {
      openIds.push(accountId)
    }
  }
  
  return openIds
}
```

**Commit:**

```bash
git commit -m "feat: add circuit breaker for account failure handling"
```

---

## Task 7: Integrate Retry and Circuit Breaker into Send Flow

**Files:**
- Modify: `server/src/routes/send.ts`

**Changes:**

Import the new modules:
```typescript
import { withRetry } from '../services/retry'
import { isCircuitOpen, recordSuccess, recordFailure } from '../services/circuit-breaker'
```

In the account selection, check circuit breaker:
```typescript
// Skip accounts with open circuit
if (isCircuitOpen(account.id)) {
  logger.debug('Skipping account (circuit open)', { accountId: account.id })
  continue
}
```

Wrap the send call with retry:
```typescript
const result = await withRetry(
  () => provider.send({ to, cc, bcc, subject, html, attachments }),
  { accountId: account.id, recipient: recipient.email }
)

if (result.success) {
  recordSuccess(account.id)
  // Log success...
} else {
  const circuitOpened = recordFailure(account.id)
  if (circuitOpened) {
    // Switch to next account
  }
  // Log failure with result.attempts...
}
```

Update send_logs to include retry_count.

**Commit:**

```bash
git commit -m "feat: integrate retry and circuit breaker into send flow"
```

---

## Task 8: Create Backup API Routes

**Files:**
- Create: `server/src/routes/backups.ts`
- Modify: `server/src/index.ts`

**Implementation:**

```typescript
import { Router } from 'express'
import { 
  createBackup, 
  listBackups, 
  restoreBackup, 
  getBackupSettings, 
  saveBackupSettings 
} from '../services/backup'
import { updateBackupSchedule } from '../services/scheduler'
import { logger } from '../lib/logger'

export const backupsRouter = Router()

// GET /api/backups - List backups
backupsRouter.get('/', (req, res) => {
  try {
    const backups = listBackups()
    const settings = getBackupSettings()
    res.json({ backups, settings })
  } catch (err) {
    logger.error('Failed to list backups', { requestId: (req as any).requestId }, err as Error)
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

// POST /api/backups - Create backup
backupsRouter.post('/', (req, res) => {
  try {
    const backup = createBackup()
    res.status(201).json(backup)
  } catch (err) {
    logger.error('Failed to create backup', { requestId: (req as any).requestId }, err as Error)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// POST /api/backups/:filename/restore - Restore from backup
backupsRouter.post('/:filename/restore', (req, res) => {
  const { filename } = req.params
  
  try {
    const success = restoreBackup(filename)
    if (success) {
      res.json({ message: 'Database restored successfully. Restart server to apply changes.' })
    } else {
      res.status(404).json({ error: 'Backup not found or restore failed' })
    }
  } catch (err) {
    logger.error('Failed to restore backup', { requestId: (req as any).requestId, filename }, err as Error)
    res.status(500).json({ error: 'Failed to restore backup' })
  }
})

// PUT /api/backups/settings - Update backup settings
backupsRouter.put('/settings', (req, res) => {
  const { schedule, retention } = req.body
  
  if (!schedule || typeof retention !== 'number') {
    return res.status(400).json({ error: 'schedule and retention required' })
  }
  
  try {
    saveBackupSettings(schedule, retention)
    updateBackupSchedule(schedule)
    res.json({ schedule, retention })
  } catch (err) {
    logger.error('Failed to update backup settings', { requestId: (req as any).requestId }, err as Error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})
```

Register in index.ts:
```typescript
import { backupsRouter } from './routes/backups'
app.use('/api/backups', authMiddleware, backupsRouter)
```

**Commit:**

```bash
git commit -m "feat: add backup API routes"
```

---

## Task 9: Update Send Route for Scheduled Campaigns

**Files:**
- Modify: `server/src/routes/send.ts`

**Changes:**

Accept `scheduledFor` parameter and save to campaign:
```typescript
const { templateId, subject, recipients, cc, bcc, name, scheduledFor } = validation.data

// If scheduled, don't send immediately
if (scheduledFor) {
  const campaign = db.query(`
    INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, scheduled_for)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)
    RETURNING *
  `).get(name, templateId, subject, recipients.length, JSON.stringify(cc), JSON.stringify(bcc), scheduledFor)
  
  return res.json({
    campaignId: campaign.id,
    status: 'scheduled',
    scheduledFor
  })
}

// Otherwise, proceed with immediate send...
```

**Commit:**

```bash
git commit -m "feat: support scheduled campaigns in send route"
```

---

## Task 10: Build and Verify

**Step 1: Build**

```bash
bun run build
```

**Step 2: Verify new endpoints**

- GET /api/backups
- POST /api/backups
- POST /api/backups/:filename/restore
- PUT /api/backups/settings

**Step 3: Commit any fixes**

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `server/src/db/index.ts` | Modify | Add retry_count, circuit_breaker columns |
| `server/src/services/backup.ts` | Create | Backup create/list/restore/prune |
| `server/src/services/scheduler.ts` | Create | Cron jobs for campaigns and backups |
| `server/src/services/retry.ts` | Create | Exponential backoff retry logic |
| `server/src/services/circuit-breaker.ts` | Create | Per-account circuit breaker |
| `server/src/routes/backups.ts` | Create | Backup API endpoints |
| `server/src/routes/send.ts` | Modify | Add retry, circuit breaker, scheduling |
| `server/src/index.ts` | Modify | Register scheduler and backup routes |
