import { Router, Request, Response } from 'express'
import { getCampaignAnalytics } from '../services/tracking'
import { db } from '../db'

export const analyticsRouter = Router()

interface CampaignRow {
  id: number
  name: string | null
}

// GET /campaigns/:id/analytics - Get analytics for a campaign
analyticsRouter.get('/campaigns/:id/analytics', (req: Request<{ id: string }>, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id, 10)

    if (isNaN(campaignId)) {
      res.status(400).json({ error: 'Invalid campaign ID' })
      return
    }

    // Verify campaign exists
    const campaign = db.query<CampaignRow, [number]>(
      'SELECT id, name FROM campaigns WHERE id = ?'
    ).get(campaignId)

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const analytics = getCampaignAnalytics(campaignId)

    res.json({
      campaignId,
      campaignName: campaign.name,
      ...analytics,
    })
  } catch (error) {
    console.error('Error fetching campaign analytics:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})
