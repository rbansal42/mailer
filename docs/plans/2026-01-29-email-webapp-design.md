# Email Webapp Design

A single-page webapp for creating beautiful HTML emails with mail merge and bulk sending via Gmail.

## Requirements Summary

- General-purpose email templates (marketing, professional, personal)
- Fully dynamic mail merge variables from CSV/pasted data columns
- Global CC for all recipients
- Template picker with content-only customization
- Simple progress bar with failure list
- Gmail credentials via UI with optional save
- Personalized subject lines with variables
- Focus on stability and speed

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│  ┌─────────────────────────────────────────┐    │
│  │         Single Page Application          │    │
│  │  - Template selector & editor            │    │
│  │  - Mailing list input (paste/upload)     │    │
│  │  - Gmail config with save option         │    │
│  │  - Send progress display                 │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Express.js Backend                  │
│  - POST /api/send (bulk email dispatch)         │
│  - POST /api/save-config (save credentials)     │
│  - GET /api/config (load saved credentials)     │
│  - Nodemailer + Gmail transport                 │
└─────────────────────────────────────────────────┘
```

**Tech stack:**
- Frontend: Vanilla HTML/CSS/JS (no framework)
- Backend: Express.js
- Email: Nodemailer with Gmail SMTP
- Storage: JSON file for saved credentials (encrypted)

## UI Layout

Single page, vertical flow with four sections:

```
┌──────────────────────────────────────────────────────────┐
│  Mailer                                 [Gmail Config]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. TEMPLATE                                             │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌─────────┐      │
│  │ Simple  │ │Newsletter│ │Professional│ │Outreach │      │
│  └─────────┘ └─────────┘ └───────────┘ └─────────┘      │
│                                                          │
│  2. COMPOSE                                              │
│  Subject: [Hello {{firstName}}, welcome!    ]            │
│  ┌────────────────────┬─────────────────────┐           │
│  │ Content Editor     │ Live Preview        │           │
│  └────────────────────┴─────────────────────┘           │
│                                                          │
│  3. RECIPIENTS                                           │
│  [Paste from Excel or upload CSV]                        │
│  ┌──────────────────────────────────────────┐           │
│  │ name, email, company                      │           │
│  └──────────────────────────────────────────┘           │
│  Detected variables: {{name}} {{email}} {{company}}      │
│  Global CC: [________________________]                   │
│                                                          │
│  4. SEND                                                 │
│  [============================        ] 15/25 sent       │
│  [Send Emails]                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Email Templates

### 1. Simple
Clean, text-focused. For personal or transactional emails.
- Plain text styling, minimal formatting
- No header/footer

### 2. Newsletter
Header banner + content sections. For updates, announcements.
- Colored header banner
- Main content area
- Footer with optional unsubscribe text

### 3. Professional
Logo placeholder + signature block. For business communication.
- Logo placeholder area
- Content area
- Formal signature block (name, title)

### 4. Outreach
Warm, personal follow-up style. For check-ins, care-based communication.
- "Dear {{name}}" greeting
- Conversational tone
- Softer sign-off ("Take care")
- Tagline/mission statement in italics

All templates use inline CSS for email client compatibility.

## Data Flow & Mail Merge

### Recipient Input
- Paste from Excel (tab-separated)
- Upload CSV file
- Auto-detect delimiter

### Processing
1. Parse input - auto-detect tabs vs commas
2. Extract headers - first row becomes variable names
3. Display detected variables to user
4. Validate - require `email` column, warn on missing values
5. Preview - render email using first row's data

### Mail Merge Execution
```
For each recipient row:
  1. Clone template HTML
  2. Replace all {{variable}} with row values
  3. Replace in subject line too
  4. Send via Nodemailer
  5. Update progress bar
  6. Log success/failure
```

### Error Handling
- Invalid email format: skip row, add to failure list
- SMTP error: retry once, then add to failure list
- Missing variable value: replace with empty string, continue

## Gmail Credentials

### Config Modal
- Email input
- App Password input (masked)
- "Remember credentials" checkbox
- Help link for creating App Passwords

### Storage
- Not saved: credentials held in memory only
- Saved: written to `config.json`, AES-256 encrypted
- Config file stored outside web root

## Sending & Progress

### Pre-send Validation
- Gmail credentials configured
- At least one recipient
- Subject line filled
- Template content not empty

### Progress Display
- Progress bar with count (12/25)
- List of sent emails with checkmarks
- Cancel button during send
- Summary on completion (sent count, failed count)
- Failed recipients list with error reasons

### Rate Limiting
- 300ms delay between emails
- Gmail limit: ~500 emails/day for regular accounts

## File Structure

```
mailer/
├── server.js              # Express server
├── package.json
├── config.json            # Saved credentials (encrypted)
├── public/
│   ├── index.html         # Single page app
│   ├── style.css          # Styles
│   └── app.js             # Frontend logic
└── templates/
    ├── simple.html
    ├── newsletter.html
    ├── professional.html
    └── outreach.html
```

## API Endpoints

### POST /api/send
Request:
```json
{
  "credentials": { "email": "...", "appPassword": "..." },
  "subject": "Hello {{name}}",
  "html": "<html>...</html>",
  "recipients": [
    { "email": "john@example.com", "name": "John", ... }
  ],
  "globalCc": "cc@example.com"
}
```

Response: Server-sent events for progress updates
```
data: {"type": "progress", "sent": 1, "total": 25}
data: {"type": "success", "email": "john@example.com"}
data: {"type": "error", "email": "bad@email", "reason": "Invalid"}
data: {"type": "complete", "sent": 23, "failed": 2}
```

### POST /api/save-config
Save credentials to encrypted config file.

### GET /api/config
Load saved credentials (returns email only, not password, for UI display).
