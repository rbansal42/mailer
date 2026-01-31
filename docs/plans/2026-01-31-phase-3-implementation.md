# Phase 3: Analytics & Tracking - Implementation Plan

**Date:** January 31, 2026
**Branch:** `feature/phase-3-analytics`
**Worktree:** `/Volumes/Code/mailer/.worktrees/phase-3`
**Tracking Domain:** `mailer.rbansal.xyz`

## Overview

Implement email open and click tracking with analytics dashboard.

## Tasks

### Task 1: Database Schema - Tracking Tables
**Priority:** High | **Parallelizable:** Yes

Add tracking tables to `server/src/db/index.ts`:

```sql
CREATE TABLE IF NOT EXISTS tracking_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  recipient_email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, recipient_email)
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER REFERENCES tracking_tokens(id),
  event_type TEXT NOT NULL,
  link_url TEXT,
  link_index INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_token ON tracking_events(token_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_tokens_token ON tracking_tokens(token);
```

**Acceptance Criteria:**
- [ ] Tables created on server startup
- [ ] Indexes for fast lookups
- [ ] TypeScript compiles

---

### Task 2: Settings - Tracking Configuration
**Priority:** High | **Parallelizable:** Yes (with Task 1)

Add tracking settings to settings table and API.

**Database:**
```sql
-- Add to settings table initialization
INSERT OR IGNORE INTO settings (key, value) VALUES 
  ('tracking_enabled', 'true'),
  ('tracking_base_url', 'https://mailer.rbansal.xyz'),
  ('tracking_open_enabled', 'true'),
  ('tracking_click_enabled', 'true'),
  ('tracking_hash_ips', 'true'),
  ('tracking_retention_days', '90');
```

**API Updates (`server/src/routes/settings.ts`):**
- GET /api/settings/tracking - get tracking settings
- PUT /api/settings/tracking - update tracking settings

**Acceptance Criteria:**
- [ ] Settings stored in database
- [ ] API endpoints for get/update
- [ ] TypeScript compiles

---

### Task 3: Tracking Service
**Priority:** High | **Parallelizable:** No (depends on Task 1)

Create `server/src/services/tracking.ts`:

```typescript
interface TrackingToken {
  id: number
  campaignId: number
  recipientEmail: string
  token: string
  createdAt: string
}

interface TrackingEvent {
  id: number
  tokenId: number
  eventType: 'open' | 'click'
  linkUrl?: string
  linkIndex?: number
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

// Generate or get existing token for recipient
function getOrCreateToken(campaignId: number, recipientEmail: string): string

// Record an open event
function recordOpen(token: string, ipAddress?: string, userAgent?: string): boolean

// Record a click event
function recordClick(token: string, linkUrl: string, linkIndex: number, ipAddress?: string, userAgent?: string): boolean

// Get token details
function getTokenDetails(token: string): TrackingToken | null

// Hash IP address for privacy
function hashIpAddress(ip: string): string

// Get analytics for campaign
function getCampaignAnalytics(campaignId: number): CampaignAnalytics
```

**Acceptance Criteria:**
- [ ] Token generation with UUID
- [ ] Open/click event recording
- [ ] IP hashing when enabled
- [ ] Analytics aggregation
- [ ] TypeScript compiles

---

### Task 4: Tracking Routes
**Priority:** High | **Parallelizable:** Yes (with Task 5, after Task 3)

Create `server/src/routes/tracking.ts`:

```typescript
// GET /t/:token/open.gif - 1x1 transparent pixel
trackingRouter.get('/:token/open.gif', (req, res) => {
  // Record open event
  // Return 1x1 transparent GIF
})

// GET /t/:token/c/:linkIndex - Click redirect
trackingRouter.get('/:token/c/:linkIndex', (req, res) => {
  // Get original URL from query param
  // Record click event
  // Redirect to original URL
})
```

**Note:** These routes are PUBLIC (no auth required).

**Acceptance Criteria:**
- [ ] Open tracking returns 1x1 GIF
- [ ] Click tracking redirects correctly
- [ ] Events recorded in database
- [ ] No authentication required
- [ ] TypeScript compiles

---

### Task 5: Template Compiler - Tracking Injection
**Priority:** High | **Parallelizable:** Yes (with Task 4, after Task 3)

Update `server/src/services/template-compiler.ts`:

```typescript
// New function to inject tracking
function injectTracking(html: string, trackingToken: string, baseUrl: string, options: TrackingOptions): string {
  let result = html
  
  // Inject open pixel before </body>
  if (options.openTracking) {
    const pixel = `<img src="${baseUrl}/t/${trackingToken}/open.gif" width="1" height="1" style="display:block" alt="" />`
    result = result.replace('</body>', `${pixel}</body>`)
  }
  
  // Rewrite links for click tracking
  if (options.clickTracking) {
    let linkIndex = 0
    result = result.replace(/<a\s+href="([^"]+)"/gi, (match, url) => {
      // Skip mailto: and tel: links
      if (url.startsWith('mailto:') || url.startsWith('tel:')) return match
      const trackingUrl = `${baseUrl}/t/${trackingToken}/c/${linkIndex++}?url=${encodeURIComponent(url)}`
      return `<a href="${trackingUrl}"`
    })
  }
  
  return result
}
```

**Acceptance Criteria:**
- [ ] Pixel injected before </body>
- [ ] Links rewritten with tracking URLs
- [ ] mailto/tel links preserved
- [ ] URL properly encoded
- [ ] TypeScript compiles

---

### Task 6: Analytics API
**Priority:** Medium | **Parallelizable:** No (depends on Task 3)

Create `server/src/routes/analytics.ts`:

```typescript
// GET /api/campaigns/:id/analytics
analyticsRouter.get('/campaigns/:id/analytics', (req, res) => {
  // Return:
  // - Total sent, failed
  // - Opens (total + unique)
  // - Clicks (total + unique)
  // - Open rate, click rate
  // - Top clicked links
  // - Opens over time (hourly buckets for 48h)
  // - Per-recipient data
})
```

**Response shape:**
```typescript
interface CampaignAnalytics {
  delivery: {
    sent: number
    failed: number
    queued: number
  }
  engagement: {
    opens: number
    uniqueOpens: number
    openRate: number
    clicks: number
    uniqueClicks: number
    clickRate: number
  }
  topLinks: Array<{
    url: string
    clicks: number
  }>
  opensOverTime: Array<{
    hour: string
    count: number
  }>
  recipients: Array<{
    email: string
    status: string
    opens: number
    clicks: string[]
  }>
}
```

**Acceptance Criteria:**
- [ ] Aggregated analytics returned
- [ ] Rates calculated correctly
- [ ] Top links sorted by clicks
- [ ] Time series for opens
- [ ] Per-recipient breakdown
- [ ] TypeScript compiles

---

### Task 7: Integrate Tracking into Send Flow
**Priority:** High | **Parallelizable:** No (depends on Tasks 3, 5)

Update `server/src/routes/send.ts`:

1. Before sending each email:
   - Get tracking settings
   - Generate tracking token for recipient
   - Inject tracking into compiled HTML

```typescript
// In send loop, after compiling HTML:
const trackingSettings = getTrackingSettings()
if (trackingSettings.enabled) {
  const token = getOrCreateToken(campaignId, recipient.email)
  html = injectTracking(html, token, trackingSettings.baseUrl, {
    openTracking: trackingSettings.openEnabled,
    clickTracking: trackingSettings.clickEnabled
  })
}
```

**Acceptance Criteria:**
- [ ] Tracking token created per recipient
- [ ] HTML modified before send
- [ ] Respects tracking settings
- [ ] Works with existing send flow
- [ ] TypeScript compiles

---

### Task 8: Register Routes and Build
**Priority:** High | **Parallelizable:** No (depends on all)

Update `server/src/index.ts`:
- Import and mount tracking routes at `/t`
- Import and mount analytics routes

```typescript
import { trackingRouter } from './routes/tracking'
import { analyticsRouter } from './routes/analytics'

// Public routes (no auth)
app.use('/t', trackingRouter)

// Protected routes
app.use('/api', analyticsRouter)
```

**Acceptance Criteria:**
- [ ] All routes registered
- [ ] Tracking routes are public
- [ ] TypeScript compiles (`bunx tsc --noEmit`)
- [ ] Build succeeds (`bun run build`)
- [ ] Server starts without errors

---

## Execution Plan

### Parallel Group 1
- **Task 1:** Database schema
- **Task 2:** Settings API

### Sequential (after Group 1)
- **Task 3:** Tracking service

### Parallel Group 2 (after Task 3)
- **Task 4:** Tracking routes
- **Task 5:** Template compiler updates

### Sequential (after Group 2)
- **Task 6:** Analytics API
- **Task 7:** Integrate into send flow
- **Task 8:** Register routes and build

---

## Files to Create/Modify

| File | Action | Task |
|------|--------|------|
| `server/src/db/index.ts` | Modify | T1 |
| `server/src/routes/settings.ts` | Modify | T2 |
| `server/src/services/tracking.ts` | Create | T3 |
| `server/src/routes/tracking.ts` | Create | T4 |
| `server/src/services/template-compiler.ts` | Modify | T5 |
| `server/src/routes/analytics.ts` | Create | T6 |
| `server/src/routes/send.ts` | Modify | T7 |
| `server/src/index.ts` | Modify | T8 |

---

## Testing

After implementation:
1. Create a campaign with tracking enabled
2. Send test email
3. Open email (should trigger pixel load)
4. Click link (should redirect through tracking)
5. Check analytics endpoint for recorded events
