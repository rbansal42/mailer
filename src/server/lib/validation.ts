import { z } from 'zod'
import { TRIGGER_TYPES } from '../../shared/constants'

// Email validation (RFC 5322 simplified)
export const emailSchema = z.string().email({ message: 'Invalid email format' })

export const emailArraySchema = z.array(emailSchema).default([])

// Template block schema
export const blockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['header', 'text', 'image', 'button', 'divider', 'spacer', 'columns', 'footer', 'action-button']),
  props: z.record(z.string(), z.unknown())
})

// Template schemas
export const createTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(200),
  description: z.string().max(1000).optional(),
  blocks: z.array(blockSchema).default([])
})

export const updateTemplateSchema = createTemplateSchema.partial()

// Mail schemas
export const createMailSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }).max(200),
  description: z.string().max(1000).nullable().optional(),
  blocks: z.array(blockSchema).default([]),
  templateId: z.number().int().positive().nullable().optional(),
  status: z.enum(['draft', 'sent', 'archived']).default('draft')
})

export const updateMailSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  blocks: z.array(blockSchema).optional(),
  status: z.enum(['draft', 'sent', 'archived']).optional()
})

export const saveAsTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional()
})

// Provider-specific config schemas
const gmailConfigSchema = z.object({
  email: z.string().email(),
  appPassword: z.string().min(1),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
})

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
})

// Account schemas
export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  providerType: z.enum(['gmail', 'smtp']),
  config: z.union([gmailConfigSchema, smtpConfigSchema]),
  dailyCap: z.number().int().min(1).max(10000).default(500),
  campaignCap: z.number().int().min(1).max(5000).default(100),
  priority: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true)
})

// Draft schemas
// Flat recipient schema for drafts (email + any additional fields)
const draftRecipientSchema = z.object({
  email: emailSchema,
}).passthrough()

export const createDraftSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.number().int().positive().nullable().optional(),
  mailId: z.number().int().positive().nullable().optional(),
  listId: z.number().int().positive().nullable().optional(),
  subject: z.string().max(500).optional(),
  testEmail: z.string().max(1000).nullable().optional(),
  recipients: z.array(draftRecipientSchema).optional(),
  recipientsText: z.string().nullable().optional(),
  variables: z.record(z.string(), z.string()).optional(),
  cc: emailArraySchema,
  bcc: emailArraySchema
})

export const updateDraftSchema = createDraftSchema.partial()

// Recipient schema - flat structure with email and any additional string fields
const recipientSchema = z.object({
  email: emailSchema,
}).passthrough() // Allow additional string fields like name, firstname, etc.

// Send schema - either templateId OR mailId must be provided
export const sendCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: z.number().int().positive().nullable().optional(),
  mailId: z.number().int().positive().nullable().optional(),
  subject: z.string().min(1).max(500),
  recipients: z.array(recipientSchema).min(1, { message: 'At least one recipient required' }),
  cc: emailArraySchema,
  bcc: emailArraySchema,
  scheduledFor: z.string().datetime().optional()
}).refine(data => data.templateId || data.mailId, {
  message: 'Either templateId or mailId must be provided'
})

// Contact schemas
export const contactSchema = z.object({
  email: emailSchema,
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  custom_fields: z.record(z.string(), z.string()).optional(),
})

export const createContactSchema = contactSchema

export const updateContactSchema = contactSchema.partial().omit({ email: true })

// List schemas
export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required'),
  description: z.string().optional(),
})

export const updateListSchema = createListSchema.partial()

// Add contacts to list schema
export const addContactsToListSchema = z.object({
  contacts: z.array(contactSchema).min(1, 'At least one contact required'),
})

// Import CSV schema
export const importCsvSchema = z.object({
  csv: z.string().min(1, 'CSV data is required'),
  mapping: z.record(z.string(), z.string()).optional(),
})

export type Contact = z.infer<typeof contactSchema>
export type CreateList = z.infer<typeof createListSchema>
export type UpdateList = z.infer<typeof updateListSchema>

// Google Sheets integration schemas
export const googleSheetsCredentialsSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  redirectUri: z.string().url().optional(),
})

export const googleSheetsColumnMappingSchema = z.object({
  email: z.string().min(1, 'Email column mapping is required'),
  name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
})

export const googleSheetsSyncConfigSchema = z.object({
  spreadsheetId: z.string().min(1, 'Spreadsheet ID or URL is required'),
  sheetRange: z.string().optional(),
  columnMapping: googleSheetsColumnMappingSchema,
  autoSync: z.boolean().default(false),
  syncFrequency: z.enum(['manual', 'hourly', 'daily']).default('manual'),
})

export type GoogleSheetsCredentials = z.infer<typeof googleSheetsCredentialsSchema>
export type GoogleSheetsColumnMapping = z.infer<typeof googleSheetsColumnMappingSchema>
export type GoogleSheetsSyncConfig = z.infer<typeof googleSheetsSyncConfigSchema>

// Sequence generation schema
export const generateSequenceSchema = z.object({
  goal: z.string().min(10, 'Goal must be at least 10 characters').max(500, 'Goal must be under 500 characters'),
  emailCount: z.number().int().min(3, 'Minimum 3 emails').max(7, 'Maximum 7 emails'),
  timing: z.enum(['daily', 'every-few-days', 'weekly']),
  tone: z.enum(['professional', 'friendly', 'casual']),
  additionalContext: z.string().max(1000, 'Additional context must be under 1000 characters').optional(),
})

export type GenerateSequenceInput = z.infer<typeof generateSequenceSchema>

// Branch schemas
export const createBranchSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentBranchId: z.string().optional(),
  triggerStepId: z.number().int().positive().optional(),
  triggerType: z.enum(TRIGGER_TYPES),
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
})

export const updateBranchSchema = createBranchSchema.partial().omit({ id: true })

// Bulk operations schema
export const bulkIdsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required').max(100, 'Maximum 100 items per bulk operation'),
})

// Validation helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}
