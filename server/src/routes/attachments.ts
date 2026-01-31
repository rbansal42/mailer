import { Router } from 'express'
import multer from 'multer'
import { existsSync, unlinkSync } from 'fs'
import { basename, extname } from 'path'
import { db } from '../db'
import { logger } from '../lib/logger'
import {
  extractZip,
  storeAttachments,
  matchAttachments,
  getMatchSummary,
  getRecipientAttachment,
  cleanupTempFiles,
  createTempDir,
  type Recipient,
  type MatchConfig,
} from '../services/attachment-matcher'

export const attachmentsRouter = Router()

// Configure multer with disk storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = createTempDir()
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => cb(null, basename(file.originalname)),
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 500 }, // 10MB per file, max 500 files
})

interface AttachmentRow {
  id: number
  campaign_id: number | null
  draft_id: number | null
  filename: string
  original_filename: string
  filepath: string
  size_bytes: number
  mime_type: string | null
  created_at: string
}

// POST /upload - Upload files (ZIP or multiple files)
attachmentsRouter.post('/upload', (req, res, next) => {
  upload.array('files', 500)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 500 files.' })
      }
      logger.error('Upload error', { requestId: (req as any).requestId, service: 'attachments' }, err)
      return res.status(400).json({ error: err.message || 'Upload failed' })
    }
    next()
  })
}, async (req, res) => {
  const requestId = (req as any).requestId
  const files = req.files as Express.Multer.File[]
  const draftId = req.body.draftId ? parseInt(req.body.draftId, 10) : undefined
  const campaignId = req.body.campaignId ? parseInt(req.body.campaignId, 10) : undefined

  if (!files || files.length === 0) {
    logger.warn('No files uploaded', { requestId })
    return res.status(400).json({ error: 'No files uploaded' })
  }

  try {
    let filesToStore: string[] = []
    const tempDirs: string[] = []

    // Track the upload directory from the first file
    if (files.length > 0) {
      const uploadDir = files[0].destination
      tempDirs.push(uploadDir)
    }

    for (const file of files) {
      const ext = extname(file.originalname).toLowerCase()

      if (ext === '.zip') {
        // Extract ZIP file
        const extractDir = createTempDir()
        tempDirs.push(extractDir)
        const extractedFiles = extractZip(file.path, extractDir)
        filesToStore.push(...extractedFiles)

        // Remove the ZIP file after extraction
        try {
          unlinkSync(file.path)
        } catch {
          // Ignore cleanup errors
        }

        logger.info('Extracted ZIP file', {
          requestId,
          zipFile: file.originalname,
          extractedCount: extractedFiles.length,
        })
      } else {
        // Regular file
        filesToStore.push(file.path)
      }
    }

    if (filesToStore.length === 0) {
      logger.warn('No valid files to store', { requestId })
      return res.status(400).json({ error: 'No valid files found' })
    }

    // Store attachments in the database
    const attachmentIds = storeAttachments(filesToStore, draftId, campaignId)

    // Clean up temp directories (files have been copied to attachments dir)
    for (const dir of tempDirs) {
      cleanupTempFiles(dir)
    }

    logger.info('Files uploaded successfully', {
      requestId,
      count: attachmentIds.length,
      draftId,
      campaignId,
    })

    res.json({
      success: true,
      count: attachmentIds.length,
      attachmentIds,
    })
  } catch (error) {
    logger.error('Upload failed', { requestId }, error as Error)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// POST /match - Match attachments to recipients
attachmentsRouter.post('/match', (req, res) => {
  const requestId = (req as any).requestId
  const {
    attachmentIds,
    recipients,
    config,
    draftId,
    campaignId,
  } = req.body as {
    attachmentIds: number[]
    recipients: Recipient[]
    config: MatchConfig
    draftId?: number
    campaignId?: number
  }

  if (!attachmentIds || !Array.isArray(attachmentIds) || attachmentIds.length === 0) {
    logger.warn('No attachment IDs provided', { requestId })
    return res.status(400).json({ error: 'attachmentIds is required' })
  }

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    logger.warn('No recipients provided', { requestId })
    return res.status(400).json({ error: 'recipients is required' })
  }

  if (!config || !config.mode) {
    logger.warn('Invalid match config', { requestId })
    return res.status(400).json({ error: 'config with mode is required' })
  }

  try {
    const results = matchAttachments(attachmentIds, recipients, config, draftId, campaignId)
    const summary = getMatchSummary(results)

    logger.info('Attachment matching complete', {
      requestId,
      total: summary.total,
      matched: summary.matched,
      unmatched: summary.unmatched,
    })

    res.json({
      success: true,
      results,
      summary,
    })
  } catch (error) {
    logger.error('Matching failed', { requestId }, error as Error)
    res.status(500).json({ error: 'Matching failed' })
  }
})

// GET /draft/:draftId - Get attachments for a draft
attachmentsRouter.get('/draft/:draftId', (req, res) => {
  const requestId = (req as any).requestId
  const draftId = parseInt(req.params.draftId, 10)

  if (isNaN(draftId)) {
    return res.status(400).json({ error: 'Invalid draft ID' })
  }

  try {
    const attachments = db
      .query('SELECT * FROM attachments WHERE draft_id = ? ORDER BY created_at DESC')
      .all(draftId) as AttachmentRow[]

    logger.debug('Retrieved attachments for draft', {
      requestId,
      draftId,
      count: attachments.length,
    })

    res.json(
      attachments.map((a) => ({
        id: a.id,
        filename: a.original_filename,
        sizeBytes: a.size_bytes,
        mimeType: a.mime_type,
        createdAt: a.created_at,
      }))
    )
  } catch (error) {
    logger.error('Failed to get attachments', { requestId, draftId }, error as Error)
    res.status(500).json({ error: 'Failed to get attachments' })
  }
})

// GET /recipient-preview - Get attachment info for a specific recipient
attachmentsRouter.get('/recipient-preview', (req, res) => {
  const requestId = (req as any).requestId
  const { email, draftId, campaignId } = req.query as {
    email?: string
    draftId?: string
    campaignId?: string
  }

  if (!email) {
    return res.status(400).json({ error: 'email is required' })
  }

  const parsedDraftId = draftId ? parseInt(draftId, 10) : undefined
  const parsedCampaignId = campaignId ? parseInt(campaignId, 10) : undefined

  try {
    const attachment = getRecipientAttachment(email, parsedDraftId, parsedCampaignId)

    if (!attachment) {
      logger.debug('No attachment found for recipient', { requestId, email })
      return res.json({ hasAttachment: false })
    }

    logger.debug('Retrieved recipient attachment preview', {
      requestId,
      email,
      filename: attachment.filename,
    })

    res.json({
      hasAttachment: true,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
    })
  } catch (error) {
    logger.error('Failed to get recipient attachment', { requestId, email }, error as Error)
    res.status(500).json({ error: 'Failed to get recipient attachment' })
  }
})

// DELETE /:id - Delete an attachment
attachmentsRouter.delete('/:id', (req, res) => {
  const requestId = (req as any).requestId
  const attachmentId = parseInt(req.params.id, 10)

  if (isNaN(attachmentId)) {
    return res.status(400).json({ error: 'Invalid attachment ID' })
  }

  try {
    // Get the attachment to find the file path
    const attachment = db
      .query('SELECT * FROM attachments WHERE id = ?')
      .get(attachmentId) as AttachmentRow | null

    if (!attachment) {
      logger.warn('Attachment not found', { requestId, attachmentId })
      return res.status(404).json({ error: 'Attachment not found' })
    }

    // Delete the file
    if (existsSync(attachment.filepath)) {
      try {
        unlinkSync(attachment.filepath)
        logger.debug('Deleted attachment file', { requestId, filepath: attachment.filepath })
      } catch (error) {
        logger.error('Failed to delete attachment file', { requestId, filepath: attachment.filepath }, error as Error)
        // Continue with DB deletion even if file deletion fails
      }
    }

    // Delete recipient_attachments records
    db.run('DELETE FROM recipient_attachments WHERE attachment_id = ?', [attachmentId])

    // Delete the attachment record
    db.run('DELETE FROM attachments WHERE id = ?', [attachmentId])

    logger.info('Attachment deleted', { requestId, attachmentId })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete attachment', { requestId, attachmentId }, error as Error)
    res.status(500).json({ error: 'Failed to delete attachment' })
  }
})
