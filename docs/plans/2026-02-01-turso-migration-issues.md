# Turso Migration - Remaining Issues

## Pre-existing Issues (Not Related to Migration)

### 1. LogoConfig type missing `width` property (certificates.ts:41)
```
Property 'width' does not exist on type 'LogoConfig'.
```
This is a pre-existing type definition issue in the certificate system.

## Post-Migration Follow-up Items

### 1. Test File Updates Needed
The circuit-breaker.test.ts file has tests that call async functions without await. These tests use mocks and may need to be updated to handle async patterns properly.

### 2. Error Handling Consistency
Some routes wrap handlers in try/catch, others rely on Express's default error handling. Consider adding a centralized async error wrapper:

```typescript
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}
```

### 3. Type Safety with Query Helpers
The `queryAll<T>` and `queryOne<T>` functions use unsafe casts. The code works because column names match interface properties, but consider adding explicit row mappers for better type safety.

### 4. Transaction Error Handling in certificates.ts
The transaction rollback in the catch block could fail if the transaction is already in a failed state. Consider wrapping rollback in its own try-catch.

## Environment Setup Required

1. Install Turso CLI: `brew install tursodatabase/tap/turso`
2. Authenticate: `turso auth login`
3. Create databases:
   ```bash
   turso db create mailer-dev
   turso db create mailer-prod
   ```
4. Get credentials:
   ```bash
   turso db show mailer-dev --url
   turso db tokens create mailer-dev
   ```
5. Set environment variables in `.env`:
   ```
   TURSO_DATABASE_URL=libsql://mailer-dev-yourname.turso.io
   TURSO_AUTH_TOKEN=your-token
   ```
