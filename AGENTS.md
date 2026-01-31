# Agent Instructions for Mailer Project

**IMPORTANT: Always load this file at the start of any session.**

## Project Overview

Mailer is a self-hosted email campaign management system with certificate generation capabilities.

## Tech Stack

- **Runtime**: Bun (NOT npm/node)
- **Frontend**: React + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript + SQLite (via bun:sqlite)
- **PDF Generation**: @react-pdf/renderer (primary), Puppeteer (legacy templates)

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

### React PDF Templates (Recommended)
Located in `server/src/services/pdf/templates/`:
- **modern-clean**: Double border design with accent bar
- **dark-elegant**: Dark background with gold accents
- **clean-minimal**: White minimal design
- **wave-accent**: Layered color bars at bottom

### Legacy HTML Templates (Puppeteer)
Located in `server/src/templates/certificates/`:
- **Modern**: abhigyaan, geometric-purple, teal-medical
- **Dark**: galaxy-night, navy-gold, tech-cyan
- **Elegant**: pink-watercolor, lavender-floral, cream-classic
- **Minimal**: white-modern, blue-geometric, gradient-wave

## Known Issues / Gotchas

1. **Gradient text in PDFs**: Legacy Puppeteer templates have issues with `-webkit-background-clip: text`. Use React PDF templates which use solid colors instead.

2. **Large payloads**: JSON body limit is 10mb for certificate configs with base64 images.

3. **Worktrees**: Use `.worktrees/` directory for feature branches. It's gitignored.

4. **React PDF fonts**: Fonts are registered in `server/src/services/pdf/fonts.ts`. Font files are in `server/assets/fonts/`.

## Workflow

1. Use git worktrees for feature work: `git worktree add .worktrees/<name> -b <branch>`
2. Run `bun install` in the worktree
3. Make changes, build with `bun run build`
4. Create PR with `gh pr create`
5. Merge with `gh pr merge --squash --delete-branch`
6. Clean up worktree: `git worktree remove .worktrees/<name>`
