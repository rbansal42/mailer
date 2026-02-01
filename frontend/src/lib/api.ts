import { useAuthStore } from '../hooks/useAuthStore'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    useAuthStore.getState().logout()
    throw new ApiError(401, 'Unauthorized')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new ApiError(response.status, error.message || 'Request failed')
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const api = {
  // Auth
  login: (password: string) =>
    request<{ token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  setup: (password: string) =>
    request<{ token: string }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  checkSetup: () => request<{ needsSetup: boolean }>('/auth/check'),

  // Templates
  getTemplates: () => request<Template[]>('/templates'),
  getTemplate: (id: number) => request<Template>(`/templates/${id}`),
  createTemplate: (data: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (id: number, data: Partial<Template>) =>
    request<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: number) =>
    request<void>(`/templates/${id}`, { method: 'DELETE' }),

  // Drafts
  getDrafts: () => request<Draft[]>('/drafts'),
  getDraft: (id: number) => request<Draft>(`/drafts/${id}`),
  createDraft: (data: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<Draft>('/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDraft: (id: number, data: Partial<Draft>) =>
    request<Draft>(`/drafts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDraft: (id: number) =>
    request<void>(`/drafts/${id}`, { method: 'DELETE' }),

  // Campaigns (History)
  getCampaigns: () => request<Campaign[]>('/campaigns'),
  getCampaign: (id: number) => request<CampaignDetail>(`/campaigns/${id}`),
  deleteCampaign: (id: number) =>
    request<void>(`/campaigns/${id}`, { method: 'DELETE' }),

  // Accounts
  getAccounts: () => request<SenderAccount[]>('/accounts'),
  getAccount: (id: number) => request<SenderAccount>(`/accounts/${id}`),
  createAccount: (data: Omit<SenderAccount, 'id' | 'createdAt' | 'todayCount'>) =>
    request<SenderAccount>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAccount: (id: number, data: Partial<SenderAccount>) =>
    request<SenderAccount>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteAccount: (id: number) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  testAccount: (id: number) =>
    request<{ success: boolean; error?: string }>(`/accounts/${id}/test`, {
      method: 'POST',
    }),
  reorderAccounts: (ids: number[]) =>
    request<void>('/accounts/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Queue
  getQueue: () => request<QueueItem[]>('/queue'),
  processQueue: () => request<void>('/queue/process', { method: 'POST' }),

  // Settings
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Certificates
  getCertificateTemplates: () => request<CertificateTemplate[]>('/certificates/templates'),
  getCertificateConfigs: () => request<CertificateConfig[]>('/certificates/configs'),
  getCertificateConfig: (id: number) => request<CertificateConfig>(`/certificates/configs/${id}`),
  createCertificateConfig: (data: Omit<CertificateConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<CertificateConfig>('/certificates/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCertificateConfig: (id: number, data: Partial<CertificateConfig>) =>
    request<CertificateConfig>(`/certificates/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCertificateConfig: (id: number) =>
    request<void>(`/certificates/configs/${id}`, { method: 'DELETE' }),
  previewCertificate: (configId: number, data: CertificateData) =>
    request<{ pdf: string }>('/certificates/preview', {
      method: 'POST',
      body: JSON.stringify({ configId, data }),
    }),
  previewCertificateDraft: (
    config: {
      templateId: string
      titleText: string
      subtitleText: string
      descriptionTemplate: string
      logos: LogoConfig[]
      signatories: SignatoryConfig[]
    },
    data: CertificateData
  ) =>
    request<{ pdf: string }>('/certificates/preview-draft', {
      method: 'POST',
      body: JSON.stringify({ config, data }),
    }),
  generateCertificates: (configId: number, recipients: CertificateData[]) =>
    request<GenerateResponse>('/certificates/generate', {
      method: 'POST',
      body: JSON.stringify({ configId, recipients }),
    }),
  
  // Download certificates as ZIP (for large batches - server-side ZIP creation)
  downloadCertificatesZip: async (configId: number, recipients: CertificateData[]): Promise<Blob> => {
    const token = useAuthStore.getState().token
    const response = await fetch(`${API_BASE}/certificates/generate/zip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ configId, recipients }),
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Download failed' }))
      throw new ApiError(response.status, error.message || 'Download failed')
    }
    
    return response.blob()
  },
  
  // Generate certificates for email campaign (stores as attachments)
  generateCertificatesForCampaign: (configId: number, recipients: CertificateData[], draftId?: number) =>
    request<{ success: boolean; generated: number; attachments: { email: string; certificateId: string; attachmentId: number }[]; message: string }>('/certificates/generate/campaign', {
      method: 'POST',
      body: JSON.stringify({ configId, recipients, draftId }),
    }),
  
  // Clean up campaign certificate attachments
  cleanupCampaignCertificates: (draftId: number) =>
    request<{ success: boolean; deleted: number }>(`/certificates/campaign-attachments/${draftId}`, {
      method: 'DELETE',
    }),

  // Media
  getMedia: (showDeleted = false) =>
    request<Media[]>(showDeleted ? '/media?deleted=true' : '/media'),
  
  updateMedia: (id: string, data: { filename?: string; alt_text?: string }) =>
    request<Media>(`/media/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  deleteMedia: (id: string) =>
    request<void>(`/media/${id}`, { method: 'DELETE' }),
  
  restoreMedia: (id: string) =>
    request<Media>(`/media/${id}/restore`, { method: 'POST' }),
  
  getMediaUsage: (id: string) =>
    request<MediaUsage[]>(`/media/${id}/usage`),
}

// Types
export interface Template {
  id: number
  name: string
  description?: string
  blocks: Block[]
  createdAt: string
  updatedAt: string
}

export interface Mail {
  id: number
  name: string
  description: string | null
  blocks: Block[]
  templateId: number | null
  campaignId: number | null
  status: 'draft' | 'sent'
  createdAt: string
  updatedAt: string
}

export interface Block {
  id: string
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'footer'
  props: Record<string, unknown>
}

export interface Draft {
  id: number
  name: string
  templateId: number
  subject: string
  recipients: Recipient[]
  variables?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface Recipient {
  email: string
  [key: string]: string
}

export interface Campaign {
  id: number
  name: string
  templateId: number
  subject: string
  totalRecipients: number
  successful: number
  failed: number
  queued: number
  startedAt: string
  completedAt?: string
  createdAt: string
}

export interface CampaignDetail extends Campaign {
  logs: SendLog[]
}

export interface SendLog {
  id: number
  campaignId: number
  accountId: number
  recipientEmail: string
  status: 'success' | 'failed' | 'queued'
  errorMessage?: string
  sentAt: string
}

export interface SenderAccount {
  id: number
  name: string
  providerType: 'gmail' | 'smtp'
  config: GmailConfig | SmtpConfig
  dailyCap: number
  campaignCap: number
  priority: number
  enabled: boolean
  createdAt: string
  todayCount?: number
}

export interface GmailConfig {
  email: string
  appPassword: string
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

export interface QueueItem {
  id: number
  campaignId: number
  recipientEmail: string
  recipientData: Record<string, string>
  scheduledFor: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: string
}

export interface AppSettings {
  testEmail?: string
  timezone?: string
}

// Certificate types
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
  height: number
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
  email?: string
  date?: string
  title?: string
  certificate_id?: string
  custom1?: string
  custom2?: string
  custom3?: string
  [key: string]: string | undefined
}

export interface GeneratedCertificate {
  certificateId: string
  recipientName: string
  pdf: string // base64 encoded PDF
}

export interface GenerateResponse {
  success: boolean
  generated: number
  certificates: GeneratedCertificate[]
}

// Media types
export interface Media {
  id: string
  url: string
  filename: string
  original_filename: string
  alt_text: string
  size_bytes: number | null
  uploaded_at: string
  deleted_at: string | null
}

export interface MediaUsage {
  id: string
  name: string
}

export const mails = {
  list: () => request<Mail[]>('/mails'),
  get: (id: number) => request<Mail>(`/mails/${id}`),
  create: (data: { name: string; description?: string; blocks?: Block[]; templateId?: number; status?: string }) =>
    request<Mail>('/mails', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { name: string; description?: string; blocks?: Block[]; status?: string }) =>
    request<Mail>(`/mails/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/mails/${id}`, { method: 'DELETE' }),
  saveAsTemplate: (id: number, data: { name?: string; description?: string }) =>
    request<{ id: number }>(`/mails/${id}/save-as-template`, { method: 'POST', body: JSON.stringify(data) }),
}
