/**
 * Shared type definitions for the Mailer application.
 * These types represent the API contracts between client and server.
 *
 * Extracted from src/client/lib/api.ts to allow both client and server
 * to import from a single source of truth.
 */

import type { TriggerType } from './constants'

// Templates & Mails

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

// Drafts

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

// Campaigns

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
    actionClicks?: number
    actionRate?: number
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

// Accounts

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

// Queue

export interface QueueItem {
  id: number
  campaignId: number
  recipientEmail: string
  recipientData: Record<string, string>
  scheduledFor: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: string
}

// Settings

export interface AppSettings {
  testEmail?: string
  timezone?: string
}

// Certificates

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

// Media

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

// Suppression

export interface SuppressionItem {
  id: number
  email: string
  reason: string
  source: string | null
  createdAt: string
}

// Contacts

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

// Google Sheets Integration

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

// Sequences

export interface SequenceBranch {
  id: string
  sequence_id: number
  name: string
  description: string | null
  color: string
  parent_branch_id: string | null
  trigger_step_id: number | null
  trigger_type: TriggerType
  trigger_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface SequenceStep {
  id: number
  sequence_id: number
  step_order: number
  template_id: number | null
  subject: string
  delay_days: number
  delay_hours: number
  send_time: string | null
  branch_id: string | null
  branch_order: number | null
  is_branch_point: boolean
  blocks: Block[] | null
}

export interface Sequence {
  id: number
  name: string
  description: string | null
  enabled: boolean
  branch_delay_hours: number
  steps: SequenceStep[]
  branches: SequenceBranch[]
}

export interface SequenceAction {
  id: number
  sequence_id: number
  step_id: number
  enrollment_id: number
  clicked_at: string
  destination_type: string
  destination_url: string | null
  hosted_message: string | null
  button_text: string | null
  button_id: string | null
  branch_target: string | null
  recipient_email: string
  recipient_data: string | null
}

export interface SequenceEnrollment {
  id: number
  sequence_id: number
  recipient_email: string
  recipientData: Record<string, string> | null
  current_step: number
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'failed'
  branch_id: string | null
  action_clicked_at: string | null
  trigger_data: Record<string, unknown> | null
  enrolled_at: string
  next_send_at: string | null
  completed_at: string | null
  retry_count: number
  last_error: string | null
}

export interface SequenceListItem {
  id: number
  name: string
  description: string | null
  enabled: boolean
  branch_delay_hours: number
  step_count: number
  active_enrollments: number
  created_at: string
  updated_at: string
}

export interface CreateBranchRequest {
  id: string
  name: string
  description?: string
  color?: string
  parentBranchId?: string
  triggerStepId?: number
  triggerType: TriggerType
  triggerConfig?: Record<string, unknown>
}

export interface UpdateBranchRequest {
  name?: string
  description?: string
  color?: string
  triggerStepId?: number
  triggerType?: TriggerType
  triggerConfig?: Record<string, unknown>
}

export interface GenerateSequenceRequest {
  goal: string
  emailCount: number
  timing: 'daily' | 'every-few-days' | 'weekly'
  tone: 'professional' | 'friendly' | 'casual'
  additionalContext?: string
}

export interface GeneratedSequenceEmail {
  subject: string
  delayDays: number
  blocks: Block[]
}

export interface GenerateSequenceResponse {
  name: string
  emails: GeneratedSequenceEmail[]
}

// LLM Providers

export type LLMProviderId = 'gemini' | 'openai' | 'anthropic'

export interface LLMModelInfo {
  id: string
  name: string
  description?: string
}

export interface LLMProviderInfo {
  id: LLMProviderId
  name: string
  models: LLMModelInfo[]
  envVar: string
}

export interface StoredLLMProvider {
  id: LLMProviderId
  apiKey: string
  apiKeyMasked: string
  model: string
  enabled: boolean
}

export interface LLMSettings {
  providers: StoredLLMProvider[]
  activeProvider: LLMProviderId | null
}

// Admin / User Management

export interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
  avatarUrl: string | null
}

export interface AdminUser extends User {
  createdAt: string
  stats?: {
    campaigns: number
    contacts: number
    emailsSent: number
  }
}

export interface UsersListResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
}

export interface AnalyticsOverview {
  totalUsers: number
  totalCampaigns: number
  totalEmailsSent: number
  totalContacts: number
  recentSignups: Array<{ date: string; count: number }>
}

export interface UserAnalytics {
  signups: Array<{ date: string; count: number }>
  activeUsers: number
}

export interface EmailAnalytics {
  emailsByDay: Array<{ date: string; count: number }>
  statusBreakdown: Record<string, number>
  bounces: number
}

export interface StorageAnalytics {
  topUsersByStorage: Array<{
    userId: string
    name: string
    bytes: number
  }>
  totalMediaBytes: number
  totalAttachmentsBytes: number
}
