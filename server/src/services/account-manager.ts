import { queryAll, queryOne, execute } from '../db'
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
 * Optional excludeAccountIds parameter to skip certain accounts (e.g., those with open circuits).
 */
export async function getNextAvailableAccount(campaignId?: number, excludeAccountIds?: number[]): Promise<Account | null> {
  const accounts = await queryAll<AccountRow>(
    'SELECT * FROM sender_accounts WHERE enabled = 1 ORDER BY priority ASC'
  )

  const today = getToday()
  const excludeSet = new Set(excludeAccountIds || [])

  for (const account of accounts) {
    // Skip excluded accounts (e.g., those with open circuit breakers)
    if (excludeSet.has(account.id)) {
      continue
    }

    // Get today's send count for this account
    const todayResult = await queryOne<SendCountRow>(
      'SELECT count FROM send_counts WHERE account_id = ? AND date = ?',
      [account.id, today]
    )
    const todayCount = todayResult?.count || 0

    // Check daily cap first
    if (account.daily_cap <= todayCount) {
      continue
    }

    // If campaignId provided, also check campaign cap
    if (campaignId !== undefined) {
      const campaignResult = await queryOne<CampaignCountRow>(
        'SELECT COUNT(*) as count FROM send_logs WHERE campaign_id = ? AND account_id = ?',
        [campaignId, account.id]
      )
      const campaignCount = campaignResult?.count || 0

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
export async function incrementSendCount(accountId: number): Promise<void> {
  const today = getToday()

  await execute(
    `INSERT INTO send_counts (account_id, date, count)
     VALUES (?, ?, 1)
     ON CONFLICT(account_id, date) DO UPDATE SET count = count + 1`,
    [accountId, today]
  )
}

/**
 * Get today's send count for an account.
 */
export async function getTodayCount(accountId: number): Promise<number> {
  const today = getToday()

  const result = await queryOne<SendCountRow>(
    'SELECT count FROM send_counts WHERE account_id = ? AND date = ?',
    [accountId, today]
  )

  return result?.count || 0
}
