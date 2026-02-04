import Anthropic from '@anthropic-ai/sdk'
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

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new Error('No Anthropic API key provided')
    }
    
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async generateContent(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await withTimeout(
        this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: prompt }
          ],
        }),
        30000
      )

      // Extract text from content blocks
      const textBlock = response.content.find(block => block.type === 'text')
      const text = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''
      
      if (!text) {
        throw new Error('Empty response from Anthropic')
      }
      
      logger.info('Generated content with Anthropic', { 
        service: 'llm', 
        provider: 'anthropic',
        model: this.model 
      })

      return text
    } catch (error) {
      const err = error as Error
      logger.error('Anthropic generation failed', { 
        service: 'llm', 
        provider: 'anthropic',
        error: err.message 
      })
      throw error
    }
  }
}
