import { Router, Request, Response } from 'express'
import { getCampaignAnalytics } from '../services/tracking'
import { queryOne } from '../db'
import { logger } from '../lib/logger'

export const analyticsRouter = Router()

interface CampaignRow {
  id: number
  name: string | null
}

// GET /campaigns/:id/analytics - Get analytics for a campaign
analyticsRouter.get('/campaigns/:id/analytics', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id, 10)

    if (isNaN(campaignId)) {
      res.status(400).json({ error: 'Invalid campaign ID' })
      return
    }

    // Verify campaign exists
    const campaign = await queryOne<CampaignRow>(
      'SELECT id, name FROM campaigns WHERE id = ?',
      [campaignId]
    )

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const analytics = await getCampaignAnalytics(campaignId)

    logger.debug('Fetched campaign analytics', { service: 'analytics', campaignId })

    res.json({
      campaignId,
      campaignName: campaign.name,
      ...analytics,
    })
  } catch (error) {
    logger.error('Failed to fetch campaign analytics', { service: 'analytics', campaignId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})
