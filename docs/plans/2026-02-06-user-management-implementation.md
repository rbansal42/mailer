# User Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform single-user mailer into multi-tenant system with Firebase auth and admin panel.

**Architecture:** Firebase handles authentication (email/password + Google OAuth). Local `users` table stores app-specific data. All user-scoped tables get `user_id` foreign key. Admin panel provides user management and analytics.

**Tech Stack:** Firebase Admin SDK (backend), Firebase JS SDK (frontend), PostgreSQL, React, Express

---

## Phase 1: Database & Core Auth Infrastructure

### Task 1.1: Create Users Table Migration

**Files:**
- Create: `server/src/db/migrations/010_users.ts`
- Modify: `server/src/db/schema.ts`

**Implementation:**

```typescript
// server/src/db/migrations/010_users.ts
import { sql } from '../index'

export async function up() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  
  await sql`CREATE INDEX idx_users_firebase_uid ON users(firebase_uid)`
  await sql`CREATE INDEX idx_users_email ON users(email)`
}

export async function down() {
  await sql`DROP TABLE IF EXISTS users`
}
```

Update schema.ts to include users table creation in `initializeDatabase()`.

**Verification:**
```bash
bun run build
```

---

### Task 1.2: Install Firebase Admin SDK

**Files:**
- Modify: `server/package.json`
- Create: `server/src/lib/firebase.ts`
- Modify: `.env.example`

**Implementation:**

```bash
cd server && bun add firebase-admin
```

```typescript
// server/src/lib/firebase.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null

if (getApps().length === 0 && serviceAccount) {
  initializeApp({
    credential: cert(serviceAccount)
  })
}

export const firebaseAuth = serviceAccount ? getAuth() : null

export function isFirebaseConfigured(): boolean {
  return firebaseAuth !== null
}
```

Add to `.env.example`:
```
# Firebase (JSON service account key, single line)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

**Verification:**
```bash
bun run build
```

---

### Task 1.3: Create Firebase Auth Middleware

**Files:**
- Create: `server/src/middleware/firebaseAuth.ts`
- Modify: `server/src/middleware/auth.ts` (deprecate old auth)

**Implementation:**

```typescript
// server/src/middleware/firebaseAuth.ts
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
      // Check if first user (becomes admin)
      const countResult = await sql<{count: string}[]>`SELECT COUNT(*) as count FROM users`
      const isFirstUser = parseInt(countResult[0].count) === 0

      const newRows = await sql<UserRow[]>`
        INSERT INTO users (firebase_uid, email, name, is_admin, avatar_url)
        VALUES (
          ${decoded.uid},
          ${decoded.email!},
          ${decoded.name || decoded.email!.split('@')[0]},
          ${isFirstUser},
          ${decoded.picture ?? null}
        )
        RETURNING *
      `
      user = newRows[0]
      
      // If first user, migrate existing data
      if (isFirstUser) {
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
  // Will be implemented after user_id columns are added
  console.log('First user registered, data migration pending:', userId)
}

// Admin-only middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
```

**Verification:**
```bash
bun run build
```

---

### Task 1.4: Create User Profile Routes

**Files:**
- Create: `server/src/routes/users.ts`
- Modify: `server/src/routes/index.ts`

**Implementation:**

```typescript
// server/src/routes/users.ts
import { Router } from 'express'
import { sql } from '../db'
import { firebaseAuth } from '../lib/firebase'

const router = Router()

// GET /api/users/me - Get current user profile
router.get('/me', async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      isAdmin: req.user.isAdmin,
      avatarUrl: req.user.avatarUrl
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Failed to get profile' })
  }
})

// PATCH /api/users/me - Update profile
router.patch('/me', async (req, res) => {
  try {
    const { name } = req.body
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const rows = await sql<{id: string, name: string}[]>`
      UPDATE users 
      SET name = ${name.trim()}, updated_at = NOW()
      WHERE id = ${req.userId}
      RETURNING id, name
    `

    res.json(rows[0])
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// DELETE /api/users/me - Delete account and all data
router.delete('/me', async (req, res) => {
  try {
    // Delete all user data (cascade will handle related records)
    // Order matters due to foreign keys
    await sql`DELETE FROM users WHERE id = ${req.userId}`
    
    // Delete from Firebase
    if (firebaseAuth) {
      await firebaseAuth.deleteUser(req.user.firebaseUid)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

export default router
```

Add to routes/index.ts:
```typescript
import usersRouter from './users'
// ...
router.use('/users', usersRouter)
```

**Verification:**
```bash
bun run build
```

---

### Task 1.5: Add is_system Column to Templates

**Files:**
- Create: `server/src/db/migrations/011_templates_is_system.ts`

**Implementation:**

```typescript
// server/src/db/migrations/011_templates_is_system.ts
import { sql } from '../index'

export async function up() {
  await sql`ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`
  
  // Mark existing default templates as system templates
  await sql`UPDATE templates SET is_system = true WHERE is_default = true`
}

export async function down() {
  await sql`ALTER TABLE templates DROP COLUMN IF EXISTS is_system`
}
```

**Verification:**
```bash
bun run build
```

---

## Phase 2: Data Isolation - Add user_id to Tables

Each task modifies one table to add user_id and updates corresponding route.

### Task 2.1: sender_accounts + accounts.ts

**Files:**
- Create: `server/src/db/migrations/012_sender_accounts_user_id.ts`
- Modify: `server/src/routes/accounts.ts`

**Migration:**
```typescript
import { sql } from '../index'

export async function up() {
  await sql`ALTER TABLE sender_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`
  await sql`CREATE INDEX IF NOT EXISTS idx_sender_accounts_user_id ON sender_accounts(user_id)`
}

export async function down() {
  await sql`DROP INDEX IF EXISTS idx_sender_accounts_user_id`
  await sql`ALTER TABLE sender_accounts DROP COLUMN IF EXISTS user_id`
}
```

**Route changes:**
- All SELECT queries add `WHERE user_id = ${req.userId}`
- All INSERT queries add `user_id` column with `${req.userId}` value
- Verify ownership on UPDATE/DELETE: `WHERE id = ${id} AND user_id = ${req.userId}`

---

### Task 2.2: templates + templates.ts

**Files:**
- Create: `server/src/db/migrations/013_templates_user_id.ts`
- Modify: `server/src/routes/templates.ts`

**Migration:** Same pattern as 2.1

**Route changes:**
- SELECT: `WHERE user_id = ${req.userId} OR is_system = true`
- INSERT: Add `user_id = ${req.userId}`, `is_system = false`
- UPDATE/DELETE: Only allow on user's own templates (not system): `WHERE id = ${id} AND user_id = ${req.userId}`

---

### Task 2.3: mails + mails.ts

**Files:**
- Create: `server/src/db/migrations/014_mails_user_id.ts`
- Modify: `server/src/routes/mails.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.4: drafts + drafts.ts

**Files:**
- Create: `server/src/db/migrations/015_drafts_user_id.ts`
- Modify: `server/src/routes/drafts.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.5: campaigns + campaigns.ts

**Files:**
- Create: `server/src/db/migrations/016_campaigns_user_id.ts`
- Modify: `server/src/routes/campaigns.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.6: sequences + sequences.ts

**Files:**
- Create: `server/src/db/migrations/017_sequences_user_id.ts`
- Modify: `server/src/routes/sequences.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.7: recurring_campaigns + recurring.ts

**Files:**
- Create: `server/src/db/migrations/018_recurring_campaigns_user_id.ts`
- Modify: `server/src/routes/recurring.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.8: certificate_configs + certificates.ts

**Files:**
- Create: `server/src/db/migrations/019_certificates_user_id.ts`
- Modify: `server/src/routes/certificates.ts`

**Migration:** Add user_id to both `certificate_configs` and `generated_certificates`

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.9: contacts + lists + contacts routes

**Files:**
- Create: `server/src/db/migrations/020_contacts_user_id.ts`
- Modify: `server/src/routes/contacts/lists.ts`
- Modify: `server/src/routes/contacts/members.ts`

**Migration:** Add user_id to `contacts` and `lists` tables

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.10: media + media.ts

**Files:**
- Create: `server/src/db/migrations/021_media_user_id.ts`
- Modify: `server/src/routes/media.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.11: attachments + attachments.ts

**Files:**
- Create: `server/src/db/migrations/022_attachments_user_id.ts`
- Modify: `server/src/routes/attachments.ts`

**Migration:** Same pattern as 2.1

**Route changes:** Standard user_id filtering pattern.

---

### Task 2.12: settings + settings.ts

**Files:**
- Create: `server/src/db/migrations/023_settings_user_id.ts`
- Modify: `server/src/routes/settings.ts`

**Migration:**
```typescript
import { sql } from '../index'

export async function up() {
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`
  await sql`CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)`
  // Existing settings become system defaults (user_id = NULL)
}

export async function down() {
  await sql`DROP INDEX IF EXISTS idx_settings_user_id`
  await sql`ALTER TABLE settings DROP COLUMN IF EXISTS user_id`
}
```

**Route changes:**
- GET: Return user setting if exists, else system default
- SET: Create/update user-specific setting

---

### Task 2.13: Switch Auth Middleware

**Files:**
- Modify: `server/src/routes/index.ts`

**Implementation:**

Replace old authMiddleware with firebaseAuthMiddleware for all protected routes.
Keep old `/api/auth` routes but return 410 Gone.

```typescript
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'

// Replace:
// router.use(authMiddleware)
// With:
router.use(firebaseAuthMiddleware)
```

---

## Phase 3: Frontend Auth

### Task 3.1: Install Firebase SDK

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/firebase.ts`

**Implementation:**

```bash
cd frontend && bun add firebase
```

```typescript
// frontend/src/lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
```

Add to `.env.example`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
```

---

### Task 3.2: Create New Auth Store

**Files:**
- Modify: `frontend/src/hooks/useAuthStore.ts`

**Implementation:**

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'

interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  impersonating: User | null
  originalToken: string | null
  
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  resendVerification: () => Promise<void>
  fetchUser: () => Promise<void>
  startImpersonation: (userId: string) => Promise<void>
  stopImpersonation: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLoading: true,
      impersonating: null,
      originalToken: null,

      initialize: async () => {
        return new Promise((resolve) => {
          onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser && firebaseUser.emailVerified) {
              set({ firebaseUser, isLoading: false })
              await get().fetchUser()
              set({ isAuthenticated: true })
            } else {
              set({ 
                user: null, 
                firebaseUser, 
                isAuthenticated: false, 
                isLoading: false 
              })
            }
            resolve()
          })
        })
      },

      login: async (email, password) => {
        const result = await signInWithEmailAndPassword(auth, email, password)
        if (!result.user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }
        set({ firebaseUser: result.user })
        await get().fetchUser()
        set({ isAuthenticated: true })
      },

      register: async (email, password, name) => {
        const result = await createUserWithEmailAndPassword(auth, email, password)
        await sendEmailVerification(result.user)
        // User needs to verify email before they can use the app
        set({ firebaseUser: result.user, isAuthenticated: false })
      },

      loginWithGoogle: async () => {
        const result = await signInWithPopup(auth, googleProvider)
        set({ firebaseUser: result.user })
        await get().fetchUser()
        set({ isAuthenticated: true })
      },

      logout: async () => {
        await signOut(auth)
        set({ 
          user: null, 
          firebaseUser: null, 
          isAuthenticated: false,
          impersonating: null,
          originalToken: null
        })
      },

      resetPassword: async (email) => {
        await sendPasswordResetEmail(auth, email)
      },

      resendVerification: async () => {
        const { firebaseUser } = get()
        if (firebaseUser) {
          await sendEmailVerification(firebaseUser)
        }
      },

      fetchUser: async () => {
        const { firebaseUser } = get()
        if (!firebaseUser) return

        const token = await firebaseUser.getIdToken()
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.ok) {
          const user = await response.json()
          set({ user })
        }
      },

      startImpersonation: async (userId) => {
        // Implementation for admin impersonation
      },

      stopImpersonation: async () => {
        // Implementation for stopping impersonation
      }
    }),
    {
      name: 'mailer-auth',
      partialize: (state) => ({
        // Don't persist sensitive data
      })
    }
  )
)
```

---

### Task 3.3: Update API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Implementation:**

Update the API client to use Firebase tokens instead of the old auth system:

```typescript
import { auth } from './firebase'

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  if (!user) return {}
  
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

// Update all API functions to use getAuthHeaders()
```

---

### Task 3.4: Create Register Page

**Files:**
- Create: `frontend/src/pages/Register.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Implementation:**

Create registration page with:
- Email input
- Password input (with confirmation)
- Name input
- "Sign up with Google" button
- Link to login page

---

### Task 3.5: Create Verify Email Page

**Files:**
- Create: `frontend/src/pages/VerifyEmail.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Implementation:**

Create verify email page with:
- "Check your email" message
- Resend verification button
- Link to login page

---

### Task 3.6: Create Forgot Password Page

**Files:**
- Create: `frontend/src/pages/ForgotPassword.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Implementation:**

Create forgot password page with:
- Email input
- Submit button
- Success message
- Link to login page

---

### Task 3.7: Update Login Page

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

**Implementation:**

Update login page to use Firebase:
- Email/password form
- "Sign in with Google" button
- "Forgot password?" link
- "Create account" link
- Handle EMAIL_NOT_VERIFIED error (redirect to verify page)

---

### Task 3.8: Create Account Settings Page

**Files:**
- Create: `frontend/src/pages/AccountSettings.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Implementation:**

Create account settings page with:
- Profile section (name edit)
- Email section (shows current email, link to Firebase console for change)
- Password section (link to Firebase console for change)
- Danger zone (delete account with confirmation)

---

### Task 3.9: Update Layout with User Menu

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Implementation:**

Add to header:
- User avatar (or initials)
- Dropdown with: Account Settings, Admin (if isAdmin), Logout

---

## Phase 4: Admin Panel Backend

### Task 4.1: Create Admin Middleware

**Files:**
- Create: `server/src/middleware/admin.ts`

**Implementation:**

```typescript
import { Request, Response, NextFunction } from 'express'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}
```

---

### Task 4.2: Create Admin Users Routes

**Files:**
- Create: `server/src/routes/admin/users.ts`
- Modify: `server/src/routes/index.ts`

**Implementation:**

```typescript
// GET /api/admin/users - List all users (paginated)
// GET /api/admin/users/:id - Get user details + stats
// PATCH /api/admin/users/:id - Edit user
// POST /api/admin/users/:id/suspend - Suspend user
// POST /api/admin/users/:id/unsuspend - Unsuspend user
// DELETE /api/admin/users/:id - Delete user
// POST /api/admin/users/:id/impersonate - Generate impersonation token
```

---

### Task 4.3: Create Admin Analytics Routes

**Files:**
- Create: `server/src/routes/admin/analytics.ts`
- Modify: `server/src/routes/index.ts`

**Implementation:**

```typescript
// GET /api/admin/analytics/overview - Dashboard stats
// GET /api/admin/analytics/users - User metrics over time
// GET /api/admin/analytics/emails - Email metrics
// GET /api/admin/analytics/storage - Storage metrics
```

---

### Task 4.4: Create Admin Settings Routes

**Files:**
- Create: `server/src/routes/admin/settings.ts`
- Modify: `server/src/routes/index.ts`

**Implementation:**

```typescript
// GET /api/admin/settings - Get all system settings
// PATCH /api/admin/settings - Update system settings
```

---

### Task 4.5: Create Admin Router Index

**Files:**
- Create: `server/src/routes/admin/index.ts`
- Modify: `server/src/routes/index.ts`

**Implementation:**

```typescript
import { Router } from 'express'
import { requireAdmin } from '../../middleware/admin'
import usersRouter from './users'
import analyticsRouter from './analytics'
import settingsRouter from './settings'

const router = Router()

// All admin routes require admin access
router.use(requireAdmin)

router.use('/users', usersRouter)
router.use('/analytics', analyticsRouter)
router.use('/settings', settingsRouter)

export default router
```

---

## Phase 5: Admin Panel Frontend

### Task 5.1: Create Admin Layout

**Files:**
- Create: `frontend/src/components/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`

**Implementation:**

Create admin layout with:
- Admin-specific sidebar (Dashboard, Users, Settings)
- Breadcrumb navigation
- Back to main app link

---

### Task 5.2: Create Admin Dashboard Page

**Files:**
- Create: `frontend/src/pages/admin/Dashboard.tsx`

**Implementation:**

Create dashboard with:
- User count card
- Total emails sent card
- Storage used card
- Recent signups list
- Activity chart (emails over time)

---

### Task 5.3: Create Admin Users List Page

**Files:**
- Create: `frontend/src/pages/admin/Users.tsx`

**Implementation:**

Create users list with:
- Search by name/email
- Filter by status (active/suspended)
- Table with: Name, Email, Status, Created, Last Active, Actions
- Pagination

---

### Task 5.4: Create Admin User Detail Page

**Files:**
- Create: `frontend/src/pages/admin/UserDetail.tsx`

**Implementation:**

Create user detail page with:
- User info section
- Stats section (campaigns, emails, storage)
- Actions: Edit, Suspend/Unsuspend, Impersonate, Delete

---

### Task 5.5: Create Admin Settings Page

**Files:**
- Create: `frontend/src/pages/admin/Settings.tsx`

**Implementation:**

Create settings page with:
- System defaults section
- Form to edit default settings

---

### Task 5.6: Add Impersonation Banner

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Implementation:**

Add impersonation banner:
- Yellow warning banner at top
- Shows "Impersonating [user name]"
- "Exit" button to stop impersonation

---

## Phase 6: Migration & Polish

### Task 6.1: Implement First Admin Data Migration

**Files:**
- Modify: `server/src/middleware/firebaseAuth.ts`

**Implementation:**

Complete the `migrateExistingData` function to assign all existing data to first admin.

---

### Task 6.2: Add API Types to Frontend

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Implementation:**

Add TypeScript interfaces for:
- User
- AdminUser
- Analytics types
- Update all API functions

---

### Task 6.3: End-to-End Testing

**Files:**
- Manual testing checklist

**Verification:**
1. Register new user with email/password
2. Verify email flow works
3. Login with verified account
4. Test Google OAuth signup/login
5. Verify data isolation (create campaign as user A, verify user B can't see it)
6. Test admin panel access
7. Test user suspension
8. Test impersonation
9. Test account deletion

---

### Task 6.4: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

**Implementation:**

Document:
- Firebase setup instructions
- Environment variables needed
- Admin setup process

---

## Summary

**Phase 1:** 5 tasks (parallelizable: 1.1-1.5)
**Phase 2:** 13 tasks (parallelizable: 2.1-2.12, then 2.13)
**Phase 3:** 9 tasks (parallelizable: 3.1-3.9 after 3.1-3.2)
**Phase 4:** 5 tasks (parallelizable: 4.1-4.5)
**Phase 5:** 6 tasks (parallelizable: 5.1-5.6)
**Phase 6:** 4 tasks (sequential)

**Total:** 42 tasks across 6 phases
