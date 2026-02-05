import { Router } from 'express'
import { queryAll, queryOne, execute, safeJsonParse } from '../db'
import { createTemplateSchema, updateTemplateSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'

export const templatesRouter = Router()

interface TemplateRow {
  id: number
  name: string
  description: string | null
  blocks: string
  is_default: boolean | null
  is_system: boolean | null
  user_id: string | null
  created_at: string
  updated_at: string
}

function formatTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    blocks: safeJsonParse(row.blocks, []),
    isDefault: row.is_default,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List templates - users see their own templates AND system templates
templatesRouter.get('/', async (req, res) => {
  logger.info('Listing templates', { service: 'templates', userId: req.userId })
  const rows = await queryAll<TemplateRow>(
    'SELECT * FROM templates WHERE user_id = ? OR is_system = true ORDER BY is_system DESC, created_at DESC',
    [req.userId]
  )
  res.json(rows.map(formatTemplate))
})

// Get template - users can access their own templates OR system templates
templatesRouter.get('/:id', async (req, res) => {
  logger.info('Getting template', { service: 'templates', templateId: req.params.id, userId: req.userId })
  const row = await queryOne<TemplateRow>(
    'SELECT * FROM templates WHERE id = ? AND (user_id = ? OR is_system = true)',
    [req.params.id, req.userId]
  )
  if (!row) {
    logger.warn('Template not found', { service: 'templates', templateId: req.params.id })
    return res.status(404).json({ message: 'Template not found' })
  }
  res.json(formatTemplate(row))
})

// Create template - always set user_id and is_system=false for user-created templates
templatesRouter.post('/', async (req, res) => {
  const validation = validate(createTemplateSchema, req.body)
  if (!validation.success) {
    logger.warn('Template validation failed', { service: 'templates', error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks } = validation.data
  
  logger.info('Creating template', { service: 'templates', name, userId: req.userId })
  
  const result = await execute(
    'INSERT INTO templates (name, description, blocks, user_id, is_system) VALUES (?, ?, ?, ?, false) RETURNING id',
    [name, description || null, JSON.stringify(blocks), req.userId]
  )
  
  const row = await queryOne<TemplateRow>('SELECT * FROM templates WHERE id = ?', [result.lastInsertRowid])
  logger.info('Template created', { service: 'templates', templateId: row!.id, name })
  res.status(201).json(formatTemplate(row!))
})

// Update template - only allow on user's own templates (not system templates)
templatesRouter.put('/:id', async (req, res) => {
  const validation = validate(updateTemplateSchema, req.body)
  if (!validation.success) {
    logger.warn('Template update validation failed', { service: 'templates', templateId: req.params.id, error: validation.error })
    return res.status(400).json({ error: validation.error })
  }
  const { name, description, blocks } = validation.data
  
  logger.info('Updating template', { service: 'templates', templateId: req.params.id, userId: req.userId })
  
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
    values.push(req.params.id, req.userId)
    // Only update if user owns the template (not system templates)
    await execute(`UPDATE templates SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values)
  }
  
  // Fetch the template to return (user's own or system for reading)
  const row = await queryOne<TemplateRow>(
    'SELECT * FROM templates WHERE id = ? AND (user_id = ? OR is_system = true)',
    [req.params.id, req.userId]
  )
  if (!row) {
    logger.warn('Template not found for update', { service: 'templates', templateId: req.params.id })
    return res.status(404).json({ message: 'Template not found' })
  }
  // If it's a system template, the update didn't happen - return 403
  if (row.is_system) {
    logger.warn('Attempted to update system template', { service: 'templates', templateId: req.params.id })
    return res.status(403).json({ error: 'Cannot modify system templates' })
  }
  logger.info('Template updated', { service: 'templates', templateId: row.id })
  res.json(formatTemplate(row))
})

// Delete template - only allow on user's own templates (not system templates)
templatesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params
  logger.info('Deleting template', { service: 'templates', templateId: id, userId: req.userId })

  // Check if template exists and belongs to user
  const template = await queryOne<{ is_default: boolean; is_system: boolean; user_id: string | null }>(
    'SELECT is_default, is_system, user_id FROM templates WHERE id = ? AND (user_id = ? OR is_system = true)',
    [id, req.userId]
  )

  if (!template) {
    logger.warn('Template not found for deletion', { service: 'templates', templateId: id })
    res.status(404).json({ error: 'Template not found' })
    return
  }

  if (template.is_default || template.is_system) {
    logger.warn('Attempted to delete system/default template', { service: 'templates', templateId: id })
    res.status(403).json({ error: 'Cannot delete system templates' })
    return
  }

  // Only delete if user owns the template
  await execute('DELETE FROM templates WHERE id = ? AND user_id = ?', [id, req.userId])
  logger.info('Template deleted', { service: 'templates', templateId: id })
  res.status(204).send()
})
