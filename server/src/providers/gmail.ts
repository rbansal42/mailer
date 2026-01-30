import nodemailer, { Transporter } from 'nodemailer'
import { EmailProvider, EmailOptions } from './base'

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

  async send(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.email,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html,
    })
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
