// server/src/routes/integrations/index.ts
import { Router } from 'express'
import googleSheetsRouter from './google-sheets'

const router = Router()

// Google Sheets integration routes
router.use('/google-sheets', googleSheetsRouter)

export default router
