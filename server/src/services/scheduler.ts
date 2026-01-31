import * as cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { db } from '../db'
import { logger } from '../lib/logger'
import { createBackup, pruneBackups, getBackupSettings } from './backup'
import { processRecurringCampaigns } from './recurring-processor'
import { processSequenceSteps } from './sequence-processor'
import { processScheduledBatches } from './timezone-processor'

interface ScheduledCampaign {
  id: number
  name: string | null
  status: string
  scheduled_for: string
}

interface InterruptedCampaign {
  id: number
  name: string | null
  total_recipients: number
  successful: number
  failed: number
  queued: number
}

// Store active cron jobs for cleanup
let campaignCheckJob: ScheduledTask | null = null
let backupJob: ScheduledTask | null = null
let recurringJob: ScheduledTask | null = null
let sequenceJob: ScheduledTask | null = null
let batchJob: ScheduledTask | null = null

/**
 * Check for campaigns that are scheduled to send and update their status.
 * Finds campaigns with status='scheduled' and scheduled_for <= NOW(),
 * then updates them to 'sending' status.
 */
export function checkScheduledCampaigns(): number {
  try {
    const now = new Date().toISOString()
    
    // Find campaigns ready to send
    const scheduledCampaigns = db
      .query<ScheduledCampaign, [string]>(
        `SELECT id, name, status, scheduled_for
         FROM campaigns
         WHERE status = 'scheduled' AND scheduled_for <= ?`
      )
      .all(now)

    if (scheduledCampaigns.length === 0) {
      return 0
    }

    // Update each campaign to 'sending' status
    for (const campaign of scheduledCampaigns) {
      db.run(
        `UPDATE campaigns 
         SET status = 'sending', started_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [campaign.id]
      )

      logger.info('Campaign started from schedule', {
        service: 'scheduler',
        campaignId: campaign.id,
        campaignName: campaign.name,
        scheduledFor: campaign.scheduled_for
      })
    }

    logger.info('Scheduled campaigns check complete', {
      service: 'scheduler',
      campaignsStarted: scheduledCampaigns.length
    })

    return scheduledCampaigns.length
  } catch (error) {
    logger.error('Failed to check scheduled campaigns', { service: 'scheduler' }, error as Error)
    throw error
  }
}

/**
 * Run a scheduled backup of the database.
 * Creates a new backup and prunes old backups based on retention settings.
 */
export function runScheduledBackup(): void {
  try {
    logger.info('Starting scheduled backup', { service: 'scheduler' })

    // Create the backup
    const filename = createBackup()

    // Get retention settings and prune old backups
    const settings = getBackupSettings()
    const pruned = pruneBackups(settings.retention)

    logger.info('Scheduled backup complete', {
      service: 'scheduler',
      filename,
      prunedCount: pruned,
      retention: settings.retention
    })
  } catch (error) {
    logger.error('Scheduled backup failed', { service: 'scheduler' }, error as Error)
    // Don't throw - we don't want backup failures to crash the scheduler
  }
}

/**
 * Check and process due recurring campaigns
 */
export async function checkRecurringCampaigns(): Promise<number> {
  try {
    const processed = await processRecurringCampaigns()
    if (processed > 0) {
      logger.info('Processed recurring campaigns', {
        service: 'scheduler',
        count: processed
      })
    }
    return processed
  } catch (error) {
    logger.error('Failed to process recurring campaigns', { service: 'scheduler' }, error as Error)
    return 0
  }
}

/**
 * Check and process due sequence steps
 */
export async function checkSequenceSteps(): Promise<number> {
  try {
    const processed = await processSequenceSteps()
    if (processed > 0) {
      logger.info('Processed sequence steps', {
        service: 'scheduler',
        count: processed
      })
    }
    return processed
  } catch (error) {
    logger.error('Failed to process sequence steps', { service: 'scheduler' }, error as Error)
    return 0
  }
}

/**
 * Check and process due scheduled batches
 */
export async function checkScheduledBatches(): Promise<number> {
  try {
    const count = await processScheduledBatches()
    if (count > 0) {
      logger.info('Found scheduled batches ready', {
        service: 'scheduler',
        count
      })
    }
    return count
  } catch (error) {
    logger.error('Failed to process scheduled batches', { service: 'scheduler' }, error as Error)
    return 0
  }
}

/**
 * Start the scheduler with cron jobs for campaign checking and backups.
 */
export function startScheduler(): void {
  // Stop any existing jobs first
  stopScheduler()

  // Schedule campaign check every minute
  campaignCheckJob = cron.schedule('* * * * *', () => {
    try {
      checkScheduledCampaigns()
    } catch (error) {
      // Error already logged in checkScheduledCampaigns
    }
  })

  logger.info('Campaign scheduler started', {
    service: 'scheduler',
    schedule: 'every minute'
  })

  // Get backup settings and start backup job if not manual
  const backupSettings = getBackupSettings()
  
  if (backupSettings.schedule !== 'manual' && cron.validate(backupSettings.schedule)) {
    backupJob = cron.schedule(backupSettings.schedule, () => {
      runScheduledBackup()
    })

    logger.info('Backup scheduler started', {
      service: 'scheduler',
      schedule: backupSettings.schedule,
      retention: backupSettings.retention
    })
  } else if (backupSettings.schedule === 'manual') {
    logger.info('Backup scheduler not started - manual mode', {
      service: 'scheduler'
    })
  } else {
    logger.warn('Backup scheduler not started - invalid cron expression', {
      service: 'scheduler',
      schedule: backupSettings.schedule
    })
  }

  // Check recurring campaigns every minute
  recurringJob = cron.schedule('* * * * *', () => {
    checkRecurringCampaigns()
  })
  logger.info('Started recurring campaign check job', { service: 'scheduler' })

  // Check sequence steps every minute
  sequenceJob = cron.schedule('* * * * *', () => {
    checkSequenceSteps()
  })
  logger.info('Started sequence step check job', { service: 'scheduler' })

  // Check scheduled batches every minute
  batchJob = cron.schedule('* * * * *', () => {
    checkScheduledBatches()
  })
  logger.info('Started scheduled batch check job', { service: 'scheduler' })
}

/**
 * Find campaigns that were interrupted (status='sending') on startup.
 * These campaigns may need attention or resumption.
 */
export function resumeInterruptedCampaigns(): InterruptedCampaign[] {
  try {
    const interruptedCampaigns = db
      .query<InterruptedCampaign, []>(
        `SELECT id, name, total_recipients, successful, failed, queued
         FROM campaigns
         WHERE status = 'sending'`
      )
      .all()

    if (interruptedCampaigns.length > 0) {
      logger.warn('Found interrupted campaigns on startup', {
        service: 'scheduler',
        count: interruptedCampaigns.length,
        campaignIds: interruptedCampaigns.map(c => c.id)
      })

      // Log details for each interrupted campaign
      for (const campaign of interruptedCampaigns) {
        logger.info('Interrupted campaign details', {
          service: 'scheduler',
          campaignId: campaign.id,
          campaignName: campaign.name,
          totalRecipients: campaign.total_recipients,
          successful: campaign.successful,
          failed: campaign.failed,
          queued: campaign.queued
        })
      }
    }

    return interruptedCampaigns
  } catch (error) {
    logger.error('Failed to check for interrupted campaigns', { service: 'scheduler' }, error as Error)
    throw error
  }
}

/**
 * Stop all scheduler cron jobs.
 */
export function stopScheduler(): void {
  if (campaignCheckJob) {
    campaignCheckJob.stop()
    campaignCheckJob = null
    logger.info('Campaign scheduler stopped', { service: 'scheduler' })
  }

  if (backupJob) {
    backupJob.stop()
    backupJob = null
    logger.info('Backup scheduler stopped', { service: 'scheduler' })
  }

  if (recurringJob) {
    recurringJob.stop()
    recurringJob = null
    logger.info('Stopped recurring campaign check job', { service: 'scheduler' })
  }

  if (sequenceJob) {
    sequenceJob.stop()
    sequenceJob = null
    logger.info('Stopped sequence step check job', { service: 'scheduler' })
  }

  if (batchJob) {
    batchJob.stop()
    batchJob = null
    logger.info('Stopped scheduled batch check job', { service: 'scheduler' })
  }
}

/**
 * Update the backup schedule with a new cron expression.
 * Restarts the backup cron job with the new schedule.
 */
export function updateBackupSchedule(schedule: string): void {
  // Validate the schedule (unless it's 'manual')
  if (schedule !== 'manual' && !cron.validate(schedule)) {
    throw new Error(`Invalid cron expression: ${schedule}`)
  }

  // Stop existing backup job if running
  if (backupJob) {
    backupJob.stop()
    backupJob = null
  }

  // Start new backup job if not manual
  if (schedule !== 'manual') {
    backupJob = cron.schedule(schedule, () => {
      runScheduledBackup()
    })

    logger.info('Backup schedule updated', {
      service: 'scheduler',
      schedule
    })
  } else {
    logger.info('Backup schedule set to manual', {
      service: 'scheduler'
    })
  }
}
