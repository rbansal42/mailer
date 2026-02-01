import { Router, Request, Response } from 'express'
import { queryAll } from '../db'
import { processQueue } from '../services/queue-processor'

export const queueRouter = Router()

interface QueueRow {
  id: number
  campaign_id: number
  recipient_email: string
  recipient_data: string
  scheduled_for: string
  status: string
  created_at: string
}

// GET / - List all queued emails
queueRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await queryAll<QueueRow>('SELECT * FROM email_queue ORDER BY scheduled_for ASC')

    const formatted = items.map((item) => ({
      id: item.id,
      campaignId: item.campaign_id,
      recipientEmail: item.recipient_email,
      recipientData: JSON.parse(item.recipient_data || '{}'),
      scheduledFor: item.scheduled_for,
      status: item.status,
      createdAt: item.created_at,
    }))

    res.json(formatted)
  } catch (error) {
    console.error('Error fetching queue:', error)
    res.status(500).json({ error: 'Failed to fetch queue' })
  }
})

// POST /process - Manually trigger queue processing
queueRouter.post('/process', async (_req: Request, res: Response) => {
  try {
    const result = await processQueue()
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error processing queue:', error)
    res.status(500).json({ error: 'Failed to process queue' })
  }
})
