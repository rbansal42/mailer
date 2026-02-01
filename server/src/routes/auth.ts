import { Router } from 'express'
import { queryOne, execute } from '../db'
import { generateToken } from '../middleware/auth'

export const authRouter = Router()

// Check if setup is needed
authRouter.get('/check', async (_, res) => {
  const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
  res.json({ needsSetup: !result })
})

// Initial setup
authRouter.post('/setup', async (req, res) => {
  const { password } = req.body

  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  // Check if already set up
  const existing = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
  if (existing) {
    return res.status(400).json({ message: 'Already set up' })
  }

  // Hash password using Bun's built-in
  const hash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 12 })
  
  await execute('INSERT INTO settings (key, value) VALUES (?, ?)', ['password_hash', hash])

  const token = generateToken()
  res.json({ token })
})

// Login
authRouter.post('/login', async (req, res) => {
  const { password } = req.body

  if (!password) {
    return res.status(400).json({ message: 'Password required' })
  }

  const result = await queryOne<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['password_hash'])
  
  if (!result) {
    return res.status(400).json({ message: 'Setup required' })
  }

  const valid = await Bun.password.verify(password, result.value)
  
  if (!valid) {
    return res.status(401).json({ message: 'Invalid password' })
  }

  const token = generateToken()
  res.json({ token })
})
