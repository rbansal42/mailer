# Quick Wins + Preview Feature Design

## Overview

Four features to improve campaign management UX:

1. **Scheduled Sending** - Queue campaigns for future delivery
2. **Search/Filter** - Find campaigns, mails, and history quickly
3. **Campaign Duplication** - Copy drafts and sent campaigns
4. **Preview with Merge Fields** - See rendered emails with recipient data

## Feature 1: Scheduled Sending

### Current State
- Backend already supports `scheduledFor` parameter in `send.ts`
- Creates campaign with status `'scheduled'` and stores in `email_queue`
- No UI to access this feature

### Implementation
- Add dropdown menu to "Send Campaign" button: "Send Now" / "Schedule..."
- When scheduling, show date/time picker popover
- Pass `scheduledFor` ISO string to send endpoint
- Show "Scheduled" badge in History page

### UI Components
- `DropdownMenu` from shadcn/ui (already in project)
- `Popover` + `Calendar` for date picker
- Time input (simple select or input)

---

## Feature 2: Search/Filter

### Current State
- Contacts have server-side search with pagination
- Lists page has client-side filtering
- Campaigns, History, MailLibrary have no search

### Implementation
Client-side filtering (data volumes are small):

| Page | Fields to search |
|------|------------------|
| Campaigns.tsx (drafts) | name, subject |
| History.tsx | name, date range |
| MailLibrary.tsx | name, description |

### UI Pattern
Reuse existing pattern from Lists.tsx:
```tsx
<div className="relative mb-4">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input placeholder="Search..." value={search} onChange={...} className="pl-9" />
</div>
```

---

## Feature 3: Campaign Duplication

### Current State
- No duplication feature exists
- Mails have "save as template" but not duplicate

### Implementation

**Duplicate Draft:**
- Backend: `POST /api/drafts/:id/duplicate`
- Returns new draft with name "Copy of {original}"
- Frontend: Add duplicate button to draft cards

**Duplicate from History:**
- Backend: `POST /api/campaigns/:id/duplicate`
- Creates new draft from sent campaign data
- Frontend: Add "Duplicate to Draft" in campaign details

---

## Feature 4: Preview with Merge Fields

### Current State
- `compileTemplate()` in template-compiler.ts handles variable substitution
- No preview UI exists

### Implementation

**Backend:**
- `POST /api/preview` - accepts blocks + recipient data, returns HTML
- Reuses `compileTemplate()` function

**Campaign Composer Preview:**
- Add "Preview" tab in compose view
- Recipient dropdown to select whose data to preview
- Renders compiled HTML in iframe or sanitized div

**Mail Editor Preview:**
- Add "Preview" button in toolbar
- Modal with sample data form (JSON or fields)
- Shows rendered email

---

## Phases

### Phase 1: Search/Filter (Independent - 3 pages)
- Task 1A: Campaigns.tsx search
- Task 1B: History.tsx search + date filter
- Task 1C: MailLibrary.tsx search

### Phase 2: Campaign Duplication (Backend + Frontend)
- Task 2A: Backend duplicate endpoints
- Task 2B: Frontend duplicate UI

### Phase 3: Scheduled Sending (Backend ready, Frontend needed)
- Task 3A: Schedule UI in campaign composer
- Task 3B: Scheduled status display in History

### Phase 4: Preview with Merge Fields
- Task 4A: Backend preview endpoint
- Task 4B: Campaign composer preview
- Task 4C: Mail editor preview
