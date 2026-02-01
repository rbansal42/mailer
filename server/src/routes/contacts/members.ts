import { Router } from 'express'
import { queryAll, queryOne, execute } from '../../db'
import { addContactsToListSchema } from '../../lib/validation'

const router = Router({ mergeParams: true })

interface ContactRow {
  id: number
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  country: string | null
  custom_fields: string
  created_at: string
  updated_at: string
  added_at: string
}

interface ListRow {
  id: number
}

interface CountRow {
  count: number
}

// GET /api/contacts/lists/:listId/members - Get contacts in list
router.get('/', async (req, res) => {
  try {
    const { listId } = req.params
    const { page = '1', limit = '50', search = '' } = req.query
    
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50))
    const offset = (pageNum - 1) * limitNum
    
    // Verify list exists
    const list = await queryOne<ListRow>('SELECT id FROM lists WHERE id = ?', [listId])
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    let whereClause = 'WHERE lc.list_id = ?'
    const params: any[] = [listId]
    
    if (search) {
      whereClause += ' AND (c.email LIKE ? OR c.name LIKE ? OR c.company LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }
    
    const contacts = await queryAll<ContactRow>(`
      SELECT c.*, lc.added_at
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      ${whereClause}
      ORDER BY lc.added_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset])
    
    const totalResult = await queryOne<CountRow>(`
      SELECT COUNT(*) as count
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      ${whereClause}
    `, params)
    
    const total = totalResult?.count ?? 0
    
    res.json({
      contacts: contacts.map((c) => ({
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
    console.error('Error fetching list members:', error)
    res.status(500).json({ error: 'Failed to fetch list members' })
  }
})

// POST /api/contacts/lists/:listId/members - Add contacts to list (upsert)
router.post('/', async (req, res) => {
  try {
    const { listId } = req.params
    const data = addContactsToListSchema.parse(req.body)
    
    // Verify list exists
    const list = await queryOne<ListRow>('SELECT id FROM lists WHERE id = ?', [listId])
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    let created = 0
    let updated = 0
    let added = 0
    
    for (const contact of data.contacts) {
      // Upsert contact
      const existing = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE email = ?', [contact.email])
      
      let contactId: number
      
      if (existing) {
        // Update existing contact
        await execute(`
          UPDATE contacts SET
            name = COALESCE(?, name),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            company = COALESCE(?, company),
            phone = COALESCE(?, phone),
            country = COALESCE(?, country),
            custom_fields = COALESCE(?, custom_fields),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          contact.name ?? null,
          contact.first_name ?? null,
          contact.last_name ?? null,
          contact.company ?? null,
          contact.phone ?? null,
          contact.country ?? null,
          contact.custom_fields ? JSON.stringify(contact.custom_fields) : null,
          existing.id
        ])
        contactId = existing.id
        updated++
      } else {
        // Create new contact
        const result = await execute(`
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contact.email,
          contact.name ?? null,
          contact.first_name ?? null,
          contact.last_name ?? null,
          contact.company ?? null,
          contact.phone ?? null,
          contact.country ?? null,
          JSON.stringify(contact.custom_fields || {})
        ])
        contactId = Number(result.lastInsertRowid)
        created++
      }
      
      // Add to list (ignore if already exists)
      try {
        await execute(
          'INSERT INTO list_contacts (list_id, contact_id) VALUES (?, ?)',
          [listId, contactId]
        )
        added++
      } catch (e: any) {
        // Ignore duplicate key errors
        if (!e.message?.includes('UNIQUE constraint')) {
          throw e
        }
      }
    }
    
    res.status(201).json({
      message: 'Contacts added successfully',
      created,
      updated,
      added
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error adding contacts to list:', error)
    res.status(500).json({ error: 'Failed to add contacts' })
  }
})

// DELETE /api/contacts/lists/:listId/members/:contactId - Remove contact from list
router.delete('/:contactId', async (req, res) => {
  try {
    const { listId, contactId } = req.params
    
    const result = await execute(
      'DELETE FROM list_contacts WHERE list_id = ? AND contact_id = ?',
      [listId, contactId]
    )
    
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Contact not in list' })
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Error removing contact from list:', error)
    res.status(500).json({ error: 'Failed to remove contact' })
  }
})

export default router
