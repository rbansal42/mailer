# Turso Migration Design

## Overview

Migrate from embedded SQLite (`bun:sqlite`) to Turso cloud database (`@libsql/client`) for multi-instance deployment and managed infrastructure.

## Goals

1. **Multi-instance deployment** - Multiple app instances can share the same database
2. **Managed infrastructure** - Turso handles backups, replication, availability
3. **Minimal code changes** - SQLite-compatible queries, same schema

## Architecture

**Before:**
```
┌─────────────────┐     ┌──────────────────┐
│  Express App    │────▶│  data/mailer.db  │
│  (bun:sqlite)   │     │  (local file)    │
└─────────────────┘     └──────────────────┘
```

**After:**
```
┌─────────────────┐     ┌──────────────────┐
│  Express App    │────▶│  Turso Cloud     │
│  (@libsql)      │     │  (always)        │
└─────────────────┘     └──────────────────┘
```

## Key Changes

| Component | Before | After |
|-----------|--------|-------|
| Driver | `bun:sqlite` (sync) | `@libsql/client` (async) |
| Connection | `new Database(path)` | `createClient({ url, authToken })` |
| Query all | `db.query(sql).all()` | `(await db.execute(sql)).rows` |
| Query one | `db.query(sql).get()` | `(await db.execute(sql)).rows[0]` |
| Execute | `db.run(sql, params)` | `await db.execute({ sql, args })` |
| Functions | Sync | Async |

## Environment Variables

```
TURSO_DATABASE_URL=libsql://mailer-dev-yourname.turso.io
TURSO_AUTH_TOKEN=your-token-here
```

## Files Affected

### Core (1 file)
- `server/src/db/index.ts` - Database connection and initialization

### Routes (14 files)
- `accounts.ts`, `analytics.ts`, `attachments.ts`, `auth.ts`
- `campaigns.ts`, `certificates.ts`, `drafts.ts`, `media.ts`
- `queue.ts`, `recurring.ts`, `send.ts`, `sequences.ts`
- `settings.ts`, `templates.ts`

### Services (10 files)
- `account-manager.ts`, `attachment-matcher.ts`, `backup.ts`
- `circuit-breaker.ts`, `queue-processor.ts`, `recurring-processor.ts`
- `scheduler.ts`, `sequence-processor.ts`, `timezone-processor.ts`
- `tracking.ts`

## Migration Strategy

1. **Phase 1:** Core database setup - Replace `bun:sqlite` with `@libsql/client`
2. **Phase 2:** Convert all routes and services to async (parallelizable)
3. **Phase 3:** Update app entry point and verify build

## Data Migration

Fresh start - no data migration needed. New Turso databases will be initialized with empty schema.

## Turso Setup

```bash
# Install CLI
brew install tursodatabase/tap/turso

# Authenticate
turso auth login

# Create databases
turso db create mailer-dev
turso db create mailer-prod

# Get URLs
turso db show mailer-dev --url
turso db show mailer-prod --url

# Generate tokens
turso db tokens create mailer-dev
turso db tokens create mailer-prod
```

## Backup Service Changes

The backup service uses SQLite-specific PRAGMA commands (`wal_checkpoint`) and file operations. These will need to be either:
- Removed (Turso handles backups)
- Adapted to use Turso's backup API

For this migration, we'll simplify the backup service to work with Turso's managed backups.
