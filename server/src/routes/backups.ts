import { Router } from 'express'
import {
  createBackup,
  listBackups,
  restoreBackup,
  getBackupSettings,
  saveBackupSettings,
} from '../services/backup'
import { updateBackupSchedule } from '../services/scheduler'
import { logger } from '../lib/logger'

export const backupsRouter = Router()

// GET / - List backups and settings
backupsRouter.get('/', async (_, res) => {
  try {
    const backups = listBackups()
    const settings = await getBackupSettings()

    res.json({
      backups,
      settings,
    })
  } catch (error) {
    logger.error('Failed to list backups', { route: 'GET /api/backups' }, error as Error)
    res.status(500).json({ error: 'Failed to list backups' })
  }
})

// POST / - Create backup
backupsRouter.post('/', async (_, res) => {
  try {
    const filename = await createBackup()

    res.status(201).json({
      message: 'Backup created successfully',
      filename,
    })
  } catch (error) {
    logger.error('Failed to create backup', { route: 'POST /api/backups' }, error as Error)
    res.status(500).json({ error: 'Failed to create backup' })
  }
})

// POST /:filename/restore - Restore from backup
backupsRouter.post('/:filename/restore', async (req, res) => {
  try {
    const { filename } = req.params

    await restoreBackup(filename)

    res.json({
      message: 'Backup restored successfully',
      filename,
    })
  } catch (error) {
    const err = error as Error
    logger.error('Failed to restore backup', { route: 'POST /api/backups/:filename/restore', filename: req.params.filename }, err)

    if (err.message === 'Backup file not found') {
      res.status(404).json({ error: 'Backup file not found' })
    } else if (err.message === 'Invalid backup filename' || err.message === 'Invalid backup file format') {
      res.status(400).json({ error: err.message })
    } else {
      res.status(500).json({ error: 'Failed to restore backup' })
    }
  }
})

// PUT /settings - Update backup settings
backupsRouter.put('/settings', async (req, res) => {
  try {
    const { schedule, retention } = req.body

    if (!schedule || typeof schedule !== 'string') {
      res.status(400).json({ error: 'Schedule is required and must be a string' })
      return
    }

    if (!retention || typeof retention !== 'number' || retention < 1) {
      res.status(400).json({ error: 'Retention is required and must be a positive number' })
      return
    }

    await saveBackupSettings(schedule, retention)
    updateBackupSchedule(schedule)

    res.json({
      message: 'Backup settings updated successfully',
      settings: {
        schedule,
        retention,
      },
    })
  } catch (error) {
    logger.error('Failed to update backup settings', { route: 'PUT /api/backups/settings' }, error as Error)
    res.status(500).json({ error: 'Failed to update backup settings' })
  }
})
