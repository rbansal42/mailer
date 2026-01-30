export interface EmailOptions {
  to: string
  cc?: string
  subject: string
  html: string
}

export abstract class EmailProvider {
  abstract send(options: EmailOptions): Promise<void>
  abstract verify(): Promise<boolean>
  abstract disconnect(): Promise<void>
}
