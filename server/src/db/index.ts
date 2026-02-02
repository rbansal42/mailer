import { createClient, Client } from '@libsql/client'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { logger } from '../lib/logger'

// Data directory for local file storage (attachments, backups)
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

// Validate required environment variables
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL environment variable is required')
}

if (!TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN environment variable is required')
}

// Ensure data directory exists for local file storage
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// Create Turso client
export const db: Client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
})

// Helper functions for cleaner async queries
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
    lastInsertRowid: result.lastInsertRowid,
  }
}

// Migration helper - add columns if they don't exist
async function addColumnIfNotExists(table: string, column: string, type: string, defaultValue: string) {
  try {
    const columns = await queryAll<any>(`PRAGMA table_info(${table})`)
    if (!columns.find(c => c.name === column)) {
      await execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT '${defaultValue}'`)
    }
  } catch (e) {
    // Column might already exist or table doesn't exist
  }
}

// Run SQL migrations from the migrations directory (with tracking)
async function runMigrations() {
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

// Initialize schema
export async function initializeDatabase() {
  await execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

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

  // Add is_default column to templates (for built-in templates)
  try {
    await execute(`ALTER TABLE templates ADD COLUMN is_default INTEGER DEFAULT 0`)
  } catch (e) {
    // Column may already exist, ignore error
  }

  // Create mails table for saved mail designs
  await execute(`
    CREATE TABLE IF NOT EXISTS mails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      blocks TEXT NOT NULL DEFAULT '[]',
      template_id INTEGER,
      campaign_id INTEGER,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
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

  // Attachments table
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

  // Recipient-attachment mapping
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

  // Tracking tokens for email analytics
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

  // Tracking events for opens, clicks, etc.
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

  // Scheduled batches for timezone-aware delivery
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

  // Recurring campaigns for scheduled sends
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

  // Certificate configuration (user-customized templates)
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

  // Generated certificates (tracking)
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

  // Drip sequences
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

  // Sequence steps
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

  // Sequence enrollments
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

  // Media library table for uploaded images
  await execute(`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      alt_text TEXT DEFAULT '',
      size_bytes INTEGER,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      deleted_at TEXT DEFAULT NULL
    )
  `)

  // Contacts - global contact storage
  await execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      company TEXT,
      phone TEXT,
      country TEXT,
      custom_fields TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Lists - named collections
  await execute(`
    CREATE TABLE IF NOT EXISTS lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // List memberships - junction table
  await execute(`
    CREATE TABLE IF NOT EXISTS list_contacts (
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (list_id, contact_id)
    )
  `)

  // Suppression list - emails that should not receive mail
  await execute(`
    CREATE TABLE IF NOT EXISTS suppression_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Bounces log
  await execute(`
    CREATE TABLE IF NOT EXISTS bounces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      bounce_type TEXT NOT NULL,
      bounce_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create attachments directory
  mkdirSync(join(DATA_DIR, 'attachments'), { recursive: true })

  // Create backups directory
  mkdirSync(join(DATA_DIR, 'backups'), { recursive: true })

  // Run migrations - add columns if they don't exist
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
  await execute('CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON media(deleted_at)')
  await execute('CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)')
  await execute('CREATE INDEX IF NOT EXISTS idx_list_contacts_list ON list_contacts(list_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_list_contacts_contact ON list_contacts(contact_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_list(email)')
  await execute('CREATE INDEX IF NOT EXISTS idx_bounces_email ON bounces(email)')

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

  logger.info('Database initialized', { service: 'database', operation: 'init' })

  // Seed starter templates
  await seedTemplates()

  // Seed default email templates
  await seedDefaultTemplates()

  // Run SQL migrations
  await runMigrations()
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await queryOne<{ 1: number }>('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

async function seedDefaultTemplates(): Promise<void> {
  // Check if default templates already exist
  const existing = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM templates WHERE is_default = 1')
  if (existing && existing.count > 0) {
    return // Already seeded
  }

  const defaultTemplates = [
    {
      name: 'Newsletter',
      description: 'Multi-section newsletter with header, content blocks, and footer',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Company Newsletter', subtitle: 'Monthly Updates' } },
        { id: '2', type: 'text', props: { content: '<h2>This Month\'s Highlights</h2><p>Hello {{name}},</p><p>Here are the latest updates from our team...</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>Feature Article</h3><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>' } },
        { id: '5', type: 'button', props: { label: 'Read More', url: 'https://example.com', align: 'center' } },
        { id: '6', type: 'footer', props: { text: '© 2026 Company Name. All rights reserved.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Announcement',
      description: 'Simple announcement with headline and call-to-action',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Important Announcement' } },
        { id: '2', type: 'text', props: { content: '<p>Dear {{name}},</p><p>We have exciting news to share with you!</p><p>Our team has been working hard on something special, and we can\'t wait for you to see it.</p>' } },
        { id: '3', type: 'button', props: { label: 'Learn More', url: 'https://example.com', align: 'center' } },
        { id: '4', type: 'footer', props: { text: 'Questions? Reply to this email.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Welcome Email',
      description: 'Onboarding email for new users or subscribers',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Welcome!' } },
        { id: '2', type: 'text', props: { content: '<h2>Welcome to the team, {{name}}!</h2><p>We\'re thrilled to have you on board. Here\'s what you can expect:</p><ul><li>Regular updates and insights</li><li>Exclusive content and offers</li><li>Direct access to our support team</li></ul>' } },
        { id: '3', type: 'button', props: { label: 'Get Started', url: 'https://example.com', align: 'center' } },
        { id: '4', type: 'text', props: { content: '<p>If you have any questions, just reply to this email.</p><p>Best regards,<br>The Team</p>' } },
        { id: '5', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Promotion',
      description: 'Sale or discount promotional email',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Special Offer Inside!' } },
        { id: '2', type: 'text', props: { content: '<h1 style="text-align: center; color: #e53e3e;">🎉 50% OFF 🎉</h1><p style="text-align: center;">For a limited time only!</p>' } },
        { id: '3', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Don\'t miss out on our biggest sale of the year. Use code <strong>SAVE50</strong> at checkout.</p>' } },
        { id: '4', type: 'button', props: { label: 'Shop Now', url: 'https://example.com', align: 'center', backgroundColor: '#e53e3e' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center; font-size: 12px;">Offer expires in 48 hours. Terms and conditions apply.</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Event Invitation',
      description: 'Event invite with date, time, and location details',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'You\'re Invited!' } },
        { id: '2', type: 'text', props: { content: '<h2 style="text-align: center;">Annual Company Meetup</h2><p>Dear {{name}},</p><p>We\'d love for you to join us at our upcoming event!</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>📅 Date:</strong> March 15, 2026<br><strong>🕐 Time:</strong> 6:00 PM - 9:00 PM<br><strong>📍 Location:</strong> 123 Main Street, City</p>' } },
        { id: '4', type: 'button', props: { label: 'RSVP Now', url: 'https://example.com', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p>We look forward to seeing you there!</p>' } },
        { id: '6', type: 'footer', props: { text: 'Can\'t make it? Let us know by replying to this email.', showUnsubscribe: true } }
      ]
    },
    // Transactional Templates
    {
      name: 'Order Confirmation',
      description: 'Order summary with items, shipping address, and tracking',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Order Confirmed!', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your order! We\'re getting it ready to ship.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>Order Details</h3><p><strong>Order Number:</strong> {{order_number}}</p>' } },
        { id: '5', type: 'text', props: { content: '<p>{{order_items}}</p>' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p style="text-align: right;"><strong>Order Total:</strong> {{order_total}}</p>' } },
        { id: '8', type: 'text', props: { content: '<h3>Shipping Address</h3><p>{{shipping_address}}</p>' } },
        { id: '9', type: 'button', props: { label: 'Track Order', url: '{{tracking_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '10', type: 'footer', props: { text: 'Questions about your order? Reply to this email.', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Shipping Update',
      description: 'Package shipped notification with tracking details',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Your Order is On Its Way!' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Great news! Your order has shipped and is on its way to you.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<p><strong>Tracking Number:</strong> {{tracking_number}}<br><strong>Carrier:</strong> {{carrier}}<br><strong>Estimated Delivery:</strong> {{delivery_date}}</p>' } },
        { id: '5', type: 'button', props: { label: 'Track Package', url: '{{tracking_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p><strong>Order Reference:</strong> {{order_number}}</p>' } },
        { id: '8', type: 'footer', props: { text: 'Thank you for your order!', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Password Reset',
      description: 'Secure password reset request with single CTA',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Reset Your Password' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>' } },
        { id: '3', type: 'button', props: { label: 'Reset Password', url: '{{reset_url}}', align: 'center', backgroundColor: '#dc2626' } },
        { id: '4', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>' } },
        { id: '5', type: 'divider', props: { style: 'solid' } },
        { id: '6', type: 'text', props: { content: '<p style="color: #6b7280; font-size: 13px;"><strong>Didn\'t request this?</strong><br>If you didn\'t request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>' } },
        { id: '7', type: 'footer', props: { text: 'This request was initiated from IP address {{ip_address}}.', showUnsubscribe: false } }
      ]
    },
    {
      name: 'Receipt',
      description: 'Payment receipt with itemized breakdown',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Payment Receipt', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Thank you for your payment. Here are your transaction details:</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>Invoice #:</strong> {{invoice_number}}<br><strong>Date:</strong> {{date}}</p>' } },
        { id: '4', type: 'divider', props: { style: 'solid' } },
        { id: '5', type: 'text', props: { content: '<h3>Items</h3><p>{{line_items}}</p>' } },
        { id: '6', type: 'divider', props: { style: 'solid' } },
        { id: '7', type: 'text', props: { content: '<p style="text-align: right;">Subtotal: {{subtotal}}<br>Tax: {{tax}}<br><strong style="font-size: 18px;">Total: {{total}}</strong></p>' } },
        { id: '8', type: 'text', props: { content: '<p><strong>Payment Method:</strong> {{payment_method}}</p>' } },
        { id: '9', type: 'footer', props: { text: 'Keep this email for your records.', showUnsubscribe: false } }
      ]
    },
    // Re-engagement Templates
    {
      name: 'We Miss You',
      description: 'Friendly re-engagement for inactive users',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'We Miss You!' } },
        { id: '2', type: 'text', props: { content: '<p style="text-align: center; font-size: 48px;">👋</p>' } },
        { id: '3', type: 'text', props: { content: '<p>Hi {{name}},</p><p>It\'s been a while since we\'ve seen you around, and we just wanted to reach out and say — we miss you!</p>' } },
        { id: '4', type: 'text', props: { content: '<p>A lot has happened since your last visit. Here\'s what you\'ve been missing:</p><ul><li><strong>New features</strong> — Exciting tools to help you do more</li><li><strong>Improvements</strong> — Faster, smoother, better than ever</li><li><strong>Fresh updates</strong> — New content waiting just for you</li></ul>' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center;">We\'d love to have you back. Why not take a look around?</p>' } },
        { id: '6', type: 'button', props: { label: 'Come Back and Explore', url: '{{app_url}}', align: 'center' } },
        { id: '7', type: 'text', props: { content: '<p>Warm regards,<br>The Team</p>' } },
        { id: '8', type: 'footer', props: { text: 'We hope to see you again soon.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Account Inactive Warning',
      description: 'Warning before account deactivation',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Action Required', backgroundColor: '#f59e0b' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We noticed you haven\'t logged into your account in a while. To keep our platform secure, <strong>your account will be deactivated on {{deactivation_date}}</strong> unless you take action.</p>' } },
        { id: '3', type: 'divider', props: { style: 'solid' } },
        { id: '4', type: 'text', props: { content: '<h3>What happens if your account is deactivated?</h3><ul><li>Your data will be archived and no longer accessible</li><li>You\'ll need to contact support to restore your account</li></ul>' } },
        { id: '5', type: 'button', props: { label: 'Keep My Account Active', url: '{{login_url}}', align: 'center', backgroundColor: '#f59e0b' } },
        { id: '6', type: 'text', props: { content: '<p>Want to download your data first? <a href="{{export_url}}">Export your data here</a> before the deadline.</p>' } },
        { id: '7', type: 'footer', props: { text: 'If you believe you received this message in error, please contact support.', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Special Win-back Offer',
      description: 'Promotional discount to re-engage inactive users',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'A Gift For You' } },
        { id: '2', type: 'text', props: { content: '<h1 style="text-align: center; color: #7c3aed;">Welcome Back!</h1><p style="text-align: center; font-size: 18px;">We\'ve missed you, {{name}}!</p>' } },
        { id: '3', type: 'text', props: { content: '<p style="text-align: center;">To celebrate your return, here\'s <strong>20% off</strong> just for you:</p>' } },
        { id: '4', type: 'text', props: { content: '<p style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">{{promo_code}}</p>' } },
        { id: '5', type: 'button', props: { label: 'Shop Now', url: '{{shop_url}}', align: 'center', backgroundColor: '#7c3aed' } },
        { id: '6', type: 'text', props: { content: '<p style="text-align: center; font-size: 14px; color: #6b7280;">Offer expires: {{expiry_date}}</p>' } },
        { id: '7', type: 'divider', props: { style: 'solid' } },
        { id: '8', type: 'text', props: { content: '<h3>What\'s new since you\'ve been away</h3><ul><li>{{new_feature_1}}</li><li>{{new_feature_2}}</li></ul>' } },
        { id: '9', type: 'footer', props: { text: '© 2026 Company Name', showUnsubscribe: true } }
      ]
    },
    // Survey/Feedback Templates
    {
      name: 'Feedback Request',
      description: 'Simple feedback collection with rating',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'How Did We Do?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We recently had the pleasure of serving you with {{product_or_service}}. Your opinion matters to us!</p>' } },
        { id: '3', type: 'text', props: { content: '<h3 style="text-align: center;">Rate Your Experience</h3><p style="text-align: center; font-size: 32px;"><a href="{{rating_url_1}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_2}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_3}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_4}}" style="text-decoration: none;">⭐</a>&nbsp;<a href="{{rating_url_5}}" style="text-decoration: none;">⭐</a></p><p style="text-align: center; font-size: 12px; color: #6b7280;">Click a star to rate (1-5)</p>' } },
        { id: '4', type: 'button', props: { label: 'Share Detailed Feedback', url: '{{feedback_url}}', align: 'center' } },
        { id: '5', type: 'footer', props: { text: 'Your feedback helps us improve. Thank you!', showUnsubscribe: true } }
      ]
    },
    {
      name: 'NPS Survey',
      description: 'Net Promoter Score survey with 0-10 scale',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Quick Question' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We value your feedback and would love to hear from you.</p>' } },
        { id: '3', type: 'text', props: { content: '<h3 style="text-align: center;">How likely are you to recommend us to a friend or colleague?</h3>' } },
        { id: '4', type: 'text', props: { content: '<p style="text-align: center;"><a href="{{nps_url_0}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #ef4444; color: white; text-decoration: none; border-radius: 4px;">0</a><a href="{{nps_url_1}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #f97316; color: white; text-decoration: none; border-radius: 4px;">1</a><a href="{{nps_url_2}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #f97316; color: white; text-decoration: none; border-radius: 4px;">2</a><a href="{{nps_url_3}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">3</a><a href="{{nps_url_4}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">4</a><a href="{{nps_url_5}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">5</a><a href="{{nps_url_6}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #facc15; color: black; text-decoration: none; border-radius: 4px;">6</a><a href="{{nps_url_7}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #84cc16; color: black; text-decoration: none; border-radius: 4px;">7</a><a href="{{nps_url_8}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #84cc16; color: black; text-decoration: none; border-radius: 4px;">8</a><a href="{{nps_url_9}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #22c55e; color: white; text-decoration: none; border-radius: 4px;">9</a><a href="{{nps_url_10}}" style="display: inline-block; padding: 8px 12px; margin: 2px; background: #22c55e; color: white; text-decoration: none; border-radius: 4px;">10</a></p>' } },
        { id: '5', type: 'text', props: { content: '<p style="font-size: 12px; color: #6b7280;"><span style="float: left;">Not likely</span><span style="float: right;">Very likely</span></p><div style="clear: both;"></div>' } },
        { id: '6', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280;">Click a number above to submit your response</p>' } },
        { id: '7', type: 'footer', props: { text: 'This survey takes less than 30 seconds. Thank you!', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Review Request',
      description: 'Request for product or service review',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Enjoying {{product}}?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We hope you\'re loving your recent experience! Your opinion matters, and we\'d love to hear about it.</p>' } },
        { id: '3', type: 'text', props: { content: '<div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center;"><p style="margin: 0;"><strong>Your review helps others make informed decisions</strong></p><p style="margin: 8px 0 0 0; color: #6b7280;">Share your honest experience and help our community grow.</p></div>' } },
        { id: '4', type: 'button', props: { label: 'Leave a Review', url: '{{review_url}}', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p style="text-align: center; color: #6b7280;">Join {{review_count}}+ happy customers who\'ve shared their experience</p>' } },
        { id: '6', type: 'footer', props: { text: 'Thank you for being a valued customer.', showUnsubscribe: true } }
      ]
    },
    // Onboarding Templates
    {
      name: 'Onboarding: Day 1 Welcome',
      description: 'First day onboarding with quick wins',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Welcome to {{app}}!', backgroundColor: '#10b981' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>We\'re so excited to have you on board! You\'ve just taken the first step toward {{value_prop}}.</p>' } },
        { id: '3', type: 'text', props: { content: '<p><strong>Quick wins to get started:</strong></p><ol><li>{{quick_win_1}}</li><li>{{quick_win_2}}</li><li>{{quick_win_3}}</li></ol>' } },
        { id: '4', type: 'button', props: { label: 'Get Started', url: '{{dashboard_url}}', align: 'center', backgroundColor: '#10b981' } },
        { id: '5', type: 'text', props: { content: '<p>Questions? Just reply to this email—we\'re here to help!</p><p>Cheers,<br>The {{app}} Team</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Onboarding: Day 3 Feature Highlight',
      description: 'Highlight a key feature to drive engagement',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Did You Know?' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>Many users don\'t discover this until later, but we wanted to make sure you knew about one of our most powerful features.</p>' } },
        { id: '3', type: 'text', props: { content: '<div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;"><strong style="font-size: 18px;">{{feature_name}}</strong><br><br>{{feature_description}}</div>' } },
        { id: '4', type: 'button', props: { label: 'Try It Now', url: '{{feature_url}}', align: 'center' } },
        { id: '5', type: 'text', props: { content: '<p style="color: #6b7280;">Coming up next: Pro tips to get even more out of {{app}}.</p>' } },
        { id: '6', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    },
    {
      name: 'Onboarding: Day 7 Tips & Tricks',
      description: 'Power user tips after first week',
      blocks: [
        { id: '1', type: 'header', props: { logo: '', title: 'Pro Tips for {{app}}' } },
        { id: '2', type: 'text', props: { content: '<p>Hi {{name}},</p><p>🎉 <strong>You\'ve been with us for a week now!</strong> Here are some power user tips to help you get even more out of {{app}}:</p>' } },
        { id: '3', type: 'text', props: { content: '<p>💡 <strong>Tip #1: {{tip_1_title}}</strong><br>{{tip_1_description}}</p>' } },
        { id: '4', type: 'text', props: { content: '<p>⚡ <strong>Tip #2: {{tip_2_title}}</strong><br>{{tip_2_description}}</p>' } },
        { id: '5', type: 'text', props: { content: '<p>🎯 <strong>Tip #3: {{tip_3_title}}</strong><br>{{tip_3_description}}</p>' } },
        { id: '6', type: 'button', props: { label: 'Explore Help Center', url: '{{help_url}}', align: 'center' } },
        { id: '7', type: 'text', props: { content: '<p>Have questions? Reply to this email anytime.</p>' } },
        { id: '8', type: 'footer', props: { text: '© 2026 {{company}}', showUnsubscribe: true } }
      ]
    }
  ]

  for (const template of defaultTemplates) {
    await execute(
      'INSERT INTO templates (name, description, blocks, is_default) VALUES (?, ?, ?, 1)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }

  logger.info('Seeded default email templates', { service: 'db', count: defaultTemplates.length })
}

async function seedTemplates(): Promise<void> {
  // Check if templates already exist
  const count = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM templates')
  
  if (count && count.count > 0) {
    return // Templates already exist, skip seeding
  }

  logger.info('Seeding starter templates', { service: 'database', operation: 'seed' })

  const templates = [
    {
      name: 'Marketing: Newsletter',
      description: 'Monthly updates, news, and featured content',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#3b82f6', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Hello {{name}},\n\nHere\'s what\'s new this month at {{company}}. We\'ve been working hard to bring you exciting updates and valuable content.', fontSize: 16, align: 'left' } },
        { id: 'divider_1', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_2', type: 'text', props: { content: '📰 Featured This Month\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Read More', url: '{{read_more_url}}', color: '#3b82f6', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: '© 2026 {{company}} · You received this because you subscribed.\nUnsubscribe | View in browser' } },
      ],
    },
    {
      name: 'Marketing: Promotional',
      description: 'Special offers, discounts, and product promotions',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#f97316', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Hey {{name}}! 🎉\n\nWe have a special offer just for you. For a limited time, enjoy exclusive savings on our most popular products.', fontSize: 16, align: 'left' } },
        { id: 'image_1', type: 'image', props: { url: '', alt: 'Promotional offer', width: 100, align: 'center' } },
        { id: 'text_2', type: 'text', props: { content: '🏷️ LIMITED TIME OFFER\n\nGet 20% off your next purchase with code SAVE20.\n\n✓ Free shipping on orders over $50\n✓ 30-day money-back guarantee', fontSize: 15, align: 'center' } },
        { id: 'button_1', type: 'button', props: { label: 'Shop Now', url: '{{shop_url}}', color: '#f97316', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Terms and conditions apply. Offer valid until {{expiry_date}}.\n© 2026 {{company}} · Unsubscribe' } },
      ],
    },
    {
      name: 'Transactional: Welcome',
      description: 'Onboarding emails for new users and customers',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#10b981', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: 'Welcome to {{company}}, {{name}}! 👋\n\nWe\'re thrilled to have you on board. You\'ve just joined a community of thousands who are already benefiting from our platform.', fontSize: 16, align: 'left' } },
        { id: 'spacer_1', type: 'spacer', props: { height: 20 } },
        { id: 'text_2', type: 'text', props: { content: '🚀 Getting Started\n\n1. Complete your profile - Add your details\n2. Explore features - Discover all the tools\n3. Connect with us - Follow us for tips and updates', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Get Started', url: '{{dashboard_url}}', color: '#10b981', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Need help? Reply to this email or visit our Help Center.\n© 2026 {{company}}' } },
      ],
    },
    {
      name: 'Transactional: Meeting Request',
      description: 'Schedule meetings and appointments',
      blocks: [
        { id: 'text_1', type: 'text', props: { content: 'Hi {{name}},\n\nI hope this email finds you well. I\'d like to schedule a meeting to discuss {{meeting_topic}}.\n\nPlease find the proposed details below:', fontSize: 16, align: 'left' } },
        { id: 'divider_1', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_2', type: 'text', props: { content: '📅 Date: {{date}}\n⏰ Time: {{time}}\n📍 Location: {{location}}\n⏱️ Duration: {{duration}}', fontSize: 15, align: 'left' } },
        { id: 'divider_2', type: 'divider', props: { style: 'solid', color: '#e5e7eb' } },
        { id: 'text_3', type: 'text', props: { content: 'Please let me know if this time works for you, or suggest an alternative.', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Confirm Availability', url: '{{calendar_url}}', color: '#6366f1', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: '{{sender_name}}\n{{sender_title}} · {{company}}\n{{sender_email}}' } },
      ],
    },
    {
      name: 'Communication: Announcement',
      description: 'Company news, product updates, and important notices',
      blocks: [
        { id: 'header_1', type: 'header', props: { backgroundColor: '#6366f1', imageUrl: '' } },
        { id: 'text_1', type: 'text', props: { content: '📢 Important Announcement\n\nDear {{name}},\n\nWe\'re excited to share some important news with you.', fontSize: 16, align: 'left' } },
        { id: 'image_1', type: 'image', props: { url: '', alt: 'Announcement', width: 100, align: 'center' } },
        { id: 'text_2', type: 'text', props: { content: 'What This Means For You\n\n• New features and improvements\n• Enhanced user experience\n• Better performance and reliability', fontSize: 15, align: 'left' } },
        { id: 'button_1', type: 'button', props: { label: 'Learn More', url: '{{announcement_url}}', color: '#6366f1', align: 'center' } },
        { id: 'footer_1', type: 'footer', props: { text: 'Thank you for being part of our journey.\n© 2026 {{company}}' } },
      ],
    },
    {
      name: 'Communication: Simple Text',
      description: 'Clean, minimal text-only emails for personal outreach',
      blocks: [
        { id: 'text_1', type: 'text', props: { content: 'Hi {{name}},\n\nI hope you\'re doing well. I wanted to reach out regarding {{subject}}.\n\n[Your message here]\n\nLet me know if you have any questions.\n\nBest regards,\n{{sender_name}}', fontSize: 16, align: 'left' } },
        { id: 'spacer_1', type: 'spacer', props: { height: 10 } },
        { id: 'footer_1', type: 'footer', props: { text: '{{sender_name}} · {{sender_title}}\n{{sender_email}} · {{sender_phone}}' } },
      ],
    },
  ]

  for (const template of templates) {
    await execute(
      'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }

  logger.info('Seeded starter templates', { service: 'database', operation: 'seed', count: templates.length })
}
