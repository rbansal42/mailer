# Mailer v2 Enhancements - Design Document

**Date:** January 31, 2026  
**Status:** Approved for implementation  
**Tracking Domain:** mailer.rbansal.xyz

## Overview

This document outlines enhancements to Mailer v2 across three focus areas:
1. **New sending capabilities** - scheduling, analytics, attachments, CC/BCC
2. **UI/UX improvements** - template editor, mobile support, accessibility
3. **Reliability/robustness** - error handling, validation, monitoring

## Implementation Phases

| Phase | Focus | Est. Effort |
|-------|-------|-------------|
| Phase 1 | Quick Wins + Foundation | 3-4 days |
| Phase 2 | Scheduling Foundation | 3-4 days |
| Phase 3 | Analytics & Tracking | 3-4 days |
| Phase 4 | Advanced Scheduling | 4-5 days |
| Phase 5 | UI/UX Polish | 4-5 days |

---

## Phase 1: Quick Wins + Foundation

### 1.1 CC/BCC Support

**Database changes:**
```sql
ALTER TABLE drafts ADD COLUMN cc TEXT;      -- JSON array of emails
ALTER TABLE drafts ADD COLUMN bcc TEXT;     -- JSON array of emails
ALTER TABLE campaigns ADD COLUMN cc TEXT;
ALTER TABLE campaigns ADD COLUMN bcc TEXT;
```

**API changes:**
- Update `/api/send` to accept `cc` and `bcc` arrays
- Validate email format for all CC/BCC entries

**Provider changes:**
- Extend `EmailProvider` interface in `base.ts`
- Update `gmail.ts` and `smtp.ts` to include CC/BCC in nodemailer options

**Frontend:**
- Add CC/BCC input fields in campaign composer (comma-separated or tag input)
- Collapsible section to reduce clutter

### 1.2 Smart Attachment Matching

#### Upload Methods

| Method | Implementation |
|--------|----------------|
| **ZIP upload** | Upload ZIP, server extracts to temp folder, processes files |
| **Drag-and-drop** | Multi-file drop zone in composer, uses File API |
| **Folder select** | `<input webkitdirectory>` for native folder picker |

#### Database

```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  draft_id INTEGER REFERENCES drafts(id),
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,           -- Path in /data/attachments/
  size_bytes INTEGER NOT NULL,
  mime_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE recipient_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  recipient_email TEXT NOT NULL,
  attachment_id INTEGER REFERENCES attachments(id),
  matched_by TEXT,                  -- 'column:name' | 'explicit'
  UNIQUE(campaign_id, recipient_email, attachment_id)
);
```

#### Matching Logic

User configures matching strategy per campaign:

```
┌─────────────────────────────────────────────────────────────┐
│ Attachment Matching                                          │
├─────────────────────────────────────────────────────────────┤
│ Match attachments by:  [Column value in filename ▼]          │
│ Column to match:       [name ▼]  (from CSV headers)          │
│                                                              │
│ Or: [ ] Use explicit 'attachment' column from CSV            │
└─────────────────────────────────────────────────────────────┘
```

**Matching modes:**
1. **Column value in filename** - filename contains value from chosen column
   - `John_Smith_certificate.pdf` matches row where `name = "John Smith"`
   - Normalizes: spaces → underscores, case-insensitive
2. **Explicit CSV column** - CSV has `attachment` column with exact filename
   - Row: `John,john@acme.com,john_cert.pdf` → attaches `john_cert.pdf`

#### Preview with Attachment Validation

```
┌─────────────────────────────────────────────────────────────┐
│ Preview                                    < [1/200] >       │
├─────────────────────────────────────────────────────────────┤
│ To: john@acme.com                                            │
│ Subject: Your Certificate is Ready                           │
│ Attachment: ✓ John_Smith_certificate.pdf (245 KB)            │
│ ─────────────────────────────────────────────────────────────│
│ Dear John,                                                   │
│ Please find your certificate attached...                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Attachment Summary                                           │
├─────────────────────────────────────────────────────────────┤
│ ✓ 198 recipients matched                                     │
│ ⚠ 2 recipients missing attachments:                          │
│   - jane@beta.com (no match for "Jane Doe")                  │
│   - bob@corp.com (no match for "Bob Wilson")                 │
│                                                              │
│ [ ] Skip recipients without attachments                      │
│ [ ] Send anyway without attachment                           │
└─────────────────────────────────────────────────────────────┘
```

#### Data Flow

```
Upload (ZIP/files/folder)
       │
       ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│ Extract/Save │ ──▶ │ Match to CSV    │ ──▶ │ Show Preview │
│ to temp dir  │     │ (by column)     │     │ with status  │
└──────────────┘     └─────────────────┘     └──────────────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Send with    │
                                            │ per-recipient│
                                            │ attachments  │
                                            └──────────────┘
```

#### Configuration

- Max file size: 10MB (configurable)
- Max attachments per email: 5 (configurable)
- Allowed MIME types: configurable whitelist
- Storage: `/data/attachments/{campaign_id}/`

### 1.3 Input Validation

- Add Zod schemas for all API endpoints
- Sanitize HTML in templates (prevent XSS)
- Validate email formats with RFC 5322 regex
- Validate file uploads (size, type, malware scan optional)

### 1.4 Error Logging

**Structured logging format:**
```json
{
  "timestamp": "2026-01-31T10:23:45.123Z",
  "level": "error",
  "requestId": "req_abc123",
  "service": "send",
  "message": "Failed to send email",
  "error": { "code": "ECONNREFUSED", "message": "..." },
  "context": { "campaignId": 42, "recipient": "john@..." }
}
```

- Log levels: debug, info, warn, error
- Request correlation IDs via middleware
- Log rotation (daily, keep 14 days)
- Separate error log file

### 1.5 Health Checks

Expand `/api/health` endpoint:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T10:23:45.123Z",
  "checks": {
    "database": { "status": "ok", "latencyMs": 2 },
    "disk": { "status": "ok", "freeGb": 45.2 },
    "queue": { "status": "ok", "pending": 12 },
    "accounts": { "status": "ok", "active": 3, "atCap": 1 }
  },
  "version": "2.1.0"
}
```

---

## Phase 2: Scheduling Foundation

### 2.1 One-Time Scheduled Sends

**Database changes:**
```sql
ALTER TABLE campaigns ADD COLUMN scheduled_for DATETIME;
ALTER TABLE campaigns ADD COLUMN status TEXT DEFAULT 'draft';
-- statuses: draft, scheduled, sending, paused, completed, cancelled, failed
```

**Scheduler service (`services/scheduler.ts`):**
- Cron job running every minute
- Query: `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_for <= NOW()`
- Trigger send logic, update status to 'sending'
- Handle server restarts gracefully (resume scheduled campaigns)

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Send Options                                                 │
├─────────────────────────────────────────────────────────────┤
│ ○ Send immediately                                           │
│ ● Schedule for later                                         │
│   Date: [2026-02-15]  Time: [09:00]  Timezone: [PST ▼]      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Database Backups

**Service (`services/backup.ts`):**
- Cron job (configurable, default: daily at 2 AM)
- Copy `mailer.db` to `data/backups/mailer_YYYY-MM-DD_HH-mm.db`
- Retention policy: keep last N backups (configurable, default: 7)
- Manual backup trigger via Settings page
- Optional: compress backups with gzip

**Settings UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Settings > Backups                                           │
├─────────────────────────────────────────────────────────────┤
│ Auto-backup schedule: [Daily at 2:00 AM ▼]                   │
│ Keep last: [7] backups                                       │
│                                                              │
│ Recent Backups:                                              │
│ • mailer_2026-01-31_02-00.db (2.4 MB) [Restore] [Download]  │
│ • mailer_2026-01-30_02-00.db (2.3 MB) [Restore] [Download]  │
│                                                              │
│ [Backup Now]                                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Retry Improvements

**Current:** Single retry with 1s delay

**Enhanced configuration:**
```typescript
const retryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,        // 1s, 2s, 4s (exponential backoff)
  maxDelay: 10000,
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', '5xx']
}
```

**Circuit breaker:**
- Track consecutive failures per account
- If account fails 5x consecutively, pause for 5 minutes
- Auto-resume after cooldown period
- Log circuit breaker state changes

**Database:**
```sql
ALTER TABLE send_logs ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE sender_accounts ADD COLUMN circuit_breaker_until DATETIME;
```

---

## Phase 3: Analytics & Tracking

### 3.1 Tracking Architecture

**New endpoints (no auth required):**
```
GET /t/:token/open.gif    → 1x1 transparent pixel, logs open
GET /t/:token/c/:linkId   → Redirects to original URL, logs click
```

**Database:**
```sql
CREATE TABLE tracking_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  recipient_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,        -- UUID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, recipient_email)
);

CREATE TABLE tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER REFERENCES tracking_tokens(id),
  event_type TEXT NOT NULL,          -- 'open' | 'click'
  link_url TEXT,                     -- Original URL for clicks
  link_index INTEGER,                -- Position in email (for click)
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX idx_tracking_events_token ON tracking_events(token_id);
CREATE INDEX idx_tracking_events_type ON tracking_events(event_type);
```

### 3.2 Email Modification at Send Time

**Template compiler enhancement:**

1. Generate unique tracking token per recipient
2. Inject tracking pixel before `</body>`:
   ```html
   <img src="https://mailer.rbansal.xyz/t/abc123/open.gif" width="1" height="1" style="display:block" alt="" />
   ```
3. Rewrite all `<a href="...">` links:
   ```html
   <!-- Before -->
   <a href="https://example.com/signup">Sign Up</a>
   <!-- After -->
   <a href="https://mailer.rbansal.xyz/t/abc123/c/0?url=https%3A%2F%2Fexample.com%2Fsignup">Sign Up</a>
   ```

### 3.3 Configuration

```
┌─────────────────────────────────────────────────────────────┐
│ Settings > Tracking                                          │
├─────────────────────────────────────────────────────────────┤
│ Tracking Base URL: [https://mailer.rbansal.xyz___________]  │
│                                                              │
│ [✓] Enable open tracking (pixel)                             │
│ [✓] Enable click tracking (link rewriting)                   │
│                                                              │
│ Privacy:                                                     │
│ [✓] Hash IP addresses before storing                         │
│ [ ] Respect Do Not Track header                              │
│ Auto-delete tracking data after: [90] days (0 = never)       │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Analytics Dashboard

**Campaign detail view:**
```
┌─────────────────────────────────────────────────────────────┐
│ Campaign: March Newsletter                                   │
├─────────────────────────────────────────────────────────────┤
│ Delivery        │ Engagement                                 │
│ ───────────     │ ───────────                                │
│ Sent: 200       │ Opens: 89 (44.5%)                          │
│ Failed: 3       │ Unique opens: 76 (38%)                     │
│ Bounced: 2      │ Clicks: 34 (17%)                           │
│                 │ Unique clicks: 28 (14%)                    │
├─────────────────┴───────────────────────────────────────────┤
│ Opens Over Time (48h)                                        │
│ ▁▂▄▇█▇▅▃▂▁▁▁                                                │
├─────────────────────────────────────────────────────────────┤
│ Top Clicked Links                                            │
│ 1. https://example.com/signup - 18 clicks                    │
│ 2. https://example.com/docs - 12 clicks                      │
│ 3. https://example.com/pricing - 4 clicks                    │
├─────────────────────────────────────────────────────────────┤
│ Recipients                              [Export CSV]         │
│ ┌────────────────┬────────┬────────┬─────────────────────┐  │
│ │ Email          │ Status │ Opened │ Clicked             │  │
│ ├────────────────┼────────┼────────┼─────────────────────┤  │
│ │ john@acme.com  │ ✓ Sent │ 3x     │ signup, docs        │  │
│ │ jane@beta.com  │ ✓ Sent │ 1x     │ -                   │  │
│ │ bob@corp.com   │ ✓ Sent │ -      │ -                   │  │
│ └────────────────┴────────┴────────┴─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 4: Advanced Scheduling

### 4.1 Recurring Campaigns

**Database:**
```sql
CREATE TABLE recurring_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT NOT NULL,
  recipient_source TEXT NOT NULL,    -- 'static' | 'csv_url' | 'api'
  recipient_data TEXT,               -- JSON: static list or fetch config
  schedule_cron TEXT NOT NULL,       -- "0 9 * * 1" = Monday 9am
  timezone TEXT DEFAULT 'UTC',
  enabled INTEGER DEFAULT 1,
  last_run_at DATETIME,
  next_run_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Recipient sources:**
1. **Static** - CSV data stored in `recipient_data`
2. **CSV URL** - Fetch fresh CSV from URL before each send
3. **API** - POST to endpoint, expect JSON array response

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Recurring Campaign: Weekly Newsletter                        │
├─────────────────────────────────────────────────────────────┤
│ Template: [Newsletter v2 ▼]                                  │
│ Subject: [Weekly Update - {{date}}____________________]     │
├─────────────────────────────────────────────────────────────┤
│ Schedule:                                                    │
│ Frequency: [Weekly ▼]  Day: [Monday ▼]  Time: [09:00]       │
│ Timezone: [America/Los_Angeles ▼]                            │
├─────────────────────────────────────────────────────────────┤
│ Recipients:                                                  │
│ ○ Static list (paste CSV)                                    │
│ ● Fetch from URL: [https://api.example.com/subscribers.csv] │
│ ○ API endpoint: [POST https://...]                           │
├─────────────────────────────────────────────────────────────┤
│ Next run: Mon Feb 3, 2026 at 9:00 AM PST                     │
│ Last run: Mon Jan 27, 2026 - 142 sent, 0 failed              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Drip Sequences

**Database:**
```sql
CREATE TABLE sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sequence_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER REFERENCES sequences(id),
  step_order INTEGER NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT NOT NULL,
  delay_days INTEGER NOT NULL,       -- Days after previous step
  delay_hours INTEGER DEFAULT 0,
  send_time TEXT,                    -- Optional: "09:00" to send at specific time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sequence_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id INTEGER REFERENCES sequences(id),
  recipient_email TEXT NOT NULL,
  recipient_data TEXT,               -- JSON variables
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',      -- 'active' | 'paused' | 'completed' | 'cancelled'
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_send_at DATETIME,
  completed_at DATETIME,
  UNIQUE(sequence_id, recipient_email)
);

CREATE INDEX idx_enrollments_next_send ON sequence_enrollments(next_send_at) 
  WHERE status = 'active';
```

**UI - Sequence Builder:**
```
┌─────────────────────────────────────────────────────────────┐
│ Sequence: Onboarding Flow                          [+ Step] │
├─────────────────────────────────────────────────────────────┤
│ Step 1: Welcome Email                                        │
│ Template: Welcome Template    Delay: Immediately             │
├─────────────────────────────────────────────────────────────┤
│ Step 2: Getting Started Guide                                │
│ Template: Getting Started     Delay: 2 days after Step 1     │
├─────────────────────────────────────────────────────────────┤
│ Step 3: Pro Tips                                             │
│ Template: Pro Tips            Delay: 5 days after Step 2     │
├─────────────────────────────────────────────────────────────┤
│ Step 4: Feedback Request                                     │
│ Template: Feedback            Delay: 7 days after Step 3     │
└─────────────────────────────────────────────────────────────┘
```

**UI - Enrollment Management:**
```
┌─────────────────────────────────────────────────────────────┐
│ Enrollments                                   [+ Add Users] │
├─────────────────────────────────────────────────────────────┤
│ Active: 23  │  Completed: 156  │  Cancelled: 4              │
├─────────────────────────────────────────────────────────────┤
│ john@acme.com    Step 2/4    Next: Feb 5    [Pause][Cancel] │
│ jane@beta.com    Step 3/4    Next: Feb 8    [Pause][Cancel] │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Timezone-Aware Delivery

**Approach:**
- Recipient data includes optional `timezone` column (IANA format)
- Campaign setting: "Deliver at recipient's local time"
- System groups recipients by timezone, creates time-based batches
- Scheduler processes each batch at appropriate UTC time

**Example batch creation:**
```
Campaign: "Send at 9:00 AM recipient local time"

Recipients:
├── john@acme.com (America/New_York, UTC-5)    → Send at 14:00 UTC
├── jane@beta.com (Europe/London, UTC+0)       → Send at 09:00 UTC
├── bob@corp.com (Asia/Tokyo, UTC+9)           → Send at 00:00 UTC
└── lisa@startup.io (America/Los_Angeles, UTC-8) → Send at 17:00 UTC

Batches created:
├── Batch 1: 00:00 UTC → bob@corp.com
├── Batch 2: 09:00 UTC → jane@beta.com
├── Batch 3: 14:00 UTC → john@acme.com
└── Batch 4: 17:00 UTC → lisa@startup.io
```

**Database:**
```sql
CREATE TABLE scheduled_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  scheduled_for DATETIME NOT NULL,
  recipient_emails TEXT NOT NULL,    -- JSON array
  status TEXT DEFAULT 'pending',     -- 'pending' | 'sending' | 'completed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**UI addition:**
```
┌─────────────────────────────────────────────────────────────┐
│ Timezone Handling:                                           │
│ ○ Send all at once (ignore timezones)                        │
│ ● Deliver at local time: [09:00] using column: [timezone ▼] │
│   (Column should contain IANA timezone, e.g., America/New_York)
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 5: UI/UX Polish

### 5.1 Improved Template Editor

#### Undo/Redo System

**UI - Toolbar buttons:**
```
┌─────────────────────────────────────────────────────────────┐
│ [↶ Undo] [↷ Redo] │ [Save] [Preview]      Template: My Email │
├─────────────────────────────────────────────────────────────┤
```

**Keyboard shortcuts:**
- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` - Redo

**Implementation:**
- State history stack (max 50 entries)
- Debounce text input (batch rapid keystrokes)
- Clear redo stack on new action

#### Other Editor Enhancements

| Feature | Implementation |
|---------|----------------|
| **Rich text editing** | TipTap or Lexical editor for text blocks |
| **Block duplication** | "Duplicate" button on each block hover |
| **Block templates** | Save block combinations as reusable snippets |
| **Variable autocomplete** | Type `{{` to get dropdown of available variables |
| **Image upload** | Direct upload to `/data/images/`, return URL |
| **Color picker** | Inline color picker for backgrounds, text, buttons |

#### All Keyboard Shortcuts

```
Ctrl+S        Save template
Ctrl+Z        Undo
Ctrl+Shift+Z  Redo
Ctrl+D        Duplicate selected block
Delete        Remove selected block
↑/↓           Navigate between blocks
Escape        Deselect block
```

### 5.2 Mobile-Responsive Design

**Breakpoints:**
```
< 640px   Mobile: Single column, hamburger nav, stacked layout
640-1024  Tablet: Condensed sidebar, stacked composer
> 1024px  Desktop: Full layout as designed
```

**Mobile adaptations:**
- Collapsible sidebar (hamburger menu)
- Composer: recipients section above preview (stacked)
- Touch-friendly controls (44px minimum tap targets)
- Swipe left/right for preview navigation
- Bottom sheet for block properties (instead of sidebar)

### 5.3 Better Preview Experience

```
┌─────────────────────────────────────────────────────────────┐
│ Preview                          [Desktop] [Mobile] [Dark]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  ┌───────────────────────────────┐                      │ │
│ │  │      (Mobile frame 320px)     │                      │ │
│ │  │  ┌─────────────────────────┐  │                      │ │
│ │  │  │ Hello John,             │  │                      │ │
│ │  │  │                         │  │                      │ │
│ │  │  │ Welcome to...           │  │                      │ │
│ │  │  └─────────────────────────┘  │                      │ │
│ │  └───────────────────────────────┘                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                        < [1/47] >                            │
│                                                              │
│ [Send Test Email] [View HTML Source]                         │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Desktop (600px) / Mobile (320px) width toggle
- Dark mode preview (simulate dark email clients)
- Send test email button
- HTML source view toggle
- Keyboard navigation (←/→ for recipients)

### 5.4 Drag-and-Drop Improvements

**Library:** `@dnd-kit/core` for accessibility and touch support

**Enhancements:**
- Visual drop indicator (line between blocks)
- Smooth animations during drag (transform, opacity)
- Ghost preview of dragged block
- Auto-scroll when dragging near container edges
- Full touch support for mobile/tablet
- Keyboard-accessible reordering (select block, use ↑↓ with modifier)

### 5.5 Accessibility (a11y)

| Area | Implementation |
|------|----------------|
| **Focus management** | Visible focus rings (2px outline), logical tab order |
| **ARIA labels** | All buttons, inputs, and interactive elements labeled |
| **Live regions** | `aria-live` for send progress, toast notifications |
| **Screen reader** | Announce block selection, form errors, status changes |
| **Color contrast** | WCAG AA compliance (4.5:1 text, 3:1 UI components) |
| **Keyboard nav** | Full keyboard operability, no mouse required |
| **Reduced motion** | Respect `prefers-reduced-motion` media query |
| **Skip links** | "Skip to main content" link for keyboard users |

---

## Technical Summary

### New Database Tables

| Table | Phase | Purpose |
|-------|-------|---------|
| `attachments` | 1 | Store uploaded attachment metadata |
| `recipient_attachments` | 1 | Map attachments to recipients |
| `tracking_tokens` | 3 | Per-recipient tracking identifiers |
| `tracking_events` | 3 | Open and click event log |
| `recurring_campaigns` | 4 | Recurring send configuration |
| `sequences` | 4 | Drip sequence definitions |
| `sequence_steps` | 4 | Individual steps in sequences |
| `sequence_enrollments` | 4 | Recipients enrolled in sequences |
| `scheduled_batches` | 4 | Timezone-based send batches |

### New Services

| Service | Phase | Purpose |
|---------|-------|---------|
| `services/attachment-matcher.ts` | 1 | Match files to recipients |
| `services/backup.ts` | 2 | Database backup management |
| `services/scheduler.ts` | 2 | Scheduled campaign processing |
| `services/tracking.ts` | 3 | Open/click event handling |
| `services/sequence-processor.ts` | 4 | Drip sequence step execution |

### New API Endpoints

| Endpoint | Phase | Purpose |
|----------|-------|---------|
| `POST /api/attachments/upload` | 1 | Upload ZIP/files |
| `POST /api/attachments/match` | 1 | Run matching algorithm |
| `GET /api/health` (enhanced) | 1 | Detailed health status |
| `POST /api/backups` | 2 | Trigger manual backup |
| `GET /api/backups` | 2 | List available backups |
| `POST /api/backups/:id/restore` | 2 | Restore from backup |
| `GET /t/:token/open.gif` | 3 | Track email open |
| `GET /t/:token/c/:linkId` | 3 | Track link click |
| `GET /api/campaigns/:id/analytics` | 3 | Campaign analytics data |
| `CRUD /api/recurring` | 4 | Recurring campaign management |
| `CRUD /api/sequences` | 4 | Drip sequence management |
| `POST /api/sequences/:id/enroll` | 4 | Enroll recipients |

---

## Next Steps

1. Create implementation plan for Phase 1
2. Set up git worktree for isolated development
3. Implement Phase 1 features
4. Review and test before proceeding to Phase 2
