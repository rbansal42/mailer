import { Router } from 'express'
import archiver from 'archiver'
import { join } from 'path'
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { db } from '../db'
import { logger } from '../lib/logger'
import { 
  generateCertificateId,
  getReactPdfTemplateIds,
  getPdfWorkerPool,
  type CertificateProps,
  type TemplateId,
} from '../services/pdf'
import type {
  CertificateConfig,
  CertificateData,
  GeneratedCertificate,
} from '../lib/certificate-types'
import { validateLogoUrls, validateSignatoryUrls } from '../lib/url-validation'

// Data directory for storing generated certificates
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), '..', 'data')
const CERTIFICATES_DIR = join(DATA_DIR, 'certificates')

// Helper to replace template variables in description
function replaceVariables(text: string, data: CertificateData): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`)
}

// Helper to generate PDF using worker pool
async function generateCertificatePdf(
  config: CertificateConfig,
  data: CertificateData,
  certificateId: string
): Promise<Buffer> {
  const props: CertificateProps = {
    title: config.titleText,
    subtitle: config.subtitleText,
    recipientName: data.name,
    description: replaceVariables(config.descriptionTemplate, data),
    logos: config.logos?.map(l => ({ url: l.url, width: l.width })),
    signatories: config.signatories?.map(s => ({
      name: s.name,
      designation: s.designation,
      organization: s.organization,
      signatureUrl: s.signatureUrl,
    })),
    certificateId,
  }
  
  const pool = getPdfWorkerPool()
  return pool.generate(config.templateId as TemplateId, props)
}

export const certificatesRouter = Router()

// Color validation to prevent CSS injection
const hexColorRegex = /^#[0-9A-Fa-f]{6}$/
function validateColors(colors: { primary?: string; secondary?: string; accent?: string }): boolean {
  return colors &&
    typeof colors.primary === 'string' && hexColorRegex.test(colors.primary) &&
    typeof colors.secondary === 'string' && hexColorRegex.test(colors.secondary) &&
    typeof colors.accent === 'string' && hexColorRegex.test(colors.accent)
}

// Database row types
interface CertificateConfigRow {
  id: number
  name: string
  template_id: string
  colors: string
  logos: string
  signatories: string
  title_text: string
  subtitle_text: string
  description_template: string
  created_at: string
  updated_at: string
}

interface GeneratedCertificateRow {
  id: number
  certificate_id: string
  config_id: number
  recipient_name: string
  recipient_email: string | null
  data: string
  pdf_path: string | null
  campaign_id: number | null
  generated_at: string
}

function formatConfig(row: CertificateConfigRow): CertificateConfig {
  return {
    id: row.id,
    name: row.name,
    templateId: row.template_id,
    colors: JSON.parse(row.colors),
    logos: JSON.parse(row.logos || '[]'),
    signatories: JSON.parse(row.signatories || '[]'),
    titleText: row.title_text,
    subtitleText: row.subtitle_text,
    descriptionTemplate: row.description_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function formatGeneratedCertificate(row: GeneratedCertificateRow): GeneratedCertificate {
  return {
    id: row.id,
    certificateId: row.certificate_id,
    configId: row.config_id,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email || undefined,
    data: JSON.parse(row.data || '{}'),
    pdfPath: row.pdf_path || undefined,
    campaignId: row.campaign_id || undefined,
    generatedAt: row.generated_at,
  }
}

// Template metadata
const templates = [
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    category: 'modern' as const,
    thumbnail: '/thumbnails/modern-clean.png',
    description: 'Double border design with accent bar - clean and professional',
    defaultColors: { primary: '#1e293b', secondary: '#64748b', accent: '#0ea5e9' },
  },
  {
    id: 'dark-elegant',
    name: 'Dark Elegant',
    category: 'dark' as const,
    thumbnail: '/thumbnails/dark-elegant.png',
    description: 'Dark background with gold accents - sophisticated and bold',
    defaultColors: { primary: '#1e293b', secondary: '#94a3b8', accent: '#fbbf24' },
  },
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    category: 'minimal' as const,
    thumbnail: '/thumbnails/clean-minimal.png',
    description: 'White minimal design - simple and elegant',
    defaultColors: { primary: '#1e293b', secondary: '#64748b', accent: '#0ea5e9' },
  },
  {
    id: 'wave-accent',
    name: 'Wave Accent',
    category: 'minimal' as const,
    thumbnail: '/thumbnails/wave-accent.png',
    description: 'Layered color bars at bottom - modern and dynamic',
    defaultColors: { primary: '#1e293b', secondary: '#64748b', accent: '#0ea5e9' },
  },
]

const validTemplateIds = new Set(getReactPdfTemplateIds())

function isValidTemplate(templateId: string): boolean {
  return validTemplateIds.has(templateId as TemplateId)
}

// GET /templates - Return all certificate templates
certificatesRouter.get('/templates', (_, res) => {
  logger.info('Listing certificate templates', { service: 'certificates' })
  res.json(templates)
})

// GET /configs - List saved certificate configs
certificatesRouter.get('/configs', (_, res) => {
  logger.info('Listing certificate configs', { service: 'certificates' })
  const rows = db.query(
    'SELECT * FROM certificate_configs ORDER BY updated_at DESC'
  ).all() as CertificateConfigRow[]
  res.json(rows.map(formatConfig))
})

// GET /configs/:id - Get single config
certificatesRouter.get('/configs/:id', (req, res) => {
  const { id } = req.params
  logger.info('Getting certificate config', { service: 'certificates', configId: id })
  
  const row = db.query(
    'SELECT * FROM certificate_configs WHERE id = ?'
  ).get(id) as CertificateConfigRow | null
  
  if (!row) {
    logger.warn('Certificate config not found', { service: 'certificates', configId: id })
    return res.status(404).json({ error: 'Certificate config not found' })
  }
  
  res.json(formatConfig(row))
})

// POST /configs - Create certificate config
certificatesRouter.post('/configs', (req, res) => {
  const { name, templateId, colors, logos, signatories, titleText, subtitleText, descriptionTemplate } = req.body
  
  if (!name || !templateId || !colors) {
    return res.status(400).json({ error: 'name, templateId, and colors are required' })
  }
  
  if (!isValidTemplate(templateId)) {
    return res.status(400).json({ error: `Invalid template ID. Valid options: ${getReactPdfTemplateIds().join(', ')}` })
  }
  
  if (!validateColors(colors)) {
    return res.status(400).json({ error: 'Invalid color format. Colors must be valid hex codes (e.g., #1e40af)' })
  }
  
  // Validate logo and signature URLs to prevent SSRF
  const logoUrlError = validateLogoUrls(logos)
  if (logoUrlError) {
    return res.status(400).json({ error: logoUrlError })
  }
  
  const signatoryUrlError = validateSignatoryUrls(signatories)
  if (signatoryUrlError) {
    return res.status(400).json({ error: signatoryUrlError })
  }
  
  logger.info('Creating certificate config', { service: 'certificates', name, templateId })
  
  const result = db.run(
    `INSERT INTO certificate_configs 
     (name, template_id, colors, logos, signatories, title_text, subtitle_text, description_template)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      templateId,
      JSON.stringify(colors),
      JSON.stringify(logos || []),
      JSON.stringify(signatories || []),
      titleText || 'CERTIFICATE',
      subtitleText || 'of Participation',
      descriptionTemplate || 'For participating in {{title}} on {{date}}.',
    ]
  )
  
  const row = db.query(
    'SELECT * FROM certificate_configs WHERE id = ?'
  ).get(result.lastInsertRowid) as CertificateConfigRow
  
  logger.info('Certificate config created', { service: 'certificates', configId: row.id })
  res.status(201).json(formatConfig(row))
})

// PUT /configs/:id - Update certificate config
certificatesRouter.put('/configs/:id', (req, res) => {
  const { id } = req.params
  const { name, templateId, colors, logos, signatories, titleText, subtitleText, descriptionTemplate } = req.body
  
  logger.info('Updating certificate config', { service: 'certificates', configId: id })
  
  // Build dynamic update
  const updates: string[] = []
  const values: (string | number)[] = []
  
  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (templateId !== undefined) {
    if (!isValidTemplate(templateId)) {
      return res.status(400).json({ error: `Invalid template ID. Valid options: ${getReactPdfTemplateIds().join(', ')}` })
    }
    updates.push('template_id = ?')
    values.push(templateId)
  }
  if (colors !== undefined) {
    if (!validateColors(colors)) {
      return res.status(400).json({ error: 'Invalid color format. Colors must be valid hex codes (e.g., #1e40af)' })
    }
    updates.push('colors = ?')
    values.push(JSON.stringify(colors))
  }
  if (logos !== undefined) {
    // Validate logo URLs to prevent SSRF
    const logoUrlError = validateLogoUrls(logos)
    if (logoUrlError) {
      return res.status(400).json({ error: logoUrlError })
    }
    updates.push('logos = ?')
    values.push(JSON.stringify(logos))
  }
  if (signatories !== undefined) {
    // Validate signature URLs to prevent SSRF
    const signatoryUrlError = validateSignatoryUrls(signatories)
    if (signatoryUrlError) {
      return res.status(400).json({ error: signatoryUrlError })
    }
    updates.push('signatories = ?')
    values.push(JSON.stringify(signatories))
  }
  if (titleText !== undefined) {
    updates.push('title_text = ?')
    values.push(titleText)
  }
  if (subtitleText !== undefined) {
    updates.push('subtitle_text = ?')
    values.push(subtitleText)
  }
  if (descriptionTemplate !== undefined) {
    updates.push('description_template = ?')
    values.push(descriptionTemplate)
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  db.run(`UPDATE certificate_configs SET ${updates.join(', ')} WHERE id = ?`, values)
  
  const row = db.query(
    'SELECT * FROM certificate_configs WHERE id = ?'
  ).get(id) as CertificateConfigRow | null
  
  if (!row) {
    logger.warn('Certificate config not found for update', { service: 'certificates', configId: id })
    return res.status(404).json({ error: 'Certificate config not found' })
  }
  
  logger.info('Certificate config updated', { service: 'certificates', configId: id })
  res.json(formatConfig(row))
})

// DELETE /configs/:id - Delete certificate config
certificatesRouter.delete('/configs/:id', (req, res) => {
  const { id } = req.params
  logger.info('Deleting certificate config', { service: 'certificates', configId: id })
  
  db.run('DELETE FROM certificate_configs WHERE id = ?', [id])
  
  logger.info('Certificate config deleted', { service: 'certificates', configId: id })
  res.status(204).send()
})

// POST /preview - Generate single preview PDF (returns base64)
certificatesRouter.post('/preview', async (req, res) => {
  const { configId, data } = req.body as { configId: number; data: CertificateData }
  
  if (!configId || !data || !data.name) {
    return res.status(400).json({ error: 'configId and data with name are required' })
  }
  
  logger.info('Generating certificate preview', { service: 'certificates', configId })
  
  try {
    const configRow = db.query(
      'SELECT * FROM certificate_configs WHERE id = ?'
    ).get(configId) as CertificateConfigRow | null
    
    if (!configRow) {
      return res.status(404).json({ error: 'Certificate config not found' })
    }
    
    const config = formatConfig(configRow)
    
    if (!isValidTemplate(config.templateId)) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    const previewCertId = data.certificate_id || 'PREVIEW'
    const pdfBuffer = await generateCertificatePdf(config, data, previewCertId)
    const base64 = pdfBuffer.toString('base64')
    
    logger.info('Certificate preview generated', { service: 'certificates', configId })
    res.json({ pdf: base64 })
  } catch (error) {
    logger.error('Failed to generate certificate preview', { 
      service: 'certificates', 
      configId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    res.status(500).json({ error: 'Failed to generate certificate' })
  }
})

// POST /preview-draft - Preview with unsaved config data (no configId required)
certificatesRouter.post('/preview-draft', async (req, res) => {
  const { config, data } = req.body as {
    config: {
      templateId: string
      titleText: string
      subtitleText: string
      descriptionTemplate: string
      logos: Array<{ url: string; width?: number }>
      signatories: Array<{
        name: string
        designation: string
        organization?: string
        signatureUrl?: string
      }>
    }
    data: CertificateData
  }

  if (!config || !data || !data.name) {
    return res.status(400).json({ error: 'config and data with name are required' })
  }

  if (!isValidTemplate(config.templateId)) {
    return res.status(400).json({ error: `Invalid template ID. Valid options: ${getReactPdfTemplateIds().join(', ')}` })
  }

  // Validate logo and signature URLs to prevent SSRF
  const logoUrlError = validateLogoUrls(config.logos)
  if (logoUrlError) {
    return res.status(400).json({ error: logoUrlError })
  }

  const signatoryUrlError = validateSignatoryUrls(config.signatories)
  if (signatoryUrlError) {
    return res.status(400).json({ error: signatoryUrlError })
  }

  logger.info('Generating draft certificate preview', { service: 'certificates', templateId: config.templateId })

  try {
    const props: CertificateProps = {
      title: config.titleText || 'CERTIFICATE',
      subtitle: config.subtitleText,
      recipientName: data.name,
      description: replaceVariables(config.descriptionTemplate || '', data),
      logos: config.logos,
      signatories: config.signatories,
      certificateId: data.certificate_id || 'PREVIEW',
    }

    const pool = getPdfWorkerPool()
    const pdfBuffer = await pool.generate(config.templateId as TemplateId, props)
    const base64 = pdfBuffer.toString('base64')

    logger.info('Draft certificate preview generated', { service: 'certificates' })
    res.json({ pdf: base64 })
  } catch (error) {
    logger.error('Failed to generate draft certificate preview', {
      service: 'certificates',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    res.status(500).json({ error: 'Failed to generate certificate preview' })
  }
})

// POST /generate - Bulk generate certificates
certificatesRouter.post('/generate', async (req, res) => {
  const { configId, recipients } = req.body as { configId: number; recipients: CertificateData[] }
  
  if (!configId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'configId and non-empty recipients array are required' })
  }
  
  logger.info('Bulk generating certificates', { 
    service: 'certificates', 
    configId, 
    recipientCount: recipients.length 
  })
  
  try {
    const configRow = db.query(
      'SELECT * FROM certificate_configs WHERE id = ?'
    ).get(configId) as CertificateConfigRow | null
    
    if (!configRow) {
      return res.status(404).json({ error: 'Certificate config not found' })
    }
    
    const config = formatConfig(configRow)
    
    if (!isValidTemplate(config.templateId)) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    const results: { certificateId: string; recipientName: string; pdf: string }[] = []
    
    // Generate all PDFs first (before transaction)
    const generatedPdfs: { recipientData: CertificateData; certificateId: string; pdfBuffer: Buffer }[] = []
    
    for (const recipientData of recipients) {
      if (!recipientData.name) {
        continue // Skip recipients without names
      }
      
      const certificateId = recipientData.certificate_id || generateCertificateId()
      const pdfBuffer = await generateCertificatePdf(config, recipientData, certificateId)
      generatedPdfs.push({ recipientData, certificateId, pdfBuffer })
    }
    
    // Use transaction for all database inserts
    db.exec('BEGIN TRANSACTION')
    try {
      for (const { recipientData, certificateId, pdfBuffer } of generatedPdfs) {
        const base64 = pdfBuffer.toString('base64')
        
        // Save to database
        const dataWithId = { ...recipientData, certificate_id: certificateId }
        db.run(
          `INSERT INTO generated_certificates 
           (certificate_id, config_id, recipient_name, recipient_email, data)
           VALUES (?, ?, ?, ?, ?)`,
          [
            certificateId,
            configId,
            recipientData.name,
            recipientData.email || null,
            JSON.stringify(dataWithId),
          ]
        )
        
        results.push({
          certificateId,
          recipientName: recipientData.name!,
          pdf: base64,
        })
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    
    logger.info('Bulk certificate generation complete', { 
      service: 'certificates', 
      configId, 
      generated: results.length 
    })
    
    res.json({ 
      success: true, 
      generated: results.length,
      certificates: results 
    })
  } catch (error) {
    logger.error('Failed to generate certificates', { 
      service: 'certificates', 
      configId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    res.status(500).json({ error: 'Failed to generate certificates' })
  }
})

// POST /generate/zip - Bulk generate certificates and return as ZIP file stream
certificatesRouter.post('/generate/zip', async (req, res) => {
  const { configId, recipients } = req.body as { configId: number; recipients: CertificateData[] }
  
  if (!configId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'configId and non-empty recipients array are required' })
  }
  
  logger.info('Generating certificates ZIP', { 
    service: 'certificates', 
    configId, 
    recipientCount: recipients.length 
  })
  
  try {
    const configRow = db.query(
      'SELECT * FROM certificate_configs WHERE id = ?'
    ).get(configId) as CertificateConfigRow | null
    
    if (!configRow) {
      return res.status(404).json({ error: 'Certificate config not found' })
    }
    
    const config = formatConfig(configRow)
    
    if (!isValidTemplate(config.templateId)) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    // Set response headers for ZIP download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const zipFilename = `certificates-${config.name.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.zip`
    
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)
    
    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 6 } })
    
    archive.on('error', (err) => {
      logger.error('Archive error', { service: 'certificates', configId, error: err.message })
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP' })
      }
    })
    
    // Pipe archive to response
    archive.pipe(res)
    
    // Generate all PDFs first (before transaction)
    const generatedPdfs: { recipientData: CertificateData; certificateId: string; pdfBuffer: Buffer; filename: string }[] = []
    
    for (const recipientData of recipients) {
      if (!recipientData.name) {
        continue
      }
      
      const certificateId = recipientData.certificate_id || generateCertificateId()
      const pdfBuffer = await generateCertificatePdf(config, recipientData, certificateId)
      
      // Sanitize filename
      const safeName = recipientData.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const filename = `${safeName}_${certificateId}.pdf`
      
      generatedPdfs.push({ recipientData, certificateId, pdfBuffer, filename })
    }
    
    // Use transaction for all database inserts
    db.exec('BEGIN TRANSACTION')
    try {
      for (const { recipientData, certificateId, pdfBuffer, filename } of generatedPdfs) {
        // Add to archive
        archive.append(pdfBuffer, { name: filename })
        
        // Save to database
        const dataWithId = { ...recipientData, certificate_id: certificateId }
        db.run(
          `INSERT INTO generated_certificates 
           (certificate_id, config_id, recipient_name, recipient_email, data)
           VALUES (?, ?, ?, ?, ?)`,
          [
            certificateId,
            configId,
            recipientData.name,
            recipientData.email || null,
            JSON.stringify(dataWithId),
          ]
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    
    // Finalize archive
    await archive.finalize()
    
    logger.info('ZIP generation complete', { 
      service: 'certificates', 
      configId, 
      generated: generatedPdfs.length 
    })
  } catch (error) {
    logger.error('Failed to generate certificates ZIP', { 
      service: 'certificates', 
      configId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate certificates' })
    }
  }
})

// Helper to ensure certificates directory exists
function ensureCertificatesDir(): void {
  if (!existsSync(CERTIFICATES_DIR)) {
    mkdirSync(CERTIFICATES_DIR, { recursive: true })
  }
}

// POST /generate/campaign - Generate certificates and store as attachments for email campaign
certificatesRouter.post('/generate/campaign', async (req, res) => {
  const { configId, recipients, draftId } = req.body as { 
    configId: number
    recipients: CertificateData[]
    draftId?: number 
  }
  
  if (!configId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'configId and non-empty recipients array are required' })
  }
  
  // Verify all recipients have email addresses for campaign use
  const recipientsWithEmail = recipients.filter(r => r.email && r.name)
  if (recipientsWithEmail.length === 0) {
    return res.status(400).json({ error: 'Recipients must have email addresses for campaign integration' })
  }
  
  logger.info('Generating certificates for campaign', { 
    service: 'certificates', 
    configId, 
    draftId,
    recipientCount: recipientsWithEmail.length 
  })
  
  try {
    const configRow = db.query(
      'SELECT * FROM certificate_configs WHERE id = ?'
    ).get(configId) as CertificateConfigRow | null
    
    if (!configRow) {
      return res.status(404).json({ error: 'Certificate config not found' })
    }
    
    const config = formatConfig(configRow)
    
    if (!isValidTemplate(config.templateId)) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    ensureCertificatesDir()
    
    const timestamp = Date.now()
    const results: { email: string; certificateId: string; attachmentId: number }[] = []
    
    // Generate all PDFs and save to disk first (before transaction)
    const generatedPdfs: { 
      recipientData: CertificateData
      certificateId: string
      pdfBuffer: Buffer
      safeName: string
      filename: string
      filepath: string
    }[] = []
    
    for (let i = 0; i < recipientsWithEmail.length; i++) {
      const recipientData = recipientsWithEmail[i]
      
      const certificateId = recipientData.certificate_id || generateCertificateId()
      const pdfBuffer = await generateCertificatePdf(config, recipientData, certificateId)
      
      // Save PDF to disk
      const safeName = recipientData.name!.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
      const filename = `${timestamp}_${i}_${safeName}_${certificateId}.pdf`
      const filepath = join(CERTIFICATES_DIR, filename)
      
      writeFileSync(filepath, pdfBuffer)
      
      generatedPdfs.push({ recipientData, certificateId, pdfBuffer, safeName, filename, filepath })
    }
    
    // Use transaction for all database inserts
    db.exec('BEGIN TRANSACTION')
    try {
      for (const { recipientData, certificateId, pdfBuffer, safeName, filename, filepath } of generatedPdfs) {
        // Create attachment record
        const attachmentResult = db.run(
          `INSERT INTO attachments (draft_id, filename, original_filename, filepath, size_bytes, mime_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            draftId ?? null,
            filename,
            `Certificate_${safeName}.pdf`,
            filepath,
            pdfBuffer.length,
            'application/pdf',
          ]
        )
        const attachmentId = Number(attachmentResult.lastInsertRowid)
        
        // Create recipient-attachment mapping
        const email = recipientData.email!
        const name = recipientData.name!
        const dataWithId = { ...recipientData, certificate_id: certificateId }
        
        db.run(
          `INSERT INTO recipient_attachments (draft_id, recipient_email, attachment_id, matched_by)
           VALUES (?, ?, ?, ?)`,
          [
            draftId ?? null,
            email,
            attachmentId,
            'certificate:auto-generated',
          ]
        )
        
        // Save certificate record
        db.run(
          `INSERT INTO generated_certificates 
           (certificate_id, config_id, recipient_name, recipient_email, data, pdf_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            certificateId,
            configId,
            name,
            email,
            JSON.stringify(dataWithId),
            filepath,
          ]
        )
        
        results.push({
          email: recipientData.email!,
          certificateId,
          attachmentId,
        })
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      // Clean up orphan PDF files on rollback
      for (const { filepath } of generatedPdfs) {
        try {
          if (existsSync(filepath)) {
            unlinkSync(filepath)
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      throw error
    }
    
    logger.info('Campaign certificates generation complete', { 
      service: 'certificates', 
      configId, 
      draftId,
      generated: results.length 
    })
    
    res.json({ 
      success: true, 
      generated: results.length,
      attachments: results,
      message: `Generated ${results.length} certificates. They will be automatically attached when sending emails to these recipients.`
    })
  } catch (error) {
    logger.error('Failed to generate campaign certificates', { 
      service: 'certificates', 
      configId, 
      draftId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    res.status(500).json({ error: 'Failed to generate certificates' })
  }
})

// DELETE /campaign-attachments/:draftId - Clean up certificate attachments for a draft
certificatesRouter.delete('/campaign-attachments/:draftId', (req, res) => {
  const draftId = parseInt(req.params.draftId)
  
  if (isNaN(draftId)) {
    return res.status(400).json({ error: 'Invalid draft ID' })
  }
  
  logger.info('Cleaning up campaign certificate attachments', { 
    service: 'certificates', 
    draftId 
  })
  
  try {
    // Get attachment filepaths before deleting
    const attachments = db.query(
      `SELECT a.filepath FROM attachments a
       JOIN recipient_attachments ra ON ra.attachment_id = a.id
       WHERE ra.draft_id = ? AND ra.matched_by = 'certificate:auto-generated'`
    ).all(draftId) as { filepath: string }[]
    
    // Delete files
    for (const attachment of attachments) {
      try {
        if (existsSync(attachment.filepath)) {
          unlinkSync(attachment.filepath)
        }
      } catch (err) {
        logger.warn('Failed to delete certificate file', { 
          filepath: attachment.filepath, 
          error: err instanceof Error ? err.message : 'Unknown' 
        })
      }
    }
    
    // Delete database records
    db.run(
      `DELETE FROM recipient_attachments WHERE draft_id = ? AND matched_by = 'certificate:auto-generated'`,
      [draftId]
    )
    
    db.run(
      `DELETE FROM attachments WHERE draft_id = ? AND id NOT IN (
        SELECT attachment_id FROM recipient_attachments WHERE draft_id = ?
      )`,
      [draftId, draftId]
    )
    
    logger.info('Cleaned up campaign certificate attachments', { 
      service: 'certificates', 
      draftId,
      filesDeleted: attachments.length 
    })
    
    res.json({ success: true, deleted: attachments.length })
  } catch (error) {
    logger.error('Failed to clean up campaign attachments', { 
      service: 'certificates', 
      draftId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
    res.status(500).json({ error: 'Failed to clean up attachments' })
  }
})
