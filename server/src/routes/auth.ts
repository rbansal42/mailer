import { Router } from 'express'
import { queryOne, execute } from '../db'
import { generateToken, markSetupComplete } from '../middleware/auth'
import { logger } from '../lib/logger'

const SERVICE = 'auth-routes'

export const authRouter = Router()

// Check if setup is needed
authRouter.get('/check', async (req, res) => {
  const requestId = (req as any).requestId
  logger.debug('Checking setup status', { service: SERVICE, requestId })

  try {
    const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
    const needsSetup = !result

    logger.info('Setup status checked', { service: SERVICE, requestId, needsSetup })
    res.json({ needsSetup })
  } catch (error) {
    logger.error('Failed to check setup status', { service: SERVICE, requestId }, error as Error)
    res.status(500).json({ message: 'Failed to check setup status' })
  }
})

// Initial setup
authRouter.post('/setup', async (req, res) => {
  const requestId = (req as any).requestId
  logger.info('Setup attempt', { service: SERVICE, requestId })

  try {
    const { password } = req.body

    if (!password || password.length < 8) {
      logger.warn('Setup failed: password too short', { service: SERVICE, requestId })
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    }

    // Check if already set up
    const existing = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
    if (existing) {
      logger.warn('Setup failed: already configured', { service: SERVICE, requestId })
      return res.status(400).json({ message: 'Already set up' })
    }

    // Hash password using Bun's built-in
    logger.debug('Hashing password', { service: SERVICE, requestId })
    const hash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 })

    await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['password_hash', hash])

    // Update auth cache so subsequent requests work immediately
    markSetupComplete()

    const token = generateToken()
    logger.info('Setup completed successfully', { service: SERVICE, requestId })
    res.json({ token })
  } catch (error) {
    logger.error('Setup failed with error', { service: SERVICE, requestId }, error as Error)
    res.status(500).json({ message: 'Setup failed' })
  }
})

// Login
authRouter.post('/login', async (req, res) => {
  const requestId = (req as any).requestId
  logger.info('Login attempt', { service: SERVICE, requestId })

  try {
    const { password } = req.body

    if (!password) {
      logger.warn('Login failed: no password provided', { service: SERVICE, requestId })
      return res.status(400).json({ message: 'Password required' })
    }

    const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])

    if (!result) {
      logger.warn('Login failed: setup required', { service: SERVICE, requestId })
      return res.status(400).json({ message: 'Setup required' })
    }

    const valid = await Bun.password.verify(password, result.value)

    if (!valid) {
      logger.warn('Login failed: invalid password', { service: SERVICE, requestId })
      return res.status(401).json({ message: 'Invalid password' })
    }

    const token = generateToken()
    logger.info('Login successful', { service: SERVICE, requestId })
    res.json({ token })
  } catch (error) {
    logger.error('Login failed with error', { service: SERVICE, requestId }, error as Error)
    res.status(500).json({ message: 'Login failed' })
  }
})
