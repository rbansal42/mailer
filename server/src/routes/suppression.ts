import { Router, Request, Response } from 'express'
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

function formatSuppression(row: SuppressionRow) {
  return {
    id: row.id,
    email: row.email,
    reason: row.reason,
    source: row.source,
    createdAt: row.created_at,
  }
}

// GET / - List suppressed emails with pagination and search
suppressionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search = '' } = req.query
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const offset = (pageNum - 1) * limitNum
    
    let whereClause = ''
    const countParams: string[] = []
    const queryParams: (string | number)[] = []
    
    if (search) {
      whereClause = 'WHERE email ILIKE ?'
      const searchPattern = `%${search}%`
      countParams.push(searchPattern)
      queryParams.push(searchPattern)
    }
    
    const countResult = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::integer as count FROM suppression_list ${whereClause}`,
      countParams
    )
    
    queryParams.push(limitNum, offset)
    const rows = await queryAll<SuppressionRow>(
      `SELECT * FROM suppression_list ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      queryParams
    )
    
    res.json({
      items: rows.map(formatSuppression),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / limitNum)
      }
    })
  } catch (error) {
    logger.error('Failed to list suppressed emails', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Failed to list suppressed emails' })
  }
})

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// POST / - Add email to suppression list
suppressionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { email, reason = 'manual' } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }
    
    const normalizedEmail = String(email).toLowerCase().trim()
    if (!isValidEmail(normalizedEmail)) {
      res.status(400).json({ error: 'Invalid email format' })
      return
    }
    
    await execute(
      'INSERT INTO suppression_list (email, reason, source) VALUES (?, ?, ?)',
      [normalizedEmail, reason, 'manual']
    )
    res.status(201).json({ success: true })
  } catch (error: any) {
    if ((error as any).code === '23505') {
      res.status(409).json({ error: 'Email already suppressed' })
      return
    }
    logger.error('Failed to add suppressed email', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Failed to add email' })
  }
})

// DELETE /:id - Remove from suppression list
suppressionRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid ID' })
      return
    }
    await execute('DELETE FROM suppression_list WHERE id = ?', [id])
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete suppressed email', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Failed to delete' })
  }
})

// POST /import - Bulk import
suppressionRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const { emails, reason = 'manual' } = req.body
    if (!Array.isArray(emails)) {
      res.status(400).json({ error: 'emails array required' })
      return
    }
    
    let added = 0, skipped = 0
    for (const email of emails) {
      try {
        await execute(
          'INSERT INTO suppression_list (email, reason, source) VALUES (?, ?, ?)',
          [String(email).toLowerCase().trim(), reason, 'import']
        )
        added++
      } catch {
        skipped++
      }
    }
    
    res.json({ added, skipped })
  } catch (error) {
    logger.error('Failed to import suppressed emails', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Import failed' })
  }
})

// Escape CSV value to prevent injection
function escapeCsvValue(value: string): string {
  if (!value) return ''
  // If value contains comma, quote, newline, or starts with formula char, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n') || /^[=+\-@]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// GET /export - Export as CSV
suppressionRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const rows = await queryAll<SuppressionRow>('SELECT * FROM suppression_list ORDER BY created_at DESC')
    
    const csv = ['email,reason,source,created_at']
    rows.forEach(row => {
      csv.push([
        escapeCsvValue(row.email),
        escapeCsvValue(row.reason),
        escapeCsvValue(row.source || ''),
        escapeCsvValue(row.created_at)
      ].join(','))
    })
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=suppression-list.csv')
    res.send(csv.join('\n'))
  } catch (error) {
    logger.error('Failed to export suppression list', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Export failed' })
  }
})

// GET /check/:email - Check if email is suppressed
suppressionRouter.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const row = await queryOne<SuppressionRow>(
      'SELECT * FROM suppression_list WHERE email = ?',
      [req.params.email.toLowerCase()]
    )
    res.json({ suppressed: !!row, reason: row?.reason || null })
  } catch (error) {
    logger.error('Failed to check suppression', { service: 'suppression' }, error as Error)
    res.status(500).json({ error: 'Check failed' })
  }
})
