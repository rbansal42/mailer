# Mailer v2

A self-hosted bulk email platform with multi-account sending, visual template editor, email tracking, and advanced scheduling.

[![GitHub](https://img.shields.io/github/license/rbansal42/mailer)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-bun-f9f1e1)](https://bun.sh)

## Features

### Core Sending
- **Multi-Account Support** - Configure multiple Gmail/SMTP accounts with automatic failover
- **Smart Rate Limiting** - Daily and per-campaign caps with automatic account rotation
- **CC/BCC Support** - Add CC and BCC recipients to campaigns
- **Queue System** - Automatic queueing when accounts hit rate limits

### Template Editor
- **Block-Based Editor** - Drag-and-drop blocks (header, text, image, button, divider, footer)
- **Mail Merge** - `{{variable}}` replacement from CSV data
- **Live Preview** - See personalized emails for each recipient before sending
- **Starter Templates** - Pre-built templates for newsletters, promotions, and transactional emails

### Smart Attachments
- **Multiple Upload Methods** - ZIP files, drag-and-drop, or folder upload
- **Auto-Matching** - Match attachments to recipients by filename or CSV column
- **Per-Recipient Attachments** - Send different files to different recipients

### Email Tracking & Analytics
- **Open Tracking** - 1x1 pixel tracking for email opens
- **Click Tracking** - Link rewriting to track clicks
- **Analytics Dashboard** - View open rates, click rates, and top links
- **Privacy Controls** - Optional IP hashing, configurable data retention

### Advanced Scheduling
- **One-Time Scheduling** - Schedule campaigns for future delivery
- **Recurring Campaigns** - Set up weekly newsletters with cron expressions
- **Drip Sequences** - Multi-step automated email sequences with delays
- **Timezone Support** - Send at recipient's local time

### Certificate Generation
- **PDF Worker Pool** - Parallel PDF generation using worker threads
- **Configurable Pool Size** - Adjust worker count via `PDF_WORKER_COUNT` (default: 5)
- **Timeout Protection** - Configurable timeout via `PDF_TIMEOUT_MS` (default: 30s)
- **Queue Management** - Automatic queueing when all workers are busy
- **Multiple Templates** - Modern, elegant, minimal, and wave-accent designs

### Reliability
- **Automatic Retries** - Exponential backoff for failed sends
- **Circuit Breaker** - Pause problematic accounts automatically
- **Database Backups** - Scheduled backups with configurable retention
- **Structured Logging** - JSON logs with request correlation IDs
- **PDF Pool Stats** - Health endpoint includes worker pool statistics

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- Node.js 18+ (for some dependencies)

### Development

```bash
# Clone the repository
git clone https://github.com/rbansal42/mailer.git
cd mailer

# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Edit .env with your secrets

# Start development server (frontend + backend on http://localhost:3342)
bun run dev
```

### Production (Docker)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with secure values

# Start with Docker Compose
docker compose up -d

# Access at http://localhost:3342
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) | Yes |
| `ENCRYPTION_KEY` | Secret for encrypting SMTP credentials (exactly 32 chars) | Yes |
| `PORT` | Server port (default: 3342) | No |
| `TZ` | Timezone for scheduling (e.g., `America/Los_Angeles`) | No |
| `DATA_DIR` | Directory for uploads and runtime data | No |
| `PDF_WORKER_COUNT` | Number of PDF worker threads (default: 5) | No |
| `PDF_TIMEOUT_MS` | PDF generation timeout in ms (default: 30000) | No |

### Email Accounts

Configure accounts via the Settings page:

**Gmail (App Password)**
1. Enable 2FA on your Google account
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Add account with email and app password

**SMTP**
- Host, port, username, password
- Supports TLS/SSL

## API Reference

### Authentication
All API endpoints (except `/api/auth` and `/t/*`) require JWT authentication.

```bash
# Login
POST /api/auth/login
{ "password": "your-password" }

# Use token in header
Authorization: Bearer <token>
```

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/templates` | GET, POST | List/create templates |
| `/api/templates/:id` | GET, PUT, DELETE | Manage template |
| `/api/drafts` | GET, POST | List/create drafts |
| `/api/campaigns` | GET | List sent campaigns |
| `/api/send` | POST | Send a campaign |
| `/api/accounts` | GET, POST | List/create sender accounts |

### Tracking Endpoints (Public)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/t/:token/open.gif` | GET | Track email open |
| `/t/:token/c/:linkIndex` | GET | Track link click |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/campaigns/:id/analytics` | GET | Campaign analytics |
| `/api/settings/tracking` | GET, PUT | Tracking settings |

### Advanced Scheduling

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recurring` | CRUD | Recurring campaigns |
| `/api/recurring/:id/run` | POST | Trigger manual run |
| `/api/sequences` | CRUD | Drip sequences |
| `/api/sequences/:id/steps` | CRUD | Sequence steps |
| `/api/sequences/:id/enroll` | POST | Enroll recipients |
| `/api/sequences/:id/enrollments` | GET | List enrollments |

### System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with DB/disk status |
| `/api/backups` | GET, POST | List/create backups |
| `/api/backups/:filename/restore` | POST | Restore from backup |

## Architecture

```
mailer/
├── src/
│   ├── client/           # React frontend
│   ├── server/           # Express backend
│   └── shared/           # Shared types & validation
├── assets/               # Fonts for PDF generation
├── data/                 # Runtime data (attachments, media)
└── package.json          # Single package
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | [Bun](https://bun.sh) |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL (Bun native) |
| Email | Nodemailer |
| Frontend | React 19, Vite, TypeScript |
| Styling | Tailwind CSS, Radix UI |
| State | Zustand, TanStack Query |
| Drag & Drop | dnd-kit |

## Database Schema

### Core Tables
- `sender_accounts` - Email account configurations
- `templates` - Email templates with blocks JSON
- `drafts` - Draft campaigns
- `campaigns` - Sent campaigns
- `send_logs` - Per-recipient send logs

### Tracking Tables
- `tracking_tokens` - Per-recipient tracking tokens
- `tracking_events` - Open/click events

### Scheduling Tables
- `recurring_campaigns` - Recurring campaign configs
- `sequences` - Drip sequence definitions
- `sequence_steps` - Steps within sequences
- `sequence_enrollments` - Recipients in sequences
- `scheduled_batches` - Timezone-based send batches

## Development

### Project Structure

```bash
# Root workspace
bun install          # Install all dependencies
bun run dev          # Start both frontend and backend
bun run build        # Build for production

# All commands run from project root
bun test             # Run tests
```

### Adding a New Email Provider

1. Create provider in `src/server/providers/`
2. Implement the `EmailProvider` interface
3. Register in `src/server/providers/index.ts`

### Database Migrations

Schema changes are handled automatically on startup via `db/index.ts`. For manual migrations:

```bash
bun run db:migrate
```

## Deployment

### Docker (Recommended)

```bash
docker compose up -d
```

The container:
- Exposes port 3342
- Persists data to `./data` volume
- Runs as non-root user

### Manual Deployment

```bash
# Build
bun run build

# Start production server
bun run start
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name mailer.example.com;

    location / {
        proxy_pass http://localhost:3342;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Tracking Domain

For email tracking to work, configure your tracking domain:

1. Set up DNS for `mailer.yourdomain.com`
2. Configure in Settings > Tracking > Base URL
3. Ensure the domain is accessible publicly

## Security Considerations

- **Credentials Encryption** - SMTP passwords are AES-256 encrypted at rest
- **JWT Authentication** - Stateless auth with configurable expiration
- **Input Validation** - Zod schemas on all API inputs
- **CORS** - Configurable allowed origins
- **Rate Limiting** - Built-in per-account rate limits
- **Open Redirect Protection** - URL validation on click tracking

## Known Limitations

- Timezone support uses a simplified offset table (not full IANA database)
- CSV parsing doesn't handle quoted fields with commas
- No built-in unsubscribe management (use external service)
- Single-user authentication model

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `bun test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Nodemailer](https://nodemailer.com/) for email sending
- [Radix UI](https://www.radix-ui.com/) for accessible components
- [dnd-kit](https://dndkit.com/) for drag-and-drop
- [Tailwind CSS](https://tailwindcss.com/) for styling
