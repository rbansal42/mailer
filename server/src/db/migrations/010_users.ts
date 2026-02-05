import { sql } from '../index'

export async function up() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`CREATE INDEX idx_users_firebase_uid ON users(firebase_uid)`
  await sql`CREATE INDEX idx_users_email ON users(email)`
}

export async function down() {
  await sql`DROP INDEX IF EXISTS idx_users_firebase_uid`
  await sql`DROP INDEX IF EXISTS idx_users_email`
  await sql`DROP TABLE IF EXISTS users`
}
