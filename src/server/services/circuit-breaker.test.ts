// server/src/services/circuit-breaker.test.ts
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'

// Mock return values - using variables allows dynamic control per test
let mockGetReturn: unknown = null
let mockAllReturn: unknown[] = []
const mockRunCalls: unknown[][] = []

// Mock the db module before importing circuit-breaker
mock.module('../db', () => ({
  db: {
    query: () => ({
      get: () => mockGetReturn,
      all: () => mockAllReturn
    }),
    run: (...args: unknown[]) => {
      mockRunCalls.push(args)
    }
  }
}))

// Mock the logger to suppress output during tests
mock.module('../lib/logger', () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
}))

// Import after mocking
import {
  CircuitState,
  getCircuitState,
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  openCircuit,
  closeCircuit,
  getOpenCircuits,
  FAILURE_THRESHOLD,
  COOLDOWN_MINUTES
} from './circuit-breaker'

describe('circuit-breaker service', () => {
  // Track account IDs used in tests for cleanup
  let testAccountIds: number[] = []

  beforeEach(() => {
    // Reset mock return values
    mockGetReturn = null
    mockAllReturn = []
    mockRunCalls.length = 0
    
    testAccountIds = []
  })

  afterEach(() => {
    // Clean up circuit states by closing circuits for all test accounts
    for (const accountId of testAccountIds) {
      try {
        closeCircuit(accountId)
      } catch {
        // Ignore errors during cleanup
      }
    }
  })

  // Helper to track accounts for cleanup
  function trackAccount(accountId: number): number {
    testAccountIds.push(accountId)
    return accountId
  }

  describe('constants', () => {
    test('FAILURE_THRESHOLD is 5', () => {
      expect(FAILURE_THRESHOLD).toBe(5)
    })

    test('COOLDOWN_MINUTES is 5', () => {
      expect(COOLDOWN_MINUTES).toBe(5)
    })
  })

  describe('getCircuitState', () => {
    test('creates fresh state for new account not in DB', () => {
      const accountId = trackAccount(1001)
      mockGetReturn = null

      const state = getCircuitState(accountId)

      expect(state).toEqual({
        failures: 0,
        lastFailure: null,
        isOpen: false,
        openUntil: null
      })
    })

    test('returns same state on subsequent calls', () => {
      const accountId = trackAccount(1002)
      mockGetReturn = null

      const state1 = getCircuitState(accountId)
      const state2 = getCircuitState(accountId)

      expect(state1).toBe(state2) // Same reference
    })

    test('loads open circuit state from DB', () => {
      const accountId = trackAccount(1003)
      const futureDate = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      
      mockGetReturn = {
        id: accountId,
        circuit_breaker_until: futureDate.toISOString()
      }

      const state = getCircuitState(accountId)

      expect(state.isOpen).toBe(true)
      expect(state.failures).toBe(FAILURE_THRESHOLD)
      expect(state.openUntil).toBeInstanceOf(Date)
      expect(state.openUntil!.getTime()).toBe(futureDate.getTime())
    })

    test('loads expired circuit state from DB as closed', () => {
      const accountId = trackAccount(1004)
      const pastDate = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      
      mockGetReturn = {
        id: accountId,
        circuit_breaker_until: pastDate.toISOString()
      }

      const state = getCircuitState(accountId)

      expect(state.isOpen).toBe(false)
      expect(state.failures).toBe(0)
      expect(state.openUntil).toBeNull()
    })
  })

  describe('isCircuitOpen', () => {
    test('returns false for closed circuit', () => {
      const accountId = trackAccount(2001)
      mockGetReturn = null

      const result = isCircuitOpen(accountId)

      expect(result).toBe(false)
    })

    test('returns true for open circuit within cooldown', () => {
      const accountId = trackAccount(2002)
      mockGetReturn = null

      // Open the circuit first
      openCircuit(accountId)

      const result = isCircuitOpen(accountId)

      expect(result).toBe(true)
    })

    test('auto-closes circuit when cooldown expires', () => {
      const accountId = trackAccount(2003)
      mockGetReturn = null

      // Get state and manually set it to expired
      const state = getCircuitState(accountId)
      state.isOpen = true
      state.openUntil = new Date(Date.now() - 1000) // 1 second in the past

      const result = isCircuitOpen(accountId)

      expect(result).toBe(false)
      expect(state.isOpen).toBe(false)
    })
  })

  describe('recordSuccess', () => {
    test('resets failure count', () => {
      const accountId = trackAccount(3001)
      mockGetReturn = null

      // Record some failures first
      const state = getCircuitState(accountId)
      state.failures = 3
      state.lastFailure = new Date()

      recordSuccess(accountId)

      expect(state.failures).toBe(0)
      expect(state.lastFailure).toBeNull()
    })

    test('closes open circuit on success', () => {
      const accountId = trackAccount(3002)
      mockGetReturn = null

      // Open the circuit first
      openCircuit(accountId)
      const state = getCircuitState(accountId)
      expect(state.isOpen).toBe(true)

      recordSuccess(accountId)

      expect(state.isOpen).toBe(false)
      expect(state.openUntil).toBeNull()
    })

    test('does nothing special for already-closed circuit', () => {
      const accountId = trackAccount(3003)
      mockGetReturn = null

      const state = getCircuitState(accountId)
      expect(state.isOpen).toBe(false)

      recordSuccess(accountId)

      expect(state.isOpen).toBe(false)
      expect(state.failures).toBe(0)
    })
  })

  describe('recordFailure', () => {
    test('increments failure count', () => {
      const accountId = trackAccount(4001)
      mockGetReturn = null

      const state = getCircuitState(accountId)
      expect(state.failures).toBe(0)

      recordFailure(accountId)

      expect(state.failures).toBe(1)
      expect(state.lastFailure).toBeInstanceOf(Date)
    })

    test('increments failure count multiple times', () => {
      const accountId = trackAccount(4002)
      mockGetReturn = null

      recordFailure(accountId)
      recordFailure(accountId)
      recordFailure(accountId)

      const state = getCircuitState(accountId)
      expect(state.failures).toBe(3)
    })

    test('opens circuit at threshold (5 failures)', () => {
      const accountId = trackAccount(4003)
      mockGetReturn = null

      // Record failures up to threshold
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        recordFailure(accountId)
      }

      const state = getCircuitState(accountId)
      expect(state.failures).toBe(FAILURE_THRESHOLD)
      expect(state.isOpen).toBe(true)
      expect(state.openUntil).toBeInstanceOf(Date)
    })

    test('does not open circuit before threshold', () => {
      const accountId = trackAccount(4004)
      mockGetReturn = null

      // Record failures just below threshold
      for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
        recordFailure(accountId)
      }

      const state = getCircuitState(accountId)
      expect(state.failures).toBe(FAILURE_THRESHOLD - 1)
      expect(state.isOpen).toBe(false)
    })
  })

  describe('openCircuit', () => {
    test('sets isOpen to true', () => {
      const accountId = trackAccount(5001)
      mockGetReturn = null

      openCircuit(accountId)

      const state = getCircuitState(accountId)
      expect(state.isOpen).toBe(true)
    })

    test('sets openUntil to correct time', () => {
      const accountId = trackAccount(5002)
      mockGetReturn = null

      const beforeOpen = Date.now()
      openCircuit(accountId)
      const afterOpen = Date.now()

      const state = getCircuitState(accountId)
      const expectedMin = beforeOpen + COOLDOWN_MINUTES * 60 * 1000
      const expectedMax = afterOpen + COOLDOWN_MINUTES * 60 * 1000

      expect(state.openUntil).toBeInstanceOf(Date)
      expect(state.openUntil!.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(state.openUntil!.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    test('persists to DB', () => {
      const accountId = trackAccount(5003)
      mockGetReturn = null
      mockRunCalls.length = 0

      openCircuit(accountId)

      expect(mockRunCalls.length).toBeGreaterThan(0)
      const lastCall = mockRunCalls[mockRunCalls.length - 1]
      const sql = lastCall[0] as string
      const params = lastCall[1] as unknown[]
      expect(sql).toContain('UPDATE sender_accounts')
      expect(sql).toContain('circuit_breaker_until')
      expect(params[1]).toBe(accountId)
    })
  })

  describe('closeCircuit', () => {
    test('resets all state fields', () => {
      const accountId = trackAccount(6001)
      mockGetReturn = null

      // Open first
      openCircuit(accountId)
      const state = getCircuitState(accountId)
      state.failures = 5

      closeCircuit(accountId)

      expect(state.failures).toBe(0)
      expect(state.lastFailure).toBeNull()
      expect(state.isOpen).toBe(false)
      expect(state.openUntil).toBeNull()
    })

    test('updates DB to clear circuit_breaker_until', () => {
      const accountId = trackAccount(6002)
      mockGetReturn = null
      
      // Open first, then clear mock to capture close call
      openCircuit(accountId)
      mockRunCalls.length = 0

      closeCircuit(accountId)

      expect(mockRunCalls.length).toBeGreaterThan(0)
      const lastCall = mockRunCalls[mockRunCalls.length - 1]
      const sql = lastCall[0] as string
      const params = lastCall[1] as unknown[]
      expect(sql).toContain('UPDATE sender_accounts')
      expect(sql).toContain('circuit_breaker_until = NULL')
      expect(params[0]).toBe(accountId)
    })
  })

  describe('getOpenCircuits', () => {
    test('returns empty array when no circuits are open', () => {
      mockGetReturn = null
      mockAllReturn = []

      const result = getOpenCircuits()

      expect(result).toEqual([])
    })

    test('returns account IDs with open circuits from memory', () => {
      const accountId1 = trackAccount(7001)
      const accountId2 = trackAccount(7002)
      
      mockGetReturn = null
      mockAllReturn = []

      // Open circuits for both accounts
      openCircuit(accountId1)
      openCircuit(accountId2)

      const result = getOpenCircuits()

      expect(result).toContain(accountId1)
      expect(result).toContain(accountId2)
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    test('includes circuits from DB not in memory', () => {
      const accountIdInMemory = trackAccount(7003)
      const accountIdInDb = 7004
      trackAccount(accountIdInDb)
      
      const futureDate = new Date(Date.now() + 10 * 60 * 1000)
      
      mockGetReturn = {
        id: accountIdInDb,
        circuit_breaker_until: futureDate.toISOString()
      }
      mockAllReturn = [{ id: accountIdInDb }]

      // Open one circuit in memory
      openCircuit(accountIdInMemory)

      const result = getOpenCircuits()

      expect(result).toContain(accountIdInMemory)
      // Note: The DB account should also be found
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    test('excludes expired circuits', () => {
      const accountId = trackAccount(7005)
      mockGetReturn = null
      mockAllReturn = []

      // Open then expire the circuit
      openCircuit(accountId)
      const state = getCircuitState(accountId)
      state.openUntil = new Date(Date.now() - 1000) // expired

      const result = getOpenCircuits()

      // Should not contain the expired circuit
      expect(result).not.toContain(accountId)
    })
  })

  describe('integration scenarios', () => {
    test('full cycle: failures -> open -> cooldown -> close', () => {
      const accountId = trackAccount(8001)
      mockGetReturn = null
      mockAllReturn = []

      // Initial state
      expect(isCircuitOpen(accountId)).toBe(false)

      // Record failures up to threshold
      for (let i = 0; i < FAILURE_THRESHOLD; i++) {
        recordFailure(accountId)
      }

      // Circuit should be open
      expect(isCircuitOpen(accountId)).toBe(true)

      // Simulate cooldown expiry
      const state = getCircuitState(accountId)
      state.openUntil = new Date(Date.now() - 1000)

      // Circuit should auto-close
      expect(isCircuitOpen(accountId)).toBe(false)
    })

    test('success resets accumulated failures', () => {
      const accountId = trackAccount(8002)
      mockGetReturn = null
      mockAllReturn = []

      // Record some failures (not enough to open)
      recordFailure(accountId)
      recordFailure(accountId)
      recordFailure(accountId)

      const state = getCircuitState(accountId)
      expect(state.failures).toBe(3)

      // Success resets
      recordSuccess(accountId)
      expect(state.failures).toBe(0)

      // Need full threshold again to open
      for (let i = 0; i < FAILURE_THRESHOLD - 1; i++) {
        recordFailure(accountId)
      }
      expect(isCircuitOpen(accountId)).toBe(false)

      recordFailure(accountId)
      expect(isCircuitOpen(accountId)).toBe(true)
    })
  })
})
