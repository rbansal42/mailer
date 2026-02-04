import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'
import { logger } from '../lib/logger'
import { getUniqueDraftName } from './drafts'

export const campaignsRouter = Router()

interface CampaignRow {
  id: number
  name: string | null
  template_id: number | null
  subject: string
  total_recipients: number
  successful: number
  failed: number
  queued: number
  status: string | null
  scheduled_for: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  cc: string
  bcc: string
}

interface SendLogRow {
  id: number
  campaign_id: number
  account_id: number | null
  recipient_email: string
  status: string
  error_message: string | null
  sent_at: string
}

function formatCampaign(row: CampaignRow) {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    subject: row.subject,
    totalRecipients: row.total_recipients,
    successful: row.successful,
    failed: row.failed,
    queued: row.queued,
    status: row.status,
    scheduledFor: row.scheduled_for,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }
}

function formatSendLog(row: SendLogRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    accountId: row.account_id,
    recipientEmail: row.recipient_email,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
  }
}

// List campaigns
campaignsRouter.get('/', async (_, res) => {
  const rows = await queryAll<CampaignRow>('SELECT * FROM campaigns ORDER BY created_at DESC')
  res.json(rows.map(formatCampaign))
})

// Get campaign with logs
campaignsRouter.get('/:id', async (req, res) => {
  const campaign = await queryOne<CampaignRow>('SELECT * FROM campaigns WHERE id = ?', [req.params.id])
  if (!campaign) {
    return res.status(404).json({ message: 'Campaign not found' })
  }

  const logs = await queryAll<SendLogRow>('SELECT * FROM send_logs WHERE campaign_id = ? ORDER BY sent_at DESC', [req.params.id])

  res.json({
    ...formatCampaign(campaign),
    logs: logs.map(formatSendLog),
  })
})

// Duplicate campaign (creates a new draft)
campaignsRouter.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid campaign ID' })
      return
    }

    const campaign = await queryOne<CampaignRow>(
      'SELECT * FROM campaigns WHERE id = ?',
      [id]
    )

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const newName = await getUniqueDraftName(`Copy of ${campaign.name || 'Untitled'}`)

    // Determine if the stored template_id is actually a template or mail
    // Campaigns store either template ID or mail ID in the template_id column
    let templateId: number | null = null
    let mailId: number | null = null

    if (campaign.template_id) {
      // Check if it's a template first
      const template = await queryOne<{ id: number }>('SELECT id FROM templates WHERE id = ?', [campaign.template_id])
      if (template) {
        templateId = campaign.template_id
      } else {
        // Must be a mail
        mailId = campaign.template_id
      }
    }

    const result = await execute(
      `INSERT INTO drafts (name, template_id, mail_id, subject, cc, bcc)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        newName,
        templateId,
        mailId,
        campaign.subject ?? null,
        campaign.cc ? JSON.stringify(campaign.cc) : null,
        campaign.bcc ? JSON.stringify(campaign.bcc) : null,
      ]
    )

    res.json({ id: Number(result.lastInsertRowid), name: newName })
  } catch (error) {
    logger.error('Failed to duplicate campaign', { service: 'campaigns' }, error as Error)
    res.status(500).json({ error: 'Failed to duplicate campaign' })
  }
})

// Delete campaign
campaignsRouter.delete('/:id', async (req, res) => {
  await execute('DELETE FROM campaigns WHERE id = ?', [req.params.id])
  res.status(204).send()
})
