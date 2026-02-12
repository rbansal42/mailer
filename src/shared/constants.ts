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

/**
 * Sequence branch trigger types
 */
export const TRIGGER_ACTION_CLICK = 'action_click' as const
export const TRIGGER_OPENED = 'opened' as const
export const TRIGGER_CLICKED_ANY = 'clicked_any' as const
export const TRIGGER_NO_ENGAGEMENT = 'no_engagement' as const

export type TriggerType = typeof TRIGGER_ACTION_CLICK | typeof TRIGGER_OPENED | typeof TRIGGER_CLICKED_ANY | typeof TRIGGER_NO_ENGAGEMENT
