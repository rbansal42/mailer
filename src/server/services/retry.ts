import { logger } from '../lib/logger'

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  retryableErrors: string[]
}

export const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', '5xx']
}

export interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
}

/**
 * Check if an error matches retryable patterns.
 * Matches by error code or by 5xx pattern in error message.
 */
export function isRetryableError(error: Error, config: RetryConfig): boolean {
  const errorCode = (error as Error & { code?: string }).code

  // Check if error code matches any retryable error
  if (errorCode && config.retryableErrors.includes(errorCode)) {
    return true
  }

  // Check for 5xx pattern in retryable errors
  if (config.retryableErrors.includes('5xx')) {
    // Match 5xx status codes in error message
    const has5xx = /\b5\d{2}\b/.test(error.message)
    if (has5xx) {
      return true
    }
  }

  return false
}

/**
 * Calculate delay for a given attempt using exponential backoff.
 * Returns baseDelay * 2^(attempt-1), capped at maxDelay.
 */
export function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.baseDelay * Math.pow(2, attempt - 1)
  return Math.min(delay, config.maxDelay)
}

/**
 * Execute an operation with retries using exponential backoff.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  config: RetryConfig
): Promise<RetryResult<T>> {
  let attempts = 0
  let lastError: Error | undefined

  while (attempts < config.maxAttempts) {
    attempts++

    try {
      const result = await operation()
      return {
        success: true,
        result,
        attempts
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      lastError = error

      // If not retryable, return immediately
      if (!isRetryableError(error, config)) {
        logger.warn('Non-retryable error, failing immediately', {
          service: 'retry',
          context,
          attempt: attempts
        }, error)
        return {
          success: false,
          error,
          attempts
        }
      }

      // If we've exhausted attempts, return failure
      if (attempts >= config.maxAttempts) {
        logger.error('Max retry attempts exhausted', {
          service: 'retry',
          context,
          maxAttempts: config.maxAttempts
        }, error)
        break
      }

      // Calculate delay and wait before retrying
      const delay = calculateDelay(attempts, config)
      logger.warn('Retryable error, will retry', {
        service: 'retry',
        context,
        attempt: attempts,
        nextAttemptIn: delay
      }, error)

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return {
    success: false,
    error: lastError,
    attempts
  }
}
