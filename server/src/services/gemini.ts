import { GoogleGenAI } from '@google/genai'
import { logger } from '../lib/logger'

// Parse comma-separated API keys
const GEMINI_API_KEYS = process.env.GEMINI_API_KEY?.split(',').map(k => k.trim()).filter(Boolean) || []
let currentKeyIndex = 0

function getNextKey(): string {
  if (GEMINI_API_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured')
  }
  const key = GEMINI_API_KEYS[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length
  return key
}

const SYSTEM_PROMPT = `You are an email sequence generator. Generate a JSON array of emails for an email marketing sequence.

STRICT RULES:
1. Output ONLY valid JSON - no markdown, no explanation, no code fences
2. Use ONLY these block types: "text", "action-button", "button", "spacer", "divider"
3. DO NOT invent block types like "header", "footer", "image", "cta"
4. For headings, use "text" block with <h1>, <h2> tags in content
5. For calls-to-action, use "action-button" (tracks clicks, can trigger branch) or "button" (simple link)
6. Keep email content professional and concise
7. Each email should have 3-6 blocks

BLOCK SCHEMAS:
- text: { "type": "text", "id": "<unique-id>", "props": { "content": "<p>HTML content here</p>" } }
- action-button: { "type": "action-button", "id": "<unique-id>", "props": { "text": "Button Text", "url": "", "style": "filled" } }
- button: { "type": "button", "id": "<unique-id>", "props": { "text": "Button Text", "url": "https://example.com", "style": "filled" } }
- spacer: { "type": "spacer", "id": "<unique-id>", "props": { "height": 20 } }
- divider: { "type": "divider", "id": "<unique-id>", "props": {} }

OUTPUT FORMAT (JSON only, no markdown):
{
  "name": "Sequence Name",
  "emails": [
    {
      "subject": "Email subject line",
      "delayDays": 0,
      "blocks": [...]
    }
  ]
}`

interface GenerateSequenceInput {
  goal: string
  emailCount: number
  timing: 'daily' | 'every-few-days' | 'weekly'
  tone: 'professional' | 'friendly' | 'casual'
  additionalContext?: string
}

interface GeneratedEmail {
  subject: string
  delayDays: number
  blocks: Array<{
    type: string
    id: string
    props: Record<string, unknown>
  }>
}

interface GenerateSequenceOutput {
  name: string
  emails: GeneratedEmail[]
}

export async function generateSequence(input: GenerateSequenceInput): Promise<GenerateSequenceOutput> {
  const timingMap = {
    'daily': 'Send emails daily (1 day apart)',
    'every-few-days': 'Send emails every 2-3 days',
    'weekly': 'Send emails weekly (7 days apart)'
  }

  const userPrompt = `Generate an email sequence with the following requirements:

Goal: ${input.goal}
Number of emails: ${input.emailCount}
Timing: ${timingMap[input.timing]}
Tone: ${input.tone}
${input.additionalContext ? `Additional context: ${input.additionalContext}` : ''}

Generate exactly ${input.emailCount} emails. Set delayDays based on the timing preference (first email should have delayDays: 0).`

  let lastError: Error | null = null
  const keysToTry = GEMINI_API_KEYS.length

  for (let attempt = 0; attempt < keysToTry; attempt++) {
    const apiKey = getNextKey()
    
    try {
      const genAI = new GoogleGenAI({ apiKey })
      
      const response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      })

      const text = response.text?.trim() || ''
      
      // Try to parse JSON, handling potential markdown code fences
      let jsonText = text
      if (text.startsWith('```')) {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (match) {
          jsonText = match[1].trim()
        }
      }

      const parsed = JSON.parse(jsonText) as GenerateSequenceOutput
      
      // Validate structure
      if (!parsed.name || !Array.isArray(parsed.emails)) {
        throw new Error('Invalid response structure')
      }

      logger.info('Generated sequence with Gemini', { 
        service: 'gemini', 
        emailCount: parsed.emails.length 
      })

      return parsed
    } catch (error) {
      lastError = error as Error
      const errorMessage = lastError.message || ''
      
      // If rate limited, try next key
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        logger.warn('Gemini rate limited, trying next key', { service: 'gemini', attempt })
        continue
      }
      
      // If JSON parse error, retry once with same key
      if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        logger.warn('Gemini returned invalid JSON, retrying', { service: 'gemini' })
        continue
      }
      
      // Other errors, throw immediately
      throw error
    }
  }

  throw lastError || new Error('All Gemini API keys exhausted')
}
