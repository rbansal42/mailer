import nodemailer, { Transporter } from 'nodemailer'
import { EmailProvider, SendOptions } from './base'
import { logger } from '../lib/logger'

interface GmailConfig {
  email: string
  appPassword: string
}

const SERVICE = 'gmail-provider'

export class GmailProvider extends EmailProvider {
  private transporter: Transporter
  private email: string

  constructor(config: GmailConfig) {
    super()
    this.email = config.email
    logger.debug('Initializing Gmail provider', { service: SERVICE, email: config.email })
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email,
          pass: config.appPassword,
        },
      })
      logger.info('Gmail provider initialized', { service: SERVICE, email: config.email })
    } catch (error) {
      logger.error('Failed to initialize Gmail provider', { service: SERVICE, email: config.email }, error as Error)
      throw error
    }
  }

  async connect(): Promise<void> {
    logger.debug('Gmail connect called (no-op, connection established in constructor)', { service: SERVICE })
  }

  async send(options: SendOptions): Promise<void> {
    const startTime = Date.now()
    logger.info('Sending email via Gmail', {
      service: SERVICE,
      to: options.to,
      subject: options.subject,
      hasAttachments: !!options.attachments?.length,
      attachmentCount: options.attachments?.length || 0
    })

    try {
      const mailOptions = {
        from: this.email,
        to: options.to,
        cc: options.cc?.join(', ') || undefined,
        bcc: options.bcc?.join(', ') || undefined,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      }
      await this.transporter.sendMail(mailOptions)

      const durationMs = Date.now() - startTime
      logger.info('Email sent successfully via Gmail', {
        service: SERVICE,
        to: options.to,
        durationMs
      })
    } catch (error) {
      const durationMs = Date.now() - startTime
      logger.error('Failed to send email via Gmail', {
        service: SERVICE,
        to: options.to,
        subject: options.subject,
        durationMs
      }, error as Error)
      throw error
    }
  }

  async verify(): Promise<boolean> {
    logger.debug('Verifying Gmail connection', { service: SERVICE, email: this.email })
    try {
      await this.transporter.verify()
      logger.info('Gmail connection verified successfully', { service: SERVICE, email: this.email })
      return true
    } catch (error) {
      logger.warn('Gmail connection verification failed', { service: SERVICE, email: this.email }, error as Error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    logger.debug('Disconnecting Gmail provider', { service: SERVICE, email: this.email })
    try {
      this.transporter.close()
      logger.info('Gmail provider disconnected', { service: SERVICE, email: this.email })
    } catch (error) {
      logger.error('Error disconnecting Gmail provider', { service: SERVICE, email: this.email }, error as Error)
      throw error
    }
  }
}
