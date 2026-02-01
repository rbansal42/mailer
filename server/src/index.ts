import 'dotenv/config';
import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync } from 'fs'
import { initializeDatabase, checkDatabaseHealth, db } from './db'
import { authRouter } from './routes/auth'
import { templatesRouter } from './routes/templates'
import { draftsRouter } from './routes/drafts'
import { campaignsRouter } from './routes/campaigns'
import { accountsRouter } from './routes/accounts'
import { sendRouter } from './routes/send'
import { queueRouter } from './routes/queue'
import { settingsRouter } from './routes/settings'
import { attachmentsRouter } from './routes/attachments'
import { backupsRouter } from './routes/backups'
import { trackingRouter } from './routes/tracking'
import { analyticsRouter } from './routes/analytics'
import { recurringRouter } from './routes/recurring'
import { sequencesRouter } from './routes/sequences'
import { certificatesRouter } from './routes/certificates'
import { uploadthingRouter } from './routes/uploadthing'
import mediaRoutes from './routes/media'
import { authMiddleware } from './middleware/auth'
import { startQueueProcessor } from './services/queue-processor'
import { startScheduler } from './services/scheduler'
import { requestIdMiddleware, requestLogMiddleware, logger } from './lib/logger'
import { getPdfWorkerPool } from './services/pdf'

const app = express()
const PORT = process.env.PORT || 3342

// Middleware
app.use(cors())
app.use(requestIdMiddleware)
app.use(requestLogMiddleware)
app.use(express.json({ limit: '10mb' })) // Increased for base64 images in certificates

// Initialize database
initializeDatabase()

// Health check (no auth)
app.get('/api/health', (_, res) => {
  const dbHealth = checkDatabaseHealth()
  
  // Check disk space (data directory)
  const dataDir = join(process.cwd(), 'data')
  let diskOk = true
  let diskInfo = {}
  try {
    if (existsSync(dataDir)) {
      diskInfo = { exists: true }
    }
  } catch {
    diskOk = false
  }
  
  // Check queue status
  let queuePending = 0
  try {
    const result = db.query("SELECT COUNT(*) as count FROM email_queue WHERE status = 'pending'").get() as any
    queuePending = result?.count || 0
  } catch {
    // Queue table might not exist yet
  }
  
  // Check accounts
  let accountsInfo = { total: 0, enabled: 0, atCap: 0 }
  try {
    const today = new Date().toISOString().split('T')[0]
    const accounts = db.query(`
      SELECT sa.id, sa.daily_cap, sa.enabled,
             COALESCE(sc.count, 0) as sent_today
      FROM sender_accounts sa
      LEFT JOIN send_counts sc ON sa.id = sc.account_id AND sc.date = ?
    `).all(today) as any[]
    
    accountsInfo.total = accounts.length
    accountsInfo.enabled = accounts.filter(a => a.enabled).length
    accountsInfo.atCap = accounts.filter(a => a.enabled && a.sent_today >= a.daily_cap).length
  } catch {
    // Tables might not exist yet
  }
  
  // Get PDF worker pool stats
  const pdfPool = getPdfWorkerPool()
  const pdfPoolStats = pdfPool.isReady() ? pdfPool.getStats() : null
  
  const allHealthy = dbHealth.ok && diskOk
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    checks: {
      database: { status: dbHealth.ok ? 'ok' : 'error', latencyMs: dbHealth.latencyMs },
      disk: { status: diskOk ? 'ok' : 'error', ...diskInfo },
      queue: { status: 'ok', pending: queuePending },
      accounts: { 
        status: 'ok',
        total: accountsInfo.total,
        enabled: accountsInfo.enabled,
        atCap: accountsInfo.atCap
      },
      pdfPool: pdfPoolStats ? {
        status: 'ok',
        workers: pdfPoolStats.workerCount,
        active: pdfPoolStats.activeWorkers,
        queued: pdfPoolStats.queueLength,
        processed: pdfPoolStats.totalProcessed,
        failed: pdfPoolStats.totalFailed,
      } : {
        status: 'not_initialized',
      }
    }
  })
})

// Public tracking routes (no auth required)
app.use('/t', trackingRouter)

// Auth routes (no auth required)
app.use('/api/auth', authRouter)

// Protected API routes
app.use('/api', authMiddleware, analyticsRouter)
app.use('/api/templates', authMiddleware, templatesRouter)
app.use('/api/drafts', authMiddleware, draftsRouter)
app.use('/api/campaigns', authMiddleware, campaignsRouter)
app.use('/api/accounts', authMiddleware, accountsRouter)
app.use('/api/send', authMiddleware, sendRouter)
app.use('/api/queue', authMiddleware, queueRouter)
app.use('/api/settings', authMiddleware, settingsRouter)
app.use('/api/attachments', authMiddleware, attachmentsRouter)
app.use('/api/backups', authMiddleware, backupsRouter)
app.use('/api/recurring', authMiddleware, recurringRouter)
app.use('/api/sequences', authMiddleware, sequencesRouter)
app.use('/api/certificates', authMiddleware, certificatesRouter)
app.use('/api/media', authMiddleware, mediaRoutes)

// Uploadthing routes (uses its own auth via UPLOADTHING_TOKEN)
app.use('/api/uploadthing', uploadthingRouter)

// Serve static frontend in production
const publicPath = join(process.cwd(), 'public')
if (existsSync(publicPath)) {
  app.use(express.static(publicPath))
  app.get('*', (_, res) => {
    res.sendFile(join(publicPath, 'index.html'))
  })
}

// Start queue processor
startQueueProcessor()

// Start scheduler for recurring campaigns
startScheduler()

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' })
})
