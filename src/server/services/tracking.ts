import { queryAll, queryOne, execute, safeJsonParse } from '../db'
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
  userAgent: string | null,
  buttonId?: string | null
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
  const enrollmentRow = await queryOne<any>(
    `SELECT * FROM sequence_enrollments 
     WHERE sequence_id = ? AND recipient_email = ? AND status = 'active'`,
    [sequenceId, tokenDetails.recipientEmail]
  )

  if (!enrollmentRow) {
    return { success: false }
  }

  // Check if already clicked (idempotent)
  if (enrollmentRow.action_clicked_at) {
    return { success: true, enrollment: enrollmentRow }
  }

  // Apply IP hashing based on privacy settings
  const settings = await getTrackingSettings()
  const finalIp = settings.hashIps && ipAddress 
    ? hashIpAddress(ipAddress) 
    : ipAddress

  // Record tracking event
  await execute(
    `INSERT INTO tracking_events (token_id, event_type, ip_address, user_agent)
     VALUES (?, 'action', ?, ?)`,
    [tokenDetails.id, finalIp ?? null, userAgent ?? null]
  )

  // Resolve current step using branch_id to avoid ambiguity across branches
  const branchId = enrollmentRow.branch_id
  const stepRow = await queryOne<{ id: number }>(
    branchId
      ? `SELECT id FROM sequence_steps WHERE sequence_id = ? AND step_order = ? AND branch_id = ?`
      : `SELECT id FROM sequence_steps WHERE sequence_id = ? AND step_order = ? AND (branch_id IS NULL OR branch_id = '')`,
    branchId ? [sequenceId, enrollmentRow.current_step, branchId] : [sequenceId, enrollmentRow.current_step]
  )

  // Determine branch target from the button's block configuration
  let branchTarget: string | null = null
  if (buttonId && stepRow) {
    branchTarget = await findBranchTargetForButton(stepRow.id, buttonId)
  }
  if (stepRow) {
    await execute(
      `INSERT INTO sequence_actions (sequence_id, step_id, enrollment_id, clicked_at, destination_type, button_id, branch_target)
       VALUES (?, ?, ?, NOW(), 'hosted', ?, ?)`,
      [sequenceId, stepRow.id, enrollmentRow.id, buttonId ?? null, branchTarget ?? null]
    )
  }

  // Atomically update enrollment only if not already clicked
  const now = new Date().toISOString()
  const triggerData = buttonId || branchTarget 
    ? JSON.stringify({ buttonId: buttonId ?? null, branchTarget: branchTarget ?? null })
    : null
  const updateResult = await execute(
    `UPDATE sequence_enrollments 
     SET action_clicked_at = ?,
         trigger_data = COALESCE(?, trigger_data)
     WHERE id = ? AND action_clicked_at IS NULL`,
    [now, triggerData, enrollmentRow.id]
  )

  // Check if update actually happened (another request may have won the race)
  if (updateResult.rowsAffected === 0) {
    // Already clicked by concurrent request, return success with existing data
    return { success: true, enrollment: enrollmentRow }
  }

  return { 
    success: true, 
    enrollment: { ...enrollmentRow, action_clicked_at: now, trigger_data: triggerData }
  }
}

/**
 * Find the branch target for a specific button in a step's blocks
 */
async function findBranchTargetForButton(
  sequenceId: number,
  stepOrder: number,
  buttonId: string
): Promise<string | null> {
  // First try step blocks, then fall back to template blocks
  const stepRow = await queryOne<{ blocks: string | null; template_id: number | null }>(
    `SELECT blocks, template_id FROM sequence_steps WHERE sequence_id = ? AND step_order = ?`,
    [sequenceId, stepOrder]
  )
  if (!stepRow) return null

  let blocks: any[] = []
  if (stepRow.blocks) {
    blocks = safeJsonParse(typeof stepRow.blocks === 'string' ? stepRow.blocks : JSON.stringify(stepRow.blocks), [])
  } else if (stepRow.template_id) {
    const templateRow = await queryOne<{ blocks: string }>('SELECT blocks FROM templates WHERE id = ?', [stepRow.template_id])
    if (templateRow) {
      blocks = safeJsonParse(templateRow.blocks, [])
    }
  }

  // Find the action button block with matching buttonId
  const actionBlock = blocks.find((b: any) =>
    (b.type === 'action-button' || (b.type === 'button' && b.props?.isActionTrigger)) &&
    b.props?.buttonId === buttonId
  )

  return actionBlock?.props?.branchTarget ?? null
}

// Get action button configuration from a sequence step
export async function getActionConfig(sequenceId: number, stepId: number, buttonId?: string | null): Promise<{
  destinationType: 'external' | 'hosted'
  destinationUrl: string | null
  hostedMessage: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  redirectUrl: string | null
  redirectDelay: number | null
  buttonId: string | null
} | null> {
  // Check step blocks first, then fall back to template blocks
  const stepWithBlocks = await queryOne<{ blocks: string | null; template_id: number | null }>(
    `SELECT blocks, template_id FROM sequence_steps WHERE id = ?`,
    [stepId]
  )

  let blocks: any[] = []

  if (stepWithBlocks?.blocks) {
    blocks = safeJsonParse(typeof stepWithBlocks.blocks === 'string' ? stepWithBlocks.blocks : JSON.stringify(stepWithBlocks.blocks), [])
  } else if (stepWithBlocks?.template_id) {
    const templateRow = await queryOne<{ blocks: string }>(
      `SELECT blocks FROM templates WHERE id = ?`,
      [stepWithBlocks.template_id]
    )
    if (templateRow) {
      blocks = safeJsonParse(templateRow.blocks, [])
    }
  }

  if (blocks.length === 0) return null

  // Find matching action block - by buttonId if provided, otherwise first action button
  let actionBlock: any = null
  if (buttonId) {
    actionBlock = blocks.find((b: any) =>
      (b.type === 'action-button' || (b.type === 'button' && b.props?.isActionTrigger)) &&
      b.props?.buttonId === buttonId
    )
  }
  if (!actionBlock) {
    actionBlock = blocks.find((b: any) =>
      b.type === 'action-button' || (b.type === 'button' && b.props?.isActionTrigger)
    )
  }

  if (!actionBlock) return null

  return {
    destinationType: actionBlock.props.destinationType || 'hosted',
    destinationUrl: actionBlock.props.destinationUrl || null,
    hostedMessage: actionBlock.props.hostedMessage || 'Thank you for your response!',
    ctaLabel: actionBlock.props.ctaLabel || null,
    ctaUrl: actionBlock.props.ctaUrl || null,
    redirectUrl: actionBlock.props.redirectUrl || null,
    redirectDelay: actionBlock.props.redirectDelay != null ? Math.max(1, Math.min(Math.round(Number(actionBlock.props.redirectDelay) || 5), 60)) : null,
    buttonId: actionBlock.props.buttonId || null,
  }
}

// Get campaign analytics
export async function getCampaignAnalytics(campaignId: number): Promise<CampaignAnalytics> {
  // Get delivery stats from send_logs
  const deliveryStats = await queryAll<{ status: string; count: number }>(
    `SELECT status, COUNT(*)::integer as count FROM send_logs WHERE campaign_id = ? GROUP BY status`,
    [campaignId]
  )

  const sent = deliveryStats.find((s: { status: string; count: number }) => s.status === 'success')?.count || 0
  const failed = deliveryStats.find((s: { status: string; count: number }) => s.status === 'failed')?.count || 0
  const queued = deliveryStats.find((s: { status: string; count: number }) => s.status === 'queued')?.count || 0

  // Get bounce stats
  const bounceStats = await queryOne<{ total: number; hard: number; soft: number }>(`
    SELECT 
      COUNT(*)::integer as total,
      SUM(CASE WHEN bounce_type = 'hard' THEN 1 ELSE 0 END)::integer as hard,
      SUM(CASE WHEN bounce_type = 'soft' THEN 1 ELSE 0 END)::integer as soft
    FROM bounces
    WHERE campaign_id = ?
  `, [campaignId])

  // Get open stats
  const openStats = await queryOne<{ total: number; unique_count: number }>(`
    SELECT 
      COUNT(*)::integer as total,
      COUNT(DISTINCT te.token_id)::integer as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'open'
  `, [campaignId])

  // Get click stats
  const clickStats = await queryOne<{ total: number; unique_count: number }>(`
    SELECT 
      COUNT(*)::integer as total,
      COUNT(DISTINCT te.token_id)::integer as unique_count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? AND te.event_type = 'click'
  `, [campaignId])

  // Get top links
  const topLinks = await queryAll<{ link_url: string; clicks: number }>(`
    SELECT te.link_url, COUNT(*)::integer as clicks
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
      to_char(te.created_at, 'YYYY-MM-DD HH24:00') as hour,
      COUNT(*)::integer as count
    FROM tracking_events te
    JOIN tracking_tokens tt ON te.token_id = tt.id
    WHERE tt.campaign_id = ? 
      AND te.event_type = 'open'
      AND te.created_at >= NOW() - INTERVAL '48 hours'
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
        SELECT COUNT(*)::integer FROM tracking_events te
        JOIN tracking_tokens tt ON te.token_id = tt.id
        WHERE tt.campaign_id = sl.campaign_id 
          AND tt.recipient_email = sl.recipient_email 
          AND te.event_type = 'open'
      ), 0) as opens,
      (
        SELECT STRING_AGG(DISTINCT te.link_url, ',')
        FROM tracking_events te
        JOIN tracking_tokens tt ON te.token_id = tt.id
        WHERE tt.campaign_id = sl.campaign_id 
          AND tt.recipient_email = sl.recipient_email 
          AND te.event_type = 'click'
          AND te.link_url IS NOT NULL
      ) as click_urls
    FROM send_logs sl
    WHERE sl.campaign_id = ?
    GROUP BY sl.recipient_email, sl.status
    ORDER BY MAX(sl.sent_at) DESC
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
