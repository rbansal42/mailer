import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const gradientWaveTemplate: CertificateTemplate = {
  id: 'gradient-wave',
  name: 'Gradient Wave',
  category: 'minimal',
  thumbnail: '/templates/gradient-wave.png',
  description: 'Modern artistic design with flowing wave patterns and monochromatic gradient',
  defaultColors: {
    primary: '#1e3a5f',
    secondary: '#4a6fa5',
    accent: '#7eb8da'
  }
}

export function renderGradientWave(config: CertificateConfig, data: CertificateData): string {
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
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    }
    
    .certificate {
      background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 50%, #e8f4f8 100%);
      color: ${colors.primary};
      position: relative;
      overflow: hidden;
    }
    
    /* SVG wave patterns */
    .wave-container {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 120px;
      overflow: hidden;
    }
    
    .wave {
      position: absolute;
      bottom: 0;
      left: -5%;
      width: 110%;
    }
    
    .wave-1 {
      opacity: 0.1;
      bottom: 0;
    }
    
    .wave-2 {
      opacity: 0.15;
      bottom: 15px;
    }
    
    .wave-3 {
      opacity: 0.08;
      bottom: 30px;
    }
    
    /* Top wave decoration */
    .wave-top-container {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      overflow: hidden;
      transform: rotate(180deg);
    }
    
    .wave-top {
      opacity: 0.06;
    }
    
    /* Side gradient accents */
    .gradient-left {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 200px;
      background: linear-gradient(180deg, transparent, ${colors.accent}, ${colors.secondary}, ${colors.primary}, transparent);
      border-radius: 0 3px 3px 0;
    }
    
    .gradient-right {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 200px;
      background: linear-gradient(180deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.accent}, transparent);
      border-radius: 3px 0 0 3px;
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
      font-size: 40px;
      margin-top: 12mm;
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .subtitle {
      color: ${colors.secondary};
      font-size: 15px;
      letter-spacing: 5px;
      font-weight: 500;
      margin-top: 6px;
    }
    
    .presented-to {
      color: ${colors.secondary};
      font-size: 12px;
      margin-top: 16mm;
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
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .name-underline {
      width: 200px;
      height: 2px;
      background: linear-gradient(90deg, transparent, ${colors.accent}, ${colors.secondary}, ${colors.accent}, transparent);
      margin: 0 auto;
    }
    
    .description {
      color: ${colors.secondary};
      font-size: 13px;
      line-height: 1.8;
      max-width: 70%;
      margin: 12mm auto;
    }
    
    .signatories {
      margin-top: auto;
      padding-bottom: 20mm;
      position: relative;
      z-index: 2;
    }
    
    .signatory {
      color: ${colors.primary};
    }
    
    .signature-line {
      background: linear-gradient(90deg, transparent, ${colors.secondary}, transparent);
      width: 110px;
      height: 1px;
    }
    
    .sig-title {
      color: ${colors.secondary};
    }
    
    .certificate-id {
      color: ${colors.secondary};
      bottom: 10mm;
      z-index: 2;
    }
    
    /* Print media fallbacks - gradient text doesn't work in print mode */
    @media print {
      .title {
        background: none !important;
        -webkit-background-clip: initial !important;
        -webkit-text-fill-color: ${colors.primary} !important;
        background-clip: initial !important;
        color: ${colors.primary} !important;
      }
      
      .recipient-name {
        background: none !important;
        -webkit-background-clip: initial !important;
        -webkit-text-fill-color: ${colors.primary} !important;
        background-clip: initial !important;
        color: ${colors.primary} !important;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <!-- Wave decorations -->
    <div class="wave-top-container">
      <svg class="wave wave-top" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="${colors.primary}" d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,80 1440,60 L1440,120 L0,120 Z"/>
      </svg>
    </div>
    
    <div class="wave-container">
      <svg class="wave wave-3" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="${colors.accent}" d="M0,40 C240,80 480,20 720,50 C960,80 1200,30 1440,60 L1440,120 L0,120 Z"/>
      </svg>
      <svg class="wave wave-2" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="${colors.secondary}" d="M0,60 C360,20 720,100 1080,40 C1260,10 1380,50 1440,30 L1440,120 L0,120 Z"/>
      </svg>
      <svg class="wave wave-1" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path fill="${colors.primary}" d="M0,30 C240,90 480,10 720,50 C960,90 1200,20 1440,70 L1440,120 L0,120 Z"/>
      </svg>
    </div>
    
    <div class="gradient-left"></div>
    <div class="gradient-right"></div>
    
    <div class="content-wrapper">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <div class="title">${escapeHtml(titleText)}</div>
      <div class="subtitle">${escapeHtml(subtitleText)}</div>
      
      <div class="presented-to">Proudly Presented to</div>
      <div class="recipient-name">${escapeHtml(data.name)}</div>
      <div class="name-underline"></div>
      
      <div class="description">${description}</div>
      
      <div class="signatories">
        ${renderSignatories(signatories)}
      </div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">ID: ${escapeHtml(data.certificate_id)}</div>` : ''}
  </div>
</body>
</html>
`
}
