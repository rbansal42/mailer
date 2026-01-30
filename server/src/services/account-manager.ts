import { db } from '../db'
import { decrypt } from '../utils/crypto'

export interface Account {
  id: number
  name: string
  providerType: string
  config: Record<string, unknown>
  dailyCap: number
  campaignCap: number
  priority: number
  enabled: boolean
  createdAt: string
}

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

interface SendCountRow {
  count: number
}

interface CampaignCountRow {
  count: number
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function formatAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    config: JSON.parse(decrypt(row.config)),
    dailyCap: row.daily_cap,
    campaignCap: row.campaign_cap,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
  }
}

/**
 * Get the next available sender account for a campaign.
 * Returns the highest priority enabled account that hasn't exceeded its daily or campaign caps.
 * If campaignId is not provided, only daily cap is checked.
 */
export function getNextAvailableAccount(campaignId?: number): Account | null {
  const accounts = db
    .query('SELECT * FROM sender_accounts WHERE enabled = 1 ORDER BY priority ASC')
    .all() as AccountRow[]

  const today = getToday()

  for (const account of accounts) {
    // Get today's send count for this account
    const todayResult = db
      .query('SELECT count FROM send_counts WHERE account_id = ? AND date = ?')
      .get(account.id, today) as SendCountRow | null
    const todayCount = todayResult?.count || 0

    // Check daily cap first
    if (account.daily_cap <= todayCount) {
      continue
    }

    // If campaignId provided, also check campaign cap
    if (campaignId !== undefined) {
      const campaignResult = db
        .query('SELECT COUNT(*) as count FROM send_logs WHERE campaign_id = ? AND account_id = ?')
        .get(campaignId, account.id) as CampaignCountRow
      const campaignCount = campaignResult.count

      if (account.campaign_cap <= campaignCount) {
        continue
      }
    }

    return formatAccount(account)
  }

  return null
}

/**
 * Increment the send count for an account for today.
 * Creates a new record if one doesn't exist for today.
 */
export function incrementSendCount(accountId: number): void {
  const today = getToday()

  db.run(
    `INSERT INTO send_counts (account_id, date, count)
     VALUES (?, ?, 1)
     ON CONFLICT(account_id, date) DO UPDATE SET count = count + 1`,
    [accountId, today]
  )
}

/**
 * Get today's send count for an account.
 */
export function getTodayCount(accountId: number): number {
  const today = getToday()

  const result = db
    .query('SELECT count FROM send_counts WHERE account_id = ? AND date = ?')
    .get(accountId, today) as SendCountRow | null

  return result?.count || 0
}
