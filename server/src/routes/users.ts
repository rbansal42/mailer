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
    // Delete user (cascade will handle related records once foreign keys are set up)
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
