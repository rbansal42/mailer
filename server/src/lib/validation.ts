// server/src/lib/validation.ts
import { z } from 'zod'

// Email validation (RFC 5322 simplified)
export const emailSchema = z.string().email({ message: 'Invalid email format' })

export const emailArraySchema = z.array(emailSchema).default([])

// Template block schema
export const blockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['header', 'text', 'image', 'button', 'divider', 'spacer', 'columns', 'footer']),
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
  appPassword: z.string().min(1)
})

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  user: z.string().min(1),
  pass: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().optional()
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
export const createDraftSchema = z.object({
  name: z.string().min(1).max(200),
  templateId: z.number().int().positive().nullable().optional(),
  mailId: z.number().int().positive().nullable().optional(),
  subject: z.string().max(500).optional(),
  testEmail: z.string().max(1000).nullable().optional(),
  recipients: z.array(z.object({
    email: emailSchema,
    data: z.record(z.string(), z.string()).optional()
  })).optional(),
  variables: z.record(z.string(), z.string()).optional(),
  cc: emailArraySchema,
  bcc: emailArraySchema
})

export const updateDraftSchema = createDraftSchema.partial()

// Send schema - either templateId OR mailId must be provided
export const sendCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateId: z.number().int().positive().nullable().optional(),
  mailId: z.number().int().positive().nullable().optional(),
  subject: z.string().min(1).max(500),
  recipients: z.array(z.object({
    email: emailSchema,
    data: z.record(z.string(), z.string()).optional()
  })).min(1, { message: 'At least one recipient required' }),
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

// Validation helper
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}
