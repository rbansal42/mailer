# Agent Instructions for Mailer Project

**IMPORTANT: Always load this file at the start of any session.**

## Project Overview

Mailer is a self-hosted email campaign management system with certificate generation capabilities.

## Tech Stack

- **Runtime**: Bun (NOT npm/node)
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript + SQLite (via bun:sqlite)
- **PDF Generation**: Puppeteer

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
│   │   ├── templates/  # Certificate templates
│   │   └── lib/        # Utilities
│   └── package.json
├── data/               # SQLite DB, attachments, certificates
└── package.json        # Root workspace config
```

## Key Features

1. **Email Campaigns** - Send bulk emails with templates
2. **Certificate Generator** - Generate PDF certificates with 12 templates
3. **Attachment Matching** - Match attachments to recipients by column/filename
4. **Tracking** - Open and click tracking

## Certificate Templates

Located in `server/src/templates/certificates/`:
- **Modern**: abhigyaan, geometric-purple, teal-medical
- **Dark**: galaxy-night, navy-gold, tech-cyan
- **Elegant**: pink-watercolor, lavender-floral, cream-classic
- **Minimal**: white-modern, blue-geometric, gradient-wave

## Known Issues / Gotchas

1. **Gradient text in PDFs**: `-webkit-background-clip: text` doesn't work in print mode. Use `@media print` fallbacks.

2. **Large payloads**: JSON body limit is 10mb for certificate configs with base64 images.

3. **Worktrees**: Use `.worktrees/` directory for feature branches. It's gitignored.

## Workflow

1. Use git worktrees for feature work: `git worktree add .worktrees/<name> -b <branch>`
2. Run `bun install` in the worktree
3. Make changes, build with `bun run build`
4. Create PR with `gh pr create`
5. Merge with `gh pr merge --squash --delete-branch`
6. Clean up worktree: `git worktree remove .worktrees/<name>`
