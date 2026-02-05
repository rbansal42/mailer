import { Request, Response, NextFunction } from 'express'
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { sql } from '../db'

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      userId: string
      user: {
        id: string
        firebaseUid: string
        email: string
        name: string
        isAdmin: boolean
        avatarUrl: string | null
      }
    }
  }
}

interface UserRow {
  id: string
  firebase_uid: string
  email: string
  name: string
  is_admin: boolean
  avatar_url: string | null
}

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

async function migrateExistingData(userId: string) {
  // Will be fully implemented after user_id columns are added to all tables
  console.log('First user registered, data migration will run after schema updates:', userId)
}

// Admin-only middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
