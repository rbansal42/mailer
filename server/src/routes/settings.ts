import { Router, Request, Response } from 'express'
import { queryOne, execute } from '../db'
import { logger } from '../lib/logger'

export const settingsRouter = Router()

interface SettingRow {
  key: string
  value: string
}

// GET / - Get all settings
settingsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const testEmail = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['test_email'])
    const timezone = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['timezone'])

    logger.info('Fetched settings', { service: 'settings', keys: ['test_email', 'timezone'] })
    res.json({
      testEmail: testEmail?.value || null,
      timezone: timezone?.value || null,
    })
  } catch (error) {
    logger.error('Failed to fetch settings', { service: 'settings' }, error as Error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PUT / - Update settings
settingsRouter.put('/', async (req: Request, res: Response) => {
  try {
    const { testEmail, timezone } = req.body

    if (testEmail !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['test_email', testEmail])
    }
    if (timezone !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['timezone', timezone])
    }

    // Return updated settings
    const testEmailRow = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['test_email'])
    const timezoneRow = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['timezone'])

    logger.info('Updated settings', { service: 'settings', keys: ['test_email', 'timezone'] })
    res.json({
      testEmail: testEmailRow?.value || null,
      timezone: timezoneRow?.value || null,
    })
  } catch (error) {
    logger.error('Failed to update settings', { service: 'settings' }, error as Error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// GET /tracking - Get tracking settings
settingsRouter.get('/tracking', async (_req: Request, res: Response) => {
  try {
    const settings = {
      enabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_enabled']),
      baseUrl: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_base_url']),
      openEnabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_open_enabled']),
      clickEnabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_click_enabled']),
      hashIps: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_hash_ips']),
      retentionDays: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_retention_days']),
    }

    logger.info('Fetched tracking settings', { service: 'settings', key: 'tracking' })
    res.json({
      enabled: settings.enabled?.value === 'true',
      baseUrl: settings.baseUrl?.value || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled?.value === 'true',
      clickEnabled: settings.clickEnabled?.value === 'true',
      hashIps: settings.hashIps?.value === 'true',
      retentionDays: parseInt(settings.retentionDays?.value || '90', 10),
    })
  } catch (error) {
    logger.error('Failed to fetch tracking settings', { service: 'settings', key: 'tracking' }, error as Error)
    res.status(500).json({ error: 'Failed to fetch tracking settings' })
  }
})

// PUT /tracking - Update tracking settings
settingsRouter.put('/tracking', async (req: Request, res: Response) => {
  try {
    const { enabled, baseUrl, openEnabled, clickEnabled, hashIps, retentionDays } = req.body

    if (enabled !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_enabled', String(enabled)])
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
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_base_url', baseUrl])
    }
    if (openEnabled !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_open_enabled', String(openEnabled)])
    }
    if (clickEnabled !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_click_enabled', String(clickEnabled)])
    }
    if (hashIps !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_hash_ips', String(hashIps)])
    }
    if (retentionDays !== undefined) {
      await execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['tracking_retention_days', String(retentionDays)])
    }

    // Return updated settings (reuse GET logic)
    const settings = {
      enabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_enabled']),
      baseUrl: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_base_url']),
      openEnabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_open_enabled']),
      clickEnabled: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_click_enabled']),
      hashIps: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_hash_ips']),
      retentionDays: await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['tracking_retention_days']),
    }

    logger.info('Updated tracking settings', { service: 'settings', key: 'tracking' })
    res.json({
      enabled: settings.enabled?.value === 'true',
      baseUrl: settings.baseUrl?.value || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled?.value === 'true',
      clickEnabled: settings.clickEnabled?.value === 'true',
      hashIps: settings.hashIps?.value === 'true',
      retentionDays: parseInt(settings.retentionDays?.value || '90', 10),
    })
  } catch (error) {
    logger.error('Failed to update tracking settings', { service: 'settings', key: 'tracking' }, error as Error)
    res.status(500).json({ error: 'Failed to update tracking settings' })
  }
})
