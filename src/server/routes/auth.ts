import { Router } from 'express'

export const authRouter = Router()

// Old auth routes - deprecated, return 410 Gone
// These routes are kept to provide a clear error to old clients

authRouter.get('/check', (_, res) => {
  res.status(410).json({ error: 'This authentication method is deprecated. Please use Firebase auth.' })
})

authRouter.post('/setup', (_, res) => {
  res.status(410).json({ error: 'This authentication method is deprecated. Please use Firebase auth.' })
})

authRouter.post('/login', (_, res) => {
  res.status(410).json({ error: 'This authentication method is deprecated. Please use Firebase auth.' })
})
