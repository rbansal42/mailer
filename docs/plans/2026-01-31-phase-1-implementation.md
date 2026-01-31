# Phase 1: Quick Wins + Foundation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add CC/BCC support, smart attachment matching, input validation, error logging, and enhanced health checks.

**Architecture:** Extend existing Express routes and services. Add Zod for validation, structured logging, and file upload handling with ZIP extraction.

**Tech Stack:** Bun, Express, SQLite, Zod, AdmZip, Multer

---

## Task 1: Add Zod for Input Validation

**Files:**
- Create: `server/src/lib/validation.ts`
- Modify: `server/package.json`

**Step 1: Install Zod**

Run: `bun add zod`
Expected: Package added to dependencies

**Step 2: Create validation schemas file**

```typescript
// server/src/lib/validation.ts
import { z } from 'zod'

// Email validation (RFC 5322 simplified)
export const emailSchema = z.string().email('Invalid email format')

export const emailArraySchema = z.array(emailSchema).default([])

// Template block schema
export const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['header', 'text', 'image', 'button', 'divider', 'spacer', 'columns', 'footer']),
  props: z.record(z.unknown())
})

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  blocks: z.array(blockSchema).default([])
})

export const updateTemplateSchema = createTemplateSchema.partial()

// Account schemas
export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  provider_type: z.enum(['gmail', 'smtp']),
  config: z.object({
    email: z.string().email(),
    // Gmail
    appPassword: z.string().optional(),
    // SMTP
    host: z.string().optional(),
    port: z.number().optional(),
    secure: z.boolean().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
    fromName: z.string().optional()
  }),
  daily_cap: z.number().int().min(1).max(10000).default(500),
  campaign_cap: z.number().int().min(1).max(5000).default(100),
  priority: z.number().int().min(0).default(0)
})

// Draft schemas
export const createDraftSchema = z.object({
  name: z.string().min(1).max(200),
  template_id: z.number().int().positive().optional(),
  subject: z.string().max(500).optional(),
  recipients: z.string().optional(), // JSON string of recipients
  variables: z.string().optional(),  // JSON string
  cc: emailArraySchema,
  bcc: emailArraySchema
})

export const updateDraftSchema = createDraftSchema.partial()

// Send schema
export const sendCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template_id: z.number().int().positive(),
  subject: z.string().min(1).max(500),
  recipients: z.array(z.object({
    email: emailSchema,
    data: z.record(z.string()).optional()
  })).min(1, 'At least one recipient required'),
  cc: emailArraySchema,
  bcc: emailArraySchema,
  scheduled_for: z.string().datetime().optional()
})

// Validation helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}
```

**Step 3: Commit**

```bash
git add server/package.json bun.lock server/src/lib/validation.ts
git commit -m "feat: add Zod validation schemas for all API endpoints"
```

---

## Task 2: Add Structured Logging

**Files:**
- Create: `server/src/lib/logger.ts`
- Modify: `server/src/index.ts`

**Step 1: Create logger module**

```typescript
// server/src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  requestId?: string
  service?: string
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: { code?: string; message: string; stack?: string }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  }

  if (error) {
    entry.error = {
      code: (error as any).code,
      message: error.message,
      stack: level === 'error' ? error.stack : undefined
    }
  }

  const output = formatEntry(entry)
  
  if (level === 'error') {
    console.error(output)
  } else if (level === 'warn') {
    console.warn(output)
  } else {
    console.log(output)
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext, error?: Error) => log('warn', message, context, error),
  error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error)
}

// Request ID middleware
let requestCounter = 0

export function requestIdMiddleware(req: any, res: any, next: any): void {
  requestCounter++
  req.requestId = `req_${Date.now()}_${requestCounter}`
  res.setHeader('X-Request-ID', req.requestId)
  next()
}

// Request logging middleware
export function requestLogMiddleware(req: any, res: any, next: any): void {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration
    })
  })
  
  next()
}
```

**Step 2: Integrate logger into server**

Modify `server/src/index.ts` - add after cors middleware:

```typescript
import { requestIdMiddleware, requestLogMiddleware, logger } from './lib/logger'

// Add after app.use(cors())
app.use(requestIdMiddleware)
app.use(requestLogMiddleware)
```

Also update the startup log:

```typescript
// Change console.log to logger.info
logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' })
```

**Step 3: Commit**

```bash
git add server/src/lib/logger.ts server/src/index.ts
git commit -m "feat: add structured JSON logging with request correlation"
```

---

## Task 3: Enhanced Health Check Endpoint

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/db/index.ts`

**Step 1: Add database health check function**

Add to `server/src/db/index.ts`:

```typescript
export function checkDatabaseHealth(): { ok: boolean; latencyMs: number } {
  const start = Date.now()
  try {
    db.query('SELECT 1').get()
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}
```

**Step 2: Update health endpoint in server/src/index.ts**

Replace the existing health check:

```typescript
import { checkDatabaseHealth } from './db'
import { existsSync, statSync } from 'fs'
import { join } from 'path'

// Health check (no auth)
app.get('/api/health', (_, res) => {
  const dbHealth = checkDatabaseHealth()
  
  // Check disk space (data directory)
  const dataDir = join(process.cwd(), 'data')
  let diskOk = true
  let diskInfo = {}
  try {
    if (existsSync(dataDir)) {
      const stats = statSync(dataDir)
      diskInfo = { exists: true }
    }
  } catch {
    diskOk = false
  }
  
  // Check queue status
  let queuePending = 0
  try {
    const result = db.query("SELECT COUNT(*) as count FROM email_queue WHERE status = 'pending'").get() as any
    queuePending = result?.count || 0
  } catch {
    // Queue table might not exist yet
  }
  
  // Check accounts
  let accountsInfo = { total: 0, enabled: 0, atCap: 0 }
  try {
    const today = new Date().toISOString().split('T')[0]
    const accounts = db.query(`
      SELECT sa.id, sa.daily_cap, sa.enabled,
             COALESCE(sc.count, 0) as sent_today
      FROM sender_accounts sa
      LEFT JOIN send_counts sc ON sa.id = sc.account_id AND sc.date = ?
    `).all(today) as any[]
    
    accountsInfo.total = accounts.length
    accountsInfo.enabled = accounts.filter(a => a.enabled).length
    accountsInfo.atCap = accounts.filter(a => a.enabled && a.sent_today >= a.daily_cap).length
  } catch {
    // Tables might not exist yet
  }
  
  const allHealthy = dbHealth.ok && diskOk
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    checks: {
      database: { status: dbHealth.ok ? 'ok' : 'error', latencyMs: dbHealth.latencyMs },
      disk: { status: diskOk ? 'ok' : 'error', ...diskInfo },
      queue: { status: 'ok', pending: queuePending },
      accounts: { 
        status: 'ok',
        total: accountsInfo.total,
        enabled: accountsInfo.enabled,
        atCap: accountsInfo.atCap
      }
    }
  })
})
```

**Step 3: Commit**

```bash
git add server/src/index.ts server/src/db/index.ts
git commit -m "feat: enhance health check with database, disk, queue, and accounts status"
```

---

## Task 4: Add CC/BCC Database Columns

**Files:**
- Modify: `server/src/db/index.ts`

**Step 1: Add migration for CC/BCC columns**

In `server/src/db/index.ts`, add to the schema initialization:

```typescript
// Add CC/BCC columns to drafts (in the CREATE TABLE or via ALTER)
db.run(`
  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    template_id INTEGER REFERENCES templates(id),
    subject TEXT,
    recipients TEXT,
    variables TEXT,
    cc TEXT DEFAULT '[]',
    bcc TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Add CC/BCC columns to campaigns
db.run(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    template_id INTEGER REFERENCES templates(id),
    subject TEXT NOT NULL,
    total_recipients INTEGER NOT NULL,
    successful INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    queued INTEGER DEFAULT 0,
    cc TEXT DEFAULT '[]',
    bcc TEXT DEFAULT '[]',
    scheduled_for DATETIME,
    status TEXT DEFAULT 'draft',
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)
```

**Note:** Since SQLite doesn't easily support ALTER TABLE ADD COLUMN with defaults in all cases, we'll handle this with a migration check:

```typescript
// Migration helper - add columns if they don't exist
function addColumnIfNotExists(table: string, column: string, type: string, defaultValue: string) {
  try {
    const columns = db.query(`PRAGMA table_info(${table})`).all() as any[]
    if (!columns.find(c => c.name === column)) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT '${defaultValue}'`)
    }
  } catch (e) {
    // Column might already exist or table doesn't exist
  }
}

// In initializeDatabase(), after CREATE TABLE statements:
addColumnIfNotExists('drafts', 'cc', 'TEXT', '[]')
addColumnIfNotExists('drafts', 'bcc', 'TEXT', '[]')
addColumnIfNotExists('campaigns', 'cc', 'TEXT', '[]')
addColumnIfNotExists('campaigns', 'bcc', 'TEXT', '[]')
addColumnIfNotExists('campaigns', 'scheduled_for', 'DATETIME', '')
addColumnIfNotExists('campaigns', 'status', 'TEXT', 'draft')
```

**Step 2: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat: add CC/BCC columns to drafts and campaigns tables"
```

---

## Task 5: Update Drafts API with CC/BCC and Validation

**Files:**
- Modify: `server/src/routes/drafts.ts`

**Step 1: Read current drafts.ts**

Read the file to understand current implementation.

**Step 2: Add validation and CC/BCC support**

```typescript
// server/src/routes/drafts.ts
import { Router } from 'express'
import { db } from '../db'
import { createDraftSchema, updateDraftSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

export const draftsRouter = Router()

// GET all drafts
draftsRouter.get('/', (req, res) => {
  try {
    const drafts = db.query('SELECT * FROM drafts ORDER BY updated_at DESC').all()
    res.json(drafts.map(d => ({
      ...d,
      cc: JSON.parse((d as any).cc || '[]'),
      bcc: JSON.parse((d as any).bcc || '[]')
    })))
  } catch (error) {
    logger.error('Failed to fetch drafts', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch drafts' })
  }
})

// GET single draft
draftsRouter.get('/:id', (req, res) => {
  try {
    const draft = db.query('SELECT * FROM drafts WHERE id = ?').get(req.params.id) as any
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' })
    }
    res.json({
      ...draft,
      cc: JSON.parse(draft.cc || '[]'),
      bcc: JSON.parse(draft.bcc || '[]')
    })
  } catch (error) {
    logger.error('Failed to fetch draft', { requestId: (req as any).requestId, draftId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to fetch draft' })
  }
})

// POST create draft
draftsRouter.post('/', (req, res) => {
  const validation = validate(createDraftSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({ error: validation.error })
  }
  
  const { name, template_id, subject, recipients, variables, cc, bcc } = validation.data
  
  try {
    const result = db.query(`
      INSERT INTO drafts (name, template_id, subject, recipients, variables, cc, bcc)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      template_id || null,
      subject || null,
      recipients || null,
      variables || null,
      JSON.stringify(cc),
      JSON.stringify(bcc)
    )
    
    const draft = db.query('SELECT * FROM drafts WHERE id = ?').get(result.lastInsertRowid)
    logger.info('Draft created', { requestId: (req as any).requestId, draftId: result.lastInsertRowid })
    res.status(201).json(draft)
  } catch (error) {
    logger.error('Failed to create draft', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to create draft' })
  }
})

// PUT update draft
draftsRouter.put('/:id', (req, res) => {
  const validation = validate(updateDraftSchema, req.body)
  if (!validation.success) {
    return res.status(400).json({ error: validation.error })
  }
  
  const updates = validation.data
  const id = req.params.id
  
  try {
    const existing = db.query('SELECT * FROM drafts WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Draft not found' })
    }
    
    const fields: string[] = []
    const values: any[] = []
    
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.template_id !== undefined) { fields.push('template_id = ?'); values.push(updates.template_id) }
    if (updates.subject !== undefined) { fields.push('subject = ?'); values.push(updates.subject) }
    if (updates.recipients !== undefined) { fields.push('recipients = ?'); values.push(updates.recipients) }
    if (updates.variables !== undefined) { fields.push('variables = ?'); values.push(updates.variables) }
    if (updates.cc !== undefined) { fields.push('cc = ?'); values.push(JSON.stringify(updates.cc)) }
    if (updates.bcc !== undefined) { fields.push('bcc = ?'); values.push(JSON.stringify(updates.bcc)) }
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    
    db.query(`UPDATE drafts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    
    const draft = db.query('SELECT * FROM drafts WHERE id = ?').get(id)
    logger.info('Draft updated', { requestId: (req as any).requestId, draftId: id })
    res.json(draft)
  } catch (error) {
    logger.error('Failed to update draft', { requestId: (req as any).requestId, draftId: id }, error as Error)
    res.status(500).json({ error: 'Failed to update draft' })
  }
})

// DELETE draft
draftsRouter.delete('/:id', (req, res) => {
  try {
    const result = db.query('DELETE FROM drafts WHERE id = ?').run(req.params.id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Draft not found' })
    }
    logger.info('Draft deleted', { requestId: (req as any).requestId, draftId: req.params.id })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete draft', { requestId: (req as any).requestId, draftId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to delete draft' })
  }
})
```

**Step 3: Commit**

```bash
git add server/src/routes/drafts.ts
git commit -m "feat: add CC/BCC support and Zod validation to drafts API"
```

---

## Task 6: Update Email Providers with CC/BCC

**Files:**
- Modify: `server/src/providers/base.ts`
- Modify: `server/src/providers/gmail.ts`
- Modify: `server/src/providers/smtp.ts`

**Step 1: Update base interface**

```typescript
// server/src/providers/base.ts
export interface SendOptions {
  to: string
  cc?: string[]
  bcc?: string[]
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    path: string
    contentType?: string
  }>
}

export interface EmailProvider {
  connect(): Promise<void>
  send(options: SendOptions): Promise<void>
  disconnect(): Promise<void>
  verify(): Promise<boolean>
}
```

**Step 2: Update Gmail provider**

```typescript
// In gmail.ts send method, update the mailOptions:
const mailOptions = {
  from: this.email,
  to: options.to,
  cc: options.cc?.join(', ') || undefined,
  bcc: options.bcc?.join(', ') || undefined,
  subject: options.subject,
  html: options.html,
  attachments: options.attachments
}
```

**Step 3: Update SMTP provider**

```typescript
// In smtp.ts send method, update the mailOptions:
const mailOptions = {
  from: `"${this.fromName}" <${this.fromEmail}>`,
  to: options.to,
  cc: options.cc?.join(', ') || undefined,
  bcc: options.bcc?.join(', ') || undefined,
  subject: options.subject,
  html: options.html,
  attachments: options.attachments
}
```

**Step 4: Commit**

```bash
git add server/src/providers/base.ts server/src/providers/gmail.ts server/src/providers/smtp.ts
git commit -m "feat: add CC/BCC and attachments support to email providers"
```

---

## Task 7: Update Send Route with CC/BCC

**Files:**
- Modify: `server/src/routes/send.ts`

**Step 1: Read current send.ts and understand structure**

**Step 2: Add CC/BCC to send logic**

Update the send route to:
1. Accept cc/bcc in request body
2. Pass them to the email provider
3. Store them in campaign record

Key changes:
```typescript
// In the send handler, extract cc/bcc from validated request
const { cc, bcc } = validation.data

// Store in campaign
db.query(`
  INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, started_at)
  VALUES (?, ?, ?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP)
`).run(name, template_id, subject, recipients.length, JSON.stringify(cc), JSON.stringify(bcc))

// When sending each email
await provider.send({
  to: recipient.email,
  cc,
  bcc,
  subject: compiledSubject,
  html: compiledHtml
})
```

**Step 3: Commit**

```bash
git add server/src/routes/send.ts
git commit -m "feat: add CC/BCC support to send route"
```

---

## Task 8: Create Attachments Database Schema

**Files:**
- Modify: `server/src/db/index.ts`

**Step 1: Add attachments tables**

```typescript
// Add to initializeDatabase()

db.run(`
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    draft_id INTEGER REFERENCES drafts(id),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    mime_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS recipient_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    draft_id INTEGER REFERENCES drafts(id),
    recipient_email TEXT NOT NULL,
    attachment_id INTEGER REFERENCES attachments(id),
    matched_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, recipient_email, attachment_id)
  )
`)

// Create attachments directory
import { mkdirSync } from 'fs'
mkdirSync(join(process.cwd(), 'data', 'attachments'), { recursive: true })
```

**Step 2: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat: add attachments and recipient_attachments tables"
```

---

## Task 9: Create Attachment Upload and Matching Service

**Files:**
- Create: `server/src/services/attachment-matcher.ts`
- Modify: `server/package.json` (add dependencies)

**Step 1: Install dependencies**

```bash
bun add adm-zip multer @types/multer
```

**Step 2: Create attachment matcher service**

```typescript
// server/src/services/attachment-matcher.ts
import AdmZip from 'adm-zip'
import { join, basename, extname } from 'path'
import { mkdirSync, existsSync, copyFileSync, statSync, readdirSync, rmSync } from 'fs'
import { db } from '../db'
import { logger } from '../lib/logger'

const ATTACHMENTS_DIR = join(process.cwd(), 'data', 'attachments')
const TEMP_DIR = join(process.cwd(), 'data', 'temp')

interface Recipient {
  email: string
  data: Record<string, string>
}

interface MatchResult {
  email: string
  attachmentId: number | null
  filename: string | null
  matchedBy: string | null
  error?: string
}

interface MatchConfig {
  mode: 'column' | 'explicit'
  column?: string // Column name to match against filename
}

// Normalize string for matching (lowercase, replace spaces with underscores)
function normalize(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '')
}

// Extract files from ZIP to temp directory
export function extractZip(zipPath: string, targetDir: string): string[] {
  const zip = new AdmZip(zipPath)
  mkdirSync(targetDir, { recursive: true })
  zip.extractAllTo(targetDir, true)
  
  // Get all extracted files (flatten nested directories)
  const files: string[] = []
  function walkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else if (!entry.name.startsWith('.')) {
        files.push(fullPath)
      }
    }
  }
  walkDir(targetDir)
  return files
}

// Store uploaded files and create attachment records
export function storeAttachments(
  files: Array<{ path: string; originalname: string }>,
  draftId?: number,
  campaignId?: number
): number[] {
  const sessionDir = join(ATTACHMENTS_DIR, `session_${Date.now()}`)
  mkdirSync(sessionDir, { recursive: true })
  
  const attachmentIds: number[] = []
  
  for (const file of files) {
    const filename = `${Date.now()}_${basename(file.originalname)}`
    const filepath = join(sessionDir, filename)
    
    copyFileSync(file.path, filepath)
    const stats = statSync(filepath)
    
    const result = db.query(`
      INSERT INTO attachments (draft_id, campaign_id, filename, original_filename, filepath, size_bytes, mime_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      draftId || null,
      campaignId || null,
      filename,
      file.originalname,
      filepath,
      stats.size,
      getMimeType(file.originalname)
    )
    
    attachmentIds.push(Number(result.lastInsertRowid))
  }
  
  return attachmentIds
}

// Match attachments to recipients
export function matchAttachments(
  attachmentIds: number[],
  recipients: Recipient[],
  config: MatchConfig,
  draftId?: number,
  campaignId?: number
): MatchResult[] {
  const attachments = db.query(`
    SELECT id, original_filename FROM attachments WHERE id IN (${attachmentIds.join(',')})
  `).all() as Array<{ id: number; original_filename: string }>
  
  const results: MatchResult[] = []
  
  for (const recipient of recipients) {
    let matched: { id: number; filename: string } | null = null
    let matchedBy: string | null = null
    
    if (config.mode === 'explicit') {
      // Look for 'attachment' column in recipient data
      const explicitFilename = recipient.data.attachment || recipient.data.Attachment
      if (explicitFilename) {
        const normalizedExplicit = normalize(explicitFilename)
        const attachment = attachments.find(a => 
          normalize(a.original_filename) === normalizedExplicit ||
          normalize(basename(a.original_filename, extname(a.original_filename))) === normalizedExplicit
        )
        if (attachment) {
          matched = { id: attachment.id, filename: attachment.original_filename }
          matchedBy = 'explicit:attachment'
        }
      }
    } else if (config.mode === 'column' && config.column) {
      // Match by column value in filename
      const columnValue = recipient.data[config.column]
      if (columnValue) {
        const normalizedValue = normalize(columnValue)
        const attachment = attachments.find(a => {
          const normalizedFilename = normalize(a.original_filename)
          return normalizedFilename.includes(normalizedValue)
        })
        if (attachment) {
          matched = { id: attachment.id, filename: attachment.original_filename }
          matchedBy = `column:${config.column}`
        }
      }
    }
    
    if (matched) {
      // Store the mapping
      try {
        db.query(`
          INSERT OR REPLACE INTO recipient_attachments 
          (draft_id, campaign_id, recipient_email, attachment_id, matched_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(draftId || null, campaignId || null, recipient.email, matched.id, matchedBy)
      } catch (e) {
        logger.warn('Failed to store recipient attachment mapping', { 
          email: recipient.email, 
          attachmentId: matched.id 
        })
      }
    }
    
    results.push({
      email: recipient.email,
      attachmentId: matched?.id || null,
      filename: matched?.filename || null,
      matchedBy
    })
  }
  
  return results
}

// Get attachment for a specific recipient
export function getRecipientAttachment(
  recipientEmail: string,
  draftId?: number,
  campaignId?: number
): { filepath: string; filename: string } | null {
  const mapping = db.query(`
    SELECT a.filepath, a.original_filename as filename
    FROM recipient_attachments ra
    JOIN attachments a ON ra.attachment_id = a.id
    WHERE ra.recipient_email = ?
      AND (ra.draft_id = ? OR ra.campaign_id = ?)
    LIMIT 1
  `).get(recipientEmail, draftId || null, campaignId || null) as any
  
  return mapping || null
}

// Helper to get MIME type from filename
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// Cleanup temp files
export function cleanupTempFiles(dir: string): void {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  } catch (e) {
    logger.warn('Failed to cleanup temp files', { dir })
  }
}

// Get match summary for preview
export function getMatchSummary(
  results: MatchResult[]
): { matched: number; unmatched: number; unmatchedRecipients: string[] } {
  const matched = results.filter(r => r.attachmentId !== null).length
  const unmatched = results.filter(r => r.attachmentId === null)
  
  return {
    matched,
    unmatched: unmatched.length,
    unmatchedRecipients: unmatched.map(r => r.email)
  }
}
```

**Step 3: Commit**

```bash
git add server/package.json bun.lock server/src/services/attachment-matcher.ts
git commit -m "feat: add attachment matching service with ZIP extraction"
```

---

## Task 10: Create Attachments API Routes

**Files:**
- Create: `server/src/routes/attachments.ts`
- Modify: `server/src/index.ts`

**Step 1: Create attachments router**

```typescript
// server/src/routes/attachments.ts
import { Router } from 'express'
import multer from 'multer'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { db } from '../db'
import { logger } from '../lib/logger'
import { 
  extractZip, 
  storeAttachments, 
  matchAttachments, 
  getMatchSummary,
  cleanupTempFiles 
} from '../services/attachment-matcher'

export const attachmentsRouter = Router()

const TEMP_DIR = join(process.cwd(), 'data', 'temp')
mkdirSync(TEMP_DIR, { recursive: true })

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = join(TEMP_DIR, `upload_${Date.now()}`)
    mkdirSync(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 500 // Max 500 files
  }
})

// POST /api/attachments/upload - Upload files (ZIP, multiple files, or folder)
attachmentsRouter.post('/upload', upload.array('files', 500), async (req, res) => {
  const files = req.files as Express.Multer.File[]
  const draftId = req.body.draft_id ? parseInt(req.body.draft_id) : undefined
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }
  
  try {
    let allFiles: Array<{ path: string; originalname: string }> = []
    
    for (const file of files) {
      if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
        // Extract ZIP file
        const extractDir = join(TEMP_DIR, `extract_${Date.now()}`)
        const extractedPaths = extractZip(file.path, extractDir)
        allFiles.push(...extractedPaths.map(p => ({
          path: p,
          originalname: p.split('/').pop() || p
        })))
      } else {
        allFiles.push({ path: file.path, originalname: file.originalname })
      }
    }
    
    const attachmentIds = storeAttachments(allFiles, draftId)
    
    // Cleanup temp files
    for (const file of files) {
      cleanupTempFiles(file.destination)
    }
    
    logger.info('Attachments uploaded', { 
      requestId: (req as any).requestId,
      count: attachmentIds.length,
      draftId 
    })
    
    res.json({
      success: true,
      count: attachmentIds.length,
      attachmentIds
    })
  } catch (error) {
    logger.error('Failed to upload attachments', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to process uploaded files' })
  }
})

// POST /api/attachments/match - Match attachments to recipients
attachmentsRouter.post('/match', (req, res) => {
  const { attachmentIds, recipients, matchConfig, draftId, campaignId } = req.body
  
  if (!attachmentIds || !Array.isArray(attachmentIds)) {
    return res.status(400).json({ error: 'attachmentIds array required' })
  }
  if (!recipients || !Array.isArray(recipients)) {
    return res.status(400).json({ error: 'recipients array required' })
  }
  if (!matchConfig || !matchConfig.mode) {
    return res.status(400).json({ error: 'matchConfig with mode required' })
  }
  
  try {
    const results = matchAttachments(
      attachmentIds,
      recipients,
      matchConfig,
      draftId,
      campaignId
    )
    
    const summary = getMatchSummary(results)
    
    logger.info('Attachments matched', {
      requestId: (req as any).requestId,
      matched: summary.matched,
      unmatched: summary.unmatched
    })
    
    res.json({
      success: true,
      results,
      summary
    })
  } catch (error) {
    logger.error('Failed to match attachments', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to match attachments' })
  }
})

// GET /api/attachments/draft/:draftId - Get attachments for a draft
attachmentsRouter.get('/draft/:draftId', (req, res) => {
  try {
    const attachments = db.query(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM recipient_attachments ra WHERE ra.attachment_id = a.id) as match_count
      FROM attachments a
      WHERE a.draft_id = ?
      ORDER BY a.created_at DESC
    `).all(req.params.draftId)
    
    res.json(attachments)
  } catch (error) {
    logger.error('Failed to fetch draft attachments', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch attachments' })
  }
})

// GET /api/attachments/recipient-preview - Get attachment preview for a recipient
attachmentsRouter.get('/recipient-preview', (req, res) => {
  const { email, draftId, campaignId } = req.query
  
  if (!email) {
    return res.status(400).json({ error: 'email query parameter required' })
  }
  
  try {
    const mapping = db.query(`
      SELECT a.id, a.original_filename as filename, a.size_bytes, a.mime_type, ra.matched_by
      FROM recipient_attachments ra
      JOIN attachments a ON ra.attachment_id = a.id
      WHERE ra.recipient_email = ?
        AND (ra.draft_id = ? OR ra.campaign_id = ?)
    `).all(email, draftId || null, campaignId || null)
    
    res.json(mapping)
  } catch (error) {
    logger.error('Failed to fetch recipient attachment preview', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch attachment preview' })
  }
})

// DELETE /api/attachments/:id - Delete an attachment
attachmentsRouter.delete('/:id', (req, res) => {
  try {
    const attachment = db.query('SELECT * FROM attachments WHERE id = ?').get(req.params.id) as any
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' })
    }
    
    // Delete file
    const { unlinkSync } = require('fs')
    try {
      unlinkSync(attachment.filepath)
    } catch {
      // File might already be deleted
    }
    
    // Delete mappings
    db.query('DELETE FROM recipient_attachments WHERE attachment_id = ?').run(req.params.id)
    
    // Delete record
    db.query('DELETE FROM attachments WHERE id = ?').run(req.params.id)
    
    logger.info('Attachment deleted', { requestId: (req as any).requestId, attachmentId: req.params.id })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete attachment', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to delete attachment' })
  }
})
```

**Step 2: Register router in index.ts**

Add to `server/src/index.ts`:

```typescript
import { attachmentsRouter } from './routes/attachments'

// Add with other protected routes
app.use('/api/attachments', authMiddleware, attachmentsRouter)
```

**Step 3: Commit**

```bash
git add server/src/routes/attachments.ts server/src/index.ts
git commit -m "feat: add attachments API with upload, match, and preview endpoints"
```

---

## Task 11: Update Send Route to Include Matched Attachments

**Files:**
- Modify: `server/src/routes/send.ts`

**Step 1: Integrate attachment matching into send flow**

In the send route, when sending to each recipient:

```typescript
import { getRecipientAttachment } from '../services/attachment-matcher'

// In the send loop for each recipient:
const recipientAttachment = getRecipientAttachment(recipient.email, undefined, campaignId)

const attachments = recipientAttachment ? [{
  filename: recipientAttachment.filename,
  path: recipientAttachment.filepath
}] : undefined

await provider.send({
  to: recipient.email,
  cc,
  bcc,
  subject: compiledSubject,
  html: compiledHtml,
  attachments
})
```

**Step 2: Commit**

```bash
git add server/src/routes/send.ts
git commit -m "feat: integrate per-recipient attachments into send flow"
```

---

## Task 12: Add Validation to Remaining Routes

**Files:**
- Modify: `server/src/routes/templates.ts`
- Modify: `server/src/routes/accounts.ts`

**Step 1: Update templates route with validation**

Add Zod validation to POST/PUT endpoints using `createTemplateSchema` and `updateTemplateSchema`.

**Step 2: Update accounts route with validation**

Add Zod validation to POST/PUT endpoints using `createAccountSchema`.

**Step 3: Commit**

```bash
git add server/src/routes/templates.ts server/src/routes/accounts.ts
git commit -m "feat: add Zod validation to templates and accounts routes"
```

---

## Task 13: Build and Test

**Step 1: Build the server**

```bash
bun run build
```

Expected: Build succeeds with no errors

**Step 2: Start server and test health endpoint**

```bash
bun run dev:server &
sleep 2
curl http://localhost:3342/api/health | jq
```

Expected: JSON response with status "healthy" and all checks

**Step 3: Test validation (expect error)**

```bash
curl -X POST http://localhost:3342/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name": ""}' 
```

Expected: 401 (needs auth) or 400 with validation error

**Step 4: Stop server and commit any fixes**

---

## Task 14: Final Commit and Summary

**Step 1: Verify all changes**

```bash
git status
git log --oneline -10
```

**Step 2: Create summary commit if needed**

If there are any uncommitted changes:

```bash
git add -A
git commit -m "chore: phase 1 cleanup and fixes"
```

**Step 3: Document completion**

Phase 1 is complete with:
- Zod validation on all API endpoints
- Structured JSON logging with request correlation
- Enhanced health checks
- CC/BCC support in drafts, campaigns, and providers
- Smart attachment matching with ZIP/file/folder upload
- Per-recipient attachment preview

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `server/src/lib/validation.ts` | Create | Zod schemas for all endpoints |
| `server/src/lib/logger.ts` | Create | Structured logging with request IDs |
| `server/src/services/attachment-matcher.ts` | Create | ZIP extraction and matching logic |
| `server/src/routes/attachments.ts` | Create | Attachment upload/match API |
| `server/src/routes/drafts.ts` | Modify | Add CC/BCC and validation |
| `server/src/routes/send.ts` | Modify | Add CC/BCC and attachments |
| `server/src/routes/templates.ts` | Modify | Add validation |
| `server/src/routes/accounts.ts` | Modify | Add validation |
| `server/src/providers/base.ts` | Modify | Add CC/BCC/attachments interface |
| `server/src/providers/gmail.ts` | Modify | Implement CC/BCC/attachments |
| `server/src/providers/smtp.ts` | Modify | Implement CC/BCC/attachments |
| `server/src/db/index.ts` | Modify | Add new tables and columns |
| `server/src/index.ts` | Modify | Add logging middleware and routes |
| `server/package.json` | Modify | Add zod, adm-zip, multer |
