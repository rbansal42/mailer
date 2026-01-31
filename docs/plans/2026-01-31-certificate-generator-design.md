# Certificate Generator - Design Document

**Date**: 2026-01-31
**Status**: Approved

## Overview

Add certificate generation capabilities to the Mailer application, enabling bulk creation of PDF certificates with customizable templates, dynamic fields, and email integration.

## Requirements

### Functional
- 12 pre-built certificate templates across 4 style categories
- Dynamic text fields with auto-scaling for variable-length names
- Support for up to 6 logos per certificate
- Support for up to 4 signatories with signature images
- Color customization (primary, secondary, accent)
- Bulk generation via CSV upload
- Download as ZIP of PDFs
- Integration with email campaigns (attach PDFs)
- Unique certificate ID for each generated certificate

### Non-Functional
- PDF output at 300 DPI, A4 landscape (1123x794 px at 96 DPI)
- Generation speed: ~1 second per certificate
- PDF file size: ~200KB average

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                       │
├─────────────────────────────────────────────────────────┤
│  Certificates Page                                      │
│  ├── CertificateGallery (template selection)           │
│  ├── CertificateEditor (customization)                 │
│  └── CertificateGenerator (CSV upload, bulk gen)       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (Hono)                                         │
├─────────────────────────────────────────────────────────┤
│  /api/certificate-templates     GET list templates      │
│  /api/certificates              POST create certificate │
│  /api/certificates/generate     POST bulk generate      │
│  /api/certificates/preview      POST preview single     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PDF Generation (Puppeteer)                             │
├─────────────────────────────────────────────────────────┤
│  1. Render HTML template with data                      │
│  2. Apply auto-scaling to name field                    │
│  3. Generate PDF via headless Chrome                    │
│  4. Return PDF buffer or save to disk                   │
└─────────────────────────────────────────────────────────┘
```

## Template Categories

### Category 1: Modern Colorful (3 templates)
1. **Abhigyaan Style** - Abstract organic shapes, pastel/vibrant colors
2. **Geometric Purple** - Purple triangles with gold badge
3. **Teal Medical** - Healthcare-themed with illustrations

### Category 2: Dark Premium (3 templates)
4. **Galaxy Night** - Dark starry background, glowing purple text
5. **Navy Gold** - Dark navy with gold geometric accents
6. **Tech Cyan** - Dark with cyan neon lines, futuristic

### Category 3: Soft & Elegant (3 templates)
7. **Pink Watercolor** - Soft pink gradient with subtle frame
8. **Lavender Floral** - Textured background with decorative corners
9. **Cream Classic** - Traditional cream with ornate border

### Category 4: Clean Minimal (3 templates)
10. **White Modern** - Clean white with single accent color
11. **Blue Geometric** - Teal/blue geometric patterns
12. **Gradient Wave** - Abstract flowing lines, monochromatic

## Data Model

### CertificateTemplate (stored as TypeScript/JSON)
```typescript
interface CertificateTemplate {
  id: string
  name: string
  category: 'modern' | 'dark' | 'elegant' | 'minimal'
  thumbnail: string
  html: string
  defaultColors: {
    primary: string
    secondary: string
    accent: string
  }
}
```

### CertificateConfig (user customization)
```typescript
interface CertificateConfig {
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

interface LogoConfig {
  id: string
  url: string
  width: number
  order: number
}

interface SignatoryConfig {
  id: string
  name: string
  designation: string
  organization: string
  signatureUrl: string
  order: number
}
```

### GeneratedCertificate (database record)
```typescript
interface GeneratedCertificate {
  id: number
  certificateId: string  // e.g., "CERT-2026-00142"
  configId: number
  recipientName: string
  recipientEmail?: string
  data: Record<string, string>  // all dynamic fields
  pdfPath?: string
  campaignId?: number
  generatedAt: string
}
```

## Dynamic Fields

| Field | Description | Auto-Scale |
|-------|-------------|------------|
| `{{name}}` | Recipient name | Yes |
| `{{date}}` | Certificate date | No |
| `{{title}}` | Event/course title | No |
| `{{certificate_id}}` | Unique ID | No |
| `{{custom1}}` | User-defined | No |
| `{{custom2}}` | User-defined | No |
| `{{custom3}}` | User-defined | No |

### Auto-Scaling Algorithm
```javascript
function calculateFontSize(text, maxWidth, baseFontSize, minFontSize) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${baseFontSize}px "Great Vibes", cursive`
  const measuredWidth = ctx.measureText(text).width
  
  if (measuredWidth <= maxWidth) return baseFontSize
  
  const scaleFactor = maxWidth / measuredWidth
  return Math.max(baseFontSize * scaleFactor, minFontSize)
}
```

## UI Components

### Certificate Gallery
- Grid of template thumbnails (3 columns)
- Category filter tabs
- "Use Template" button on hover
- Preview modal on click

### Certificate Editor
- 3-column layout: templates | canvas | customization
- Live preview with sample data
- Color pickers for primary/secondary/accent
- Logo upload with drag-to-reorder
- Signatory cards (add/remove/edit)

### Certificate Generator
- CSV drag-and-drop upload
- Column mapping interface
- Preview first 3 certificates
- Progress bar during generation
- Download ZIP / Send via Email options

## API Endpoints

### GET /api/certificate-templates
Returns list of available templates with thumbnails.

### POST /api/certificate-configs
Create a new certificate configuration.

### PUT /api/certificate-configs/:id
Update certificate configuration.

### POST /api/certificates/preview
Generate a single preview PDF (returns base64).

### POST /api/certificates/generate
Bulk generate certificates from CSV data.
Returns ZIP file or job ID for async generation.

### POST /api/certificates/send
Generate certificates and create email campaign with attachments.

## File Storage

```
data/
├── certificates/
│   ├── logos/           # Uploaded logo images
│   ├── signatures/      # Uploaded signature images
│   └── generated/       # Generated PDF files
│       └── {configId}/
│           └── {certificateId}.pdf
```

## Email Integration

When sending certificates via email:
1. User configures certificate and uploads CSV
2. User clicks "Send via Email Campaign"
3. System creates draft campaign with:
   - Recipients from CSV
   - Certificate PDFs as attachments (generated on-demand)
   - Default email body with certificate mention
4. User can customize email before sending
5. Campaign uses existing rate limiting and sender rotation

## Dependencies

### New Dependencies
- `puppeteer` - Headless Chrome for PDF generation
- `archiver` - ZIP file creation for bulk download

### Existing Dependencies (reused)
- `zustand` - State management
- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons

## Implementation Phases

### Phase 1: Foundation
- Database schema for certificate configs
- API endpoints skeleton
- Puppeteer PDF generation service

### Phase 2: Templates
- Create 12 HTML/CSS templates
- Template thumbnail generation
- Template gallery UI

### Phase 3: Editor
- Certificate editor page
- Color customization
- Logo upload and management
- Signatory management

### Phase 4: Generation
- CSV upload and parsing
- Column mapping UI
- Bulk PDF generation
- ZIP download

### Phase 5: Integration
- Email campaign integration
- Certificate attachment flow
- Campaign creation from certificates

## Success Criteria

- [ ] All 12 templates render correctly as PDFs
- [ ] Names auto-scale properly (tested with 5-50 character names)
- [ ] Bulk generation handles 500+ certificates
- [ ] PDFs are print-quality (300 DPI)
- [ ] Email integration sends certificates as attachments
- [ ] TypeScript compiles without errors
- [ ] Frontend build succeeds
