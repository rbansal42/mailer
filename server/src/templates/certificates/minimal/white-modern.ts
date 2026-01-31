import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const whiteModernTemplate: CertificateTemplate = {
  id: 'white-modern',
  name: 'White Modern',
  category: 'minimal',
  thumbnail: '/templates/white-modern.png',
  description: 'Clean white design with single accent color and generous whitespace',
  defaultColors: {
    primary: '#1a1a1a',
    secondary: '#666666',
    accent: '#2563eb'
  }
}

export function renderWhiteModern(config: CertificateConfig, data: CertificateData): string {
  const { colors, titleText, subtitleText, descriptionTemplate, logos, signatories } = config
  const description = replaceVariables(descriptionTemplate, data)
  const nameFontSize = getNameFontSize(data.name)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${fontImports}
  <style>
    ${baseStyles}
    
    body {
      background: #ffffff;
    }
    
    .certificate {
      background: #ffffff;
      color: ${colors.primary};
      padding: 20mm 25mm;
    }
    
    /* Accent line at top */
    .accent-bar {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 100px;
      height: 4px;
      background: ${colors.accent};
    }
    
    .title {
      color: ${colors.primary};
      font-size: 42px;
      font-weight: 700;
      letter-spacing: 8px;
      margin-top: 15mm;
    }
    
    .subtitle {
      color: ${colors.secondary};
      font-size: 14px;
      letter-spacing: 4px;
      margin-top: 8px;
      font-weight: 400;
    }
    
    .presented-to {
      color: ${colors.secondary};
      font-size: 12px;
      margin-top: 20mm;
      font-style: normal;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .recipient-name {
      color: ${colors.primary};
      font-size: ${nameFontSize}px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      margin: 8mm 0;
    }
    
    .name-underline {
      width: 200px;
      height: 3px;
      background: ${colors.accent};
      margin: 0 auto;
    }
    
    .description {
      color: ${colors.secondary};
      font-size: 13px;
      line-height: 1.8;
      max-width: 70%;
      margin: 15mm auto;
    }
    
    .signatories {
      margin-top: auto;
      gap: 80px;
    }
    
    .signatory {
      color: ${colors.primary};
    }
    
    .signature-line {
      background: ${colors.secondary};
      opacity: 0.3;
      width: 100px;
    }
    
    .sig-name {
      font-size: 13px;
      font-weight: 600;
    }
    
    .sig-title {
      color: ${colors.secondary};
      font-size: 11px;
    }
    
    .sig-org {
      color: ${colors.secondary};
    }
    
    .certificate-id {
      color: ${colors.secondary};
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="accent-bar"></div>
    
    <div class="logo-bar">
      ${renderLogos(logos)}
    </div>
    
    <div class="title">${titleText}</div>
    <div class="subtitle">${subtitleText}</div>
    
    <div class="presented-to">Presented to</div>
    <div class="recipient-name">${data.name}</div>
    <div class="name-underline"></div>
    
    <div class="description">${description}</div>
    
    <div class="signatories">
      ${renderSignatories(signatories)}
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">ID: ${data.certificate_id}</div>` : ''}
  </div>
</body>
</html>
`
}
