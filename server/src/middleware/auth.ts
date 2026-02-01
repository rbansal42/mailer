import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { queryOne } from '../db'

const JWT_SECRET = process.env.JWT_SECRET || 'mailer-jwt-secret-change-in-production'

export interface AuthRequest extends Request {
  userId?: string
}

// Cache the setup check to avoid hitting DB on every request
let isSetupValid: boolean | null = null
let lastSetupCheck = 0
const SETUP_CHECK_INTERVAL = 60000 // Re-check every 60 seconds

async function verifySetupExists(): Promise<boolean> {
  const now = Date.now()
  
  // Use cached value if recent
  if (isSetupValid !== null && (now - lastSetupCheck) < SETUP_CHECK_INTERVAL) {
    return isSetupValid
  }
  
  try {
    const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
    isSetupValid = !!result
    lastSetupCheck = now
    return isSetupValid
  } catch {
    // If DB query fails, invalidate for safety
    isSetupValid = false
    return false
  }
}

// Call this when setup is completed to update cache immediately
export function markSetupComplete(): void {
  isSetupValid = true
  lastSetupCheck = Date.now()
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' })
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    
    // Security check: verify that authentication is actually set up
    // This prevents old tokens from working after database wipe
    const setupExists = await verifySetupExists()
    if (!setupExists) {
      return res.status(401).json({ message: 'Setup required', needsSetup: true })
    }
    
    req.userId = decoded.userId
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}

export function generateToken(): string {
  return jwt.sign({ userId: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
}
