import { db } from '../db'
import { logger } from '../lib/logger'
import { compileTemplate, replaceVariables, injectTracking } from './template-compiler'
import { getNextAvailableAccount, incrementSendCount } from './account-manager'
import { createProvider } from '../providers'
import { getOrCreateToken, getTrackingSettings } from './tracking'

interface Sequence {
  id: number
  name: string
  enabled: number
}

interface SequenceStep {
  id: number
  sequence_id: number
  step_order: number
  template_id: number | null
  subject: string
  delay_days: number
  delay_hours: number
  send_time: string | null
}

interface Enrollment {
  id: number
  sequence_id: number
  recipient_email: string
  recipient_data: string | null
  current_step: number
  status: string
  next_send_at: string | null
}

interface TemplateRow {
  id: number
  blocks: string
}

/**
 * Calculate next send time for an enrollment
 */
function calculateNextSendAt(step: SequenceStep): string {
  const now = new Date()
  now.setDate(now.getDate() + step.delay_days)
  now.setHours(now.getHours() + step.delay_hours)
  
  // If specific send_time is set, adjust to that time
  if (step.send_time) {
    const [hours, minutes] = step.send_time.split(':').map(Number)
    now.setHours(hours, minutes, 0, 0)
  }
  
  return now.toISOString()
}

/**
 * Enroll a recipient in a sequence
 */
export function enrollRecipient(
  sequenceId: number,
  email: string,
  data: Record<string, string> = {}
): number {
  // Get first step
  const firstStep = db
    .query<SequenceStep, [number]>(
      `SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order LIMIT 1`
    )
    .get(sequenceId)

  if (!firstStep) {
    throw new Error('Sequence has no steps')
  }

  const nextSendAt = calculateNextSendAt(firstStep)

  const result = db.run(
    `INSERT INTO sequence_enrollments (sequence_id, recipient_email, recipient_data, current_step, next_send_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(sequence_id, recipient_email) DO UPDATE SET
       status = 'active',
       current_step = 1,
       next_send_at = excluded.next_send_at,
       completed_at = NULL`,
    [sequenceId, email, JSON.stringify(data), nextSendAt]
  )

  logger.info('Recipient enrolled in sequence', {
    service: 'sequence-processor',
    sequenceId,
    email,
    nextSendAt
  })

  return Number(result.lastInsertRowid)
}

/**
 * Pause an enrollment
 */
export function pauseEnrollment(enrollmentId: number): void {
  db.run(
    `UPDATE sequence_enrollments SET status = 'paused' WHERE id = ?`,
    [enrollmentId]
  )
}

/**
 * Cancel an enrollment
 */
export function cancelEnrollment(enrollmentId: number): void {
  db.run(
    `UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?`,
    [enrollmentId]
  )
}

/**
 * Resume a paused enrollment
 */
export function resumeEnrollment(enrollmentId: number): void {
  db.run(
    `UPDATE sequence_enrollments SET status = 'active' WHERE id = ?`,
    [enrollmentId]
  )
}

/**
 * Process all due sequence emails
 */
export async function processSequenceSteps(): Promise<number> {
  const now = new Date().toISOString()

  // Find due enrollments
  const dueEnrollments = db
    .query<Enrollment & { sequence_name: string }, [string]>(
      `SELECT e.*, s.name as sequence_name
       FROM sequence_enrollments e
       JOIN sequences s ON e.sequence_id = s.id
       WHERE e.status = 'active' 
         AND e.next_send_at <= ?
         AND s.enabled = 1`
    )
    .all(now)

  if (dueEnrollments.length === 0) {
    return 0
  }

  let processed = 0

  for (const enrollment of dueEnrollments) {
    try {
      await processEnrollmentStep(enrollment)
      processed++
    } catch (error) {
      logger.error('Failed to process sequence step', {
        service: 'sequence-processor',
        enrollmentId: enrollment.id
      }, error as Error)
    }
  }

  return processed
}

/**
 * Process a single enrollment step
 */
async function processEnrollmentStep(enrollment: Enrollment & { sequence_name: string }): Promise<void> {
  // Get current step
  const step = db
    .query<SequenceStep, [number, number]>(
      `SELECT * FROM sequence_steps 
       WHERE sequence_id = ? AND step_order = ?`
    )
    .get(enrollment.sequence_id, enrollment.current_step)

  if (!step) {
    // No more steps, complete the enrollment
    db.run(
      `UPDATE sequence_enrollments 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, next_send_at = NULL
       WHERE id = ?`,
      [enrollment.id]
    )
    return
  }

  // Get template
  let templateBlocks: unknown[] = []
  if (step.template_id) {
    const template = db
      .query<TemplateRow, [number]>('SELECT id, blocks FROM templates WHERE id = ?')
      .get(step.template_id)
    
    if (template) {
      templateBlocks = JSON.parse(template.blocks)
    }
  }

  // Parse recipient data
  const recipientData = enrollment.recipient_data ? JSON.parse(enrollment.recipient_data) : {}
  recipientData.email = enrollment.recipient_email

  // Get account
  const account = getNextAvailableAccount()
  if (!account) {
    logger.warn('No available account for sequence step', {
      service: 'sequence-processor',
      enrollmentId: enrollment.id
    })
    return
  }

  const trackingSettings = getTrackingSettings()

  try {
    // Compile email
    let html = compileTemplate(templateBlocks as Parameters<typeof compileTemplate>[0], recipientData)
    const subject = replaceVariables(step.subject, recipientData)

    // Add tracking
    if (trackingSettings.enabled) {
      // Use a synthetic campaign ID for sequences
      const syntheticCampaignId = -enrollment.sequence_id
      const token = getOrCreateToken(syntheticCampaignId, enrollment.recipient_email)
      html = injectTracking(html, token, trackingSettings.baseUrl, {
        openTracking: trackingSettings.openEnabled,
        clickTracking: trackingSettings.clickEnabled
      })
    }

    // Send
    const provider = createProvider(account.providerType, account.config as unknown as Parameters<typeof createProvider>[1])
    await provider.send({
      to: enrollment.recipient_email,
      subject,
      html
    })
    await provider.disconnect()

    incrementSendCount(account.id)

    logger.info('Sequence step sent', {
      service: 'sequence-processor',
      enrollmentId: enrollment.id,
      step: enrollment.current_step,
      recipient: enrollment.recipient_email
    })

    // Advance to next step
    const nextStep = db
      .query<SequenceStep, [number, number]>(
        `SELECT * FROM sequence_steps 
         WHERE sequence_id = ? AND step_order = ?`
      )
      .get(enrollment.sequence_id, enrollment.current_step + 1)

    if (nextStep) {
      const nextSendAt = calculateNextSendAt(nextStep)
      db.run(
        `UPDATE sequence_enrollments 
         SET current_step = current_step + 1, next_send_at = ?
         WHERE id = ?`,
        [nextSendAt, enrollment.id]
      )
    } else {
      // No more steps, complete
      db.run(
        `UPDATE sequence_enrollments 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, next_send_at = NULL
         WHERE id = ?`,
        [enrollment.id]
      )
    }
  } catch (error) {
    logger.error('Failed to send sequence step', {
      service: 'sequence-processor',
      enrollmentId: enrollment.id
    }, error as Error)
    throw error
  }
}
