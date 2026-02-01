import AdmZip from 'adm-zip'
import { join, basename, extname } from 'path'
import { mkdirSync, existsSync, copyFileSync, statSync, readdirSync, rmSync, unlinkSync } from 'fs'
import { queryAll, queryOne, execute } from '../db'
import { logger } from '../lib/logger'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), '..', 'data')
const ATTACHMENTS_DIR = join(DATA_DIR, 'attachments')
const TEMP_DIR = join(DATA_DIR, 'temp')

export interface Recipient {
  email: string
  data: Record<string, string>
}

export interface MatchResult {
  email: string
  attachmentId: number | null
  filename: string | null
  matchedBy: string | null
}

export interface MatchConfig {
  mode: 'column' | 'explicit'
  column?: string
}

export interface MatchSummary {
  total: number
  matched: number
  unmatched: number
  matchedEmails: string[]
  unmatchedEmails: string[]
}

interface AttachmentRow {
  id: number
  campaign_id: number | null
  draft_id: number | null
  filename: string
  original_filename: string
  filepath: string
  size_bytes: number
  mime_type: string | null
  created_at: string
}

interface RecipientAttachmentRow {
  attachment_id: number
  filepath: string
  original_filename: string
  mime_type: string | null
}

/**
 * Normalize a string for matching:
 * - lowercase
 * - spaces to underscores
 * - remove special characters except dots, underscores, and hyphens
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_.-]/g, '')
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(): void {
  if (!existsSync(ATTACHMENTS_DIR)) {
    mkdirSync(ATTACHMENTS_DIR, { recursive: true })
  }
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
  }
}

/**
 * Extract a ZIP file to a target directory
 * @returns List of extracted file paths
 */
export function extractZip(zipPath: string, targetDir: string): string[] {
  ensureDirectories()
  
  if (!existsSync(zipPath)) {
    throw new Error(`ZIP file not found: ${zipPath}`)
  }

  // Create target directory if it doesn't exist
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }

  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const extractedFiles: string[] = []

  for (const entry of entries) {
    // Skip directories and hidden files (starting with .)
    if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('/__MACOSX/')) {
      continue
    }

    // Get just the filename, ignoring directory structure in zip
    const filename = basename(entry.entryName)
    
    // Skip hidden files that might be in subdirectories
    if (filename.startsWith('.')) {
      continue
    }

    const targetPath = join(targetDir, filename)
    
    // Prevent path traversal attacks
    if (!targetPath.startsWith(targetDir + '/') && targetPath !== targetDir) {
      logger.warn('Skipping entry with path traversal attempt', { entry: entry.entryName, service: 'attachment-matcher' })
      continue
    }
    
    // Extract the file
    zip.extractEntryTo(entry, targetDir, false, true)
    
    // Verify extraction succeeded
    if (existsSync(targetPath)) {
      extractedFiles.push(targetPath)
      logger.debug('Extracted file from ZIP', { filename, targetPath })
    }
  }

  logger.info('ZIP extraction complete', { 
    zipPath, 
    targetDir, 
    fileCount: extractedFiles.length 
  })

  return extractedFiles
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

/**
 * Store uploaded files in the attachments directory and create DB records
 * @param files - Array of file paths to store
 * @param draftId - Optional draft ID to associate with
 * @param campaignId - Optional campaign ID to associate with
 * @returns Array of created attachment IDs
 */
export async function storeAttachments(
  files: string[],
  draftId?: number,
  campaignId?: number
): Promise<number[]> {
  ensureDirectories()

  const attachmentIds: number[] = []
  const timestamp = Date.now()

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      logger.warn('File not found, skipping', { filePath })
      continue
    }

    const originalFilename = basename(filePath)
    const stats = statSync(filePath)
    
    // Generate unique filename to avoid collisions
    const uniqueFilename = `${timestamp}_${attachmentIds.length}_${originalFilename}`
    const destPath = join(ATTACHMENTS_DIR, uniqueFilename)

    // Copy file to attachments directory
    copyFileSync(filePath, destPath)

    // Create DB record
    const result = await execute(
      `INSERT INTO attachments (campaign_id, draft_id, filename, original_filename, filepath, size_bytes, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId ?? null,
        draftId ?? null,
        uniqueFilename,
        originalFilename,
        destPath,
        stats.size,
        getMimeType(originalFilename),
      ]
    )

    const attachmentId = Number(result.lastInsertRowid)
    attachmentIds.push(attachmentId)

    logger.info('Stored attachment', {
      attachmentId,
      originalFilename,
      uniqueFilename,
      sizeBytes: stats.size,
      draftId,
      campaignId,
    })
  }

  return attachmentIds
}

/**
 * Match attachments to recipients based on config
 * @param attachmentIds - Array of attachment IDs to match
 * @param recipients - Array of recipients with email and data
 * @param config - Matching configuration
 * @param draftId - Optional draft ID
 * @param campaignId - Optional campaign ID
 * @returns Array of match results
 */
export async function matchAttachments(
  attachmentIds: number[],
  recipients: Recipient[],
  config: MatchConfig,
  draftId?: number,
  campaignId?: number
): Promise<MatchResult[]> {
  const results: MatchResult[] = []

  // Load attachment records
  const attachments: AttachmentRow[] = []
  for (const id of attachmentIds) {
    const row = await queryOne<AttachmentRow>('SELECT * FROM attachments WHERE id = ?', [id])
    if (row) {
      attachments.push(row)
    }
  }

  if (attachments.length === 0) {
    logger.warn('No attachments found for matching', { attachmentIds })
    return recipients.map(r => ({
      email: r.email,
      attachmentId: null,
      filename: null,
      matchedBy: null,
    }))
  }

  for (const recipient of recipients) {
    let matchedAttachment: AttachmentRow | null = null
    let matchedBy: string | null = null

    if (config.mode === 'explicit') {
      // Use 'attachment' column in recipient data
      const attachmentName = recipient.data.attachment || recipient.data.Attachment
      if (attachmentName) {
        const normalizedTarget = normalize(attachmentName)
        matchedAttachment = attachments.find(a => {
          const normalizedFilename = normalize(a.original_filename)
          // Check for exact match or filename without extension
          const filenameWithoutExt = normalizedFilename.replace(/\.[^.]+$/, '')
          return normalizedFilename === normalizedTarget || 
                 filenameWithoutExt === normalizedTarget ||
                 normalizedFilename.includes(normalizedTarget)
        }) || null
        if (matchedAttachment) {
          matchedBy = `explicit:${attachmentName}`
        }
      }
    } else if (config.mode === 'column' && config.column) {
      // Match filename containing column value
      const columnValue = recipient.data[config.column]
      if (columnValue) {
        const normalizedValue = normalize(columnValue)
        matchedAttachment = attachments.find(a => {
          const normalizedFilename = normalize(a.original_filename)
          return normalizedFilename.includes(normalizedValue)
        }) || null
        if (matchedAttachment) {
          matchedBy = `column:${config.column}=${columnValue}`
        }
      }
    }

    // Create recipient_attachments record if matched
    if (matchedAttachment) {
      try {
        await execute(
          `INSERT OR REPLACE INTO recipient_attachments 
           (campaign_id, draft_id, recipient_email, attachment_id, matched_by)
           VALUES (?, ?, ?, ?, ?)`,
          [
            campaignId ?? null,
            draftId ?? null,
            recipient.email,
            matchedAttachment.id,
            matchedBy,
          ]
        )
      } catch (error) {
        logger.error('Failed to create recipient_attachment record', {
          email: recipient.email,
          attachmentId: matchedAttachment.id,
        }, error as Error)
      }
    }

    results.push({
      email: recipient.email,
      attachmentId: matchedAttachment?.id ?? null,
      filename: matchedAttachment?.original_filename ?? null,
      matchedBy,
    })
  }

  logger.info('Attachment matching complete', {
    totalRecipients: recipients.length,
    matched: results.filter(r => r.attachmentId !== null).length,
    unmatched: results.filter(r => r.attachmentId === null).length,
  })

  return results
}

/**
 * Get attachment info for a specific recipient
 * @param recipientEmail - Email address of the recipient
 * @param draftId - Optional draft ID
 * @param campaignId - Optional campaign ID
 * @returns Attachment info or null if not found
 */
export async function getRecipientAttachment(
  recipientEmail: string,
  draftId?: number,
  campaignId?: number
): Promise<{ path: string; filename: string; mimeType: string } | null> {
  let query = `
    SELECT a.filepath, a.original_filename, a.mime_type, ra.attachment_id
    FROM recipient_attachments ra
    JOIN attachments a ON a.id = ra.attachment_id
    WHERE ra.recipient_email = ?
  `
  const params: (string | number)[] = [recipientEmail]

  if (campaignId !== undefined) {
    query += ' AND ra.campaign_id = ?'
    params.push(campaignId)
  } else if (draftId !== undefined) {
    query += ' AND ra.draft_id = ?'
    params.push(draftId)
  }

  const row = await queryOne<RecipientAttachmentRow>(query, params)

  if (!row) {
    return null
  }

  return {
    path: row.filepath,
    filename: row.original_filename,
    mimeType: row.mime_type || 'application/octet-stream',
  }
}

/**
 * Get summary statistics for match results
 */
export function getMatchSummary(results: MatchResult[]): MatchSummary {
  const matched = results.filter(r => r.attachmentId !== null)
  const unmatched = results.filter(r => r.attachmentId === null)

  return {
    total: results.length,
    matched: matched.length,
    unmatched: unmatched.length,
    matchedEmails: matched.map(r => r.email),
    unmatchedEmails: unmatched.map(r => r.email),
  }
}

/**
 * Clean up a temporary directory and its contents
 */
export function cleanupTempFiles(dir: string): void {
  if (!existsSync(dir)) {
    return
  }

  // Safety check: only clean up directories under TEMP_DIR
  if (!dir.startsWith(TEMP_DIR)) {
    logger.warn('Refusing to clean up directory outside temp area', { dir })
    return
  }

  try {
    rmSync(dir, { recursive: true, force: true })
    logger.debug('Cleaned up temp directory', { dir })
  } catch (error) {
    logger.error('Failed to clean up temp directory', { dir }, error as Error)
  }
}

/**
 * Create a unique temp directory for ZIP extraction
 */
export function createTempDir(): string {
  ensureDirectories()
  const uniqueDir = join(TEMP_DIR, `extract_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  mkdirSync(uniqueDir, { recursive: true })
  return uniqueDir
}

/**
 * Delete attachment files and DB records for a draft or campaign
 */
export async function deleteAttachments(draftId?: number, campaignId?: number): Promise<void> {
  if (campaignId === undefined && draftId === undefined) {
    return
  }

  // Get file paths before deleting records using parameterized queries
  let attachments: { filepath: string }[]
  
  if (campaignId !== undefined) {
    attachments = await queryAll<{ filepath: string }>('SELECT filepath FROM attachments WHERE campaign_id = ?', [campaignId])
  } else {
    attachments = await queryAll<{ filepath: string }>('SELECT filepath FROM attachments WHERE draft_id = ?', [draftId!])
  }

  // Delete files
  for (const attachment of attachments) {
    try {
      if (existsSync(attachment.filepath)) {
        unlinkSync(attachment.filepath)
        logger.debug('Deleted attachment file', { filepath: attachment.filepath })
      }
    } catch (error) {
      logger.error('Failed to delete attachment file', { filepath: attachment.filepath }, error as Error)
    }
  }

  // Delete DB records using parameterized queries
  if (campaignId !== undefined) {
    await execute('DELETE FROM recipient_attachments WHERE campaign_id = ?', [campaignId])
    await execute('DELETE FROM attachments WHERE campaign_id = ?', [campaignId])
  } else {
    await execute('DELETE FROM recipient_attachments WHERE draft_id = ?', [draftId!])
    await execute('DELETE FROM attachments WHERE draft_id = ?', [draftId!])
  }

  logger.info('Deleted attachments', { draftId, campaignId, count: attachments.length })
}
