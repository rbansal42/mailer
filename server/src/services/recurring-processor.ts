import { db } from '../db'
import { logger } from '../lib/logger'
import { compileTemplate, replaceVariables, injectTracking } from './template-compiler'
import { getNextAvailableAccount, incrementSendCount } from './account-manager'
import { createProvider } from '../providers'
import { getOrCreateToken, getTrackingSettings } from './tracking'

interface RecurringCampaign {
  id: number
  name: string
  template_id: number | null
  subject: string
  recipient_source: string
  recipient_data: string | null
  schedule_cron: string
  timezone: string
  cc: string
  bcc: string
  enabled: number
  last_run_at: string | null
  next_run_at: string | null
}

interface TemplateRow {
  id: number
  blocks: string
}

interface Recipient {
  email: string
  [key: string]: string
}

interface BlockInput {
  id: string
  type: string
  props: Record<string, unknown>
}

/**
 * Calculate next run time from cron expression
 * 
 * Note: For proper timezone support, consider using luxon or date-fns-tz.
 * This implementation handles common cron patterns but uses server local time.
 */
export function calculateNextRun(cronExpression: string, _timezone: string = 'UTC'): Date {
  // Parse cron expression parts (minute hour dayOfMonth month dayOfWeek)
  const parts = cronExpression.split(' ')
  if (parts.length !== 5) {
    throw new Error('Invalid cron expression')
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const now = new Date()
  const nextRun = new Date(now)
  nextRun.setSeconds(0, 0)

  // Set the time from cron expression
  const cronHour = hour === '*' ? now.getHours() : parseInt(hour, 10)
  const cronMinute = minute === '*' ? 0 : parseInt(minute, 10)
  nextRun.setHours(cronHour, cronMinute, 0, 0)

  // Handle day of week (0-6, where 0 is Sunday)
  if (dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek, 10)
    const currentDay = nextRun.getDay()
    let daysToAdd = targetDay - currentDay
    if (daysToAdd < 0 || (daysToAdd === 0 && nextRun <= now)) {
      daysToAdd += 7
    }
    nextRun.setDate(nextRun.getDate() + daysToAdd)
  } else if (dayOfMonth !== '*') {
    // Handle specific day of month
    const targetDate = parseInt(dayOfMonth, 10)
    nextRun.setDate(targetDate)
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1)
    }
  } else {
    // Daily or more frequent - if time passed, go to next day
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
  }

  // Handle month if specified
  if (month !== '*') {
    const targetMonth = parseInt(month, 10) - 1 // Cron months are 1-12, JS is 0-11
    nextRun.setMonth(targetMonth)
    if (nextRun <= now) {
      nextRun.setFullYear(nextRun.getFullYear() + 1)
    }
  }

  return nextRun
}

/**
 * Fetch recipients based on source type
 */
export async function fetchRecipients(source: string, data: string | null): Promise<Recipient[]> {
  if (!data) return []

  switch (source) {
    case 'static':
      // Parse CSV data from recipient_data
      return parseCSV(data)

    case 'csv_url':
      // Fetch CSV from URL
      try {
        const response = await fetch(data)
        const csvText = await response.text()
        return parseCSV(csvText)
      } catch (error) {
        logger.error('Failed to fetch CSV from URL', { url: data }, error as Error)
        return []
      }

    case 'api':
      // Fetch from API endpoint
      try {
        const config = JSON.parse(data) as { url: string; method?: string; headers?: Record<string, string> }
        const response = await fetch(config.url, {
          method: config.method || 'GET',
          headers: config.headers || {},
        })
        return (await response.json()) as Recipient[]
      } catch (error) {
        logger.error('Failed to fetch from API', { data }, error as Error)
        return []
      }

    default:
      return []
  }
}

/**
 * Parse CSV string to array of objects
 */
function parseCSV(csv: string): Recipient[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const emailIndex = headers.findIndex((h) => h === 'email')

  if (emailIndex === -1) return []

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const obj: Recipient = { email: values[emailIndex] }
      headers.forEach((header, i) => {
        obj[header] = values[i] || ''
      })
      return obj
    })
    .filter((r) => r.email)
}

/**
 * Process all due recurring campaigns
 */
export async function processRecurringCampaigns(): Promise<number> {
  const now = new Date().toISOString()

  // Find due recurring campaigns
  const dueCampaigns = db
    .query<RecurringCampaign, [string]>(
      `SELECT * FROM recurring_campaigns 
       WHERE enabled = 1 AND next_run_at <= ?`
    )
    .all(now)

  if (dueCampaigns.length === 0) {
    return 0
  }

  let processed = 0

  for (const campaign of dueCampaigns) {
    try {
      await runRecurringCampaign(campaign)
      processed++

      // Update last_run_at and calculate next_run_at
      const nextRun = calculateNextRun(campaign.schedule_cron, campaign.timezone)
      db.run(
        `UPDATE recurring_campaigns 
         SET last_run_at = CURRENT_TIMESTAMP, next_run_at = ?
         WHERE id = ?`,
        [nextRun.toISOString(), campaign.id]
      )

      logger.info('Recurring campaign executed', {
        service: 'recurring-processor',
        campaignId: campaign.id,
        campaignName: campaign.name,
        nextRun: nextRun.toISOString(),
      })
    } catch (error) {
      logger.error(
        'Failed to run recurring campaign',
        {
          service: 'recurring-processor',
          campaignId: campaign.id,
        },
        error as Error
      )
    }
  }

  return processed
}

/**
 * Run a single recurring campaign
 */
async function runRecurringCampaign(campaign: RecurringCampaign): Promise<void> {
  // Fetch recipients
  const recipients = await fetchRecipients(campaign.recipient_source, campaign.recipient_data)

  if (recipients.length === 0) {
    logger.warn('No recipients for recurring campaign', {
      service: 'recurring-processor',
      campaignId: campaign.id,
    })
    return
  }

  // Get template
  let templateBlocks: BlockInput[] = []
  if (campaign.template_id) {
    const template = db
      .query<TemplateRow, [number]>('SELECT id, blocks FROM templates WHERE id = ?')
      .get(campaign.template_id)

    if (template) {
      templateBlocks = JSON.parse(template.blocks) as BlockInput[]
    }
  }

  // Create a regular campaign record for tracking
  const result = db.run(
    `INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, started_at)
     VALUES (?, ?, ?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP)`,
    [
      `${campaign.name} - ${new Date().toLocaleDateString()}`,
      campaign.template_id,
      campaign.subject,
      recipients.length,
      campaign.cc,
      campaign.bcc,
    ]
  )
  const campaignId = Number(result.lastInsertRowid)

  const cc = JSON.parse(campaign.cc || '[]') as string[]
  const bcc = JSON.parse(campaign.bcc || '[]') as string[]
  const trackingSettings = getTrackingSettings()

  // Send to each recipient
  for (const recipient of recipients) {
    const account = getNextAvailableAccount(campaignId)
    if (!account) continue

    try {
      // Compile email
      let html = compileTemplate(templateBlocks, recipient)
      const subject = replaceVariables(campaign.subject, recipient)

      // Add tracking if enabled
      if (trackingSettings.enabled) {
        const token = getOrCreateToken(campaignId, recipient.email)
        html = injectTracking(html, token, trackingSettings.baseUrl, {
          openTracking: trackingSettings.openEnabled,
          clickTracking: trackingSettings.clickEnabled,
        })
      }

      // Send
      const provider = createProvider(account.providerType as 'gmail' | 'smtp', account.config as unknown as Parameters<typeof createProvider>[1])
      await provider.send({
        to: recipient.email,
        cc,
        bcc,
        subject,
        html,
      })
      await provider.disconnect()

      incrementSendCount(account.id)

      db.run(
        `INSERT INTO send_logs (campaign_id, account_id, recipient_email, status)
         VALUES (?, ?, ?, 'sent')`,
        [campaignId, account.id, recipient.email]
      )
    } catch (error) {
      db.run(
        `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message)
         VALUES (?, ?, 'failed', ?)`,
        [campaignId, recipient.email, (error as Error).message]
      )
    }
  }

  // Update campaign stats
  const stats = db
    .query<{ sent: number; failed: number }, [number]>(
      `SELECT 
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM send_logs WHERE campaign_id = ?`
    )
    .get(campaignId)

  db.run(
    `UPDATE campaigns 
     SET successful = ?, failed = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [stats?.sent || 0, stats?.failed || 0, campaignId]
  )
}
