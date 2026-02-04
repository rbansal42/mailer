import { Router, Request, Response } from 'express'
import { queryOne, queryAll, execute, safeJsonParse } from '../db'
import { getNextAvailableAccount, incrementSendCount } from '../services/account-manager'
import { compileTemplate, replaceVariables, injectTracking } from '../services/template-compiler'
import { createProvider } from '../providers'
import { sendCampaignSchema, validate } from '../lib/validation'
import { logger } from '../lib/logger'
import { getRecipientAttachment } from '../services/attachment-matcher'
import { withRetry, DEFAULT_CONFIG } from '../services/retry'
import { isCircuitOpen, recordSuccess, recordFailure, getOpenCircuits } from '../services/circuit-breaker'
import { getTrackingSettings, getOrCreateToken } from '../services/tracking'

export const sendRouter = Router()

// Filter out suppressed emails from recipients list
async function filterSuppressedEmails(recipients: Array<{ email: string; [key: string]: string }>): Promise<{
  allowed: Array<{ email: string; [key: string]: string }>,
  suppressed: string[]
}> {
  const suppressedList = await queryAll<{ email: string }>('SELECT email FROM suppression_list')
  const suppressedSet = new Set(suppressedList.map(r => r.email.toLowerCase()))
  
  const allowed: Array<{ email: string; [key: string]: string }> = []
  const suppressed: string[] = []
  
  for (const recipient of recipients) {
    if (suppressedSet.has(recipient.email.toLowerCase())) {
      suppressed.push(recipient.email)
    } else {
      allowed.push(recipient)
    }
  }
  
  return { allowed, suppressed }
}

// Record a bounce
async function recordBounce(
  campaignId: number | null,
  email: string,
  bounceType: 'hard' | 'soft',
  bounceReason: string
): Promise<void> {
  await execute(
    'INSERT INTO bounces (campaign_id, email, bounce_type, bounce_reason) VALUES (?, ?, ?, ?)',
    [campaignId, email.toLowerCase(), bounceType, bounceReason]
  )
  
  // Auto-suppress hard bounces
  if (bounceType === 'hard') {
    try {
      await execute(
        'INSERT INTO suppression_list (email, reason, source) VALUES (?, ?, ?)',
        [email.toLowerCase(), 'hard_bounce', campaignId ? `campaign_${campaignId}` : 'send']
      )
    } catch (e: any) {
      // Ignore duplicate key (already suppressed), re-throw other errors
      if (e?.code !== '23505') throw e
    }
  }
}

// Detect bounce type from error message
function detectBounceType(errorMessage: string): { isBounce: boolean, type: 'hard' | 'soft' } {
  const msg = errorMessage.toLowerCase()
  
  // Hard bounce indicators (5xx errors, permanent failures)
  const hardBouncePatterns = [
    '550', '551', '552', '553', '554',
    'user unknown', 'mailbox not found', 'invalid recipient',
    'address rejected', 'no such user', 'does not exist',
    'permanent failure', 'mailbox unavailable'
  ]
  
  // Soft bounce indicators (4xx errors, temporary failures)
  const softBouncePatterns = [
    '450', '451', '452',
    'try again', 'temporarily', 'quota exceeded',
    'mailbox full', 'rate limit', 'too many'
  ]
  
  for (const pattern of hardBouncePatterns) {
    if (msg.includes(pattern)) {
      return { isBounce: true, type: 'hard' }
    }
  }
  
  for (const pattern of softBouncePatterns) {
    if (msg.includes(pattern)) {
      return { isBounce: true, type: 'soft' }
    }
  }
  
  return { isBounce: false, type: 'soft' }
}

interface Recipient {
  email: string
  [key: string]: string
}

interface TemplateRow {
  id: number
  name: string
  blocks: string
}

interface MailRow {
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
  const { templateId, mailId, subject, recipients: recipientsJson, name, cc: ccJson, bcc: bccJson, scheduledFor: scheduledForParam } = req.query

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
    templateId: templateId ? Number(templateId) : undefined,
    mailId: mailId ? Number(mailId) : undefined,
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

  const { templateId: validatedTemplateId, mailId: validatedMailId, subject: validatedSubject, recipients, cc, bcc, name: campaignName, scheduledFor } = validation.data

  // Helper to get blocks from either template or mail
  interface BlockInput {
    id: string
    type: string
    props: Record<string, unknown>
  }
  async function getBlocks(): Promise<{ blocks: BlockInput[], sourceId: number, sourceType: 'template' | 'mail' } | null> {
    if (validatedMailId) {
      const mail = await queryOne<MailRow>('SELECT * FROM mails WHERE id = ?', [validatedMailId])
      if (!mail) return null
      return { blocks: safeJsonParse(mail.blocks, []) as BlockInput[], sourceId: validatedMailId, sourceType: 'mail' }
    } else if (validatedTemplateId) {
      const template = await queryOne<TemplateRow>('SELECT * FROM templates WHERE id = ?', [validatedTemplateId])
      if (!template) return null
      return { blocks: safeJsonParse(template.blocks, []) as BlockInput[], sourceId: validatedTemplateId, sourceType: 'template' }
    }
    return null
  }

  // If scheduling for later, don't send immediately
  if (scheduledFor) {
    // Validate content source exists
    const content = await getBlocks()
    if (!content) {
      logger.warn('Content source not found for scheduled campaign', { templateId: validatedTemplateId, mailId: validatedMailId })
      res.status(404).json({ error: 'Template or mail not found' })
      return
    }

    // Create scheduled campaign (store template_id for backwards compatibility, or mail reference)
    const result = await execute(`
      INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?) RETURNING id
    `, [campaignName || 'Scheduled Campaign', validatedTemplateId ?? validatedMailId ?? null, validatedSubject, recipients.length, JSON.stringify(cc || []), JSON.stringify(bcc || []), scheduledFor])

    const campaignId = Number(result.lastInsertRowid)

    // Store recipients in email_queue for the scheduled time
    for (const recipient of recipients) {
      await execute(
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
    mailId: validatedMailId,
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
    // Get content from template or mail
    const content = await getBlocks()

    if (!content) {
      logger.warn('Content source not found', { templateId: validatedTemplateId, mailId: validatedMailId })
      sendSSE(res, { type: 'error', message: 'Template or mail not found' })
      res.end()
      return
    }

    const blocks = content.blocks

    // Create campaign record with cc/bcc
    const result = await execute(
      `INSERT INTO campaigns (name, template_id, subject, total_recipients, cc, bcc, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sending', CURRENT_TIMESTAMP) RETURNING id`,
      [campaignName || 'Unnamed', validatedTemplateId ?? null, validatedSubject, recipients.length, JSON.stringify(cc || []), JSON.stringify(bcc || [])]
    )
    const campaignId = Number(result.lastInsertRowid)

    logger.info('Campaign created', { campaignId, service: 'send' })

    // Filter out suppressed emails
    const { allowed: filteredRecipients, suppressed: suppressedEmails } = await filterSuppressedEmails(recipients)

    if (suppressedEmails.length > 0) {
      logger.info(`Filtered ${suppressedEmails.length} suppressed emails`, { 
        service: 'send',
        campaignId,
        suppressedEmails 
      })
      sendSSE(res, {
        type: 'info',
        message: `Skipping ${suppressedEmails.length} suppressed email(s)`,
        suppressed: suppressedEmails
      })
    }

    let successful = 0
    let failed = 0
    let queued = 0
    const skipped = suppressedEmails.length

    // Process each recipient (using filtered list)
    for (let i = 0; i < filteredRecipients.length; i++) {
      const recipient = filteredRecipients[i]
      const current = i + 1

      try {
        // Get accounts with open circuits to exclude
        const openCircuits = await getOpenCircuits()
        if (openCircuits.length > 0) {
          logger.debug('Skipping accounts with open circuits', { accountIds: openCircuits, service: 'send' })
        }

        // Get next available account, excluding those with open circuits
        const account = await getNextAvailableAccount(campaignId, openCircuits)

        if (!account) {
          // No account available - queue for tomorrow
          await execute(
            `INSERT INTO email_queue (campaign_id, recipient_email, recipient_data, scheduled_for, status)
             VALUES (?, ?, ?, ?, 'pending')`,
            [campaignId, recipient.email, JSON.stringify(recipient), getNextDay()]
          )

          queued++

          await execute(
            `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message)
             VALUES (?, ?, 'queued', 'All accounts at cap')`,
            [campaignId, recipient.email]
          )

          sendSSE(res, {
            type: 'progress',
            current,
            total: filteredRecipients.length,
            message: `Queued ${recipient.email} for tomorrow`,
          })
          continue
        }

        // Get tracking settings (needed for baseUrl and tracking injection)
        const trackingSettings = await getTrackingSettings()

        // Compile template with recipient data (all fields are directly on recipient object)
        // Convert all values to strings for variable substitution
        const recipientData: Record<string, string> = {}
        for (const [key, value] of Object.entries(recipient)) {
          recipientData[key] = String(value ?? '')
        }
        logger.debug('Recipient data for template', { email: recipient.email, fields: Object.keys(recipientData) })
        let html = compileTemplate(blocks, recipientData, trackingSettings.baseUrl)
        const compiledSubject = replaceVariables(validatedSubject, recipientData)

        // Inject tracking if enabled
        if (trackingSettings.enabled) {
          const trackingToken = await getOrCreateToken(campaignId, recipient.email)
          html = injectTracking(html, trackingToken, trackingSettings.baseUrl, {
            openTracking: trackingSettings.openEnabled,
            clickTracking: trackingSettings.clickEnabled,
          })
        }

        // Get per-recipient attachment if one was matched
        const recipientAttachment = await getRecipientAttachment(recipient.email, undefined, campaignId)
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
          await recordSuccess(account.id)

          // Increment account send count
          await incrementSendCount(account.id)

          successful++

          // Log success with retry count
          await execute(
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
            total: filteredRecipients.length,
            message: `Sent to ${recipient.email} via ${account.name}`,
          })
        } else {
          // Record failure with circuit breaker
          await recordFailure(account.id)

          failed++
          const errorMessage = sendResult.error?.message || 'Unknown error'

          // Log failure with retry count
          await execute(
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

          // Check if this is a bounce and record it
          const { isBounce, type: bounceType } = detectBounceType(errorMessage)
          if (isBounce) {
            await recordBounce(campaignId, recipient.email, bounceType, errorMessage)
            logger.info(`Recorded ${bounceType} bounce`, {
              service: 'send',
              campaignId,
              recipient: recipient.email,
              bounceType
            })
          }

          sendSSE(res, {
            type: 'progress',
            current,
            total: filteredRecipients.length,
            message: `Failed: ${recipient.email} - ${errorMessage} (${sendResult.attempts} attempts)`,
          })
        }
      } catch (error) {
        // This catch is for unexpected errors (not send failures handled by retry)
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        await execute(
          `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message, retry_count)
           VALUES (?, ?, 'failed', ?, 1)`,
          [campaignId, recipient.email, errorMessage]
        )

        // Check if this is a bounce and record it
        const { isBounce, type: bounceType } = detectBounceType(errorMessage)
        if (isBounce) {
          await recordBounce(campaignId, recipient.email, bounceType, errorMessage)
          logger.info(`Recorded ${bounceType} bounce`, {
            service: 'send',
            campaignId,
            recipient: recipient.email,
            bounceType
          })
        }

        logger.error('Unexpected error during send', {
          service: 'send',
          campaignId,
          recipient: recipient.email
        }, error instanceof Error ? error : undefined)

        sendSSE(res, {
          type: 'progress',
          current,
          total: filteredRecipients.length,
          message: `Failed: ${recipient.email} - ${errorMessage}`,
        })
      }

      // Small delay between sends
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    // Update campaign stats
    await execute(
      `UPDATE campaigns SET successful = ?, failed = ?, queued = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [successful, failed, queued, campaignId]
    )

    logger.info('Campaign completed', {
      service: 'send',
      campaignId,
      successful,
      failed,
      queued,
      skipped
    })

    sendSSE(res, { type: 'complete', campaignId, skipped })
    res.end()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Campaign failed', { service: 'send' }, error instanceof Error ? error : undefined)
    sendSSE(res, { type: 'error', message: errorMessage })
    res.end()
  }
})
