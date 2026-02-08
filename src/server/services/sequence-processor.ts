import { queryAll, queryOne, execute, safeJsonParse } from '../db'
import { logger } from '../lib/logger'
import { compileTemplate, replaceVariables, injectTracking } from './template-compiler'
import { getNextAvailableAccount, incrementSendCount } from './account-manager'
import { createProvider } from '../providers'
import { getOrCreateToken, getTrackingSettings } from './tracking'
import { BRANCH_ACTION } from '../../shared/constants'

interface Sequence {
  id: number
  name: string
  enabled: boolean
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
  branch_id: string | null
  branch_order: number | null
}

interface Enrollment {
  id: number
  sequence_id: number
  recipient_email: string
  recipient_data: string | null
  current_step: number
  status: string
  next_send_at: string | null
  branch_id: string | null
  action_clicked_at: string | null
  branch_switched_at: string | null
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
export async function enrollRecipient(
  sequenceId: number,
  email: string,
  data: Record<string, string> = {}
): Promise<number> {
  // Get first step (main branch only)
  const firstStep = await queryOne<SequenceStep>(
    `SELECT * FROM sequence_steps 
     WHERE sequence_id = ? AND (branch_id IS NULL OR branch_id = '')
     ORDER BY step_order LIMIT 1`,
    [sequenceId]
  )

  if (!firstStep) {
    throw new Error('Sequence has no steps')
  }

  const nextSendAt = calculateNextSendAt(firstStep)

  const result = await execute(
    `INSERT INTO sequence_enrollments (sequence_id, recipient_email, recipient_data, current_step, next_send_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(sequence_id, recipient_email) DO UPDATE SET
       status = 'active',
       current_step = 1,
       next_send_at = EXCLUDED.next_send_at,
       completed_at = NULL
     RETURNING id`,
    [sequenceId, email, JSON.stringify(data), nextSendAt]
  )

  logger.info('Recipient enrolled in sequence', {
    service: 'sequence-processor',
    sequenceId,
    email,
    nextSendAt
  })

  return Number(result.lastInsertRowid ?? 0)
}

/**
 * Pause an enrollment
 */
export async function pauseEnrollment(enrollmentId: number): Promise<void> {
  await execute(
    `UPDATE sequence_enrollments SET status = 'paused' WHERE id = ?`,
    [enrollmentId]
  )
}

/**
 * Cancel an enrollment
 */
export async function cancelEnrollment(enrollmentId: number): Promise<void> {
  await execute(
    `UPDATE sequence_enrollments SET status = 'cancelled' WHERE id = ?`,
    [enrollmentId]
  )
}

/**
 * Resume a paused enrollment
 */
export async function resumeEnrollment(enrollmentId: number): Promise<void> {
  await execute(
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
  const dueEnrollments = await queryAll<Enrollment & { sequence_name: string }>(
    `SELECT e.*, s.name as sequence_name
     FROM sequence_enrollments e
     JOIN sequences s ON e.sequence_id = s.id
     WHERE e.status = 'active' 
       AND e.next_send_at <= ?
        AND s.enabled = true`,
    [now]
  )

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
 * Switch enrollment to action branch when action is clicked
 */
async function switchToBranch(enrollment: Enrollment): Promise<void> {
  const now = new Date().toISOString()
  
  // Find first step in the 'action' branch
  const actionBranchStep = await queryOne<SequenceStep>(
    `SELECT * FROM sequence_steps 
     WHERE sequence_id = ? AND branch_id = ? 
     ORDER BY branch_order ASC, step_order ASC 
     LIMIT 1`,
    [enrollment.sequence_id, BRANCH_ACTION]
  )

  if (!actionBranchStep) {
    // No action branch defined, just mark as switched but stay on current path
    await execute(
      `UPDATE sequence_enrollments SET branch_switched_at = ? WHERE id = ?`,
      [now, enrollment.id]
    )
    return
  }

  const nextSendAt = calculateNextSendAt(actionBranchStep)

  // Update enrollment to action branch
  await execute(
    `UPDATE sequence_enrollments 
     SET branch_id = ?, 
         branch_switched_at = ?,
         current_step = ?,
         next_send_at = ?
     WHERE id = ?`,
    [BRANCH_ACTION, now, actionBranchStep.step_order, nextSendAt, enrollment.id]
  )

  logger.info('Enrollment switched to action branch', {
    service: 'sequence-processor',
    enrollmentId: enrollment.id
  })
}

/**
 * Process a single enrollment step
 */
async function processEnrollmentStep(enrollment: Enrollment & { sequence_name: string }): Promise<void> {
  // Check if action was clicked and we need to switch branches
  if (enrollment.action_clicked_at && !enrollment.branch_switched_at) {
    // Check branch delay
    const sequence = await queryOne<{ branch_delay_hours: number }>(
      'SELECT branch_delay_hours FROM sequences WHERE id = ?',
      [enrollment.sequence_id]
    )
    
    const delayHours = sequence?.branch_delay_hours || 0
    const actionTime = new Date(enrollment.action_clicked_at).getTime()
    const delayMs = delayHours * 60 * 60 * 1000
    const now = Date.now()
    
    if (now >= actionTime + delayMs) {
      await switchToBranch(enrollment)
      // Re-fetch enrollment after branch switch
      const updated = await queryOne<Enrollment & { sequence_name: string }>(
        `SELECT e.*, s.name as sequence_name
         FROM sequence_enrollments e
         JOIN sequences s ON e.sequence_id = s.id
         WHERE e.id = ?`,
        [enrollment.id]
      )
      if (updated) {
        enrollment = updated
      }
    }
  }

  // Determine branch filter for step queries
  const branchId = enrollment.branch_id

  // Get current step
  let step: SequenceStep | null
  if (branchId) {
    step = await queryOne<SequenceStep>(
      `SELECT * FROM sequence_steps 
       WHERE sequence_id = ? AND step_order = ? AND branch_id = ?`,
      [enrollment.sequence_id, enrollment.current_step, branchId]
    )
  } else {
    step = await queryOne<SequenceStep>(
      `SELECT * FROM sequence_steps 
       WHERE sequence_id = ? AND step_order = ? 
       AND (branch_id IS NULL OR branch_id = '')`,
      [enrollment.sequence_id, enrollment.current_step]
    )
  }

  if (!step) {
    // No more steps, complete the enrollment
    await execute(
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
    const template = await queryOne<TemplateRow>('SELECT id, blocks FROM templates WHERE id = ?', [step.template_id])
    
    if (template) {
      templateBlocks = safeJsonParse(template.blocks, [])
    }
  }

  // Parse recipient data
  const recipientData = enrollment.recipient_data ? safeJsonParse(enrollment.recipient_data, {}) : {}
  recipientData.email = enrollment.recipient_email

  // Get account
  const account = await getNextAvailableAccount()
  if (!account) {
    logger.warn('No available account for sequence step', {
      service: 'sequence-processor',
      enrollmentId: enrollment.id
    })
    return
  }

  const trackingSettings = await getTrackingSettings()

  try {
    // Compile email
    let html = compileTemplate(templateBlocks as Parameters<typeof compileTemplate>[0], recipientData, trackingSettings.baseUrl)
    const subject = replaceVariables(step.subject, recipientData)

    // Add tracking
    if (trackingSettings.enabled) {
      // Use a synthetic campaign ID for sequences
      const syntheticCampaignId = -enrollment.sequence_id
      const token = await getOrCreateToken(syntheticCampaignId, enrollment.recipient_email)
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

    await incrementSendCount(account.id)

    logger.info('Sequence step sent', {
      service: 'sequence-processor',
      enrollmentId: enrollment.id,
      step: enrollment.current_step,
      recipient: enrollment.recipient_email
    })

    // Advance to next step in same branch
    let nextStep: SequenceStep | null
    if (branchId) {
      nextStep = await queryOne<SequenceStep>(
        `SELECT * FROM sequence_steps 
         WHERE sequence_id = ? AND step_order > ? AND branch_id = ?
         ORDER BY step_order ASC 
         LIMIT 1`,
        [enrollment.sequence_id, enrollment.current_step, branchId]
      )
    } else {
      nextStep = await queryOne<SequenceStep>(
        `SELECT * FROM sequence_steps 
         WHERE sequence_id = ? AND step_order > ? 
         AND (branch_id IS NULL OR branch_id = '')
         ORDER BY step_order ASC 
         LIMIT 1`,
        [enrollment.sequence_id, enrollment.current_step]
      )
    }

    if (nextStep) {
      const nextSendAt = calculateNextSendAt(nextStep)
      await execute(
        `UPDATE sequence_enrollments 
         SET current_step = ?, next_send_at = ?
         WHERE id = ?`,
        [nextStep.step_order, nextSendAt, enrollment.id]
      )
    } else {
      // No more steps, complete
      await execute(
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
