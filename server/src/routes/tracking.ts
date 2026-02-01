import { Router } from 'express'
import { recordOpen, recordClick, getTokenDetails } from '../services/tracking'
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
