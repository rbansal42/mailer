import { Router, Request, Response } from 'express'
import { queryOne, execute } from '../db'
import { logger } from '../lib/logger'
import { encrypt, decrypt } from '../utils/crypto'
import { LLM_PROVIDERS, LLMProviderId, StoredLLMProvider } from '../services/llm/types'

export const settingsRouter = Router()

interface SettingRow {
  key: string
  value: string
  user_id: string | null
}

// Helper: Get setting value with user override or system default
// Returns user-specific setting first, falls back to system default (user_id IS NULL)
async function getSetting(key: string, userId: string): Promise<string | null> {
  const row = await queryOne<SettingRow>(
    `SELECT value FROM settings 
     WHERE key = ? AND (user_id = ? OR user_id IS NULL)
     ORDER BY user_id NULLS LAST
     LIMIT 1`,
    [key, userId]
  )
  return row?.value ?? null
}

// Helper: Set user-specific setting (upsert)
async function setSetting(key: string, value: string, userId: string): Promise<void> {
  await execute(
    `INSERT INTO settings (key, value, user_id)
     VALUES (?, ?, ?)
     ON CONFLICT (key, COALESCE(user_id, '00000000-0000-0000-0000-000000000000')) 
     DO UPDATE SET value = EXCLUDED.value`,
    [key, value, userId]
  )
}

// GET / - Get all settings (user-specific with system defaults fallback)
settingsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const testEmail = await getSetting('test_email', req.userId)
    const timezone = await getSetting('timezone', req.userId)

    logger.info('Fetched settings', { service: 'settings', keys: ['test_email', 'timezone'], userId: req.userId })
    res.json({
      testEmail: testEmail || null,
      timezone: timezone || null,
    })
  } catch (error) {
    logger.error('Failed to fetch settings', { service: 'settings', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch settings' })
  }
})

// PUT / - Update settings (creates user-specific settings)
settingsRouter.put('/', async (req: Request, res: Response) => {
  try {
    const { testEmail, timezone } = req.body

    if (testEmail !== undefined) {
      await setSetting('test_email', testEmail, req.userId)
    }
    if (timezone !== undefined) {
      await setSetting('timezone', timezone, req.userId)
    }

    // Return updated settings (with fallback to system defaults)
    const testEmailValue = await getSetting('test_email', req.userId)
    const timezoneValue = await getSetting('timezone', req.userId)

    logger.info('Updated settings', { service: 'settings', keys: ['test_email', 'timezone'], userId: req.userId })
    res.json({
      testEmail: testEmailValue || null,
      timezone: timezoneValue || null,
    })
  } catch (error) {
    logger.error('Failed to update settings', { service: 'settings', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

// GET /tracking - Get tracking settings (user-specific with system defaults fallback)
settingsRouter.get('/tracking', async (req: Request, res: Response) => {
  try {
    const settings = {
      enabled: await getSetting('tracking_enabled', req.userId),
      baseUrl: await getSetting('tracking_base_url', req.userId),
      openEnabled: await getSetting('tracking_open_enabled', req.userId),
      clickEnabled: await getSetting('tracking_click_enabled', req.userId),
      hashIps: await getSetting('tracking_hash_ips', req.userId),
      retentionDays: await getSetting('tracking_retention_days', req.userId),
    }

    logger.info('Fetched tracking settings', { service: 'settings', key: 'tracking', userId: req.userId })
    res.json({
      enabled: settings.enabled === 'true',
      baseUrl: settings.baseUrl || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled === 'true',
      clickEnabled: settings.clickEnabled === 'true',
      hashIps: settings.hashIps === 'true',
      retentionDays: parseInt(settings.retentionDays || '90', 10),
    })
  } catch (error) {
    logger.error('Failed to fetch tracking settings', { service: 'settings', key: 'tracking', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch tracking settings' })
  }
})

// PUT /tracking - Update tracking settings (creates user-specific settings)
settingsRouter.put('/tracking', async (req: Request, res: Response) => {
  try {
    const { enabled, baseUrl, openEnabled, clickEnabled, hashIps, retentionDays } = req.body

    if (enabled !== undefined) {
      await setSetting('tracking_enabled', String(enabled), req.userId)
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
      await setSetting('tracking_base_url', baseUrl, req.userId)
    }
    if (openEnabled !== undefined) {
      await setSetting('tracking_open_enabled', String(openEnabled), req.userId)
    }
    if (clickEnabled !== undefined) {
      await setSetting('tracking_click_enabled', String(clickEnabled), req.userId)
    }
    if (hashIps !== undefined) {
      await setSetting('tracking_hash_ips', String(hashIps), req.userId)
    }
    if (retentionDays !== undefined) {
      await setSetting('tracking_retention_days', String(retentionDays), req.userId)
    }

    // Return updated settings (with fallback to system defaults)
    const settings = {
      enabled: await getSetting('tracking_enabled', req.userId),
      baseUrl: await getSetting('tracking_base_url', req.userId),
      openEnabled: await getSetting('tracking_open_enabled', req.userId),
      clickEnabled: await getSetting('tracking_click_enabled', req.userId),
      hashIps: await getSetting('tracking_hash_ips', req.userId),
      retentionDays: await getSetting('tracking_retention_days', req.userId),
    }

    logger.info('Updated tracking settings', { service: 'settings', key: 'tracking', userId: req.userId })
    res.json({
      enabled: settings.enabled === 'true',
      baseUrl: settings.baseUrl || 'https://mailer.rbansal.xyz',
      openEnabled: settings.openEnabled === 'true',
      clickEnabled: settings.clickEnabled === 'true',
      hashIps: settings.hashIps === 'true',
      retentionDays: parseInt(settings.retentionDays || '90', 10),
    })
  } catch (error) {
    logger.error('Failed to update tracking settings', { service: 'settings', key: 'tracking', userId: req.userId }, error as Error)
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

// GET /llm - Get LLM settings (user-specific with system defaults fallback)
settingsRouter.get('/llm', async (req: Request, res: Response) => {
  try {
    const providersValue = await getSetting('llm_providers', req.userId)
    const activeValue = await getSetting('llm_active_provider', req.userId)
    
    let providers: Array<StoredLLMProvider & { apiKeyMasked: string }> = []
    
    if (providersValue) {
      try {
        const parsed = JSON.parse(providersValue) as StoredLLMProvider[]
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
    
    logger.info('Fetched LLM settings', { service: 'settings', key: 'llm', userId: req.userId })
    res.json({
      providers,
      activeProvider: activeValue || null
    })
  } catch (error) {
    logger.error('Failed to fetch LLM settings', { service: 'settings', key: 'llm', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to fetch LLM settings' })
  }
})

// PUT /llm/provider - Update a provider's config (creates user-specific settings)
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
    
    // Get existing providers (user-specific or system default)
    const providersValue = await getSetting('llm_providers', req.userId)
    let providers: StoredLLMProvider[] = []
    
    if (providersValue) {
      try {
        providers = JSON.parse(providersValue)
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
    
    // Save as user-specific setting
    await setSetting('llm_providers', JSON.stringify(providers), req.userId)
    
    logger.info('Updated LLM provider', { service: 'settings', key: 'llm', providerId: id, userId: req.userId })
    res.json({ success: true })
  } catch (error) {
    logger.error('Failed to update LLM provider', { service: 'settings', key: 'llm', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to update LLM provider' })
  }
})

// PUT /llm/active - Set the active provider (creates user-specific settings)
settingsRouter.put('/llm/active', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body as { provider: LLMProviderId | null }
    
    if (provider !== null && !LLM_PROVIDERS.find(p => p.id === provider)) {
      res.status(400).json({ error: 'Invalid provider ID' })
      return
    }
    
    if (provider) {
      await setSetting('llm_active_provider', provider, req.userId)
    } else {
      // Delete user-specific setting to fall back to system default
      await execute('DELETE FROM settings WHERE key = ? AND user_id = ?', ['llm_active_provider', req.userId])
    }
    
    logger.info('Updated active LLM provider', { service: 'settings', key: 'llm', provider, userId: req.userId })
    res.json({ success: true, activeProvider: provider })
  } catch (error) {
    logger.error('Failed to update active LLM provider', { service: 'settings', key: 'llm', userId: req.userId }, error as Error)
    res.status(500).json({ error: 'Failed to update active LLM provider' })
  }
})
