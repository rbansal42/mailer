# Sequence Branching with Action Buttons - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable email sequences to branch based on recipient clicking an action button, routing interested recipients to a different email path.

**Architecture:** Extends existing sequence system with branch support. Action buttons are tracked through the existing tracking infrastructure with a new 'action' event type. Branch switching happens in the sequence processor based on enrollment state.

**Tech Stack:** Bun, Express, libSQL/Turso, React, TypeScript, TailwindCSS, shadcn/ui

---

## Task 1: Database Schema - Add Branching Columns

**Files:**
- Modify: `server/src/db/schema.ts:257-285`

**Step 1: Add branch columns to sequence_steps table**

In `server/src/db/schema.ts`, after the existing `sequence_steps` CREATE TABLE (around line 269), add migrations:

```typescript
// After the CREATE TABLE statements, in the migrations section (around line 400)
await addColumnIfNotExists(db, 'sequence_steps', 'branch_id', 'TEXT')
await addColumnIfNotExists(db, 'sequence_steps', 'is_branch_point', 'INTEGER DEFAULT 0')
await addColumnIfNotExists(db, 'sequence_steps', 'branch_order', 'INTEGER')
```

**Step 2: Add branch columns to sequence_enrollments table**

```typescript
await addColumnIfNotExists(db, 'sequence_enrollments', 'branch_id', 'TEXT')
await addColumnIfNotExists(db, 'sequence_enrollments', 'action_clicked_at', 'TEXT')
await addColumnIfNotExists(db, 'sequence_enrollments', 'branch_switched_at', 'TEXT')
```

**Step 3: Create sequence_actions table**

Add new CREATE TABLE after sequence_enrollments (around line 285):

```typescript
CREATE TABLE IF NOT EXISTS sequence_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  enrollment_id INTEGER NOT NULL,
  clicked_at TEXT NOT NULL,
  destination_type TEXT NOT NULL,
  destination_url TEXT,
  hosted_message TEXT,
  button_text TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES sequence_enrollments(id) ON DELETE CASCADE
)
```

**Step 4: Add index for sequence_actions**

```typescript
CREATE INDEX IF NOT EXISTS idx_sequence_actions_enrollment ON sequence_actions(enrollment_id)
```

**Step 5: Run dev server to verify migrations**

Run: `bun run dev`
Expected: Server starts without database errors

**Step 6: Commit**

```bash
git add server/src/db/schema.ts
git commit -m "feat(db): add branching columns and sequence_actions table"
```

---

## Task 2: Backend - Action Click Handler Route

**Files:**
- Modify: `server/src/routes/tracking.ts`
- Modify: `server/src/services/tracking.ts`

**Step 1: Add recordAction function to tracking service**

In `server/src/services/tracking.ts`, add after `recordClick` (around line 171):

```typescript
export async function recordAction(
  token: string,
  ipAddress: string | null,
  userAgent: string | null,
  buttonText: string | null
): Promise<{ success: boolean; enrollment?: any; action?: any }> {
  const tokenDetails = await getTokenDetails(token)
  if (!tokenDetails) {
    return { success: false }
  }

  // For sequences, campaign_id is negative (synthetic)
  const sequenceId = tokenDetails.campaign_id < 0 ? Math.abs(tokenDetails.campaign_id) : null
  if (!sequenceId) {
    return { success: false } // Action buttons only work in sequences
  }

  // Find enrollment
  const enrollment = await db.execute({
    sql: `SELECT * FROM sequence_enrollments 
          WHERE sequence_id = ? AND recipient_email = ? AND status = 'active'`,
    args: [sequenceId, tokenDetails.recipient_email]
  })

  if (!enrollment.rows.length) {
    return { success: false }
  }

  const enrollmentRow = enrollment.rows[0]

  // Check if already clicked (idempotent)
  if (enrollmentRow.action_clicked_at) {
    return { success: true, enrollment: enrollmentRow }
  }

  // Record tracking event
  await db.execute({
    sql: `INSERT INTO tracking_events (token_id, event_type, ip_address, user_agent)
          VALUES (?, 'action', ?, ?)`,
    args: [tokenDetails.id, ipAddress ?? null, userAgent ?? null]
  })

  // Update enrollment
  const now = new Date().toISOString()
  await db.execute({
    sql: `UPDATE sequence_enrollments SET action_clicked_at = ? WHERE id = ?`,
    args: [now, enrollmentRow.id]
  })

  return { 
    success: true, 
    enrollment: { ...enrollmentRow, action_clicked_at: now }
  }
}
```

**Step 2: Add getActionConfig helper**

```typescript
export async function getActionConfig(sequenceId: number, stepId: number): Promise<{
  destinationType: 'external' | 'hosted'
  destinationUrl: string | null
  hostedMessage: string | null
} | null> {
  // Action config is stored in the step's template blocks
  const step = await db.execute({
    sql: `SELECT t.blocks FROM sequence_steps ss
          JOIN templates t ON ss.template_id = t.id
          WHERE ss.id = ?`,
    args: [stepId]
  })

  if (!step.rows.length) return null

  const blocks = JSON.parse(step.rows[0].blocks as string || '[]')
  const actionBlock = blocks.find((b: any) => 
    b.type === 'action-button' || (b.type === 'button' && b.props?.isActionTrigger)
  )

  if (!actionBlock) return null

  return {
    destinationType: actionBlock.props.destinationType || 'hosted',
    destinationUrl: actionBlock.props.destinationUrl || null,
    hostedMessage: actionBlock.props.hostedMessage || 'Thank you for your response!'
  }
}
```

**Step 3: Add action route in tracking.ts**

In `server/src/routes/tracking.ts`, add new route (after click handler, around line 93):

```typescript
// Action button click handler
router.get('/:token/action', async (req, res) => {
  const { token } = req.params
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null
  const userAgent = req.headers['user-agent'] || null
  const buttonText = req.query.text as string || null

  const result = await recordAction(token, ipAddress, userAgent, buttonText)

  if (!result.success) {
    return res.status(404).send('Not found')
  }

  // Get action config to determine response
  const tokenDetails = await getTokenDetails(token)
  if (!tokenDetails) {
    return res.status(404).send('Not found')
  }

  const sequenceId = Math.abs(tokenDetails.campaign_id)
  
  // Find current step from enrollment
  const enrollment = result.enrollment
  const stepResult = await db.execute({
    sql: `SELECT id FROM sequence_steps WHERE sequence_id = ? AND step_order = ?`,
    args: [sequenceId, enrollment.current_step]
  })

  if (!stepResult.rows.length) {
    // Fallback: show default thank you
    return res.send(getHostedThankYouPage('Thank you for your response!'))
  }

  const stepId = stepResult.rows[0].id as number
  const config = await getActionConfig(sequenceId, stepId)

  if (!config) {
    return res.send(getHostedThankYouPage('Thank you for your response!'))
  }

  if (config.destinationType === 'external' && config.destinationUrl) {
    return res.redirect(config.destinationUrl)
  }

  return res.send(getHostedThankYouPage(config.hostedMessage || 'Thank you for your response!'))
})

function getHostedThankYouPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }
    .card {
      background: white;
      padding: 48px;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 480px;
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    .message {
      font-size: 18px;
      color: #374151;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <p class="message">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
  </div>
</body>
</html>`
}
```

**Step 4: Add imports at top of tracking.ts**

```typescript
import { recordAction, getActionConfig, getTokenDetails } from '../services/tracking'
import { db } from '../db'
```

**Step 5: Verify route works**

Run: `bun run dev`
Then: `curl http://localhost:3342/t/test-token/action`
Expected: 404 response (token doesn't exist, but route works)

**Step 6: Commit**

```bash
git add server/src/routes/tracking.ts server/src/services/tracking.ts
git commit -m "feat(api): add action button click handler route"
```

---

## Task 3: Backend - Sequence Processor Branch Switching

**Files:**
- Modify: `server/src/services/sequence-processor.ts`

**Step 1: Update processEnrollmentStep to check for branch switching**

In `server/src/services/sequence-processor.ts`, modify `processEnrollmentStep` (around line 169).

Add branch checking logic at the beginning of the function, after fetching enrollment:

```typescript
async function processEnrollmentStep(enrollment: any): Promise<void> {
  // Check if action was clicked and we need to switch branches
  if (enrollment.action_clicked_at && !enrollment.branch_switched_at) {
    await switchToBranch(enrollment)
    // Re-fetch enrollment after branch switch
    const updated = await db.execute({
      sql: 'SELECT * FROM sequence_enrollments WHERE id = ?',
      args: [enrollment.id]
    })
    if (updated.rows.length) {
      enrollment = updated.rows[0]
    }
  }

  // Rest of existing function...
```

**Step 2: Add switchToBranch function**

Add before `processEnrollmentStep`:

```typescript
async function switchToBranch(enrollment: any): Promise<void> {
  const now = new Date().toISOString()
  
  // Find first step in the 'action' branch
  const actionBranchStep = await db.execute({
    sql: `SELECT * FROM sequence_steps 
          WHERE sequence_id = ? AND branch_id = 'action' 
          ORDER BY branch_order ASC, step_order ASC 
          LIMIT 1`,
    args: [enrollment.sequence_id]
  })

  if (!actionBranchStep.rows.length) {
    // No action branch defined, just mark as switched but stay on current path
    await db.execute({
      sql: `UPDATE sequence_enrollments SET branch_switched_at = ? WHERE id = ?`,
      args: [now, enrollment.id]
    })
    return
  }

  const firstActionStep = actionBranchStep.rows[0]
  const nextSendAt = calculateNextSendAt({
    delay_days: firstActionStep.delay_days as number,
    delay_hours: firstActionStep.delay_hours as number,
    send_time: firstActionStep.send_time as string | null
  })

  // Update enrollment to action branch
  await db.execute({
    sql: `UPDATE sequence_enrollments 
          SET branch_id = 'action', 
              branch_switched_at = ?,
              current_step = ?,
              next_send_at = ?
          WHERE id = ?`,
    args: [now, firstActionStep.step_order, nextSendAt, enrollment.id]
  })

  console.log(`[Sequence] Enrollment ${enrollment.id} switched to action branch`)
}
```

**Step 3: Update getNextStep to respect branches**

Modify the step fetching logic in `processEnrollmentStep` to filter by branch:

```typescript
// Find the current step (respect branch_id)
const branchFilter = enrollment.branch_id 
  ? 'AND branch_id = ?' 
  : 'AND (branch_id IS NULL OR branch_id = "")'
const branchArgs = enrollment.branch_id 
  ? [enrollment.sequence_id, enrollment.current_step, enrollment.branch_id]
  : [enrollment.sequence_id, enrollment.current_step]

const stepResult = await db.execute({
  sql: `SELECT ss.*, t.blocks 
        FROM sequence_steps ss
        LEFT JOIN templates t ON ss.template_id = t.id
        WHERE ss.sequence_id = ? AND ss.step_order = ? ${branchFilter}`,
  args: branchArgs
})
```

**Step 4: Update next step calculation to respect branches**

When finding the next step, also filter by branch:

```typescript
// Find next step in same branch
const nextStepResult = await db.execute({
  sql: `SELECT * FROM sequence_steps 
        WHERE sequence_id = ? AND step_order > ? ${branchFilter}
        ORDER BY step_order ASC 
        LIMIT 1`,
  args: branchArgs
})
```

**Step 5: Verify changes compile**

Run: `bun run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add server/src/services/sequence-processor.ts
git commit -m "feat(sequences): add branch switching logic to processor"
```

---

## Task 4: Backend - Sequence Routes for Branches

**Files:**
- Modify: `server/src/routes/sequences.ts`

**Step 1: Update GET /:id to include branch info**

Modify the sequence detail route to return steps grouped by branch:

```typescript
// In GET /:id route (around line 63)
const steps = await db.execute({
  sql: `SELECT * FROM sequence_steps WHERE sequence_id = ? 
        ORDER BY branch_id NULLS FIRST, COALESCE(branch_order, step_order) ASC`,
  args: [id]
})
```

**Step 2: Update POST /:id/steps to support branch**

Modify the add step route to accept branch parameters:

```typescript
// In POST /:id/steps route (around line 158)
const { template_id, subject, delay_days, delay_hours, send_time, branch_id, branch_order } = req.body

// Validate
if (!template_id || !subject || delay_days === undefined) {
  return res.status(400).json({ error: 'template_id, subject, and delay_days are required' })
}

// Get next step_order (or branch_order if in a branch)
let nextOrder: number
if (branch_id) {
  const maxOrder = await db.execute({
    sql: `SELECT MAX(COALESCE(branch_order, step_order)) as max_order 
          FROM sequence_steps WHERE sequence_id = ? AND branch_id = ?`,
    args: [id, branch_id]
  })
  nextOrder = ((maxOrder.rows[0]?.max_order as number) || 0) + 1
} else {
  const maxOrder = await db.execute({
    sql: `SELECT MAX(step_order) as max_order 
          FROM sequence_steps WHERE sequence_id = ? AND (branch_id IS NULL OR branch_id = '')`,
    args: [id]
  })
  nextOrder = ((maxOrder.rows[0]?.max_order as number) || 0) + 1
}

const result = await db.execute({
  sql: `INSERT INTO sequence_steps 
        (sequence_id, step_order, template_id, subject, delay_days, delay_hours, send_time, branch_id, branch_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    id, 
    nextOrder, 
    template_id, 
    subject, 
    delay_days, 
    delay_hours ?? 0, 
    send_time ?? null,
    branch_id ?? null,
    branch_id ? nextOrder : null
  ]
})
```

**Step 3: Add POST /:id/branch-point to create branch point**

Add new route:

```typescript
// Create a branch point in the sequence
router.post('/:id/branch-point', async (req, res) => {
  const { id } = req.params
  const { after_step, delay_before_switch } = req.body

  // after_step is the step_order after which the branch point occurs
  // Mark that step as a branch point
  await db.execute({
    sql: `UPDATE sequence_steps SET is_branch_point = 1 WHERE sequence_id = ? AND step_order = ?`,
    args: [id, after_step]
  })

  // Store delay config in sequence metadata (add column if needed)
  await db.execute({
    sql: `UPDATE sequences SET branch_delay_hours = ? WHERE id = ?`,
    args: [delay_before_switch ?? 0, id]
  })

  res.json({ success: true })
})
```

**Step 4: Add GET /:id/actions for action analytics**

```typescript
// Get action clicks for a sequence
router.get('/:id/actions', async (req, res) => {
  const { id } = req.params
  
  const actions = await db.execute({
    sql: `SELECT sa.*, se.recipient_email, se.recipient_data
          FROM sequence_actions sa
          JOIN sequence_enrollments se ON sa.enrollment_id = se.id
          WHERE sa.sequence_id = ?
          ORDER BY sa.clicked_at DESC`,
    args: [id]
  })

  res.json(actions.rows)
})
```

**Step 5: Add GET /:id/actions/export for CSV export**

```typescript
// Export action clicks as CSV
router.get('/:id/actions/export', async (req, res) => {
  const { id } = req.params
  
  const actions = await db.execute({
    sql: `SELECT se.recipient_email, sa.clicked_at, sa.button_text, ss.subject as from_step
          FROM sequence_actions sa
          JOIN sequence_enrollments se ON sa.enrollment_id = se.id
          JOIN sequence_steps ss ON sa.step_id = ss.id
          WHERE sa.sequence_id = ?
          ORDER BY sa.clicked_at DESC`,
    args: [id]
  })

  const csv = [
    'email,clicked_at,button_text,from_step',
    ...actions.rows.map((row: any) => 
      `${row.recipient_email},${row.clicked_at},${row.button_text || ''},${row.from_step}`
    )
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=sequence-${id}-actions.csv`)
  res.send(csv)
})
```

**Step 6: Add branch_delay_hours column to sequences**

In `server/src/db/schema.ts`:

```typescript
await addColumnIfNotExists(db, 'sequences', 'branch_delay_hours', 'INTEGER DEFAULT 0')
```

**Step 7: Verify routes**

Run: `bun run dev`
Expected: Server starts, new routes accessible

**Step 8: Commit**

```bash
git add server/src/routes/sequences.ts server/src/db/schema.ts
git commit -m "feat(api): add sequence branch and action analytics routes"
```

---

## Task 5: Frontend - Action Button Block Type

**Files:**
- Modify: `frontend/src/lib/api.ts:314-318`
- Modify: `frontend/src/pages/Templates.tsx`

**Step 1: Update Block type in api.ts**

In `frontend/src/lib/api.ts`, update the Block interface:

```typescript
export interface Block {
  id: string
  type: 'header' | 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'footer' | 'action-button'
  props: Record<string, unknown>
}
```

**Step 2: Add action-button to BLOCK_TYPES**

In `frontend/src/pages/Templates.tsx`, update BLOCK_TYPES (around line 27):

```typescript
import { FileText, Type, Image, MousePointer, Minus, Square, Columns, Zap } from 'lucide-react'

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: FileText },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'button', label: 'Button', icon: MousePointer },
  { type: 'action-button', label: 'Action Button', icon: Zap },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: Square },
  { type: 'columns', label: 'Columns', icon: Columns },
  { type: 'footer', label: 'Footer', icon: FileText },
]
```

**Step 3: Add default props for action-button**

In `getDefaultProps` function (around line 1155):

```typescript
case 'action-button':
  return { 
    label: 'Yes, I\'m interested', 
    color: '#10b981', 
    align: 'center',
    destinationType: 'hosted',
    destinationUrl: '',
    hostedMessage: 'Thank you for your response! We\'ll be in touch soon.'
  }
```

**Step 4: Add action-button renderer in block preview**

Find where blocks are rendered (look for switch statement on block.type) and add:

```typescript
case 'action-button':
  return (
    <div style={{ textAlign: block.props.align as string || 'center', padding: '16px' }}>
      <a
        href="#"
        style={{
          display: 'inline-block',
          padding: '14px 28px',
          backgroundColor: block.props.color as string || '#10b981',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '16px'
        }}
      >
        {block.props.label as string || 'Click Here'}
      </a>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
        ⚡ Action Button - triggers sequence branch
      </div>
    </div>
  )
```

**Step 5: Add action-button props editor**

Find the block props editor panel and add case for action-button:

```typescript
case 'action-button':
  return (
    <>
      <div className="space-y-2">
        <Label>Button Text</Label>
        <Input
          value={block.props.label as string || ''}
          onChange={(e) => updateBlockProp('label', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Button Color</Label>
        <Input
          type="color"
          value={block.props.color as string || '#10b981'}
          onChange={(e) => updateBlockProp('color', e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Alignment</Label>
        <Select value={block.props.align as string || 'center'} onValueChange={(v) => updateBlockProp('align', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Separator className="my-4" />
      <div className="space-y-2">
        <Label>When Clicked</Label>
        <Select 
          value={block.props.destinationType as string || 'hosted'} 
          onValueChange={(v) => updateBlockProp('destinationType', v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hosted">Show Thank You Page</SelectItem>
            <SelectItem value="external">Redirect to URL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {block.props.destinationType === 'external' ? (
        <div className="space-y-2">
          <Label>Destination URL</Label>
          <Input
            value={block.props.destinationUrl as string || ''}
            onChange={(e) => updateBlockProp('destinationUrl', e.target.value)}
            placeholder="https://..."
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Thank You Message</Label>
          <Textarea
            value={block.props.hostedMessage as string || ''}
            onChange={(e) => updateBlockProp('hostedMessage', e.target.value)}
            placeholder="Thank you for your response!"
            rows={3}
          />
        </div>
      )}
    </>
  )
```

**Step 6: Verify block appears in editor**

Run: `bun run dev`
Navigate to Templates, create new template
Expected: "Action Button" appears in block picker with Zap icon

**Step 7: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/Templates.tsx
git commit -m "feat(ui): add action-button block type"
```

---

## Task 6: Backend - Template Compiler Action URL

**Files:**
- Modify: `server/src/services/template-compiler.ts`

**Step 1: Add action button URL injection**

In `template-compiler.ts`, find the `injectTracking` function (around line 235).

Add action button handling after click tracking:

```typescript
// Handle action buttons - replace placeholder URLs with tracking URLs
const actionButtonRegex = /href="(#action-button|{{action_url}})"/gi
compiled = compiled.replace(actionButtonRegex, () => {
  return `href="${baseUrl}/t/${trackingToken}/action"`
})

// Also handle action-button blocks rendered as links
// Look for data-action-button attribute
const actionAttrRegex = /data-action-button="true"[^>]*href="[^"]*"/gi
compiled = compiled.replace(actionAttrRegex, (match) => {
  return match.replace(/href="[^"]*"/, `href="${baseUrl}/t/${trackingToken}/action"`)
})
```

**Step 2: Update renderBlock for action-button**

Find where blocks are rendered to HTML (likely in template-compiler.ts or a separate renderer).

Add action-button case:

```typescript
case 'action-button':
  const actionAlign = block.props.align || 'center'
  const actionColor = block.props.color || '#10b981'
  const actionLabel = block.props.label || 'Click Here'
  return `
    <div style="text-align: ${actionAlign}; padding: 16px;">
      <a href="{{action_url}}" 
         data-action-button="true"
         style="display: inline-block; padding: 14px 28px; background-color: ${actionColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        ${escapeHtml(actionLabel)}
      </a>
    </div>
  `
```

**Step 3: Verify compilation**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add server/src/services/template-compiler.ts
git commit -m "feat(compiler): inject action button tracking URLs"
```

---

## Task 7: Frontend - Sequence Builder with Branches

**Files:**
- Create: `frontend/src/pages/SequenceBuilder.tsx` (or modify existing Sequences page)
- Modify: `frontend/src/lib/api.ts` - add sequence types

**Step 1: Add sequence types to api.ts**

```typescript
export interface SequenceStep {
  id: number
  sequence_id: number
  step_order: number
  template_id: number
  subject: string
  delay_days: number
  delay_hours: number
  send_time: string | null
  branch_id: string | null
  branch_order: number | null
  is_branch_point: boolean
}

export interface Sequence {
  id: number
  name: string
  description: string | null
  enabled: boolean
  branch_delay_hours: number
  steps: SequenceStep[]
}
```

**Step 2: Add API functions for sequences**

```typescript
export async function getSequence(id: number): Promise<Sequence> {
  const res = await fetch(`${API_BASE}/api/sequences/${id}`)
  if (!res.ok) throw new Error('Failed to fetch sequence')
  return res.json()
}

export async function addSequenceStep(sequenceId: number, step: Partial<SequenceStep>): Promise<SequenceStep> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(step)
  })
  if (!res.ok) throw new Error('Failed to add step')
  return res.json()
}

export async function createBranchPoint(sequenceId: number, afterStep: number, delayHours: number = 0): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/branch-point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ after_step: afterStep, delay_before_switch: delayHours })
  })
  if (!res.ok) throw new Error('Failed to create branch point')
}

export async function getSequenceActions(sequenceId: number): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/sequences/${sequenceId}/actions`)
  if (!res.ok) throw new Error('Failed to fetch actions')
  return res.json()
}
```

**Step 3: Create SequenceBranchBuilder component**

Create `frontend/src/components/SequenceBranchBuilder.tsx`:

```typescript
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, GitBranch, Mail, Clock } from 'lucide-react'
import { SequenceStep } from '@/lib/api'

interface Props {
  steps: SequenceStep[]
  onAddStep: (branchId: string | null) => void
  onAddBranchPoint: (afterStep: number) => void
  onEditStep: (step: SequenceStep) => void
  onDeleteStep: (stepId: number) => void
}

export function SequenceBranchBuilder({ steps, onAddStep, onAddBranchPoint, onEditStep, onDeleteStep }: Props) {
  // Group steps by branch
  const mainSteps = steps.filter(s => !s.branch_id)
  const actionSteps = steps.filter(s => s.branch_id === 'action')
  const defaultSteps = steps.filter(s => s.branch_id === 'default')
  
  const branchPoint = steps.find(s => s.is_branch_point)

  return (
    <div className="space-y-4">
      {/* Main Path */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Main Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mainSteps.map((step, i) => (
            <StepCard 
              key={step.id} 
              step={step} 
              index={i + 1}
              onEdit={() => onEditStep(step)}
              onDelete={() => onDeleteStep(step.id)}
              showBranchButton={!branchPoint && i === mainSteps.length - 1}
              onAddBranchPoint={() => onAddBranchPoint(step.step_order)}
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => onAddStep(null)}>
            <Plus className="w-4 h-4 mr-2" /> Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Branch Point */}
      {branchPoint && (
        <>
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
              <GitBranch className="w-4 h-4" />
              Branch Point: If action clicked
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Default Path */}
            <Card>
              <CardHeader className="py-3 bg-slate-50">
                <CardTitle className="text-sm font-medium">Default Path (no action)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {defaultSteps.map((step, i) => (
                  <StepCard 
                    key={step.id} 
                    step={step} 
                    index={i + 1}
                    onEdit={() => onEditStep(step)}
                    onDelete={() => onDeleteStep(step.id)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => onAddStep('default')}>
                  <Plus className="w-4 h-4 mr-2" /> Add Step
                </Button>
              </CardContent>
            </Card>

            {/* Action Path */}
            <Card>
              <CardHeader className="py-3 bg-green-50">
                <CardTitle className="text-sm font-medium">Action Path (clicked)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {actionSteps.map((step, i) => (
                  <StepCard 
                    key={step.id} 
                    step={step} 
                    index={i + 1}
                    onEdit={() => onEditStep(step)}
                    onDelete={() => onDeleteStep(step.id)}
                  />
                ))}
                <Button variant="outline" size="sm" onClick={() => onAddStep('action')}>
                  <Plus className="w-4 h-4 mr-2" /> Add Step
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function StepCard({ step, index, onEdit, onDelete, showBranchButton, onAddBranchPoint }: {
  step: SequenceStep
  index: number
  onEdit: () => void
  onDelete: () => void
  showBranchButton?: boolean
  onAddBranchPoint?: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50">
      <div className="flex items-center justify-center w-8 h-8 bg-slate-100 rounded-full text-sm font-medium">
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{step.subject}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Wait {step.delay_days}d {step.delay_hours}h
        </p>
      </div>
      <div className="flex gap-1">
        {showBranchButton && (
          <Button variant="ghost" size="sm" onClick={onAddBranchPoint}>
            <GitBranch className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  )
}
```

**Step 4: Verify component renders**

Run: `bun run dev`
Expected: Build succeeds (we'll integrate the component in the next task)

**Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/SequenceBranchBuilder.tsx
git commit -m "feat(ui): add sequence branch builder component"
```

---

## Task 8: Frontend - Integrate Branch Builder into Sequences Page

**Files:**
- Modify: `frontend/src/pages/Sequences.tsx` (or wherever sequences are managed)

**Step 1: Import the branch builder**

```typescript
import { SequenceBranchBuilder } from '@/components/SequenceBranchBuilder'
import { getSequence, addSequenceStep, createBranchPoint } from '@/lib/api'
```

**Step 2: Add state for sequence editing**

```typescript
const [editingSequence, setEditingSequence] = useState<Sequence | null>(null)
```

**Step 3: Add handlers**

```typescript
const handleAddStep = async (branchId: string | null) => {
  if (!editingSequence) return
  // Open step creation dialog with branchId
  setStepDialogBranch(branchId)
  setStepDialogOpen(true)
}

const handleAddBranchPoint = async (afterStep: number) => {
  if (!editingSequence) return
  await createBranchPoint(editingSequence.id, afterStep, 0)
  // Refresh sequence
  const updated = await getSequence(editingSequence.id)
  setEditingSequence(updated)
}
```

**Step 4: Render branch builder in sequence detail view**

```typescript
{editingSequence && (
  <SequenceBranchBuilder
    steps={editingSequence.steps}
    onAddStep={handleAddStep}
    onAddBranchPoint={handleAddBranchPoint}
    onEditStep={(step) => { /* open edit dialog */ }}
    onDeleteStep={(stepId) => { /* delete step */ }}
  />
)}
```

**Step 5: Verify full flow works**

Run: `bun run dev`
Navigate to Sequences, create a sequence, add steps
Expected: Can add main steps, create branch point, add steps to each branch

**Step 6: Commit**

```bash
git add frontend/src/pages/Sequences.tsx
git commit -m "feat(ui): integrate sequence branch builder"
```

---

## Task 9: Frontend - Analytics Extension

**Files:**
- Modify: Campaign analytics component (find where analytics are shown)

**Step 1: Add action count to analytics display**

Find the campaign analytics component and add:

```typescript
// In the engagement stats section
<div className="flex justify-between">
  <span className="text-muted-foreground">Action Taken</span>
  <span className="font-medium">
    {analytics.actionClicks} ({((analytics.actionClicks / analytics.delivered) * 100).toFixed(1)}%)
  </span>
</div>
```

**Step 2: Add sequence path breakdown**

Create a small component for sequence-specific stats:

```typescript
function SequencePathStats({ sequenceId }: { sequenceId: number }) {
  const { data: enrollments } = useQuery({
    queryKey: ['sequence-enrollments', sequenceId],
    queryFn: () => fetch(`/api/sequences/${sequenceId}/enrollments`).then(r => r.json())
  })

  if (!enrollments) return null

  const total = enrollments.length
  const onDefault = enrollments.filter((e: any) => !e.branch_id || e.branch_id === 'default').length
  const onAction = enrollments.filter((e: any) => e.branch_id === 'action').length
  const completed = enrollments.filter((e: any) => e.status === 'completed').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Enrollments by Path</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Total enrolled</span>
          <span className="font-medium">{total}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>On default path</span>
          <span className="font-medium">{onDefault} ({((onDefault/total)*100).toFixed(0)}%)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>On action path</span>
          <span className="font-medium">{onAction} ({((onAction/total)*100).toFixed(0)}%)</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Completed</span>
          <span className="font-medium">{completed} ({((completed/total)*100).toFixed(0)}%)</span>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Add export button**

```typescript
<Button 
  variant="outline" 
  onClick={() => window.open(`/api/sequences/${sequenceId}/actions/export`, '_blank')}
>
  <Download className="w-4 h-4 mr-2" />
  Export Action Clicks
</Button>
```

**Step 4: Verify analytics display**

Run: `bun run dev`
Expected: Analytics show action stats and export button works

**Step 5: Commit**

```bash
git add frontend/src/pages/Campaigns.tsx  # or wherever analytics are
git commit -m "feat(ui): add action analytics and export"
```

---

## Task 10: Mark Link as Action Trigger

**Files:**
- Modify: `frontend/src/pages/Templates.tsx` - button block props

**Step 1: Add isActionTrigger option to regular button block**

In the button block props editor, add:

```typescript
case 'button':
  return (
    <>
      {/* existing button props... */}
      
      <Separator className="my-4" />
      <div className="flex items-center space-x-2">
        <Checkbox
          id="isActionTrigger"
          checked={block.props.isActionTrigger as boolean || false}
          onCheckedChange={(checked) => updateBlockProp('isActionTrigger', checked)}
        />
        <Label htmlFor="isActionTrigger">Use as action trigger</Label>
      </div>
      
      {block.props.isActionTrigger && (
        <>
          <div className="space-y-2 mt-4">
            <Label>When Clicked</Label>
            <Select 
              value={block.props.destinationType as string || 'hosted'} 
              onValueChange={(v) => updateBlockProp('destinationType', v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hosted">Show Thank You Page</SelectItem>
                <SelectItem value="external">Continue to URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.props.destinationType === 'hosted' && (
            <div className="space-y-2">
              <Label>Thank You Message</Label>
              <Textarea
                value={block.props.hostedMessage as string || ''}
                onChange={(e) => updateBlockProp('hostedMessage', e.target.value)}
                placeholder="Thank you for your response!"
                rows={3}
              />
            </div>
          )}
        </>
      )}
    </>
  )
```

**Step 2: Update button preview to show action indicator**

```typescript
case 'button':
  return (
    <div style={{ textAlign: block.props.align as string || 'center', padding: '16px' }}>
      <a href={block.props.url as string || '#'} style={/* existing styles */}>
        {block.props.label as string || 'Click Here'}
      </a>
      {block.props.isActionTrigger && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
          ⚡ Action Trigger
        </div>
      )}
    </div>
  )
```

**Step 3: Update template compiler to handle isActionTrigger**

In `server/src/services/template-compiler.ts`, update button rendering:

```typescript
case 'button':
  const isAction = block.props.isActionTrigger
  const href = isAction ? '{{action_url}}' : (block.props.url || '#')
  const dataAttr = isAction ? 'data-action-button="true"' : ''
  return `
    <div style="text-align: ${block.props.align || 'center'}; padding: 16px;">
      <a href="${href}" ${dataAttr} style="...">
        ${escapeHtml(block.props.label || 'Click Here')}
      </a>
    </div>
  `
```

**Step 4: Verify both action methods work**

Run: `bun run dev`
Test: Create template with action-button block
Test: Create template with regular button marked as action trigger
Expected: Both render with action URL in compiled email

**Step 5: Commit**

```bash
git add frontend/src/pages/Templates.tsx server/src/services/template-compiler.ts
git commit -m "feat: allow marking any button as action trigger"
```

---

## Task 11: End-to-End Testing

**Step 1: Create a test sequence with branches**

1. Create a new sequence "Test Interest Flow"
2. Add Step 1: Initial email with action button
3. Add Step 2: Follow-up with action button
4. Create branch point after Step 2
5. Add default path: Step 3a "Still interested?"
6. Add action path: Step 3b "Thanks for interest!"

**Step 2: Enroll a test recipient**

Use the enroll API or UI to add a test email.

**Step 3: Trigger first email manually**

Check that email contains action button with tracking URL.

**Step 4: Click action button**

Visit the action URL directly.
Expected: Thank you page appears, enrollment updated.

**Step 5: Verify branch switch**

Check enrollment in database:
- `action_clicked_at` should be set
- After next process cycle, `branch_id` should be 'action'

**Step 6: Verify analytics**

Check sequence analytics show action click.
Export CSV and verify data.

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat: complete sequence branching with action buttons"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database schema | schema.ts |
| 2 | Action click handler | tracking.ts, tracking routes |
| 3 | Sequence processor branching | sequence-processor.ts |
| 4 | Sequence routes for branches | sequences.ts |
| 5 | Action button block type | api.ts, Templates.tsx |
| 6 | Template compiler action URL | template-compiler.ts |
| 7 | Branch builder component | SequenceBranchBuilder.tsx |
| 8 | Integrate into Sequences page | Sequences.tsx |
| 9 | Analytics extension | Campaigns.tsx |
| 10 | Mark link as action trigger | Templates.tsx, template-compiler.ts |
| 11 | End-to-end testing | - |
