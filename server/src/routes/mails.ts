import { Router } from 'express'
import { db } from '../db'
import { createMailSchema, updateMailSchema, saveAsTemplateSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

const mailsRouter = Router()

interface MailRow {
  id: number
  name: string
  description: string | null
  blocks: string
  template_id: number | null
  campaign_id: number | null
  status: string
  created_at: string
  updated_at: string
}

function formatMail(row: MailRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    blocks: JSON.parse(row.blocks || '[]'),
    templateId: row.template_id,
    campaignId: row.campaign_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List all mails
mailsRouter.get('/', (_, res) => {
  logger.info('Listing mails', { service: 'mails' })
  const rows = db.query('SELECT * FROM mails ORDER BY updated_at DESC').all() as MailRow[]
  res.json(rows.map(formatMail))
})

// Get single mail
mailsRouter.get('/:id', (req, res) => {
  logger.info('Getting mail', { service: 'mails', mailId: req.params.id })
  const row = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow | null
  if (!row) {
    logger.warn('Mail not found', { service: 'mails', mailId: req.params.id })
    return res.status(404).json({ message: 'Mail not found' })
  }
  res.json(formatMail(row))
})

// Create new mail
mailsRouter.post('/', (req, res) => {
  const validation = validate(createMailSchema, req.body)
  if (!validation.success) {
    logger.warn('Mail validation failed', { service: 'mails', error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks, templateId, status } = validation.data

  logger.info('Creating mail', { service: 'mails', name })

  const result = db.run(
    'INSERT INTO mails (name, description, blocks, template_id, status) VALUES (?, ?, ?, ?, ?)',
    [name, description || null, JSON.stringify(blocks), templateId || null, status || 'draft']
  )

  const row = db.query('SELECT * FROM mails WHERE id = ?').get(result.lastInsertRowid) as MailRow
  logger.info('Mail created', { service: 'mails', mailId: row.id, name })
  res.status(201).json(formatMail(row))
})

// Update mail
mailsRouter.put('/:id', (req, res) => {
  const validation = validate(updateMailSchema, req.body)
  if (!validation.success) {
    logger.warn('Mail update validation failed', { service: 'mails', mailId: req.params.id, error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks, status } = validation.data

  logger.info('Updating mail', { service: 'mails', mailId: req.params.id })

  // Build dynamic update query based on provided fields
  const updates: string[] = []
  const values: (string | number | null)[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description)
  }
  if (blocks !== undefined) {
    updates.push('blocks = ?')
    values.push(JSON.stringify(blocks))
  }
  if (status !== undefined) {
    updates.push('status = ?')
    values.push(status)
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(req.params.id)
    db.run(`UPDATE mails SET ${updates.join(', ')} WHERE id = ?`, values)
  }

  const row = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow | null
  if (!row) {
    logger.warn('Mail not found for update', { service: 'mails', mailId: req.params.id })
    return res.status(404).json({ message: 'Mail not found' })
  }
  logger.info('Mail updated', { service: 'mails', mailId: row.id })
  res.json(formatMail(row))
})

// Delete mail
mailsRouter.delete('/:id', (req, res) => {
  logger.info('Deleting mail', { service: 'mails', mailId: req.params.id })
  
  // Check if mail exists first
  const existing = db.query('SELECT id FROM mails WHERE id = ?').get(req.params.id)
  if (!existing) {
    logger.warn('Mail not found for deletion', { service: 'mails', mailId: req.params.id })
    return res.status(404).json({ error: 'Mail not found' })
  }
  
  db.run('DELETE FROM mails WHERE id = ?', [req.params.id])
  logger.info('Mail deleted', { service: 'mails', mailId: req.params.id })
  res.status(204).send()
})

// Save mail as template
mailsRouter.post('/:id/save-as-template', (req, res) => {
  const validation = validate(saveAsTemplateSchema, req.body)
  if (!validation.success) {
    logger.warn('Save as template validation failed', { service: 'mails', mailId: req.params.id, error: validation.error })
    return res.status(400).json({ error: validation.error })
  }

  // Get the mail
  const mail = db.query('SELECT * FROM mails WHERE id = ?').get(req.params.id) as MailRow | null
  if (!mail) {
    logger.warn('Mail not found for save-as-template', { service: 'mails', mailId: req.params.id })
    return res.status(404).json({ message: 'Mail not found' })
  }

  // Use provided name/description or fall back to mail's values
  const templateName = validation.data.name || mail.name
  const templateDescription = validation.data.description !== undefined ? validation.data.description : mail.description

  logger.info('Saving mail as template', { service: 'mails', mailId: req.params.id, templateName })

  const result = db.run(
    'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
    [templateName, templateDescription, mail.blocks]
  )

  interface TemplateRow {
    id: number
    name: string
    description: string | null
    blocks: string
    created_at: string
    updated_at: string
  }

  const template = db.query('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid) as TemplateRow
  logger.info('Template created from mail', { service: 'mails', mailId: req.params.id, templateId: template.id })

  res.status(201).json({
    id: template.id,
    name: template.name,
    description: template.description,
    blocks: JSON.parse(template.blocks || '[]'),
    createdAt: template.created_at,
    updatedAt: template.updated_at,
  })
})

export default mailsRouter
