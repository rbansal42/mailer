import { Router, Request, Response } from 'express'
import { db } from '../db'

export const settingsRouter = Router()

interface SettingRow {
  key: string
  value: string
}

// GET / - Get all settings
settingsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const testEmail = db.query('SELECT value FROM settings WHERE key = ?').get('test_email') as SettingRow | null
    const timezone = db.query('SELECT value FROM settings WHERE key = ?').get('timezone') as SettingRow | null

    res.json({
      testEmail: testEmail?.value || null,
      timezone: timezone?.value || null,
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PUT / - Update settings
settingsRouter.put('/', (req: Request, res: Response) => {
  try {
    const { testEmail, timezone } = req.body

    if (testEmail !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['test_email', testEmail])
    }
    if (timezone !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['timezone', timezone])
    }

    // Return updated settings
    const testEmailRow = db.query('SELECT value FROM settings WHERE key = ?').get('test_email') as SettingRow | null
    const timezoneRow = db.query('SELECT value FROM settings WHERE key = ?').get('timezone') as SettingRow | null

    res.json({
      testEmail: testEmailRow?.value || null,
      timezone: timezoneRow?.value || null,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})
