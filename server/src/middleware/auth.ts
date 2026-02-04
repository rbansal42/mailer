import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { queryOne } from '../db'
import { logger } from '../lib/logger'

const SERVICE = 'auth-middleware'
const JWT_SECRET = process.env.JWT_SECRET || 'mailer-jwt-secret-change-in-production'

export interface AuthRequest extends Request {
  userId?: string
  requestId?: string
}

// Cache the setup check to avoid hitting DB on every request
let isSetupValid: boolean | null = null
let lastSetupCheck = 0
const SETUP_CHECK_INTERVAL = 60000 // Re-check every 60 seconds

async function verifySetupExists(): Promise<boolean> {
  const now = Date.now()

  // Use cached value if recent
  if (isSetupValid !== null && (now - lastSetupCheck) < SETUP_CHECK_INTERVAL) {
    logger.debug('Using cached setup status', { service: SERVICE, isSetupValid })
    return isSetupValid
  }

  try {
    const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
    isSetupValid = !!result
    lastSetupCheck = now
    logger.debug('Setup status verified from database', { service: SERVICE, isSetupValid })
    return isSetupValid
  } catch (error) {
    // If DB query fails, invalidate for safety
    logger.error('Failed to verify setup status', { service: SERVICE }, error as Error)
    isSetupValid = false
    return false
  }
}

// Call this when setup is completed to update cache immediately
export function markSetupComplete(): void {
  isSetupValid = true
  lastSetupCheck = Date.now()
  logger.info('Setup marked as complete', { service: SERVICE })
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const requestId = req.requestId

  // Support token from query param (for EventSource/SSE which can't set headers)
  const queryToken = req.query.token as string | undefined

  let token: string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (queryToken) {
    token = queryToken
  }

  if (!token) {
    logger.warn('Authentication failed: no token provided', {
      service: SERVICE,
      requestId,
      path: req.path,
      method: req.method
    })
    return res.status(401).json({ message: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }

    // Security check: verify that authentication is actually set up
    // This prevents old tokens from working after database wipe
    const setupExists = await verifySetupExists()
    if (!setupExists) {
      logger.warn('Authentication failed: setup required', {
        service: SERVICE,
        requestId,
        path: req.path
      })
      return res.status(401).json({ message: 'Setup required', needsSetup: true })
    }

    req.userId = decoded.userId
    logger.debug('Authentication successful', {
      service: SERVICE,
      requestId,
      userId: decoded.userId,
      path: req.path
    })
    next()
  } catch (error) {
    logger.warn('Authentication failed: invalid token', {
      service: SERVICE,
      requestId,
      path: req.path,
      error: (error as Error).message
    })
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function generateToken(): string {
  logger.info('Generating new authentication token', { service: SERVICE })
  try {
    const token = jwt.sign({ userId: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
    logger.debug('Token generated successfully', { service: SERVICE })
    return token
  } catch (error) {
    logger.error('Failed to generate token', { service: SERVICE }, error as Error)
    throw error
  }
}
