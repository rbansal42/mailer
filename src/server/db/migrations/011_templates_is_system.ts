import { sql } from '../index'

export async function up() {
  await sql`ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false`

  // Mark existing default templates as system templates
  await sql`UPDATE templates SET is_system = true WHERE is_default = true`
}

export async function down() {
  await sql`ALTER TABLE templates DROP COLUMN IF EXISTS is_system`
}
