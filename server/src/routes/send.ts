import { Router, Request, Response } from 'express'
import { db } from '../db'
import { getNextAvailableAccount, incrementSendCount } from '../services/account-manager'
import { compileTemplate, replaceVariables } from '../services/template-compiler'
import { createProvider } from '../providers'

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
  const { templateId, subject, recipients: recipientsJson, name } = req.query

  // Validate required parameters
  if (!templateId || !subject || !recipientsJson || !name) {
    res.status(400).json({ error: 'Missing required parameters' })
    return
  }

  let recipients: Recipient[]
  try {
    recipients = JSON.parse(recipientsJson as string)
  } catch {
    res.status(400).json({ error: 'Invalid recipients JSON' })
    return
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ error: 'Recipients must be a non-empty array' })
    return
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    // Get template from database
    const template = db.query('SELECT * FROM templates WHERE id = ?').get(templateId) as TemplateRow | null

    if (!template) {
      sendSSE(res, { type: 'error', message: 'Template not found' })
      res.end()
      return
    }

    const blocks = JSON.parse(template.blocks || '[]')

    // Create campaign record
    const result = db.run(
      `INSERT INTO campaigns (name, template_id, subject, total_recipients, started_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [name as string, templateId, subject as string, recipients.length]
    )
    const campaignId = Number(result.lastInsertRowid)

    let successful = 0
    let failed = 0
    let queued = 0

    // Process each recipient
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]
      const current = i + 1

      try {
        // Get next available account
        const account = getNextAvailableAccount(campaignId)

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

        // Compile template with recipient data
        const html = compileTemplate(blocks, recipient)
        const compiledSubject = replaceVariables(subject as string, recipient)

        // Create provider and send email
        const provider = createProvider(account.providerType as 'gmail' | 'smtp', account.config)

        await provider.send({
          to: recipient.email,
          subject: compiledSubject,
          html,
        })

        await provider.disconnect()

        // Increment account send count
        incrementSendCount(account.id)

        successful++

        // Log success
        db.run(
          `INSERT INTO send_logs (campaign_id, account_id, recipient_email, status)
           VALUES (?, ?, ?, 'success')`,
          [campaignId, account.id, recipient.email]
        )

        sendSSE(res, {
          type: 'progress',
          current,
          total: recipients.length,
          message: `Sent to ${recipient.email} via ${account.name}`,
        })
      } catch (error) {
        failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        db.run(
          `INSERT INTO send_logs (campaign_id, recipient_email, status, error_message)
           VALUES (?, ?, 'failed', ?)`,
          [campaignId, recipient.email, errorMessage]
        )

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
      `UPDATE campaigns SET successful = ?, failed = ?, queued = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [successful, failed, queued, campaignId]
    )

    sendSSE(res, { type: 'complete', campaignId })
    res.end()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    sendSSE(res, { type: 'error', message: errorMessage })
    res.end()
  }
})
