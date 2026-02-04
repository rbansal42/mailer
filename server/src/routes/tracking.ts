import { Router } from 'express'
import { recordOpen, recordClick, recordAction, getActionConfig, getTokenDetails } from '../services/tracking'
import { db } from '../db'
import { logger } from '../lib/logger'

export const trackingRouter = Router()

// 1x1 transparent GIF pixel (base64 decoded)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

// GET /:token/open.gif - Track email open
trackingRouter.get('/:token/open.gif', (req, res) => {
  const { token } = req.params
  const forwarded = req.headers['x-forwarded-for']
  const ipAddress = req.ip || (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
  const userAgent = req.headers['user-agent']

  // Record the open event (fire and forget)
  try {
    recordOpen(token, ipAddress, userAgent)
    logger.debug('Recorded email open', { service: 'tracking', token, type: 'open' })
  } catch (error) {
    logger.error('Failed to record open', { service: 'tracking', token, type: 'open' }, error as Error)
  }

  // Return transparent 1x1 GIF
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  })
  res.send(TRANSPARENT_GIF)
})

// Validate URL is safe to redirect to (prevent open redirect)
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

// GET /:token/c/:linkIndex - Track link click and redirect
trackingRouter.get('/:token/c/:linkIndex', (req, res) => {
  const { token, linkIndex } = req.params
  const url = req.query.url as string

  if (!url) {
    res.status(400).send('Missing url parameter')
    return
  }

  // Validate URL to prevent open redirect attacks
  if (!isValidRedirectUrl(url)) {
    res.status(400).send('Invalid redirect URL')
    return
  }

  // Verify token exists
  let tokenDetails
  try {
    tokenDetails = getTokenDetails(token)
  } catch (error) {
    logger.error('Failed to get token details', { service: 'tracking', token, type: 'click' }, error as Error)
  }
  if (!tokenDetails) {
    // Still redirect even if token invalid (don't break user experience)
    res.redirect(url)
    return
  }

  const forwarded = req.headers['x-forwarded-for']
  const ipAddress = req.ip || (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
  const userAgent = req.headers['user-agent']

  // Record the click event
  try {
    recordClick(token, url, parseInt(linkIndex, 10), ipAddress, userAgent)
    logger.debug('Recorded link click', { service: 'tracking', token, type: 'click', linkIndex: parseInt(linkIndex, 10), url })
  } catch (error) {
    logger.error('Failed to record click', { service: 'tracking', token, type: 'click', url }, error as Error)
  }

  // Redirect to original URL
  res.redirect(url)
})

// GET /:token/action - Track action button click
trackingRouter.get('/:token/action', async (req, res) => {
  try {
    const { token } = req.params
    const forwarded = req.headers['x-forwarded-for']
    const ipAddress = req.ip || (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) || null
    const userAgent = req.headers['user-agent'] || null

    const result = await recordAction(token, ipAddress, userAgent)

    if (!result.success) {
      return res.status(404).send('Not found')
    }

    // Get action config to determine response
    const tokenDetails = await getTokenDetails(token)
    if (!tokenDetails) {
      return res.status(404).send('Not found')
    }

    const sequenceId = Math.abs(tokenDetails.campaignId)
    
    // Find current step from enrollment
    const enrollment = result.enrollment
    const stepResult = await db.execute({
      sql: `SELECT id FROM sequence_steps WHERE sequence_id = ? AND step_order = ?`,
      args: [sequenceId, enrollment.current_step]
    })

    if (!stepResult.rows.length) {
      // Fallback: show default thank you
      return res.send(getHostedThankYouPage('Thank you for your response!'))
    }

    const stepId = stepResult.rows[0].id as number
    const config = await getActionConfig(sequenceId, stepId)

    if (!config) {
      return res.send(getHostedThankYouPage('Thank you for your response!'))
    }

    if (config.destinationType === 'external' && config.destinationUrl) {
      if (isValidRedirectUrl(config.destinationUrl)) {
        return res.redirect(config.destinationUrl)
      }
      // Invalid URL, fall through to hosted page
      logger.warn('Invalid external redirect URL', { service: 'tracking', token, url: config.destinationUrl })
    }

    return res.send(getHostedThankYouPage(config.hostedMessage || 'Thank you for your response!'))
  } catch (error) {
    logger.error('Failed to process action click', { service: 'tracking', token: req.params.token }, error as Error)
    return res.status(500).send('Internal server error')
  }
})

function getHostedThankYouPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .card {
      background: white;
      padding: 48px;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 480px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    .message {
      font-size: 18px;
      color: #374151;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <p class="message">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>
</body>
</html>`
}
