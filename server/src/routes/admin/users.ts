import { Router } from 'express'
import { sql } from '../../db'
import { firebaseAuth } from '../../lib/firebase'

const router = Router()

interface UserRow {
  id: string
  firebase_uid: string
  email: string
  name: string
  is_admin: boolean
  avatar_url: string | null
  created_at: Date
  updated_at: Date
}

// GET /api/admin/users - List all users (paginated)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string || ''
    const offset = (page - 1) * limit

    const searchFilter = search ? `%${search}%` : null

    const users = searchFilter
      ? await sql<UserRow[]>`
          SELECT * FROM users 
          WHERE name ILIKE ${searchFilter} OR email ILIKE ${searchFilter}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql<UserRow[]>`
          SELECT * FROM users 
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `

    const countResult = searchFilter
      ? await sql<{count: string}[]>`SELECT COUNT(*) as count FROM users WHERE name ILIKE ${searchFilter} OR email ILIKE ${searchFilter}`
      : await sql<{count: string}[]>`SELECT COUNT(*) as count FROM users`

    res.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isAdmin: u.is_admin,
        avatarUrl: u.avatar_url,
        createdAt: u.created_at
      })),
      total: parseInt(countResult[0].count),
      page,
      limit
    })
  } catch (error) {
    console.error('List users error:', error)
    res.status(500).json({ error: 'Failed to list users' })
  }
})

// GET /api/admin/users/:id - Get user details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const users = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    const user = users[0]
    
    // Get user stats
    const [campaigns, contacts, emails] = await Promise.all([
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM campaigns WHERE user_id = ${id}`,
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM contacts WHERE user_id = ${id}`,
      sql<{count: string}[]>`SELECT COUNT(*) as count FROM send_logs sl JOIN campaigns c ON c.id = sl.campaign_id WHERE c.user_id = ${id}`
    ])

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.is_admin,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      stats: {
        campaigns: parseInt(campaigns[0].count),
        contacts: parseInt(contacts[0].count),
        emailsSent: parseInt(emails[0].count)
      }
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
})

// PATCH /api/admin/users/:id - Edit user
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, isAdmin } = req.body

    const updates: string[] = []
    if (name !== undefined) updates.push('name')
    if (isAdmin !== undefined) updates.push('isAdmin')

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    const result = await sql<UserRow[]>`
      UPDATE users 
      SET name = COALESCE(${name ?? null}, name),
          is_admin = COALESCE(${isAdmin ?? null}, is_admin),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      id: result[0].id,
      name: result[0].name,
      isAdmin: result[0].is_admin
    })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params
    
    const users = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (firebaseAuth) {
      await firebaseAuth.updateUser(users[0].firebase_uid, { disabled: true })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Suspend user error:', error)
    res.status(500).json({ error: 'Failed to suspend user' })
  }
})

// POST /api/admin/users/:id/unsuspend - Unsuspend user
router.post('/:id/unsuspend', async (req, res) => {
  try {
    const { id } = req.params
    
    const users = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (firebaseAuth) {
      await firebaseAuth.updateUser(users[0].firebase_uid, { disabled: false })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Unsuspend user error:', error)
    res.status(500).json({ error: 'Failed to unsuspend user' })
  }
})

// DELETE /api/admin/users/:id - Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // Prevent self-deletion
    if (id === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account from admin panel' })
    }

    const users = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Delete from Firebase first
    if (firebaseAuth) {
      await firebaseAuth.deleteUser(users[0].firebase_uid)
    }

    // Then delete from database (cascade will delete user data)
    await sql`DELETE FROM users WHERE id = ${id}`

    res.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// POST /api/admin/users/:id/impersonate - Generate impersonation token
router.post('/:id/impersonate', async (req, res) => {
  try {
    const { id } = req.params
    
    const users = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!firebaseAuth) {
      return res.status(500).json({ error: 'Firebase not configured' })
    }

    // Generate custom token for impersonation
    const customToken = await firebaseAuth.createCustomToken(users[0].firebase_uid, {
      impersonatedBy: req.user.id
    })

    res.json({ token: customToken })
  } catch (error) {
    console.error('Impersonate error:', error)
    res.status(500).json({ error: 'Failed to create impersonation token' })
  }
})

export default router
