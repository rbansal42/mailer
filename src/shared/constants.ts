/**
 * Shared constants for the Mailer application.
 * These constants are used across both client and server.
 */

/**
 * Sequence branch identifiers
 */
export const BRANCH_ACTION = 'action' as const
export const BRANCH_DEFAULT = 'default' as const

/**
 * Union type for all valid branch IDs
 */
export type BranchId = typeof BRANCH_ACTION | typeof BRANCH_DEFAULT | null
