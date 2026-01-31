import { Router } from 'express'
import { db } from '../db'
import { logger } from '../lib/logger'
import { generatePdf, generateCertificateId } from '../services/pdf-generator'
import { getAllTemplates, getTemplateById, renderTemplate } from '../services/certificate-templates'
import { registerAllTemplates } from '../templates/certificates'
import type {
  CertificateConfig,
  CertificateData,
  GeneratedCertificate,
} from '../lib/certificate-types'

// Register all templates on module load
registerAllTemplates()

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

// GET /templates - Return all certificate templates
certificatesRouter.get('/templates', (_, res) => {
  logger.info('Listing certificate templates', { service: 'certificates' })
  res.json(getAllTemplates())
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
  
  if (!validateColors(colors)) {
    return res.status(400).json({ error: 'Invalid color format. Colors must be valid hex codes (e.g., #1e40af)' })
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
    updates.push('logos = ?')
    values.push(JSON.stringify(logos))
  }
  if (signatories !== undefined) {
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
    const template = getTemplateById(config.templateId)
    
    if (!template) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    // Generate HTML from config and data
    const html = renderTemplate(template, config, data)
    
    // Generate PDF
    const pdfBuffer = await generatePdf(html)
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
    const template = getTemplateById(config.templateId)
    
    if (!template) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    const results: { certificateId: string; recipientName: string; pdf: string }[] = []
    
    for (const recipientData of recipients) {
      if (!recipientData.name) {
        continue // Skip recipients without names
      }
      
      const certificateId = recipientData.certificate_id || generateCertificateId()
      const dataWithId = { ...recipientData, certificate_id: certificateId }
      
      // Generate HTML and PDF
      const html = renderTemplate(template, config, dataWithId)
      const pdfBuffer = await generatePdf(html)
      const base64 = pdfBuffer.toString('base64')
      
      // Save to database
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
        recipientName: recipientData.name,
        pdf: base64,
      })
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


