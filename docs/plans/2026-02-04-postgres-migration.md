# PostgreSQL Migration Plan

**Goal:** Migrate from Turso/libSQL (SQLite) to PostgreSQL using Bun's native SQL API.

**Architecture:** Replace `@libsql/client` with `Bun.SQL`. Create a compatibility layer in `client.ts` that converts `?` placeholders to `$1, $2, ...` via `sql.unsafe()`, preserving the existing `queryAll`/`queryOne`/`execute` API to minimize changes across 30+ consuming files. Schema rewritten for PostgreSQL types. Backup service rewritten to use `pg_dump`/`pg_restore`.

**Key Design Decision:** Use `sql.unsafe(convertedSql, args)` in the DB client layer to maintain the `(sql: string, args: any[])` calling convention, so route/service files only need SQL syntax fixes (not a complete rewrite to tagged template literals).

---

## Task 1: Rewrite DB Client (`server/src/db/client.ts`)

- Replace `@libsql/client` with `import { SQL } from "bun"`
- Create connection from `DATABASE_URL` env var
- Implement `?` → `$1, $2, ...` placeholder converter
- Rewrite `queryAll`, `queryOne`, `execute` using `sql.unsafe()`
- `execute` returns `{ rowsAffected, lastInsertRowid }` - use `RETURNING` for inserts
- Rewrite `checkDatabaseHealth`
- Export `sql` instance for direct tagged template usage (transactions)

## Task 2: Rewrite Schema (`server/src/db/schema.ts`)

- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `DATETIME DEFAULT CURRENT_TIMESTAMP` → `TIMESTAMPTZ DEFAULT NOW()`
- `INTEGER` booleans → `BOOLEAN DEFAULT false/true`
- `TEXT` JSON columns → `JSONB`
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- Use `sql.unsafe()` for multi-statement DDL via `.simple()`

## Task 3: Rewrite Migrations (`server/src/db/migrations.ts`)

- Replace `PRAGMA table_info()` with `information_schema.columns` query
- Update `addColumnIfNotExists` for PostgreSQL
- Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (PG 9.6+)
- Update SQL migration files in `server/src/db/migrations/`

## Task 4: Fix All Route Queries (17 files)

- `INSERT OR REPLACE INTO settings` → `INSERT INTO settings ... ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
- `INSERT OR REPLACE INTO recipient_attachments` → proper ON CONFLICT
- `datetime('now')` → `NOW()`
- `datetime('now', '-48 hours')` → `NOW() - INTERVAL '48 hours'`
- `strftime(...)` → `to_char(...)`
- `GROUP_CONCAT(DISTINCT ...)` → `STRING_AGG(DISTINCT ..., ',')`
- `LIKE` → `ILIKE` for case-insensitive search
- `WHERE enabled = 1` → `WHERE enabled = true`
- Boolean writes: `enabled ? 1 : 0` → `enabled`
- `'UNIQUE constraint'` error checks → PostgreSQL error code `23505`
- `Number(result.lastInsertRowid)` → use RETURNING pattern

## Task 5: Fix All Service Queries (11 files)

Same patterns as Task 4, plus:
- `db.transaction('write')` in certificates.ts → `sql.begin()`
- Direct `db.execute()` calls in tracking.ts → use helpers
- `circuit-breaker.ts`: `datetime('now')` → `NOW()`

## Task 6: Update Environment and Packages

- Remove `@libsql/client` from `server/package.json`
- Remove `--external @libsql/client` from build script
- Update `.env.example` with `DATABASE_URL`
- Update `AGENTS.md` documentation

## Task 7: Rewrite Backup Service

- Replace file-copy with `pg_dump`/`pg_restore` subprocess calls
- Update file patterns from `.db` to `.sql.gz`
- Remove WAL/PRAGMA references
- Update backup tests

## Task 8: Update Frontend Types

- `is_branch_point: number` → `number | boolean` (backward compatible)
- Verify `Boolean()` coercions still work with native PG booleans
