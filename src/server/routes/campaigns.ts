import { Router } from 'express'
import { queryAll, queryOne, execute, sql } from '../db'
import { bulkIdsSchema, validate } from '../lib/validation'
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
campaignsRouter.get('/', async (req, res) => {
  const rows = await queryAll<CampaignRow>('SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC', [req.userId])
  res.json(rows.map(formatCampaign))
})

// Get campaign with logs
campaignsRouter.get('/:id', async (req, res) => {
  const campaign = await queryOne<CampaignRow>('SELECT * FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
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
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?',
      [id, req.userId]
    )

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const newName = await getUniqueDraftName(`Copy of ${campaign.name || 'Untitled'}`, req.userId)

    // Determine if the stored template_id is actually a template or mail
    // Campaigns store either template ID or mail ID in the template_id column
    let templateId: number | null = null
    let mailId: number | null = null

    if (campaign.template_id) {
      // Check if it's a template first (user's own or system template)
      const template = await queryOne<{ id: number }>(
        'SELECT id FROM templates WHERE id = ? AND (user_id = ? OR is_system = true)',
        [campaign.template_id, req.userId]
      )
      if (template) {
        templateId = campaign.template_id
      } else {
        // Must be a mail
        mailId = campaign.template_id
      }
    }

    const result = await execute(
      `INSERT INTO drafts (name, template_id, mail_id, subject, cc, bcc, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        newName,
        templateId,
        mailId,
        campaign.subject ?? null,
        campaign.cc ? JSON.stringify(campaign.cc) : null,
        campaign.bcc ? JSON.stringify(campaign.bcc) : null,
        req.userId,
      ]
    )

    res.json({ id: Number(result.lastInsertRowid), name: newName })
  } catch (error) {
    logger.error('Failed to duplicate campaign', { service: 'campaigns' }, error as Error)
    res.status(500).json({ error: 'Failed to duplicate campaign' })
  }
})

// Bulk delete campaigns
campaignsRouter.delete('/bulk', async (req, res) => {
  const v = validate(bulkIdsSchema, req.body)
  if (!v.success) {
    return res.status(400).json({ error: v.error })
  }

  const { ids } = v.data

  try {
    const result = await sql.begin(async (tx: any) => {
      const placeholders = ids.map((_: number, i: number) => `$${i + 1}`).join(', ')
      // Delete campaigns first with user_id check, get their IDs
      const rows = await tx.unsafe(
        `DELETE FROM campaigns WHERE id IN (${placeholders}) AND user_id = $${ids.length + 1} RETURNING id`,
        [...ids, req.userId]
      )
      // Only delete send_logs for campaigns that were actually owned by this user
      if (rows.length > 0) {
        const deletedIds = rows.map((r: { id: number }) => r.id)
        const logPlaceholders = deletedIds.map((_: number, i: number) => `$${i + 1}`).join(', ')
        await tx.unsafe(
          `DELETE FROM send_logs WHERE campaign_id IN (${logPlaceholders})`,
          deletedIds
        )
      }
      return rows.length
    })

    logger.info('Bulk campaigns deleted', { deleted: result, ids })
    res.json({ deleted: result })
  } catch (error) {
    logger.error('Failed to bulk delete campaigns', {}, error as Error)
    res.status(500).json({ error: 'Failed to bulk delete campaigns' })
  }
})

// Bulk duplicate campaigns (creates new drafts)
campaignsRouter.post('/bulk-duplicate', async (req, res) => {
  const v = validate(bulkIdsSchema, req.body)
  if (!v.success) {
    return res.status(400).json({ error: v.error })
  }

  const { ids } = v.data

  try {
    const created = await sql.begin(async (tx: any) => {
      let count = 0
      for (const id of ids) {
        const rows = await tx.unsafe(
          `SELECT * FROM campaigns WHERE id = $1 AND user_id = $2`,
          [id, req.userId]
        )
        const campaign = rows[0] as CampaignRow | undefined
        if (!campaign) continue

        const newName = await getUniqueDraftName(`Copy of ${campaign.name || 'Untitled'}`, req.userId)

        let templateId: number | null = null
        let mailId: number | null = null

        if (campaign.template_id) {
          const tRows = await tx.unsafe(
            `SELECT id FROM templates WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
            [campaign.template_id, req.userId]
          )
          if (tRows.length > 0) {
            templateId = campaign.template_id
          } else {
            mailId = campaign.template_id
          }
        }

        await tx.unsafe(
          `INSERT INTO drafts (name, template_id, mail_id, subject, cc, bcc, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            newName,
            templateId,
            mailId,
            campaign.subject ?? null,
            campaign.cc ? JSON.stringify(campaign.cc) : null,
            campaign.bcc ? JSON.stringify(campaign.bcc) : null,
            req.userId,
          ]
        )
        count++
      }
      return count
    })

    logger.info('Bulk campaigns duplicated', { created, ids })
    res.json({ created })
  } catch (error) {
    logger.error('Failed to bulk duplicate campaigns', {}, error as Error)
    res.status(500).json({ error: 'Failed to bulk duplicate campaigns' })
  }
})

// Delete campaign
campaignsRouter.delete('/:id', async (req, res) => {
  await execute('DELETE FROM campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
  res.status(204).send()
})
