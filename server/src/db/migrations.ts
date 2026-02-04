import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { execute, queryAll } from './client'
import { logger } from '../lib/logger'

// Whitelist of valid table names to prevent SQL injection
const VALID_TABLES = new Set([
  'settings',
  'sender_accounts',
  'send_counts',
  'templates',
  'mails',
  'drafts',
  'campaigns',
  'send_logs',
  'email_queue',
  'attachments',
  'recipient_attachments',
  'tracking_tokens',
  'tracking_events',
  'scheduled_batches',
  'recurring_campaigns',
  'certificate_configs',
  'generated_certificates',
  'sequences',
  'sequence_steps',
  'sequence_enrollments',
  'sequence_actions',
  'media',
  'contacts',
  'lists',
  'list_contacts',
  'suppression_list',
  'bounces',
  'google_sheets_syncs',
])

// Migration helper - add columns if they don't exist
async function addColumnIfNotExists(table: string, column: string, type: string, defaultValue: string) {
  // Validate table name against whitelist to prevent SQL injection
  if (!VALID_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`)
  }

  // Validate column name (alphanumeric and underscore only)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
    throw new Error(`Invalid column name: ${column}`)
  }

  try {
    const columns = await queryAll<any>(`PRAGMA table_info(${table})`)
    if (!columns.find(c => c.name === column)) {
      await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT '${defaultValue}'`)
    }
  } catch (e) {
    // Column might already exist or table doesn't exist
  }
}

// Run column migrations - add new columns to existing tables
export async function runColumnMigrations() {
  await addColumnIfNotExists('drafts', 'cc', 'TEXT', '[]')
  await addColumnIfNotExists('drafts', 'bcc', 'TEXT', '[]')
  await addColumnIfNotExists('drafts', 'mail_id', 'INTEGER', '')
  await addColumnIfNotExists('drafts', 'list_id', 'INTEGER', '')
  await addColumnIfNotExists('drafts', 'test_email', 'TEXT', '')
  await addColumnIfNotExists('drafts', 'recipients_text', 'TEXT', '')
  await addColumnIfNotExists('campaigns', 'cc', 'TEXT', '[]')
  await addColumnIfNotExists('campaigns', 'bcc', 'TEXT', '[]')
  await addColumnIfNotExists('campaigns', 'scheduled_for', 'DATETIME', '')
  await addColumnIfNotExists('campaigns', 'status', 'TEXT', 'draft')
  await addColumnIfNotExists('send_logs', 'retry_count', 'INTEGER', '0')
  await addColumnIfNotExists('sender_accounts', 'circuit_breaker_until', 'DATETIME', '')

  // Sequence branching columns
  await addColumnIfNotExists('sequence_steps', 'branch_id', 'TEXT', '')
  await addColumnIfNotExists('sequence_steps', 'is_branch_point', 'INTEGER', '0')
  await addColumnIfNotExists('sequence_steps', 'branch_order', 'INTEGER', '')
  await addColumnIfNotExists('sequence_enrollments', 'branch_id', 'TEXT', '')
  await addColumnIfNotExists('sequence_enrollments', 'action_clicked_at', 'TEXT', '')
  await addColumnIfNotExists('sequence_enrollments', 'branch_switched_at', 'TEXT', '')
  await addColumnIfNotExists('sequences', 'branch_delay_hours', 'INTEGER', '0')
}

// Run SQL migrations from the migrations directory (with tracking)
export async function runSqlMigrations() {
  // Create migrations tracking table if it doesn't exist
  await execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Try multiple possible locations for migrations
  const possiblePaths = [
    join(process.cwd(), 'src', 'db', 'migrations'),           // Running from server/
    join(process.cwd(), 'server', 'src', 'db', 'migrations'), // Running from root
    join(dirname(import.meta.path), 'migrations'),            // Relative to this file
  ]

  const migrationsDir = possiblePaths.find(p => existsSync(p))

  if (!migrationsDir || !existsSync(migrationsDir)) {
    return
  }

  // Get already applied migrations
  const appliedRows = await queryAll<{ filename: string }>('SELECT filename FROM schema_migrations')
  const applied = new Set(appliedRows.map(r => r.filename))

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    // Skip if already applied
    if (applied.has(file)) {
      continue
    }

    const filePath = join(migrationsDir, file)
    const content = readFileSync(filePath, 'utf-8')

    // Split by semicolons to handle multiple statements
    const statements = content
      .split(';')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0 && !s.startsWith('--'))

    try {
      for (const statement of statements) {
        await execute(statement)
      }

      // Record successful migration
      await execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file])
      logger.info('Migration applied', { service: 'database', operation: 'migration', file })
    } catch (err) {
      logger.error('Migration failed', { service: 'database', operation: 'migration', file, error: err })
      throw err // Stop on migration failure
    }
  }
}
