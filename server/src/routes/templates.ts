import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'
import { createTemplateSchema, updateTemplateSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

export const templatesRouter = Router()

interface TemplateRow {
  id: number
  name: string
  description: string | null
  blocks: string
  is_default: number | null
  created_at: string
  updated_at: string
}

function formatTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    blocks: JSON.parse(row.blocks || '[]'),
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List templates
templatesRouter.get('/', async (_, res) => {
  logger.info('Listing templates', { service: 'templates' })
  const rows = await queryAll<TemplateRow>('SELECT * FROM templates ORDER BY updated_at DESC')
  res.json(rows.map(formatTemplate))
})

// Get template
templatesRouter.get('/:id', async (req, res) => {
  logger.info('Getting template', { service: 'templates', templateId: req.params.id })
  const row = await queryOne<TemplateRow>('SELECT * FROM templates WHERE id = ?', [req.params.id])
  if (!row) {
    logger.warn('Template not found', { service: 'templates', templateId: req.params.id })
    return res.status(404).json({ message: 'Template not found' })
  }
  res.json(formatTemplate(row))
})

// Create template
templatesRouter.post('/', async (req, res) => {
  const validation = validate(createTemplateSchema, req.body)
  if (!validation.success) {
    logger.warn('Template validation failed', { service: 'templates', error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks } = validation.data
  
  logger.info('Creating template', { service: 'templates', name })
  
  const result = await execute(
    'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
    [name, description || null, JSON.stringify(blocks)]
  )
  
  const row = await queryOne<TemplateRow>('SELECT * FROM templates WHERE id = ?', [result.lastInsertRowid])
  logger.info('Template created', { service: 'templates', templateId: row!.id, name })
  res.status(201).json(formatTemplate(row!))
})

// Update template
templatesRouter.put('/:id', async (req, res) => {
  const validation = validate(updateTemplateSchema, req.body)
  if (!validation.success) {
    logger.warn('Template update validation failed', { service: 'templates', templateId: req.params.id, error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks } = validation.data
  
  logger.info('Updating template', { service: 'templates', templateId: req.params.id })
  
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
  
  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(req.params.id)
    await execute(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`, values)
  }
  
  const row = await queryOne<TemplateRow>('SELECT * FROM templates WHERE id = ?', [req.params.id])
  if (!row) {
    logger.warn('Template not found for update', { service: 'templates', templateId: req.params.id })
    return res.status(404).json({ message: 'Template not found' })
  }
  logger.info('Template updated', { service: 'templates', templateId: row.id })
  res.json(formatTemplate(row))
})

// Delete template
templatesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params
  logger.info('Deleting template', { service: 'templates', templateId: id })

  // Check if template exists and if it's a default template
  const template = await queryOne<{ is_default: number }>(
    'SELECT is_default FROM templates WHERE id = ?',
    [id]
  )

  if (!template) {
    logger.warn('Template not found for deletion', { service: 'templates', templateId: id })
    res.status(404).json({ error: 'Template not found' })
    return
  }

  if (template.is_default) {
    logger.warn('Attempted to delete default template', { service: 'templates', templateId: id })
    res.status(403).json({ error: 'Cannot delete built-in templates' })
    return
  }

  await execute('DELETE FROM templates WHERE id = ?', [id])
  logger.info('Template deleted', { service: 'templates', templateId: id })
  res.status(204).send()
})
