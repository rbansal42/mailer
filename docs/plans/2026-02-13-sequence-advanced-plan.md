# Sequence Advanced Features - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual flowchart builder, multiple trigger conditions, multi-button actions, and store AI-generated blocks in sequence steps.

**Architecture:** Extend the sequence data model with a `sequence_branches` table and `blocks` column on steps. Replace the binary branch model with dynamic multi-branch support. Add React Flow-based visual builder alongside existing list view.

**Tech Stack:** PostgreSQL, Express, React, TypeScript, React Flow, shadcn/ui, Zod

---

## Task 1: Database Migration & Branch Table

**Files:**
- Create: `src/server/db/migrations/005_sequence_advanced.sql`
- Modify: `src/server/db/schema.ts` (add sequence_branches table, blocks column)
- Modify: `src/server/db/migrations.ts` (register new migration)

**What to build:**

1. Create migration SQL file `src/server/db/migrations/005_sequence_advanced.sql`:

```sql
-- Add blocks column to sequence_steps for storing email content directly
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS blocks JSONB;

-- Add button tracking columns to sequence_actions
ALTER TABLE sequence_actions ADD COLUMN IF NOT EXISTS button_id TEXT;
ALTER TABLE sequence_actions ADD COLUMN IF NOT EXISTS branch_target TEXT;

-- Add trigger data to enrollments
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS trigger_data JSONB;

-- Create sequence_branches table
CREATE TABLE IF NOT EXISTS sequence_branches (
  id TEXT NOT NULL,
  sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  parent_branch_id TEXT,
  trigger_step_id INTEGER REFERENCES sequence_steps(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'action_click',
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, sequence_id)
);

-- Index for branch lookups
CREATE INDEX IF NOT EXISTS idx_sequence_branches_sequence ON sequence_branches(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_branches_trigger_step ON sequence_branches(trigger_step_id);

-- Migrate existing branch data: for each sequence that has branch steps,
-- create 'default' and 'action' branch records
INSERT INTO sequence_branches (id, sequence_id, name, trigger_type, trigger_config, color)
SELECT DISTINCT 'action', s.sequence_id, 'Action Path', 'action_click', '{}', '#10b981'
FROM sequence_steps s WHERE s.branch_id = 'action'
ON CONFLICT DO NOTHING;

INSERT INTO sequence_branches (id, sequence_id, name, trigger_type, trigger_config, color)
SELECT DISTINCT 'default', s.sequence_id, 'Default Path', 'no_engagement', '{}', '#6366f1'
FROM sequence_steps s WHERE s.branch_id = 'default'
ON CONFLICT DO NOTHING;
```

2. Add the migration to `src/server/db/migrations.ts` -- follow the existing pattern of column migration checks and table creation. The migration runner reads SQL files from the migrations directory.

3. Update `src/server/db/schema.ts`:
   - Add `sequence_branches` table definition in the `createTables` function
   - Add `blocks JSONB` to the `sequence_steps` CREATE TABLE
   - Add `button_id TEXT`, `branch_target TEXT` to `sequence_actions`
   - Add `trigger_data JSONB` to `sequence_enrollments`

**Verification:** Run `bun run build` to verify no type errors. The migration will auto-run on server start.

---

## Task 2: Shared Types & Constants Update

**Files:**
- Modify: `src/shared/types.ts` (add SequenceBranch interface, update existing types)
- Modify: `src/shared/constants.ts` (add trigger types)
- Modify: `src/server/lib/validation.ts` (add branch and multi-button schemas)

**What to build:**

1. In `src/shared/types.ts`, add:

```typescript
export interface SequenceBranch {
  id: string
  sequence_id: number
  name: string
  description: string | null
  color: string
  parent_branch_id: string | null
  trigger_step_id: number | null
  trigger_type: 'action_click' | 'opened' | 'clicked_any' | 'no_engagement'
  trigger_config: Record<string, unknown>
  created_at: string
}
```

2. Update `SequenceStep` to add:
```typescript
blocks: Block[] | null  // stored email content (takes precedence over template_id)
```

3. Update `Sequence` to add:
```typescript
branches: SequenceBranch[]  // all branches for this sequence
```

4. Update `SequenceAction` to add:
```typescript
button_id: string | null
branch_target: string | null
```

5. Update `SequenceEnrollment` to add:
```typescript
trigger_data: Record<string, unknown> | null
```

6. In `src/shared/constants.ts`, add trigger type constants:
```typescript
export const TRIGGER_ACTION_CLICK = 'action_click' as const
export const TRIGGER_OPENED = 'opened' as const
export const TRIGGER_CLICKED_ANY = 'clicked_any' as const
export const TRIGGER_NO_ENGAGEMENT = 'no_engagement' as const
export type TriggerType = typeof TRIGGER_ACTION_CLICK | typeof TRIGGER_OPENED | typeof TRIGGER_CLICKED_ANY | typeof TRIGGER_NO_ENGAGEMENT
```

7. In `src/server/lib/validation.ts`, add schemas:
```typescript
export const createBranchSchema = z.object({
  id: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentBranchId: z.string().optional(),
  triggerStepId: z.number().int().positive().optional(),
  triggerType: z.enum(['action_click', 'opened', 'clicked_any', 'no_engagement']),
  triggerConfig: z.record(z.unknown()).optional(),
})

export const updateBranchSchema = createBranchSchema.partial().omit({ id: true })
```

**Verification:** `bun run build`

---

## Task 3: Server Routes - Branch CRUD & Updated Step Endpoints

**Files:**
- Modify: `src/server/routes/sequences.ts` (add branch endpoints, update step/get endpoints)

**What to build:**

1. Add row interface for branches:
```typescript
interface BranchRow {
  id: string
  sequence_id: number
  name: string
  description: string | null
  color: string
  parent_branch_id: string | null
  trigger_step_id: number | null
  trigger_type: string
  trigger_config: string // JSON string from DB
  created_at: string
}
```

2. Add `formatBranch(row: BranchRow)` function that parses `trigger_config` from JSON.

3. Update `GET /:id` to also fetch and return branches:
```typescript
const branches = await sql`SELECT * FROM sequence_branches WHERE sequence_id = ${id} ORDER BY created_at ASC`
// Add to response: branches: branches.map(formatBranch)
```

4. Update `GET /:id` to include `blocks` in step SELECT.

5. Update `POST /:id/steps` to accept and store `blocks` parameter.

6. Update `PUT /:id/steps/:stepId` to accept and update `blocks`.

7. Add new endpoints:

```
POST   /:id/branches          -- Create a branch
GET    /:id/branches           -- List branches for sequence
PUT    /:id/branches/:branchId -- Update a branch
DELETE /:id/branches/:branchId -- Delete branch (cascade steps)
```

8. Update the `POST /:id/branch-point` to create branches in the new table instead of just setting `is_branch_point`.

**Verification:** `bun run build`

---

## Task 4: Sequence Processor - Multi-Branch & Multi-Trigger Support

**Files:**
- Modify: `src/server/services/sequence-processor.ts` (multi-branch routing, trigger evaluation)
- Modify: `src/server/services/tracking.ts` (multi-button action recording)
- Modify: `src/server/services/template-compiler.ts` (multi-button compilation)

**What to build:**

1. **Template Compiler**: Update `compileActionButton()` and `compileButton()` to include `buttonId` in the tracking URL as a query param: `{baseUrl}/t/{token}/action?btn={buttonId}`. Each action button in an email gets a unique `buttonId` in its props.

2. **Tracking Service**: Update `recordAction()` to:
   - Accept `buttonId` parameter (from query string)
   - Look up which branch the button targets (from step's blocks or from `sequence_branches.trigger_config`)
   - Store `button_id` and `branch_target` in `sequence_actions`
   - Set `trigger_data` on enrollment with `{ buttonId, branchTarget }`

3. **Sequence Processor**: Update `processEnrollmentStep()`:
   - After sending a step, load all branches triggered from the current step
   - **Use step blocks first**, fall back to template blocks when sending email
   - Evaluate triggers:
     - `action_click`: Check if `trigger_data.branchTarget` matches this branch
     - `opened`: Query tracking events, count opens for this enrollment
     - `clicked_any`: Query tracking events for any click
     - `no_engagement`: Check if enrollment has 0 opens/clicks after N steps
   - `switchToBranch()` updated to accept any branch ID (not just hardcoded 'action')
   - Non-clickers are routed to default branch after branch point (fix existing gap)

4. **Email sending**: Update the step-sending logic to use `step.blocks` when present, falling back to loading from `template_id`:
```typescript
const blocks = currentStep.blocks || (currentStep.template_id ? await loadTemplateBlocks(currentStep.template_id) : null)
```

**Verification:** `bun run build`

---

## Task 5: Store AI-Generated Blocks in Steps (#53)

**Files:**
- Modify: `src/client/components/SequencePreviewModal.tsx` (pass blocks when creating steps)
- Modify: `src/client/lib/api.ts` (update addStep to include blocks)
- Modify: `src/server/routes/sequences.ts` (ensure blocks stored on step creation)

**What to build:**

1. Update `SequencePreviewModal.tsx` `handleCreate()`:
   - When iterating through generated emails to create steps, include `blocks` in the addStep call
   - Remove the info banner about content not being saved
   - Replace with success message: "Sequence created with AI-generated content"

2. Update `api.ts` `sequences.addStep()`:
   - Add `blocks?: Block[]` to the step parameter type
   - Pass blocks in the POST body

3. The server route (`POST /:id/steps`) should already handle blocks from Task 3.

4. Update `SequencePreviewModal.tsx` to show a note that blocks are saved with the step.

**Verification:** `bun run build`

---

## Task 6: Multi-Button UI - Action Button Block Editor (#39, #40)

**Files:**
- Modify: `src/client/pages/Templates.tsx` (extend action-button editor for multi-button)
- Modify: `src/client/pages/Sequences.tsx` (update StepDialog to configure buttons)

**What to build:**

1. Update action-button block default props in `Templates.tsx`:
```typescript
{
  buttonId: nanoid(8),      // unique ID
  label: "Yes, I'm interested",
  color: '#10b981',
  align: 'center',
  branchTarget: null,       // null = same branch for all buttons, or branch ID
  destinationType: 'hosted',
  destinationUrl: '',
  hostedMessage: "Thank you!",
}
```

2. Add `buttonId` generation when adding new action-button blocks.

3. In the action-button editor panel, add a "Branch Target" selector:
   - Dropdown showing available branches for the current sequence
   - Only visible when editing a template that's linked to a sequence step
   - `null` option = "Same branch (track preference only)"

4. Support multiple action buttons in a single email:
   - The block list already supports multiple blocks of the same type
   - Each action-button block gets its own `buttonId`
   - Visual indicator showing which branch each button routes to

5. Add block-level validation: warn if two buttons target the same branch (likely user error for #40 use case).

**Verification:** `bun run build`

---

## Task 7: Multiple Trigger Conditions UI (#33)

**Files:**
- Create: `src/client/components/BranchConditionEditor.tsx`
- Modify: `src/client/pages/Sequences.tsx` (branch condition editing in step editor)
- Modify: `src/client/components/SequenceBranchBuilder.tsx` (show conditions)

**What to build:**

1. Create `BranchConditionEditor.tsx`:
   - Trigger type selector (action_click, opened, clicked_any, no_engagement)
   - Config editor per type:
     - `action_click`: Button selector (which button triggers this branch)
     - `opened`: Number input for minimum opens
     - `clicked_any`: No additional config needed
     - `no_engagement`: Number input for "after N steps"
   - Color picker for branch visualization
   - Uses shadcn Select, Input, Label components

2. Update `SequenceEditor` in `Sequences.tsx`:
   - Add "Add Branch" button at branch points
   - Branch creation dialog using `BranchConditionEditor`
   - Branch editing (click branch header to edit condition)
   - Branch deletion with confirmation

3. Update `SequenceBranchBuilder.tsx`:
   - Replace hardcoded two-column layout with dynamic columns
   - Each branch gets its own column with colored header
   - Show trigger condition as badge on column header
   - "Add Branch" button to create additional branches

**Verification:** `bun run build`

---

## Task 8: React Flow Integration - Visual Flowchart Builder (#38)

**Files:**
- Create: `src/client/components/SequenceFlowBuilder.tsx` (main flowchart component)
- Create: `src/client/components/flow/EmailNode.tsx` (custom email step node)
- Create: `src/client/components/flow/BranchNode.tsx` (custom branch point node)
- Create: `src/client/components/flow/EndNode.tsx` (sequence end marker)
- Create: `src/client/components/flow/useSequenceLayout.ts` (auto-layout hook)
- Modify: `src/client/pages/Sequences.tsx` (add flow/list view toggle)

**What to build:**

1. Install React Flow: `bun add @xyflow/react`

2. Create `EmailNode.tsx`:
   - Custom node showing: step number, subject line, delay badge, block count
   - Styled with shadcn Card component
   - Click opens step editor side panel
   - Source handle (bottom) and target handle (top)
   - Color-coded border matching branch color

3. Create `BranchNode.tsx`:
   - Diamond-shaped node showing branch condition
   - Multiple source handles (one per outgoing branch)
   - Labels on handles showing branch names
   - Amber background color

4. Create `EndNode.tsx`:
   - Small circular node with "End" label
   - Only target handle
   - Gray color

5. Create `useSequenceLayout.ts`:
   - Convert sequence steps + branches into React Flow nodes and edges
   - Auto-layout using dagre algorithm (top-to-bottom)
   - Group steps by branch, create branch nodes at fork points
   - Handle edge labels (branch names + trigger conditions)
   - Recalculate layout when steps/branches change

6. Create `SequenceFlowBuilder.tsx`:
   - Main React Flow canvas with custom node types registered
   - Toolbar: zoom controls, fit view, add step
   - Minimap for large sequences
   - Right-click context menu on nodes (edit, delete, add step after)
   - Edge click to insert step
   - Background pattern (dots)
   - Read-only until edit mode toggled

7. Update `Sequences.tsx` `SequenceEditor`:
   - Add view toggle: "List" | "Flow" (using shadcn Tabs)
   - "List" shows existing `SequenceBranchBuilder`
   - "Flow" shows new `SequenceFlowBuilder`
   - Both views share the same data and step dialog
   - Default to "Flow" view

**Verification:** `bun run build`

---

## Task 9: Client API Updates

**Files:**
- Modify: `src/client/lib/api.ts` (add branch CRUD, update step methods)

**What to build:**

1. Add branch API functions:
```typescript
sequences: {
  // ... existing
  listBranches: (sequenceId: number) => api.get(`/sequences/${sequenceId}/branches`),
  createBranch: (sequenceId: number, data: CreateBranchInput) => api.post(`/sequences/${sequenceId}/branches`, data),
  updateBranch: (sequenceId: number, branchId: string, data: UpdateBranchInput) => api.put(`/sequences/${sequenceId}/branches/${branchId}`, data),
  deleteBranch: (sequenceId: number, branchId: string) => api.delete(`/sequences/${sequenceId}/branches/${branchId}`),
}
```

2. Update `addStep` to include `blocks` in request body.

3. Add proper TypeScript types for all new request/response shapes.

**Verification:** `bun run build`

---

## Task 10: Integration Testing & Build Verification

**Files:**
- All modified files

**What to build:**

1. Run full build: `bun run build`
2. Fix any TypeScript errors
3. Verify all imports are correct
4. Ensure no circular dependencies
5. Check that existing sequence functionality is not broken by the changes
6. Verify backward compatibility: existing sequences with 'action'/'default' branches should still work via the migration

**Verification:** `bun run build` succeeds with 0 errors

---

## Parallel Execution Groups

These tasks can be parallelized:

**Group A (independent foundation):**
- Task 1: Database migration (no code dependencies)
- Task 2: Shared types & constants (no code dependencies)
- Task 9: Client API updates (only depends on knowing the API shape)

**Group B (depends on A):**
- Task 3: Server routes (depends on Task 1, 2)
- Task 4: Sequence processor (depends on Task 1, 2)
- Task 5: Store AI blocks (depends on Task 2, 3)

**Group C (depends on A, B):**
- Task 6: Multi-button UI (depends on Task 2, 3)
- Task 7: Trigger conditions UI (depends on Task 2, 3, 9)
- Task 8: React Flow builder (depends on Task 2, 9)

**Group D (depends on all):**
- Task 10: Integration & build verification

## Execution Strategy

Dispatch 5 parallel agents per group:
- **Batch 1**: Tasks 1, 2, 9 (3 agents)
- **Batch 2**: Tasks 3, 4, 5 (3 agents)
- **Batch 3**: Tasks 6, 7, 8 (3 agents)
- **Batch 4**: Task 10 (1 agent)
