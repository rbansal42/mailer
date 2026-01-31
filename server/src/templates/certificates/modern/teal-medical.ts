import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const tealMedicalTemplate: CertificateTemplate = {
  id: 'teal-medical',
  name: 'Teal Medical',
  category: 'modern',
  thumbnail: '/templates/teal-medical.png',
  description: 'Healthcare-themed design with teal colors, clean and professional for medical certificates',
  defaultColors: {
    primary: '#0d9488',
    secondary: '#14b8a6',
    accent: '#ccfbf1',
  },
}

export function renderTealMedical(config: CertificateConfig, data: CertificateData): string {
  const description = replaceVariables(config.descriptionTemplate, data)
  const logosHtml = renderLogos(config.logos)
  const signatoriesHtml = renderSignatories(config.signatories)
  const nameFontSize = getNameFontSize(data.name)
  
  const templateStyles = `
    ${baseStyles}
    
    body {
      background: ${config.colors.accent};
    }
    
    .certificate {
      background: #ffffff;
      margin: 8mm;
      width: calc(100% - 16mm);
      height: calc(100% - 16mm);
      border-left: 8px solid ${config.colors.primary};
      overflow: hidden;
    }
    
    /* Top header bar */
    .header-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: linear-gradient(90deg, ${config.colors.primary} 0%, ${config.colors.secondary} 100%);
    }
    
    .header-bar::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 0;
      right: 0;
      height: 20px;
      background: linear-gradient(90deg, ${config.colors.primary} 0%, ${config.colors.secondary} 100%);
      clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 50%, 0 100%);
    }
    
    /* Medical cross symbols */
    .medical-cross {
      position: absolute;
      opacity: 0.1;
    }
    
    .cross-1 {
      top: 80px;
      right: 40px;
      width: 100px;
      height: 100px;
    }
    
    .cross-2 {
      bottom: 60px;
      left: 30px;
      width: 80px;
      height: 80px;
    }
    
    .cross-3 {
      top: 50%;
      right: 60px;
      width: 50px;
      height: 50px;
      opacity: 0.05;
    }
    
    .cross-shape {
      width: 100%;
      height: 100%;
      position: relative;
    }
    
    .cross-shape::before,
    .cross-shape::after {
      content: '';
      position: absolute;
      background: ${config.colors.primary};
    }
    
    .cross-shape::before {
      width: 30%;
      height: 100%;
      left: 35%;
    }
    
    .cross-shape::after {
      width: 100%;
      height: 30%;
      top: 35%;
    }
    
    /* Pulse line decoration */
    .pulse-line {
      position: absolute;
      bottom: 40px;
      left: 100px;
      right: 100px;
      height: 40px;
      opacity: 0.15;
    }
    
    .pulse-svg {
      width: 100%;
      height: 100%;
    }
    
    /* DNA helix decoration */
    .dna-decoration {
      position: absolute;
      right: 20px;
      top: 100px;
      bottom: 100px;
      width: 40px;
      opacity: 0.08;
    }
    
    .dna-dot {
      position: absolute;
      width: 8px;
      height: 8px;
      background: ${config.colors.primary};
      border-radius: 50%;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 20mm 20mm 15mm 25mm;
    }
    
    .logo-bar {
      margin-bottom: 8mm;
    }
    
    .logo-bar img {
      height: 55px;
    }
    
    .title {
      color: ${config.colors.primary};
      font-size: 44px;
      position: relative;
    }
    
    .title::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      width: 80px;
      height: 3px;
      background: ${config.colors.secondary};
      border-radius: 2px;
    }
    
    .subtitle {
      color: ${config.colors.secondary};
      font-weight: 600;
      margin-top: 10px;
    }
    
    .presented-to {
      color: #64748b;
      margin-top: 10mm;
      font-size: 13px;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: ${config.colors.primary};
    }
    
    .name-underline {
      background: linear-gradient(90deg, transparent, ${config.colors.secondary}, transparent);
      height: 2px;
      width: 70%;
    }
    
    .description {
      color: #475569;
      max-width: 70%;
    }
    
    .signatories {
      color: #334155;
    }
    
    .signature-line {
      background: ${config.colors.primary};
    }
    
    .sig-name {
      color: ${config.colors.primary};
    }
    
    .sig-title {
      color: ${config.colors.secondary};
    }
    
    .certificate-id {
      color: ${config.colors.primary};
      background: ${config.colors.accent};
      padding: 4px 10px;
      border-radius: 4px;
      bottom: 10mm;
      right: 15mm;
    }
    
    /* Circular decorations */
    .circle-deco {
      position: absolute;
      border: 2px solid ${config.colors.secondary};
      border-radius: 50%;
      opacity: 0.2;
    }
    
    .circle-1 {
      width: 150px;
      height: 150px;
      bottom: -50px;
      right: 100px;
    }
    
    .circle-2 {
      width: 80px;
      height: 80px;
      top: 100px;
      left: -20px;
    }
    
    /* Corner accents */
    .corner-accent {
      position: absolute;
      width: 30px;
      height: 30px;
      border: 3px solid ${config.colors.primary};
    }
    
    .corner-tl {
      top: 15mm;
      left: 15mm;
      border-right: none;
      border-bottom: none;
    }
    
    .corner-tr {
      top: 15mm;
      right: 15mm;
      border-left: none;
      border-bottom: none;
    }
    
    .corner-bl {
      bottom: 15mm;
      left: 15mm;
      border-right: none;
      border-top: none;
    }
    
    .corner-br {
      bottom: 15mm;
      right: 15mm;
      border-left: none;
      border-top: none;
    }
  `

  // Generate DNA helix dots
  const dnaDots = Array.from({ length: 12 }, (_, i) => {
    const y = i * 35
    const offset = Math.sin(i * 0.8) * 12
    return `
      <div class="dna-dot" style="top: ${y}px; left: ${14 + offset}px;"></div>
      <div class="dna-dot" style="top: ${y + 10}px; left: ${14 - offset}px;"></div>
    `
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${templateStyles}</style>
</head>
<body>
  <div class="certificate">
    <!-- Header bar -->
    <div class="header-bar"></div>
    
    <!-- Medical crosses -->
    <div class="medical-cross cross-1">
      <div class="cross-shape"></div>
    </div>
    <div class="medical-cross cross-2">
      <div class="cross-shape"></div>
    </div>
    <div class="medical-cross cross-3">
      <div class="cross-shape"></div>
    </div>
    
    <!-- DNA decoration -->
    <div class="dna-decoration">${dnaDots}</div>
    
    <!-- Circular decorations -->
    <div class="circle-deco circle-1"></div>
    <div class="circle-deco circle-2"></div>
    
    <!-- Corner accents -->
    <div class="corner-accent corner-tl"></div>
    <div class="corner-accent corner-tr"></div>
    <div class="corner-accent corner-bl"></div>
    <div class="corner-accent corner-br"></div>
    
    <!-- Pulse line -->
    <div class="pulse-line">
      <svg class="pulse-svg" viewBox="0 0 400 40" preserveAspectRatio="none">
        <path d="M0,20 L80,20 L100,5 L120,35 L140,10 L160,30 L180,20 L400,20" 
              fill="none" 
              stroke="${config.colors.primary}" 
              stroke-width="2"/>
      </svg>
    </div>
    
    <div class="content-wrapper">
      <div class="logo-bar">${logosHtml}</div>
      
      <div class="title">${config.titleText}</div>
      <div class="subtitle">${config.subtitleText}</div>
      
      <div class="presented-to">This is to certify that</div>
      <div class="recipient-name">${data.name}</div>
      <div class="name-underline"></div>
      
      <div class="description">${description}</div>
      
      <div class="signatories">${signatoriesHtml}</div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">Cert. ID: ${data.certificate_id}</div>` : ''}
  </div>
</body>
</html>`
}
