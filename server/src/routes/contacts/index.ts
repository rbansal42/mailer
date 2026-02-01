import { Router } from 'express'
import { queryAll, queryOne, execute } from '../../db'
import { updateContactSchema } from '../../lib/validation'

const router = Router()

// GET /api/contacts - List all contacts (paginated)
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '50', search = '' } = req.query
    
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum
    
    let whereClause = ''
    const params: any[] = []
    
    if (search) {
      whereClause = 'WHERE email LIKE ? OR name LIKE ? OR company LIKE ?'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }
    
    const contacts = await queryAll<any>(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM list_contacts WHERE contact_id = c.id) as list_count
      FROM contacts c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset])
    
    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM contacts c ${whereClause}
    `, params)
    
    const total = totalResult?.count ?? 0
    
    res.json({
      contacts: contacts.map((c: any) => ({
        ...c,
        custom_fields: JSON.parse(c.custom_fields || '{}')
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// GET /api/contacts/:id - Get contact with list memberships
router.get('/:id', async (req, res) => {
  try {
    const contact = await queryOne<any>('SELECT * FROM contacts WHERE id = ?', [req.params.id])
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    
    const lists = await queryAll<any>(`
      SELECT l.id, l.name, lc.added_at
      FROM lists l
      JOIN list_contacts lc ON l.id = lc.list_id
      WHERE lc.contact_id = ?
    `, [req.params.id])
    
    res.json({
      ...contact,
      custom_fields: JSON.parse(contact.custom_fields || '{}'),
      lists
    })
  } catch (error) {
    console.error('Error fetching contact:', error)
    res.status(500).json({ error: 'Failed to fetch contact' })
  }
})

// PUT /api/contacts/:id - Update contact
router.put('/:id', async (req, res) => {
  try {
    const data = updateContactSchema.parse(req.body)
    
    const existing = await queryOne<any>('SELECT * FROM contacts WHERE id = ?', [req.params.id])
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    
    const updates: string[] = []
    const values: any[] = []
    
    const fields = ['name', 'first_name', 'last_name', 'company', 'phone', 'country']
    for (const field of fields) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push((data as any)[field])
      }
    }
    
    if (data.custom_fields !== undefined) {
      updates.push('custom_fields = ?')
      values.push(JSON.stringify(data.custom_fields))
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP')
      values.push(req.params.id)
      await execute(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, values)
    }
    
    const contact = await queryOne<any>('SELECT * FROM contacts WHERE id = ?', [req.params.id])
    res.json({
      ...contact,
      custom_fields: JSON.parse(contact?.custom_fields || '{}')
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error updating contact:', error)
    res.status(500).json({ error: 'Failed to update contact' })
  }
})

// DELETE /api/contacts/:id - Delete contact entirely
router.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne<any>('SELECT * FROM contacts WHERE id = ?', [req.params.id])
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    
    await execute('DELETE FROM contacts WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting contact:', error)
    res.status(500).json({ error: 'Failed to delete contact' })
  }
})

export default router
