import { Router, Request, Response } from 'express'
import { queryOne, execute } from '../db'
import { logger } from '../lib/logger'
import { encrypt, decrypt } from '../utils/crypto'
import { LLM_PROVIDERS, LLMProviderId, StoredLLMProvider } from '../services/llm/types'

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
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['test_email', testEmail])
    }
    if (timezone !== undefined) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['timezone', timezone])
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
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_enabled', String(enabled)])
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
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_base_url', baseUrl])
    }
    if (openEnabled !== undefined) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_open_enabled', String(openEnabled)])
    }
    if (clickEnabled !== undefined) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_click_enabled', String(clickEnabled)])
    }
    if (hashIps !== undefined) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_hash_ips', String(hashIps)])
    }
    if (retentionDays !== undefined) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['tracking_retention_days', String(retentionDays)])
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

// ============ LLM Settings ============

// Helper to mask API key for display
function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? '****' : ''
  return key.slice(0, 4) + '****' + key.slice(-4)
}

// GET /llm/providers-info - Get available providers and their models (static info)
settingsRouter.get('/llm/providers-info', (_req: Request, res: Response) => {
  res.json(LLM_PROVIDERS)
})

// GET /llm - Get LLM settings
settingsRouter.get('/llm', async (_req: Request, res: Response) => {
  try {
    const providersRow = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['llm_providers'])
    const activeRow = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['llm_active_provider'])
    
    let providers: Array<StoredLLMProvider & { apiKeyMasked: string }> = []
    
    if (providersRow?.value) {
      try {
        const parsed = JSON.parse(providersRow.value) as StoredLLMProvider[]
        providers = parsed.map(p => ({
          ...p,
          apiKey: '', // Don't send actual key to frontend
          apiKeyMasked: maskApiKey(p.apiKey ? decrypt(p.apiKey) : '')
        }))
      } catch {
        logger.warn('Failed to parse LLM providers from database')
      }
    }
    
    // Check env vars for unconfigured providers
    for (const providerInfo of LLM_PROVIDERS) {
      const existing = providers.find(p => p.id === providerInfo.id)
      if (!existing) {
        const envKey = process.env[providerInfo.envVar]
        if (envKey) {
          providers.push({
            id: providerInfo.id,
            apiKey: '',
            apiKeyMasked: maskApiKey(envKey) + ' (env)',
            model: providerInfo.models[0].id,
            enabled: true
          })
        }
      }
    }
    
    logger.info('Fetched LLM settings', { service: 'settings', key: 'llm' })
    res.json({
      providers,
      activeProvider: activeRow?.value || null
    })
  } catch (error) {
    logger.error('Failed to fetch LLM settings', { service: 'settings', key: 'llm' }, error as Error)
    res.status(500).json({ error: 'Failed to fetch LLM settings' })
  }
})

// PUT /llm/provider - Update a provider's config
settingsRouter.put('/llm/provider', async (req: Request, res: Response) => {
  try {
    const { id, apiKey, model, enabled } = req.body as {
      id: LLMProviderId
      apiKey?: string
      model?: string
      enabled?: boolean
    }
    
    if (!id || !LLM_PROVIDERS.find(p => p.id === id)) {
      res.status(400).json({ error: 'Invalid provider ID' })
      return
    }
    
    // Get existing providers
    const providersRow = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', ['llm_providers'])
    let providers: StoredLLMProvider[] = []
    
    if (providersRow?.value) {
      try {
        providers = JSON.parse(providersRow.value)
      } catch {
        providers = []
      }
    }
    
    // Find or create provider entry
    let provider = providers.find(p => p.id === id)
    if (!provider) {
      const providerInfo = LLM_PROVIDERS.find(p => p.id === id)!
      provider = {
        id,
        apiKey: '',
        model: providerInfo.models[0].id,
        enabled: false
      }
      providers.push(provider)
    }
    
    // Update fields
    if (apiKey !== undefined) {
      // Encrypt API key before storing
      provider.apiKey = apiKey ? encrypt(apiKey) : ''
    }
    if (model !== undefined) {
      provider.model = model
    }
    if (enabled !== undefined) {
      provider.enabled = enabled
    }
    
    // Save
    await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['llm_providers', JSON.stringify(providers)])
    
    logger.info('Updated LLM provider', { service: 'settings', key: 'llm', providerId: id })
    res.json({ success: true })
  } catch (error) {
    logger.error('Failed to update LLM provider', { service: 'settings', key: 'llm' }, error as Error)
    res.status(500).json({ error: 'Failed to update LLM provider' })
  }
})

// PUT /llm/active - Set the active provider
settingsRouter.put('/llm/active', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body as { provider: LLMProviderId | null }
    
    if (provider !== null && !LLM_PROVIDERS.find(p => p.id === provider)) {
      res.status(400).json({ error: 'Invalid provider ID' })
      return
    }
    
    if (provider) {
      await execute('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['llm_active_provider', provider])
    } else {
      await execute('DELETE FROM settings WHERE key = ?', ['llm_active_provider'])
    }
    
    logger.info('Updated active LLM provider', { service: 'settings', key: 'llm', provider })
    res.json({ success: true, activeProvider: provider })
  } catch (error) {
    logger.error('Failed to update active LLM provider', { service: 'settings', key: 'llm' }, error as Error)
    res.status(500).json({ error: 'Failed to update active LLM provider' })
  }
})
