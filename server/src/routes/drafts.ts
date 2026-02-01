import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'
import { createDraftSchema, updateDraftSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

export const draftsRouter = Router()

interface DraftRow {
  id: number
  name: string
  template_id: number | null
  mail_id: number | null
  subject: string | null
  test_email: string | null
  recipients: string
  recipients_text: string | null
  variables: string
  cc: string
  bcc: string
  created_at: string
  updated_at: string
}

function formatDraft(row: DraftRow) {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    mailId: row.mail_id,
    subject: row.subject,
    testEmail: row.test_email,
    recipients: JSON.parse(row.recipients || '[]'),
    recipientsText: row.recipients_text || '',
    variables: JSON.parse(row.variables || '{}'),
    cc: JSON.parse(row.cc || '[]'),
    bcc: JSON.parse(row.bcc || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List drafts
draftsRouter.get('/', async (req, res) => {
  try {
    const rows = await queryAll<DraftRow>('SELECT * FROM drafts ORDER BY updated_at DESC')
    logger.debug('Drafts listed', { requestId: (req as any).requestId, count: rows.length })
    res.json(rows.map(formatDraft))
  } catch (error) {
    logger.error('Failed to list drafts', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to list drafts' })
  }
})

// Get draft
draftsRouter.get('/:id', async (req, res) => {
  try {
    const row = await queryOne<DraftRow>('SELECT * FROM drafts WHERE id = ?', [req.params.id])
    if (!row) {
      logger.warn('Draft not found', { requestId: (req as any).requestId, draftId: req.params.id })
      return res.status(404).json({ error: 'Draft not found' })
    }
    logger.debug('Draft retrieved', { requestId: (req as any).requestId, draftId: row.id })
    res.json(formatDraft(row))
  } catch (error) {
    logger.error('Failed to get draft', { requestId: (req as any).requestId, draftId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to get draft' })
  }
})

// Create draft
draftsRouter.post('/', async (req, res) => {
  const validation = validate(createDraftSchema, req.body)
  if (!validation.success) {
    logger.warn('Draft validation failed', { requestId: (req as any).requestId, validationError: validation.error })
    return res.status(400).json({ error: validation.error })
  }

  const { name, templateId, mailId, subject, testEmail, recipients, recipientsText, variables, cc, bcc } = validation.data

  try {

    const result = await execute(
      'INSERT INTO drafts (name, template_id, mail_id, subject, test_email, recipients, recipients_text, variables, cc, bcc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        name,
        templateId ?? null,
        mailId ?? null,
        subject ?? null,
        testEmail ?? null,
        JSON.stringify(recipients || []),
        recipientsText ?? null,
        JSON.stringify(variables || {}),
        JSON.stringify(cc || []),
        JSON.stringify(bcc || [])
      ]
    )

    const draftId = Number(result.lastInsertRowid)
    const row = await queryOne<DraftRow>('SELECT * FROM drafts WHERE id = ?', [draftId])
    logger.info('Draft created', { requestId: (req as any).requestId, draftId })
    res.status(201).json(formatDraft(row!))
  } catch (error) {
    logger.error('Failed to create draft', { requestId: (req as any).requestId }, error as Error)
    res.status(500).json({ error: 'Failed to create draft' })
  }
})

// Update draft
draftsRouter.put('/:id', async (req, res) => {
  const validation = validate(updateDraftSchema, req.body)
  if (!validation.success) {
    logger.warn('Draft update validation failed', { requestId: (req as any).requestId, draftId: req.params.id, validationError: validation.error })
    return res.status(400).json({ error: validation.error })
  }

  const { name, templateId, mailId, subject, testEmail, recipients, recipientsText, variables, cc, bcc } = validation.data

  try {
    // Check if draft exists
    const existing = await queryOne<DraftRow>('SELECT * FROM drafts WHERE id = ?', [req.params.id])
    if (!existing) {
      logger.warn('Draft not found for update', { requestId: (req as any).requestId, draftId: req.params.id })
      return res.status(404).json({ error: 'Draft not found' })
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (templateId !== undefined) {
      updates.push('template_id = ?')
      values.push(templateId ?? null)
    }
    if (mailId !== undefined) {
      updates.push('mail_id = ?')
      values.push(mailId ?? null)
    }
    if (subject !== undefined) {
      updates.push('subject = ?')
      values.push(subject ?? null)
    }
    if (testEmail !== undefined) {
      updates.push('test_email = ?')
      values.push(testEmail ?? null)
    }
    if (recipients !== undefined) {
      updates.push('recipients = ?')
      values.push(JSON.stringify(recipients))
    }
    if (recipientsText !== undefined) {
      updates.push('recipients_text = ?')
      values.push(recipientsText ?? null)
    }
    if (variables !== undefined) {
      updates.push('variables = ?')
      values.push(JSON.stringify(variables))
    }
    if (cc !== undefined) {
      updates.push('cc = ?')
      values.push(JSON.stringify(cc))
    }
    if (bcc !== undefined) {
      updates.push('bcc = ?')
      values.push(JSON.stringify(bcc))
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP')
      values.push(req.params.id)
      await execute(`UPDATE drafts SET ${updates.join(', ')} WHERE id = ?`, values)
    }

    const row = await queryOne<DraftRow>('SELECT * FROM drafts WHERE id = ?', [req.params.id])
    logger.info('Draft updated', { requestId: (req as any).requestId, draftId: row!.id })
    res.json(formatDraft(row!))
  } catch (error) {
    logger.error('Failed to update draft', { requestId: (req as any).requestId, draftId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to update draft' })
  }
})

// Delete draft
draftsRouter.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne<{ id: number }>('SELECT id FROM drafts WHERE id = ?', [req.params.id])
    if (!existing) {
      logger.warn('Draft not found for deletion', { requestId: (req as any).requestId, draftId: req.params.id })
      return res.status(404).json({ error: 'Draft not found' })
    }

    await execute('DELETE FROM drafts WHERE id = ?', [req.params.id])
    logger.info('Draft deleted', { requestId: (req as any).requestId, draftId: req.params.id })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete draft', { requestId: (req as any).requestId, draftId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to delete draft' })
  }
})
