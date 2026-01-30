# Mailer v2

Self-hosted bulk email sending application with multi-account support, block-based template editor, and smart rate limiting.

## Features

- **Multi-Account Sending**: Configure multiple Gmail/SMTP accounts with automatic failover
- **Smart Rate Limiting**: Daily and per-campaign caps with auto-switching between accounts
- **Block-Based Templates**: Drag-and-drop email template editor
- **Mail Merge**: `{{variable}}` replacement from CSV/Excel data
- **Live Preview**: See personalized emails before sending
- **Queue System**: Automatic queueing when all accounts hit caps
- **Send History**: Track campaigns with detailed logs
- **Docker Ready**: Single-command deployment

## Quick Start

### Development

```bash
# Install dependencies
bun install

# Start development servers
bun run dev:server   # Backend on http://localhost:3342
bun run dev:frontend # Frontend on http://localhost:5173
```

### Production (Docker)

```bash
# Copy and edit environment file
cp .env.example .env

# Start with Docker Compose
docker compose up -d

# Access at http://localhost:3342
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) |
| `ENCRYPTION_KEY` | Secret for encrypting SMTP credentials (32 chars) |
| `PORT` | Server port (default: 3342) |
| `TZ` | Timezone for midnight cap reset (e.g., America/Los_Angeles) |

## Project Structure

```
mailer/
├── server/           # Express backend
│   └── src/
│       ├── routes/   # API endpoints
│       ├── services/ # Business logic
│       └── providers/# Email providers
├── frontend/         # React frontend
│   └── src/
│       ├── pages/    # Main views
│       └── components/
├── data/             # SQLite database (gitignored)
└── docker-compose.yml
```

## Tech Stack

- **Runtime**: Bun
- **Backend**: Express, Bun SQLite, Nodemailer
- **Frontend**: React, Vite, Tailwind CSS, Shadcn/ui
- **Auth**: Password + JWT
- **Database**: SQLite

## License

MIT
