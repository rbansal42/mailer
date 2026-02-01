import { Router } from 'express'
import { queryAll, queryOne, execute } from '../../db'
import { createListSchema, updateListSchema } from '../../lib/validation'

const router = Router()

interface ListRow {
  id: number
  name: string
  description: string | null
  contact_count: number
  created_at: string
  updated_at: string
}

// GET /api/contacts/lists - List all lists with contact counts
router.get('/', async (req, res) => {
  try {
    const lists = await queryAll<ListRow>(`
      SELECT 
        l.*,
        COUNT(lc.contact_id) as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `)
    
    res.json(lists)
  } catch (error) {
    console.error('Error fetching lists:', error)
    res.status(500).json({ error: 'Failed to fetch lists' })
  }
})

// POST /api/contacts/lists - Create new list
router.post('/', async (req, res) => {
  try {
    const data = createListSchema.parse(req.body)
    
    const result = await execute(
      'INSERT INTO lists (name, description) VALUES (?, ?)',
      [data.name, data.description ?? null]
    )
    
    const list = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ?', [result.lastInsertRowid])
    res.status(201).json(list)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error creating list:', error)
    res.status(500).json({ error: 'Failed to create list' })
  }
})

// GET /api/contacts/lists/:id - Get list details
router.get('/:id', async (req, res) => {
  try {
    const list = await queryOne<ListRow>(`
      SELECT 
        l.*,
        COUNT(lc.contact_id) as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      WHERE l.id = ?
      GROUP BY l.id
    `, [req.params.id])
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    res.json(list)
  } catch (error) {
    console.error('Error fetching list:', error)
    res.status(500).json({ error: 'Failed to fetch list' })
  }
})

// PUT /api/contacts/lists/:id - Update list
router.put('/:id', async (req, res) => {
  try {
    const data = updateListSchema.parse(req.body)
    
    const existing = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ?', [req.params.id])
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    const updates: string[] = []
    const values: any[] = []
    
    if (data.name !== undefined) {
      updates.push('name = ?')
      values.push(data.name)
    }
    if (data.description !== undefined) {
      updates.push('description = ?')
      values.push(data.description)
    }
    updates.push('updated_at = CURRENT_TIMESTAMP')
    values.push(req.params.id)
    
    await execute(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, values)
    
    const list = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ?', [req.params.id])
    res.json(list)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error updating list:', error)
    res.status(500).json({ error: 'Failed to update list' })
  }
})

// DELETE /api/contacts/lists/:id - Delete list
router.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ?', [req.params.id])
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    await execute('DELETE FROM lists WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting list:', error)
    res.status(500).json({ error: 'Failed to delete list' })
  }
})

export default router
