import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import {
  RetryConfig,
  DEFAULT_CONFIG,
  isRetryableError,
  calculateDelay,
  withRetry
} from './retry'

describe('retry service', () => {
  describe('DEFAULT_CONFIG', () => {
    test('has correct default values', () => {
      expect(DEFAULT_CONFIG).toEqual({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', '5xx']
      })
    })
  })

  describe('isRetryableError', () => {
    test('returns true for ETIMEDOUT error', () => {
      const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for ECONNRESET error', () => {
      const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' })
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for ECONNREFUSED error', () => {
      const error = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' })
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for ENOTFOUND error', () => {
      const error = Object.assign(new Error('not found'), { code: 'ENOTFOUND' })
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for 5xx HTTP status in error message', () => {
      const error = new Error('Request failed with status 503')
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for 500 status', () => {
      const error = new Error('Internal Server Error: status 500')
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns true for 502 status', () => {
      const error = new Error('Bad Gateway: 502')
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(true)
    })

    test('returns false for non-retryable error', () => {
      const error = new Error('Invalid email address')
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(false)
    })

    test('returns false for 4xx errors', () => {
      const error = new Error('Request failed with status 400')
      expect(isRetryableError(error, DEFAULT_CONFIG)).toBe(false)
    })

    test('uses custom retryable errors when provided', () => {
      const customConfig: RetryConfig = {
        ...DEFAULT_CONFIG,
        retryableErrors: ['CUSTOM_ERROR']
      }
      const error = Object.assign(new Error('custom'), { code: 'CUSTOM_ERROR' })
      expect(isRetryableError(error, customConfig)).toBe(true)
    })
  })

  describe('calculateDelay', () => {
    test('returns baseDelay for first attempt', () => {
      expect(calculateDelay(1, DEFAULT_CONFIG)).toBe(1000)
    })

    test('returns baseDelay * 2 for second attempt', () => {
      expect(calculateDelay(2, DEFAULT_CONFIG)).toBe(2000)
    })

    test('returns baseDelay * 4 for third attempt', () => {
      expect(calculateDelay(3, DEFAULT_CONFIG)).toBe(4000)
    })

    test('caps delay at maxDelay', () => {
      const config: RetryConfig = {
        ...DEFAULT_CONFIG,
        baseDelay: 5000,
        maxDelay: 10000
      }
      // 5000 * 2^(3-1) = 5000 * 4 = 20000, but capped at 10000
      expect(calculateDelay(3, config)).toBe(10000)
    })

    test('uses custom baseDelay', () => {
      const config: RetryConfig = { ...DEFAULT_CONFIG, baseDelay: 500 }
      expect(calculateDelay(1, config)).toBe(500)
      expect(calculateDelay(2, config)).toBe(1000)
    })
  })

  describe('withRetry', () => {
    // Mock timers to speed up tests
    let originalSetTimeout: typeof setTimeout

    beforeEach(() => {
      originalSetTimeout = globalThis.setTimeout
      // Replace setTimeout to execute immediately
      globalThis.setTimeout = ((fn: () => void) => {
        fn()
        return 0
      }) as unknown as typeof setTimeout
    })

    afterEach(() => {
      globalThis.setTimeout = originalSetTimeout
    })

    test('returns success result on first attempt when operation succeeds', async () => {
      const operation = async () => 'success value'

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      expect(result).toEqual({
        success: true,
        result: 'success value',
        attempts: 1
      })
    })

    test('retries on retryable error and succeeds', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 3) {
          throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
        }
        return 'recovered'
      }

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      expect(result).toEqual({
        success: true,
        result: 'recovered',
        attempts: 3
      })
    })

    test('returns failure after max attempts exhausted', async () => {
      const operation = async () => {
        throw Object.assign(new Error('persistent timeout'), { code: 'ETIMEDOUT' })
      }

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('persistent timeout')
      expect(result.attempts).toBe(3)
    })

    test('does not retry non-retryable errors', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        throw new Error('validation error')
      }

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(attempts).toBe(1)
    })

    test('uses custom maxAttempts', async () => {
      const customConfig: RetryConfig = { ...DEFAULT_CONFIG, maxAttempts: 5 }
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 5) {
          throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })
        }
        return 'success after 5'
      }

      const result = await withRetry(operation, 'test-context', customConfig)

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(5)
    })

    test('preserves result type', async () => {
      const operation = async () => ({ id: 123, name: 'test' })

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      expect(result.success).toBe(true)
      expect(result.result).toEqual({ id: 123, name: 'test' })
    })

    test('handles synchronous errors in async operation', async () => {
      const operation = async () => {
        throw Object.assign(new Error('sync error'), { code: 'ECONNREFUSED' })
      }

      const result = await withRetry(operation, 'test-context', DEFAULT_CONFIG)

      // Should retry because ECONNREFUSED is retryable
      expect(result.attempts).toBe(3)
    })
  })
})
