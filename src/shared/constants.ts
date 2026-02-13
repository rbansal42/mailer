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

export const TRIGGER_TYPES = [TRIGGER_ACTION_CLICK, TRIGGER_OPENED, TRIGGER_CLICKED_ANY, TRIGGER_NO_ENGAGEMENT] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

/**
 * Human-readable labels and descriptions for each trigger type.
 * Used in UI components for branch condition editors and badge displays.
 */
export const TRIGGER_LABELS: Record<string, { label: string; description: string }> = {
  action_click: { label: 'Action Button Click', description: 'Recipient clicked a specific action button' },
  opened: { label: 'Opened Emails', description: 'Recipient opened a minimum number of emails' },
  clicked_any: { label: 'Clicked Any Link', description: 'Recipient clicked any link in an email' },
  no_engagement: { label: 'No Engagement', description: 'Recipient has not engaged after N steps' },
}
