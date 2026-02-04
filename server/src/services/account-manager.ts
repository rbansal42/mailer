import { queryAll, queryOne, execute } from '../db'
import { decrypt } from '../utils/crypto'
import { logger } from '../lib/logger'

const SERVICE = 'account-manager'

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
  enabled: boolean
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
  try {
    return {
      id: row.id,
      name: row.name,
      providerType: row.provider_type,
      config: JSON.parse(decrypt(row.config)),
      dailyCap: row.daily_cap,
      campaignCap: row.campaign_cap,
      priority: row.priority,
      enabled: row.enabled,
      createdAt: row.created_at,
    }
  } catch (error) {
    logger.error('Failed to format account', { service: SERVICE, accountId: row.id }, error as Error)
    throw error
  }
}

/**
 * Get the next available sender account for a campaign.
 * Returns the highest priority enabled account that hasn't exceeded its daily or campaign caps.
 * If campaignId is not provided, only daily cap is checked.
 * Optional excludeAccountIds parameter to skip certain accounts (e.g., those with open circuits).
 */
export async function getNextAvailableAccount(campaignId?: number, excludeAccountIds?: number[]): Promise<Account | null> {
  logger.debug('Finding next available account', {
    service: SERVICE,
    campaignId,
    excludeCount: excludeAccountIds?.length || 0
  })

  try {
    const accounts = await queryAll<AccountRow>(
      'SELECT * FROM sender_accounts WHERE enabled = true ORDER BY priority ASC'
    )

    const today = getToday()
    const excludeSet = new Set(excludeAccountIds || [])

    logger.debug('Checking accounts availability', {
      service: SERVICE,
      totalAccounts: accounts.length,
      excludedCount: excludeSet.size
    })

    for (const account of accounts) {
      // Skip excluded accounts (e.g., those with open circuit breakers)
      if (excludeSet.has(account.id)) {
        logger.debug('Skipping excluded account', {
          service: SERVICE,
          accountId: account.id,
          accountName: account.name
        })
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
        logger.debug('Account daily cap reached', {
          service: SERVICE,
          accountId: account.id,
          accountName: account.name,
          dailyCap: account.daily_cap,
          todayCount
        })
        continue
      }

      // If campaignId provided, also check campaign cap
      if (campaignId !== undefined) {
        const campaignResult = await queryOne<CampaignCountRow>(
          'SELECT COUNT(*)::integer as count FROM send_logs WHERE campaign_id = ? AND account_id = ?',
          [campaignId, account.id]
        )
        const campaignCount = campaignResult?.count || 0

        if (account.campaign_cap <= campaignCount) {
          logger.debug('Account campaign cap reached', {
            service: SERVICE,
            accountId: account.id,
            accountName: account.name,
            campaignId,
            campaignCap: account.campaign_cap,
            campaignCount
          })
          continue
        }
      }

      logger.info('Found available account', {
        service: SERVICE,
        accountId: account.id,
        accountName: account.name,
        campaignId,
        todayCount,
        dailyCap: account.daily_cap
      })

      return formatAccount(account)
    }

    logger.warn('No available accounts found', {
      service: SERVICE,
      campaignId,
      totalAccounts: accounts.length,
      excludedCount: excludeSet.size
    })

    return null
  } catch (error) {
    logger.error('Failed to get next available account', { service: SERVICE, campaignId }, error as Error)
    throw error
  }
}

/**
 * Increment the send count for an account for today.
 * Creates a new record if one doesn't exist for today.
 */
export async function incrementSendCount(accountId: number): Promise<void> {
  const today = getToday()

  logger.debug('Incrementing send count', { service: SERVICE, accountId, date: today })

  try {
    await execute(
      `INSERT INTO send_counts (account_id, date, count)
       VALUES (?, ?, 1)
       ON CONFLICT(account_id, date) DO UPDATE SET count = count + 1`,
      [accountId, today]
    )

    logger.debug('Send count incremented', { service: SERVICE, accountId, date: today })
  } catch (error) {
    logger.error('Failed to increment send count', { service: SERVICE, accountId, date: today }, error as Error)
    throw error
  }
}

/**
 * Get today's send count for an account.
 */
export async function getTodayCount(accountId: number): Promise<number> {
  const today = getToday()

  logger.debug('Getting today send count', { service: SERVICE, accountId, date: today })

  try {
    const result = await queryOne<SendCountRow>(
      'SELECT count FROM send_counts WHERE account_id = ? AND date = ?',
      [accountId, today]
    )

    const count = result?.count || 0
    logger.debug('Today send count retrieved', { service: SERVICE, accountId, date: today, count })

    return count
  } catch (error) {
    logger.error('Failed to get today send count', { service: SERVICE, accountId, date: today }, error as Error)
    throw error
  }
}
