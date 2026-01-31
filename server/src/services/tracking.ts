import { db } from '../db'
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
export function getTrackingSettings(): TrackingSettings {
  const getValue = (key: string, defaultVal: string): string => {
    const row = db.query('SELECT value FROM settings WHERE key = ?').get(key) as SettingRow | null
    return row?.value ?? defaultVal
  }

  return {
    enabled: getValue('tracking_enabled', 'true') === 'true',
    baseUrl: getValue('tracking_base_url', 'https://mailer.rbansal.xyz'),
    openEnabled: getValue('tracking_open_enabled', 'true') === 'true',
    clickEnabled: getValue('tracking_click_enabled', 'true') === 'true',
    hashIps: getValue('tracking_hash_ips', 'true') === 'true',
    retentionDays: parseInt(getValue('tracking_retention_days', '90'), 10),
  }
}

// Generate or get existing token for a campaign/recipient
export function getOrCreateToken(campaignId: number, recipientEmail: string): string {
  // Check if token exists
  const existing = db.query<TokenRow, [number, string]>(
    'SELECT token FROM tracking_tokens WHERE campaign_id = ? AND recipient_email = ?'
  ).get(campaignId, recipientEmail)

  if (existing) {
    return existing.token
  }

  // Create new token
  const token = randomUUID()
  db.run(
    'INSERT INTO tracking_tokens (campaign_id, recipient_email, token) VALUES (?, ?, ?)',
    [campaignId, recipientEmail, token]
  )

  return token
}

// Get token details by token string
export function getTokenDetails(token: string): TrackingToken | null {
  const row = db.query<TokenRow, [string]>(
    'SELECT id, campaign_id, recipient_email, token, created_at FROM tracking_tokens WHERE token = ?'
  ).get(token)

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
export function recordOpen(token: string, ipAddress?: string, userAgent?: string): boolean {
  const tokenDetails = getTokenDetails(token)
  if (!tokenDetails) return false

  const settings = getTrackingSettings()
  const ip = ipAddress && settings.hashIps ? hashIpAddress(ipAddress) : ipAddress

  db.run(
    `INSERT INTO tracking_events (token_id, event_type, ip_address, user_agent) VALUES (?, 'open', ?, ?)`,
    [tokenDetails.id, ip || null, userAgent || null]
  )

  return true
}

// Record a click event
export function recordClick(
  token: string,
  linkUrl: string,
  linkIndex: number,
  ipAddress?: string,
  userAgent?: string
): boolean {
  const tokenDetails = getTokenDetails(token)
  if (!tokenDetails) return false

  const settings = getTrackingSettings()
  const ip = ipAddress && settings.hashIps ? hashIpAddress(ipAddress) : ipAddress

  db.run(
    `INSERT INTO tracking_events (token_id, event_type, link_url, link_index, ip_address, user_agent) VALUES (?, 'click', ?, ?, ?, ?)`,
    [tokenDetails.id, linkUrl, linkIndex, ip || null, userAgent || null]
  )

  return true
}

// Get campaign analytics
export function getCampaignAnalytics(campaignId: number): CampaignAnalytics {
  // Get delivery stats from send_logs
  const deliveryStats = db.query<{ status: string; count: number }, [number]>(
    `SELECT status, COUNT(*) as count FROM send_logs WHERE campaign_id = ? GROUP BY status`
  ).all(campaignId)

  const sent = deliveryStats.find(s => s.status === 'sent')?.count || 0
  const failed = deliveryStats.find(s => s.status === 'failed')?.count || 0
  const queued = deliveryStats.find(s => s.status === 'queued')?.count || 0

  // Get open stats
  const openStats = db.query<{ total: number; unique_count: number }, [number]>(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT te.token_id) as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'open'
  `).get(campaignId)

  // Get click stats
  const clickStats = db.query<{ total: number; unique_count: number }, [number]>(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT te.token_id) as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'click'
  `).get(campaignId)

  // Get top links
  const topLinks = db.query<{ link_url: string; clicks: number }, [number]>(`
    SELECT te.link_url, COUNT(*) as clicks
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'click' AND te.link_url IS NOT NULL
    GROUP BY te.link_url
    ORDER BY clicks DESC
    LIMIT 10
  `).all(campaignId)

  // Get opens over time (hourly for last 48 hours)
  const opensOverTime = db.query<{ hour: string; count: number }, [number]>(`
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
  `).all(campaignId)

  // Get per-recipient data
  const recipients = db.query<{ 
    email: string; 
    status: string; 
    opens: number; 
    click_urls: string | null 
  }, [number]>(`
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
  `).all(campaignId)

  const totalSent = sent + failed // For rate calculation
  const opens = openStats?.total || 0
  const uniqueOpens = openStats?.unique_count || 0
  const clicks = clickStats?.total || 0
  const uniqueClicks = clickStats?.unique_count || 0

  return {
    delivery: { sent, failed, queued },
    engagement: {
      opens,
      uniqueOpens,
      openRate: totalSent > 0 ? Math.round((uniqueOpens / totalSent) * 100 * 10) / 10 : 0,
      clicks,
      uniqueClicks,
      clickRate: totalSent > 0 ? Math.round((uniqueClicks / totalSent) * 100 * 10) / 10 : 0,
    },
    topLinks: topLinks.map(l => ({ url: l.link_url, clicks: l.clicks })),
    opensOverTime: opensOverTime.map(o => ({ hour: o.hour, count: o.count })),
    recipients: recipients.map(r => ({
      email: r.email,
      status: r.status,
      opens: r.opens,
      clicks: r.click_urls ? r.click_urls.split(',') : [],
    })),
  }
}
