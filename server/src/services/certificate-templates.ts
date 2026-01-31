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
