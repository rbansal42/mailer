# User Management Design

Multi-tenant user management system with Firebase authentication and admin panel.

## Overview

Transform the single-user mailer app into a multi-tenant system where:
- Each user has isolated data (campaigns, contacts, certificates, SMTP accounts)
- Users authenticate via Firebase (email/password or Google OAuth)
- Admins manage users and view system-wide analytics

## User Model

**Isolated tenants** - Each user sees only their own data, completely separate.

**Admin role** - Admins are regular users with elevated privileges. They have their own workspace plus access to the admin panel.

## Authentication

### Firebase Auth

Firebase handles all authentication concerns:
- User creation and credential storage
- Email/password authentication
- Google OAuth flow
- Email verification (required before access)
- Password reset emails
- JWT token generation and validation

### Local User Record

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Authentication Flow

1. Frontend uses Firebase SDK for all auth (sign up, login, Google OAuth)
2. Firebase returns ID token after successful auth
3. Frontend sends ID token in `Authorization: Bearer <token>` header
4. Backend middleware verifies token with Firebase Admin SDK
5. Middleware looks up/creates local user record by `firebase_uid`
6. Middleware rejects unverified emails (403)
7. `req.userId` set to internal user ID for all queries

### Registration

- Open registration - anyone can sign up
- Email verification required before accessing any features
- First user to register becomes admin automatically

## Data Model Changes

### New Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Modified Tables

Add `user_id UUID REFERENCES users(id)` to:
- `sender_accounts`
- `templates` (user-created only, not system templates)
- `drafts`
- `campaigns`
- `mails`
- `sequences`
- `recurring_campaigns`
- `certificate_configs`
- `generated_certificates`
- `contacts`
- `lists`
- `media`
- `attachments`
- `settings` (for per-user settings, `user_id = NULL` for system defaults)

### Unchanged Tables

These derive from user-scoped data, no changes needed:
- `send_logs`, `email_queue` - tied to campaigns
- `tracking_tokens`, `tracking_events` - tied to campaigns
- `send_counts` - tied to sender_accounts
- `suppression_list`, `bounces` - system-wide

### System Templates

Add to `templates` table:
```sql
ALTER TABLE templates ADD COLUMN is_system BOOLEAN DEFAULT false;
```

System templates have `user_id = NULL` and `is_system = true`. All users can see and use them.

## Data Isolation

### Route Pattern

Every data query filters by `user_id`:

```typescript
// All queries include user filter
const campaigns = await sql`
  SELECT * FROM campaigns 
  WHERE user_id = ${req.userId} 
  ORDER BY created_at DESC
`

// Inserts set user_id automatically
await sql`
  INSERT INTO campaigns (id, user_id, name, ...) 
  VALUES (${id}, ${req.userId}, ${name}, ...)
`
```

### Template Access

Users see their own templates plus system templates:

```typescript
const templates = await sql`
  SELECT * FROM templates 
  WHERE user_id = ${req.userId} OR is_system = true
  ORDER BY is_system DESC, created_at DESC
`
```

### Settings Inheritance

Per-user settings with system defaults:

```typescript
const value = await sql`
  SELECT value FROM settings 
  WHERE key = ${key} AND (user_id = ${req.userId} OR user_id IS NULL)
  ORDER BY user_id NULLS LAST
  LIMIT 1
`
```

## Admin Panel

### Access Control

- Admin routes prefixed with `/api/admin/*`
- Middleware checks `req.user.isAdmin === true`
- Frontend shows admin nav link only for admins

### API Endpoints

```
GET    /api/admin/users              - List all users (paginated, searchable)
GET    /api/admin/users/:id          - User details + stats
PATCH  /api/admin/users/:id          - Edit user (name, email, isAdmin)
POST   /api/admin/users/:id/suspend  - Disable Firebase account
POST   /api/admin/users/:id/unsuspend
DELETE /api/admin/users/:id          - Delete user + all their data
POST   /api/admin/users/:id/impersonate - Get token to act as user

GET    /api/admin/analytics/overview - Dashboard stats
GET    /api/admin/analytics/users    - Signups over time, active users
GET    /api/admin/analytics/emails   - Send volume, delivery rates, bounces
GET    /api/admin/analytics/storage  - Storage usage per user

GET    /api/admin/settings           - System-wide settings
PATCH  /api/admin/settings           - Update system defaults
```

### User Suspension

Uses Firebase Admin SDK:
```typescript
await firebaseAdmin.auth().updateUser(firebaseUid, { disabled: true })
```

### Impersonation

1. Admin clicks "Login as user"
2. Backend generates custom Firebase token for that user
3. Frontend stores admin's real token, switches to impersonation token
4. UI shows "Impersonating X - Exit" banner
5. All actions logged with `impersonated_by` for audit trail

### Comprehensive Analytics

- **User metrics**: User count, signups over time, active users, last login dates
- **Email metrics**: Emails sent per user, delivery rates, bounces, total throughput
- **Storage metrics**: Storage used per user, attachments, media uploads
- **Feature metrics**: Campaign performance, certificate generation stats

## User Self-Service

Users can:
- Update profile (name)
- Change email (with re-verification via Firebase)
- Change password (via Firebase)
- Delete account (removes all user data)

## Frontend Changes

### New Pages

```
/login              - Firebase auth (email/password + Google button)
/register           - Sign up form + Google option
/verify-email       - "Check your email" screen with resend button
/forgot-password    - Password reset request
/reset-password     - Set new password (Firebase handles via email link)

/settings/account   - Profile management, delete account

/admin              - Admin dashboard with analytics overview
/admin/users        - User list with search, filters
/admin/users/:id    - User detail view with stats, actions
/admin/settings     - System-wide default settings
```

### Layout Changes

- Sidebar: Add "Admin" link (visible only if `user.isAdmin`)
- Header: Add user avatar/dropdown with "Account Settings" and "Logout"
- Impersonation: Yellow banner at top when impersonating

### Auth State

```typescript
interface AuthState {
  user: User | null
  firebaseUser: FirebaseUser | null
  isAuthenticated: boolean
  isLoading: boolean
  impersonating: User | null
  
  login: (email, password) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  startImpersonation: (userId) => Promise<void>
  stopImpersonation: () => Promise<void>
}
```

## Migration Strategy

### Database Migration

1. Create `users` table
2. Add `user_id` column to all user-scoped tables (nullable initially)
3. Add `is_system` column to `templates` table
4. Mark existing default templates as system templates

### First Admin Bootstrap

On first registration after migration:

```typescript
async function handleFirstUser(firebaseUid, email, name) {
  const userCount = await sql`SELECT COUNT(*) FROM users`
  
  if (userCount === 0) {
    // Create first admin
    const user = await sql`
      INSERT INTO users (id, firebase_uid, email, name, is_admin)
      VALUES (${newId}, ${firebaseUid}, ${email}, ${name}, true)
      RETURNING *
    `
    
    // Migrate existing data to this user
    await sql`UPDATE sender_accounts SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE campaigns SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE mails SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE drafts SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE sequences SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE recurring_campaigns SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE certificate_configs SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE contacts SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE lists SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE media SET user_id = ${user.id} WHERE user_id IS NULL`
    await sql`UPDATE attachments SET user_id = ${user.id} WHERE user_id IS NULL`
    
    // Keep non-default templates for admin
    await sql`UPDATE templates SET user_id = ${user.id} WHERE is_system = false`
  }
}
```

### Backward Compatibility

- Old auth endpoints return 410 Gone
- Old tokens invalid - users must re-login with Firebase
- Data preserved, just re-owned

## Dependencies

### Backend
- `firebase-admin` - Token verification, user management

### Frontend
- `firebase` - Auth SDK

## Scope Summary

### Not Included (Future Considerations)
- Two-factor authentication
- API keys for programmatic access
- Detailed audit logging
- User data export (GDPR)
- Usage limits/billing tiers
