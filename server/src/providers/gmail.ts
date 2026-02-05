import nodemailer, { Transporter } from 'nodemailer'
import { EmailProvider } from './base'
import type { SendOptions } from './base'

interface GmailConfig {
  email: string
  appPassword: string
}

export class GmailProvider extends EmailProvider {
  private transporter: Transporter
  private email: string

  constructor(config: GmailConfig) {
    super()
    this.email = config.email
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email,
        pass: config.appPassword,
      },
    })
  }

  async connect(): Promise<void> {
    // Connection established in constructor via nodemailer
  }

  async send(options: SendOptions): Promise<void> {
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
