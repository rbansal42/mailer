export interface CertificateTemplate {
  id: string
  name: string
  category: 'modern' | 'dark' | 'elegant' | 'minimal'
  thumbnail: string
  description: string
  defaultColors: {
    primary: string
    secondary: string
    accent: string
  }
}

export interface LogoConfig {
  id: string
  url: string
  width: number
  order: number
}

export interface SignatoryConfig {
  id: string
  name: string
  designation: string
  organization: string
  signatureUrl: string
  order: number
}

export interface CertificateConfig {
  id: number
  name: string
  templateId: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  logos: LogoConfig[]
  signatories: SignatoryConfig[]
  titleText: string
  subtitleText: string
  descriptionTemplate: string
  createdAt: string
  updatedAt: string
}

export interface CertificateData {
  name: string
  date?: string
  title?: string
  certificate_id?: string
  custom1?: string
  custom2?: string
  custom3?: string
  [key: string]: string | undefined
}

export interface GenerateRequest {
  configId: number
  recipients: CertificateData[]
}

export interface GeneratedCertificate {
  id: number
  certificateId: string
  configId: number
  recipientName: string
  recipientEmail?: string
  data: Record<string, string>
  pdfPath?: string
  campaignId?: number
  generatedAt: string
}
