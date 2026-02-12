import { queryAll, queryOne, execute, safeJsonParse } from '../db'
import { logger } from '../lib/logger'
import { compileTemplate, replaceVariables, injectTracking } from './template-compiler'
import { getNextAvailableAccount, incrementSendCount } from './account-manager'
import { createProvider } from '../providers'
import { getOrCreateToken, getTrackingSettings } from './tracking'
import { BRANCH_ACTION, BRANCH_DEFAULT } from '../../shared/constants'

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
  blocks: string | null
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
  trigger_data: string | null
}

interface SequenceBranch {
  id: string
  sequence_id: number
  name: string
  trigger_step_id: number | null
  trigger_type: string
  trigger_config: string | null
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
 * Switch enrollment to a specific branch
 */
async function switchToBranch(enrollment: Enrollment, branchId?: string): Promise<void> {
  const now = new Date().toISOString()
  
  // Determine target branch: use provided branchId, or check trigger_data, or default to 'action'
  const targetBranch = branchId 
    ?? (enrollment.trigger_data ? (safeJsonParse(enrollment.trigger_data, {}) as Record<string, unknown>).branchTarget as string : null)
    ?? BRANCH_ACTION

  // Find first step in the target branch
  const branchStep = await queryOne<SequenceStep>(
    `SELECT * FROM sequence_steps 
     WHERE sequence_id = ? AND branch_id = ? 
     ORDER BY branch_order ASC, step_order ASC 
     LIMIT 1`,
    [enrollment.sequence_id, targetBranch]
  )

  if (!branchStep) {
    // No branch defined, just mark as switched but stay on current path
    await execute(
      `UPDATE sequence_enrollments SET branch_switched_at = ? WHERE id = ?`,
      [now, enrollment.id]
    )
    return
  }

  const nextSendAt = calculateNextSendAt(branchStep)

  // Update enrollment to target branch
  await execute(
    `UPDATE sequence_enrollments 
     SET branch_id = ?, 
         branch_switched_at = ?,
         current_step = ?,
         next_send_at = ?
     WHERE id = ?`,
    [targetBranch, now, branchStep.step_order, nextSendAt, enrollment.id]
  )

  logger.info('Enrollment switched to branch', {
    service: 'sequence-processor',
    enrollmentId: enrollment.id,
    branch: targetBranch
  })
}

/**
 * Load blocks from a template by ID
 */
async function loadTemplateBlocks(templateId: number): Promise<unknown[] | null> {
  const template = await queryOne<TemplateRow>('SELECT id, blocks FROM templates WHERE id = ?', [templateId])
  if (!template) return null
  return safeJsonParse(template.blocks, [])
}

/**
 * Try to route an enrollment to the default branch.
 * Returns true if switched, false if no default branch exists or already on a branch.
 */
async function tryRouteToDefaultBranch(enrollment: Enrollment, sequenceId: number): Promise<boolean> {
  if (enrollment.branch_id) return false // Already on a branch

  const defaultBranch = await queryOne<SequenceBranch>(
    `SELECT * FROM sequence_branches WHERE sequence_id = ? AND id = ?`,
    [sequenceId, BRANCH_DEFAULT]
  )

  if (defaultBranch) {
    await switchToBranch(enrollment, BRANCH_DEFAULT)
    return true
  }
  return false
}

/**
 * Evaluate trigger conditions for branches triggered from a specific step
 */
async function evaluateBranchTriggers(
  enrollment: Enrollment,
  step: SequenceStep
): Promise<void> {
  // Load branches triggered from this step
  const triggeredBranches = await queryAll<SequenceBranch>(
    `SELECT * FROM sequence_branches 
     WHERE sequence_id = ? AND trigger_step_id = ?`,
    [enrollment.sequence_id, step.id]
  )

  if (triggeredBranches.length === 0) return

  // Get tracking token for this enrollment
  const syntheticCampaignId = -enrollment.sequence_id
  const tokenRow = await queryOne<{ id: number }>(
    `SELECT id FROM tracking_tokens WHERE campaign_id = ? AND recipient_email = ?`,
    [syntheticCampaignId, enrollment.recipient_email]
  )

  // Pre-fetch all tracking stats in a single query to avoid N queries in the loop
  let stats = { open_count: 0, click_count: 0 }
  if (tokenRow) {
    const trackingStats = await queryOne<{ open_count: number; click_count: number }>(
      `SELECT 
        COUNT(*) FILTER (WHERE event_type = 'open')::integer as open_count,
        COUNT(*) FILTER (WHERE event_type = 'click')::integer as click_count
      FROM tracking_events 
      WHERE token_id = ?`,
      [tokenRow.id]
    )
    if (trackingStats) {
      stats = trackingStats
    }
  }

  for (const branch of triggeredBranches) {
    const triggerConfig = safeJsonParse(branch.trigger_config ?? '{}', {}) as Record<string, unknown>
    let triggered = false

    switch (branch.trigger_type) {
      case 'action_click': {
        // Already handled by recordAction() setting trigger_data
        // Check if enrollment has trigger_data with matching branchTarget
        if (enrollment.action_clicked_at) {
          const triggerData = safeJsonParse(enrollment.trigger_data ?? '{}', {}) as Record<string, unknown>
          triggered = triggerData.branchTarget === branch.id
        }
        break
      }
      case 'opened': {
        if (!tokenRow) break
        triggered = stats.open_count > 0
        break
      }
      case 'clicked_any': {
        if (!tokenRow) break
        triggered = stats.click_count > 0
        break
      }
      case 'no_engagement': {
        const afterSteps = Number(triggerConfig.afterSteps) || 2
        if (enrollment.current_step < afterSteps) break
        if (!tokenRow) {
          // No token means no tracking at all - consider as no engagement
          triggered = true
          break
        }
        triggered = stats.open_count === 0
        break
      }
    }

    if (triggered) {
      logger.info('Branch trigger activated', {
        service: 'sequence-processor',
        enrollmentId: enrollment.id,
        branchId: branch.id,
        triggerType: branch.trigger_type
      })
      await switchToBranch(enrollment, branch.id)
      return // Only switch to one branch
    }
  }
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
      // Determine branch from trigger_data (set by recordAction)
      const triggerData = enrollment.trigger_data 
        ? safeJsonParse(enrollment.trigger_data, {}) as Record<string, unknown>
        : null
      const targetBranch = (triggerData?.branchTarget as string) ?? undefined
      await switchToBranch(enrollment, targetBranch)
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
  let step: SequenceStep | null = null
  if (branchId) {
    step = await queryOne<SequenceStep>(
      `SELECT * FROM sequence_steps 
       WHERE sequence_id = ? AND step_order = ? AND branch_id = ?`,
      [enrollment.sequence_id, enrollment.current_step, branchId]
    ) ?? null
  } else {
    step = await queryOne<SequenceStep>(
      `SELECT * FROM sequence_steps 
       WHERE sequence_id = ? AND step_order = ? 
       AND (branch_id IS NULL OR branch_id = '')`,
      [enrollment.sequence_id, enrollment.current_step]
    ) ?? null
  }

  if (!step) {
    // No more steps on main branch — check if we should route to default branch
    if (!enrollment.branch_switched_at && await tryRouteToDefaultBranch(enrollment, enrollment.sequence_id)) {
      return // Will be processed on next tick
    }

    // No more steps, complete the enrollment
    await execute(
      `UPDATE sequence_enrollments 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, next_send_at = NULL
       WHERE id = ?`,
      [enrollment.id]
    )
    return
  }

  // Use step blocks if present, fall back to template blocks
  let blocks: unknown[] = []
  if (step.blocks) {
    const parsed = typeof step.blocks === 'string' ? safeJsonParse(step.blocks, []) : step.blocks
    blocks = Array.isArray(parsed) ? parsed : []
  } else if (step.template_id) {
    blocks = await loadTemplateBlocks(step.template_id) ?? []
  }

  // Parse recipient data
  const recipientData: Record<string, string> = enrollment.recipient_data 
    ? safeJsonParse(enrollment.recipient_data, {}) as Record<string, string>
    : {}
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
    let html = compileTemplate(blocks as Parameters<typeof compileTemplate>[0], recipientData, trackingSettings.baseUrl)
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

    // Evaluate branch triggers after sending this step
    await evaluateBranchTriggers(enrollment, step)

    // Re-fetch enrollment in case branch trigger switched it
    const refreshed = await queryOne<Enrollment>(
      `SELECT * FROM sequence_enrollments WHERE id = ?`,
      [enrollment.id]
    )
    if (refreshed && refreshed.branch_id !== branchId) {
      // Branch was switched by trigger evaluation, don't advance further
      return
    }

    // Advance to next step in same branch
    let nextStep: SequenceStep | null = null
    if (branchId) {
      nextStep = await queryOne<SequenceStep>(
        `SELECT * FROM sequence_steps 
         WHERE sequence_id = ? AND step_order > ? AND branch_id = ?
         ORDER BY step_order ASC 
         LIMIT 1`,
        [enrollment.sequence_id, enrollment.current_step, branchId]
      ) ?? null
    } else {
      nextStep = await queryOne<SequenceStep>(
        `SELECT * FROM sequence_steps 
         WHERE sequence_id = ? AND step_order > ? 
         AND (branch_id IS NULL OR branch_id = '')
         ORDER BY step_order ASC 
         LIMIT 1`,
        [enrollment.sequence_id, enrollment.current_step]
      ) ?? null
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
      // No more steps on this branch
      // If on main branch and no action taken, check for default branch
      if (!enrollment.action_clicked_at && !enrollment.branch_switched_at
        && await tryRouteToDefaultBranch(enrollment, enrollment.sequence_id)) {
        return
      }

      // Complete
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
