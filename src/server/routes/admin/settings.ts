import { Router } from 'express'
import { sql } from '../../db'

const router = Router()

interface SettingRow {
  id: number
  key: string
  value: string
  user_id: string | null
}

// GET /api/admin/settings - Get all system settings (user_id = NULL)
router.get('/', async (req, res) => {
  try {
    const settings = await sql<SettingRow[]>`
      SELECT * FROM settings WHERE user_id IS NULL
    `

    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }

    res.json(result)
  } catch (error) {
    console.error('Get admin settings error:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PATCH /api/admin/settings - Update system settings
router.patch('/', async (req, res) => {
  try {
    const updates = req.body as Record<string, string>

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== 'string') continue

      // Upsert system setting (user_id = NULL)
      await sql`
        INSERT INTO settings (key, value, user_id)
        VALUES (${key}, ${value}, NULL)
        ON CONFLICT (key) WHERE user_id IS NULL
        DO UPDATE SET value = ${value}
      `
    }

    // Return updated settings
    const settings = await sql<SettingRow[]>`
      SELECT * FROM settings WHERE user_id IS NULL
    `

    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }

    res.json(result)
  } catch (error) {
    console.error('Update admin settings error:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

export default router
