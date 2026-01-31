import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), '..', 'data')
const DB_PATH = join(DATA_DIR, 'mailer.db')

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

export const db = new Database(DB_PATH)

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL')

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

// Initialize schema
export function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS send_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES sender_accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(account_id, date)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      blocks TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
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

  db.run(`
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

  db.run(`
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

  db.run(`
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

  // Recipient-attachment mapping
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
  mkdirSync(join(DATA_DIR, 'attachments'), { recursive: true })

  // Create backups directory
  mkdirSync(join(DATA_DIR, 'backups'), { recursive: true })

  // Run migrations - add columns if they don't exist
  addColumnIfNotExists('drafts', 'cc', 'TEXT', '[]')
  addColumnIfNotExists('drafts', 'bcc', 'TEXT', '[]')
  addColumnIfNotExists('campaigns', 'cc', 'TEXT', '[]')
  addColumnIfNotExists('campaigns', 'bcc', 'TEXT', '[]')
  addColumnIfNotExists('campaigns', 'scheduled_for', 'DATETIME', '')
  addColumnIfNotExists('campaigns', 'status', 'TEXT', 'draft')
  addColumnIfNotExists('send_logs', 'retry_count', 'INTEGER', '0')
  addColumnIfNotExists('sender_accounts', 'circuit_breaker_until', 'DATETIME', '')

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_send_counts_date ON send_counts(account_id, date)')
  db.run('CREATE INDEX IF NOT EXISTS idx_send_logs_campaign ON send_logs(campaign_id)')
  db.run('CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for)')

  console.log('Database initialized')

  // Seed starter templates
  seedTemplates()
}

export function checkDatabaseHealth(): { ok: boolean; latencyMs: number } {
  const start = Date.now()
  try {
    db.query('SELECT 1').get()
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

function seedTemplates(): void {
  // Check if templates already exist
  const count = db.query('SELECT COUNT(*) as count FROM templates').get() as { count: number }
  
  if (count.count > 0) {
    return // Templates already exist, skip seeding
  }

  console.log('Seeding starter templates...')

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
    db.run(
      'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
      [template.name, template.description, JSON.stringify(template.blocks)]
    )
  }

  console.log(`Seeded ${templates.length} starter templates`)
}
