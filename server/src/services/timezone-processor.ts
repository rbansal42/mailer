import { db } from '../db'
import { logger } from '../lib/logger'

interface Recipient {
  email: string
  timezone?: string
  [key: string]: string | undefined
}

interface ScheduledBatch {
  id: number
  campaign_id: number
  scheduled_for: string
  recipient_emails: string
  status: string
}

/**
 * Get UTC time for a local time in a specific timezone
 * 
 * For a proper implementation, use a library like luxon or date-fns-tz
 * This is a simplified version using common timezone offsets
 */
export function getUtcTimeForLocal(localTime: string, timezone: string): Date {
  // Parse local time (HH:MM format)
  const [hours, minutes] = localTime.split(':').map(Number)
  
  // Common timezone offsets (simplified - a real impl would use Intl or luxon)
  const offsets: Record<string, number> = {
    'UTC': 0,
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Asia/Kolkata': 5.5,
    'Australia/Sydney': 11,
  }

  const offset = offsets[timezone] ?? 0
  
  const now = new Date()
  const utcDate = new Date(now)
  utcDate.setUTCHours(hours - offset, minutes, 0, 0)
  
  // If the calculated time is in the past, move to tomorrow
  if (utcDate <= now) {
    utcDate.setUTCDate(utcDate.getUTCDate() + 1)
  }
  
  return utcDate
}

/**
 * Create timezone-based batches for a campaign
 * Groups recipients by timezone and schedules each batch for the target local time
 */
export function createTimezoneBatches(
  campaignId: number,
  recipients: Recipient[],
  targetLocalTime: string
): number {
  // Group recipients by timezone
  const batches: Map<string, string[]> = new Map()
  
  for (const recipient of recipients) {
    const tz = recipient.timezone || 'UTC'
    if (!batches.has(tz)) {
      batches.set(tz, [])
    }
    batches.get(tz)!.push(recipient.email)
  }

  let created = 0

  // Create a batch for each timezone
  for (const [timezone, emails] of batches) {
    const scheduledFor = getUtcTimeForLocal(targetLocalTime, timezone)
    
    db.run(
      `INSERT INTO scheduled_batches (campaign_id, scheduled_for, recipient_emails, status)
       VALUES (?, ?, ?, 'pending')`,
      [campaignId, scheduledFor.toISOString(), JSON.stringify(emails)]
    )
    
    created++
    
    logger.info('Created timezone batch', {
      service: 'timezone-processor',
      campaignId,
      timezone,
      recipientCount: emails.length,
      scheduledFor: scheduledFor.toISOString()
    })
  }

  return created
}

/**
 * Process all due scheduled batches
 * Returns the batches that need to be sent
 */
export function getScheduledBatches(): ScheduledBatch[] {
  const now = new Date().toISOString()
  
  const dueBatches = db
    .query<ScheduledBatch, [string]>(
      `SELECT * FROM scheduled_batches 
       WHERE status = 'pending' AND scheduled_for <= ?
       ORDER BY scheduled_for`
    )
    .all(now)

  return dueBatches
}

/**
 * Mark a batch as sending
 */
export function markBatchSending(batchId: number): void {
  db.run(
    `UPDATE scheduled_batches SET status = 'sending' WHERE id = ?`,
    [batchId]
  )
}

/**
 * Mark a batch as completed
 */
export function markBatchCompleted(batchId: number): void {
  db.run(
    `UPDATE scheduled_batches SET status = 'completed' WHERE id = ?`,
    [batchId]
  )
}

/**
 * Get recipients from a batch
 */
export function getBatchRecipients(batch: ScheduledBatch): string[] {
  return JSON.parse(batch.recipient_emails)
}

/**
 * Process all due batches (called by scheduler)
 */
export async function processScheduledBatches(): Promise<number> {
  const batches = getScheduledBatches()
  
  if (batches.length === 0) {
    return 0
  }

  logger.info('Processing scheduled batches', {
    service: 'timezone-processor',
    batchCount: batches.length
  })

  // Note: Actual sending is handled by the send route
  // This just finds batches that are ready to send
  // The scheduler will call this and then trigger sends for each batch

  return batches.length
}
