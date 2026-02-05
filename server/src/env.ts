// Load .env from project root BEFORE any other modules evaluate.
// This file must be imported first (or used as a Bun preload) so that
// modules like db/client.ts can read process.env at the top level.
import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(__dirname, '../../.env') })
