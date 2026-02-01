# Turso Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from bun:sqlite to Turso cloud database for multi-instance deployment.

**Architecture:** Replace synchronous bun:sqlite calls with async @libsql/client calls. All database operations become async/await.

**Tech Stack:** @libsql/client, TypeScript, Express

---

## Phase 1: Core Database Setup

### Task 1.1: Add @libsql/client dependency

**Files:**
- Modify: `server/package.json`

**Steps:**

1. Run: `bun add @libsql/client` in server directory
2. Verify package.json has the dependency

---

### Task 1.2: Rewrite database connection module

**Files:**
- Modify: `server/src/db/index.ts`

**Changes:**

Replace the entire file with async Turso client:

```typescript
import { createClient, Client } from '@libsql/client'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

// Turso client - requires env vars
const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set')
}

export const db: Client = createClient({ url, authToken })

// Helper function for queries that return rows
export async function queryAll<T>(sql: string, args: any[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args })
  return result.rows as T[]
}

export async function queryOne<T>(sql: string, args: any[] = []): Promise<T | undefined> {
  const result = await db.execute({ sql, args })
  return result.rows[0] as T | undefined
}

export async function execute(sql: string, args: any[] = []): Promise<{ rowsAffected: number; lastInsertRowid: bigint | undefined }> {
  const result = await db.execute({ sql, args })
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid !== undefined ? BigInt(result.lastInsertRowid) : undefined
  }
}
```

**Note:** The initialization and migrations are handled separately in Task 1.3.

---

### Task 1.3: Rewrite database initialization as async

**Files:**
- Modify: `server/src/db/index.ts` (continuation)

**Add these async functions:**

```typescript
// Migration helper - add columns if they don't exist
async function addColumnIfNotExists(table: string, column: string, type: string, defaultValue: string) {
  try {
    const columns = await queryAll<{ name: string }>(`PRAGMA table_info(${table})`)
    if (!columns.find(c => c.name === column)) {
      await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT '${defaultValue}'`)
    }
  } catch (e) {
    // Column might already exist or table doesn't exist
  }
}

// Run SQL migrations from the migrations directory
async function runMigrations() {
  await execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const possiblePaths = [
    join(process.cwd(), 'src', 'db', 'migrations'),
    join(process.cwd(), 'server', 'src', 'db', 'migrations'),
    join(dirname(import.meta.path), 'migrations'),
  ]
  
  const migrationsDir = possiblePaths.find(p => existsSync(p))
  
  if (!migrationsDir || !existsSync(migrationsDir)) {
    return
  }

  const applied = new Set(
    (await queryAll<{ filename: string }>('SELECT filename FROM schema_migrations'))
      .map(r => r.filename)
  )

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue

    const filePath = join(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    
    const statements = content
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith('--'))
    
    try {
      for (const statement of statements) {
        await execute(statement)
      }
      await execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
      console.log(`Migration applied: ${file}`)
    } catch (err) {
      console.error(`Migration failed: ${file}`, err)
      throw err
    }
  }
}

// Initialize schema - NOW ASYNC
export async function initializeDatabase() {
  // Ensure local directories exist (for attachments, etc.)
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  // Create all tables...
  await execute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  
  await execute(`
    CREATE TABLE IF NOT EXISTS sender_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      config TEXT NOT NULL,
      daily_cap INTEGER DEFAULT 500,
      campaign_cap INTEGER DEFAULT 100,
      priority INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS send_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES sender_accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(account_id, date)
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      blocks TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      subject TEXT,
      recipients TEXT DEFAULT '[]',
      variables TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      total_recipients INTEGER NOT NULL,
      successful INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      queued INTEGER DEFAULT 0,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES sender_accounts(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER DEFAULT 1,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      recipient_email TEXT NOT NULL,
      recipient_data TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
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

  await execute(`
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

  await execute(`
    CREATE TABLE IF NOT EXISTS tracking_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      recipient_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(campaign_id, recipient_email)
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER REFERENCES tracking_tokens(id),
      event_type TEXT NOT NULL,
      link_url TEXT,
      link_index INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS scheduled_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id),
      scheduled_for DATETIME NOT NULL,
      recipient_emails TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS recurring_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      subject TEXT NOT NULL,
      recipient_source TEXT NOT NULL,
      recipient_data TEXT,
      schedule_cron TEXT NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      cc TEXT DEFAULT '[]',
      bcc TEXT DEFAULT '[]',
      enabled INTEGER DEFAULT 1,
      last_run_at DATETIME,
      next_run_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS certificate_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      colors TEXT NOT NULL,
      logos TEXT DEFAULT '[]',
      signatories TEXT DEFAULT '[]',
      title_text TEXT DEFAULT 'CERTIFICATE',
      subtitle_text TEXT DEFAULT 'of Participation',
      description_template TEXT DEFAULT 'For participating in {{title}} on {{date}}.',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS generated_certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id TEXT NOT NULL UNIQUE,
      config_id INTEGER REFERENCES certificate_configs(id),
      recipient_name TEXT NOT NULL,
      recipient_email TEXT,
      data TEXT DEFAULT '{}',
      pdf_path TEXT,
      campaign_id INTEGER REFERENCES campaigns(id),
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      subject TEXT NOT NULL,
      delay_days INTEGER NOT NULL,
      delay_hours INTEGER DEFAULT 0,
      send_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      recipient_email TEXT NOT NULL,
      recipient_data TEXT,
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_send_at DATETIME,
      completed_at DATETIME,
      UNIQUE(sequence_id, recipient_email)
    )
  `)

  // Create directories for local file storage
  mkdirSync(join(DATA_DIR, 'attachments'), { recursive: true })
  mkdirSync(join(DATA_DIR, 'backups'), { recursive: true })

  // Run column migrations
  await addColumnIfNotExists('drafts', 'cc', 'TEXT', '[]')
  await addColumnIfNotExists('drafts', 'bcc', 'TEXT', '[]')
  await addColumnIfNotExists('campaigns', 'cc', 'TEXT', '[]')
  await addColumnIfNotExists('campaigns', 'bcc', 'TEXT', '[]')
  await addColumnIfNotExists('campaigns', 'scheduled_for', 'DATETIME', '')
  await addColumnIfNotExists('campaigns', 'status', 'TEXT', 'draft')
  await addColumnIfNotExists('send_logs', 'retry_count', 'INTEGER', '0')
  await addColumnIfNotExists('sender_accounts', 'circuit_breaker_until', 'DATETIME', '')

  // Create indexes
  await execute('CREATE INDEX IF NOT EXISTS idx_send_counts_date ON send_counts(account_id, date)')
  await execute('CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON send_logs(campaign_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for)')
  await execute('CREATE INDEX IF NOT EXISTS idx_tracking_events_token ON tracking_events(token_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(event_type)')
  await execute('CREATE INDEX IF NOT EXISTS idx_tracking_tokens_token ON tracking_tokens(token)')
  await execute('CREATE INDEX IF NOT EXISTS idx_scheduled_batches_status ON scheduled_batches(status, scheduled_for)')
  await execute('CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON sequence_enrollments(next_send_at)')
  await execute('CREATE INDEX IF NOT EXISTS idx_enrollments_status ON sequence_enrollments(status)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sequence_steps_order ON sequence_steps(sequence_id, step_order)')
  await execute('CREATE INDEX IF NOT EXISTS idx_generated_certificates_id ON generated_certificates(certificate_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_generated_certificates_config ON generated_certificates(config_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_generated_certificates_campaign ON generated_certificates(campaign_id)')

  // Initialize default tracking settings
  const trackingDefaults = [
    ['tracking_enabled', 'true'],
    ['tracking_base_url', 'https://mailer.rbansal.xyz'],
    ['tracking_open_enabled', 'true'],
    ['tracking_click_enabled', 'true'],
    ['tracking_hash_ips', 'true'],
    ['tracking_retention_days', '90'],
  ]

  for (const [key, value] of trackingDefaults) {
    await execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }

  console.log('Database initialized')

  // Seed templates
  await seedTemplates()

  // Run SQL migrations
  await runMigrations()
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await db.execute('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

async function seedTemplates(): Promise<void> {
  const countResult = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM templates')
  
  if (countResult && countResult.count > 0) {
    return
  }

  console.log('Seeding starter templates...')

  // ... seed templates (same as before, but using await execute())
  const templates = [/* templates array - same as original */]
  
  // Template seeding handled by SQL migration or manual seeding
}
```

---

### Task 1.4: Add .env.example with Turso variables

**Files:**
- Create: `server/.env.example`

**Content:**
```
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

---

## Phase 2: Convert Routes to Async

Each route file needs these changes:
1. Import `queryAll`, `queryOne`, `execute` from `../db`
2. Make route handlers async
3. Replace `db.query().all()` with `await queryAll()`
4. Replace `db.query().get()` with `await queryOne()`
5. Replace `db.run()` with `await execute()`

### Task 2.1: Convert routes/templates.ts

**Files:**
- Modify: `server/src/routes/templates.ts`

**Pattern:**
```typescript
// Before
router.get('/', (req, res) => {
  const rows = db.query('SELECT * FROM templates').all() as TemplateRow[]
  res.json(rows.map(formatTemplate))
})

// After
router.get('/', async (req, res) => {
  const rows = await queryAll<TemplateRow>('SELECT * FROM templates ORDER BY updated_at DESC')
  res.json(rows.map(formatTemplate))
})
```

---

### Task 2.2: Convert routes/campaigns.ts

### Task 2.3: Convert routes/drafts.ts

### Task 2.4: Convert routes/settings.ts

### Task 2.5: Convert routes/send.ts

### Task 2.6: Convert routes/accounts.ts

### Task 2.7: Convert routes/analytics.ts

### Task 2.8: Convert routes/attachments.ts

### Task 2.9: Convert routes/auth.ts

### Task 2.10: Convert routes/certificates.ts

### Task 2.11: Convert routes/media.ts

### Task 2.12: Convert routes/queue.ts

### Task 2.13: Convert routes/recurring.ts

### Task 2.14: Convert routes/sequences.ts

---

## Phase 3: Convert Services to Async

### Task 3.1: Convert services/tracking.ts

### Task 3.2: Convert services/account-manager.ts

### Task 3.3: Convert services/attachment-matcher.ts

### Task 3.4: Convert services/backup.ts

**Special:** Remove SQLite-specific PRAGMA commands. Turso handles backups.

### Task 3.5: Convert services/circuit-breaker.ts

### Task 3.6: Convert services/queue-processor.ts

### Task 3.7: Convert services/recurring-processor.ts

### Task 3.8: Convert services/scheduler.ts

### Task 3.9: Convert services/sequence-processor.ts

### Task 3.10: Convert services/timezone-processor.ts

---

## Phase 4: Update Entry Point and Build

### Task 4.1: Update server entry point for async init

**Files:**
- Modify: `server/src/index.ts`

**Change:**
```typescript
// Before
initializeDatabase()
app.listen(PORT)

// After
async function main() {
  await initializeDatabase()
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}
main()
```

---

### Task 4.2: Verify build passes

Run: `bun run build`

Expected: Build succeeds with no TypeScript errors.

---

### Task 4.3: Create migration commit

```bash
git add -A
git commit -m "feat: migrate from bun:sqlite to Turso cloud database

- Replace bun:sqlite with @libsql/client
- Convert all database operations to async/await
- Add queryAll, queryOne, execute helper functions
- Update all routes and services for async database access
- Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars
- Simplify backup service (Turso handles backups)"
```

---

## Summary

| Phase | Tasks | Parallelizable |
|-------|-------|----------------|
| 1 | Core database (4 tasks) | No - must complete first |
| 2 | Routes (14 tasks) | Yes - all can run in parallel |
| 3 | Services (10 tasks) | Yes - all can run in parallel |
| 4 | Entry point + build (3 tasks) | No - must complete last |

**Total tasks:** 31
**Parallelizable:** 24 (Phase 2 + 3)
