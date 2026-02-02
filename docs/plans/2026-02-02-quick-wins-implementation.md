# Quick Wins Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scheduled sending, search/filter, campaign duplication, and merge field preview.

**Architecture:** Client-side filtering for search (small data volumes), new API endpoints for duplication and preview, UI additions to existing pages.

**Tech Stack:** React, TypeScript, shadcn/ui components, Express backend, Turso/libSQL

---

## Phase 1: Search/Filter

Three independent tasks that can run in parallel.

### Task 1A: Campaigns Page Search

**Files:**
- Modify: `frontend/src/pages/Campaigns.tsx`

**Implementation:**

Add search state and filter logic to the drafts list:

```tsx
// Add import
import { Search } from 'lucide-react'

// Add state (near other useState calls)
const [search, setSearch] = useState('')

// Add filter logic (before rendering drafts)
const filteredDrafts = drafts?.filter(
  (draft) =>
    draft.name?.toLowerCase().includes(search.toLowerCase()) ||
    draft.subject?.toLowerCase().includes(search.toLowerCase())
) ?? []

// Add search input (above the drafts grid, inside the drafts list section)
<div className="relative mb-4">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search drafts..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-9"
  />
</div>

// Update map to use filteredDrafts instead of drafts
{filteredDrafts.map((draft) => ...)}
```

**Verify:** Build passes, search filters drafts by name/subject.

---

### Task 1B: History Page Search

**Files:**
- Modify: `frontend/src/pages/History.tsx`

**Implementation:**

Add search and date filter to campaigns list:

```tsx
// Add imports
import { Search } from 'lucide-react'
import { Input } from '../components/ui/input'

// Add state
const [search, setSearch] = useState('')

// Add filter logic
const filteredCampaigns = campaigns?.filter(
  (campaign) =>
    campaign.name?.toLowerCase().includes(search.toLowerCase()) ||
    campaign.subject?.toLowerCase().includes(search.toLowerCase())
) ?? []

// Add search input above the table
<div className="relative mb-4">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search campaigns..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-9"
  />
</div>

// Update to use filteredCampaigns
```

**Verify:** Build passes, search filters history by name/subject.

---

### Task 1C: Mail Library Search

**Files:**
- Modify: `frontend/src/pages/MailLibrary.tsx`

**Implementation:**

Add search to mails grid:

```tsx
// Add imports
import { Search } from 'lucide-react'
import { Input } from '../components/ui/input'

// Add state
const [search, setSearch] = useState('')

// Add filter logic
const filteredMails = mails?.filter(
  (mail) =>
    mail.name?.toLowerCase().includes(search.toLowerCase()) ||
    mail.description?.toLowerCase().includes(search.toLowerCase())
) ?? []

// Add search input above the grid
<div className="relative mb-4">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Search mails..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-9"
  />
</div>

// Update to use filteredMails
```

**Verify:** Build passes, search filters mails by name/description.

---

## Phase 2: Campaign Duplication

### Task 2A: Backend Duplicate Endpoints

**Files:**
- Modify: `server/src/routes/drafts.ts`
- Modify: `server/src/routes/campaigns.ts`

**Implementation - Drafts:**

Add to `drafts.ts`:

```typescript
// POST /drafts/:id/duplicate - Duplicate a draft
router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid draft ID' })
      return
    }

    const original = await queryOne<DraftRow>(
      'SELECT * FROM drafts WHERE id = ?',
      [id]
    )

    if (!original) {
      res.status(404).json({ error: 'Draft not found' })
      return
    }

    const newName = `Copy of ${original.name || 'Untitled'}`
    
    const result = await execute(
      `INSERT INTO drafts (name, template_id, mail_id, list_id, subject, test_email, recipients, recipients_text, variables, cc, bcc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newName,
        original.template_id ?? null,
        original.mail_id ?? null,
        original.list_id ?? null,
        original.subject ?? null,
        original.test_email ?? null,
        original.recipients ?? null,
        original.recipients_text ?? null,
        original.variables ?? null,
        original.cc ?? null,
        original.bcc ?? null,
      ]
    )

    res.json({ id: result.lastInsertRowid, name: newName })
  } catch (error) {
    logger.error('Failed to duplicate draft', { service: 'drafts' }, error as Error)
    res.status(500).json({ error: 'Failed to duplicate draft' })
  }
})
```

**Implementation - Campaigns:**

Add to `campaigns.ts`:

```typescript
// POST /campaigns/:id/duplicate - Duplicate campaign to new draft
router.post('/:id/duplicate', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid campaign ID' })
      return
    }

    const campaign = await queryOne<CampaignRow>(
      'SELECT * FROM campaigns WHERE id = ?',
      [id]
    )

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }

    const newName = `Copy of ${campaign.name || 'Untitled'}`
    
    const result = await execute(
      `INSERT INTO drafts (name, template_id, subject, cc, bcc)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newName,
        campaign.template_id ?? null,
        campaign.subject ?? null,
        campaign.cc ?? null,
        campaign.bcc ?? null,
      ]
    )

    res.json({ id: result.lastInsertRowid, name: newName })
  } catch (error) {
    logger.error('Failed to duplicate campaign', { service: 'campaigns' }, error as Error)
    res.status(500).json({ error: 'Failed to duplicate campaign' })
  }
})
```

**Verify:** Build passes.

---

### Task 2B: Frontend Duplicate UI

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/Campaigns.tsx`
- Modify: `frontend/src/pages/History.tsx`

**Implementation - API:**

Add to `api.ts`:

```typescript
// In the api object
duplicateDraft: (id: number) =>
  request<{ id: number; name: string }>(`/drafts/${id}/duplicate`, { method: 'POST' }),
duplicateCampaign: (id: number) =>
  request<{ id: number; name: string }>(`/campaigns/${id}/duplicate`, { method: 'POST' }),
```

**Implementation - Campaigns.tsx:**

Add duplicate button to draft cards and mutation:

```tsx
// Add import
import { Copy } from 'lucide-react'

// Add mutation
const duplicateMutation = useMutation({
  mutationFn: (id: number) => api.duplicateDraft(id),
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['drafts'] })
    // Optionally select the new draft
  },
})

// Add button to draft card (next to delete button)
<Button
  variant="ghost"
  size="icon"
  className="h-6 w-6"
  onClick={(e) => {
    e.stopPropagation()
    duplicateMutation.mutate(draft.id)
  }}
  title="Duplicate"
>
  <Copy className="h-3 w-3" />
</Button>
```

**Implementation - History.tsx:**

Add duplicate button to campaign details:

```tsx
// Add import
import { Copy } from 'lucide-react'

// Add mutation in CampaignDetails
const duplicateMutation = useMutation({
  mutationFn: () => api.duplicateCampaign(id),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['drafts'] })
    // Navigate to campaigns page or show toast
  },
})

// Add button in the header actions
<Button
  variant="outline"
  size="sm"
  onClick={() => duplicateMutation.mutate()}
  disabled={duplicateMutation.isPending}
>
  <Copy className="h-4 w-4 mr-1" />
  Duplicate to Draft
</Button>
```

**Verify:** Build passes, can duplicate drafts and campaigns.

---

## Phase 3: Scheduled Sending

### Task 3A: Schedule UI in Campaign Composer

**Files:**
- Modify: `frontend/src/pages/Campaigns.tsx`

**Implementation:**

Add schedule option to send button:

```tsx
// Add imports
import { Calendar } from '../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

// Add state
const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined)
const [scheduleTime, setScheduleTime] = useState('09:00')
const [showScheduler, setShowScheduler] = useState(false)

// Function to handle scheduled send
const handleScheduledSend = () => {
  if (!scheduleDate) return
  const [hours, minutes] = scheduleTime.split(':').map(Number)
  const scheduledFor = new Date(scheduleDate)
  scheduledFor.setHours(hours, minutes, 0, 0)
  // Call send with scheduledFor parameter
  handleSend(scheduledFor.toISOString())
}

// Update handleSend to accept optional scheduledFor
const handleSend = (scheduledFor?: string) => {
  // ... existing logic, add scheduledFor to request body
}

// Replace send button with dropdown menu
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button disabled={!canSend}>
      Send Campaign
      <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => handleSend()}>
      Send Now
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => setShowScheduler(true)}>
      Schedule for later...
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// Add schedule popover (render conditionally when showScheduler is true)
{showScheduler && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="p-4 w-80">
      <h3 className="font-semibold mb-4">Schedule Campaign</h3>
      <Calendar
        mode="single"
        selected={scheduleDate}
        onSelect={setScheduleDate}
        disabled={(date) => date < new Date()}
        className="mb-4"
      />
      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm">Time:</label>
        <Input
          type="time"
          value={scheduleTime}
          onChange={(e) => setScheduleTime(e.target.value)}
          className="w-32"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setShowScheduler(false)}>Cancel</Button>
        <Button onClick={handleScheduledSend} disabled={!scheduleDate}>Schedule</Button>
      </div>
    </Card>
  </div>
)}
```

**Verify:** Build passes, can schedule campaigns.

---

### Task 3B: Scheduled Status in History

**Files:**
- Modify: `frontend/src/pages/History.tsx`

**Implementation:**

Show scheduled badge for scheduled campaigns:

```tsx
// In campaign status display, handle 'scheduled' status
{campaign.status === 'scheduled' && (
  <span className="inline-flex items-center gap-1 text-blue-600">
    <CalendarIcon className="h-3 w-3" />
    Scheduled
  </span>
)}

// Show scheduled time if available
{campaign.scheduledFor && (
  <span className="text-xs text-muted-foreground">
    {format(new Date(campaign.scheduledFor), 'MMM d, yyyy h:mm a')}
  </span>
)}
```

**Verify:** Build passes, scheduled campaigns show correct status.

---

## Phase 4: Preview with Merge Fields

### Task 4A: Backend Preview Endpoint

**Files:**
- Create: `server/src/routes/preview.ts`
- Modify: `server/src/index.ts`

**Implementation - preview.ts:**

```typescript
import { Router, Request, Response } from 'express'
import { compileTemplate, Block } from '../services/template-compiler'
import { logger } from '../lib/logger'

export const previewRouter = Router()

interface PreviewRequest {
  blocks: Block[]
  recipient: Record<string, string>
}

// POST /preview - Render email with merge fields
previewRouter.post('/', async (req: Request<{}, {}, PreviewRequest>, res: Response) => {
  try {
    const { blocks, recipient } = req.body

    if (!blocks || !Array.isArray(blocks)) {
      res.status(400).json({ error: 'blocks array is required' })
      return
    }

    if (!recipient || typeof recipient !== 'object') {
      res.status(400).json({ error: 'recipient object is required' })
      return
    }

    const html = compileTemplate(blocks, recipient)

    res.json({ html })
  } catch (error) {
    logger.error('Failed to generate preview', { service: 'preview' }, error as Error)
    res.status(500).json({ error: 'Failed to generate preview' })
  }
})
```

**Implementation - index.ts:**

```typescript
// Add import
import { previewRouter } from './routes/preview'

// Add route (with other authenticated routes)
app.use('/api/preview', authMiddleware, previewRouter)
```

**Verify:** Build passes.

---

### Task 4B: Campaign Composer Preview

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/Campaigns.tsx`

**Implementation - API:**

```typescript
// Add to api object
preview: (blocks: unknown[], recipient: Record<string, string>) =>
  request<{ html: string }>('/preview', {
    method: 'POST',
    body: JSON.stringify({ blocks, recipient }),
  }),
```

**Implementation - Campaigns.tsx:**

Add preview panel/tab to campaign composer:

```tsx
// Add state
const [showPreview, setShowPreview] = useState(false)
const [previewRecipientIndex, setPreviewRecipientIndex] = useState(0)
const [previewHtml, setPreviewHtml] = useState('')

// Add preview fetch function
const fetchPreview = async () => {
  if (!selectedMail?.blocks || recipients.length === 0) return
  try {
    const recipient = recipients[previewRecipientIndex] || recipients[0]
    const result = await api.preview(selectedMail.blocks, recipient)
    setPreviewHtml(result.html)
  } catch (error) {
    console.error('Preview failed:', error)
  }
}

// Fetch preview when showing
useEffect(() => {
  if (showPreview) {
    fetchPreview()
  }
}, [showPreview, previewRecipientIndex, selectedMail])

// Add preview toggle button
<Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
  {showPreview ? 'Hide Preview' : 'Show Preview'}
</Button>

// Add preview panel
{showPreview && (
  <Card className="mt-4">
    <CardHeader className="p-3 pb-2">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm">Preview</CardTitle>
        {recipients.length > 1 && (
          <select
            value={previewRecipientIndex}
            onChange={(e) => setPreviewRecipientIndex(Number(e.target.value))}
            className="text-xs border rounded px-2 py-1"
          >
            {recipients.map((r, i) => (
              <option key={i} value={i}>{r.email}</option>
            ))}
          </select>
        )}
      </div>
    </CardHeader>
    <CardContent className="p-3 pt-0">
      <div
        className="border rounded bg-white p-4 max-h-96 overflow-auto"
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </CardContent>
  </Card>
)}
```

**Verify:** Build passes, preview shows rendered email with merge fields.

---

### Task 4C: Mail Editor Preview

**Files:**
- Modify: `frontend/src/pages/MailLibrary.tsx`

**Implementation:**

Add preview button and modal to mail editor:

```tsx
// Add state
const [showPreview, setShowPreview] = useState(false)
const [previewHtml, setPreviewHtml] = useState('')
const [sampleData, setSampleData] = useState<Record<string, string>>({
  name: 'John Doe',
  email: 'john@example.com',
  company: 'Acme Inc',
})

// Add preview fetch
const fetchPreview = async () => {
  if (!selectedMail?.blocks) return
  try {
    const result = await api.preview(selectedMail.blocks, sampleData)
    setPreviewHtml(result.html)
  } catch (error) {
    console.error('Preview failed:', error)
  }
}

useEffect(() => {
  if (showPreview && selectedMail) {
    fetchPreview()
  }
}, [showPreview, selectedMail, sampleData])

// Add preview button in toolbar
<Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
  Preview
</Button>

// Add preview modal
{showPreview && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <Card className="w-[800px] max-h-[90vh] overflow-hidden">
      <CardHeader className="p-4 flex flex-row items-center justify-between">
        <CardTitle>Preview with Merge Fields</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>Close</Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex gap-4">
        <div className="w-48 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sample Data</p>
          {Object.entries(sampleData).map(([key, value]) => (
            <div key={key}>
              <label className="text-xs">{key}</label>
              <Input
                value={value}
                onChange={(e) => setSampleData({ ...sampleData, [key]: e.target.value })}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
        <div className="flex-1 border rounded bg-white p-4 max-h-[60vh] overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </CardContent>
    </Card>
  </div>
)}
```

**Verify:** Build passes, can preview mail with sample data.

---

## Commit Strategy

After each phase:
1. Run `bun run build` to verify
2. Commit with descriptive message
3. Run code review
4. Fix critical issues
5. Push and PR

**Commit messages:**
- Phase 1: `feat: add search/filter to campaigns, history, and mail library`
- Phase 2: `feat: add campaign and draft duplication`
- Phase 3: `feat: add scheduled sending UI`
- Phase 4: `feat: add email preview with merge fields`
