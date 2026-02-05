import { Router } from 'express'
import { requireAdmin } from '../../middleware/firebaseAuth'
import usersRouter from './users'
import analyticsRouter from './analytics'
import settingsRouter from './settings'

const router = Router()

// All admin routes require admin access
router.use(requireAdmin)

router.use('/users', usersRouter)
router.use('/analytics', analyticsRouter)
router.use('/settings', settingsRouter)

export default router
