import { Router } from 'express'
import { db } from '../db'
import { logger } from '../lib/logger'
import { generatePdf, generateCertificateId } from '../services/pdf-generator'
import type {
  CertificateTemplate,
  CertificateConfig,
  CertificateData,
  GeneratedCertificate,
} from '../lib/certificate-types'

export const certificatesRouter = Router()

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

// Static certificate templates (design presets)
const CERTIFICATE_TEMPLATES: CertificateTemplate[] = [
  {
    id: 'modern-blue',
    name: 'Modern Blue',
    category: 'modern',
    thumbnail: '/templates/modern-blue.png',
    description: 'Clean and professional blue design with geometric accents',
    defaultColors: { primary: '#1e40af', secondary: '#3b82f6', accent: '#dbeafe' },
  },
  {
    id: 'modern-green',
    name: 'Modern Green',
    category: 'modern',
    thumbnail: '/templates/modern-green.png',
    description: 'Fresh green design for environmental or wellness certificates',
    defaultColors: { primary: '#166534', secondary: '#22c55e', accent: '#dcfce7' },
  },
  {
    id: 'dark-gold',
    name: 'Dark Gold',
    category: 'dark',
    thumbnail: '/templates/dark-gold.png',
    description: 'Elegant dark theme with gold accents',
    defaultColors: { primary: '#1f2937', secondary: '#d97706', accent: '#fef3c7' },
  },
  {
    id: 'dark-silver',
    name: 'Dark Silver',
    category: 'dark',
    thumbnail: '/templates/dark-silver.png',
    description: 'Sophisticated dark theme with silver highlights',
    defaultColors: { primary: '#111827', secondary: '#9ca3af', accent: '#e5e7eb' },
  },
  {
    id: 'elegant-cream',
    name: 'Elegant Cream',
    category: 'elegant',
    thumbnail: '/templates/elegant-cream.png',
    description: 'Classic cream and burgundy design with ornate borders',
    defaultColors: { primary: '#7c2d12', secondary: '#dc2626', accent: '#fef2f2' },
  },
  {
    id: 'elegant-navy',
    name: 'Elegant Navy',
    category: 'elegant',
    thumbnail: '/templates/elegant-navy.png',
    description: 'Traditional navy blue with gold trim',
    defaultColors: { primary: '#1e3a5f', secondary: '#c9a227', accent: '#f5f0e1' },
  },
  {
    id: 'minimal-mono',
    name: 'Minimal Mono',
    category: 'minimal',
    thumbnail: '/templates/minimal-mono.png',
    description: 'Clean black and white minimalist design',
    defaultColors: { primary: '#171717', secondary: '#525252', accent: '#fafafa' },
  },
  {
    id: 'minimal-pastel',
    name: 'Minimal Pastel',
    category: 'minimal',
    thumbnail: '/templates/minimal-pastel.png',
    description: 'Soft pastel colors with clean typography',
    defaultColors: { primary: '#6366f1', secondary: '#a5b4fc', accent: '#eef2ff' },
  },
]

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
  res.json(CERTIFICATE_TEMPLATES)
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
    const template = CERTIFICATE_TEMPLATES.find(t => t.id === config.templateId)
    
    if (!template) {
      return res.status(400).json({ error: 'Invalid template ID in config' })
    }
    
    // Generate HTML from config and data
    const html = generateCertificateHtml(config, data, template)
    
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
    const template = CERTIFICATE_TEMPLATES.find(t => t.id === config.templateId)
    
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
      const html = generateCertificateHtml(config, dataWithId, template)
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

// Helper function to generate certificate HTML
function generateCertificateHtml(
  config: CertificateConfig,
  data: CertificateData,
  template: CertificateTemplate
): string {
  // Replace placeholders in description template
  let description = config.descriptionTemplate
  for (const [key, value] of Object.entries(data)) {
    if (value) {
      description = description.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
  }
  
  // Build logo HTML
  const logosHtml = config.logos
    .sort((a, b) => a.order - b.order)
    .map(logo => `<img src="${logo.url}" style="height: 60px; margin: 0 15px;" alt="Logo">`)
    .join('')
  
  // Build signatories HTML
  const signatoriesHtml = config.signatories
    .sort((a, b) => a.order - b.order)
    .map(sig => `
      <div style="text-align: center; margin: 0 30px;">
        ${sig.signatureUrl ? `<img src="${sig.signatureUrl}" style="height: 50px; margin-bottom: 5px;" alt="Signature">` : '<div style="height: 50px;"></div>'}
        <div style="border-top: 1px solid ${config.colors.secondary}; padding-top: 5px;">
          <div style="font-weight: bold;">${sig.name}</div>
          <div style="font-size: 12px; color: ${config.colors.secondary};">${sig.designation}</div>
          <div style="font-size: 11px; color: #666;">${sig.organization}</div>
        </div>
      </div>
    `)
    .join('')
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Open Sans', sans-serif;
      background: ${config.colors.accent};
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .certificate {
      width: 280mm;
      height: 195mm;
      background: white;
      border: 3px solid ${config.colors.primary};
      padding: 20mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      position: relative;
    }
    
    .certificate::before {
      content: '';
      position: absolute;
      top: 5mm;
      left: 5mm;
      right: 5mm;
      bottom: 5mm;
      border: 1px solid ${config.colors.secondary};
      pointer-events: none;
    }
    
    .header {
      text-align: center;
    }
    
    .logos {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .title {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      font-weight: 700;
      color: ${config.colors.primary};
      letter-spacing: 8px;
      margin-bottom: 5px;
    }
    
    .subtitle {
      font-size: 18px;
      color: ${config.colors.secondary};
      letter-spacing: 4px;
      text-transform: uppercase;
    }
    
    .content {
      text-align: center;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .presented-to {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    
    .recipient-name {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      color: ${config.colors.primary};
      margin-bottom: 20px;
    }
    
    .description {
      font-size: 16px;
      color: #444;
      max-width: 500px;
      margin: 0 auto;
      line-height: 1.6;
    }
    
    .footer {
      width: 100%;
    }
    
    .signatories {
      display: flex;
      justify-content: center;
      margin-bottom: 15px;
    }
    
    .certificate-id {
      text-align: center;
      font-size: 10px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logos">${logosHtml}</div>
      <div class="title">${config.titleText}</div>
      <div class="subtitle">${config.subtitleText}</div>
    </div>
    
    <div class="content">
      <div class="presented-to">This is proudly presented to</div>
      <div class="recipient-name">${data.name}</div>
      <div class="description">${description}</div>
    </div>
    
    <div class="footer">
      <div class="signatories">${signatoriesHtml}</div>
      ${data.certificate_id ? `<div class="certificate-id">Certificate ID: ${data.certificate_id}</div>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim()
}
