import { auth } from './firebase'

import type {
  Template, Mail, Block, Draft,
  Campaign, CampaignDetail, CampaignAnalytics,
  SenderAccount,
  QueueItem, AppSettings,
  CertificateTemplate, LogoConfig, SignatoryConfig, CertificateConfig, CertificateData, GenerateResponse,
  Media, MediaUsage, SuppressionItem,
  Contact, ContactList, PaginatedResponse,
  GoogleSheetsStatus, GoogleSheetsCredentials, SpreadsheetMetadata, SpreadsheetPreview, SyncConfig, SyncResult, SheetSync,
  SequenceStep, Sequence, SequenceAction, SequenceEnrollment, SequenceListItem, GenerateSequenceRequest, GenerateSequenceResponse,
  LLMProviderId, LLMProviderInfo, LLMSettings,
  User, AdminUser, UsersListResponse, AnalyticsOverview,
} from '../../shared/types'

export type {
  Template, Mail, Block, Draft,
  Campaign, CampaignDetail, CampaignAnalytics,
  SenderAccount,
  QueueItem, AppSettings,
  CertificateTemplate, LogoConfig, SignatoryConfig, CertificateConfig, CertificateData, GenerateResponse,
  Media, MediaUsage, SuppressionItem,
  Contact, ContactList, PaginatedResponse,
  GoogleSheetsStatus, GoogleSheetsCredentials, SpreadsheetMetadata, SpreadsheetPreview, SyncConfig, SyncResult, SheetSync,
  SequenceStep, Sequence, SequenceAction, SequenceEnrollment, SequenceListItem, GenerateSequenceRequest, GenerateSequenceResponse,
  LLMProviderId, LLMProviderInfo, LLMSettings,
  User, AdminUser, UsersListResponse, AnalyticsOverview,
} from '../../shared/types'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// Get auth headers using Firebase token
async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser
  if (!user) {
    return { 'Content-Type': 'application/json' }
  }
  
  const token = await user.getIdToken()
  return { 
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders()

  const headers: HeadersInit = {
    ...authHeaders,
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    // Firebase auth handles session - just throw the error
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
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_BASE}/certificates/generate/zip`, {
      method: 'POST',
      headers,
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

  // LLM Settings
  getLLMProvidersInfo: () =>
    request<LLMProviderInfo[]>('/settings/llm/providers-info'),

  getLLMSettings: () =>
    request<LLMSettings>('/settings/llm'),

  updateLLMProvider: (data: { id: LLMProviderId; apiKey?: string; model?: string; enabled?: boolean }) =>
    request<{ success: boolean }>('/settings/llm/provider', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getLLMStatus: () =>
    request<{ available: boolean; activeProvider: LLMProviderId | null }>('/sequences/generate/status'),

  setActiveLLMProvider: (provider: LLMProviderId | null) =>
    request<{ success: boolean; activeProvider: LLMProviderId | null }>('/settings/llm/active', {
      method: 'PUT',
      body: JSON.stringify({ provider }),
    }),
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
    const headers = await getAuthHeaders()

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

// Sequence API functions
export function getSequence(id: number): Promise<Sequence> {
  return request<Sequence>(`/sequences/${id}`)
}

export function addSequenceStep(sequenceId: number, step: Partial<SequenceStep>): Promise<SequenceStep> {
  return request<SequenceStep>(`/sequences/${sequenceId}/steps`, {
    method: 'POST',
    body: JSON.stringify(step)
  })
}

export function createBranchPoint(sequenceId: number, afterStep: number, delayHours: number = 0): Promise<void> {
  return request<void>(`/sequences/${sequenceId}/branch-point`, {
    method: 'POST',
    body: JSON.stringify({ afterStep, delayBeforeSwitch: delayHours })
  })
}

export function getSequenceActions(sequenceId: number): Promise<SequenceAction[]> {
  return request<SequenceAction[]>(`/sequences/${sequenceId}/actions`)
}

export function getSequenceEnrollments(sequenceId: number): Promise<SequenceEnrollment[]> {
  return request<SequenceEnrollment[]>(`/sequences/${sequenceId}/enrollments`)
}

// Full sequences API
export const sequences = {
  list: () => request<SequenceListItem[]>('/sequences'),
  
  get: (id: number) => request<Sequence>(`/sequences/${id}`),
  
  create: (data: { name: string; description?: string; enabled?: boolean }) =>
    request<{ id: number; message: string }>('/sequences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: number, data: { name?: string; description?: string; enabled?: boolean }) =>
    request<{ message: string }>(`/sequences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: number) =>
    request<{ message: string }>(`/sequences/${id}`, { method: 'DELETE' }),
  
  addStep: (sequenceId: number, step: { 
    subject: string
    templateId?: number
    delayDays?: number
    delayHours?: number
    sendTime?: string
    branchId?: string | null
  }) =>
    request<{ id: number; stepOrder: number; message: string }>(`/sequences/${sequenceId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step),
    }),
  
  updateStep: (sequenceId: number, stepId: number, data: {
    subject?: string
    templateId?: number
    delayDays?: number
    delayHours?: number
    sendTime?: string
  }) =>
    request<{ message: string }>(`/sequences/${sequenceId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteStep: (sequenceId: number, stepId: number) =>
    request<{ message: string }>(`/sequences/${sequenceId}/steps/${stepId}`, { method: 'DELETE' }),
  
  generate: (data: GenerateSequenceRequest) =>
    request<GenerateSequenceResponse>('/sequences/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Admin API functions
export const adminApi = {
  // Users
  listUsers: async (params: { page?: number; limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.search) searchParams.set('search', params.search)
    return request<UsersListResponse>(`/admin/users?${searchParams}`)
  },

  getUser: async (id: string) => {
    return request<AdminUser>(`/admin/users/${id}`)
  },

  updateUser: async (id: string, data: { name?: string; isAdmin?: boolean }) => {
    return request<User>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },

  deleteUser: async (id: string) => {
    return request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' })
  },

  suspendUser: async (id: string) => {
    return request<{ success: boolean }>(`/admin/users/${id}/suspend`, { method: 'POST' })
  },

  unsuspendUser: async (id: string) => {
    return request<{ success: boolean }>(`/admin/users/${id}/unsuspend`, { method: 'POST' })
  },

  impersonateUser: async (id: string) => {
    return request<{ token: string }>(`/admin/users/${id}/impersonate`, { method: 'POST' })
  },

  // Analytics
  getOverview: async () => {
    return request<AnalyticsOverview>('/admin/analytics/overview')
  },

  // Settings
  getSettings: async () => {
    return request<Record<string, string>>('/admin/settings')
  },

  updateSettings: async (settings: Record<string, string>) => {
    return request<Record<string, string>>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    })
  }
}
