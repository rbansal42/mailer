import { Router } from 'express'
import { db } from '../db'

export const templatesRouter = Router()

interface TemplateRow {
  id: number
  name: string
  description: string | null
  blocks: string
  created_at: string
  updated_at: string
}

function formatTemplate(row: TemplateRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    blocks: JSON.parse(row.blocks || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List templates
templatesRouter.get('/', (_, res) => {
  const rows = db.query('SELECT * FROM templates ORDER BY updated_at DESC').all() as TemplateRow[]
  res.json(rows.map(formatTemplate))
})

// Get template
templatesRouter.get('/:id', (req, res) => {
  const row = db.query('SELECT * FROM templates WHERE id = ?').get(req.params.id) as TemplateRow | null
  if (!row) {
    return res.status(404).json({ message: 'Template not found' })
  }
  res.json(formatTemplate(row))
})

// Create template
templatesRouter.post('/', (req, res) => {
  const { name, description, blocks } = req.body
  
  const result = db.run(
    'INSERT INTO templates (name, description, blocks) VALUES (?, ?, ?)',
    [name, description || null, JSON.stringify(blocks || [])]
  )
  
  const row = db.query('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid) as TemplateRow
  res.status(201).json(formatTemplate(row))
})

// Update template
templatesRouter.put('/:id', (req, res) => {
  const { name, description, blocks } = req.body
  
  db.run(
    'UPDATE templates SET name = ?, description = ?, blocks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description || null, JSON.stringify(blocks || []), req.params.id]
  )
  
  const row = db.query('SELECT * FROM templates WHERE id = ?').get(req.params.id) as TemplateRow | null
  if (!row) {
    return res.status(404).json({ message: 'Template not found' })
  }
  res.json(formatTemplate(row))
})

// Delete template
templatesRouter.delete('/:id', (req, res) => {
  db.run('DELETE FROM templates WHERE id = ?', [req.params.id])
  res.status(204).send()
})
