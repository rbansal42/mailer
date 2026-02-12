# Sequence Advanced Features - Design Document

## Issues Addressed
- #38: Sequence builder: visual flowchart UI
- #33: Sequence branching: multiple trigger conditions
- #40: Sequence actions: multiple buttons, different branches
- #39: Sequence actions: multiple buttons, same branch
- #53: LLM Sequence: Store generated blocks in sequence steps

## Current State

### Data Model
- `sequence_steps` has `branch_id` (null/action/default), `is_branch_point`, `branch_order`
- `sequence_enrollments` has `branch_id`, `action_clicked_at`, `branch_switched_at`
- `sequence_actions` records button clicks with `button_text`, destination info
- Branching is **binary only**: one action button per step, two branches (action/default)
- Content stored via `template_id` reference on steps -- blocks live in templates table
- AI-generated blocks are **discarded** after preview (only subject/timing saved)

### Known Gaps
- No `sequence_branches` table -- branches hardcoded as constants
- `processEnrollmentStep()` doesn't route non-clickers to "default" branch
- Only one action button supported per email
- No visual flowchart -- uses linear list with side-by-side branch columns

---

## Design

### 1. Database Changes

#### New table: `sequence_branches`
```sql
CREATE TABLE sequence_branches (
  id TEXT PRIMARY KEY,              -- e.g., 'main', 'interested-a', 'not-interested'
  sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- Display name: "Interested in Product A"
  description TEXT,
  color TEXT DEFAULT '#6366f1',     -- For flowchart visualization
  parent_branch_id TEXT,            -- Which branch this forks from
  trigger_step_id INTEGER REFERENCES sequence_steps(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'action_click',
    -- 'action_click': recipient clicked specific button
    -- 'opened': recipient opened N emails
    -- 'clicked_any': recipient clicked any link
    -- 'no_engagement': recipient didn't engage
  trigger_config JSONB DEFAULT '{}',
    -- For 'action_click': { "buttonId": "btn-1" }
    -- For 'opened': { "minOpens": 3 }
    -- For 'clicked_any': {}
    -- For 'no_engagement': { "afterSteps": 3 }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Modify `sequence_steps`
- Add `blocks JSONB` column to store email content directly (for #53)
- `branch_id` now references `sequence_branches(id)` instead of hardcoded constants
- Keep `template_id` as optional fallback (blocks on step take precedence)

#### Modify `sequence_enrollments`
- `branch_id` becomes TEXT referencing `sequence_branches(id)`
- Add `trigger_data JSONB` -- stores which button was clicked, engagement metrics

#### Modify `sequence_actions`
- Add `button_id TEXT` -- which specific button (for multi-button emails)
- Add `branch_target TEXT` -- which branch this click routes to

### 2. Multiple Buttons Architecture (#39, #40)

#### Same-Branch Buttons (#39)
Multiple buttons in one email, all routing to the same branch:
- Each button has a unique `buttonId` in its block props
- All buttons share the same `branch_target`
- `sequence_actions.button_id` records which specific button was clicked
- Analytics can segment by button preference

#### Different-Branch Buttons (#40)
Multiple buttons in one email, each routing to a different branch:
- Each button's `buttonId` maps to a different branch via `sequence_branches.trigger_config`
- When clicked, `recordAction()` looks up which branch the specific button targets
- Enrollment switches to that branch

#### Block Schema for Multi-Button Steps
```typescript
// action-button block props (extended)
{
  buttonId: string,           // unique within step, e.g. "btn-product-a"
  label: string,              // "Interested in Product A"
  color: string,
  align: string,
  branchTarget: string | null, // branch ID this button routes to (null = same branch for all)
  destinationType: 'hosted' | 'external',
  destinationUrl?: string,
  hostedMessage?: string,
}
```

### 3. Multiple Trigger Conditions (#33)

Beyond action clicks, branches can trigger on:
- **Opened N emails**: Track open count per enrollment, trigger when threshold met
- **Clicked any link**: Any link click (not just action buttons) triggers branch
- **No engagement**: After N steps with no opens/clicks, route to re-engagement branch

Trigger evaluation happens in `processEnrollmentStep()`:
1. After sending a step, check all branches triggered from the current step
2. For each branch, evaluate its `trigger_type` against enrollment data
3. First matching trigger wins (priority by branch order)

### 4. Visual Flowchart UI (#38)

**Library**: React Flow (reactflow) -- mature, well-maintained, React-native, supports custom nodes/edges.

**Node Types**:
- `emailNode`: Email step (subject, delay, preview)
- `branchNode`: Branch point (shows trigger condition)
- `endNode`: Sequence end marker

**Layout**: Dagre auto-layout (top-to-bottom), with manual drag override.

**Features**:
- Custom styled nodes matching shadcn/ui design system
- Animated edges showing flow direction
- Click node to edit step details in side panel
- Add nodes via toolbar or by clicking "+" on edges
- Branch points show condition labels on outgoing edges
- Minimap for large sequences
- Keep existing linear builder as "List View" toggle alternative

### 5. Store Generated Blocks (#53)

- Add `blocks JSONB` column to `sequence_steps`
- When AI generates a sequence, store blocks directly on steps
- At send time: use `step.blocks` if present, fall back to `template.blocks`
- Preview modal already renders blocks -- just need to persist them
- Step editor can later allow editing blocks inline

---

## Migration Strategy

Single migration file that:
1. Creates `sequence_branches` table
2. Adds `blocks` column to `sequence_steps`
3. Adds `button_id`, `branch_target` to `sequence_actions`
4. Adds `trigger_data` to `sequence_enrollments`
5. Migrates existing hardcoded branch data to `sequence_branches` rows

## Backward Compatibility

- Existing sequences with `branch_id = 'action'/'default'` are migrated to `sequence_branches` rows
- `template_id` remains functional (blocks on step take precedence)
- Binary branch sequences continue working
- Old constants (`BRANCH_ACTION`, `BRANCH_DEFAULT`) deprecated but kept for migration

## Implementation Phases

### Phase 1 (Tasks 1-5): Foundation
- Database migration + branch table
- Store blocks on steps (#53)
- Updated shared types and validation

### Phase 2 (Tasks 6-8): Multi-Button & Triggers
- Multiple action buttons in emails
- Multi-trigger conditions
- Updated sequence processor

### Phase 3 (Tasks 9-10): Visual Flowchart UI
- React Flow integration
- Custom nodes, edges, layout
- List/Flow view toggle
