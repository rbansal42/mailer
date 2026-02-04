# Sequence Branching with Action Buttons

**Date:** 2026-02-04  
**Status:** Ready for implementation

## Overview

Enable email sequences to branch based on recipient actions. Recipients who click an action button (e.g., "I'm interested") are moved to a different email path, while others continue on the default path.

## Core Concepts

### Action Button
A trackable link/button that captures recipient intent with one click and triggers sequence branching.

**Two ways to add:**
1. Mark any existing link as an "action trigger" (checkbox in link settings)
2. Use a dedicated "Action Button" block (pre-styled, clearly labeled in editor)

**Configuration:**
- Button text (e.g., "Yes, tell me more", "Get the discount")
- Destination: external URL OR hosted thank-you page
- If hosted page: configurable thank-you message text

**Constraints (v1):**
- One action button per email
- Only explicit clicks trigger branching (not opens or other engagement)

### Branching Structure

Single sequence with two paths:

```
Step 1: Initial email (with action button)
   ↓ (wait 2 days)
Step 2: Follow-up email (with action button)
   ↓ (wait 3 days)
Step 3: [BRANCH POINT]
   │
   ├─ (no action clicked) ──→ Default Path
   │                          Step 4a: "Still interested?"
   │                          Step 5a: Final follow-up
   │
   └─ (action clicked) ─────→ Action Path
                              Step 4b: "Thanks for your interest"
                              Step 5b: Product details
                              Step 6b: Case study
```

**Branch point behavior:**
- Placed after one or more emails containing action buttons
- Checks: "Did this person click an action button in any previous step?"
- Yes → route to action-taken path
- No → continue on default path

**Timing:**
- Configurable delay before switching branches (default: immediate)
- Immediate = cancel pending scheduled email, start new branch right away
- Each branch has independent timing/delays after the split

## Database Schema

### Modified: `sequence_steps`

```sql
ALTER TABLE sequence_steps ADD COLUMN branch_id TEXT;          -- NULL = main, 'interested' = action path
ALTER TABLE sequence_steps ADD COLUMN branch_point INTEGER;    -- 1 if this is where split happens
ALTER TABLE sequence_steps ADD COLUMN branch_order INTEGER;    -- Order within the branch
```

### Modified: `sequence_enrollments`

```sql
ALTER TABLE sequence_enrollments ADD COLUMN branch_id TEXT;           -- Current branch
ALTER TABLE sequence_enrollments ADD COLUMN action_clicked_at TEXT;   -- When action was clicked
ALTER TABLE sequence_enrollments ADD COLUMN branch_switched_at TEXT;  -- When moved to new branch
```

### New: `sequence_actions`

```sql
CREATE TABLE sequence_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  enrollment_id INTEGER NOT NULL,
  clicked_at TEXT NOT NULL,
  destination_type TEXT NOT NULL,        -- 'external' or 'hosted'
  destination_url TEXT,                  -- External URL if applicable
  hosted_message TEXT,                   -- Thank-you message if hosted
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sequence_id) REFERENCES sequences(id),
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id),
  FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id)
);
```

### Modified: `tracking_events`

Add 'action' to event_type enum: `'open' | 'click' | 'action'`

## API Endpoints

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/t/:token/action` | Action button click handler |
| GET | `/api/sequences/:id/actions` | List action clicks |
| GET | `/api/sequences/:id/actions/export` | Export as CSV |

### Action Click Handler (`GET /t/:token/action`)

```
1. Validate token, get enrollment
2. Record in sequence_actions table
3. Set enrollment.action_clicked_at = now()
4. If delay = 0 (immediate):
   - Set branch_id = 'interested'
   - Set branch_switched_at = now()
   - Cancel pending scheduled email (clear next_send_at, recalculate)
5. Return hosted thank-you page OR redirect to external URL
```

### Modified: `processSequenceSteps()` Scheduler

```
For each enrollment due to receive next email:
  1. Check if action_clicked_at is set AND branch_id is still NULL
     → If configured delay has passed:
       - Set branch_id = 'interested'
       - Recalculate next step based on new branch
  
  2. Get next step for current branch_id
  3. Send email
  4. Update enrollment (current_step, next_send_at)
```

## Frontend UI

### Sequence Builder

Linear list with branch sections:

```
┌─────────────────────────────────────────────┐
│ Product Interest Sequence                   │
├─────────────────────────────────────────────┤
│ ┌─ MAIN PATH ─────────────────────────────┐ │
│ │ 1. Initial Outreach        [Edit] [Del] │ │
│ │    Wait 2 days                          │ │
│ │ 2. First Follow-up         [Edit] [Del] │ │
│ │    Wait 3 days                          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ◆ BRANCH POINT ──────────────────────────── │
│   If action clicked → switch to Action Path │
│   Delay before switch: [Immediate ▼]        │
│                                             │
│ ┌─ DEFAULT PATH (no action) ──────────────┐ │
│ │ 3. "Still interested?"     [Edit] [Del] │ │
│ │    Wait 3 days                          │ │
│ │ 4. Final follow-up         [Edit] [Del] │ │
│ │                        [+ Add Step]     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ ACTION PATH (clicked) ─────────────────┐ │
│ │ 3. "Thanks for interest"   [Edit] [Del] │ │
│ │    Wait 2 days                          │ │
│ │ 4. Product details         [Edit] [Del] │ │
│ │                        [+ Add Step]     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│              [+ Add Branch Point]           │
└─────────────────────────────────────────────┘
```

### Email Editor

**Action Button block:**
- New block type in the block picker
- Settings panel: button text, style, destination type, URL/message

**Mark link as action:**
- In link settings modal: checkbox "Use as action trigger"
- Shows destination config when checked

### Hosted Thank-You Page

Simple page at `/t/:token/action`:
- Displays configured thank-you message
- Clean, minimal styling matching mailer branding
- No additional actions (v1)

## Analytics

### Campaign Analytics (extended)

Add "Action Taken" metric alongside Opens and Clicks:

```
Engagement
─────────────────────────
Delivered    1,245   100%
Opened         623    50%
Clicked        312    25%
Action Taken   187    15%  ← NEW
```

### Sequence Stats

On sequence detail page:

```
Enrollments by Path
─────────────────────────
Total enrolled:     500
On default path:    320  (64%)
On action path:     145  (29%)
Completed:           35   (7%)
```

### Export

- Button: "Export Action Clicks" on sequence page
- CSV columns: `email, name, clicked_at, from_step, action_button_text`
- Optional date range filter

## Future Enhancements (GitHub Issues)

| Issue | Feature |
|-------|---------|
| #33 | Multiple trigger conditions (opens, any click, no engagement) |
| #34 | Engagement scoring for branch decisions |
| #35 | Confirmation page: auto-redirect option |
| #36 | Confirmation page: CTA button |
| #38 | Visual flowchart sequence builder |
| #39 | Multiple action buttons, same branch |
| #40 | Multiple action buttons, different branches |
| #41 | Dedicated sequence funnel analytics dashboard |
| #42 | LLM-assisted sequence flow creation |

## Implementation Notes

- Reuses existing tracking infrastructure (tokens, events)
- Extends existing sequence system (minimal new tables)
- Action clicks recorded as tracking events for consistency
- Branch switching is atomic (no partial state)
