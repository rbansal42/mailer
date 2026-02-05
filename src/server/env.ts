// Load .env from project root before any other modules evaluate.
// In the new flat structure, __dirname = <root>/src/server/
// so ../../.env resolves to <root>/.env correctly.
import { config } from 'dotenv'
import { join } from 'path'

config({ path: join(__dirname, '../../.env') })
