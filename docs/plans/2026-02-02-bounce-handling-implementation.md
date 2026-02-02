# Bounce Handling Implementation Plan

> **For Claude:** Use parallel agents to implement tasks.

**Goal:** Track bounces, maintain suppression list, prevent sending to invalid addresses.

**Tech Stack:** Express, TypeScript, Turso/libSQL, React

---

## Phase 1: Database & Backend Foundation

### Task 1A: Database Schema
**Files:** server/src/db/index.ts

Add tables:
```typescript
// Add to initDb()
await execute(`
  CREATE TABLE IF NOT EXISTS suppression_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

await execute(`
  CREATE TABLE IF NOT EXISTS bounces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    bounce_type TEXT NOT NULL,
    bounce_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

// Add index for fast email lookups
await execute(`CREATE INDEX IF NOT EXISTS idx_suppression_email ON suppression_list(email)`)
```

### Task 1B: Suppression Route - CRUD
**Files:** server/src/routes/suppression.ts (new), server/src/index.ts

Create suppression route:
```typescript
import { Router } from 'express'
import { queryAll, queryOne, execute } from '../db'
import { logger } from '../lib/logger'

export const suppressionRouter = Router()

interface SuppressionRow {
  id: number
  email: string
  reason: string
  source: string | null
  created_at: string
}

// GET / - List suppressed emails with pagination and search
suppressionRouter.get('/', async (req, res) => {
  const { page = '1', limit = '50', search = '' } = req.query
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
  
  let whereClause = ''
  const params: (string | number)[] = []
  
  if (search) {
    whereClause = 'WHERE email LIKE ?'
    params.push(`%${search}%`)
  }
  
  const countResult = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM suppression_list ${whereClause}`,
    params
  )
  
  params.push(parseInt(limit as string), offset)
  const rows = await queryAll<SuppressionRow>(
    `SELECT * FROM suppression_list ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params
  )
  
  res.json({
    items: rows,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total: countResult?.count || 0,
      totalPages: Math.ceil((countResult?.count || 0) / parseInt(limit as string))
    }
  })
})

// POST / - Add email to suppression list
suppressionRouter.post('/', async (req, res) => {
  const { email, reason = 'manual' } = req.body
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }
  
  try {
    await execute(
      'INSERT INTO suppression_list (email, reason, source) VALUES (?, ?, ?)',
      [email.toLowerCase().trim(), reason, 'manual']
    )
    res.status(201).json({ success: true })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Email already suppressed' })
    }
    throw error
  }
})

// DELETE /:id - Remove from suppression list
suppressionRouter.delete('/:id', async (req, res) => {
  await execute('DELETE FROM suppression_list WHERE id = ?', [req.params.id])
  res.status(204).send()
})

// POST /import - Bulk import
suppressionRouter.post('/import', async (req, res) => {
  const { emails, reason = 'manual' } = req.body
  if (!Array.isArray(emails)) {
    return res.status(400).json({ error: 'emails array required' })
  }
  
  let added = 0, skipped = 0
  for (const email of emails) {
    try {
      await execute(
        'INSERT INTO suppression_list (email, reason, source) VALUES (?, ?, ?)',
        [email.toLowerCase().trim(), reason, 'import']
      )
      added++
    } catch {
      skipped++
    }
  }
  
  res.json({ added, skipped })
})

// GET /export - Export as CSV
suppressionRouter.get('/export', async (req, res) => {
  const rows = await queryAll<SuppressionRow>('SELECT * FROM suppression_list ORDER BY created_at DESC')
  
  const csv = ['email,reason,source,created_at']
  rows.forEach(row => {
    csv.push(`${row.email},${row.reason},${row.source || ''},${row.created_at}`)
  })
  
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=suppression-list.csv')
  res.send(csv.join('\n'))
})

// GET /check/:email - Check if email is suppressed
suppressionRouter.get('/check/:email', async (req, res) => {
  const row = await queryOne<SuppressionRow>(
    'SELECT * FROM suppression_list WHERE email = ?',
    [req.params.email.toLowerCase()]
  )
  res.json({ suppressed: !!row, reason: row?.reason })
})
```

### Task 1C: Send Flow Integration
**Files:** server/src/routes/send.ts

Modify send flow to:
1. Filter out suppressed emails before sending
2. Record bounces on send failure
3. Auto-add hard bounces to suppression list

Add helper function and modify send loop.

### Task 1D: Analytics Integration
**Files:** server/src/services/tracking.ts, server/src/routes/analytics.ts

Add bounce stats to campaign analytics:
- Total bounces
- Hard vs soft bounce breakdown
- Bounce rate percentage

---

## Phase 2: Frontend

### Task 2A: API Client
**Files:** frontend/src/lib/api.ts

Add suppression API methods.

### Task 2B: Suppression List Page
**Files:** frontend/src/pages/SuppressionList.tsx (new)

Create page with:
- Table with email, reason, date, delete button
- Search input
- Pagination
- Add email form
- Import/Export buttons

### Task 2C: Navigation
**Files:** frontend/src/App.tsx or sidebar component

Add "Suppression List" to navigation.

### Task 2D: Campaign Send Integration
**Files:** frontend/src/pages/Campaigns.tsx

Show suppressed email count before sending:
"X of Y recipients are suppressed and will be skipped"

---

## Commit Strategy

After all tasks:
1. Run `bun run build`
2. Commit with descriptive message
3. Code review
4. Fix issues
5. Push and PR
