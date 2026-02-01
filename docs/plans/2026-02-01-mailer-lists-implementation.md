# Mailer Lists Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add reusable contact lists with table UI and campaign composer integration.

**Architecture:** SQLite tables for contacts/lists with junction table. Express API routes under `/api/contacts`. React pages for list management with shadcn/ui components.

**Tech Stack:** Bun, Express, SQLite (bun:sqlite), React, TailwindCSS, shadcn/ui, Zod validation

**Design Document:** `docs/plans/2026-02-01-mailer-lists-design.md`

---

## Phase 1: Database Schema & Validation (Sequential)

### Task 1.1: Create Database Tables

**Files:**
- Modify: `server/src/db/index.ts`

**Step 1: Add contacts table**

Add after existing table definitions (around line 250):

```typescript
// Contacts - global contact storage
db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    phone TEXT,
    country TEXT,
    custom_fields TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Lists - named collections
db.run(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// List memberships - junction table
db.run(`
  CREATE TABLE IF NOT EXISTS list_contacts (
    list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, contact_id)
  )
`)

// Index for faster contact lookups
db.run(`CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_list_contacts_list ON list_contacts(list_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_list_contacts_contact ON list_contacts(contact_id)`)
```

**Step 2: Run build to verify**

```bash
cd server && bun run build
```

Expected: No errors

**Step 3: Commit**

```bash
git add server/src/db/index.ts
git commit -m "feat(db): add contacts, lists, and list_contacts tables"
```

---

### Task 1.2: Add Validation Schemas

**Files:**
- Modify: `server/src/lib/validation.ts`

**Step 1: Add contact and list schemas**

Add after existing schemas:

```typescript
// Contact schemas
export const contactSchema = z.object({
  email: emailSchema,
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
})

export const createContactSchema = contactSchema

export const updateContactSchema = contactSchema.partial().omit({ email: true })

// List schemas
export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required'),
  description: z.string().optional(),
})

export const updateListSchema = createListSchema.partial()

// Add contacts to list schema
export const addContactsToListSchema = z.object({
  contacts: z.array(contactSchema).min(1, 'At least one contact required'),
})

// Import CSV schema
export const importCsvSchema = z.object({
  csv: z.string().min(1, 'CSV data is required'),
  mapping: z.record(z.string(), z.string()).optional(), // column name -> field name
})

export type Contact = z.infer<typeof contactSchema>
export type CreateList = z.infer<typeof createListSchema>
export type UpdateList = z.infer<typeof updateListSchema>
```

**Step 2: Run build to verify**

```bash
cd server && bun run build
```

Expected: No errors

**Step 3: Commit**

```bash
git add server/src/lib/validation.ts
git commit -m "feat(validation): add contact and list schemas"
```

---

## Phase 2: Backend API Routes (Parallel - 4 tasks)

These tasks can be executed in parallel by separate subagents.

### Task 2.1: Lists CRUD Endpoints

**Files:**
- Create: `server/src/routes/contacts/lists.ts`
- Modify: `server/src/index.ts` (register routes)

**Context:** This creates the `/api/contacts/lists` endpoints for CRUD operations on lists.

**Step 1: Create lists routes file**

```typescript
import { Router } from 'express'
import { db } from '../../db'
import { createListSchema, updateListSchema } from '../../lib/validation'

const router = Router()

// GET /api/contacts/lists - List all lists with contact counts
router.get('/', (req, res) => {
  try {
    const lists = db.query(`
      SELECT 
        l.*,
        COUNT(lc.contact_id) as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `).all()
    
    res.json(lists)
  } catch (error) {
    console.error('Error fetching lists:', error)
    res.status(500).json({ error: 'Failed to fetch lists' })
  }
})

// POST /api/contacts/lists - Create new list
router.post('/', (req, res) => {
  try {
    const data = createListSchema.parse(req.body)
    
    const result = db.run(
      'INSERT INTO lists (name, description) VALUES (?, ?)',
      [data.name, data.description || null]
    )
    
    const list = db.query('SELECT * FROM lists WHERE id = ?').get(result.lastInsertRowid)
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
router.get('/:id', (req, res) => {
  try {
    const list = db.query(`
      SELECT 
        l.*,
        COUNT(lc.contact_id) as contact_count
      FROM lists l
      LEFT JOIN list_contacts lc ON l.id = lc.list_id
      WHERE l.id = ?
      GROUP BY l.id
    `).get(req.params.id)
    
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
router.put('/:id', (req, res) => {
  try {
    const data = updateListSchema.parse(req.body)
    
    const existing = db.query('SELECT * FROM lists WHERE id = ?').get(req.params.id)
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
    
    db.run(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`, values)
    
    const list = db.query('SELECT * FROM lists WHERE id = ?').get(req.params.id)
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
router.delete('/:id', (req, res) => {
  try {
    const existing = db.query('SELECT * FROM lists WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    db.run('DELETE FROM lists WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting list:', error)
    res.status(500).json({ error: 'Failed to delete list' })
  }
})

export default router
```

**Step 2: Register routes in index.ts**

Add import and use statements:

```typescript
// Add import
import contactsListsRouter from './routes/contacts/lists'

// Add route registration (after other routes)
app.use('/api/contacts/lists', contactsListsRouter)
```

**Step 3: Run build to verify**

```bash
cd server && bun run build
```

**Step 4: Commit**

```bash
git add server/src/routes/contacts/lists.ts server/src/index.ts
git commit -m "feat(api): add lists CRUD endpoints"
```

---

### Task 2.2: List Members Endpoints

**Files:**
- Create: `server/src/routes/contacts/members.ts`
- Modify: `server/src/index.ts` (register routes)

**Context:** This creates endpoints for managing contacts within a specific list at `/api/contacts/lists/:listId/members`.

**Step 1: Create members routes file**

```typescript
import { Router } from 'express'
import { db } from '../../db'
import { addContactsToListSchema } from '../../lib/validation'

const router = Router({ mergeParams: true })

// GET /api/contacts/lists/:listId/members - Get contacts in list
router.get('/', (req, res) => {
  try {
    const { listId } = req.params
    const { page = '1', limit = '50', search = '' } = req.query
    
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum
    
    // Verify list exists
    const list = db.query('SELECT id FROM lists WHERE id = ?').get(listId)
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
    
    const contacts = db.query(`
      SELECT c.*, lc.added_at
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      ${whereClause}
      ORDER BY lc.added_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset)
    
    const totalResult = db.query(`
      SELECT COUNT(*) as count
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      ${whereClause}
    `).get(...params) as { count: number }
    
    res.json({
      contacts: contacts.map((c: any) => ({
        ...c,
        custom_fields: JSON.parse(c.custom_fields || '{}')
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limitNum)
      }
    })
  } catch (error) {
    console.error('Error fetching list members:', error)
    res.status(500).json({ error: 'Failed to fetch list members' })
  }
})

// POST /api/contacts/lists/:listId/members - Add contacts to list (upsert)
router.post('/', (req, res) => {
  try {
    const { listId } = req.params
    const data = addContactsToListSchema.parse(req.body)
    
    // Verify list exists
    const list = db.query('SELECT id FROM lists WHERE id = ?').get(listId)
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    let created = 0
    let updated = 0
    let added = 0
    
    for (const contact of data.contacts) {
      // Upsert contact
      const existing = db.query('SELECT id FROM contacts WHERE email = ?').get(contact.email) as { id: number } | null
      
      let contactId: number
      
      if (existing) {
        // Update existing contact
        db.run(`
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
          contact.name || null,
          contact.first_name || null,
          contact.last_name || null,
          contact.company || null,
          contact.phone || null,
          contact.country || null,
          contact.custom_fields ? JSON.stringify(contact.custom_fields) : null,
          existing.id
        ])
        contactId = existing.id
        updated++
      } else {
        // Create new contact
        const result = db.run(`
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contact.email,
          contact.name || null,
          contact.first_name || null,
          contact.last_name || null,
          contact.company || null,
          contact.phone || null,
          contact.country || null,
          JSON.stringify(contact.custom_fields || {})
        ])
        contactId = Number(result.lastInsertRowid)
        created++
      }
      
      // Add to list (ignore if already exists)
      try {
        db.run(
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
router.delete('/:contactId', (req, res) => {
  try {
    const { listId, contactId } = req.params
    
    const result = db.run(
      'DELETE FROM list_contacts WHERE list_id = ? AND contact_id = ?',
      [listId, contactId]
    )
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not in list' })
    }
    
    res.status(204).send()
  } catch (error) {
    console.error('Error removing contact from list:', error)
    res.status(500).json({ error: 'Failed to remove contact' })
  }
})

export default router
```

**Step 2: Register routes in index.ts**

```typescript
// Add import
import contactsMembersRouter from './routes/contacts/members'

// Add route registration
app.use('/api/contacts/lists/:listId/members', contactsMembersRouter)
```

**Step 3: Run build to verify**

```bash
cd server && bun run build
```

**Step 4: Commit**

```bash
git add server/src/routes/contacts/members.ts server/src/index.ts
git commit -m "feat(api): add list members endpoints"
```

---

### Task 2.3: Import/Export Endpoints

**Files:**
- Modify: `server/src/routes/contacts/lists.ts` (add import/export routes)

**Context:** Add CSV import and export functionality to lists.

**Step 1: Add import endpoint to lists.ts**

Add before `export default router`:

```typescript
// POST /api/contacts/lists/:id/import - Import CSV
router.post('/:id/import', (req, res) => {
  try {
    const { csv, mapping } = req.body
    
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'CSV data is required' })
    }
    
    // Verify list exists
    const list = db.query('SELECT id FROM lists WHERE id = ?').get(req.params.id)
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
    let errors: string[] = []
    
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
      
      // Upsert contact
      const existing = db.query('SELECT id FROM contacts WHERE email = ?').get(email) as { id: number } | null
      
      let contactId: number
      
      if (existing) {
        db.run(`
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
          contactData.name || null,
          contactData.first_name || null,
          contactData.last_name || null,
          contactData.company || null,
          contactData.phone || null,
          contactData.country || null,
          contactData.custom_fields ? JSON.stringify(contactData.custom_fields) : null,
          existing.id
        ])
        contactId = existing.id
        updated++
      } else {
        const result = db.run(`
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          email,
          contactData.name || null,
          contactData.first_name || null,
          contactData.last_name || null,
          contactData.company || null,
          contactData.phone || null,
          contactData.country || null,
          JSON.stringify(contactData.custom_fields || {})
        ])
        contactId = Number(result.lastInsertRowid)
        created++
      }
      
      // Add to list
      try {
        db.run('INSERT INTO list_contacts (list_id, contact_id) VALUES (?, ?)', [req.params.id, contactId])
        added++
      } catch (e: any) {
        if (!e.message?.includes('UNIQUE constraint')) throw e
      }
    }
    
    res.json({
      message: 'Import completed',
      created,
      updated,
      added,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error importing CSV:', error)
    res.status(500).json({ error: 'Failed to import CSV' })
  }
})

// GET /api/contacts/lists/:id/export - Export list as CSV
router.get('/:id/export', (req, res) => {
  try {
    const list = db.query('SELECT * FROM lists WHERE id = ?').get(req.params.id) as any
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }
    
    const contacts = db.query(`
      SELECT c.*
      FROM contacts c
      JOIN list_contacts lc ON c.id = lc.contact_id
      WHERE lc.list_id = ?
      ORDER BY c.email
    `).all(req.params.id) as any[]
    
    // Collect all custom field keys
    const customFieldKeys = new Set<string>()
    for (const contact of contacts) {
      const cf = JSON.parse(contact.custom_fields || '{}')
      Object.keys(cf).forEach(k => customFieldKeys.add(k))
    }
    
    // Build CSV
    const standardHeaders = ['email', 'name', 'first_name', 'last_name', 'company', 'phone', 'country']
    const headers = [...standardHeaders, ...Array.from(customFieldKeys)]
    
    const rows = contacts.map(c => {
      const cf = JSON.parse(c.custom_fields || '{}')
      return headers.map(h => {
        if (standardHeaders.includes(h)) {
          return c[h] || ''
        }
        return cf[h] || ''
      }).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    
    const csv = [headers.join(','), ...rows].join('\n')
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}.csv"`)
    res.send(csv)
  } catch (error) {
    console.error('Error exporting list:', error)
    res.status(500).json({ error: 'Failed to export list' })
  }
})
```

**Step 2: Run build to verify**

```bash
cd server && bun run build
```

**Step 3: Commit**

```bash
git add server/src/routes/contacts/lists.ts
git commit -m "feat(api): add CSV import/export for lists"
```

---

### Task 2.4: Global Contacts Endpoints

**Files:**
- Create: `server/src/routes/contacts/index.ts`
- Modify: `server/src/index.ts` (register routes)

**Context:** This creates endpoints for managing contacts globally at `/api/contacts`.

**Step 1: Create contacts index routes file**

```typescript
import { Router } from 'express'
import { db } from '../../db'
import { updateContactSchema } from '../../lib/validation'

const router = Router()

// GET /api/contacts - List all contacts (paginated)
router.get('/', (req, res) => {
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
    
    const contacts = db.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM list_contacts WHERE contact_id = c.id) as list_count
      FROM contacts c
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset)
    
    const totalResult = db.query(`
      SELECT COUNT(*) as count FROM contacts c ${whereClause}
    `).get(...params) as { count: number }
    
    res.json({
      contacts: contacts.map((c: any) => ({
        ...c,
        custom_fields: JSON.parse(c.custom_fields || '{}')
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalResult.count,
        totalPages: Math.ceil(totalResult.count / limitNum)
      }
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({ error: 'Failed to fetch contacts' })
  }
})

// GET /api/contacts/:id - Get contact with list memberships
router.get('/:id', (req, res) => {
  try {
    const contact = db.query('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any
    
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    
    const lists = db.query(`
      SELECT l.id, l.name, lc.added_at
      FROM lists l
      JOIN list_contacts lc ON l.id = lc.list_id
      WHERE lc.contact_id = ?
    `).all(req.params.id)
    
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
router.put('/:id', (req, res) => {
  try {
    const data = updateContactSchema.parse(req.body)
    
    const existing = db.query('SELECT * FROM contacts WHERE id = ?').get(req.params.id)
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
      db.run(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, values)
    }
    
    const contact = db.query('SELECT * FROM contacts WHERE id = ?').get(req.params.id) as any
    res.json({
      ...contact,
      custom_fields: JSON.parse(contact.custom_fields || '{}')
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
router.delete('/:id', (req, res) => {
  try {
    const existing = db.query('SELECT * FROM contacts WHERE id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    
    db.run('DELETE FROM contacts WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting contact:', error)
    res.status(500).json({ error: 'Failed to delete contact' })
  }
})

export default router
```

**Step 2: Register routes in index.ts**

```typescript
// Add import
import contactsRouter from './routes/contacts/index'

// Add route registration (BEFORE the lists routes to avoid path conflicts)
app.use('/api/contacts', contactsRouter)
```

**Step 3: Run build to verify**

```bash
cd server && bun run build
```

**Step 4: Commit**

```bash
git add server/src/routes/contacts/index.ts server/src/index.ts
git commit -m "feat(api): add global contacts endpoints"
```

---

## Phase 3: Frontend - List Management UI (Parallel - 3 tasks)

### Task 3.1: API Client & Lists Page

**Files:**
- Modify: `frontend/src/lib/api.ts` (add types and API calls)
- Create: `frontend/src/pages/Lists.tsx`
- Modify: `frontend/src/App.tsx` (add route)
- Modify: `frontend/src/components/Sidebar.tsx` (add nav link)

**Context:** Create the lists index page showing all lists with contact counts.

**Step 1: Add types and API functions to api.ts**

Add after existing types:

```typescript
// Contact types
export interface Contact {
  id: number
  email: string
  name?: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  country?: string
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
  list_count?: number
}

export interface ContactList {
  id: number
  name: string
  description?: string
  contact_count: number
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  contacts: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Lists API
export const listsApi = {
  getAll: async (): Promise<ContactList[]> => {
    const res = await fetch(`${API_BASE}/contacts/lists`)
    if (!res.ok) throw new Error('Failed to fetch lists')
    return res.json()
  },
  
  get: async (id: number): Promise<ContactList> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${id}`)
    if (!res.ok) throw new Error('Failed to fetch list')
    return res.json()
  },
  
  create: async (data: { name: string; description?: string }): Promise<ContactList> => {
    const res = await fetch(`${API_BASE}/contacts/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to create list')
    return res.json()
  },
  
  update: async (id: number, data: { name?: string; description?: string }): Promise<ContactList> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update list')
    return res.json()
  },
  
  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete list')
  },
  
  getMembers: async (listId: number, page = 1, limit = 50, search = ''): Promise<PaginatedResponse<Contact>> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    const res = await fetch(`${API_BASE}/contacts/lists/${listId}/members?${params}`)
    if (!res.ok) throw new Error('Failed to fetch members')
    return res.json()
  },
  
  addMembers: async (listId: number, contacts: Partial<Contact>[]): Promise<{ created: number; updated: number; added: number }> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${listId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts })
    })
    if (!res.ok) throw new Error('Failed to add members')
    return res.json()
  },
  
  removeMember: async (listId: number, contactId: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${listId}/members/${contactId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to remove member')
  },
  
  import: async (listId: number, csv: string, mapping?: Record<string, string>): Promise<{ created: number; updated: number; added: number; errors?: string[] }> => {
    const res = await fetch(`${API_BASE}/contacts/lists/${listId}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv, mapping })
    })
    if (!res.ok) throw new Error('Failed to import')
    return res.json()
  },
  
  exportUrl: (listId: number): string => `${API_BASE}/contacts/lists/${listId}/export`
}
```

**Step 2: Create Lists.tsx page**

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Download, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { listsApi, ContactList } from '@/lib/api'

export default function Lists() {
  const navigate = useNavigate()
  const [lists, setLists] = useState<ContactList[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newList, setNewList] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    try {
      const data = await listsApi.getAll()
      setLists(data)
    } catch (error) {
      console.error('Failed to load lists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newList.name.trim()) return
    setCreating(true)
    try {
      const created = await listsApi.create(newList)
      setLists([created, ...lists])
      setCreateOpen(false)
      setNewList({ name: '', description: '' })
      navigate(`/lists/${created.id}`)
    } catch (error) {
      console.error('Failed to create list:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this list? Contacts will not be deleted.')) return
    try {
      await listsApi.delete(id)
      setLists(lists.filter(l => l.id !== id))
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }

  const filteredLists = lists.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.description?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (date: string) => new Date(date).toLocaleDateString()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Contact Lists</h1>
          <p className="text-muted-foreground">Manage your mailing lists</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New List
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search lists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredLists.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? 'No lists match your search' : 'No lists yet. Create one to get started.'}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLists.map((list) => (
              <TableRow
                key={list.id}
                className="cursor-pointer"
                onClick={() => navigate(`/lists/${list.id}`)}
              >
                <TableCell className="font-medium">{list.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {list.description || '-'}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {list.contact_count}
                  </span>
                </TableCell>
                <TableCell>{formatDate(list.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(listsApi.exportUrl(list.id), '_blank')
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(list.id, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newList.name}
                onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                placeholder="e.g., Newsletter Subscribers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newList.description}
                onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                placeholder="What is this list for?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newList.name.trim() || creating}>
              {creating ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

**Step 3: Add route to App.tsx**

Add import and route:

```tsx
import Lists from './pages/Lists'

// In routes array, add:
<Route path="/lists" element={<Lists />} />
```

**Step 4: Add nav link to Sidebar.tsx**

Add to navigation items (with Users icon):

```tsx
{ icon: Users, label: 'Lists', path: '/lists' },
```

**Step 5: Run build to verify**

```bash
cd frontend && bun run build
```

**Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/Lists.tsx frontend/src/App.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(ui): add lists index page with create/delete"
```

---

### Task 3.2: List Detail Page

**Files:**
- Create: `frontend/src/pages/ListDetail.tsx`
- Modify: `frontend/src/App.tsx` (add route)

**Context:** Create the list detail page showing contacts in a table with edit/remove capabilities.

**Step 1: Create ListDetail.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Trash2, Upload, Download, Pencil, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { listsApi, ContactList, Contact } from '@/lib/api'

export default function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const listId = parseInt(id!)

  const [list, setList] = useState<ContactList | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Dialogs
  const [editingName, setEditingName] = useState(false)
  const [listName, setListName] = useState('')
  const [listDesc, setListDesc] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [editContact, setEditContact] = useState<Contact | null>(null)

  const loadList = useCallback(async () => {
    try {
      const data = await listsApi.get(listId)
      setList(data)
      setListName(data.name)
      setListDesc(data.description || '')
    } catch (error) {
      console.error('Failed to load list:', error)
    }
  }, [listId])

  const loadContacts = useCallback(async () => {
    try {
      const data = await listsApi.getMembers(listId, page, 50, search)
      setContacts(data.contacts)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('Failed to load contacts:', error)
    } finally {
      setLoading(false)
    }
  }, [listId, page, search])

  useEffect(() => {
    loadList()
    loadContacts()
  }, [loadList, loadContacts])

  const handleUpdateList = async () => {
    if (!listName.trim()) return
    try {
      await listsApi.update(listId, { name: listName, description: listDesc })
      setList({ ...list!, name: listName, description: listDesc })
      setEditingName(false)
    } catch (error) {
      console.error('Failed to update list:', error)
    }
  }

  const handleImport = async () => {
    if (!csvText.trim()) return
    setImporting(true)
    try {
      const result = await listsApi.import(listId, csvText)
      alert(`Imported: ${result.created} new, ${result.updated} updated, ${result.added} added to list`)
      setCsvText('')
      setImportOpen(false)
      loadContacts()
      loadList()
    } catch (error) {
      console.error('Failed to import:', error)
      alert('Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleRemove = async (contactId: number) => {
    if (!confirm('Remove this contact from the list?')) return
    try {
      await listsApi.removeMember(listId, contactId)
      setContacts(contacts.filter(c => c.id !== contactId))
      setList({ ...list!, contact_count: list!.contact_count - 1 })
    } catch (error) {
      console.error('Failed to remove:', error)
    }
  }

  const handleBulkRemove = async () => {
    if (selected.size === 0) return
    if (!confirm(`Remove ${selected.size} contacts from this list?`)) return
    try {
      await Promise.all(Array.from(selected).map(id => listsApi.removeMember(listId, id)))
      setContacts(contacts.filter(c => !selected.has(c.id)))
      setList({ ...list!, contact_count: list!.contact_count - selected.size })
      setSelected(new Set())
    } catch (error) {
      console.error('Failed to remove:', error)
    }
  }

  const toggleSelect = (id: number) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map(c => c.id)))
    }
  }

  if (loading || !list) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/lists')} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Lists
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          {editingName ? (
            <div className="space-y-2">
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="text-xl font-bold"
              />
              <Input
                value={listDesc}
                onChange={(e) => setListDesc(e.target.value)}
                placeholder="Description (optional)"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdateList}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="group">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{list.name}</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingName(true)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-muted-foreground">
                {list.description || 'No description'} &middot; {list.contact_count} contacts
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(listsApi.exportUrl(listId), '_blank')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleBulkRemove}>
            <Trash2 className="w-4 h-4 mr-2" />
            Remove {selected.size} selected
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? 'No contacts match your search' : 'No contacts in this list yet. Import some!'}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selected.size === contacts.length && contacts.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{contact.email}</TableCell>
                  <TableCell>{contact.name || contact.first_name || '-'}</TableCell>
                  <TableCell>{contact.company || '-'}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>{contact.country || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditContact(contact)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(contact.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="py-2 px-3 text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Contacts</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Paste CSV data below. First row should be headers. Must include an "email" column.
              Standard fields: email, name, first_name, last_name, company, phone, country.
              Other columns become custom fields.
            </p>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="email,name,company&#10;john@example.com,John Doe,ACME Inc&#10;jane@example.com,Jane Smith,Beta Corp"
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!csvText.trim() || importing}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editContact && (
            <ContactEditForm
              contact={editContact}
              onSave={async (updated) => {
                // For now, just update in the list - full edit endpoint integration in Task 2.4
                setContacts(contacts.map(c => c.id === updated.id ? updated : c))
                setEditContact(null)
              }}
              onCancel={() => setEditContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ContactEditForm({
  contact,
  onSave,
  onCancel
}: {
  contact: Contact
  onSave: (c: Contact) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...contact })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      // Call API to update
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          first_name: form.first_name,
          last_name: form.last_name,
          company: form.company,
          phone: form.phone,
          country: form.country
        })
      })
      if (!res.ok) throw new Error('Failed to update')
      const updated = await res.json()
      onSave(updated)
    } catch (error) {
      console.error('Failed to update contact:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Email (read-only)</Label>
        <Input value={form.email} disabled />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input
            value={form.first_name || ''}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input
            value={form.last_name || ''}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Full Name</Label>
        <Input
          value={form.name || ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Company</Label>
        <Input
          value={form.company || ''}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input
            value={form.phone || ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Input
            value={form.country || ''}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogFooter>
    </div>
  )
}
```

**Step 2: Add route to App.tsx**

```tsx
import ListDetail from './pages/ListDetail'

// In routes, add:
<Route path="/lists/:id" element={<ListDetail />} />
```

**Step 3: Run build to verify**

```bash
cd frontend && bun run build
```

**Step 4: Commit**

```bash
git add frontend/src/pages/ListDetail.tsx frontend/src/App.tsx
git commit -m "feat(ui): add list detail page with contacts table"
```

---

### Task 3.3: Campaign Composer List Picker

**Files:**
- Modify: `frontend/src/pages/Campaigns.tsx`

**Context:** Update campaign composer to use list picker instead of textarea, with fallback for one-off paste.

**Step 1: Add list picker to Campaigns.tsx**

Add imports and state:

```tsx
import { listsApi, ContactList } from '@/lib/api'

// Add state
const [lists, setLists] = useState<ContactList[]>([])
const [selectedListId, setSelectedListId] = useState<number | null>(null)
const [showManualEntry, setShowManualEntry] = useState(false)
const [saveListOpen, setSaveListOpen] = useState(false)
const [newListName, setNewListName] = useState('')
```

Add useEffect to load lists:

```tsx
useEffect(() => {
  listsApi.getAll().then(setLists).catch(console.error)
}, [])
```

Replace recipients textarea section with:

```tsx
<div className="space-y-2">
  <Label className="text-xs">Recipients</Label>
  
  {!showManualEntry ? (
    <div className="space-y-2">
      <select
        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={selectedListId || ''}
        onChange={(e) => {
          const id = e.target.value ? parseInt(e.target.value) : null
          setSelectedListId(id)
          if (id) {
            // Load list contacts as recipients
            listsApi.getMembers(id, 1, 10000).then(data => {
              const text = ['email,name,company,phone,country',
                ...data.contacts.map(c => 
                  [c.email, c.name || '', c.company || '', c.phone || '', c.country || ''].join(',')
                )
              ].join('\n')
              handleRecipientsChange(text)
            })
          }
        }}
      >
        <option value="">Select a list...</option>
        {lists.map(list => (
          <option key={list.id} value={list.id}>
            {list.name} ({list.contact_count} contacts)
          </option>
        ))}
      </select>
      
      {selectedListId && recipients.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {recipients.length} recipients from selected list
        </p>
      )}
      
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => setShowManualEntry(true)}
      >
        Or paste recipients manually
      </button>
    </div>
  ) : (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => {
            setShowManualEntry(false)
            setSelectedListId(null)
            handleRecipientsChange('')
          }}
        >
          Use a saved list instead
        </button>
      </div>
      <textarea
        className="w-full h-40 text-xs font-mono rounded-md border border-input bg-background px-3 py-2 resize-none"
        value={recipientsText}
        onChange={(e) => handleRecipientsChange(e.target.value)}
        placeholder="email,name,company&#10;john@example.com,John,ACME&#10;sara@example.com,Sara,Beta"
      />
      
      {recipients.length > 0 && !selectedListId && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setSaveListOpen(true)}
        >
          Save these {recipients.length} contacts as a new list?
        </button>
      )}
    </div>
  )}
  
  {/* Validation feedback - keep existing */}
</div>

{/* Save as List Dialog */}
<Dialog open={saveListOpen} onOpenChange={setSaveListOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Save as List</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <p className="text-sm text-muted-foreground">
        Save these {recipients.length} contacts as a reusable list.
      </p>
      <div className="space-y-2">
        <Label>List Name</Label>
        <Input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="e.g., Q1 Newsletter Recipients"
        />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setSaveListOpen(false)}>Cancel</Button>
      <Button
        disabled={!newListName.trim()}
        onClick={async () => {
          try {
            const list = await listsApi.create({ name: newListName })
            await listsApi.addMembers(list.id, recipients.map(r => ({
              email: r.email,
              name: r.name,
              company: r.company,
              ...r
            })))
            setLists([list, ...lists])
            setSelectedListId(list.id)
            setShowManualEntry(false)
            setSaveListOpen(false)
            setNewListName('')
          } catch (error) {
            console.error('Failed to save list:', error)
          }
        }}
      >
        Save List
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 2: Run build to verify**

```bash
cd frontend && bun run build
```

**Step 3: Commit**

```bash
git add frontend/src/pages/Campaigns.tsx
git commit -m "feat(ui): add list picker to campaign composer"
```

---

## Summary

**Phase 1 (Sequential):** Database schema and validation - must complete first
**Phase 2 (Parallel):** 4 backend API route tasks
**Phase 3 (Parallel):** 3 frontend UI tasks

Total: 9 tasks across 3 phases
