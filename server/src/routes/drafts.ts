import { Router } from 'express'
import { db } from '../db'

export const draftsRouter = Router()

interface DraftRow {
  id: number
  name: string
  template_id: number | null
  subject: string | null
  recipients: string
  variables: string
  created_at: string
  updated_at: string
}

function formatDraft(row: DraftRow) {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    subject: row.subject,
    recipients: JSON.parse(row.recipients || '[]'),
    variables: JSON.parse(row.variables || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// List drafts
draftsRouter.get('/', (_, res) => {
  const rows = db.query('SELECT * FROM drafts ORDER BY updated_at DESC').all() as DraftRow[]
  res.json(rows.map(formatDraft))
})

// Get draft
draftsRouter.get('/:id', (req, res) => {
  const row = db.query('SELECT * FROM drafts WHERE id = ?').get(req.params.id) as DraftRow | null
  if (!row) {
    return res.status(404).json({ message: 'Draft not found' })
  }
  res.json(formatDraft(row))
})

// Create draft
draftsRouter.post('/', (req, res) => {
  const { name, templateId, subject, recipients, variables } = req.body
  
  const result = db.run(
    'INSERT INTO drafts (name, template_id, subject, recipients, variables) VALUES (?, ?, ?, ?, ?)',
    [name, templateId || null, subject || null, JSON.stringify(recipients || []), JSON.stringify(variables || {})]
  )
  
  const row = db.query('SELECT * FROM drafts WHERE id = ?').get(result.lastInsertRowid) as DraftRow
  res.status(201).json(formatDraft(row))
})

// Update draft
draftsRouter.put('/:id', (req, res) => {
  const { name, templateId, subject, recipients, variables } = req.body
  
  db.run(
    'UPDATE drafts SET name = ?, template_id = ?, subject = ?, recipients = ?, variables = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, templateId || null, subject || null, JSON.stringify(recipients || []), JSON.stringify(variables || {}), req.params.id]
  )
  
  const row = db.query('SELECT * FROM drafts WHERE id = ?').get(req.params.id) as DraftRow | null
  if (!row) {
    return res.status(404).json({ message: 'Draft not found' })
  }
  res.json(formatDraft(row))
})

// Delete draft
draftsRouter.delete('/:id', (req, res) => {
  db.run('DELETE FROM drafts WHERE id = ?', [req.params.id])
  res.status(204).send()
})
