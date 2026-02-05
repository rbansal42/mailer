import { Router, Request, Response } from 'express'
import { compileTemplate } from '../services/template-compiler'
import { logger } from '../lib/logger'

export const previewRouter = Router()

interface Block {
  id: string
  type: string
  props: Record<string, unknown>
}

interface PreviewRequest {
  blocks: Block[]
  recipient: Record<string, string>
}

// POST / - Render email with merge fields
previewRouter.post('/', async (req: Request<{}, {}, PreviewRequest>, res: Response) => {
  try {
    const { blocks, recipient } = req.body

    if (!blocks || !Array.isArray(blocks)) {
      res.status(400).json({ error: 'blocks array is required' })
      return
    }

    if (blocks.length > 100) {
      res.status(400).json({ error: 'Too many blocks (max 100)' })
      return
    }

    if (!recipient || typeof recipient !== 'object') {
      res.status(400).json({ error: 'recipient object is required' })
      return
    }

    if (Object.keys(recipient).length > 50) {
      res.status(400).json({ error: 'Too many recipient fields (max 50)' })
      return
    }

    const baseUrl = process.env.BASE_URL || ''
    const html = compileTemplate(blocks, recipient, baseUrl)

    res.json({ html })
  } catch (error) {
    logger.error('Failed to generate preview', { service: 'preview' }, error as Error)
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})
