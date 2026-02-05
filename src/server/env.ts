// Load .env from project root before any other modules evaluate.
import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(process.cwd(), '.env') })
