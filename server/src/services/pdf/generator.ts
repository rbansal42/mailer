import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { randomBytes } from 'crypto'
import { ModernClean, DarkElegant, CleanMinimal, WaveAccent } from './templates'
import type { TemplateId } from './templates'

// Import fonts to ensure they're registered
import './fonts'

// Props that all templates accept
export interface CertificateProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; width?: number }>
  signatories?: Array<{
    name: string
    designation: string
    organization?: string
    signatureUrl?: string
  }>
  certificateId?: string
}

// Template component registry
const templateComponents: Record<TemplateId, React.FC<CertificateProps>> = {
  'modern-clean': ModernClean,
  'dark-elegant': DarkElegant,
  'clean-minimal': CleanMinimal,
  'wave-accent': WaveAccent,
}

/**
 * Generate a PDF buffer from a React PDF template
 */
export async function generateReactPdf(
  templateId: TemplateId,
  props: CertificateProps
): Promise<Buffer> {
  const TemplateComponent = templateComponents[templateId]
  
  if (!TemplateComponent) {
    throw new Error(`Unknown template: ${templateId}`)
  }
  
  const element = React.createElement(TemplateComponent, props)
  const buffer = await renderToBuffer(element)
  
  return Buffer.from(buffer)
}

/**
 * Generate unique certificate ID using cryptographically secure random bytes
 */
export function generateCertificateId(): string {
  const year = new Date().getFullYear()
  const random = randomBytes(6).toString('hex').toUpperCase()
  return `CERT-${year}-${random}`
}

/**
 * Check if a template ID is a valid React PDF template
 */
export function isReactPdfTemplate(templateId: string): templateId is TemplateId {
  return templateId in templateComponents
}

/**
 * Get list of available React PDF template IDs
 */
export function getReactPdfTemplateIds(): TemplateId[] {
  return Object.keys(templateComponents) as TemplateId[]
}
