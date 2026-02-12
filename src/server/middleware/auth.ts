import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { queryOne } from '../db'

/**
 * JWT secret for signing and verifying authentication tokens.
 * Defaults to a development secret if not set in environment.
 * @internal
 */
const JWT_SECRET = process.env.JWT_SECRET || 'mailer-jwt-secret-change-in-production'

/**
 * Extended Express Request with optional userId from JWT authentication.
 * @deprecated Use firebaseAuthMiddleware with Express.Request.userId instead
 */
export interface AuthRequest extends Request {
  /** User ID extracted from JWT token */
  userId?: string
}

/**
 * Cache for setup validation to avoid hitting the database on every request.
 * @internal
 */
let isSetupValid: boolean | null = null
let lastSetupCheck = 0
/** Re-check setup status every 60 seconds */
const SETUP_CHECK_INTERVAL = 60000

/**
 * Verifies that initial setup has been completed by checking for password hash in settings.
 * Uses a 60-second cache to avoid excessive database queries.
 * 
 * @returns `true` if setup is complete, `false` otherwise
 * @internal
 */
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

/**
 * Marks the setup as complete and updates the cache immediately.
 * Should be called after successful initial setup to avoid cache delays.
 * 
 * @example
 * ```typescript
 * await createPasswordHash(password)
 * markSetupComplete() // Update cache immediately
 * ```
 */
export function markSetupComplete(): void {
  isSetupValid = true
  lastSetupCheck = Date.now()
}

/**
 * Legacy JWT authentication middleware.
 * 
 * Verifies JWT tokens from:
 * - Authorization header (`Bearer <token>`)
 * - Query parameter (`?token=<token>`) for EventSource/SSE compatibility
 * 
 * Also validates that initial setup has been completed to prevent
 * old tokens from working after a database reset.
 * 
 * @param req - Express request object (will be populated with `userId` on success)
 * @param res - Express response object
 * @param next - Express next function
 * 
 * @returns HTTP 401 if token is missing, invalid, or setup is incomplete
 * 
 * @deprecated Consider using `firebaseAuthMiddleware` for new routes
 * 
 * @example
 * ```typescript
 * import { authMiddleware } from './middleware/auth'
 * 
 * app.get('/api/legacy', authMiddleware, (req, res) => {
 *   console.log('User ID:', req.userId)
 * })
 * 
 * // EventSource example (can't set headers)
 * const eventSource = new EventSource('/api/stream?token=' + token)
 * ```
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  
  // Support token from query param (for EventSource/SSE which can't set headers)
  const queryToken = req.query.token as string | undefined

  let token: string | undefined
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (queryToken) {
    token = queryToken
  }
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' })
  }

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

/**
 * Generates a new JWT authentication token.
 * 
 * Token is valid for 7 days and contains a hardcoded userId of 'admin'.
 * 
 * @returns Signed JWT token string
 * 
 * @deprecated Legacy authentication - consider Firebase tokens for new implementations
 * 
 * @example
 * ```typescript
 * const token = generateToken()
 * res.json({ token })
 * ```
 */
export function generateToken(): string {
  return jwt.sign({ userId: 'admin' }, JWT_SECRET, { expiresIn: '7d' })
}
