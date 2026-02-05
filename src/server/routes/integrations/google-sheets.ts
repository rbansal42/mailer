// server/src/routes/integrations/google-sheets.ts
import { Router, Request, Response } from 'express'
import { queryOne, queryAll, execute, safeJsonParse } from '../../db'
import { logger } from '../../lib/logger'
import {
  validate,
  googleSheetsCredentialsSchema,
  googleSheetsSyncConfigSchema,
} from '../../lib/validation'
import {
  getGoogleSheetsCredentials,
  saveGoogleSheetsCredentials,
  generateAuthUrl,
  exchangeCodeForTokens,
  isGoogleSheetsConnected,
  clearGoogleSheetsTokens,
  getSpreadsheetMetadata,
  fetchSheetData,
  autoDetectMapping,
  mapRowsToContacts,
  ColumnMapping,
} from '../../services/google-sheets'

const router = Router()
const SERVICE = 'google-sheets'

interface SettingRow {
  value: string
}

interface ListRow {
  id: number
  name: string
}

interface SyncRow {
  id: number
  list_id: number
  spreadsheet_id: string
  spreadsheet_name: string | null
  sheet_range: string | null
  column_mapping: string
  auto_sync: boolean
  sync_frequency: string
  last_synced_at: string | null
  last_sync_count: number
  last_sync_error: string | null
  created_at: string
  updated_at: string
}

// GET /api/integrations/google-sheets/status - Get connection status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const credentials = await getGoogleSheetsCredentials()
    const connected = await isGoogleSheetsConnected()

    res.json({
      configured: credentials !== null,
      connected,
      clientId: credentials?.clientId || null,
      redirectUri: credentials?.redirectUri || null,
    })
  } catch (error) {
    logger.error('Failed to get Google Sheets status', { service: SERVICE }, error as Error)
    res.status(500).json({ error: 'Failed to get status' })
  }
})

// POST /api/integrations/google-sheets/credentials - Save OAuth credentials
router.post('/credentials', async (req: Request, res: Response) => {
  try {
    const validation = validate(googleSheetsCredentialsSchema, req.body)
    if (!validation.success) {
      return res.status(400).json({ error: validation.error })
    }

    const { clientId, clientSecret, redirectUri } = validation.data

    await saveGoogleSheetsCredentials({
      clientId,
      clientSecret,
      redirectUri: redirectUri || `${req.protocol}://${req.get('host')}/api/integrations/google-sheets/callback`,
    })

    logger.info('Google Sheets credentials saved', { service: SERVICE })
    res.json({ message: 'Credentials saved successfully' })
  } catch (error) {
    logger.error('Failed to save Google Sheets credentials', { service: SERVICE }, error as Error)
    res.status(500).json({ error: 'Failed to save credentials' })
  }
})

// GET /api/integrations/google-sheets/auth-url - Get OAuth authorization URL
router.get('/auth-url', async (_req: Request, res: Response) => {
  try {
    const authUrl = await generateAuthUrl()

    if (!authUrl) {
      return res.status(400).json({
        error: 'Google Sheets credentials not configured. Please configure OAuth credentials first.',
      })
    }

    res.json({ authUrl })
  } catch (error) {
    logger.error('Failed to generate auth URL', { service: SERVICE }, error as Error)
    res.status(500).json({ error: 'Failed to generate authorization URL' })
  }
})

// GET /api/integrations/google-sheets/callback - OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, error: oauthError } = req.query

    if (oauthError) {
      logger.warn('OAuth authorization denied', { service: SERVICE, error: oauthError })
      return res.redirect('/settings/integrations?error=auth_denied')
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/settings/integrations?error=no_code')
    }

    const success = await exchangeCodeForTokens(code)

    if (success) {
      logger.info('Google Sheets connected successfully', { service: SERVICE })
      return res.redirect('/settings/integrations?success=google_sheets_connected')
    } else {
      return res.redirect('/settings/integrations?error=token_exchange_failed')
    }
  } catch (error) {
    logger.error('OAuth callback error', { service: SERVICE }, error as Error)
    res.redirect('/settings/integrations?error=callback_error')
  }
})

// POST /api/integrations/google-sheets/disconnect - Disconnect Google Sheets
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    await clearGoogleSheetsTokens()
    logger.info('Google Sheets disconnected', { service: SERVICE })
    res.json({ message: 'Disconnected successfully' })
  } catch (error) {
    logger.error('Failed to disconnect Google Sheets', { service: SERVICE }, error as Error)
    res.status(500).json({ error: 'Failed to disconnect' })
  }
})

// GET /api/integrations/google-sheets/spreadsheet/:id - Get spreadsheet metadata
router.get('/spreadsheet/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params

    const metadata = await getSpreadsheetMetadata(id)
    if (!metadata) {
      return res.status(404).json({
        error: 'Could not access spreadsheet. Make sure you have access and Google Sheets is connected.',
      })
    }

    res.json(metadata)
  } catch (error) {
    logger.error('Failed to get spreadsheet metadata', { service: SERVICE, id: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to get spreadsheet' })
  }
})

// GET /api/integrations/google-sheets/spreadsheet/:id/preview - Preview sheet data
router.get('/spreadsheet/:id/preview', async (req: Request<{ id: string }, unknown, unknown, { range?: string }>, res: Response) => {
  try {
    const { id } = req.params
    const { range } = req.query

    const data = await fetchSheetData(id, range)
    if (!data) {
      return res.status(404).json({
        error: 'Could not fetch sheet data. Make sure you have access and Google Sheets is connected.',
      })
    }

    // Return limited preview (first 5 rows)
    const suggestedMapping = autoDetectMapping(data.headers)

    res.json({
      headers: data.headers,
      sampleRows: data.rows.slice(0, 5),
      totalRows: data.rows.length,
      sheetName: data.sheetName,
      spreadsheetTitle: data.spreadsheetTitle,
      suggestedMapping,
    })
  } catch (error) {
    logger.error('Failed to preview sheet', { service: SERVICE, id: req.params.id }, error as Error)
    res.status(500).json({ error: 'Failed to preview sheet' })
  }
})

// POST /api/integrations/google-sheets/lists/:listId/sync - Create or update sync config and sync now
router.post('/lists/:listId/sync', async (req: Request, res: Response) => {
  try {
    const { listId } = req.params
    const validation = validate(googleSheetsSyncConfigSchema, req.body)

    if (!validation.success) {
      return res.status(400).json({ error: validation.error })
    }

    // Verify list exists
    const list = await queryOne<ListRow>('SELECT id, name FROM lists WHERE id = ?', [listId])
    if (!list) {
      return res.status(404).json({ error: 'List not found' })
    }

    const { spreadsheetId, sheetRange, columnMapping, autoSync, syncFrequency } = validation.data

    // Fetch sheet data
    const sheetData = await fetchSheetData(spreadsheetId, sheetRange)
    if (!sheetData) {
      return res.status(400).json({
        error: 'Could not fetch sheet data. Make sure you have access and Google Sheets is connected.',
      })
    }

    // Map rows to contacts
    const contacts = mapRowsToContacts(sheetData.rows, sheetData.headers, columnMapping as ColumnMapping)

    if (contacts.length === 0) {
      return res.status(400).json({
        error: 'No valid contacts found. Make sure the email column is mapped correctly and contains valid emails.',
      })
    }

    // Upsert contacts to list (reusing existing logic)
    let created = 0
    let updated = 0
    let added = 0

    for (const contact of contacts) {
      const existing = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE email = ?', [contact.email])

      let contactId: number

      if (existing) {
        await execute(
          `
          UPDATE contacts SET
            name = COALESCE(?, name),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            company = COALESCE(?, company),
            phone = COALESCE(?, phone),
            country = COALESCE(?, country),
            custom_fields = COALESCE(?, custom_fields),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            contact.name ?? null,
            contact.first_name ?? null,
            contact.last_name ?? null,
            contact.company ?? null,
            contact.phone ?? null,
            contact.country ?? null,
            contact.custom_fields ? JSON.stringify(contact.custom_fields) : null,
            existing.id,
          ]
        )
        contactId = existing.id
        updated++
      } else {
        const result = await execute(
          `
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
          [
            contact.email,
            contact.name ?? null,
            contact.first_name ?? null,
            contact.last_name ?? null,
            contact.company ?? null,
            contact.phone ?? null,
            contact.country ?? null,
            JSON.stringify(contact.custom_fields || {}),
          ]
        )
        contactId = Number(result.lastInsertRowid)
        created++
      }

      // Add to list
      try {
        await execute('INSERT INTO list_contacts (list_id, contact_id) VALUES (?, ?)', [listId, contactId])
        added++
      } catch (e: any) {
        if ((e as any).code !== '23505') {
          throw e
        }
      }
    }

    // Save or update sync config
    await execute(
      `
      INSERT INTO google_sheets_syncs
        (list_id, spreadsheet_id, spreadsheet_name, sheet_range, column_mapping, auto_sync, sync_frequency, last_synced_at, last_sync_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(list_id, spreadsheet_id) DO UPDATE SET
        spreadsheet_name = EXCLUDED.spreadsheet_name,
        sheet_range = EXCLUDED.sheet_range,
        column_mapping = EXCLUDED.column_mapping,
        auto_sync = EXCLUDED.auto_sync,
        sync_frequency = EXCLUDED.sync_frequency,
        last_synced_at = CURRENT_TIMESTAMP,
        last_sync_count = EXCLUDED.last_sync_count,
        last_sync_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    `,
      [
        listId,
        spreadsheetId,
        sheetData.spreadsheetTitle,
        sheetRange || null,
        JSON.stringify(columnMapping),
        autoSync,
        syncFrequency,
        contacts.length,
      ]
    )

    logger.info('Google Sheets sync completed', {
      service: SERVICE,
      listId,
      spreadsheetId,
      created,
      updated,
      added,
      total: contacts.length,
    })

    res.json({
      message: 'Sync completed successfully',
      created,
      updated,
      added,
      total: contacts.length,
      spreadsheetTitle: sheetData.spreadsheetTitle,
    })
  } catch (error) {
    logger.error('Failed to sync from Google Sheets', { service: SERVICE, listId: req.params.listId }, error as Error)

    // Try to record the error
    try {
      const { spreadsheetId } = req.body || {}
      if (spreadsheetId && req.params.listId) {
        await execute(
          `
          UPDATE google_sheets_syncs
          SET last_sync_error = ?, updated_at = CURRENT_TIMESTAMP
          WHERE list_id = ? AND spreadsheet_id = ?
        `,
          [(error as Error).message, req.params.listId, spreadsheetId]
        )
      }
    } catch {
      // Ignore error recording failure
    }

    res.status(500).json({ error: 'Failed to sync contacts' })
  }
})

// GET /api/integrations/google-sheets/lists/:listId/syncs - Get sync configs for a list
router.get('/lists/:listId/syncs', async (req: Request, res: Response) => {
  try {
    const { listId } = req.params

    const syncs = await queryAll<SyncRow>(
      `
      SELECT * FROM google_sheets_syncs WHERE list_id = ? ORDER BY updated_at DESC
    `,
      [listId]
    )

    res.json(
      syncs.map((sync) => ({
        ...sync,
        column_mapping: safeJsonParse(sync.column_mapping, {}),
        auto_sync: sync.auto_sync,
      }))
    )
  } catch (error) {
    logger.error('Failed to get syncs for list', { service: SERVICE, listId: req.params.listId }, error as Error)
    res.status(500).json({ error: 'Failed to get sync configurations' })
  }
})

// DELETE /api/integrations/google-sheets/lists/:listId/syncs/:syncId - Delete a sync config
router.delete('/lists/:listId/syncs/:syncId', async (req: Request, res: Response) => {
  try {
    const { listId, syncId } = req.params

    const result = await execute('DELETE FROM google_sheets_syncs WHERE id = ? AND list_id = ?', [syncId, listId])

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Sync configuration not found' })
    }

    logger.info('Google Sheets sync config deleted', { service: SERVICE, listId, syncId })
    res.status(204).send()
  } catch (error) {
    logger.error('Failed to delete sync config', { service: SERVICE, listId: req.params.listId, syncId: req.params.syncId }, error as Error)
    res.status(500).json({ error: 'Failed to delete sync configuration' })
  }
})

// POST /api/integrations/google-sheets/lists/:listId/syncs/:syncId/run - Run an existing sync
router.post('/lists/:listId/syncs/:syncId/run', async (req: Request, res: Response) => {
  try {
    const { listId, syncId } = req.params

    // Get sync config
    const sync = await queryOne<SyncRow>(
      'SELECT * FROM google_sheets_syncs WHERE id = ? AND list_id = ?',
      [syncId, listId]
    )

    if (!sync) {
      return res.status(404).json({ error: 'Sync configuration not found' })
    }

    // Fetch sheet data
    const sheetData = await fetchSheetData(sync.spreadsheet_id, sync.sheet_range || undefined)
    if (!sheetData) {
      await execute(
        'UPDATE google_sheets_syncs SET last_sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['Could not fetch sheet data', syncId]
      )
      return res.status(400).json({
        error: 'Could not fetch sheet data. Make sure you have access and Google Sheets is connected.',
      })
    }

    const columnMapping = safeJsonParse(sync.column_mapping, {}) as ColumnMapping
    const contacts = mapRowsToContacts(sheetData.rows, sheetData.headers, columnMapping)

    if (contacts.length === 0) {
      await execute(
        'UPDATE google_sheets_syncs SET last_sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['No valid contacts found', syncId]
      )
      return res.status(400).json({ error: 'No valid contacts found' })
    }

    // Upsert contacts
    let created = 0
    let updated = 0
    let added = 0

    for (const contact of contacts) {
      const existing = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE email = ?', [contact.email])

      let contactId: number

      if (existing) {
        await execute(
          `
          UPDATE contacts SET
            name = COALESCE(?, name),
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            company = COALESCE(?, company),
            phone = COALESCE(?, phone),
            country = COALESCE(?, country),
            custom_fields = COALESCE(?, custom_fields),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            contact.name ?? null,
            contact.first_name ?? null,
            contact.last_name ?? null,
            contact.company ?? null,
            contact.phone ?? null,
            contact.country ?? null,
            contact.custom_fields ? JSON.stringify(contact.custom_fields) : null,
            existing.id,
          ]
        )
        contactId = existing.id
        updated++
      } else {
        const result = await execute(
          `
          INSERT INTO contacts (email, name, first_name, last_name, company, phone, country, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
          [
            contact.email,
            contact.name ?? null,
            contact.first_name ?? null,
            contact.last_name ?? null,
            contact.company ?? null,
            contact.phone ?? null,
            contact.country ?? null,
            JSON.stringify(contact.custom_fields || {}),
          ]
        )
        contactId = Number(result.lastInsertRowid)
        created++
      }

      try {
        await execute('INSERT INTO list_contacts (list_id, contact_id) VALUES (?, ?)', [listId, contactId])
        added++
      } catch (e: any) {
        if ((e as any).code !== '23505') {
          throw e
        }
      }
    }

    // Update sync record
    await execute(
      `
      UPDATE google_sheets_syncs
      SET last_synced_at = CURRENT_TIMESTAMP, last_sync_count = ?, last_sync_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [contacts.length, syncId]
    )

    logger.info('Google Sheets sync run completed', {
      service: SERVICE,
      listId,
      syncId,
      created,
      updated,
      added,
      total: contacts.length,
    })

    res.json({
      message: 'Sync completed successfully',
      created,
      updated,
      added,
      total: contacts.length,
    })
  } catch (error) {
    logger.error('Failed to run sync', { service: SERVICE, listId: req.params.listId, syncId: req.params.syncId }, error as Error)

    try {
      await execute(
        'UPDATE google_sheets_syncs SET last_sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [(error as Error).message, req.params.syncId]
      )
    } catch {
      // Ignore
    }

    res.status(500).json({ error: 'Failed to run sync' })
  }
})

export default router
