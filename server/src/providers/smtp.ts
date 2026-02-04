import nodemailer, { Transporter } from 'nodemailer'
import { EmailProvider, SendOptions } from './base'
import { logger } from '../lib/logger'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

const SERVICE = 'smtp-provider'

export class SmtpProvider extends EmailProvider {
  private transporter: Transporter
  private fromEmail: string
  private fromName: string
  private host: string
  private port: number

  constructor(config: SmtpConfig) {
    super()
    this.fromEmail = config.fromEmail
    this.fromName = config.fromName
    this.host = config.host
    this.port = config.port

    logger.debug('Initializing SMTP provider', {
      service: SERVICE,
      host: config.host,
      port: config.port,
      secure: config.secure,
      fromEmail: config.fromEmail
    })

    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      })
      logger.info('SMTP provider initialized', {
        service: SERVICE,
        host: config.host,
        port: config.port
      })
    } catch (error) {
      logger.error('Failed to initialize SMTP provider', {
        service: SERVICE,
        host: config.host,
        port: config.port
      }, error as Error)
      throw error
    }
  }

  async connect(): Promise<void> {
    logger.debug('SMTP connect called (no-op, connection established in constructor)', { service: SERVICE })
  }

  async send(options: SendOptions): Promise<void> {
    const startTime = Date.now()
    logger.info('Sending email via SMTP', {
      service: SERVICE,
      host: this.host,
      to: options.to,
      subject: options.subject,
      hasAttachments: !!options.attachments?.length,
      attachmentCount: options.attachments?.length || 0
    })

    try {
      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        cc: options.cc?.join(', ') || undefined,
        bcc: options.bcc?.join(', ') || undefined,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      }
      await this.transporter.sendMail(mailOptions)

      const durationMs = Date.now() - startTime
      logger.info('Email sent successfully via SMTP', {
        service: SERVICE,
        host: this.host,
        to: options.to,
        durationMs
      })
    } catch (error) {
      const durationMs = Date.now() - startTime
      logger.error('Failed to send email via SMTP', {
        service: SERVICE,
        host: this.host,
        to: options.to,
        subject: options.subject,
        durationMs
      }, error as Error)
      throw error
    }
  }

  async verify(): Promise<boolean> {
    logger.debug('Verifying SMTP connection', { service: SERVICE, host: this.host, port: this.port })
    try {
      await this.transporter.verify()
      logger.info('SMTP connection verified successfully', { service: SERVICE, host: this.host })
      return true
    } catch (error) {
      logger.warn('SMTP connection verification failed', { service: SERVICE, host: this.host }, error as Error)
      return false
    }
  }

  async disconnect(): Promise<void> {
    logger.debug('Disconnecting SMTP provider', { service: SERVICE, host: this.host })
    try {
      this.transporter.close()
      logger.info('SMTP provider disconnected', { service: SERVICE, host: this.host })
    } catch (error) {
      logger.error('Error disconnecting SMTP provider', { service: SERVICE, host: this.host }, error as Error)
      throw error
    }
  }
}
