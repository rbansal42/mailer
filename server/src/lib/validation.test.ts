// server/src/lib/validation.test.ts
import { describe, test, expect } from 'bun:test'
import { generateSequenceSchema, validate } from './validation'

describe('generateSequenceSchema', () => {
  describe('goal field', () => {
    test('rejects goal under 10 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'short',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('10 characters')
    })

    test('accepts goal at exactly 10 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: '1234567890', // exactly 10 chars
        emailCount: 3,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts goal over 10 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'Welcome new subscribers and introduce them to our product',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('rejects goal over 500 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'a'.repeat(501),
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('500')
    })

    test('accepts goal at exactly 500 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'a'.repeat(500),
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('emailCount field', () => {
    test('rejects emailCount below 3', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 2,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('3')
    })

    test('rejects emailCount above 7', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 8,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('7')
    })

    test('accepts emailCount at minimum (3)', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 3,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts emailCount at maximum (7)', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 7,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts emailCount in middle of range (5)', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('rejects non-integer emailCount', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5.5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('timing field', () => {
    test('accepts daily timing', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts every-few-days timing', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'every-few-days',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts weekly timing', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'weekly',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid timing value', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'hourly',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })

    test('rejects empty timing', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: '',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('tone field', () => {
    test('accepts professional tone', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('accepts friendly tone', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'friendly'
      })
      expect(result.success).toBe(true)
    })

    test('accepts casual tone', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'casual'
      })
      expect(result.success).toBe(true)
    })

    test('rejects invalid tone value', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'aggressive'
      })
      expect(result.success).toBe(false)
    })

    test('rejects empty tone', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: ''
      })
      expect(result.success).toBe(false)
    })
  })

  describe('additionalContext field', () => {
    test('allows missing additionalContext', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'weekly',
        tone: 'casual'
      })
      expect(result.success).toBe(true)
    })

    test('accepts valid additionalContext', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'Welcome new subscribers and introduce them to our product',
        emailCount: 5,
        timing: 'every-few-days',
        tone: 'friendly',
        additionalContext: 'Focus on our premium features'
      })
      expect(result.success).toBe(true)
    })

    test('accepts additionalContext at exactly 1000 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional',
        additionalContext: 'a'.repeat(1000)
      })
      expect(result.success).toBe(true)
    })

    test('rejects additionalContext over 1000 characters', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional',
        additionalContext: 'a'.repeat(1001)
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('1000')
    })

    test('accepts empty string for additionalContext', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily',
        tone: 'professional',
        additionalContext: ''
      })
      expect(result.success).toBe(true)
    })
  })

  describe('full validation scenarios', () => {
    test('accepts valid request with all fields', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'Welcome new subscribers and introduce them to our product',
        emailCount: 5,
        timing: 'every-few-days',
        tone: 'friendly',
        additionalContext: 'Focus on our premium features'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          goal: 'Welcome new subscribers and introduce them to our product',
          emailCount: 5,
          timing: 'every-few-days',
          tone: 'friendly',
          additionalContext: 'Focus on our premium features'
        })
      }
    })

    test('accepts valid request with minimum required fields', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 3,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(true)
    })

    test('rejects request with missing goal', () => {
      const result = validate(generateSequenceSchema, {
        emailCount: 5,
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })

    test('rejects request with missing emailCount', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        timing: 'daily',
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })

    test('rejects request with missing timing', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        tone: 'professional'
      })
      expect(result.success).toBe(false)
    })

    test('rejects request with missing tone', () => {
      const result = validate(generateSequenceSchema, {
        goal: 'A valid goal that is long enough',
        emailCount: 5,
        timing: 'daily'
      })
      expect(result.success).toBe(false)
    })

    test('rejects completely empty object', () => {
      const result = validate(generateSequenceSchema, {})
      expect(result.success).toBe(false)
    })

    test('rejects null input', () => {
      const result = validate(generateSequenceSchema, null)
      expect(result.success).toBe(false)
    })

    test('rejects undefined input', () => {
      const result = validate(generateSequenceSchema, undefined)
      expect(result.success).toBe(false)
    })
  })
})
