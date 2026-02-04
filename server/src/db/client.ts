import { SQL } from 'bun'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { logger } from '../lib/logger'

const SERVICE = 'database'

// Data directory for local file storage (attachments, backups)
export const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

// Ensure data directory exists for local file storage
if (!existsSync(DATA_DIR)) {
  logger.info('Creating data directory', { service: SERVICE, path: DATA_DIR })
  mkdirSync(DATA_DIR, { recursive: true })
}

// Validate DATABASE_URL is set before creating the connection
if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is required', { service: SERVICE })
  throw new Error('DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string (e.g. postgres://user:password@localhost:5432/mailer)')
}

// Create PostgreSQL client using Bun's native SQL
// Uses DATABASE_URL env var by default
logger.info('Initializing PostgreSQL connection', { service: SERVICE })
export const sql = new SQL()

// Backward-compatible alias
export const db = sql

/**
 * Convert `?`-style placeholders to PostgreSQL `$1, $2, ...` style
 * Handles quoted strings (single and double quotes) so `?` inside string
 * literals is not converted.
 */
export function convertPlaceholders(query: string): string {
  let paramIndex = 0
  let result = ''
  let i = 0

  while (i < query.length) {
    const ch = query[i]

    // Skip single-quoted strings
    if (ch === "'") {
      let j = i + 1
      while (j < query.length) {
        if (query[j] === "'" && query[j + 1] === "'") {
          j += 2 // escaped single quote ''
        } else if (query[j] === "'") {
          j++
          break
        } else {
          j++
        }
      }
      result += query.slice(i, j)
      i = j
      continue
    }

    // Skip double-quoted identifiers
    if (ch === '"') {
      let j = i + 1
      while (j < query.length) {
        if (query[j] === '"' && query[j + 1] === '"') {
          j += 2 // escaped double quote ""
        } else if (query[j] === '"') {
          j++
          break
        } else {
          j++
        }
      }
      result += query.slice(i, j)
      i = j
      continue
    }

    // Replace ? placeholder
    if (ch === '?') {
      paramIndex++
      result += `$${paramIndex}`
      i++
      continue
    }

    result += ch
    i++
  }

  return result
}

// Helper functions for cleaner async queries
export async function queryAll<T>(query: string, args: any[] = []): Promise<T[]> {
  const startTime = Date.now()
  const pgQuery = convertPlaceholders(query)

  try {
    const rows = await sql.unsafe(pgQuery, args)
    const durationMs = Date.now() - startTime

    logger.debug('Query executed (queryAll)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      rowCount: rows.length,
      durationMs
    })

    return rows as T[]
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error('Query failed (queryAll)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      durationMs
    }, error as Error)
    throw error
  }
}

export async function queryOne<T>(query: string, args: any[] = []): Promise<T | undefined> {
  const startTime = Date.now()
  const pgQuery = convertPlaceholders(query)

  try {
    const rows = await sql.unsafe(pgQuery, args)
    const durationMs = Date.now() - startTime

    logger.debug('Query executed (queryOne)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      found: rows.length > 0,
      durationMs
    })

    return (rows[0] as T) ?? undefined
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error('Query failed (queryOne)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      durationMs
    }, error as Error)
    throw error
  }
}

export async function execute(query: string, args: any[] = []): Promise<{ rowsAffected: number; lastInsertRowid: bigint | undefined }> {
  const startTime = Date.now()
  const pgQuery = convertPlaceholders(query)

  try {
    const rows = await sql.unsafe(pgQuery, args)

    // If the query used RETURNING id, extract it from the first row
    let lastInsertRowid: bigint | undefined
    if (rows.length > 0 && rows[0] != null && 'id' in rows[0]) {
      lastInsertRowid = BigInt(rows[0].id)
    }

    const durationMs = Date.now() - startTime
    logger.debug('Query executed (execute)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      rowsAffected: rows.count ?? 0,
      durationMs
    })

    return {
      rowsAffected: rows.count ?? 0,
      lastInsertRowid,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error('Query failed (execute)', {
      service: SERVICE,
      query: pgQuery.substring(0, 100),
      durationMs
    }, error as Error)
    throw error
  }
}

/**
 * Safely parse a value that may be a JSON string (TEXT columns) or an
 * already-parsed object (JSONB columns — Bun's SQL driver auto-parses these).
 * Returns `fallback` when the value is null/undefined/empty-string.
 */
export function safeJsonParse<T = unknown>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'object') return value as T          // already parsed by driver
  if (typeof value === 'string') {
    if (value === '') return fallback
    try { return JSON.parse(value) as T } catch { return fallback }
  }
  return fallback
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await sql`SELECT 1`
    const latencyMs = Date.now() - start
    logger.debug('Database health check passed', { service: SERVICE, latencyMs })
    return { ok: true, latencyMs }
  } catch (error) {
    const latencyMs = Date.now() - start
    logger.error('Database health check failed', { service: SERVICE, latencyMs }, error as Error)
    return { ok: false, latencyMs }
  }
}
