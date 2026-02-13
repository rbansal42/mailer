import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { queryAll, queryOne, execute, safeJsonParse } from '../db'
import { logger } from '../lib/logger'
import { enrollRecipient, pauseEnrollment, cancelEnrollment, resumeEnrollment } from '../services/sequence-processor'
import { generateSequence, getLLMSettings } from '../services/llm'
import { generateSequenceSchema, createBranchSchema, updateBranchSchema, validate } from '../lib/validation'
import type { SequenceBranch } from '../../shared/types'

export const sequencesRouter = Router()

// Rate limiter for AI generation endpoint
const generateRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: { error: 'Too many generation requests. Please wait a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
})

interface SequenceRow {
  id: number
  name: string
  description: string | null
  enabled: boolean
  branch_delay_hours: number
  created_at: string
  updated_at: string
}

interface SequenceStepRow {
  id: number
  sequence_id: number
  step_order: number
  template_id: number | null
  subject: string
  delay_days: number
  delay_hours: number
  send_time: string | null
  branch_id: string | null
  is_branch_point: boolean
  branch_order: number | null
  blocks: string | Record<string, unknown>[] | null
  created_at: string
}

interface BranchRow {
  id: string
  sequence_id: number
  name: string
  description: string | null
  color: string
  parent_branch_id: string | null
  trigger_step_id: number | null
  trigger_type: string
  trigger_config: string | Record<string, unknown>
  created_at: string
  updated_at: string
}

function formatBranch(row: BranchRow): SequenceBranch {
  let parsedConfig: Record<string, unknown> = {}
  try {
    parsedConfig = typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : row.trigger_config ?? {}
  } catch { parsedConfig = {} }

  return {
    id: row.id,
    sequence_id: row.sequence_id,
    name: row.name,
    description: row.description,
    color: row.color,
    parent_branch_id: row.parent_branch_id,
    trigger_step_id: row.trigger_step_id,
    trigger_type: row.trigger_type as SequenceBranch['trigger_type'],
    trigger_config: parsedConfig,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

interface EnrollmentRow {
  id: number
  sequence_id: number
  recipient_email: string
  recipient_data: string | null
  current_step: number
  status: string
  branch_id: string | null
  action_clicked_at: string | null
  enrolled_at: string
  next_send_at: string | null
  completed_at: string | null
  trigger_data: string | null
}

// GET / - List all sequences
sequencesRouter.get('/', async (req, res) => {
  try {
    const sequences = await queryAll<SequenceRow & { step_count: number; active_enrollments: number }>(`
      SELECT s.*, 
        (SELECT COUNT(*)::integer FROM sequence_steps WHERE sequence_id = s.id) as step_count,
        (SELECT COUNT(*)::integer FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrollments
      FROM sequences s
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `, [req.userId])

    res.json(sequences.map(s => ({
      ...s,
      enabled: s.enabled
    })))
  } catch (error) {
    logger.error('Failed to list sequences', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to list sequences' })
  }
})

// POST /generate - Generate sequence with AI (must be before /:id routes)
// GET /generate/status - Check if AI generation is available
sequencesRouter.get('/generate/status', async (_req, res) => {
  try {
    const settings = await getLLMSettings()
    const hasProvider = settings.providers.some(p => p.enabled && p.apiKey)
    const activeProvider = settings.activeProvider
    res.json({ available: hasProvider, activeProvider })
  } catch (error) {
    logger.error('Failed to check LLM status', { service: 'sequences' }, error as Error)
    res.json({ available: false, activeProvider: null })
  }
})

sequencesRouter.post('/generate', generateRateLimiter, async (req, res) => {
  try {
    const validation = validate(generateSequenceSchema, req.body)
    if (!validation.success) {
      res.status(400).json({ error: validation.error })
      return
    }

    const result = await generateSequence(validation.data)
    
    logger.info('Generated sequence via AI', { 
      service: 'sequences', 
      emailCount: result.emails.length 
    })

    res.json(result)
  } catch (error) {
    const err = error as Error
    logger.error('Failed to generate sequence', { service: 'sequences' }, err)
    
    // Provide user-friendly error messages
    if (err.message.includes('No LLM provider configured')) {
      res.status(503).json({ error: err.message })
      return
    }
    if (err.message.includes('exhausted') || err.message.includes('rate')) {
      res.status(429).json({ error: 'Service is busy. Please try again in a moment.' })
      return
    }
    if (err.message.includes('JSON') || err.message.includes('parse') || err.message.includes('Invalid response')) {
      res.status(500).json({ error: "Couldn't generate a valid sequence. Please try again." })
      return
    }
    
    res.status(500).json({ error: 'Failed to generate sequence' })
  }
})

// GET /:id - Get sequence with steps
sequencesRouter.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    
    const sequence = await queryOne<SequenceRow>('SELECT * FROM sequences WHERE id = ? AND user_id = ?', [id, req.userId])

    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const steps = await queryAll<SequenceStepRow>(
      `SELECT * FROM sequence_steps WHERE sequence_id = ? 
       ORDER BY branch_id NULLS FIRST, COALESCE(branch_order, step_order) ASC`,
      [id]
    )

    const branches = await queryAll<BranchRow>(
      `SELECT * FROM sequence_branches WHERE sequence_id = ? ORDER BY created_at ASC`,
      [id]
    )

    res.json({
      ...sequence,
      enabled: sequence.enabled,
      steps: steps.map(s => {
        let parsedBlocks: Record<string, unknown>[] | null = null
        if (s.blocks) {
          try {
            parsedBlocks = typeof s.blocks === 'string' ? JSON.parse(s.blocks) : s.blocks
          } catch { parsedBlocks = null }
        }
        return { ...s, blocks: parsedBlocks }
      }),
      branches: branches.map(b => formatBranch(b)),
    })
  } catch (error) {
    logger.error('Failed to get sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to get sequence' })
  }
})

// POST / - Create new sequence
sequencesRouter.post('/', async (req, res) => {
  try {
    const { name, description, enabled } = req.body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    const result = await execute(
      `INSERT INTO sequences (name, description, enabled, user_id) VALUES (?, ?, ?, ?) RETURNING id`,
      [name.trim(), description || null, enabled !== false, req.userId]
    )

    const id = Number(result.lastInsertRowid)
    logger.info('Created sequence', { service: 'sequences', sequenceId: id })

    res.status(201).json({ id, message: 'Sequence created' })
  } catch (error) {
    logger.error('Failed to create sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to create sequence' })
  }
})

// PUT /:id - Update sequence
sequencesRouter.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { name, description, enabled } = req.body

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (description !== undefined) { updates.push('description = ?'); params.push(description) }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled) }
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length === 1) { // Only updated_at
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    params.push(id, req.userId)
    await execute(`UPDATE sequences SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params)

    logger.info('Updated sequence', { service: 'sequences', sequenceId: id })
    res.json({ message: 'Sequence updated' })
  } catch (error) {
    logger.error('Failed to update sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update sequence' })
  }
})

// DELETE /:id - Delete sequence (cascades to steps and enrollments)
sequencesRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    await execute('DELETE FROM sequences WHERE id = ? AND user_id = ?', [id, req.userId])
    
    logger.info('Deleted sequence', { service: 'sequences', sequenceId: id })
    res.json({ message: 'Sequence deleted' })
  } catch (error) {
    logger.error('Failed to delete sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to delete sequence' })
  }
})

// POST /:id/steps - Add step to sequence
sequencesRouter.post('/:id/steps', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const { templateId, subject, delayDays, delayHours, sendTime, branchId, blocks } = req.body

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    // Validate required fields
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      res.status(400).json({ error: 'Subject is required' })
      return
    }
    if (delayDays !== undefined && (typeof delayDays !== 'number' || delayDays < 0)) {
      res.status(400).json({ error: 'Delay days must be a non-negative number' })
      return
    }
    if (delayHours !== undefined && (typeof delayHours !== 'number' || delayHours < 0)) {
      res.status(400).json({ error: 'Delay hours must be a non-negative number' })
      return
    }

    // Get next step order - check if in a branch
    let nextOrder: number
    if (branchId) {
      const maxOrder = await queryOne<{ max_order: number | null }>(
        `SELECT MAX(COALESCE(branch_order, step_order)) as max_order 
         FROM sequence_steps WHERE sequence_id = ? AND branch_id = ?`,
        [sequenceId, branchId]
      )
      nextOrder = ((maxOrder?.max_order as number) || 0) + 1
    } else {
      const maxOrder = await queryOne<{ max_order: number | null }>(
        `SELECT MAX(step_order) as max_order 
         FROM sequence_steps WHERE sequence_id = ? AND (branch_id IS NULL OR branch_id = '')`,
        [sequenceId]
      )
      nextOrder = ((maxOrder?.max_order as number) || 0) + 1
    }

    // Insert with branch fields and blocks
    const result = await execute(
      `INSERT INTO sequence_steps 
       (sequence_id, step_order, template_id, subject, delay_days, delay_hours, send_time, branch_id, branch_order, blocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id`,
      [
        sequenceId,
        nextOrder,
        templateId ?? null,
        subject,
        delayDays ?? 0,
        delayHours ?? 0,
        sendTime ?? null,
        branchId ?? null,
        branchId ? nextOrder : null,
        blocks ? JSON.stringify(blocks) : null,
      ]
    )

    const id = Number(result.lastInsertRowid)
    logger.info('Added step to sequence', { service: 'sequences', sequenceId, stepId: id, branchId })

    res.status(201).json({ id, stepOrder: nextOrder, message: 'Step added' })
  } catch (error) {
    logger.error('Failed to add step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to add step' })
  }
})

// PUT /:id/steps/:stepId - Update step
sequencesRouter.put('/:id/steps/:stepId', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const stepId = parseInt(req.params.stepId, 10)
    const { templateId, subject, delayDays, delayHours, sendTime, stepOrder, blocks } = req.body

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (templateId !== undefined) { updates.push('template_id = ?'); params.push(templateId) }
    if (subject !== undefined) { updates.push('subject = ?'); params.push(subject) }
    if (delayDays !== undefined) { updates.push('delay_days = ?'); params.push(delayDays) }
    if (delayHours !== undefined) { updates.push('delay_hours = ?'); params.push(delayHours) }
    if (sendTime !== undefined) { updates.push('send_time = ?'); params.push(sendTime) }
    if (stepOrder !== undefined) { updates.push('step_order = ?'); params.push(stepOrder) }
    if (blocks !== undefined) { updates.push('blocks = ?::jsonb'); params.push(blocks ? JSON.stringify(blocks) : null) }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    params.push(stepId, sequenceId)
    await execute(`UPDATE sequence_steps SET ${updates.join(', ')} WHERE id = ? AND sequence_id = ?`, params)

    logger.info('Updated step', { service: 'sequences', stepId })
    res.json({ message: 'Step updated' })
  } catch (error) {
    logger.error('Failed to update step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update step' })
  }
})

// DELETE /:id/steps/:stepId - Delete step
sequencesRouter.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const stepId = parseInt(req.params.stepId, 10)

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    await execute('DELETE FROM sequence_steps WHERE id = ? AND sequence_id = ?', [stepId, sequenceId])
    
    logger.info('Deleted step', { service: 'sequences', stepId })
    res.json({ message: 'Step deleted' })
  } catch (error) {
    logger.error('Failed to delete step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to delete step' })
  }
})

// GET /:id/enrollments - List enrollments for sequence
sequencesRouter.get('/:id/enrollments', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const status = req.query.status as string | undefined

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    let enrollments: EnrollmentRow[]
    
    if (status) {
      enrollments = await queryAll<EnrollmentRow>('SELECT * FROM sequence_enrollments WHERE sequence_id = ? AND status = ? ORDER BY enrolled_at DESC', [sequenceId, status])
    } else {
      enrollments = await queryAll<EnrollmentRow>('SELECT * FROM sequence_enrollments WHERE sequence_id = ? ORDER BY enrolled_at DESC', [sequenceId])
    }

    res.json(enrollments.map(e => ({
      ...e,
      recipientData: e.recipient_data ? safeJsonParse(e.recipient_data, null) : null,
      triggerData: e.trigger_data ? safeJsonParse(e.trigger_data, null) : null,
    })))
  } catch (error) {
    logger.error('Failed to list enrollments', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to list enrollments' })
  }
})

// POST /:id/enroll - Enroll recipients
sequencesRouter.post('/:id/enroll', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const { recipients } = req.body // Array of { email, data }

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: 'Recipients array required' })
      return
    }

    const enrolled: number[] = []
    for (const recipient of recipients) {
      try {
        const id = await enrollRecipient(sequenceId, recipient.email, recipient.data || {})
        enrolled.push(id)
      } catch (_e) {
        logger.warn('Failed to enroll recipient', { 
          service: 'sequences', 
          sequenceId, 
          email: recipient.email 
        })
      }
    }

    logger.info('Enrolled recipients', { service: 'sequences', sequenceId, count: enrolled.length })
    res.status(201).json({ enrolled: enrolled.length, ids: enrolled })
  } catch (error) {
    logger.error('Failed to enroll recipients', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to enroll recipients' })
  }
})

// PUT /:id/enrollments/:enrollmentId - Update enrollment (pause/cancel/resume)
sequencesRouter.put('/:id/enrollments/:enrollmentId', async (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const enrollmentId = parseInt(req.params.enrollmentId, 10)
    const { action } = req.body // 'pause' | 'cancel' | 'resume'

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [sequenceId, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    switch (action) {
      case 'pause':
        await pauseEnrollment(enrollmentId)
        break
      case 'cancel':
        await cancelEnrollment(enrollmentId)
        break
      case 'resume':
        await resumeEnrollment(enrollmentId)
        break
      default:
        res.status(400).json({ error: 'Invalid action. Use pause, cancel, or resume.' })
        return
    }

    logger.info('Updated enrollment', { service: 'sequences', enrollmentId, action })
    res.json({ message: `Enrollment ${action}d` })
  } catch (error) {
    logger.error('Failed to update enrollment', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update enrollment' })
  }
})

// POST /:id/branch-point - Create a branch point in the sequence
sequencesRouter.post('/:id/branch-point', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { afterStep, delayBeforeSwitch } = req.body

    // Verify ownership
    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [id, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    if (afterStep === undefined || typeof afterStep !== 'number') {
      res.status(400).json({ error: 'afterStep is required and must be a number' })
      return
    }

    // Verify the step exists
    const stepCheck = await queryOne(`SELECT id FROM sequence_steps WHERE sequence_id = ? AND step_order = ?`, [id, afterStep])
    if (!stepCheck) {
      res.status(404).json({ error: 'Step not found' })
      return
    }

    // Mark that step as a branch point and store delay config
    // Note: These two UPDATEs are not atomic, but the risk of partial failure is minimal
    // since both are simple UPDATE operations. If needed, a transaction could wrap both UPDATEs.
    await execute(
      `UPDATE sequence_steps SET is_branch_point = true WHERE sequence_id = ? AND step_order = ?`,
      [id, afterStep]
    )

    await execute(
      `UPDATE sequences SET branch_delay_hours = ? WHERE id = ?`,
      [delayBeforeSwitch ?? 0, id]
    )

    // Create default and action branches in sequence_branches table if they don't already exist
    await execute(
      `INSERT INTO sequence_branches (id, sequence_id, name, color, trigger_type, trigger_config)
       VALUES ('default', ?, 'Default', '#6366f1', 'no_engagement', '{}')
       ON CONFLICT (id, sequence_id) DO NOTHING`,
      [id]
    )

    await execute(
      `INSERT INTO sequence_branches (id, sequence_id, name, color, trigger_step_id, trigger_type, trigger_config)
       VALUES ('action', ?, 'Action', '#f59e0b', ?, 'action_click', '{}')
       ON CONFLICT (id, sequence_id) DO NOTHING`,
      [id, (stepCheck as any).id]
    )

    logger.info('Created branch point', { service: 'sequences', sequenceId: id, afterStep })
    res.json({ success: true })
  } catch (error) {
    logger.error('Failed to create branch point', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to create branch point' })
  }
})

// GET /:id/actions - Get action clicks for a sequence
sequencesRouter.get('/:id/actions', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    // Verify ownership
    const sequence = await queryOne(`SELECT id FROM sequences WHERE id = ? AND user_id = ?`, [id, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const actions = await queryAll<{
      id: number
      sequence_id: number
      step_id: number
      enrollment_id: number
      clicked_at: string
      destination_type: string
      destination_url: string | null
      hosted_message: string | null
      button_text: string | null
      recipient_email: string
      recipient_data: string | null
    }>(
      `SELECT sa.*, se.recipient_email, se.recipient_data
       FROM sequence_actions sa
       JOIN sequence_enrollments se ON sa.enrollment_id = se.id
       WHERE sa.sequence_id = ?
       ORDER BY sa.clicked_at DESC`,
      [id]
    )

    res.json(actions)
  } catch (error) {
    logger.error('Failed to get actions', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to get actions' })
  }
})

// GET /:id/actions/export - Export action clicks as CSV
sequencesRouter.get('/:id/actions/export', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)

    // Verify ownership
    const sequence = await queryOne(`SELECT id FROM sequences WHERE id = ? AND user_id = ?`, [id, req.userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const actions = await queryAll<{
      recipient_email: string
      clicked_at: string
      button_text: string | null
      from_step: string
    }>(
      `SELECT se.recipient_email, sa.clicked_at, sa.button_text, ss.subject as from_step
       FROM sequence_actions sa
       JOIN sequence_enrollments se ON sa.enrollment_id = se.id
       JOIN sequence_steps ss ON sa.step_id = ss.id
       WHERE sa.sequence_id = ?
       ORDER BY sa.clicked_at DESC`,
      [id]
    )

    const escapeCSV = (value: string | null): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csv = [
      'email,clicked_at,button_text,from_step',
      ...actions.map((row) =>
        [
          escapeCSV(row.recipient_email),
          escapeCSV(row.clicked_at),
          escapeCSV(row.button_text),
          escapeCSV(row.from_step)
        ].join(',')
      )
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=sequence-${id}-actions.csv`)
    res.send(csv)
  } catch (error) {
    logger.error('Failed to export actions', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to export actions' })
  }
})

// ==================== Branch CRUD ====================

// GET /:id/branches - List branches for a sequence
sequencesRouter.get('/:id/branches', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const userId = req.userId

    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [id, userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const branches = await queryAll<BranchRow>(
      'SELECT * FROM sequence_branches WHERE sequence_id = ? ORDER BY created_at ASC',
      [id]
    )
    res.json(branches.map(b => formatBranch(b)))
  } catch (error) {
    logger.error('Failed to list branches', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to list branches' })
  }
})

// POST /:id/branches - Create a branch
sequencesRouter.post('/:id/branches', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const userId = req.userId

    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [id, userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const parsed = createBranchSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      res.status(400).json({ error: errors })
      return
    }

    const { id: branchId, name, description, color, parentBranchId, triggerStepId, triggerType, triggerConfig } = parsed.data

    const result = await queryOne<BranchRow>(
      `INSERT INTO sequence_branches (id, sequence_id, name, description, color, parent_branch_id, trigger_step_id, trigger_type, trigger_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)
       RETURNING *`,
      [
        branchId,
        id,
        name,
        description ?? null,
        color ?? '#6366f1',
        parentBranchId ?? null,
        triggerStepId ?? null,
        triggerType,
        JSON.stringify(triggerConfig ?? {}),
      ]
    )

    if (!result) {
      res.status(500).json({ error: 'Failed to create branch' })
      return
    }

    logger.info('Created branch', { service: 'sequences', sequenceId: id, branchId })
    res.status(201).json(formatBranch(result))
  } catch (error) {
    logger.error('Failed to create branch', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to create branch' })
  }
})

// PUT /:id/branches/:branchId - Update a branch
sequencesRouter.put('/:id/branches/:branchId', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { branchId } = req.params
    const userId = req.userId

    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [id, userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const parsed = updateBranchSchema.safeParse(req.body)
    if (!parsed.success) {
      const errors = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      res.status(400).json({ error: errors })
      return
    }

    const { name, description, color, triggerStepId, triggerType, triggerConfig } = parsed.data

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (description !== undefined) { updates.push('description = ?'); params.push(description ?? null) }
    if (color !== undefined) { updates.push('color = ?'); params.push(color) }
    if (triggerStepId !== undefined) { updates.push('trigger_step_id = ?'); params.push(triggerStepId) }
    if (triggerType !== undefined) { updates.push('trigger_type = ?'); params.push(triggerType) }
    if (triggerConfig !== undefined) { updates.push('trigger_config = ?::jsonb'); params.push(JSON.stringify(triggerConfig)) }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    updates.push('updated_at = NOW()')
    params.push(branchId, id)
    const updated = await queryOne<BranchRow>(
      `UPDATE sequence_branches SET ${updates.join(', ')} WHERE id = ? AND sequence_id = ? RETURNING *`,
      params
    )

    if (!updated) {
      res.status(404).json({ error: 'Branch not found' })
      return
    }

    logger.info('Updated branch', { service: 'sequences', sequenceId: id, branchId })
    res.json(formatBranch(updated))
  } catch (error) {
    logger.error('Failed to update branch', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update branch' })
  }
})

// DELETE /:id/branches/:branchId - Delete a branch and its steps
sequencesRouter.delete('/:id/branches/:branchId', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { branchId } = req.params
    const userId = req.userId

    const sequence = await queryOne('SELECT id FROM sequences WHERE id = ? AND user_id = ?', [id, userId])
    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    // Delete steps in this branch first
    await execute('DELETE FROM sequence_steps WHERE sequence_id = ? AND branch_id = ?', [id, branchId])
    await execute('DELETE FROM sequence_branches WHERE id = ? AND sequence_id = ?', [branchId, id])

    logger.info('Deleted branch', { service: 'sequences', sequenceId: id, branchId })
    res.json({ message: 'Branch deleted' })
  } catch (error) {
    logger.error('Failed to delete branch', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to delete branch' })
  }
})
