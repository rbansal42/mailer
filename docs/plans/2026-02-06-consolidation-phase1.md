# Phase 1: Monorepo Consolidation — Configs, File Moves, Import Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge the two-workspace architecture into a single package with `src/server/`, `src/client/`, and `src/shared/` directories.

**Architecture:** Replace the `server/` and `frontend/` workspace packages with a flat `src/` tree. Merge all dependencies into root `package.json`. Move all config files (vite, tailwind, postcss, tsconfig) to root. Update every import path in every file.

**Tech Stack:** Bun, TypeScript, Vite, Express, React

---

## Task 1: Create merged package.json and root configs

**Files:**
- Modify: `package.json` (root) — merge deps from both workspaces
- Create: `index.html` — SPA entry (was `frontend/index.html`)
- Create: `vite.config.ts` — adapted from `frontend/vite.config.ts`
- Create: `tailwind.config.js` — adapted from `frontend/tailwind.config.js`
- Create: `postcss.config.js` — from `frontend/postcss.config.js`
- Create: `tsconfig.json` — base config for frontend (Vite uses this)
- Create: `tsconfig.server.json` — server-specific config

**Details:**
- Merge all dependencies from `server/package.json` and `frontend/package.json` into root
- Remove `"workspaces"` field
- Update scripts: `dev`, `build`, `start`, `db:migrate`
- `index.html` entry point changes from `/src/main.tsx` to `/src/client/main.tsx`
- `vite.config.ts` alias `@` points to `./src/client`
- `vite.config.ts` build output goes to `dist/public`
- `tailwind.config.js` content scans `./src/client/**/*`
- `tsconfig.json` for frontend: paths `@/*` -> `./src/client/*`, includes `src/client`, `src/shared`
- `tsconfig.server.json` for server: includes `src/server`, `src/shared`, types `["bun"]`

## Task 2: Move server files

**Action:** Move `server/src/*` -> `src/server/*` preserving directory structure.

All subdirectories: `routes/`, `services/`, `middleware/`, `db/`, `lib/`, `providers/`, `utils/`
Plus top-level files: `index.ts`, `env.ts`

Also move: `server/assets/` -> `assets/` (fonts for PDF generation)

## Task 3: Move frontend files  

**Action:** Move `frontend/src/*` -> `src/client/*` preserving directory structure.

All subdirectories: `components/`, `pages/`, `hooks/`, `stores/`, `lib/`
Plus top-level files: `App.tsx`, `main.tsx`, `index.css`

Also move: `frontend/public/` -> `public/` if it exists (static assets like favicon)

## Task 4: Fix server imports

**Action:** Update all relative imports in `src/server/` files.

Key changes:
- `env.ts`: `__dirname` path to `.env` changes from `../../.env` to `../.env` (one level up from `src/server/`)  
  Wait — with the new structure, `__dirname` in `src/server/env.ts` = `<root>/src/server/`, so `../../.env` still resolves to `<root>/.env`. Actually no — Bun resolves `__dirname` to the SOURCE file location. So `src/server/env.ts` -> `__dirname` = `<root>/src/server/` -> `../../.env` = `<root>/../.env` which is WRONG.
  
  Fix: change to `../.env` (one parent from `src/server/` = `src/`, one more = root... no, `join(__dirname, '../../.env')` from `src/server/env.ts` = go up to `src/`, then up to root, then `.env` = `<root>/.env`. That IS correct.

  Actually let's just simplify: use `process.cwd()` which is always the project root when running `bun run dev`.

- Internal imports between server files don't change (they use relative paths within the server tree)
- `DATA_DIR` references using `process.cwd()` should still work since CWD = project root

## Task 5: Fix frontend imports

**Action:** Update imports in `src/client/` files.

Key changes:
- `@/*` alias paths DON'T change (alias now points to `src/client/` which is equivalent)
- Check if any file uses relative imports that cross the `frontend/src/` boundary — unlikely but verify
- `api.ts` firebase import: `./firebase` — stays same (relative within `src/client/lib/`)

## Task 6: Update server entry point for static serving

**Action:** Update `src/server/index.ts`:
- Production static path: `join(process.cwd(), 'dist', 'public')` instead of `join(process.cwd(), 'public')`
- Media path stays: `join(DATA_DIR, 'media')`
- Remove `dotenv` — use Bun's built-in `.env` loading from CWD (project root)

## Task 7: Clean up old workspace directories

**Action:**
- Remove `server/package.json`, `server/tsconfig.json`
- Remove `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`
- Remove empty `server/src/` and `frontend/src/` directories
- Keep `server/` and `frontend/` dirs only if they still contain non-src files

## Task 8: Install dependencies and verify

**Action:**
- Run `bun install` from root
- Run `bun run build` to verify both frontend and server build
- Verify no import errors
