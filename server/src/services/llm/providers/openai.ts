import OpenAI from 'openai'
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

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new Error('No OpenAI API key provided')
    }
    
    this.client = new OpenAI({ apiKey })
    this.model = model
  }

  async generateContent(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await withTimeout(
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
        30000
      )

      const text = response.choices[0]?.message?.content?.trim() || ''
      
      if (!text) {
        throw new Error('Empty response from OpenAI')
      }
      
      logger.info('Generated content with OpenAI', { 
        service: 'llm', 
        provider: 'openai',
        model: this.model 
      })

      return text
    } catch (error) {
      const err = error as Error
      logger.error('OpenAI generation failed', { 
        service: 'llm', 
        provider: 'openai',
        error: err.message 
      })
      throw error
    }
  }
}
