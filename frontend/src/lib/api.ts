import { useAuthStore } from '../hooks/useAuthStore'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Get token from Zustand store, with fallback to localStorage for SSR/hydration race
function getToken(): string | null {
  // Try Zustand store first
  const storeToken = useAuthStore.getState().token
  if (storeToken) return storeToken
  
  // Fallback: read directly from localStorage (handles hydration race)
  try {
    const stored = localStorage.getItem('mailer-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed?.state?.token || null
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

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
  duplicateDraft: (id: number) =>
    request<{ id: number; name: string }>(`/drafts/${id}/duplicate`, { method: 'POST' }),

  // Campaigns (History)
  getCampaigns: () => request<Campaign[]>('/campaigns'),
  getCampaign: (id: number) => request<CampaignDetail>(`/campaigns/${id}`),
  getCampaignAnalytics: (id: number) => request<CampaignAnalytics>(`/campaigns/${id}/analytics`),
  deleteCampaign: (id: number) =>
    request<void>(`/campaigns/${id}`, { method: 'DELETE' }),
  duplicateCampaign: (id: number) =>
    request<{ id: number; name: string }>(`/campaigns/${id}/duplicate`, { method: 'POST' }),

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
    const token = getToken()
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

  // Email preview
  preview: (blocks: unknown[], recipient: Record<string, string>) =>
    request<{ html: string }>('/preview', {
      method: 'POST',
      body: JSON.stringify({ blocks, recipient }),
    }),

  // Suppression list
  getSuppression: (page = 1, limit = 50, search = '') =>
    request<{
      items: SuppressionItem[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>(`/suppression?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),

  addSuppression: (email: string, reason = 'manual') =>
    request<{ success: boolean }>('/suppression', {
      method: 'POST',
      body: JSON.stringify({ email, reason }),
    }),

  deleteSuppression: (id: number) =>
    request<void>(`/suppression/${id}`, { method: 'DELETE' }),

  importSuppression: (emails: string[], reason = 'manual') =>
    request<{ added: number; skipped: number }>('/suppression/import', {
      method: 'POST',
      body: JSON.stringify({ emails, reason }),
    }),

  checkSuppression: (email: string) =>
    request<{ suppressed: boolean; reason: string | null }>(`/suppression/check/${encodeURIComponent(email)}`),
}

// Types
export interface Template {
  id: number
  name: string
  description?: string
  blocks: Block[]
  isDefault?: boolean
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
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'footer' | 'action-button'
  props: Record<string, unknown>
}

export interface Draft {
  id: number
  name: string
  templateId: number | null
  mailId: number | null
  listId: number | null
  subject: string
  testEmail: string | null
  recipients: Recipient[]
  recipientsText: string
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
  status?: 'sending' | 'completed' | 'scheduled' | 'failed'
  scheduledFor?: string
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

export interface CampaignAnalytics {
  campaignId: number
  campaignName: string
  delivery: {
    sent: number
    failed: number
    queued: number
    bounced: number
    hardBounces: number
    softBounces: number
  }
  engagement: {
    opens: number
    uniqueOpens: number
    openRate: number
    clicks: number
    uniqueClicks: number
    clickRate: number
  }
  topLinks: Array<{ url: string; clicks: number }>
  opensOverTime: Array<{ hour: string; count: number }>
  recipients: Array<{
    email: string
    status: string
    opens: number
    clicks: string[]
  }>
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

export interface SuppressionItem {
  id: number
  email: string
  reason: string
  source: string | null
  createdAt: string
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

// Contact types
export interface Contact {
  id: number
  email: string
  name?: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  country?: string
  custom_fields: Record<string, string>
  created_at: string
  updated_at: string
  list_count?: number
}

export interface ContactList {
  id: number
  name: string
  description?: string
  contact_count: number
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  contacts: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Lists API - uses request() helper for auth headers
export const listsApi = {
  getAll: () => request<ContactList[]>('/contacts/lists'),
  
  get: (id: number) => request<ContactList>(`/contacts/lists/${id}`),
  
  create: (data: { name: string; description?: string }) =>
    request<ContactList>('/contacts/lists', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  
  update: (id: number, data: { name?: string; description?: string }) =>
    request<ContactList>(`/contacts/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  
  delete: (id: number) =>
    request<void>(`/contacts/lists/${id}`, { method: 'DELETE' }),
  
  getMembers: (listId: number, page = 1, limit = 50, search = '') => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (search) params.set('search', search)
    return request<PaginatedResponse<Contact>>(`/contacts/lists/${listId}/members?${params}`)
  },
  
  addMembers: (listId: number, contacts: Partial<Contact>[]) =>
    request<{ created: number; updated: number; added: number }>(`/contacts/lists/${listId}/members`, {
      method: 'POST',
      body: JSON.stringify({ contacts })
    }),
  
  removeMember: (listId: number, contactId: number) =>
    request<void>(`/contacts/lists/${listId}/members/${contactId}`, { method: 'DELETE' }),
  
  import: (listId: number, csv: string, mapping?: Record<string, string>) =>
    request<{ created: number; updated: number; added: number; errors?: string[] }>(`/contacts/lists/${listId}/import`, {
      method: 'POST',
      body: JSON.stringify({ csv, mapping })
    }),
  
  export: async (listId: number, listName: string): Promise<void> => {
    const token = getToken()
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${API_BASE}/contacts/lists/${listId}/export`, { headers })
    if (!res.ok) throw new Error('Failed to export list')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${listName.replace(/[^a-z0-9]/gi, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
}

// Google Sheets Integration types
export interface GoogleSheetsStatus {
  configured: boolean
  connected: boolean
  clientId: string | null
  redirectUri: string | null
}

export interface GoogleSheetsCredentials {
  clientId: string
  clientSecret: string
  redirectUri?: string
}

export interface SpreadsheetMetadata {
  title: string
  sheets: { sheetId: number; title: string }[]
}

export interface SpreadsheetPreview {
  headers: string[]
  sampleRows: Record<string, string>[]
  totalRows: number
  sheetName: string
  spreadsheetTitle: string
  suggestedMapping: ColumnMapping
}

export interface ColumnMapping {
  email: string
  name?: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  country?: string
}

export interface SyncConfig {
  spreadsheetId: string
  sheetRange?: string
  columnMapping: ColumnMapping
  autoSync?: boolean
  syncFrequency?: 'manual' | 'hourly' | 'daily'
}

export interface SyncResult {
  message: string
  created: number
  updated: number
  added: number
  total: number
  spreadsheetTitle?: string
}

export interface SheetSync {
  id: number
  list_id: number
  spreadsheet_id: string
  spreadsheet_name: string | null
  sheet_range: string | null
  column_mapping: ColumnMapping
  auto_sync: boolean
  sync_frequency: string
  last_synced_at: string | null
  last_sync_count: number
  last_sync_error: string | null
  created_at: string
  updated_at: string
}

// Google Sheets API
export const googleSheetsApi = {
  getStatus: () => request<GoogleSheetsStatus>('/integrations/google-sheets/status'),

  saveCredentials: (credentials: GoogleSheetsCredentials) =>
    request<{ message: string }>('/integrations/google-sheets/credentials', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getAuthUrl: () => request<{ authUrl: string }>('/integrations/google-sheets/auth-url'),

  disconnect: () =>
    request<{ message: string }>('/integrations/google-sheets/disconnect', {
      method: 'POST',
    }),

  getSpreadsheet: (id: string) =>
    request<SpreadsheetMetadata>(`/integrations/google-sheets/spreadsheet/${encodeURIComponent(id)}`),

  previewSpreadsheet: (id: string, range?: string) => {
    const params = range ? `?range=${encodeURIComponent(range)}` : ''
    return request<SpreadsheetPreview>(`/integrations/google-sheets/spreadsheet/${encodeURIComponent(id)}/preview${params}`)
  },

  syncToList: (listId: number, config: SyncConfig) =>
    request<SyncResult>(`/integrations/google-sheets/lists/${listId}/sync`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  getListSyncs: (listId: number) =>
    request<SheetSync[]>(`/integrations/google-sheets/lists/${listId}/syncs`),

  deleteSync: (listId: number, syncId: number) =>
    request<void>(`/integrations/google-sheets/lists/${listId}/syncs/${syncId}`, {
      method: 'DELETE',
    }),

  runSync: (listId: number, syncId: number) =>
    request<SyncResult>(`/integrations/google-sheets/lists/${listId}/syncs/${syncId}/run`, {
      method: 'POST',
    }),
}

// Sequence types
export interface SequenceStep {
  id: number
  sequence_id: number
  step_order: number
  template_id: number
  subject: string
  delay_days: number
  delay_hours: number
  send_time: string | null
  branch_id: string | null
  branch_order: number | null
  is_branch_point: boolean
}

export interface Sequence {
  id: number
  name: string
  description: string | null
  enabled: boolean
  branch_delay_hours: number
  steps: SequenceStep[]
}

// Sequence API functions
export async function getSequence(id: number): Promise<Sequence> {
  const res = await fetch(`${API_BASE}/api/sequences/${id}`)
  if (!res.ok) throw new Error('Failed to fetch sequence')
  return res.json()
}

export async function addSequenceStep(sequenceId: number, step: Partial<SequenceStep>): Promise<SequenceStep> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(step)
  })
  if (!res.ok) throw new Error('Failed to add step')
  return res.json()
}

export async function createBranchPoint(sequenceId: number, afterStep: number, delayHours: number = 0): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/branch-point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ afterStep, delayBeforeSwitch: delayHours })
  })
  if (!res.ok) throw new Error('Failed to create branch point')
}

export async function getSequenceActions(sequenceId: number): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/actions`)
  if (!res.ok) throw new Error('Failed to fetch actions')
  return res.json()
}
