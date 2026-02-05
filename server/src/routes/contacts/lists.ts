import { Router } from 'express'
import { queryAll, queryOne, execute, safeJsonParse } from '../../db'
import { createListSchema, updateListSchema } from '../../lib/validation'
import { logger } from '../../lib/logger'

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
        COUNT(lc.contact_id)::integer as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      WHERE l.user_id = ?
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `, [req.userId])
    
    res.json(lists)
  } catch (error) {
    logger.error('Failed to fetch lists', { service: 'contacts' }, error as Error)
    res.status(500).json({ error: 'Failed to fetch lists' })
  }
})

// POST /api/contacts/lists - Create new list
router.post('/', async (req, res) => {
  try {
    const data = createListSchema.parse(req.body)
    
    const result = await execute(
      'INSERT INTO lists (name, description, user_id) VALUES (?, ?, ?) RETURNING id',
      [data.name, data.description ?? null, req.userId]
    )
    
    const list = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ? AND user_id = ?', [result.lastInsertRowid, req.userId])
    logger.info('List created', { service: 'contacts', listId: String(result.lastInsertRowid) })
    res.status(201).json(list)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    logger.error('Failed to create list', { service: 'contacts' }, error as Error)
    res.status(500).json({ error: 'Failed to create list' })
  }
})

// GET /api/contacts/lists/:id - Get list details
router.get('/:id', async (req, res) => {
  try {
    const list = await queryOne<ListRow>(`
      SELECT 
        l.*,
        COUNT(lc.contact_id)::integer as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      WHERE l.id = ? AND l.user_id = ?
      GROUP BY l.id
    `, [req.params.id, req.userId])
    
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    res.json(list)
  } catch (error) {
    logger.error('Failed to fetch list', { service: 'contacts', listId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to fetch list' })
  }
})

// PUT /api/contacts/lists/:id - Update list
router.put('/:id', async (req, res) => {
  try {
    const data = updateListSchema.parse(req.body)
    
    const existing = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
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
    values.push(req.params.id, req.userId)
    
    await execute(`UPDATE lists SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, values)
    
    const list = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    logger.info('List updated', { service: 'contacts', listId: req.params.id })
    res.json(list)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors })
    }
    logger.error('Failed to update list', { service: 'contacts', listId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to update list' })
  }
})

// DELETE /api/contacts/lists/:id - Delete list
router.delete('/:id', async (req, res) => {
  try {
    const existing = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    await execute('DELETE FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    logger.info('List deleted', { service: 'contacts', listId: req.params.id })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete list', { service: 'contacts', listId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to delete list' })
  }
})

// POST /api/contacts/lists/:id/import - Import CSV
router.post('/:id/import', async (req, res) => {
  try {
    const { csv, mapping } = req.body
    
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV data is required' })
    }
    
    // Verify list exists and belongs to user
    const list = await queryOne<ListRow>('SELECT id FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    // Parse CSV
    const lines = csv.trim().split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header and at least one data row' })
    }
    
    const headers = lines[0].split(/[,\t]/).map(h => h.trim().toLowerCase())
    
    // Auto-detect or use provided mapping
    const fieldMapping: Record<string, string> = mapping || {}
    const standardFields = ['email', 'name', 'first_name', 'last_name', 'company', 'phone', 'country']
    
    // Auto-map standard fields if not provided
    for (const field of standardFields) {
      if (!fieldMapping[field]) {
        const headerIndex = headers.findIndex(h => 
          h === field || 
          h === field.replace('_', '') ||
          h === field.replace('_', ' ')
        )
        if (headerIndex !== -1) {
          fieldMapping[headers[headerIndex]] = field
        }
      }
    }
    
    // Must have email mapping
    const emailHeader = Object.entries(fieldMapping).find(([_, v]) => v === 'email')?.[0] ||
      headers.find(h => h === 'email' || h === 'e-mail' || h === 'email address')
    
    if (!emailHeader || !headers.includes(emailHeader)) {
      return res.status(400).json({ error: 'CSV must have an email column' })
    }
    
    let created = 0
    let updated = 0
    let added = 0
    const errors: string[] = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[,\t]/).map(v => v.trim())
      if (values.length < headers.length) continue
      
      const rowData: Record<string, string> = {}
      headers.forEach((h, idx) => {
        rowData[h] = values[idx] || ''
      })
      
      const email = rowData[emailHeader]
      if (!email || !email.includes('@')) {
        errors.push(`Row ${i + 1}: Invalid email`)
        continue
      }
      
      // Build contact data
      const contactData: Record<string, any> = { email }
      const customFields: Record<string, string> = {}
      
      for (const [header, value] of Object.entries(rowData)) {
        const mappedField = fieldMapping[header]
        if (mappedField && standardFields.includes(mappedField)) {
          contactData[mappedField] = value
        } else if (header !== emailHeader && value) {
          customFields[header] = value
        }
      }
      
      if (Object.keys(customFields).length > 0) {
        contactData.custom_fields = customFields
      }
      
      // Upsert contact (scoped to user)
      const existing = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE email = ? AND user_id = ?', [email, req.userId])
      
      let contactId: number
      
      if (existing) {
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
          WHERE id = ? AND user_id = ?
        `, [
          contactData.name || null,
          contactData.first_name || null,
          contactData.last_name || null,
          contactData.company || null,
          contactData.phone || null,
          contactData.country || null,
          contactData.custom_fields ? JSON.stringify(contactData.custom_fields) : null,
          existing.id,
          req.userId
        ])
        contactId = existing.id
        updated++
      } else {
        const result = await execute(`
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `, [
          email,
          contactData.name || null,
          contactData.first_name || null,
          contactData.last_name || null,
          contactData.company || null,
          contactData.phone || null,
          contactData.country || null,
          JSON.stringify(contactData.custom_fields || {}),
          req.userId
        ])
        contactId = Number(result.lastInsertRowid)
        created++
      }
      
      // Add to list
      try {
        await execute('INSERT INTO list_contacts (list_id, contact_id) VALUES (?, ?)', [req.params.id, contactId])
        added++
      } catch (e: any) {
        if ((e as any).code !== '23505') throw e
      }
    }
    
    logger.info('CSV import completed', { service: 'contacts', listId: req.params.id, created, updated, added })
    res.json({
      message: 'Import completed',
      created,
      updated,
      added,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('Failed to import CSV', { service: 'contacts', listId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to import CSV' })
  }
})

interface ContactRow {
  id: number
  email: string
  name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  phone: string | null
  country: string | null
  custom_fields: string | null
}

// GET /api/contacts/lists/:id/export - Export list as CSV
router.get('/:id/export', async (req, res) => {
  try {
    const list = await queryOne<ListRow>('SELECT * FROM lists WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    const contacts = await queryAll<ContactRow>(`
      SELECT c.*
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      WHERE lc.list_id = ? AND c.user_id = ?
      ORDER BY c.email
    `, [req.params.id, req.userId])
    
    // Collect all custom field keys
    const customFieldKeys = new Set<string>()
    for (const contact of contacts) {
      const cf = safeJsonParse(contact.custom_fields, {} as Record<string, string>)
      Object.keys(cf).forEach(k => customFieldKeys.add(k))
    }
    
    // Build CSV
    const standardHeaders = ['email', 'name', 'first_name', 'last_name', 'company', 'phone', 'country']
    const headers = [...standardHeaders, ...Array.from(customFieldKeys)]
    
    const rows = contacts.map(c => {
      const cf = safeJsonParse(c.custom_fields, {} as Record<string, string>)
      return headers.map(h => {
        if (standardHeaders.includes(h)) {
          return (c as any)[h] || ''
        }
        return cf[h] || ''
      }).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    
    const csvOutput = [headers.join(','), ...rows].join('\n')
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}.csv"`)
    res.send(csvOutput)
  } catch (error) {
    logger.error('Failed to export list', { service: 'contacts', listId: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to export list' })
  }
})

export default router
