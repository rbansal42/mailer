import { createClient, Client } from '@libsql/client'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Data directory for local file storage (attachments, backups)
export const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

// Validate required environment variables
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL environment variable is required')
}

if (!TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN environment variable is required')
}

// Ensure data directory exists for local file storage
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// Create Turso client
export const db: Client = createClient({
  url: TURSO_DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
})

// Helper functions for cleaner async queries
export async function queryAll<T>(sql: string, args: any[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args })
  return result.rows as T[]
}

export async function queryOne<T>(sql: string, args: any[] = []): Promise<T | undefined> {
  const result = await db.execute({ sql, args })
  return result.rows[0] as T | undefined
}

export async function execute(sql: string, args: any[] = []): Promise<{ rowsAffected: number; lastInsertRowid: bigint | undefined }> {
  const result = await db.execute({ sql, args })
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    await queryOne<{ 1: number }>('SELECT 1')
    return { ok: true, latencyMs: Date.now() - start }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}
