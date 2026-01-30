# Mailer v2 - Design Document

**Date:** January 31, 2026  
**Status:** Approved for implementation

## Overview

Mailer v2 is a major enhancement to the self-hosted bulk email application, adding a modern React frontend, multi-account sending with smart rate limiting, and Docker deployment using Bun.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun (oven/bun:alpine) |
| **Frontend** | Vite + React + Shadcn/ui + Tailwind |
| **Backend** | Express (on Bun) + Bun SQLite |
| **Database** | SQLite (embedded) |
| **Auth** | Single shared password + JWT |
| **Bundler** | Bun for both frontend and backend |
| **Deployment** | Docker Compose, port 3342 |

## Features Summary

| Category | Features |
|----------|----------|
| **Authentication** | Single shared password, JWT tokens (7-day), first-run setup |
| **Templates** | Block-based editor (header, text, image, button, divider, columns, footer), drag/drop, live preview |
| **Composer** | CSV/TSV import, auto-variable detection, recipient validation, duplicate detection, per-recipient preview |
| **Multi-Account** | Multiple Gmail/SMTP accounts, priority ordering, daily + per-campaign caps, automatic switching |
| **Sending** | Sequential with cap awareness, retry logic, real-time SSE progress, cancel support |
| **Queue** | Auto-queue when all accounts at cap, midnight processing, manual trigger option |
| **History** | Campaign list, per-recipient logs, retry failed, export CSV, duplicate campaign |
| **Providers** | Gmail (App Password) + Generic SMTP, encrypted credential storage |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              React Frontend (Vite + Shadcn)                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐     │
│  │Campaigns│ │Templates│ │ History │ │   Settings    │     │
│  │ Composer│ │  Editor │ │   List  │ │  (Accounts)   │     │
│  └─────────┘ └─────────┘ └─────────┘ └───────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │ REST API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express Backend (Bun)                      │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     │
│  │  Auth  │ │ Campaign │ │ Template │ │   Account    │     │
│  │  (JWT) │ │  Service │ │  Service │ │   Manager    │     │
│  └────────┘ └──────────┘ └──────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐    ┌──────────┐    ┌──────────┐
     │ SQLite  │    │  Gmail   │    │   SMTP   │
     │(bun:sql)│    │   API    │    │ (generic)│
     └─────────┘    └──────────┘    └──────────┘
```

## Project Structure

```
mailer/
├── server/
│   ├── index.ts              # Express entry
│   ├── db.ts                 # Bun SQLite setup
│   ├── routes/
│   │   ├── auth.ts           # Login/logout
│   │   ├── templates.ts      # Template CRUD
│   │   ├── campaigns.ts      # Campaign/draft CRUD
│   │   ├── accounts.ts       # Sender account CRUD
│   │   └── send.ts           # Send + SSE progress
│   ├── services/
│   │   ├── account-manager.ts
│   │   ├── email-queue.ts
│   │   └── template-compiler.ts
│   └── providers/
│       ├── base.ts
│       ├── gmail.ts
│       └── smtp.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Shadcn components
│   │   │   ├── template-editor/
│   │   │   ├── composer/
│   │   │   └── common/
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── Templates.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── vite.config.ts
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json              # Workspace root
```

---

## Database Schema

```sql
-- App settings (password hash, general config)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sender accounts (multiple per provider type)
CREATE TABLE sender_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,     -- 'gmail' | 'smtp'
  config TEXT NOT NULL,            -- JSON (encrypted credentials)
  daily_cap INTEGER DEFAULT 500,
  campaign_cap INTEGER DEFAULT 100,
  priority INTEGER DEFAULT 0,      -- Lower = used first
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily send tracking (resets at midnight)
CREATE TABLE send_counts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES sender_accounts(id),
  date TEXT NOT NULL,              -- 'YYYY-MM-DD'
  count INTEGER DEFAULT 0,
  UNIQUE(account_id, date)
);

-- Email templates (block-based)
CREATE TABLE templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  blocks TEXT NOT NULL,            -- JSON array of blocks
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Saved drafts (work in progress)
CREATE TABLE drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT,
  recipients TEXT,                 -- JSON array
  variables TEXT,                  -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sent campaign history
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  template_id INTEGER REFERENCES templates(id),
  subject TEXT NOT NULL,
  total_recipients INTEGER NOT NULL,
  successful INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  queued INTEGER DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual send logs
CREATE TABLE send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  account_id INTEGER REFERENCES sender_accounts(id),
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL,            -- 'success' | 'failed' | 'queued'
  error_message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled/queued emails (when all accounts hit cap)
CREATE TABLE email_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  recipient_email TEXT NOT NULL,
  recipient_data TEXT NOT NULL,    -- JSON
  scheduled_for TEXT NOT NULL,     -- 'YYYY-MM-DD'
  status TEXT DEFAULT 'pending',   -- 'pending' | 'sent' | 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Authentication

### Flow

1. First-time setup: If no password exists, prompt to create one
2. Password stored as bcrypt hash in `settings` table
3. Login returns JWT token (7-day expiry)
4. Token stored in localStorage, sent as `Authorization: Bearer <token>`
5. All `/api/*` routes protected except `/api/auth/login` and `/api/health`

### Environment Variables

```bash
JWT_SECRET=              # Auto-generated if missing
ENCRYPTION_KEY=          # For SMTP credentials (32 chars)
PORT=3342
```

---

## Multi-Account System

### Account Switching Logic

Accounts are used sequentially by priority until caps are reached:

```
For each recipient in campaign:
  │
  ├─▶ account = getNextAvailableAccount(campaignId)
  │
  ├─▶ if account exists:
  │     ├─▶ Send email via account
  │     ├─▶ Increment daily count
  │     ├─▶ Increment campaign count for this account
  │     └─▶ Continue
  │
  └─▶ if no account available:
        ├─▶ Queue email for tomorrow
        └─▶ Continue
```

### Cap Configuration

- **Daily cap**: Max emails per calendar day (resets at midnight)
- **Campaign cap**: Max emails per single campaign
- Both caps apply simultaneously
- Accounts ordered by priority (drag to reorder in UI)

### Queue Processing

- Queued emails scheduled for next calendar day
- `node-cron` job runs at 00:01 to process queue
- Manual "Process Now" button available in UI

---

## Block-Based Template Editor

### Block Types

| Block | Props |
|-------|-------|
| **Header** | imageUrl, backgroundColor, height |
| **Text** | content, fontSize, align, color |
| **Image** | url, alt, width, align |
| **Button** | label, url, color, align |
| **Divider** | style (solid/dashed), color, spacing |
| **Spacer** | height |
| **Columns** | count (2-3), content per column |
| **Footer** | text, links, socialIcons |

### Block Data Structure

```json
{
  "id": "block_abc123",
  "type": "text",
  "props": {
    "content": "Hello {{name}}, welcome to {{company}}!",
    "fontSize": 16,
    "align": "left"
  }
}
```

### Template Compilation

On save/send, blocks are compiled to inline-CSS HTML for email client compatibility. Variables (`{{name}}`) are replaced with recipient data at send time.

---

## Campaign Composer

### Recipient Validation

| Check | Behavior |
|-------|----------|
| Format detection | Auto-detect CSV vs TSV |
| Header parsing | First row as variable names |
| Email validation | Regex check, highlight invalid |
| Duplicate detection | Warn about duplicate emails |
| Variable matching | Alert if template uses undefined variable |
| Missing data | Warn if recipient row has empty required fields |

### Preview Navigation

- Step through recipients to see personalized output
- Shows exact email that will be sent
- Subject line also shows variable replacement

### Test Send

- "Send Test" button sends to configured test email
- Uses first recipient's data for personalization
- Helps verify email appearance before bulk send

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| Auth failure | Stop immediately, prompt reconfigure |
| Rate limit (429) | Switch to next account |
| Temporary (timeout, 5xx) | Retry once with 1s backoff |
| Permanent (invalid email) | Log and skip |
| All accounts exhausted | Queue remaining for tomorrow |

### Retry Logic

```javascript
async sendWithRetry(email, account, attempt = 1) {
  try {
    await account.send(email);
    return { success: true };
  } catch (error) {
    if (isTemporary(error) && attempt < 2) {
      await delay(1000 * attempt);
      return sendWithRetry(email, account, attempt + 1);
    }
    if (isRateLimit(error)) {
      return { retry: true, reason: 'rate_limit' };
    }
    return { success: false, error: error.message };
  }
}
```

---

## Provider Abstraction

### Base Interface

```typescript
interface EmailProvider {
  connect(): Promise<void>;
  send(options: { to: string; cc?: string; subject: string; html: string }): Promise<void>;
  disconnect(): Promise<void>;
  verify(): Promise<boolean>;
}
```

### Gmail Provider

```typescript
class GmailProvider implements EmailProvider {
  constructor(config: { email: string; appPassword: string });
}
```

### Generic SMTP Provider

```typescript
class SmtpProvider implements EmailProvider {
  constructor(config: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  });
}
```

---

## Docker Deployment

### Dockerfile (Bun with bundling)

```dockerfile
# Build frontend
FROM oven/bun:alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lockb ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# Build backend (bundled)
FROM oven/bun:alpine AS backend-build
WORKDIR /app/server
COPY server/package.json server/bun.lockb ./
RUN bun install --frozen-lockfile
COPY server/ ./
RUN bun build ./index.ts --target=bun --outfile=server.js

# Production image
FROM oven/bun:alpine
WORKDIR /app

# Copy bundled backend
COPY --from=backend-build /app/server/server.js ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3342
CMD ["bun", "run", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  mailer:
    build: .
    container_name: mailer
    restart: unless-stopped
    ports:
      - "3342:3342"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3342
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - TZ=America/Los_Angeles
```

### .env.example

```bash
JWT_SECRET=your-random-secret-here-min-32-chars
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Commands

```bash
# First run
docker-compose up -d

# View logs
docker-compose logs -f

# Backup database
cp data/mailer.db data/mailer.db.backup

# Update
git pull && docker-compose build && docker-compose up -d
```

---

## UI Layouts

### Accounts Settings

```
┌─────────────────────────────────────────────────────────────┐
│ Settings > Sender Accounts                      [+ Add New] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ⋮⋮ Personal Gmail                    [Edit] [Disable]  │ │
│ │    rahul.personal@gmail.com                             │ │
│ │    Today: 43/100  │  Daily cap: 100  │  Campaign: 50    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ⋮⋮ Work Gmail                        [Edit] [Disable]  │ │
│ │    rahul@company.com                                    │ │
│ │    Today: 0/300   │  Daily cap: 300  │  Campaign: 150   │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ⋮⋮ Marketing SMTP                    [Edit] [Disable]  │ │
│ │    marketing@company.com (smtp.sendgrid.net)            │ │
│ │    Today: 0/1000  │  Daily cap: 1000 │  Campaign: 500   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Drag ⋮⋮ to reorder priority (top = used first)             │
└─────────────────────────────────────────────────────────────┘
```

### Template Editor

```
┌─────────────────────────────────────────────────────────────┐
│ Template: Outreach v2                        [Save] [Preview]│
├────────────────┬────────────────────────────────────────────┤
│ + Header       │  ┌────────────────────────────────────┐   │
│ + Text         │  │  [Logo]     ACME Newsletter        │   │
│ + Image        │  ├────────────────────────────────────┤   │
│ + Button       │  │  Hello {{name}},                   │ ← │
│ + Divider      │  │                                    │   │
│ + Spacer       │  │  Welcome to our March update...    │   │
│ + Columns      │  ├────────────────────────────────────┤   │
│ + Footer       │  │  [ Read More ]                     │   │
│                │  ├────────────────────────────────────┤   │
│                │  │  (c) 2026 ACME - Unsubscribe       │   │
│                │  └────────────────────────────────────┘   │
├────────────────┴────────────────────────────────────────────┤
│ Block Properties                                             │
│ Content: [Hello {{name}}, welcome to...                   ] │
│ Font Size: [16] px    Align: [Left v]                       │
└─────────────────────────────────────────────────────────────┘
```

### Campaign Composer

```
┌─────────────────────────────────────────────────────────────┐
│ New Campaign                              [Save Draft] [Send]│
├─────────────────────────────────────────────────────────────┤
│ Name: [March Newsletter___]  Template: [Outreach v2 v]      │
│ Subject: [Hey {{name}}, check this out!__________________]  │
├──────────────────────────┬──────────────────────────────────┤
│ Recipients               │  Preview                         │
│ ┌──────────────────────┐ │  ┌────────────────────────────┐  │
│ │ name,email,company   │ │  │ To: john@acme.com          │  │
│ │ John,john@ac..,ACME  │ │  │ Subject: Hey John, check.. │  │
│ │ Sara,sara@be..,Beta  │ │  │ ─────────────────────────  │  │
│ │ ...                  │ │  │ Hello John,                │  │
│ └──────────────────────┘ │  │ Welcome to ACME...         │  │
│ 47 recipients            │  └────────────────────────────┘  │
│                          │  < [1/47] >                      │
├──────────────────────────┴──────────────────────────────────┤
│ Validation: 47 valid, 0 invalid, 0 duplicates               │
└─────────────────────────────────────────────────────────────┘
```

### Send Progress

```
┌─────────────────────────────────────────────────────────────┐
│ Sending: March Newsletter                        [Cancel]   │
├─────────────────────────────────────────────────────────────┤
│ [=================>                    ]  89/142 (63%)      │
├─────────────────────────────────────────────────────────────┤
│ Using: Work Gmail (89/150 campaign, 201/300 daily)          │
├─────────────────────────────────────────────────────────────┤
│ 14:23:01  OK  john@acme.com         Personal Gmail          │
│ 14:23:02  OK  sara@beta.com         Personal Gmail          │
│ 14:23:02  !!  Switching to Work Gmail (cap reached)         │
│ 14:23:03  OK  mike@corp.com         Work Gmail              │
│ 14:23:04  XX  bad@invalid           Invalid recipient       │
│ 14:23:05  OK  lisa@startup.io       Work Gmail              │
└─────────────────────────────────────────────────────────────┘
```

### Campaign History

```
┌─────────────────────────────────────────────────────────────┐
│ Campaign History                                [Export CSV] │
├───────────────────┬────────────┬────────────┬───────────────┤
│ Name              │ Sent       │ Recipients │ Status        │
├───────────────────┼────────────┼────────────┼───────────────┤
│ March Newsletter  │ Mar 15 2pm │ 142/142    │ Completed     │
│ Beta Launch       │ Mar 12 9am │ 89/92      │ 3 failed      │
│ Weekly Update     │ Mar 8 10am │ 47/47      │ Completed     │
└───────────────────┴────────────┴────────────┴───────────────┘
```

---

## Implementation Notes

### Bun-Specific Optimizations

1. Use `bun:sqlite` for native SQLite (faster than better-sqlite3)
2. Use Bun's built-in `.env` loading (no dotenv package needed)
3. Bundle backend with `bun build` for single-file deployment
4. Use `Bun.password.hash()` for bcrypt (native implementation)

### Frontend Considerations

- Shadcn/ui for compact, enterprise-style components
- React Query for server state management
- Tailwind for utility-first styling
- Keep components tightly packed (dense UI)
- SSE via EventSource for real-time progress

### Security Checklist

- [ ] Password hashed with bcrypt (cost 12)
- [ ] JWT signed with strong secret from env
- [ ] SMTP credentials encrypted with AES-256
- [ ] No hardcoded secrets in codebase
- [ ] CORS configured for production domain
- [ ] Rate limiting on auth endpoints

---

## Next Steps

1. Set up project structure with Bun workspaces
2. Implement backend API routes
3. Create SQLite schema and migrations
4. Build React frontend with Shadcn/ui
5. Integrate multi-account sending logic
6. Add Docker configuration
7. Test end-to-end flow
8. Write README with setup instructions
