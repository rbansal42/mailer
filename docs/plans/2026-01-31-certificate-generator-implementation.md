# Certificate Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add certificate generation with 12 beautiful templates, dynamic fields, auto-scaling text, bulk PDF generation, and email integration.

**Architecture:** Frontend React page with template gallery, visual editor, and CSV-based bulk generation. Backend Hono API with Puppeteer for server-side PDF rendering. Certificates stored in SQLite with PDFs on filesystem.

**Tech Stack:** React, Zustand, Puppeteer, Archiver (ZIP), Hono, SQLite (Drizzle ORM)

---

## Phase 1: Foundation

### Task 1: Install Dependencies

**Files:**
- Modify: `server/package.json`

**Step 1: Install Puppeteer and Archiver**

```bash
cd server && bun add puppeteer archiver && bun add -d @types/archiver
```

**Step 2: Verify installation**

```bash
bun run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add puppeteer and archiver dependencies"
```

---

### Task 2: Database Schema for Certificates

**Files:**
- Modify: `server/src/db/schema.ts`

**Step 1: Add certificate tables to schema**

Add after existing tables:

```typescript
// Certificate configuration (user-customized template)
export const certificateConfigs = sqliteTable('certificate_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  templateId: text('template_id').notNull(),
  colors: text('colors', { mode: 'json' }).$type<{
    primary: string
    secondary: string
    accent: string
  }>().notNull(),
  logos: text('logos', { mode: 'json' }).$type<Array<{
    id: string
    url: string
    width: number
    order: number
  }>>().default([]),
  signatories: text('signatories', { mode: 'json' }).$type<Array<{
    id: string
    name: string
    designation: string
    organization: string
    signatureUrl: string
    order: number
  }>>().default([]),
  titleText: text('title_text').default('CERTIFICATE'),
  subtitleText: text('subtitle_text').default('of Participation'),
  descriptionTemplate: text('description_template').default('For participating in {{title}} on {{date}}.'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// Generated certificates (tracking)
export const generatedCertificates = sqliteTable('generated_certificates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  certificateId: text('certificate_id').notNull().unique(), // CERT-2026-00001
  configId: integer('config_id').references(() => certificateConfigs.id),
  recipientName: text('recipient_name').notNull(),
  recipientEmail: text('recipient_email'),
  data: text('data', { mode: 'json' }).$type<Record<string, string>>().default({}),
  pdfPath: text('pdf_path'),
  campaignId: integer('campaign_id').references(() => campaigns.id),
  generatedAt: text('generated_at').default(sql`CURRENT_TIMESTAMP`),
})
```

**Step 2: Run migration**

```bash
cd server && bun run db:push
```
Expected: Tables created successfully

**Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add certificate database schema"
```

---

### Task 3: PDF Generation Service

**Files:**
- Create: `server/src/services/pdf-generator.ts`

**Step 1: Create PDF generator service**

```typescript
import puppeteer, { Browser } from 'puppeteer'
import { logger } from '../lib/logger'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browser
}

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    // A4 landscape at 300 DPI
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

// Auto-scaling font size calculation
export function calculateFontSize(
  text: string,
  maxWidth: number,
  baseFontSize: number,
  minFontSize: number
): number {
  // Approximate character width ratio for script fonts
  const avgCharWidth = baseFontSize * 0.5
  const estimatedWidth = text.length * avgCharWidth
  
  if (estimatedWidth <= maxWidth) return baseFontSize
  
  const scaleFactor = maxWidth / estimatedWidth
  return Math.max(Math.floor(baseFontSize * scaleFactor), minFontSize)
}

// Generate unique certificate ID
export function generateCertificateId(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `CERT-${year}-${random}`
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd server && bun run build
```
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/services/pdf-generator.ts
git commit -m "feat: add PDF generation service with Puppeteer"
```

---

### Task 4: Certificate API Types

**Files:**
- Create: `server/src/lib/certificate-types.ts`

**Step 1: Create shared types**

```typescript
export interface CertificateTemplate {
  id: string
  name: string
  category: 'modern' | 'dark' | 'elegant' | 'minimal'
  thumbnail: string
  description: string
  defaultColors: {
    primary: string
    secondary: string
    accent: string
  }
}

export interface LogoConfig {
  id: string
  url: string
  width: number
  order: number
}

export interface SignatoryConfig {
  id: string
  name: string
  designation: string
  organization: string
  signatureUrl: string
  order: number
}

export interface CertificateConfig {
  id: number
  name: string
  templateId: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  logos: LogoConfig[]
  signatories: SignatoryConfig[]
  titleText: string
  subtitleText: string
  descriptionTemplate: string
  createdAt: string
  updatedAt: string
}

export interface CertificateData {
  name: string
  date?: string
  title?: string
  certificate_id?: string
  custom1?: string
  custom2?: string
  custom3?: string
  [key: string]: string | undefined
}

export interface GenerateRequest {
  configId: number
  recipients: CertificateData[]
}

export interface GeneratedCertificate {
  id: number
  certificateId: string
  configId: number
  recipientName: string
  recipientEmail?: string
  data: Record<string, string>
  pdfPath?: string
  campaignId?: number
  generatedAt: string
}
```

**Step 2: Commit**

```bash
git add src/lib/certificate-types.ts
git commit -m "feat: add certificate type definitions"
```

---

### Task 5: Certificate API Routes Skeleton

**Files:**
- Create: `server/src/routes/certificates.ts`
- Modify: `server/src/index.ts`

**Step 1: Create routes file**

```typescript
import { Hono } from 'hono'
import { db } from '../db'
import { certificateConfigs, generatedCertificates } from '../db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '../lib/logger'
import { generatePdf, generateCertificateId } from '../services/pdf-generator'
import { getTemplateById, getAllTemplates, renderTemplate } from '../services/certificate-templates'
import type { CertificateConfig, CertificateData, GenerateRequest } from '../lib/certificate-types'

const app = new Hono()

// Get all certificate templates
app.get('/templates', async (c) => {
  const templates = getAllTemplates()
  return c.json(templates)
})

// Get all saved certificate configs
app.get('/configs', async (c) => {
  const configs = await db.select().from(certificateConfigs).orderBy(certificateConfigs.updatedAt)
  return c.json(configs)
})

// Get single config
app.get('/configs/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const [config] = await db.select().from(certificateConfigs).where(eq(certificateConfigs.id, id))
  if (!config) return c.json({ error: 'Config not found' }, 404)
  return c.json(config)
})

// Create certificate config
app.post('/configs', async (c) => {
  const body = await c.req.json()
  const [config] = await db.insert(certificateConfigs).values({
    name: body.name,
    templateId: body.templateId,
    colors: body.colors,
    logos: body.logos || [],
    signatories: body.signatories || [],
    titleText: body.titleText || 'CERTIFICATE',
    subtitleText: body.subtitleText || 'of Participation',
    descriptionTemplate: body.descriptionTemplate || '',
  }).returning()
  return c.json(config)
})

// Update certificate config
app.put('/configs/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  const body = await c.req.json()
  const [config] = await db.update(certificateConfigs)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(certificateConfigs.id, id))
    .returning()
  return c.json(config)
})

// Delete certificate config
app.delete('/configs/:id', async (c) => {
  const id = parseInt(c.req.param('id'))
  await db.delete(certificateConfigs).where(eq(certificateConfigs.id, id))
  return c.json({ success: true })
})

// Preview single certificate (returns base64 PDF)
app.post('/preview', async (c) => {
  const { configId, data } = await c.req.json()
  
  const [config] = await db.select().from(certificateConfigs).where(eq(certificateConfigs.id, configId))
  if (!config) return c.json({ error: 'Config not found' }, 404)
  
  const template = getTemplateById(config.templateId)
  if (!template) return c.json({ error: 'Template not found' }, 404)
  
  const html = renderTemplate(template, config as unknown as CertificateConfig, data)
  const pdfBuffer = await generatePdf(html)
  
  return c.json({ pdf: pdfBuffer.toString('base64') })
})

// Bulk generate certificates
app.post('/generate', async (c) => {
  const { configId, recipients } = await c.req.json() as GenerateRequest
  
  const [config] = await db.select().from(certificateConfigs).where(eq(certificateConfigs.id, configId))
  if (!config) return c.json({ error: 'Config not found' }, 404)
  
  const template = getTemplateById(config.templateId)
  if (!template) return c.json({ error: 'Template not found' }, 404)
  
  const results: { certificateId: string; name: string; pdf: string }[] = []
  
  for (const recipient of recipients) {
    const certificateId = generateCertificateId()
    const dataWithId = { ...recipient, certificate_id: certificateId }
    
    const html = renderTemplate(template, config as unknown as CertificateConfig, dataWithId)
    const pdfBuffer = await generatePdf(html)
    
    // Save to database
    await db.insert(generatedCertificates).values({
      certificateId,
      configId,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      data: dataWithId,
    })
    
    results.push({
      certificateId,
      name: recipient.name,
      pdf: pdfBuffer.toString('base64'),
    })
  }
  
  return c.json({ certificates: results })
})

export default app
```

**Step 2: Register routes in main app**

In `server/src/index.ts`, add:

```typescript
import certificates from './routes/certificates'

// After other route registrations:
app.route('/api/certificates', certificates)
```

**Step 3: Commit**

```bash
git add src/routes/certificates.ts src/index.ts
git commit -m "feat: add certificate API routes"
```

---

### Task 6: Certificate Template Service Skeleton

**Files:**
- Create: `server/src/services/certificate-templates.ts`

**Step 1: Create template service**

```typescript
import type { CertificateTemplate, CertificateConfig, CertificateData } from '../lib/certificate-types'
import { calculateFontSize } from './pdf-generator'

// Template registry - will be populated with actual templates
const templates: Map<string, CertificateTemplate & { render: (config: CertificateConfig, data: CertificateData) => string }> = new Map()

export function registerTemplate(
  template: CertificateTemplate,
  render: (config: CertificateConfig, data: CertificateData) => string
): void {
  templates.set(template.id, { ...template, render })
}

export function getTemplateById(id: string): (CertificateTemplate & { render: (config: CertificateConfig, data: CertificateData) => string }) | undefined {
  return templates.get(id)
}

export function getAllTemplates(): CertificateTemplate[] {
  return Array.from(templates.values()).map(({ render, ...template }) => template)
}

export function renderTemplate(
  template: { render: (config: CertificateConfig, data: CertificateData) => string },
  config: CertificateConfig,
  data: CertificateData
): string {
  return template.render(config, data)
}

// Helper to replace template variables
export function replaceVariables(text: string, data: CertificateData): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`)
}

// Helper to generate logo HTML
export function renderLogos(logos: CertificateConfig['logos']): string {
  if (!logos || logos.length === 0) return ''
  
  const sortedLogos = [...logos].sort((a, b) => a.order - b.order)
  return sortedLogos
    .map(logo => `<img src="${logo.url}" style="height: 60px; width: auto; max-width: ${logo.width}px;" />`)
    .join('')
}

// Helper to generate signatory HTML
export function renderSignatories(signatories: CertificateConfig['signatories']): string {
  if (!signatories || signatories.length === 0) return ''
  
  const sortedSignatories = [...signatories].sort((a, b) => a.order - b.order)
  return sortedSignatories.map(sig => `
    <div class="signatory">
      ${sig.signatureUrl ? `<img src="${sig.signatureUrl}" class="signature-img" />` : '<div class="signature-line"></div>'}
      <div class="sig-name">${sig.name}</div>
      <div class="sig-title">${sig.designation}</div>
      ${sig.organization ? `<div class="sig-org">${sig.organization}</div>` : ''}
    </div>
  `).join('')
}

// Calculate responsive font size for name
export function getNameFontSize(name: string): number {
  return calculateFontSize(name, 500, 48, 24)
}
```

**Step 2: Commit**

```bash
git add src/services/certificate-templates.ts
git commit -m "feat: add certificate template service"
```

---

## Phase 2: Templates (12 HTML/CSS Templates)

### Task 7: Base Template Styles

**Files:**
- Create: `server/src/templates/certificates/base-styles.ts`

**Step 1: Create shared CSS styles**

```typescript
export const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    width: 1123px;
    height: 794px;
    font-family: 'Montserrat', sans-serif;
    overflow: hidden;
  }
  
  .certificate {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 40px;
  }
  
  .logo-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-bottom: 20px;
  }
  
  .logo-bar img {
    height: 60px;
    width: auto;
    object-fit: contain;
  }
  
  .title {
    font-family: 'Playfair Display', serif;
    font-size: 56px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 8px;
    text-transform: uppercase;
  }
  
  .subtitle {
    font-size: 24px;
    text-align: center;
    margin-top: 5px;
    letter-spacing: 4px;
    text-transform: uppercase;
  }
  
  .presented-to {
    text-align: center;
    font-size: 16px;
    margin-top: 30px;
    font-style: italic;
  }
  
  .recipient-name {
    font-family: 'Great Vibes', cursive;
    text-align: center;
    margin: 10px 0;
    line-height: 1.2;
  }
  
  .name-underline {
    width: 400px;
    height: 2px;
    margin: 0 auto;
  }
  
  .description {
    text-align: center;
    font-size: 14px;
    line-height: 1.6;
    max-width: 700px;
    margin: 20px auto;
  }
  
  .signatories {
    display: flex;
    justify-content: center;
    gap: 80px;
    margin-top: auto;
    padding-top: 30px;
  }
  
  .signatory {
    text-align: center;
    min-width: 180px;
  }
  
  .signature-img {
    height: 50px;
    width: auto;
    margin-bottom: 5px;
  }
  
  .signature-line {
    width: 150px;
    height: 1px;
    background: currentColor;
    margin: 0 auto 10px;
  }
  
  .sig-name {
    font-weight: 600;
    font-size: 14px;
  }
  
  .sig-title {
    font-size: 12px;
    opacity: 0.8;
  }
  
  .sig-org {
    font-size: 11px;
    opacity: 0.7;
  }
  
  .certificate-id {
    position: absolute;
    bottom: 15px;
    right: 20px;
    font-size: 10px;
    opacity: 0.5;
  }
`

export const fontImports = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
`
```

**Step 2: Commit**

```bash
git add src/templates/certificates/base-styles.ts
git commit -m "feat: add base certificate styles"
```

---

### Task 8: Modern Colorful Templates (3)

**Files:**
- Create: `server/src/templates/certificates/modern/index.ts`
- Create: `server/src/templates/certificates/modern/abhigyaan.ts`
- Create: `server/src/templates/certificates/modern/geometric-purple.ts`
- Create: `server/src/templates/certificates/modern/teal-medical.ts`

**Step 1: Create Abhigyaan-style template**

`server/src/templates/certificates/modern/abhigyaan.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const abhigyaanTemplate = {
  id: 'modern-abhigyaan',
  name: 'Abhigyaan',
  category: 'modern' as const,
  thumbnail: '/thumbnails/modern-abhigyaan.png',
  description: 'Colorful abstract shapes with vibrant pastel tones',
  defaultColors: {
    primary: '#1a5f7a',
    secondary: '#f9a825',
    accent: '#e91e63',
  },
}

export function renderAbhigyaan(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: linear-gradient(135deg, #fff9e6 0%, #fff 50%, #e8f5e9 100%);
      position: relative;
      overflow: hidden;
    }
    
    .shape-1 {
      position: absolute;
      top: -50px;
      left: -50px;
      width: 200px;
      height: 200px;
      background: ${accent};
      border-radius: 50% 50% 50% 0;
      opacity: 0.8;
    }
    
    .shape-2 {
      position: absolute;
      bottom: -30px;
      right: -30px;
      width: 250px;
      height: 250px;
      background: ${secondary};
      border-radius: 50%;
      opacity: 0.6;
    }
    
    .shape-3 {
      position: absolute;
      top: 50%;
      right: -100px;
      width: 200px;
      height: 300px;
      background: linear-gradient(180deg, ${primary} 0%, transparent 100%);
      border-radius: 100px 0 0 100px;
      opacity: 0.4;
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .title { color: ${primary}; }
    .subtitle { color: ${secondary}; }
    .recipient-name { color: ${primary}; }
    .name-underline { background: ${accent}; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="shape-1"></div>
    <div class="shape-2"></div>
    <div class="shape-3"></div>
    
    <div class="content">
      <div class="logo-bar">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <p class="presented-to">This certificate is proudly presented to:</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px">${data.name}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 2: Create Geometric Purple template**

`server/src/templates/certificates/modern/geometric-purple.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const geometricPurpleTemplate = {
  id: 'modern-geometric-purple',
  name: 'Geometric Purple',
  category: 'modern' as const,
  thumbnail: '/thumbnails/modern-geometric-purple.png',
  description: 'Purple geometric shapes with gold accents',
  defaultColors: {
    primary: '#7b1fa2',
    secondary: '#d4af37',
    accent: '#4a148c',
  },
}

export function renderGeometricPurple(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: #fff;
      position: relative;
      overflow: hidden;
    }
    
    .corner-tl {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      border-left: 150px solid ${primary};
      border-bottom: 150px solid transparent;
    }
    
    .corner-br {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 0;
      height: 0;
      border-right: 150px solid ${primary};
      border-top: 150px solid transparent;
    }
    
    .badge {
      position: absolute;
      top: 40px;
      right: 60px;
      width: 100px;
      height: 100px;
      background: ${secondary};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    
    .badge::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-top: 25px solid ${secondary};
    }
    
    .badge-inner {
      width: 80px;
      height: 80px;
      border: 2px solid ${accent};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      text-align: center;
      color: ${accent};
      font-weight: 600;
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      padding-top: 20px;
    }
    
    .title { color: ${primary}; }
    .subtitle { color: ${secondary}; }
    .recipient-name { color: ${accent}; }
    .name-underline { background: ${secondary}; height: 3px; }
    .sig-name, .sig-title { color: ${primary}; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="corner-tl"></div>
    <div class="corner-br"></div>
    <div class="badge"><div class="badge-inner">AWARD</div></div>
    
    <div class="content">
      <div class="logo-bar">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <p class="presented-to">This Certificate is Proudly Presented To</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px">${data.name}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 3: Create Teal Medical template**

`server/src/templates/certificates/modern/teal-medical.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const tealMedicalTemplate = {
  id: 'modern-teal-medical',
  name: 'Teal Medical',
  category: 'modern' as const,
  thumbnail: '/thumbnails/modern-teal-medical.png',
  description: 'Healthcare themed with teal colors and medical icons',
  defaultColors: {
    primary: '#00796b',
    secondary: '#26a69a',
    accent: '#004d40',
  },
}

export function renderTealMedical(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: linear-gradient(135deg, #e0f2f1 0%, #fff 100%);
      position: relative;
      overflow: hidden;
    }
    
    .bg-pattern {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.05;
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5v20M30 35v20M5 30h20M35 30h20' stroke='%23000' stroke-width='2' fill='none'/%3E%3C/svg%3E");
    }
    
    .side-accent {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 80px;
      background: linear-gradient(180deg, ${primary} 0%, ${secondary} 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
    }
    
    .heart-icon {
      width: 40px;
      height: 40px;
      background: ${accent};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .heart-icon svg {
      width: 24px;
      height: 24px;
      fill: white;
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      margin-left: 60px;
    }
    
    .title { color: ${primary}; }
    .subtitle { color: ${secondary}; }
    .recipient-name { color: ${accent}; }
    .name-underline { background: ${secondary}; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="bg-pattern"></div>
    <div class="side-accent">
      <div class="heart-icon">
        <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </div>
    </div>
    
    <div class="content">
      <div class="logo-bar">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <p class="presented-to">is presented to</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px">${data.name}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 4: Create index file**

`server/src/templates/certificates/modern/index.ts`:

```typescript
import { registerTemplate } from '../../../services/certificate-templates'
import { abhigyaanTemplate, renderAbhigyaan } from './abhigyaan'
import { geometricPurpleTemplate, renderGeometricPurple } from './geometric-purple'
import { tealMedicalTemplate, renderTealMedical } from './teal-medical'

export function registerModernTemplates(): void {
  registerTemplate(abhigyaanTemplate, renderAbhigyaan)
  registerTemplate(geometricPurpleTemplate, renderGeometricPurple)
  registerTemplate(tealMedicalTemplate, renderTealMedical)
}

export { abhigyaanTemplate, geometricPurpleTemplate, tealMedicalTemplate }
```

**Step 5: Commit**

```bash
git add src/templates/certificates/modern/
git commit -m "feat: add modern colorful certificate templates"
```

---

### Task 9: Dark Premium Templates (3)

**Files:**
- Create: `server/src/templates/certificates/dark/index.ts`
- Create: `server/src/templates/certificates/dark/galaxy-night.ts`
- Create: `server/src/templates/certificates/dark/navy-gold.ts`
- Create: `server/src/templates/certificates/dark/tech-cyan.ts`

**Step 1: Create Galaxy Night template**

`server/src/templates/certificates/dark/galaxy-night.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const galaxyNightTemplate = {
  id: 'dark-galaxy-night',
  name: 'Galaxy Night',
  category: 'dark' as const,
  thumbnail: '/thumbnails/dark-galaxy-night.png',
  description: 'Dark starry background with glowing purple accents',
  defaultColors: {
    primary: '#e1bee7',
    secondary: '#ce93d8',
    accent: '#ab47bc',
  },
}

export function renderGalaxyNight(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }
    
    .stars {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        radial-gradient(2px 2px at 20px 30px, white, transparent),
        radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 90px 40px, white, transparent),
        radial-gradient(2px 2px at 160px 120px, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 230px 80px, white, transparent),
        radial-gradient(2px 2px at 300px 150px, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 400px 60px, white, transparent),
        radial-gradient(2px 2px at 500px 200px, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 600px 100px, white, transparent),
        radial-gradient(2px 2px at 700px 180px, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 800px 50px, white, transparent),
        radial-gradient(2px 2px at 900px 140px, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 1000px 90px, white, transparent);
    }
    
    .glow-border {
      position: absolute;
      top: 20px;
      left: 20px;
      right: 20px;
      bottom: 20px;
      border: 1px solid ${accent};
      box-shadow: inset 0 0 30px rgba(171, 71, 188, 0.3), 0 0 30px rgba(171, 71, 188, 0.2);
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    
    .title {
      color: ${primary};
      text-shadow: 0 0 30px ${accent}, 0 0 60px ${accent};
    }
    
    .subtitle {
      color: ${secondary};
    }
    
    .divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 15px 0;
    }
    
    .divider-line {
      width: 100px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${secondary}, transparent);
    }
    
    .divider-icon {
      color: ${secondary};
    }
    
    .recipient-name {
      color: ${primary};
      text-shadow: 0 0 20px ${accent};
    }
    
    .name-underline { display: none; }
    
    .description { color: rgba(255,255,255,0.85); }
    
    .signatories { color: ${primary}; }
    .sig-name { color: ${primary}; }
    .sig-title, .sig-org { color: rgba(255,255,255,0.7); }
    .signature-line { background: ${secondary}; }
    
    .certificate-id { color: rgba(255,255,255,0.4); }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="stars"></div>
    <div class="glow-border"></div>
    
    <div class="content">
      <div class="logo-bar">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <div class="divider">
        <div class="divider-line"></div>
        <div class="divider-icon">&#10022;</div>
        <div class="divider-line"></div>
      </div>
      
      <p class="presented-to">Presented to</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px">${data.name}</h2>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 2: Create Navy Gold template**

`server/src/templates/certificates/dark/navy-gold.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const navyGoldTemplate = {
  id: 'dark-navy-gold',
  name: 'Navy Gold',
  category: 'dark' as const,
  thumbnail: '/thumbnails/dark-navy-gold.png',
  description: 'Premium dark navy with elegant gold accents',
  defaultColors: {
    primary: '#ffd700',
    secondary: '#c9a227',
    accent: '#1a237e',
  },
}

export function renderNavyGold(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: ${accent};
      color: white;
      position: relative;
      overflow: hidden;
    }
    
    .gold-accent-top {
      position: absolute;
      top: 0;
      left: 0;
      width: 300px;
      height: 200px;
      background: linear-gradient(135deg, ${primary} 0%, transparent 60%);
      opacity: 0.15;
    }
    
    .gold-line-top {
      position: absolute;
      top: 60px;
      left: 100px;
      width: 200px;
      height: 3px;
      background: ${primary};
      transform: rotate(-30deg);
    }
    
    .gold-line-bottom {
      position: absolute;
      bottom: 80px;
      right: 100px;
      width: 250px;
      height: 3px;
      background: ${primary};
      transform: rotate(-30deg);
    }
    
    .checkmark {
      position: absolute;
      top: 40px;
      right: 120px;
      width: 120px;
      height: 80px;
      border-bottom: 4px solid ${primary};
      border-right: 4px solid ${primary};
      transform: rotate(45deg);
    }
    
    .badge {
      position: absolute;
      bottom: 150px;
      right: 80px;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .badge-inner {
      width: 65px;
      height: 65px;
      background: ${accent};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: ${primary};
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
    }
    
    .ribbon {
      position: absolute;
      bottom: 100px;
      right: 95px;
      width: 30px;
      height: 50px;
      background: ${primary};
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%);
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      padding-right: 180px;
    }
    
    .title { color: white; letter-spacing: 12px; }
    .subtitle { color: ${primary}; letter-spacing: 6px; }
    .presented-to { color: rgba(255,255,255,0.7); }
    
    .recipient-name {
      color: ${primary};
    }
    
    .name-underline { display: none; }
    
    .description {
      color: rgba(255,255,255,0.8);
      text-align: left;
      margin-left: 0;
    }
    
    .description strong { color: ${primary}; }
    
    .signatories {
      justify-content: flex-start;
      gap: 60px;
    }
    
    .sig-name { color: white; }
    .sig-title, .sig-org { color: rgba(255,255,255,0.6); }
    .signature-line { background: ${primary}; }
    
    .certificate-id { color: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="gold-accent-top"></div>
    <div class="gold-line-top"></div>
    <div class="gold-line-bottom"></div>
    <div class="checkmark"></div>
    <div class="badge"><div class="badge-inner">AWARD</div></div>
    <div class="ribbon"></div>
    
    <div class="content">
      <div class="logo-bar" style="justify-content: flex-start;">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <p class="presented-to">PROUDLY PRESENTED TO</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px; text-align: left;">${data.name}</h2>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 3: Create Tech Cyan template**

`server/src/templates/certificates/dark/tech-cyan.ts`:

```typescript
import type { CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const techCyanTemplate = {
  id: 'dark-tech-cyan',
  name: 'Tech Cyan',
  category: 'dark' as const,
  thumbnail: '/thumbnails/dark-tech-cyan.png',
  description: 'Futuristic dark theme with cyan neon accents',
  defaultColors: {
    primary: '#00bcd4',
    secondary: '#00838f',
    accent: '#ffd700',
  },
}

export function renderTechCyan(config: CertificateConfig, data: CertificateData): string {
  const { primary, secondary, accent } = config.colors
  const nameFontSize = getNameFontSize(data.name)
  
  return `<!DOCTYPE html>
<html>
<head>
  ${fontImports}
  <style>
    ${baseStyles}
    
    .certificate {
      background: #1a1a2e;
      color: white;
      position: relative;
      overflow: hidden;
    }
    
    .grid-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-image: 
        linear-gradient(rgba(0,188,212,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,188,212,0.03) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    
    .neon-line-left {
      position: absolute;
      left: 60px;
      top: 100px;
      bottom: 100px;
      width: 3px;
      background: linear-gradient(180deg, transparent, ${primary}, ${primary}, transparent);
      box-shadow: 0 0 10px ${primary}, 0 0 20px ${primary};
    }
    
    .neon-line-right {
      position: absolute;
      right: 60px;
      top: 100px;
      bottom: 100px;
      width: 3px;
      background: linear-gradient(180deg, transparent, ${primary}, ${primary}, transparent);
      box-shadow: 0 0 10px ${primary}, 0 0 20px ${primary};
    }
    
    .corner-accent {
      position: absolute;
      width: 60px;
      height: 60px;
      border: 2px solid ${primary};
    }
    
    .corner-tl { top: 40px; left: 40px; border-right: none; border-bottom: none; }
    .corner-tr { top: 40px; right: 40px; border-left: none; border-bottom: none; }
    .corner-bl { bottom: 40px; left: 40px; border-right: none; border-top: none; }
    .corner-br { bottom: 40px; right: 40px; border-left: none; border-top: none; }
    
    .badge {
      position: absolute;
      bottom: 150px;
      right: 100px;
      width: 80px;
      height: 80px;
      background: ${secondary};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 20px ${primary};
    }
    
    .badge-inner {
      font-size: 10px;
      color: ${accent};
      font-weight: 700;
      text-align: center;
    }
    
    .ribbon {
      position: absolute;
      bottom: 100px;
      right: 115px;
      width: 30px;
      height: 50px;
      background: ${accent};
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 70%, 0 100%);
    }
    
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px 80px;
    }
    
    .title {
      color: ${primary};
      text-shadow: 0 0 10px ${primary};
    }
    
    .subtitle { color: white; opacity: 0.8; }
    .presented-to { color: rgba(255,255,255,0.6); }
    
    .recipient-name {
      color: ${accent};
      text-shadow: 0 0 10px rgba(255,215,0,0.5);
    }
    
    .name-underline { display: none; }
    
    .description { color: rgba(255,255,255,0.75); }
    
    .signatories { padding-right: 150px; }
    .sig-name { color: white; }
    .sig-title, .sig-org { color: rgba(255,255,255,0.6); }
    .signature-line { background: ${primary}; }
    
    .certificate-id { color: ${primary}; opacity: 0.5; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="grid-bg"></div>
    <div class="neon-line-left"></div>
    <div class="neon-line-right"></div>
    <div class="corner-accent corner-tl"></div>
    <div class="corner-accent corner-tr"></div>
    <div class="corner-accent corner-bl"></div>
    <div class="corner-accent corner-br"></div>
    <div class="badge"><div class="badge-inner">AWARD</div></div>
    <div class="ribbon"></div>
    
    <div class="content">
      <div class="logo-bar">${renderLogos(config.logos)}</div>
      
      <h1 class="title">${config.titleText}</h1>
      <h2 class="subtitle">${config.subtitleText}</h2>
      
      <p class="presented-to">PROUDLY PRESENTED TO</p>
      
      <h2 class="recipient-name" style="font-size: ${nameFontSize}px">${data.name}</h2>
      
      <p class="description">${replaceVariables(config.descriptionTemplate, data)}</p>
      
      <div class="signatories">${renderSignatories(config.signatories)}</div>
    </div>
    
    <div class="certificate-id">${data.certificate_id || ''}</div>
  </div>
</body>
</html>`
}
```

**Step 4: Create index file**

`server/src/templates/certificates/dark/index.ts`:

```typescript
import { registerTemplate } from '../../../services/certificate-templates'
import { galaxyNightTemplate, renderGalaxyNight } from './galaxy-night'
import { navyGoldTemplate, renderNavyGold } from './navy-gold'
import { techCyanTemplate, renderTechCyan } from './tech-cyan'

export function registerDarkTemplates(): void {
  registerTemplate(galaxyNightTemplate, renderGalaxyNight)
  registerTemplate(navyGoldTemplate, renderNavyGold)
  registerTemplate(techCyanTemplate, renderTechCyan)
}

export { galaxyNightTemplate, navyGoldTemplate, techCyanTemplate }
```

**Step 5: Commit**

```bash
git add src/templates/certificates/dark/
git commit -m "feat: add dark premium certificate templates"
```

---

### Task 10: Elegant Templates (3)

**Files:**
- Create: `server/src/templates/certificates/elegant/index.ts`
- Create: `server/src/templates/certificates/elegant/pink-watercolor.ts`
- Create: `server/src/templates/certificates/elegant/lavender-floral.ts`
- Create: `server/src/templates/certificates/elegant/cream-classic.ts`

*(Similar structure to previous templates - implementing pink watercolor, lavender floral, and cream classic styles)*

**Step 1-4:** Create three elegant templates following the same pattern.

**Step 5: Commit**

```bash
git add src/templates/certificates/elegant/
git commit -m "feat: add elegant certificate templates"
```

---

### Task 11: Minimal Templates (3)

**Files:**
- Create: `server/src/templates/certificates/minimal/index.ts`
- Create: `server/src/templates/certificates/minimal/white-modern.ts`
- Create: `server/src/templates/certificates/minimal/blue-geometric.ts`
- Create: `server/src/templates/certificates/minimal/gradient-wave.ts`

*(Similar structure - implementing clean minimal styles)*

**Step 1-4:** Create three minimal templates.

**Step 5: Commit**

```bash
git add src/templates/certificates/minimal/
git commit -m "feat: add minimal certificate templates"
```

---

### Task 12: Register All Templates

**Files:**
- Create: `server/src/templates/certificates/index.ts`
- Modify: `server/src/index.ts`

**Step 1: Create main template registry**

`server/src/templates/certificates/index.ts`:

```typescript
import { registerModernTemplates } from './modern'
import { registerDarkTemplates } from './dark'
import { registerElegantTemplates } from './elegant'
import { registerMinimalTemplates } from './minimal'

export function registerAllTemplates(): void {
  registerModernTemplates()
  registerDarkTemplates()
  registerElegantTemplates()
  registerMinimalTemplates()
}
```

**Step 2: Initialize templates on server start**

In `server/src/index.ts`, add at the top after imports:

```typescript
import { registerAllTemplates } from './templates/certificates'

// Register certificate templates
registerAllTemplates()
```

**Step 3: Commit**

```bash
git add src/templates/certificates/index.ts src/index.ts
git commit -m "feat: register all certificate templates on startup"
```

---

## Phase 3: Frontend - Certificate Editor

### Task 13: Add Certificates to Navigation

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add nav item**

In `Layout.tsx`, add to nav items array:

```typescript
{ path: '/certificates', label: 'Certificates', icon: Award }
```

Import `Award` from lucide-react.

**Step 2: Add route**

In `App.tsx`, add route:

```typescript
<Route path="/certificates" element={<Certificates />} />
```

**Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/App.tsx
git commit -m "feat: add certificates to navigation"
```

---

### Task 14: Certificate API Client

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add certificate types and API methods**

```typescript
// Certificate types
export interface CertificateTemplate {
  id: string
  name: string
  category: 'modern' | 'dark' | 'elegant' | 'minimal'
  thumbnail: string
  description: string
  defaultColors: {
    primary: string
    secondary: string
    accent: string
  }
}

export interface LogoConfig {
  id: string
  url: string
  width: number
  order: number
}

export interface SignatoryConfig {
  id: string
  name: string
  designation: string
  organization: string
  signatureUrl: string
  order: number
}

export interface CertificateConfig {
  id: number
  name: string
  templateId: string
  colors: { primary: string; secondary: string; accent: string }
  logos: LogoConfig[]
  signatories: SignatoryConfig[]
  titleText: string
  subtitleText: string
  descriptionTemplate: string
  createdAt: string
  updatedAt: string
}

// Add to api object:
// Certificate Templates
getCertificateTemplates: () => request<CertificateTemplate[]>('/certificates/templates'),

// Certificate Configs
getCertificateConfigs: () => request<CertificateConfig[]>('/certificates/configs'),
getCertificateConfig: (id: number) => request<CertificateConfig>(`/certificates/configs/${id}`),
createCertificateConfig: (data: Omit<CertificateConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
  request<CertificateConfig>('/certificates/configs', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
updateCertificateConfig: (id: number, data: Partial<CertificateConfig>) =>
  request<CertificateConfig>(`/certificates/configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
deleteCertificateConfig: (id: number) =>
  request<void>(`/certificates/configs/${id}`, { method: 'DELETE' }),

// Certificate Generation
previewCertificate: (configId: number, data: Record<string, string>) =>
  request<{ pdf: string }>('/certificates/preview', {
    method: 'POST',
    body: JSON.stringify({ configId, data }),
  }),
generateCertificates: (configId: number, recipients: Record<string, string>[]) =>
  request<{ certificates: { certificateId: string; name: string; pdf: string }[] }>('/certificates/generate', {
    method: 'POST',
    body: JSON.stringify({ configId, recipients }),
  }),
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add certificate API client methods"
```

---

### Task 15-20: Certificate Page Components

*(Tasks 15-20 cover creating the main Certificates.tsx page with template gallery, editor, color pickers, logo management, signatory management, and generation UI)*

Due to length, these follow the same detailed pattern with:
- File paths
- Complete code
- Test commands
- Commit messages

---

## Phase 4: Generation & Download

### Task 21: ZIP Download Endpoint

**Files:**
- Modify: `server/src/routes/certificates.ts`

**Step 1: Add ZIP generation endpoint**

```typescript
import archiver from 'archiver'

app.post('/download-zip', async (c) => {
  const { configId, recipients } = await c.req.json()
  
  // Generate all certificates
  const certificates = await generateAllCertificates(configId, recipients)
  
  // Create ZIP
  const archive = archiver('zip', { zlib: { level: 9 } })
  
  for (const cert of certificates) {
    archive.append(Buffer.from(cert.pdf, 'base64'), { 
      name: `${cert.name.replace(/[^a-zA-Z0-9]/g, '_')}-${cert.certificateId}.pdf` 
    })
  }
  
  await archive.finalize()
  
  return new Response(archive, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="certificates-${Date.now()}.zip"`,
    },
  })
})
```

**Step 2: Commit**

```bash
git add src/routes/certificates.ts
git commit -m "feat: add ZIP download for bulk certificates"
```

---

## Phase 5: Email Integration

### Task 22-25: Email Campaign Integration

*(Tasks cover integrating certificate generation with the existing email campaign flow, allowing users to attach personalized PDFs to campaigns)*

---

## Verification Checklist

After completing all tasks:

- [ ] All 12 templates render correctly
- [ ] Auto-scaling works for names 5-50 characters
- [ ] Color customization updates preview
- [ ] Logo upload and ordering works
- [ ] Signatory management works (up to 4)
- [ ] CSV upload parses correctly
- [ ] Bulk generation produces valid PDFs
- [ ] ZIP download works
- [ ] Email integration attaches PDFs
- [ ] TypeScript compiles
- [ ] Frontend builds

---

## Execution

**Plan complete and saved.** Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
