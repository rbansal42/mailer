import { Router, Request, Response } from 'express'
import { db } from '../db'
import { getNextAvailableAccount, incrementSendCount } from '../services/account-manager'
import { compileTemplate, replaceVariables } from '../services/template-compiler'
import { createProvider } from '../providers'
import { sendCampaignSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'
import { getRecipientAttachment } from '../services/attachment-matcher'
import { withRetry, DEFAULT_CONFIG } from '../services/retry'
import { isCircuitOpen, recordSuccess, recordFailure, getOpenCircuits } from '../services/circuit-breaker'

export const sendRouter = Router()

interface Recipient {
  email: string
  [key: string]: string
}

interface TemplateRow {
  id: number
  name: string
  blocks: string
}

function sendSSE(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function getNextDay(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

sendRouter.get('/', async (req: Request, res: Response) => {
  const { templateId, subject, recipients: recipientsJson, name, cc: ccJson, bcc: bccJson, scheduledFor: scheduledForParam } = req.query

  // Parse JSON fields from query params
  let parsedRecipients: unknown
  let parsedCc: unknown = []
  let parsedBcc: unknown = []

  try {
    parsedRecipients = JSON.parse(recipientsJson as string)
  } catch {
    res.status(400).json({ error: 'Invalid recipients JSON' })
    return
  }

  try {
    if (ccJson) parsedCc = JSON.parse(ccJson as string)
  } catch {
    res.status(400).json({ error: 'Invalid cc JSON' })
    return
  }

  try {
    if (bccJson) parsedBcc = JSON.parse(bccJson as string)
  } catch {
    res.status(400).json({ error: 'Invalid bcc JSON' })
    return
  }

  // Validate with schema
  const validation = validate(sendCampaignSchema, {
    name: name as string,
    templateId: Number(templateId),
    subject: subject as string,
    recipients: parsedRecipients,
    cc: parsedCc,
    bcc: parsedBcc,
    scheduledFor: scheduledForParam as string | undefined
  })

  if (!validation.success) {
    logger.warn('Send campaign validation failed', { error: validation.error })
    res.status(400).json({ error: validation.error })
    return
  }

  const { templateId: validatedTemplateId, subject: validatedSubject, recipients, cc, bcc, name: campaignName, scheduledFor } = validation.data

  // If scheduling for later, don't send immediately
  if (scheduledFor) {
    // Validate template exists
    const template = db.query('SELECT * FROM templates WHERE id = ?').get(validatedTemplateId) as TemplateRow | null
    if (!template) {
      logger.warn('Template not found for scheduled campaign', { templateId: validatedTemplateId })
      res.status(404).json({ error: 'Template not found' })
      return
    }

    // Create scheduled campaign
    const result = db.run(`
      INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)
    `, [campaignName || 'Scheduled Campaign', validatedTemplateId, validatedSubject, recipients.length, JSON.stringify(cc || []), JSON.stringify(bcc || []), scheduledFor])

    const campaignId = Number(result.lastInsertRowid)

    // Store recipients in email_queue for the scheduled time
    for (const recipient of recipients) {
      db.run(
        `INSERT INTO email_queue (campaign_id, recipient_email, recipient_data, scheduled_for, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [campaignId, recipient.email, JSON.stringify(recipient), scheduledFor.split('T')[0]]
      )
    }

    logger.info('Campaign scheduled', { 
      campaignId, 
      scheduledFor,
      recipients: recipients.length,
      service: 'send'
    })

    res.json({
      campaignId,
      status: 'scheduled',
      scheduledFor,
      recipientCount: recipients.length
    })
    return
  }

  logger.info('Starting campaign send', {
    service: 'send',
    templateId: validatedTemplateId,
    recipientCount: recipients.length,
    ccCount: cc?.length || 0,
    bccCount: bcc?.length || 0
  })

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    // Get template from database
    const template = db.query('SELECT * FROM templates WHERE id = ?').get(validatedTemplateId) as TemplateRow | null

    if (!template) {
      logger.warn('Template not found', { templateId: validatedTemplateId })
      sendSSE(res, { type: 'error', message: 'Template not found' })
      res.end()
      return
    }

    const blocks = JSON.parse(template.blocks || '[]')

    // Create campaign record with cc/bcc
    const result = db.run(
      `INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP)`,
      [campaignName || 'Unnamed', validatedTemplateId, validatedSubject, recipients.length, JSON.stringify(cc || []), JSON.stringify(bcc || [])]
    )
    const campaignId = Number(result.lastInsertRowid)

    logger.info('Campaign created', { campaignId, service: 'send' })

    let successful = 0
    let failed = 0
    let queued = 0

    // Process each recipient
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const current = i + 1

      try {
        // Get accounts with open circuits to exclude
        const openCircuits = getOpenCircuits()
        if (openCircuits.length > 0) {
          logger.debug('Skipping accounts with open circuits', { accountIds: openCircuits, service: 'send' })
        }

        // Get next available account, excluding those with open circuits
        const account = getNextAvailableAccount(campaignId, openCircuits)

        if (!account) {
          // No account available - queue for tomorrow
          db.run(
            `INSERT INTO email_queue (campaign_id, recipient_email, recipient_data, scheduled_for, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [campaignId, recipient.email, JSON.stringify(recipient), getNextDay()]
          )

          queued++

          db.run(
            `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message)
             VALUES (?, ?, 'queued', 'All accounts at cap')`,
            [campaignId, recipient.email]
          )

          sendSSE(res, {
            type: 'progress',
            current,
            total: recipients.length,
            message: `Queued ${recipient.email} for tomorrow`,
          })
          continue
        }

        // Compile template with recipient data (merge email with data for variable substitution)
        const recipientData: Record<string, string> = { email: recipient.email, ...recipient.data }
        const html = compileTemplate(blocks, recipientData)
        const compiledSubject = replaceVariables(validatedSubject, recipientData)

        // Get per-recipient attachment if one was matched
        const recipientAttachment = getRecipientAttachment(recipient.email, undefined, campaignId)
        const attachments = recipientAttachment ? [{
          filename: recipientAttachment.filename,
          path: recipientAttachment.path,
          contentType: recipientAttachment.mimeType
        }] : undefined

        // Create provider and send email with retry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = createProvider(account.providerType, account.config as any)

        const sendResult = await withRetry(
          async () => {
            await provider.send({
              to: recipient.email,
              cc: cc || [],
              bcc: bcc || [],
              subject: compiledSubject,
              html,
              attachments
            })
          },
          `send:${account.id}:${recipient.email}`,
          DEFAULT_CONFIG
        )

        await provider.disconnect()

        if (sendResult.success) {
          // Record success with circuit breaker
          recordSuccess(account.id)

          // Increment account send count
          incrementSendCount(account.id)

          successful++

          // Log success with retry count
          db.run(
            `INSERT INTO send_logs (campaign_id, account_id, recipient_email, status, retry_count)
             VALUES (?, ?, ?, 'success', ?)`,
            [campaignId, account.id, recipient.email, sendResult.attempts]
          )

          logger.debug('Email sent successfully', {
            service: 'send',
            campaignId,
            recipient: recipient.email,
            account: account.name,
            attempts: sendResult.attempts
          })

          sendSSE(res, {
            type: 'progress',
            current,
            total: recipients.length,
            message: `Sent to ${recipient.email} via ${account.name}`,
          })
        } else {
          // Record failure with circuit breaker
          recordFailure(account.id)

          failed++
          const errorMessage = sendResult.error?.message || 'Unknown error'

          // Log failure with retry count
          db.run(
            `INSERT INTO send_logs (campaign_id, account_id, recipient_email, status, error_message, retry_count)
             VALUES (?, ?, ?, 'failed', ?, ?)`,
            [campaignId, account.id, recipient.email, errorMessage, sendResult.attempts]
          )

          logger.error('Failed to send email after retries', {
            service: 'send',
            campaignId,
            recipient: recipient.email,
            account: account.name,
            attempts: sendResult.attempts
          }, sendResult.error)

          sendSSE(res, {
            type: 'progress',
            current,
            total: recipients.length,
            message: `Failed: ${recipient.email} - ${errorMessage} (${sendResult.attempts} attempts)`,
          })
        }
      } catch (error) {
        // This catch is for unexpected errors (not send failures handled by retry)
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        db.run(
          `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message, retry_count)
           VALUES (?, ?, 'failed', ?, 1)`,
          [campaignId, recipient.email, errorMessage]
        )

        logger.error('Unexpected error during send', {
          service: 'send',
          campaignId,
          recipient: recipient.email
        }, error instanceof Error ? error : undefined)

        sendSSE(res, {
          type: 'progress',
          current,
          total: recipients.length,
          message: `Failed: ${recipient.email} - ${errorMessage}`,
        })
      }

      // Small delay between sends
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // Update campaign stats
    db.run(
      `UPDATE campaigns SET successful = ?, failed = ?, queued = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [successful, failed, queued, campaignId]
    )

    logger.info('Campaign completed', {
      service: 'send',
      campaignId,
      successful,
      failed,
      queued
    })

    sendSSE(res, { type: 'complete', campaignId })
    res.end()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Campaign failed', { service: 'send' }, error instanceof Error ? error : undefined)
    sendSSE(res, { type: 'error', message: errorMessage })
    res.end()
  }
})
