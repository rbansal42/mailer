// server/src/services/google-sheets.ts
import { google } from 'googleapis'

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>
type Credentials = Parameters<OAuth2Client['setCredentials']>[0]
import { queryOne, execute } from '../db'
import { encrypt, decrypt } from '../utils/crypto'
import { logger } from '../lib/logger'

const SERVICE = 'google-sheets'

// OAuth2 scopes needed for Google Sheets (read-only)
export const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
]

interface SettingRow {
  value: string
}

interface GoogleSheetsCredentials {
  clientId: string
  clientSecret: string
  redirectUri: string
}

interface GoogleSheetsTokens {
  access_token: string
  refresh_token?: string
  expiry_date?: number
  token_type?: string
  scope?: string
}

interface SheetRow {
  [key: string]: string | undefined
}

interface SheetData {
  headers: string[]
  rows: SheetRow[]
  sheetName: string
  spreadsheetTitle: string
}

// Get Google Sheets OAuth credentials from settings
export async function getGoogleSheetsCredentials(): Promise<GoogleSheetsCredentials | null> {
  const clientId = await queryOne<SettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    ['google_sheets_client_id']
  )
  const clientSecret = await queryOne<SettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    ['google_sheets_client_secret']
  )
  const redirectUri = await queryOne<SettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    ['google_sheets_redirect_uri']
  )

  if (!clientId?.value || !clientSecret?.value) {
    return null
  }

  return {
    clientId: clientId.value,
    clientSecret: decrypt(clientSecret.value),
    redirectUri: redirectUri?.value || 'http://localhost:3342/api/integrations/google-sheets/callback',
  }
}

// Save Google Sheets OAuth credentials
export async function saveGoogleSheetsCredentials(credentials: GoogleSheetsCredentials): Promise<void> {
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['google_sheets_client_id', credentials.clientId]
  )
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['google_sheets_client_secret', encrypt(credentials.clientSecret)]
  )
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['google_sheets_redirect_uri', credentials.redirectUri]
  )

  logger.info('Google Sheets credentials saved', { service: SERVICE })
}

// Get stored OAuth tokens
export async function getGoogleSheetsTokens(): Promise<GoogleSheetsTokens | null> {
  const tokens = await queryOne<SettingRow>(
    'SELECT value FROM settings WHERE key = ?',
    ['google_sheets_tokens']
  )

  if (!tokens?.value) {
    return null
  }

  try {
    return JSON.parse(decrypt(tokens.value))
  } catch (error) {
    logger.error('Failed to parse Google Sheets tokens', { service: SERVICE }, error as Error)
    return null
  }
}

// Save OAuth tokens
export async function saveGoogleSheetsTokens(tokens: GoogleSheetsTokens): Promise<void> {
  await execute(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    ['google_sheets_tokens', encrypt(JSON.stringify(tokens))]
  )

  logger.info('Google Sheets tokens saved', { service: SERVICE })
}

// Clear OAuth tokens (disconnect)
export async function clearGoogleSheetsTokens(): Promise<void> {
  await execute('DELETE FROM settings WHERE key = ?', ['google_sheets_tokens'])
  logger.info('Google Sheets tokens cleared', { service: SERVICE })
}

// Create OAuth2 client
export async function createOAuth2Client(): Promise<OAuth2Client | null> {
  const credentials = await getGoogleSheetsCredentials()
  if (!credentials) {
    return null
  }

  return new google.auth.OAuth2(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUri
  )
}

// Get authenticated OAuth2 client with tokens
export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const oauth2Client = await createOAuth2Client()
  if (!oauth2Client) {
    return null
  }

  const tokens = await getGoogleSheetsTokens()
  if (!tokens) {
    return null
  }

  oauth2Client.setCredentials(tokens as Credentials)

  // Check if token needs refresh
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      await saveGoogleSheetsTokens({
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date || undefined,
        token_type: credentials.token_type || undefined,
        scope: credentials.scope || undefined,
      })
      oauth2Client.setCredentials(credentials)
      logger.info('Google Sheets access token refreshed', { service: SERVICE })
    } catch (error) {
      logger.error('Failed to refresh Google Sheets token', { service: SERVICE }, error as Error)
      return null
    }
  }

  return oauth2Client
}

// Generate OAuth authorization URL
export async function generateAuthUrl(): Promise<string | null> {
  const oauth2Client = await createOAuth2Client()
  if (!oauth2Client) {
    return null
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_SHEETS_SCOPES,
    prompt: 'consent', // Force consent to ensure we get refresh token
  })
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<boolean> {
  const oauth2Client = await createOAuth2Client()
  if (!oauth2Client) {
    return false
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    await saveGoogleSheetsTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token || undefined,
      expiry_date: tokens.expiry_date || undefined,
      token_type: tokens.token_type || undefined,
      scope: tokens.scope || undefined,
    })

    logger.info('Google Sheets OAuth tokens obtained', { service: SERVICE })
    return true
  } catch (error) {
    logger.error('Failed to exchange code for tokens', { service: SERVICE }, error as Error)
    return false
  }
}

// Check if Google Sheets is connected
export async function isGoogleSheetsConnected(): Promise<boolean> {
  const tokens = await getGoogleSheetsTokens()
  return tokens !== null && !!tokens.access_token
}

// Parse spreadsheet ID from URL or return as-is
export function parseSpreadsheetId(urlOrId: string): string {
  // If it's already just an ID (no slashes), return it
  if (!urlOrId.includes('/')) {
    return urlOrId
  }

  // Extract ID from URL like https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  const match = urlOrId.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (match) {
    return match[1]
  }

  return urlOrId
}

// Get spreadsheet metadata
export async function getSpreadsheetMetadata(
  spreadsheetId: string
): Promise<{ title: string; sheets: { sheetId: number; title: string }[] } | null> {
  const client = await getAuthenticatedClient()
  if (!client) {
    logger.error('No authenticated client available', { service: SERVICE })
    return null
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: client })
    const response = await sheets.spreadsheets.get({
      spreadsheetId: parseSpreadsheetId(spreadsheetId),
      fields: 'properties.title,sheets.properties',
    })

    return {
      title: response.data.properties?.title || 'Untitled',
      sheets: (response.data.sheets || []).map((s) => ({
        sheetId: s.properties?.sheetId || 0,
        title: s.properties?.title || 'Sheet',
      })),
    }
  } catch (error: any) {
    logger.error('Failed to get spreadsheet metadata', {
      service: SERVICE,
      spreadsheetId,
      error: error.message,
    })
    return null
  }
}

// Fetch data from a Google Sheet
export async function fetchSheetData(
  spreadsheetId: string,
  sheetRange?: string
): Promise<SheetData | null> {
  const client = await getAuthenticatedClient()
  if (!client) {
    logger.error('No authenticated client available', { service: SERVICE })
    return null
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: client })
    const parsedId = parseSpreadsheetId(spreadsheetId)

    // Get spreadsheet metadata for title
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId: parsedId,
      fields: 'properties.title,sheets.properties.title',
    })

    const spreadsheetTitle = metadataResponse.data.properties?.title || 'Untitled'

    // Default to first sheet if no range specified
    const range = sheetRange || metadataResponse.data.sheets?.[0]?.properties?.title || 'Sheet1'

    // Fetch the data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: parsedId,
      range,
    })

    const values = response.data.values || []

    if (values.length === 0) {
      logger.warn('Sheet is empty', { service: SERVICE, spreadsheetId, range })
      return {
        headers: [],
        rows: [],
        sheetName: range,
        spreadsheetTitle,
      }
    }

    // First row is headers
    const headers = values[0].map((h: any) => String(h || '').trim())

    // Convert remaining rows to objects
    const rows: SheetRow[] = values.slice(1).map((row: any[]) => {
      const obj: SheetRow = {}
      headers.forEach((header, index) => {
        if (header) {
          obj[header] = row[index] !== undefined ? String(row[index]) : undefined
        }
      })
      return obj
    })

    logger.info('Sheet data fetched', {
      service: SERVICE,
      spreadsheetId: parsedId,
      range,
      rowCount: rows.length,
      headers,
    })

    return {
      headers,
      rows,
      sheetName: range,
      spreadsheetTitle,
    }
  } catch (error: any) {
    logger.error('Failed to fetch sheet data', {
      service: SERVICE,
      spreadsheetId,
      sheetRange,
      error: error.message,
    })
    return null
  }
}

// Map sheet columns to contact fields
export interface ColumnMapping {
  email: string // Required - maps to email field
  name?: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  country?: string
  // Any unmapped columns go to custom_fields
}

export interface MappedContact {
  email: string
  name?: string
  first_name?: string
  last_name?: string
  company?: string
  phone?: string
  country?: string
  custom_fields?: Record<string, string>
}

// Map sheet rows to contacts using column mapping
export function mapRowsToContacts(
  rows: SheetRow[],
  headers: string[],
  mapping: ColumnMapping
): MappedContact[] {
  const contacts: MappedContact[] = []
  const knownFields = ['email', 'name', 'first_name', 'last_name', 'company', 'phone', 'country']
  const mappedColumns = new Set(Object.values(mapping).filter(Boolean))

  for (const row of rows) {
    // Skip rows without email
    const email = row[mapping.email]?.trim()
    if (!email || !isValidEmail(email)) {
      continue
    }

    const contact: MappedContact = { email }

    // Map known fields
    if (mapping.name && row[mapping.name]) {
      contact.name = row[mapping.name]
    }
    if (mapping.first_name && row[mapping.first_name]) {
      contact.first_name = row[mapping.first_name]
    }
    if (mapping.last_name && row[mapping.last_name]) {
      contact.last_name = row[mapping.last_name]
    }
    if (mapping.company && row[mapping.company]) {
      contact.company = row[mapping.company]
    }
    if (mapping.phone && row[mapping.phone]) {
      contact.phone = row[mapping.phone]
    }
    if (mapping.country && row[mapping.country]) {
      contact.country = row[mapping.country]
    }

    // Put unmapped columns in custom_fields
    const customFields: Record<string, string> = {}
    for (const header of headers) {
      if (!mappedColumns.has(header) && row[header]) {
        customFields[header] = row[header]!
      }
    }
    if (Object.keys(customFields).length > 0) {
      contact.custom_fields = customFields
    }

    contacts.push(contact)
  }

  return contacts
}

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Auto-detect column mapping from headers
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { email: '' }

  const patterns: Record<string, RegExp[]> = {
    email: [/^e-?mail$/i, /^email.?address$/i, /^contact.?email$/i],
    name: [/^(full.?)?name$/i, /^contact.?name$/i, /^display.?name$/i],
    first_name: [/^first.?name$/i, /^given.?name$/i, /^fname$/i],
    last_name: [/^last.?name$/i, /^family.?name$/i, /^surname$/i, /^lname$/i],
    company: [/^company$/i, /^organization$/i, /^org$/i, /^employer$/i],
    phone: [/^phone$/i, /^telephone$/i, /^mobile$/i, /^cell$/i, /^phone.?number$/i],
    country: [/^country$/i, /^location$/i, /^region$/i],
  }

  for (const header of headers) {
    const normalizedHeader = header.toLowerCase().trim()

    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      if (fieldPatterns.some((p) => p.test(normalizedHeader))) {
        (mapping as any)[field] = header
        break
      }
    }
  }

  // If no email column found, try to find one with 'email' in the name
  if (!mapping.email) {
    const emailCol = headers.find((h) => h.toLowerCase().includes('email'))
    if (emailCol) {
      mapping.email = emailCol
    }
  }

  return mapping
}
