// server/src/lib/validation.ts
import { z } from 'zod'

// Email validation (RFC 5322 simplified)
export const emailSchema = z.string().email({ message: 'Invalid email format' })

export const emailArraySchema = z.array(emailSchema).default([])

// Template block schema
export const blockSchema = z.object({
  id: z.string(),
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

// Account schemas
export const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  provider_type: z.enum(['gmail', 'smtp']),
  config: z.object({
    email: z.string().email(),
    // Gmail
    appPassword: z.string().optional(),
    // SMTP
    host: z.string().optional(),
    port: z.number().optional(),
    secure: z.boolean().optional(),
    user: z.string().optional(),
    pass: z.string().optional(),
    fromName: z.string().optional()
  }),
  daily_cap: z.number().int().min(1).max(10000).default(500),
  campaign_cap: z.number().int().min(1).max(5000).default(100),
  priority: z.number().int().min(0).default(0)
})

// Draft schemas
export const createDraftSchema = z.object({
  name: z.string().min(1).max(200),
  template_id: z.number().int().positive().optional(),
  subject: z.string().max(500).optional(),
  recipients: z.string().optional(), // JSON string of recipients
  variables: z.string().optional(),  // JSON string
  cc: emailArraySchema,
  bcc: emailArraySchema
})

export const updateDraftSchema = createDraftSchema.partial()

// Send schema
export const sendCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template_id: z.number().int().positive(),
  subject: z.string().min(1).max(500),
  recipients: z.array(z.object({
    email: emailSchema,
    data: z.record(z.string(), z.string()).optional()
  })).min(1, { message: 'At least one recipient required' }),
  cc: emailArraySchema,
  bcc: emailArraySchema,
  scheduled_for: z.string().datetime().optional()
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
