import { mkdirSync } from 'fs'
import { join } from 'path'
import { logger } from '../lib/logger'

// Re-export client functions for external use
export { db, queryAll, queryOne, execute, checkDatabaseHealth, DATA_DIR } from './client'

// Import initialization functions
import { createTables, createIndexes, initializeSettings } from './schema'
import { runColumnMigrations, runSqlMigrations } from './migrations'
import { seedStarterTemplates, seedDefaultTemplates } from './seeds'

// Initialize database schema, migrations, and seeds
export async function initializeDatabase() {
  // Import DATA_DIR here to avoid circular dependency issues
  const { DATA_DIR } = await import('./client')

  // Create all tables
  await createTables()

  // Create data directories
  mkdirSync(join(DATA_DIR, 'attachments'), { recursive: true })
  mkdirSync(join(DATA_DIR, 'backups'), { recursive: true })

  // Run column migrations (add new columns to existing tables)
  await runColumnMigrations()

  // Create indexes
  await createIndexes()

  // Initialize default settings
  await initializeSettings()

  logger.info('Database initialized', { service: 'database', operation: 'init' })

  // Seed starter templates
  await seedStarterTemplates()

  // Seed default email templates
  await seedDefaultTemplates()

  // Run SQL migrations from files
  await runSqlMigrations()
}
