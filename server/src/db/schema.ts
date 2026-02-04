import { execute } from './client'

// Create all database tables
export async function createTables() {
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

  // Sequence actions - tracks button clicks for branching
  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sequence_id INTEGER NOT NULL,
      step_id INTEGER NOT NULL,
      enrollment_id INTEGER NOT NULL,
      clicked_at TEXT NOT NULL,
      destination_type TEXT NOT NULL,
      destination_url TEXT,
      hosted_message TEXT,
      button_text TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
      FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id) ON DELETE CASCADE
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

  // Google Sheets sync configurations
  await execute(`
    CREATE TABLE IF NOT EXISTS google_sheets_syncs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_name TEXT,
      sheet_range TEXT,
      column_mapping TEXT NOT NULL DEFAULT '{}',
      auto_sync INTEGER DEFAULT 0,
      sync_frequency TEXT DEFAULT 'manual',
      last_synced_at DATETIME,
      last_sync_count INTEGER DEFAULT 0,
      last_sync_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(list_id, spreadsheet_id)
    )
  `)
}

// Create all database indexes
export async function createIndexes() {
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
  await execute('CREATE INDEX IF NOT EXISTS idx_google_sheets_syncs_list ON google_sheets_syncs(list_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sequence_actions_enrollment ON sequence_actions(enrollment_id)')
}

// Initialize default settings
export async function initializeSettings() {
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
}
