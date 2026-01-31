import nodemailer, { Transporter } from 'nodemailer'
import { EmailProvider, SendOptions } from './base'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

export class SmtpProvider extends EmailProvider {
  private transporter: Transporter
  private fromEmail: string
  private fromName: string

  constructor(config: SmtpConfig) {
    super()
    this.fromEmail = config.fromEmail
    this.fromName = config.fromName
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    })
  }

  async connect(): Promise<void> {
    // Connection established in constructor via nodemailer
  }

  async send(options: SendOptions): Promise<void> {
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
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch {
      return false
    }
  }

  async disconnect(): Promise<void> {
    this.transporter.close()
  }
}
