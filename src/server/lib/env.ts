import { z } from 'zod'

/**
 * Schema for validating server environment variables at startup.
 *
 * Required variables will cause a hard exit if missing.
 * Optional variables log warnings when absent but allow the server to start.
 */
const envSchema = z.object({
  // Required — server cannot function without a database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Optional with sensible defaults
  PORT: z.coerce.number().default(3342),
  BASE_URL: z.string().default(''),
  DATA_DIR: z.string().default(''),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Security — have defaults for dev but should be set in production
  ENCRYPTION_KEY: z.string().default(''),
  JWT_SECRET: z.string().default(''),

  // PDF generation
  PDF_WORKER_COUNT: z.coerce.number().int().positive().default(5),
  PDF_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Optional services
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

/**
 * Validates all environment variables against the schema.
 * Must be called before any other server initialization.
 *
 * - Exits with code 1 if required variables are missing
 * - Logs warnings for optional but recommended variables
 *
 * @returns Parsed and validated environment object
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\n❌ Environment variable validation failed:\n')
    for (const issue of result.error.issues) {
      console.error(`   ${issue.path.join('.')}: ${issue.message}`)
    }
    console.error('\nCheck your .env file. See .env.example for required variables.\n')
    process.exit(1)
  }

  _env = result.data

  // Warn about security-sensitive defaults
  if (!result.data.ENCRYPTION_KEY) {
    console.warn('⚠️  ENCRYPTION_KEY not set — using insecure default (set this in production)')
  }
  if (!result.data.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set — using insecure default (set this in production)')
  }

  // Warn about optional services
  if (!result.data.FIREBASE_SERVICE_ACCOUNT) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set — authentication will be disabled')
  }
  if (!result.data.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set — AI features will be unavailable')
  }

  return result.data
}

/**
 * Returns the validated environment. Throws if {@link validateEnv} has not
 * been called yet.
 */
export function getEnv(): Env {
  if (!_env) throw new Error('Environment not validated yet. Call validateEnv() first.')
  return _env
}
