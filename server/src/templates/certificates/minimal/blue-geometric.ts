import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const blueGeometricTemplate: CertificateTemplate = {
  id: 'blue-geometric',
  name: 'Blue Geometric',
  category: 'minimal',
  thumbnail: '/templates/blue-geometric.png',
  description: 'Modern corporate design with teal/blue geometric patterns',
  defaultColors: {
    primary: '#0d47a1',
    secondary: '#455a64',
    accent: '#0288d1'
  }
}

export function renderBlueGeometric(config: CertificateConfig, data: CertificateData): string {
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
      position: relative;
      overflow: hidden;
    }
    
    /* Geometric shapes */
    .geo-circle-1 {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 180px;
      height: 180px;
      border: 3px solid ${colors.accent};
      border-radius: 50%;
      opacity: 0.3;
    }
    
    .geo-circle-2 {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 100px;
      height: 100px;
      border: 2px solid ${colors.accent};
      border-radius: 50%;
      opacity: 0.2;
    }
    
    .geo-triangle {
      position: absolute;
      bottom: 30px;
      left: -20px;
      width: 0;
      height: 0;
      border-left: 60px solid transparent;
      border-right: 60px solid transparent;
      border-bottom: 100px solid ${colors.accent};
      opacity: 0.08;
      transform: rotate(-15deg);
    }
    
    .geo-rect {
      position: absolute;
      bottom: 80px;
      left: 40px;
      width: 80px;
      height: 80px;
      border: 2px solid ${colors.accent};
      opacity: 0.15;
      transform: rotate(45deg);
    }
    
    .geo-dots {
      position: absolute;
      top: 50%;
      left: 20px;
      display: grid;
      grid-template-columns: repeat(3, 8px);
      gap: 8px;
    }
    
    .geo-dot {
      width: 8px;
      height: 8px;
      background: ${colors.accent};
      border-radius: 50%;
      opacity: 0.2;
    }
    
    .geo-line {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 5px;
      background: linear-gradient(90deg, ${colors.accent}, ${colors.primary});
    }
    
    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .title {
      color: ${colors.primary};
      font-size: 44px;
      margin-top: 10mm;
    }
    
    .subtitle {
      color: ${colors.accent};
      font-size: 16px;
      letter-spacing: 4px;
      font-weight: 600;
    }
    
    .presented-to {
      color: ${colors.secondary};
      font-size: 13px;
      margin-top: 18mm;
      letter-spacing: 3px;
      text-transform: uppercase;
      font-style: normal;
    }
    
    .recipient-name {
      color: ${colors.primary};
      font-size: ${nameFontSize}px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      margin: 6mm 0;
    }
    
    .name-underline {
      width: 250px;
      height: 3px;
      background: linear-gradient(90deg, transparent, ${colors.accent}, transparent);
      margin: 0 auto;
    }
    
    .description {
      color: ${colors.secondary};
      font-size: 13px;
      line-height: 1.7;
      max-width: 65%;
      margin: 12mm auto;
    }
    
    .signatories {
      margin-top: auto;
      padding-bottom: 15mm;
    }
    
    .signatory {
      color: ${colors.primary};
    }
    
    .signature-line {
      background: ${colors.accent};
      width: 100px;
      height: 2px;
    }
    
    .sig-title {
      color: ${colors.secondary};
    }
    
    .certificate-id {
      color: ${colors.secondary};
      bottom: 12mm;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <!-- Geometric decorations -->
    <div class="geo-circle-1"></div>
    <div class="geo-circle-2"></div>
    <div class="geo-triangle"></div>
    <div class="geo-rect"></div>
    <div class="geo-dots">
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
      <div class="geo-dot"></div>
    </div>
    <div class="geo-line"></div>
    
    <div class="content-wrapper">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <div class="title">${titleText}</div>
      <div class="subtitle">${subtitleText}</div>
      
      <div class="presented-to">This is to certify that</div>
      <div class="recipient-name">${data.name}</div>
      <div class="name-underline"></div>
      
      <div class="description">${description}</div>
      
      <div class="signatories">
        ${renderSignatories(signatories)}
      </div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">Certificate ID: ${data.certificate_id}</div>` : ''}
  </div>
</body>
</html>
`
}
