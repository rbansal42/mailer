import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { randomBytes } from 'crypto'
import { ModernClean, DarkElegant, CleanMinimal, WaveAccent } from './templates'
import type { TemplateId } from './templates'
import { logger } from '../../lib/logger'

// Import fonts to ensure they're registered
import './fonts'

const SERVICE = 'pdf-generator'

// Props that all templates accept
export interface CertificateProps {
  title: string
  subtitle?: string
  recipientName: string
  description: string
  logos?: Array<{ url: string; height?: number }>
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
  const startTime = Date.now()

  logger.info('Generating PDF certificate', {
    service: SERVICE,
    templateId,
    recipientName: props.recipientName,
    hasLogos: !!props.logos?.length,
    hasSignatories: !!props.signatories?.length
  })

  try {
    const TemplateComponent = templateComponents[templateId]

    if (!TemplateComponent) {
      logger.error('Unknown PDF template', { service: SERVICE, templateId })
      throw new Error(`Unknown template: ${templateId}`)
    }

    const element = React.createElement(TemplateComponent, props)
    const buffer = await renderToBuffer(element)

    const durationMs = Date.now() - startTime
    logger.info('PDF certificate generated successfully', {
      service: SERVICE,
      templateId,
      recipientName: props.recipientName,
      bufferSize: buffer.length,
      durationMs
    })

    return Buffer.from(buffer)
  } catch (error) {
    const durationMs = Date.now() - startTime
    logger.error('PDF generation failed', {
      service: SERVICE,
      templateId,
      recipientName: props.recipientName,
      durationMs
    }, error as Error)
    throw error
  }
}

/**
 * Generate unique certificate ID using cryptographically secure random bytes
 */
export function generateCertificateId(): string {
  const year = new Date().getFullYear()
  const random = randomBytes(6).toString('hex').toUpperCase()
  const certificateId = `CERT-${year}-${random}`

  logger.debug('Generated certificate ID', { service: SERVICE, certificateId })
  return certificateId
}

/**
 * Check if a template ID is a valid React PDF template
 */
export function isReactPdfTemplate(templateId: string): templateId is TemplateId {
  const isValid = templateId in templateComponents
  logger.debug('Checking if template is valid React PDF template', {
    service: SERVICE,
    templateId,
    isValid
  })
  return isValid
}

/**
 * Get list of available React PDF template IDs
 */
export function getReactPdfTemplateIds(): TemplateId[] {
  const templateIds = Object.keys(templateComponents) as TemplateId[]
  logger.debug('Getting available PDF template IDs', {
    service: SERVICE,
    count: templateIds.length
  })
  return templateIds
}
