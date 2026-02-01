import { copyFileSync, readdirSync, unlinkSync, statSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { queryOne, execute } from '../db'
import { logger } from '../lib/logger'

const DATA_DIR = join(process.cwd(), 'data')
const BACKUP_DIR = join(DATA_DIR, 'backups')
const DB_PATH = join(DATA_DIR, 'mailer.db')

export interface BackupInfo {
  filename: string
  size: number
  date: Date
}

export interface BackupSettings {
  schedule: string // cron expression or 'manual'
  retention: number // number of backups to keep
}

/**
 * Create a backup of the database.
 * Copies mailer.db to data/backups/mailer_YYYY-MM-DD_HH-mm.db
 * 
 * Note: With Turso, backups are managed by the Turso service.
 * This function creates a local copy of the database file for emergency recovery.
 */
export function createBackup(): string {
  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  // Check if database exists
  if (!existsSync(DB_PATH)) {
    throw new Error('Database file not found')
  }

  // Generate timestamp-based filename
  const now = new Date()
  const timestamp = now.toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 16) // YYYY-MM-DD_HH-mm
  const filename = `mailer_${timestamp}.db`
  const backupPath = join(BACKUP_DIR, filename)

  try {
    // Note: Turso handles WAL checkpointing automatically
    // For local embedded replicas, the file can be copied directly
    
    copyFileSync(DB_PATH, backupPath)
    
    logger.info('Backup created', { 
      service: 'backup',
      filename,
      path: backupPath
    })
    
    return filename
  } catch (error) {
    logger.error('Failed to create backup', { service: 'backup' }, error as Error)
    throw error
  }
}

/**
 * List all available backups.
 * Returns array of backup info sorted by date (newest first).
 */
export function listBackups(): BackupInfo[] {
  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    return []
  }

  try {
    const files = readdirSync(BACKUP_DIR)
    const backups: BackupInfo[] = []

    for (const file of files) {
      // Only include .db files that match our naming pattern
      if (!file.startsWith('mailer_') || !file.endsWith('.db')) {
        continue
      }

      const filepath = join(BACKUP_DIR, file)
      const stats = statSync(filepath)

      backups.push({
        filename: file,
        size: stats.size,
        date: stats.mtime
      })
    }

    // Sort by date, newest first
    backups.sort((a, b) => b.date.getTime() - a.date.getTime())

    return backups
  } catch (error) {
    logger.error('Failed to list backups', { service: 'backup' }, error as Error)
    throw error
  }
}

/**
 * Delete old backups beyond retention count.
 * Keeps the most recent `keepCount` backups.
 */
export function pruneBackups(keepCount: number): number {
  if (keepCount < 0) {
    throw new Error('keepCount must be non-negative')
  }

  const backups = listBackups()
  const toDelete = backups.slice(keepCount)
  let deletedCount = 0

  for (const backup of toDelete) {
    try {
      const filepath = join(BACKUP_DIR, backup.filename)
      unlinkSync(filepath)
      deletedCount++
      
      logger.info('Backup deleted', { 
        service: 'backup',
        filename: backup.filename 
      })
    } catch (error) {
      logger.warn('Failed to delete backup', { 
        service: 'backup',
        filename: backup.filename 
      }, error as Error)
    }
  }

  if (deletedCount > 0) {
    logger.info('Backup pruning complete', { 
      service: 'backup',
      deleted: deletedCount,
      kept: keepCount
    })
  }

  return deletedCount
}

/**
 * Restore database from a backup file.
 * Copies the backup over the current database.
 * 
 * Note: With Turso, restoring requires restarting the application
 * after the file is replaced to reinitialize the connection.
 */
export function restoreBackup(filename: string): void {
  const backupPath = join(BACKUP_DIR, filename)

  // Validate filename to prevent directory traversal
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Invalid backup filename')
  }

  // Check if backup exists
  if (!existsSync(backupPath)) {
    throw new Error('Backup file not found')
  }

  // Verify it's a valid backup file
  if (!filename.startsWith('mailer_') || !filename.endsWith('.db')) {
    throw new Error('Invalid backup file format')
  }

  try {
    // Note: Turso handles WAL checkpointing automatically
    // Copy backup over current database
    copyFileSync(backupPath, DB_PATH)
    
    logger.info('Backup restored', { 
      service: 'backup',
      filename 
    })
  } catch (error) {
    logger.error('Failed to restore backup', { 
      service: 'backup',
      filename 
    }, error as Error)
    throw error
  }
}

/**
 * Get backup settings from the settings table.
 */
export async function getBackupSettings(): Promise<BackupSettings> {
  try {
    const scheduleRow = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['backup_schedule'])
    
    const retentionRow = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['backup_retention'])

    return {
      schedule: scheduleRow?.value || 'manual',
      retention: retentionRow ? parseInt(retentionRow.value, 10) : 7
    }
  } catch (error) {
    logger.error('Failed to get backup settings', { service: 'backup' }, error as Error)
    throw error
  }
}

/**
 * Save backup settings to the settings table.
 */
export async function saveBackupSettings(schedule: string, retention: number): Promise<void> {
  if (retention < 1) {
    throw new Error('Retention must be at least 1')
  }

  try {
    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['backup_schedule', schedule]
    )

    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['backup_retention', retention.toString()]
    )

    logger.info('Backup settings saved', { 
      service: 'backup',
      schedule,
      retention 
    })
  } catch (error) {
    logger.error('Failed to save backup settings', { service: 'backup' }, error as Error)
    throw error
  }
}
