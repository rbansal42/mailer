import { readdirSync, unlinkSync, statSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { queryOne, execute, DATA_DIR } from '../db'
import { logger } from '../lib/logger'
const BACKUP_DIR = join(DATA_DIR, 'backups')

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
 * Create a backup of the PostgreSQL database using pg_dump.
 * Saves to data/backups/mailer_YYYY-MM-DD_HH-mm.dump (custom format).
 */
export async function createBackup(): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  // Ensure backup directory exists
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  // Generate timestamp-based filename
  const now = new Date()
  const timestamp = now.toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 16) // YYYY-MM-DD_HH-mm
  const filename = `mailer_${timestamp}.dump`
  const backupPath = join(BACKUP_DIR, filename)

  try {
    const proc = Bun.spawn(['pg_dump', '--format=custom', `--file=${backupPath}`, databaseUrl], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderrPromise = new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0) {
      const stderr = await stderrPromise
      throw new Error(`pg_dump failed with exit code ${exitCode}: ${stderr}`)
    }

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
      // Only include .dump files that match our naming pattern
      if (!file.startsWith('mailer_') || !file.endsWith('.dump')) {
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
 * Restore database from a backup file using pg_restore.
 * Applies the backup to the current database, dropping and recreating objects.
 */
export async function restoreBackup(filename: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

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
  if (!filename.startsWith('mailer_') || !filename.endsWith('.dump')) {
    throw new Error('Invalid backup file format')
  }

  try {
    const proc = Bun.spawn(['pg_restore', '--clean', '--if-exists', '-d', databaseUrl, backupPath], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderrPromise = new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0 && exitCode !== 1) {
      // exit code 1 = warnings (normal with --clean --if-exists when tables don't exist yet)
      const stderr = await stderrPromise
      throw new Error(`pg_restore failed with exit code ${exitCode}: ${stderr}`)
    }

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
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
      ['backup_schedule', schedule]
    )

    await execute(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`,
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
