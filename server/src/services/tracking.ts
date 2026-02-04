import { queryAll, queryOne, execute, db } from '../db'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

// Types
export interface TrackingToken {
  id: number
  campaignId: number
  recipientEmail: string
  token: string
  createdAt: string
}

export interface TrackingEvent {
  id: number
  tokenId: number
  eventType: 'open' | 'click'
  linkUrl?: string
  linkIndex?: number
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface TrackingSettings {
  enabled: boolean
  baseUrl: string
  openEnabled: boolean
  clickEnabled: boolean
  hashIps: boolean
  retentionDays: number
}

export interface CampaignAnalytics {
  delivery: {
    sent: number
    failed: number
    queued: number
    bounced: number
    hardBounces: number
    softBounces: number
  }
  engagement: {
    opens: number
    uniqueOpens: number
    openRate: number
    clicks: number
    uniqueClicks: number
    clickRate: number
  }
  topLinks: Array<{ url: string; clicks: number }>
  opensOverTime: Array<{ hour: string; count: number }>
  recipients: Array<{
    email: string
    status: string
    opens: number
    clicks: string[]
  }>
}

interface TokenRow {
  id: number
  campaign_id: number
  recipient_email: string
  token: string
  created_at: string
}

interface SettingRow {
  value: string
}

// Get tracking settings from database
export async function getTrackingSettings(): Promise<TrackingSettings> {
  const getValue = async (key: string, defaultVal: string): Promise<string> => {
    const row = await queryOne<SettingRow>('SELECT value FROM settings WHERE key = ?', [key])
    return row?.value ?? defaultVal
  }

  return {
    enabled: (await getValue('tracking_enabled', 'true')) === 'true',
    baseUrl: await getValue('tracking_base_url', 'https://mailer.rbansal.xyz'),
    openEnabled: (await getValue('tracking_open_enabled', 'true')) === 'true',
    clickEnabled: (await getValue('tracking_click_enabled', 'true')) === 'true',
    hashIps: (await getValue('tracking_hash_ips', 'true')) === 'true',
    retentionDays: parseInt(await getValue('tracking_retention_days', '90'), 10),
  }
}

// Generate or get existing token for a campaign/recipient
export async function getOrCreateToken(campaignId: number, recipientEmail: string): Promise<string> {
  // Check if token exists
  const existing = await queryOne<TokenRow>(
    'SELECT token FROM tracking_tokens WHERE campaign_id = ? AND recipient_email = ?',
    [campaignId, recipientEmail]
  )

  if (existing) {
    return existing.token
  }

  // Create new token
  const token = randomUUID()
  await execute(
    'INSERT INTO tracking_tokens (campaign_id, recipient_email, token) VALUES (?, ?, ?)',
    [campaignId, recipientEmail, token]
  )

  return token
}

// Get token details by token string
export async function getTokenDetails(token: string): Promise<TrackingToken | null> {
  const row = await queryOne<TokenRow>(
    'SELECT id, campaign_id, recipient_email, token, created_at FROM tracking_tokens WHERE token = ?',
    [token]
  )

  if (!row) return null

  return {
    id: row.id,
    campaignId: row.campaign_id,
    recipientEmail: row.recipient_email,
    token: row.token,
    createdAt: row.created_at,
  }
}

// Hash IP address for privacy
export function hashIpAddress(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

// Record an open event
export async function recordOpen(token: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
  const tokenDetails = await getTokenDetails(token)
  if (!tokenDetails) return false

  const settings = await getTrackingSettings()
  const ip = ipAddress && settings.hashIps ? hashIpAddress(ipAddress) : ipAddress

  await execute(
    `INSERT INTO tracking_events (token_id, event_type, ip_address, user_agent) VALUES (?, 'open', ?, ?)`,
    [tokenDetails.id, ip || null, userAgent || null]
  )

  return true
}

// Record a click event
export async function recordClick(
  token: string,
  linkUrl: string,
  linkIndex: number,
  ipAddress?: string,
  userAgent?: string
): Promise<boolean> {
  const tokenDetails = await getTokenDetails(token)
  if (!tokenDetails) return false

  const settings = await getTrackingSettings()
  const ip = ipAddress && settings.hashIps ? hashIpAddress(ipAddress) : ipAddress

  await execute(
    `INSERT INTO tracking_events (token_id, event_type, link_url, link_index, ip_address, user_agent) VALUES (?, 'click', ?, ?, ?, ?)`,
    [tokenDetails.id, linkUrl, linkIndex, ip || null, userAgent || null]
  )

  return true
}

// Record an action button click event
export async function recordAction(
  token: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<{ success: boolean; enrollment?: any }> {
  const tokenDetails = await getTokenDetails(token)
  if (!tokenDetails) {
    return { success: false }
  }

  // For sequences, campaign_id is negative (synthetic)
  const sequenceId = tokenDetails.campaignId < 0 ? Math.abs(tokenDetails.campaignId) : null
  if (!sequenceId) {
    return { success: false } // Action buttons only work in sequences
  }

  // Find enrollment
  const enrollment = await db.execute({
    sql: `SELECT * FROM sequence_enrollments 
          WHERE sequence_id = ? AND recipient_email = ? AND status = 'active'`,
    args: [sequenceId, tokenDetails.recipientEmail]
  })

  if (!enrollment.rows.length) {
    return { success: false }
  }

  const enrollmentRow = enrollment.rows[0]

  // Check if already clicked (idempotent)
  if (enrollmentRow.action_clicked_at) {
    return { success: true, enrollment: enrollmentRow }
  }

  // Record tracking event
  await db.execute({
    sql: `INSERT INTO tracking_events (token_id, event_type, ip_address, user_agent)
          VALUES (?, 'action', ?, ?)`,
    args: [tokenDetails.id, ipAddress ?? null, userAgent ?? null]
  })

  // Update enrollment
  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE sequence_enrollments SET action_clicked_at = ? WHERE id = ?`,
    args: [now, enrollmentRow.id]
  })

  return { 
    success: true, 
    enrollment: { ...enrollmentRow, action_clicked_at: now }
  }
}

// Get action button configuration from a sequence step
export async function getActionConfig(sequenceId: number, stepId: number): Promise<{
  destinationType: 'external' | 'hosted'
  destinationUrl: string | null
  hostedMessage: string | null
} | null> {
  // Action config is stored in the step's template blocks
  const step = await db.execute({
    sql: `SELECT t.blocks FROM sequence_steps ss
          JOIN templates t ON ss.template_id = t.id
          WHERE ss.id = ?`,
    args: [stepId]
  })

  if (!step.rows.length) return null

  let blocks = []
  try {
    blocks = JSON.parse(step.rows[0].blocks as string || '[]')
  } catch {
    return null
  }
  const actionBlock = blocks.find((b: any) => 
    b.type === 'action-button' || (b.type === 'button' && b.props?.isActionTrigger)
  )

  if (!actionBlock) return null

  return {
    destinationType: actionBlock.props.destinationType || 'hosted',
    destinationUrl: actionBlock.props.destinationUrl || null,
    hostedMessage: actionBlock.props.hostedMessage || 'Thank you for your response!'
  }
}

// Get campaign analytics
export async function getCampaignAnalytics(campaignId: number): Promise<CampaignAnalytics> {
  // Get delivery stats from send_logs
  const deliveryStats = await queryAll<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM send_logs WHERE campaign_id = ? GROUP BY status`,
    [campaignId]
  )

  const sent = deliveryStats.find((s: { status: string; count: number }) => s.status === 'success')?.count || 0
  const failed = deliveryStats.find((s: { status: string; count: number }) => s.status === 'failed')?.count || 0
  const queued = deliveryStats.find((s: { status: string; count: number }) => s.status === 'queued')?.count || 0

  // Get bounce stats
  const bounceStats = await queryOne<{ total: number; hard: number; soft: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN bounce_type = 'hard' THEN 1 ELSE 0 END) as hard,
      SUM(CASE WHEN bounce_type = 'soft' THEN 1 ELSE 0 END) as soft
    FROM bounces
    WHERE campaign_id = ?
  `, [campaignId])

  // Get open stats
  const openStats = await queryOne<{ total: number; unique_count: number }>(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT te.token_id) as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'open'
  `, [campaignId])

  // Get click stats
  const clickStats = await queryOne<{ total: number; unique_count: number }>(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT te.token_id) as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'click'
  `, [campaignId])

  // Get top links
  const topLinks = await queryAll<{ link_url: string; clicks: number }>(`
    SELECT te.link_url, COUNT(*) as clicks
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'click' AND te.link_url IS NOT NULL
    GROUP BY te.link_url
    ORDER BY clicks DESC
    LIMIT 10
  `, [campaignId])

  // Get opens over time (hourly for last 48 hours)
  const opensOverTime = await queryAll<{ hour: string; count: number }>(`
    SELECT 
      strftime('%Y-%m-%d %H:00', te.created_at) as hour,
      COUNT(*) as count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? 
      AND te.event_type = 'open'
      AND te.created_at >= datetime('now', '-48 hours')
    GROUP BY hour
    ORDER BY hour
  `, [campaignId])

  // Get per-recipient data
  const recipients = await queryAll<{ 
    email: string; 
    status: string; 
    opens: number; 
    click_urls: string | null 
  }>(`
    SELECT 
      sl.recipient_email as email,
      sl.status,
      COALESCE((
        SELECT COUNT(*) FROM tracking_events te
        JOIN tracking_tokens tt ON te.token_id = tt.id
        WHERE tt.campaign_id = sl.campaign_id 
          AND tt.recipient_email = sl.recipient_email 
          AND te.event_type = 'open'
      ), 0) as opens,
      (
        SELECT GROUP_CONCAT(DISTINCT te.link_url)
        FROM tracking_events te
        JOIN tracking_tokens tt ON te.token_id = tt.id
        WHERE tt.campaign_id = sl.campaign_id 
          AND tt.recipient_email = sl.recipient_email 
          AND te.event_type = 'click'
          AND te.link_url IS NOT NULL
      ) as click_urls
    FROM send_logs sl
    WHERE sl.campaign_id = ?
    GROUP BY sl.recipient_email
    ORDER BY sl.sent_at DESC
  `, [campaignId])

  const totalSent = sent // Rate calculation based on successfully sent emails only
  const opens = openStats?.total || 0
  const uniqueOpens = openStats?.unique_count || 0
  const clicks = clickStats?.total || 0
  const uniqueClicks = clickStats?.unique_count || 0

  return {
    delivery: {
      sent,
      failed,
      queued,
      bounced: bounceStats?.total || 0,
      hardBounces: bounceStats?.hard || 0,
      softBounces: bounceStats?.soft || 0,
    },
    engagement: {
      opens,
      uniqueOpens,
      openRate: totalSent > 0 ? Math.round((uniqueOpens / totalSent) * 100 * 10) / 10 : 0,
      clicks,
      uniqueClicks,
      clickRate: totalSent > 0 ? Math.round((uniqueClicks / totalSent) * 100 * 10) / 10 : 0,
    },
    topLinks: topLinks.map((l: { link_url: string; clicks: number }) => ({ url: l.link_url, clicks: l.clicks })),
    opensOverTime: opensOverTime.map((o: { hour: string; count: number }) => ({ hour: o.hour, count: o.count })),
    recipients: recipients.map((r: { email: string; status: string; opens: number; click_urls: string | null }) => ({
      email: r.email,
      status: r.status,
      opens: r.opens,
      clicks: r.click_urls ? r.click_urls.split(',') : [],
    })),
  }
}
