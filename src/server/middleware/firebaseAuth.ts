import { Request, Response, NextFunction } from 'express'
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { sql } from '../db'

/**
 * Extends Express Request with authenticated user information.
 * These properties are set by the firebaseAuthMiddleware after successful authentication.
 */
declare global {
  namespace Express {
    interface Request {
      /** Database ID of the authenticated user */
      userId: string
      /** Complete user object with profile information */
      user: {
        /** Database ID */
        id: string
        /** Firebase UID for cross-referencing with Firebase Auth */
        firebaseUid: string
        /** User's verified email address */
        email: string
        /** Display name */
        name: string
        /** Whether the user has admin privileges */
        isAdmin: boolean
        /** Optional profile picture URL */
        avatarUrl: string | null
      }
    }
  }
}

/**
 * Database row structure for users table.
 * @internal
 */
interface UserRow {
  id: string
  firebase_uid: string
  email: string
  name: string
  is_admin: boolean
  avatar_url: string | null
}

/**
 * Express middleware for Firebase authentication.
 * 
 * Verifies Firebase ID tokens from the Authorization header and:
 * 1. Validates the token and checks email verification
 * 2. Gets or creates a local user record in the database
 * 3. Auto-promotes the first user to admin
 * 4. Migrates existing data to the first admin user
 * 5. Attaches user information to the request object
 * 
 * @param req - Express request object (will be populated with `userId` and `user` on success)
 * @param res - Express response object
 * @param next - Express next function
 * 
 * @returns HTTP 500 if Firebase is not configured,
 *          HTTP 401 if token is missing or invalid,
 *          HTTP 403 if email is not verified
 * 
 * @example
 * ```typescript
 * import { firebaseAuthMiddleware } from './middleware/firebaseAuth'
 * 
 * app.get('/api/protected', firebaseAuthMiddleware, (req, res) => {
 *   console.log('Authenticated user:', req.user)
 *   res.json({ userId: req.userId })
 * })
 * ```
 */
export async function firebaseAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!isFirebaseConfigured()) {
    return res.status(500).json({ error: 'Firebase not configured' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = await firebaseAuth!.verifyIdToken(token)
    
    if (!decoded.email_verified) {
      return res.status(403).json({ error: 'Email not verified' })
    }

    // Get or create local user
    let rows = await sql<UserRow[]>`
      SELECT * FROM users WHERE firebase_uid = ${decoded.uid}
    `

    let user: UserRow
    if (rows.length === 0) {
      // Insert user without admin flag first
      const newRows = await sql<UserRow[]>`
        INSERT INTO users (firebase_uid, email, name, is_admin, avatar_url)
        VALUES (
          ${decoded.uid},
          ${decoded.email!},
          ${decoded.name || decoded.email!.split('@')[0]},
          false,
          ${decoded.picture ?? null}
        )
        RETURNING *
      `
      user = newRows[0]

      // Atomically promote to admin if this is the first user
      // This prevents race conditions where two simultaneous registrations
      // could both see count=0 and both become admins
      const promoted = await sql<{ is_admin: boolean }[]>`
        UPDATE users 
        SET is_admin = true 
        WHERE id = ${user.id} 
        AND (SELECT COUNT(*) FROM users) = 1
        RETURNING is_admin
      `
      
      if (promoted.length > 0) {
        user.is_admin = true
        await migrateExistingData(user.id)
      }
    } else {
      user = rows[0]
    }

    req.userId = user.id
    req.user = {
      id: user.id,
      firebaseUid: user.firebase_uid,
      email: user.email,
      name: user.name,
      isAdmin: user.is_admin,
      avatarUrl: user.avatar_url
    }

    next()
  } catch (error) {
    console.error('Firebase auth error:', error)
    return res.status(401).json({ error: 'Invalid token' })
  }
}

/**
 * Migrates all existing orphaned data to the first admin user.
 * 
 * This function is called when the first user registers and is auto-promoted to admin.
 * It assigns ownership of all records with `user_id = NULL` to the new admin,
 * ensuring a smooth transition from single-user to multi-user mode.
 * 
 * Tables migrated:
 * - sender_accounts, campaigns, mails, drafts
 * - sequences, recurring_campaigns
 * - certificate_configs, generated_certificates
 * - contacts, lists
 * - media, attachments
 * - templates (non-system only)
 * 
 * @param userId - Database ID of the first admin user
 * @internal
 */
async function migrateExistingData(userId: string) {
  console.log('Migrating existing data to first user:', userId)
  
  // Migrate all user-scoped tables
  await sql`UPDATE sender_accounts SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE campaigns SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE mails SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE drafts SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE sequences SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE recurring_campaigns SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE certificate_configs SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE generated_certificates SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE contacts SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE lists SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE media SET user_id = ${userId} WHERE user_id IS NULL`
  await sql`UPDATE attachments SET user_id = ${userId} WHERE user_id IS NULL`
  
  // Keep non-system templates for admin
  await sql`UPDATE templates SET user_id = ${userId} WHERE is_system = false AND user_id IS NULL`
  
  // Settings with user_id=NULL are system defaults, leave them
  // User-specific settings will be created as users configure their preferences
  
  console.log('Data migration complete')
}

/**
 * Express middleware that requires admin privileges.
 * 
 * Must be used after `firebaseAuthMiddleware` to ensure `req.user` is populated.
 * Returns HTTP 403 if the authenticated user is not an admin.
 * 
 * @param req - Express request object (must have `user` from firebaseAuthMiddleware)
 * @param res - Express response object
 * @param next - Express next function
 * 
 * @returns HTTP 403 if user is not an admin
 * 
 * @example
 * ```typescript
 * import { firebaseAuthMiddleware, requireAdmin } from './middleware/firebaseAuth'
 * 
 * app.delete('/api/admin/users/:id',
 *   firebaseAuthMiddleware,
 *   requireAdmin,
 *   (req, res) => {
 *     // Only admins can reach this handler
 *     console.log('Admin user:', req.user.email)
 *   }
 * )
 * ```
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
