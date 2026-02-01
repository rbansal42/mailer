import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'

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
  started_at: string | null
  completed_at: string | null
  created_at: string
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

// Delete campaign
campaignsRouter.delete('/:id', async (req, res) => {
  await execute('DELETE FROM campaigns WHERE id = ?', [req.params.id])
  res.status(204).send()
})
