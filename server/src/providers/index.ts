import { EmailProvider } from './base'
import { GmailProvider } from './gmail'
import { SmtpProvider } from './smtp'

export { EmailProvider, EmailOptions } from './base'
export { GmailProvider } from './gmail'
export { SmtpProvider } from './smtp'

interface GmailConfig {
  email: string
  appPassword: string
}

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

export function createProvider(type: 'gmail', config: GmailConfig): EmailProvider
export function createProvider(type: 'smtp', config: SmtpConfig): EmailProvider
export function createProvider(type: 'gmail' | 'smtp', config: GmailConfig | SmtpConfig): EmailProvider {
  switch (type) {
    case 'gmail':
      return new GmailProvider(config as GmailConfig)
    case 'smtp':
      return new SmtpProvider(config as SmtpConfig)
    default:
      throw new Error(`Unknown provider type: ${type}`)
  }
}
