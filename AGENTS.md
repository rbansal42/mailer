# Agent Instructions for Mailer Project

**IMPORTANT: Always load this file at the start of any session.**

## Project Overview

Mailer is a self-hosted email campaign management system with certificate generation capabilities.

## Tech Stack

- **Runtime**: Bun (NOT npm/node)
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript + Turso/libSQL (via @libsql/client)
- **PDF Generation**: @react-pdf/renderer

## Commands

```bash
# Development
bun run dev          # Start dev server (frontend + backend)

# Building
bun run build        # Build both frontend and backend

# Package management
bun install          # Install dependencies (NOT npm install)
bun add <package>    # Add a package (NOT npm install <package>)
```

## Project Structure

```
mailer/
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   └── lib/        # Utilities, API client
│   └── package.json
├── server/             # Express backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic
│   │   └── lib/        # Utilities
│   └── package.json
├── data/               # SQLite DB, attachments, certificates
└── package.json        # Root workspace config
```

## Key Features

1. **Email Campaigns** - Send bulk emails with templates
2. **Certificate Generator** - Generate PDF certificates with 4 templates
3. **Attachment Matching** - Match attachments to recipients by column/filename
4. **Tracking** - Open and click tracking

## Certificate Templates

Located in `server/src/services/pdf/templates/`:
- **modern-clean**: Double border design with accent bar
- **dark-elegant**: Dark background with gold accents
- **clean-minimal**: White minimal design
- **wave-accent**: Layered color bars at bottom

## Database Schema

Key tables in `server/src/db/index.ts`:

- **templates** - Reusable email templates (starter designs)
  - `is_default` - Built-in templates flag
  
- **mails** - Saved email designs (user-created)
  - `template_id` - Which template it was based on
  - `campaign_id` - Associated campaign (if sent)
  - `status` - 'draft' or 'sent'
  
- **drafts** - Campaign drafts (work in progress)
  - `template_id` - Currently uses templates, should support mails too
  
- **campaigns** - Sent campaign history

## Mail Library vs Templates

- **Templates**: Reusable starting points (e.g., "Newsletter Layout")
- **Mails**: Actual composed emails saved to library (e.g., "January Newsletter")
- **Workflow**: Create mail from template → Edit → Save → Use in campaign or save as new template

## Environment Variables

All config is in `.env` at project root (see `.env.example`):

```bash
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=eyJ...

# Public URL (for media in emails and tracking)
BASE_URL=https://mailer.example.com

# Server
PORT=3342
```

## Known Issues / Gotchas

1. **Large payloads**: JSON body limit is 10mb for certificate configs with base64 images.

2. **Worktrees**: Use `.worktrees/` directory for feature branches. It's gitignored.

3. **React PDF fonts**: Fonts are registered in `server/src/services/pdf/fonts.ts`. Font files are in `server/assets/fonts/`.

4. **Rich text in blocks**: Text blocks use HTML content (TipTap editor). Preview must use `dangerouslySetInnerHTML` with DOMPurify sanitization.

5. **libsql requires null, not undefined**: The `@libsql/client` throws errors if you pass `undefined` as a query parameter. Always use `?? null` for optional values:
   ```typescript
   // WRONG - will throw if description is undefined
   await execute('INSERT INTO mails (name, description) VALUES (?, ?)', [name, description])
   
   // CORRECT - converts undefined to null
   await execute('INSERT INTO mails (name, description) VALUES (?, ?)', [name, description ?? null])
   ```

6. **Database migrations for new columns**: When adding new fields to a feature, remember to:
   - Add `addColumnIfNotExists()` call in `server/src/db/index.ts`
   - Update the row interface and `formatX()` function in the route
   - Update validation schema in `server/src/lib/validation.ts`
   - Update frontend TypeScript interface in `frontend/src/lib/api.ts`
   - Update both CREATE and UPDATE handlers

## Workflow

1. Use git worktrees for feature work: `git worktree add .worktrees/<name> -b <branch>`
2. Run `bun install` in the worktree
3. Make changes, build with `bun run build`
4. Create PR with `gh pr create`
5. **Request code review** (use `requesting-code-review` skill) - fix Critical/Important issues before proceeding
6. Merge with `gh pr merge --squash --delete-branch`
7. Clean up worktree: `git worktree remove .worktrees/<name>`
