export interface SendOptions {
  to: string
  cc?: string[]
  bcc?: string[]
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    path: string
    contentType?: string
  }>
}

export abstract class EmailProvider {
  abstract connect(): Promise<void>
  abstract send(options: SendOptions): Promise<void>
  abstract verify(): Promise<boolean>
  abstract disconnect(): Promise<void>
}
