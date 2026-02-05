import { Router } from 'express'
import { z } from 'zod'
import { sql } from '../db'
import { firebaseAuth } from '../lib/firebase'
import { validate } from '../lib/validation'

const router = Router()

// User profile update schema
const updateProfileSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(255)
})

// GET /api/users/me - Get current user profile
router.get('/me', (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    isAdmin: req.user.isAdmin,
    avatarUrl: req.user.avatarUrl
  })
})

// PATCH /api/users/me - Update profile
router.patch('/me', async (req, res) => {
  try {
    const validation = validate(updateProfileSchema, req.body)
    if (!validation.success) {
      return res.status(400).json({ error: validation.error })
    }
    const { name } = validation.data

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
    // Delete from Firebase first - if this fails, we don't want to delete locally
    if (firebaseAuth) {
      await firebaseAuth.deleteUser(req.user.firebaseUid)
    }

    // Delete user locally (cascade will handle related records once foreign keys are set up)
    await sql`DELETE FROM users WHERE id = ${req.userId}`

    res.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
})

export default router
