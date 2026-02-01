import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'
import { encrypt, decrypt } from '../utils/crypto'
import { createProvider } from '../providers'
import { createAccountSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

export const accountsRouter = Router()

interface AccountRow {
  id: number
  name: string
  provider_type: string
  config: string
  daily_cap: number
  campaign_cap: number
  priority: number
  enabled: number
  created_at: string
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

async function getTodayCount(accountId: number): Promise<number> {
  const result = await queryOne<{ count: number }>(
    'SELECT count FROM send_counts WHERE account_id = ? AND date = ?',
    [accountId, getToday()]
  )
  return result?.count || 0
}

async function formatAccount(row: AccountRow, includeConfig = true) {
  const config = JSON.parse(decrypt(row.config))
  
  // Mask sensitive fields for listing
  if (!includeConfig) {
    if (config.appPassword) config.appPassword = '••••••••'
    if (config.pass) config.pass = '••••••••'
  }

  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    config,
    dailyCap: row.daily_cap,
    campaignCap: row.campaign_cap,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    todayCount: await getTodayCount(row.id),
  }
}

// List accounts
accountsRouter.get('/', async (_, res) => {
  logger.info('Listing accounts', { service: 'accounts' })
  const rows = await queryAll<AccountRow>('SELECT * FROM sender_accounts ORDER BY priority ASC')
  const accounts = await Promise.all(rows.map((row) => formatAccount(row, false)))
  res.json(accounts)
})

// Get account
accountsRouter.get('/:id', async (req, res) => {
  logger.info('Getting account', { service: 'accounts', accountId: req.params.id })
  const row = await queryOne<AccountRow>('SELECT * FROM sender_accounts WHERE id = ?', [req.params.id])
  if (!row) {
    logger.warn('Account not found', { service: 'accounts', accountId: req.params.id })
    return res.status(404).json({ message: 'Account not found' })
  }
  res.json(await formatAccount(row, true))
})

// Create account
accountsRouter.post('/', async (req, res) => {
  const validation = validate(createAccountSchema, req.body)
  if (!validation.success) {
    logger.warn('Account validation failed', { service: 'accounts', error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, providerType, config, dailyCap, campaignCap, priority, enabled } = validation.data
  
  logger.info('Creating account', { service: 'accounts', name, providerType })
  
  const encryptedConfig = encrypt(JSON.stringify(config))
  
  // Get max priority if not specified
  const maxPriority = await queryOne<{ max: number | null }>('SELECT MAX(priority) as max FROM sender_accounts')
  const newPriority = priority ?? ((maxPriority?.max ?? -1) + 1)

  const result = await execute(
    'INSERT INTO sender_accounts (name, provider_type, config, daily_cap, campaign_cap, priority, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, providerType, encryptedConfig, dailyCap, campaignCap, newPriority, enabled ? 1 : 0]
  )
  
  const row = await queryOne<AccountRow>('SELECT * FROM sender_accounts WHERE id = ?', [result.lastInsertRowid])
  logger.info('Account created', { service: 'accounts', accountId: row!.id, name })
  res.status(201).json(await formatAccount(row!, true))
})

// Update account
accountsRouter.put('/:id', async (req, res) => {
  const validation = validate(createAccountSchema, req.body)
  if (!validation.success) {
    logger.warn('Account update validation failed', { service: 'accounts', accountId: req.params.id, error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, providerType, config, dailyCap, campaignCap, priority, enabled } = validation.data
  
  logger.info('Updating account', { service: 'accounts', accountId: req.params.id })
  
  const encryptedConfig = encrypt(JSON.stringify(config))
  
  await execute(
    'UPDATE sender_accounts SET name = ?, provider_type = ?, config = ?, daily_cap = ?, campaign_cap = ?, priority = ?, enabled = ? WHERE id = ?',
    [name, providerType, encryptedConfig, dailyCap, campaignCap, priority, enabled ? 1 : 0, req.params.id]
  )
  
  const row = await queryOne<AccountRow>('SELECT * FROM sender_accounts WHERE id = ?', [req.params.id])
  if (!row) {
    logger.warn('Account not found for update', { service: 'accounts', accountId: req.params.id })
    return res.status(404).json({ message: 'Account not found' })
  }
  logger.info('Account updated', { service: 'accounts', accountId: row.id })
  res.json(await formatAccount(row, true))
})

// Delete account
accountsRouter.delete('/:id', async (req, res) => {
  logger.info('Deleting account', { service: 'accounts', accountId: req.params.id })
  await execute('DELETE FROM sender_accounts WHERE id = ?', [req.params.id])
  logger.info('Account deleted', { service: 'accounts', accountId: req.params.id })
  res.status(204).send()
})

// Test account connection
accountsRouter.post('/:id/test', async (req, res) => {
  logger.info('Testing account connection', { service: 'accounts', accountId: req.params.id })
  const row = await queryOne<AccountRow>('SELECT * FROM sender_accounts WHERE id = ?', [req.params.id])
  if (!row) {
    logger.warn('Account not found for test', { service: 'accounts', accountId: req.params.id })
    return res.status(404).json({ message: 'Account not found' })
  }

  try {
    const config = JSON.parse(decrypt(row.config))
    const provider = createProvider(row.provider_type as 'gmail' | 'smtp', config)
    await provider.verify()
    logger.info('Account connection test successful', { service: 'accounts', accountId: req.params.id })
    res.json({ success: true })
  } catch (error) {
    logger.warn('Account connection test failed', { service: 'accounts', accountId: req.params.id }, error as Error)
    res.json({ success: false, error: (error as Error).message })
  }
})

// Reorder accounts
accountsRouter.post('/reorder', async (req, res) => {
  const { ids } = req.body as { ids: number[] }
  
  logger.info('Reordering accounts', { service: 'accounts', accountIds: ids })
  
  for (const [index, id] of ids.entries()) {
    await execute('UPDATE sender_accounts SET priority = ? WHERE id = ?', [index, id])
  }
  
  logger.info('Accounts reordered', { service: 'accounts' })
  res.json({ success: true })
})
