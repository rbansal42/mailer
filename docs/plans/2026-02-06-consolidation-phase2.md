# Phase 2: Shared Types + Vite Middleware Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract shared types into `src/shared/types.ts` and integrate Vite middleware mode for single-process development.

**Architecture:** Move 55 API types from `src/client/lib/api.ts` to `src/shared/types.ts`, then update both client and server to import from shared. Replace two-process dev with Vite middleware in Express.

**Tech Stack:** TypeScript, Vite middleware mode, Express, Zod

---

## Task 1: Extract shared API types to src/shared/types.ts

Move all 55 interface/type definitions from `src/client/lib/api.ts` to `src/shared/types.ts`.
Both `src/client/lib/api.ts` and server route files will import from `src/shared/types.ts`.

## Task 2: Update frontend api.ts to import from shared

Replace all type definitions in `src/client/lib/api.ts` with imports from `../../shared/types`.

## Task 3: Update server route format functions to use shared types

Server routes that have `format*()` functions should import the shared types as return types, improving type safety.

## Task 4: Vite middleware integration

Replace the two-process dev setup with Vite middleware mode in Express.

## Task 5: Update package.json scripts

Simplify dev script to single process, remove proxy config from vite.config.ts.

## Task 6: Verify builds
