import { Router, Request, Response } from 'express'
import * as cron from 'node-cron'
import { db } from '../db'
import { logger } from '../lib/logger'
import { processRecurringCampaigns, calculateNextRun } from '../services/recurring-processor'

export const recurringRouter = Router()

interface RecurringCampaignRow {
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
  created_at: string
}

// GET / - List all recurring campaigns
recurringRouter.get('/', (_req: Request, res: Response) => {
  try {
    const campaigns = db
      .query<RecurringCampaignRow, []>('SELECT * FROM recurring_campaigns ORDER BY created_at DESC')
      .all()

    res.json(campaigns.map(c => ({
      ...c,
      cc: JSON.parse(c.cc || '[]'),
      bcc: JSON.parse(c.bcc || '[]'),
      enabled: Boolean(c.enabled)
    })))
  } catch (error) {
    logger.error('Failed to list recurring campaigns', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to list recurring campaigns' })
  }
})

// GET /:id - Get single recurring campaign
recurringRouter.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    const campaign = db
      .query<RecurringCampaignRow, [number]>('SELECT * FROM recurring_campaigns WHERE id = ?')
      .get(id)

    if (!campaign) {
      res.status(404).json({ error: 'Recurring campaign not found' })
      return
    }

    res.json({
      ...campaign,
      cc: JSON.parse(campaign.cc || '[]'),
      bcc: JSON.parse(campaign.bcc || '[]'),
      enabled: Boolean(campaign.enabled)
    })
  } catch (error) {
    logger.error('Failed to get recurring campaign', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to get recurring campaign' })
  }
})

// POST / - Create new recurring campaign
recurringRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, templateId, subject, recipientSource, recipientData, scheduleCron, timezone, cc, bcc, enabled } = req.body

    // Validate cron expression
    if (!cron.validate(scheduleCron)) {
      res.status(400).json({ error: 'Invalid cron expression' })
      return
    }

    // Calculate next run time
    const nextRunAt = calculateNextRun(scheduleCron, timezone || 'UTC')

    const result = db.run(
      `INSERT INTO recurring_campaigns 
       (name, template_id, subject, recipient_source, recipient_data, schedule_cron, timezone, cc, bcc, enabled, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        templateId || null,
        subject,
        recipientSource,
        recipientData || null,
        scheduleCron,
        timezone || 'UTC',
        JSON.stringify(cc || []),
        JSON.stringify(bcc || []),
        enabled !== false ? 1 : 0,
        nextRunAt.toISOString()
      ]
    )

    const id = Number(result.lastInsertRowid)
    logger.info('Created recurring campaign', { service: 'recurring', campaignId: id })

    res.status(201).json({ id, message: 'Recurring campaign created' })
  } catch (error) {
    logger.error('Failed to create recurring campaign', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to create recurring campaign' })
  }
})

// PUT /:id - Update recurring campaign
recurringRouter.put('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { name, templateId, subject, recipientSource, recipientData, scheduleCron, timezone, cc, bcc, enabled } = req.body

    // Validate cron expression if provided
    if (scheduleCron && !cron.validate(scheduleCron)) {
      res.status(400).json({ error: 'Invalid cron expression' })
      return
    }

    // Build update query dynamically
    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (templateId !== undefined) { updates.push('template_id = ?'); params.push(templateId) }
    if (subject !== undefined) { updates.push('subject = ?'); params.push(subject) }
    if (recipientSource !== undefined) { updates.push('recipient_source = ?'); params.push(recipientSource) }
    if (recipientData !== undefined) { updates.push('recipient_data = ?'); params.push(recipientData) }
    if (scheduleCron !== undefined) {
      updates.push('schedule_cron = ?')
      params.push(scheduleCron)
      // Recalculate next run
      const nextRunAt = calculateNextRun(scheduleCron, timezone || 'UTC')
      updates.push('next_run_at = ?')
      params.push(nextRunAt.toISOString())
    }
    if (timezone !== undefined) { updates.push('timezone = ?'); params.push(timezone) }
    if (cc !== undefined) { updates.push('cc = ?'); params.push(JSON.stringify(cc)) }
    if (bcc !== undefined) { updates.push('bcc = ?'); params.push(JSON.stringify(bcc)) }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0) }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    params.push(id)
    db.run(`UPDATE recurring_campaigns SET ${updates.join(', ')} WHERE id = ?`, params)

    logger.info('Updated recurring campaign', { service: 'recurring', campaignId: id })
    res.json({ message: 'Recurring campaign updated' })
  } catch (error) {
    logger.error('Failed to update recurring campaign', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to update recurring campaign' })
  }
})

// DELETE /:id - Delete recurring campaign
recurringRouter.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    db.run('DELETE FROM recurring_campaigns WHERE id = ?', [id])
    
    logger.info('Deleted recurring campaign', { service: 'recurring', campaignId: id })
    res.json({ message: 'Recurring campaign deleted' })
  } catch (error) {
    logger.error('Failed to delete recurring campaign', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to delete recurring campaign' })
  }
})

// POST /:id/run - Manually trigger a run
recurringRouter.post('/:id/run', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    
    // Update next_run_at to now to trigger immediate execution
    db.run(
      `UPDATE recurring_campaigns SET next_run_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    )

    // Process immediately
    const processed = await processRecurringCampaigns()

    logger.info('Manually triggered recurring campaign', { service: 'recurring', campaignId: id })
    res.json({ message: 'Recurring campaign triggered', processed })
  } catch (error) {
    logger.error('Failed to trigger recurring campaign', { service: 'recurring' }, error as Error)
    res.status(500).json({ error: 'Failed to trigger recurring campaign' })
  }
})
