import { Router } from 'express'
import { db } from '../db'
import { logger } from '../lib/logger'
import { enrollRecipient, pauseEnrollment, cancelEnrollment, resumeEnrollment } from '../services/sequence-processor'

export const sequencesRouter = Router()

interface SequenceRow {
  id: number
  name: string
  description: string | null
  enabled: number
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
  created_at: string
}

interface EnrollmentRow {
  id: number
  sequence_id: number
  recipient_email: string
  recipient_data: string | null
  current_step: number
  status: string
  enrolled_at: string
  next_send_at: string | null
  completed_at: string | null
}

// GET / - List all sequences
sequencesRouter.get('/', (_req, res) => {
  try {
    const sequences = db
      .query(`
        SELECT s.*, 
          (SELECT COUNT(*) FROM sequence_steps WHERE sequence_id = s.id) as step_count,
          (SELECT COUNT(*) FROM sequence_enrollments WHERE sequence_id = s.id AND status = 'active') as active_enrollments
        FROM sequences s
        ORDER BY s.created_at DESC
      `)
      .all() as (SequenceRow & { step_count: number; active_enrollments: number })[]

    res.json(sequences.map(s => ({
      ...s,
      enabled: Boolean(s.enabled)
    })))
  } catch (error) {
    logger.error('Failed to list sequences', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to list sequences' })
  }
})

// GET /:id - Get sequence with steps
sequencesRouter.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    
    const sequence = db
      .query('SELECT * FROM sequences WHERE id = ?')
      .get(id) as SequenceRow | null

    if (!sequence) {
      res.status(404).json({ error: 'Sequence not found' })
      return
    }

    const steps = db
      .query('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order')
      .all(id) as SequenceStepRow[]

    res.json({
      ...sequence,
      enabled: Boolean(sequence.enabled),
      steps
    })
  } catch (error) {
    logger.error('Failed to get sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to get sequence' })
  }
})

// POST / - Create new sequence
sequencesRouter.post('/', (req, res) => {
  try {
    const { name, description, enabled } = req.body

    const result = db.run(
      `INSERT INTO sequences (name, description, enabled) VALUES (?, ?, ?)`,
      [name, description || null, enabled !== false ? 1 : 0]
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
sequencesRouter.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    const { name, description, enabled } = req.body

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (description !== undefined) { updates.push('description = ?'); params.push(description) }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0) }
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length === 1) { // Only updated_at
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    params.push(id)
    db.run(`UPDATE sequences SET ${updates.join(', ')} WHERE id = ?`, params)

    logger.info('Updated sequence', { service: 'sequences', sequenceId: id })
    res.json({ message: 'Sequence updated' })
  } catch (error) {
    logger.error('Failed to update sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update sequence' })
  }
})

// DELETE /:id - Delete sequence (cascades to steps and enrollments)
sequencesRouter.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    db.run('DELETE FROM sequences WHERE id = ?', [id])
    
    logger.info('Deleted sequence', { service: 'sequences', sequenceId: id })
    res.json({ message: 'Sequence deleted' })
  } catch (error) {
    logger.error('Failed to delete sequence', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to delete sequence' })
  }
})

// POST /:id/steps - Add step to sequence
sequencesRouter.post('/:id/steps', (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const { templateId, subject, delayDays, delayHours, sendTime } = req.body

    // Get next step order
    const maxOrder = db
      .query('SELECT MAX(step_order) as max_order FROM sequence_steps WHERE sequence_id = ?')
      .get(sequenceId) as { max_order: number | null } | null

    const stepOrder = (maxOrder?.max_order || 0) + 1

    const result = db.run(
      `INSERT INTO sequence_steps (sequence_id, step_order, template_id, subject, delay_days, delay_hours, send_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sequenceId, stepOrder, templateId || null, subject, delayDays || 0, delayHours || 0, sendTime || null]
    )

    const id = Number(result.lastInsertRowid)
    logger.info('Added step to sequence', { service: 'sequences', sequenceId, stepId: id })

    res.status(201).json({ id, stepOrder, message: 'Step added' })
  } catch (error) {
    logger.error('Failed to add step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to add step' })
  }
})

// PUT /:id/steps/:stepId - Update step
sequencesRouter.put('/:id/steps/:stepId', (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId, 10)
    const { templateId, subject, delayDays, delayHours, sendTime, stepOrder } = req.body

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (templateId !== undefined) { updates.push('template_id = ?'); params.push(templateId) }
    if (subject !== undefined) { updates.push('subject = ?'); params.push(subject) }
    if (delayDays !== undefined) { updates.push('delay_days = ?'); params.push(delayDays) }
    if (delayHours !== undefined) { updates.push('delay_hours = ?'); params.push(delayHours) }
    if (sendTime !== undefined) { updates.push('send_time = ?'); params.push(sendTime) }
    if (stepOrder !== undefined) { updates.push('step_order = ?'); params.push(stepOrder) }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    params.push(stepId)
    db.run(`UPDATE sequence_steps SET ${updates.join(', ')} WHERE id = ?`, params)

    logger.info('Updated step', { service: 'sequences', stepId })
    res.json({ message: 'Step updated' })
  } catch (error) {
    logger.error('Failed to update step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to update step' })
  }
})

// DELETE /:id/steps/:stepId - Delete step
sequencesRouter.delete('/:id/steps/:stepId', (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId, 10)
    db.run('DELETE FROM sequence_steps WHERE id = ?', [stepId])
    
    logger.info('Deleted step', { service: 'sequences', stepId })
    res.json({ message: 'Step deleted' })
  } catch (error) {
    logger.error('Failed to delete step', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to delete step' })
  }
})

// GET /:id/enrollments - List enrollments for sequence
sequencesRouter.get('/:id/enrollments', (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const status = req.query.status as string | undefined

    let enrollments: EnrollmentRow[]
    
    if (status) {
      enrollments = db
        .query('SELECT * FROM sequence_enrollments WHERE sequence_id = ? AND status = ? ORDER BY enrolled_at DESC')
        .all(sequenceId, status) as EnrollmentRow[]
    } else {
      enrollments = db
        .query('SELECT * FROM sequence_enrollments WHERE sequence_id = ? ORDER BY enrolled_at DESC')
        .all(sequenceId) as EnrollmentRow[]
    }

    res.json(enrollments.map(e => ({
      ...e,
      recipientData: e.recipient_data ? JSON.parse(e.recipient_data) : null
    })))
  } catch (error) {
    logger.error('Failed to list enrollments', { service: 'sequences' }, error as Error)
    res.status(500).json({ error: 'Failed to list enrollments' })
  }
})

// POST /:id/enroll - Enroll recipients
sequencesRouter.post('/:id/enroll', (req, res) => {
  try {
    const sequenceId = parseInt(req.params.id, 10)
    const { recipients } = req.body // Array of { email, data }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      res.status(400).json({ error: 'Recipients array required' })
      return
    }

    const enrolled: number[] = []
    for (const recipient of recipients) {
      try {
        const id = enrollRecipient(sequenceId, recipient.email, recipient.data || {})
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
sequencesRouter.put('/:id/enrollments/:enrollmentId', (req, res) => {
  try {
    const enrollmentId = parseInt(req.params.enrollmentId, 10)
    const { action } = req.body // 'pause' | 'cancel' | 'resume'

    switch (action) {
      case 'pause':
        pauseEnrollment(enrollmentId)
        break
      case 'cancel':
        cancelEnrollment(enrollmentId)
        break
      case 'resume':
        resumeEnrollment(enrollmentId)
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
