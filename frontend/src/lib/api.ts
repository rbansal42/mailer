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
