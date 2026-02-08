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
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      config TEXT NOT NULL,
      daily_cap INTEGER DEFAULT 500,
      campaign_cap INTEGER DEFAULT 100,
      priority INTEGER DEFAULT 0,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS send_counts (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES sender_accounts(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(account_id, date)
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS drafts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      subject TEXT,
      recipients JSONB DEFAULT '[]'::jsonb,
      variables JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      total_recipients INTEGER NOT NULL,
      successful INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      queued INTEGER DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Create mails table for saved mail designs (after campaigns, which it references)
  await execute(`
    CREATE TABLE IF NOT EXISTS mails (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
      template_id INTEGER,
      campaign_id INTEGER,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS send_logs (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES sender_accounts(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER DEFAULT 1,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS email_queue (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      recipient_email TEXT NOT NULL,
      recipient_data JSONB NOT NULL,
      scheduled_for TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Attachments table
  await execute(`
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id),
      draft_id INTEGER REFERENCES drafts(id),
      filename TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      mime_type TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Recipient-attachment mapping
  await execute(`
    CREATE TABLE IF NOT EXISTS recipient_attachments (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id),
      draft_id INTEGER REFERENCES drafts(id),
      recipient_email TEXT NOT NULL,
      attachment_id INTEGER REFERENCES attachments(id),
      matched_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(campaign_id, recipient_email, attachment_id)
    )
  `)

  // Tracking tokens for email analytics
  await execute(`
    CREATE TABLE IF NOT EXISTS tracking_tokens (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id),
      recipient_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(campaign_id, recipient_email)
    )
  `)

  // Tracking events for opens, clicks, etc.
  await execute(`
    CREATE TABLE IF NOT EXISTS tracking_events (
      id SERIAL PRIMARY KEY,
      token_id INTEGER REFERENCES tracking_tokens(id),
      event_type TEXT NOT NULL,
      link_url TEXT,
      link_index INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Scheduled batches for timezone-aware delivery
  await execute(`
    CREATE TABLE IF NOT EXISTS scheduled_batches (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id),
      scheduled_for TIMESTAMPTZ NOT NULL,
      recipient_emails JSONB NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Recurring campaigns for scheduled sends
  await execute(`
    CREATE TABLE IF NOT EXISTS recurring_campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      subject TEXT NOT NULL,
      recipient_source TEXT NOT NULL,
      recipient_data JSONB,
      schedule_cron TEXT NOT NULL,
      timezone TEXT DEFAULT 'UTC',
      cc JSONB DEFAULT '[]'::jsonb,
      bcc JSONB DEFAULT '[]'::jsonb,
      enabled BOOLEAN DEFAULT true,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Certificate configuration (user-customized templates)
  await execute(`
    CREATE TABLE IF NOT EXISTS certificate_configs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      colors JSONB NOT NULL,
      logos JSONB DEFAULT '[]'::jsonb,
      signatories JSONB DEFAULT '[]'::jsonb,
      title_text TEXT DEFAULT 'CERTIFICATE',
      subtitle_text TEXT DEFAULT 'of Participation',
      description_template TEXT DEFAULT 'For participating in {{title}} on {{date}}.',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Generated certificates (tracking)
  await execute(`
    CREATE TABLE IF NOT EXISTS generated_certificates (
      id SERIAL PRIMARY KEY,
      certificate_id TEXT NOT NULL UNIQUE,
      config_id INTEGER REFERENCES certificate_configs(id),
      recipient_name TEXT NOT NULL,
      recipient_email TEXT,
      data JSONB DEFAULT '{}'::jsonb,
      pdf_path TEXT,
      campaign_id INTEGER REFERENCES campaigns(id),
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Drip sequences
  await execute(`
    CREATE TABLE IF NOT EXISTS sequences (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Sequence steps
  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_steps (
      id SERIAL PRIMARY KEY,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      template_id INTEGER REFERENCES templates(id),
      subject TEXT NOT NULL,
      delay_days INTEGER NOT NULL,
      delay_hours INTEGER DEFAULT 0,
      send_time TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Sequence enrollments
  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id SERIAL PRIMARY KEY,
      sequence_id INTEGER REFERENCES sequences(id) ON DELETE CASCADE,
      recipient_email TEXT NOT NULL,
      recipient_data JSONB,
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      next_send_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      UNIQUE(sequence_id, recipient_email)
    )
  `)

  // Sequence actions - tracks button clicks for branching
  await execute(`
    CREATE TABLE IF NOT EXISTS sequence_actions (
      id SERIAL PRIMARY KEY,
      sequence_id INTEGER NOT NULL,
      step_id INTEGER NOT NULL,
      enrollment_id INTEGER NOT NULL,
      clicked_at TIMESTAMPTZ NOT NULL,
      destination_type TEXT NOT NULL,
      destination_url TEXT,
      hosted_message TEXT,
      button_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
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
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ DEFAULT NULL
    )
  `)

  // Contacts - global contact storage
  await execute(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      company TEXT,
      phone TEXT,
      country TEXT,
      custom_fields JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Lists - named collections
  await execute(`
    CREATE TABLE IF NOT EXISTS lists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // List memberships - junction table
  await execute(`
    CREATE TABLE IF NOT EXISTS list_contacts (
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (list_id, contact_id)
    )
  `)

  // Suppression list - emails that should not receive mail
  await execute(`
    CREATE TABLE IF NOT EXISTS suppression_list (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Bounces log
  await execute(`
    CREATE TABLE IF NOT EXISTS bounces (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      bounce_type TEXT NOT NULL,
      bounce_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Google Sheets sync configurations
  await execute(`
    CREATE TABLE IF NOT EXISTS google_sheets_syncs (
      id SERIAL PRIMARY KEY,
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      spreadsheet_id TEXT NOT NULL,
      spreadsheet_name TEXT,
      sheet_range TEXT,
      column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
      auto_sync BOOLEAN DEFAULT false,
      sync_frequency TEXT DEFAULT 'manual',
      last_synced_at TIMESTAMPTZ,
      last_sync_count INTEGER DEFAULT 0,
      last_sync_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(list_id, spreadsheet_id)
    )
  `)

  // Users table for multi-tenant user management
  await execute(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
  await execute('CREATE INDEX IF NOT EXISTS idx_sequence_actions_step ON sequence_actions(step_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sequence_actions_sequence ON sequence_actions(sequence_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sequence_steps_branch ON sequence_steps(branch_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)')
  await execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')

  // User management indexes
  await execute('CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sender_accounts_user_id ON sender_accounts(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_mails_user_id ON mails(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_certificate_configs_user_id ON certificate_configs(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_generated_certificates_user_id ON generated_certificates(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_recurring_campaigns_user_id ON recurring_campaigns(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON sequences(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id)')
  await execute('CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)')
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
    await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', [key, value])
  }
}
