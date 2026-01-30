import cron from 'node-cron'
import { db } from '../db'
import { getNextAvailableAccount, incrementSendCount } from './account-manager'
import { compileTemplate } from './template-compiler'
import { createProvider } from '../providers'
import { decrypt } from '../utils/crypto'

interface QueueItem {
  id: number
  campaign_id: number
  recipient_email: string
  recipient_data: string
  scheduled_for: string
  status: string
}

interface Campaign {
  id: number
  name: string | null
  template_id: number | null
  subject: string
  total_recipients: number
  successful: number
  failed: number
  queued: number
}

interface Template {
  id: number
  name: string
  blocks: string
}

interface SenderAccount {
  id: number
  name: string
  provider_type: string
  config: string
  daily_cap: number
  campaign_cap: number
  priority: number
  enabled: number
}

interface ProcessResult {
  processed: number
  failed: number
}

export function startQueueProcessor(): void {
  // Schedule job at 00:01 daily
  cron.schedule('1 0 * * *', () => {
    console.log('[QueueProcessor] Starting scheduled queue processing')
    processQueue()
      .then((result) => {
        console.log(`[QueueProcessor] Completed: ${result.processed} processed, ${result.failed} failed`)
      })
      .catch((error) => {
        console.error('[QueueProcessor] Error processing queue:', error)
      })
  })

  console.log('[QueueProcessor] Scheduled daily at 00:01')
}

export async function processQueue(): Promise<ProcessResult> {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Get pending emails scheduled for today or earlier
  const pendingEmails = db
    .query<QueueItem, [string]>(
      `SELECT id, campaign_id, recipient_email, recipient_data, scheduled_for, status
       FROM email_queue
       WHERE status = 'pending' AND scheduled_for <= ?`
    )
    .all(today)

  let processed = 0
  let failed = 0

  for (const queueItem of pendingEmails) {
    try {
      // Get campaign details
      const campaign = db
        .query<Campaign, [number]>(
          `SELECT id, name, template_id, subject, total_recipients, successful, failed, queued
           FROM campaigns
           WHERE id = ?`
        )
        .get(queueItem.campaign_id)

      if (!campaign) {
        console.error(`[QueueProcessor] Campaign not found for queue item ${queueItem.id}`)
        updateQueueStatus(queueItem.id, 'failed')
        failed++
        continue
      }

      // Get template if exists
      let templateBlocks: unknown[] = []
      if (campaign.template_id) {
        const template = db
          .query<Template, [number]>(`SELECT id, name, blocks FROM templates WHERE id = ?`)
          .get(campaign.template_id)

        if (template) {
          templateBlocks = JSON.parse(template.blocks)
        }
      }

      // Get next available account
      const account = await getNextAvailableAccount()

      if (!account) {
        console.log(`[QueueProcessor] No available accounts, stopping processing`)
        break // Stop processing if no accounts available
      }

      const senderAccount = account as SenderAccount

      // Compile template with recipient data
      const recipientData = JSON.parse(queueItem.recipient_data)
      const html = compileTemplate(templateBlocks, recipientData)

      // Compile subject with variables
      const subject = compileSubject(campaign.subject, recipientData)

      // Decrypt config and create provider
      const decryptedConfig = JSON.parse(decrypt(senderAccount.config))
      const provider = createProvider(senderAccount.provider_type, decryptedConfig)

      try {
        // Send email
        await provider.send({
          to: queueItem.recipient_email,
          subject,
          html,
        })

        // Update queue status
        updateQueueStatus(queueItem.id, 'sent')

        // Increment account send count
        await incrementSendCount(senderAccount.id)

        // Log success
        logSend(queueItem.campaign_id, senderAccount.id, queueItem.recipient_email, 'sent', null)

        // Update campaign stats
        updateCampaignStats(queueItem.campaign_id, 'successful')

        processed++
      } catch (sendError) {
        const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error'

        // Update queue status
        updateQueueStatus(queueItem.id, 'failed')

        // Log failure
        logSend(queueItem.campaign_id, senderAccount.id, queueItem.recipient_email, 'failed', errorMessage)

        // Update campaign stats
        updateCampaignStats(queueItem.campaign_id, 'failed')

        failed++
        console.error(`[QueueProcessor] Failed to send to ${queueItem.recipient_email}:`, errorMessage)
      } finally {
        // Clean up provider connection
        await provider.disconnect()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[QueueProcessor] Error processing queue item ${queueItem.id}:`, errorMessage)

      updateQueueStatus(queueItem.id, 'failed')
      logSend(queueItem.campaign_id, null, queueItem.recipient_email, 'failed', errorMessage)
      updateCampaignStats(queueItem.campaign_id, 'failed')

      failed++
    }
  }

  return { processed, failed }
}

function compileSubject(subject: string, variables: Record<string, unknown>): string {
  return subject.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
  })
}

function updateQueueStatus(queueId: number, status: string): void {
  db.run(`UPDATE email_queue SET status = ? WHERE id = ?`, [status, queueId])
}

function logSend(
  campaignId: number,
  accountId: number | null,
  recipientEmail: string,
  status: string,
  errorMessage: string | null
): void {
  db.run(
    `INSERT INTO send_logs (campaign_id, account_id, recipient_email, status, error_message)
     VALUES (?, ?, ?, ?, ?)`,
    [campaignId, accountId, recipientEmail, status, errorMessage]
  )
}

function updateCampaignStats(campaignId: number, outcome: 'successful' | 'failed'): void {
  const column = outcome === 'successful' ? 'successful' : 'failed'

  db.run(
    `UPDATE campaigns
     SET ${column} = ${column} + 1,
         queued = queued - 1,
         completed_at = CASE
           WHEN successful + failed + 1 >= total_recipients THEN CURRENT_TIMESTAMP
           ELSE completed_at
         END
     WHERE id = ?`,
    [campaignId]
  )
}
