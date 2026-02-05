import { GoogleGenAI } from '@google/genai'
import { LLMProvider } from '../types'
import { logger } from '../../../lib/logger'

// Helper for timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const
  private apiKeys: string[]
  private currentKeyIndex = 0
  private model: string

  constructor(apiKey: string, model: string) {
    // Support comma-separated keys for rate limit handling
    this.apiKeys = apiKey.split(',').map(k => k.trim()).filter(Boolean)
    this.model = model
    
    if (this.apiKeys.length === 0) {
      throw new Error('No Gemini API key provided')
    }
  }

  private getNextKey(): string {
    const key = this.apiKeys[this.currentKeyIndex]
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length
    return key
  }

  async generateContent(prompt: string, systemPrompt: string): Promise<string> {
    let lastError: Error | null = null
    const keysToTry = this.apiKeys.length

    for (let attempt = 0; attempt < keysToTry; attempt++) {
      const apiKey = this.getNextKey()
      
      try {
        const genAI = new GoogleGenAI({ apiKey })
        
        const response = await withTimeout(
          genAI.models.generateContent({
            model: this.model,
            contents: prompt,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
              maxOutputTokens: 4096,
            }
          }),
          30000
        )

        const text = response.text?.trim() || ''
        
        if (!text) {
          throw new Error('Empty response from Gemini')
        }
        
        logger.info('Generated content with Gemini', { 
          service: 'llm', 
          provider: 'gemini',
          model: this.model 
        })

        return text
      } catch (error) {
        lastError = error as Error
        const errorMessage = lastError.message || ''
        
        // If rate limited, try next key
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
          logger.warn('Gemini rate limited, trying next key', { service: 'llm', provider: 'gemini', attempt })
          continue
        }
        
        throw error
      }
    }

    throw lastError || new Error('All Gemini API keys exhausted')
  }
}
