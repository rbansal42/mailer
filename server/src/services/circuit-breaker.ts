import { queryAll, queryOne, execute } from '../db'
import { logger } from '../lib/logger'

// Constants
const FAILURE_THRESHOLD = 5
const COOLDOWN_MINUTES = 5

// CircuitState interface
export interface CircuitState {
  failures: number
  lastFailure: Date | null
  isOpen: boolean
  openUntil: Date | null
}

// In-memory state map for per-account circuit state
const circuitStates = new Map<number, CircuitState>()

interface AccountRow {
  id: number
  circuit_breaker_until: string | null
}

/**
 * Get or create circuit state for an account.
 * Loads from DB if exists and not in memory.
 */
export async function getCircuitState(accountId: number): Promise<CircuitState> {
  // Check memory first
  let state = circuitStates.get(accountId)
  
  if (!state) {
    // Initialize from DB if circuit breaker is set
    const row = await queryOne<AccountRow>('SELECT id, circuit_breaker_until FROM sender_accounts WHERE id = ?', [accountId])
    
    if (row?.circuit_breaker_until) {
      const openUntil = new Date(row.circuit_breaker_until)
      const now = new Date()
      
      state = {
        failures: openUntil > now ? FAILURE_THRESHOLD : 0,
        lastFailure: openUntil > now ? new Date(openUntil.getTime() - COOLDOWN_MINUTES * 60 * 1000) : null,
        isOpen: openUntil > now,
        openUntil: openUntil > now ? openUntil : null
      }
    } else {
      // Create fresh state
      state = {
        failures: 0,
        lastFailure: null,
        isOpen: false,
        openUntil: null
      }
    }
    
    circuitStates.set(accountId, state)
  }
  
  return state
}

/**
 * Check if circuit is open for an account.
 * Handles cooldown expiry automatically.
 */
export async function isCircuitOpen(accountId: number): Promise<boolean> {
  const state = await getCircuitState(accountId)
  
  if (!state.isOpen) {
    return false
  }
  
  // Check if cooldown has expired
  if (state.openUntil && new Date() >= state.openUntil) {
    // Cooldown expired, close the circuit
    await closeCircuit(accountId)
    return false
  }
  
  return true
}

/**
 * Record a successful send for an account.
 * Resets failures and closes circuit if open.
 */
export async function recordSuccess(accountId: number): Promise<void> {
  const state = await getCircuitState(accountId)
  
  // Reset failures on success
  state.failures = 0
  state.lastFailure = null
  
  // Close circuit if it was open
  if (state.isOpen) {
    await closeCircuit(accountId)
  }
}

/**
 * Record a failure for an account.
 * Opens circuit if threshold is reached.
 */
export async function recordFailure(accountId: number): Promise<void> {
  const state = await getCircuitState(accountId)
  
  state.failures++
  state.lastFailure = new Date()
  
  logger.warn('Account send failure recorded', {
    service: 'circuit-breaker',
    accountId,
    failures: state.failures,
    threshold: FAILURE_THRESHOLD
  })
  
  // Open circuit if threshold reached
  if (state.failures >= FAILURE_THRESHOLD) {
    await openCircuit(accountId)
  }
}

/**
 * Open the circuit for an account.
 * Sets openUntil, persists to DB, and logs warning.
 */
export async function openCircuit(accountId: number): Promise<void> {
  const state = await getCircuitState(accountId)
  const openUntil = new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000)
  
  state.isOpen = true
  state.openUntil = openUntil
  
  // Persist to DB
  await execute(
    'UPDATE sender_accounts SET circuit_breaker_until = ? WHERE id = ?',
    [openUntil.toISOString(), accountId]
  )
  
  logger.warn('Circuit breaker opened for account', {
    service: 'circuit-breaker',
    accountId,
    failures: state.failures,
    openUntil: openUntil.toISOString(),
    cooldownMinutes: COOLDOWN_MINUTES
  })
}

/**
 * Close the circuit for an account.
 * Clears state, updates DB, and logs info.
 */
export async function closeCircuit(accountId: number): Promise<void> {
  const state = await getCircuitState(accountId)
  
  state.failures = 0
  state.lastFailure = null
  state.isOpen = false
  state.openUntil = null
  
  // Clear in DB
  await execute(
    'UPDATE sender_accounts SET circuit_breaker_until = NULL WHERE id = ?',
    [accountId]
  )
  
  logger.info('Circuit breaker closed for account', {
    service: 'circuit-breaker',
    accountId
  })
}

/**
 * Get list of account IDs with open circuits.
 */
export async function getOpenCircuits(): Promise<number[]> {
  const openAccountIds: number[] = []
  
  // Check in-memory states
  for (const [accountId, state] of circuitStates) {
    if (state.isOpen && state.openUntil && new Date() < state.openUntil) {
      openAccountIds.push(accountId)
    }
  }
  
  // Also check DB for any accounts with circuit_breaker_until set
  // that might not be in memory yet
  const rows = await queryAll<{ id: number }>('SELECT id FROM sender_accounts WHERE circuit_breaker_until IS NOT NULL AND circuit_breaker_until > NOW()')
  
  for (const row of rows) {
    if (!openAccountIds.includes(row.id)) {
      // Verify it's actually open (this will load it into memory)
      if (await isCircuitOpen(row.id)) {
        openAccountIds.push(row.id)
      }
    }
  }
  
  return openAccountIds
}

// Export constants for testing
export { FAILURE_THRESHOLD, COOLDOWN_MINUTES }
