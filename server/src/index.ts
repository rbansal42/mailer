import express from 'express'
import cors from 'cors'
import { join } from 'path'
import { existsSync } from 'fs'
import { initializeDatabase } from './db'
import { authRouter } from './routes/auth'
import { templatesRouter } from './routes/templates'
import { draftsRouter } from './routes/drafts'
import { campaignsRouter } from './routes/campaigns'
import { accountsRouter } from './routes/accounts'
import { sendRouter } from './routes/send'
import { queueRouter } from './routes/queue'
import { settingsRouter } from './routes/settings'
import { authMiddleware } from './middleware/auth'
import { startQueueProcessor } from './services/queue-processor'

const app = express()
const PORT = process.env.PORT || 3342

// Middleware
app.use(cors())
app.use(express.json())

// Initialize database
initializeDatabase()

// Health check (no auth)
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth routes (no auth required)
app.use('/api/auth', authRouter)

// Protected API routes
app.use('/api/templates', authMiddleware, templatesRouter)
app.use('/api/drafts', authMiddleware, draftsRouter)
app.use('/api/campaigns', authMiddleware, campaignsRouter)
app.use('/api/accounts', authMiddleware, accountsRouter)
app.use('/api/send', authMiddleware, sendRouter)
app.use('/api/queue', authMiddleware, queueRouter)
app.use('/api/settings', authMiddleware, settingsRouter)

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

app.listen(PORT, () => {
  console.log(`Mailer server running on http://localhost:${PORT}`)
})
