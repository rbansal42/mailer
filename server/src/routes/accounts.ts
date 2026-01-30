import { Router } from 'express'
import { db } from '../db'
import { encrypt, decrypt } from '../utils/crypto'
import { createProvider } from '../providers'

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

function getTodayCount(accountId: number): number {
  const result = db.query(
    'SELECT count FROM send_counts WHERE account_id = ? AND date = ?'
  ).get(accountId, getToday()) as { count: number } | null
  return result?.count || 0
}

function formatAccount(row: AccountRow, includeConfig = true) {
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
    todayCount: getTodayCount(row.id),
  }
}

// List accounts
accountsRouter.get('/', (_, res) => {
  const rows = db.query('SELECT * FROM sender_accounts ORDER BY priority ASC').all() as AccountRow[]
  res.json(rows.map((row) => formatAccount(row, false)))
})

// Get account
accountsRouter.get('/:id', (req, res) => {
  const row = db.query('SELECT * FROM sender_accounts WHERE id = ?').get(req.params.id) as AccountRow | null
  if (!row) {
    return res.status(404).json({ message: 'Account not found' })
  }
  res.json(formatAccount(row, true))
})

// Create account
accountsRouter.post('/', (req, res) => {
  const { name, providerType, config, dailyCap, campaignCap, priority, enabled } = req.body
  
  const encryptedConfig = encrypt(JSON.stringify(config))
  
  // Get max priority if not specified
  const maxPriority = db.query('SELECT MAX(priority) as max FROM sender_accounts').get() as { max: number | null }
  const newPriority = priority ?? (maxPriority.max ?? -1) + 1

  const result = db.run(
    'INSERT INTO sender_accounts (name, provider_type, config, daily_cap, campaign_cap, priority, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, providerType, encryptedConfig, dailyCap || 500, campaignCap || 100, newPriority, enabled ? 1 : 0]
  )
  
  const row = db.query('SELECT * FROM sender_accounts WHERE id = ?').get(result.lastInsertRowid) as AccountRow
  res.status(201).json(formatAccount(row, true))
})

// Update account
accountsRouter.put('/:id', (req, res) => {
  const { name, providerType, config, dailyCap, campaignCap, priority, enabled } = req.body
  
  const encryptedConfig = encrypt(JSON.stringify(config))
  
  db.run(
    'UPDATE sender_accounts SET name = ?, provider_type = ?, config = ?, daily_cap = ?, campaign_cap = ?, priority = ?, enabled = ? WHERE id = ?',
    [name, providerType, encryptedConfig, dailyCap, campaignCap, priority, enabled ? 1 : 0, req.params.id]
  )
  
  const row = db.query('SELECT * FROM sender_accounts WHERE id = ?').get(req.params.id) as AccountRow | null
  if (!row) {
    return res.status(404).json({ message: 'Account not found' })
  }
  res.json(formatAccount(row, true))
})

// Delete account
accountsRouter.delete('/:id', (req, res) => {
  db.run('DELETE FROM sender_accounts WHERE id = ?', [req.params.id])
  res.status(204).send()
})

// Test account connection
accountsRouter.post('/:id/test', async (req, res) => {
  const row = db.query('SELECT * FROM sender_accounts WHERE id = ?').get(req.params.id) as AccountRow | null
  if (!row) {
    return res.status(404).json({ message: 'Account not found' })
  }

  try {
    const config = JSON.parse(decrypt(row.config))
    const provider = createProvider(row.provider_type as 'gmail' | 'smtp', config)
    await provider.verify()
    res.json({ success: true })
  } catch (error) {
    res.json({ success: false, error: (error as Error).message })
  }
})

// Reorder accounts
accountsRouter.post('/reorder', (req, res) => {
  const { ids } = req.body as { ids: number[] }
  
  ids.forEach((id, index) => {
    db.run('UPDATE sender_accounts SET priority = ? WHERE id = ?', [index, id])
  })
  
  res.json({ success: true })
})
