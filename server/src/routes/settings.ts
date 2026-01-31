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

// GET /tracking - Get tracking settings
settingsRouter.get('/tracking', (_req: Request, res: Response) => {
  try {
    const settings = {
      enabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_enabled') as SettingRow | null,
      baseUrl: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_base_url') as SettingRow | null,
      openEnabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_open_enabled') as SettingRow | null,
      clickEnabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_click_enabled') as SettingRow | null,
      hashIps: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_hash_ips') as SettingRow | null,
      retentionDays: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_retention_days') as SettingRow | null,
    }

    res.json({
      enabled: settings.enabled?.value === 'true',
      baseUrl: settings.baseUrl?.value || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled?.value === 'true',
      clickEnabled: settings.clickEnabled?.value === 'true',
      hashIps: settings.hashIps?.value === 'true',
      retentionDays: parseInt(settings.retentionDays?.value || '90', 10),
    })
  } catch (error) {
    console.error('Error fetching tracking settings:', error)
    res.status(500).json({ error: 'Failed to fetch tracking settings' })
  }
})

// PUT /tracking - Update tracking settings
settingsRouter.put('/tracking', (req: Request, res: Response) => {
  try {
    const { enabled, baseUrl, openEnabled, clickEnabled, hashIps, retentionDays } = req.body

    if (enabled !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_enabled', String(enabled)])
    }
    if (baseUrl !== undefined) {
      // Validate baseUrl is a valid URL
      try {
        const parsed = new URL(baseUrl)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.status(400).json({ error: 'Base URL must use http or https protocol' })
          return
        }
      } catch {
        res.status(400).json({ error: 'Invalid base URL format' })
        return
      }
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_base_url', baseUrl])
    }
    if (openEnabled !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_open_enabled', String(openEnabled)])
    }
    if (clickEnabled !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_click_enabled', String(clickEnabled)])
    }
    if (hashIps !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_hash_ips', String(hashIps)])
    }
    if (retentionDays !== undefined) {
      db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_retention_days', String(retentionDays)])
    }

    // Return updated settings (reuse GET logic)
    const settings = {
      enabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_enabled') as SettingRow | null,
      baseUrl: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_base_url') as SettingRow | null,
      openEnabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_open_enabled') as SettingRow | null,
      clickEnabled: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_click_enabled') as SettingRow | null,
      hashIps: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_hash_ips') as SettingRow | null,
      retentionDays: db.query('SELECT value FROM settings WHERE key = ?').get('tracking_retention_days') as SettingRow | null,
    }

    res.json({
      enabled: settings.enabled?.value === 'true',
      baseUrl: settings.baseUrl?.value || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled?.value === 'true',
      clickEnabled: settings.clickEnabled?.value === 'true',
      hashIps: settings.hashIps?.value === 'true',
      retentionDays: parseInt(settings.retentionDays?.value || '90', 10),
    })
  } catch (error) {
    console.error('Error updating tracking settings:', error)
    res.status(500).json({ error: 'Failed to update tracking settings' })
  }
})
