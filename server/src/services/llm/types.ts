// LLM Provider Types

export type LLMProviderId = 'gemini' | 'openai' | 'anthropic'

export interface LLMProviderConfig {
  id: LLMProviderId
  apiKey: string
  model: string
  enabled: boolean
}

export interface LLMProviderInfo {
  id: LLMProviderId
  name: string
  models: LLMModelInfo[]
  envVar: string
}

export interface LLMModelInfo {
  id: string
  name: string
  description?: string
}

// Provider definitions with curated models
export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    envVar: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
      { id: 'gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro', description: 'Most capable' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation' },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
    ]
  }
]

// Input/Output types for sequence generation
export interface GenerateSequenceInput {
  goal: string
  emailCount: number
  timing: 'daily' | 'every-few-days' | 'weekly'
  tone: 'professional' | 'friendly' | 'casual'
  additionalContext?: string
}

export interface GeneratedEmail {
  subject: string
  delayDays: number
  blocks: Array<{
    type: string
    id: string
    props: Record<string, unknown>
  }>
}

export interface GenerateSequenceOutput {
  name: string
  emails: GeneratedEmail[]
}

// LLM Provider Interface
export interface LLMProvider {
  id: LLMProviderId
  generateContent(prompt: string, systemPrompt: string): Promise<string>
}

// Stored settings types (for database)
export interface StoredLLMProvider {
  id: LLMProviderId
  apiKey: string  // encrypted
  model: string
  enabled: boolean
}

export interface LLMSettings {
  providers: StoredLLMProvider[]
  activeProvider: LLMProviderId | null
}
