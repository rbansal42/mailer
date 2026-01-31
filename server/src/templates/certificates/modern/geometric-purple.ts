import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const geometricPurpleTemplate: CertificateTemplate = {
  id: 'geometric-purple',
  name: 'Geometric Purple',
  category: 'modern',
  thumbnail: '/templates/geometric-purple.png',
  description: 'Bold purple triangular patterns with gold badge accent, modern and professional',
  defaultColors: {
    primary: '#7c3aed',
    secondary: '#a855f7',
    accent: '#d4af37',
  },
}

export function renderGeometricPurple(config: CertificateConfig, data: CertificateData): string {
  const description = replaceVariables(config.descriptionTemplate, data)
  const logosHtml = renderLogos(config.logos)
  const signatoriesHtml = renderSignatories(config.signatories)
  const nameFontSize = getNameFontSize(data.name)
  
  const templateStyles = `
    ${baseStyles}
    
    body {
      background: linear-gradient(135deg, ${config.colors.primary} 0%, #1e1b4b 100%);
    }
    
    .certificate {
      background: #ffffff;
      margin: 10mm;
      width: calc(100% - 20mm);
      height: calc(100% - 20mm);
      overflow: hidden;
    }
    
    /* Geometric triangle pattern - left side */
    .triangle-pattern-left {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 80px;
      overflow: hidden;
    }
    
    .triangle {
      position: absolute;
      width: 0;
      height: 0;
    }
    
    .tri-1 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.primary};
      top: 0;
      left: 0;
    }
    
    .tri-2 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.secondary};
      top: 60px;
      left: -20px;
    }
    
    .tri-3 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.primary}cc;
      top: 120px;
      left: 0;
    }
    
    .tri-4 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.secondary}cc;
      top: 180px;
      left: -20px;
    }
    
    .tri-5 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.primary}99;
      top: 240px;
      left: 0;
    }
    
    .tri-6 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.secondary}99;
      top: 300px;
      left: -20px;
    }
    
    .tri-7 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.primary}66;
      top: 360px;
      left: 0;
    }
    
    .tri-8 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-bottom: 70px solid ${config.colors.secondary}66;
      top: 420px;
      left: -20px;
    }
    
    /* Triangle pattern - right side */
    .triangle-pattern-right {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 80px;
      overflow: hidden;
    }
    
    .tri-r1 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.secondary};
      bottom: 0;
      right: 0;
    }
    
    .tri-r2 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.primary};
      bottom: 60px;
      right: -20px;
    }
    
    .tri-r3 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.secondary}cc;
      bottom: 120px;
      right: 0;
    }
    
    .tri-r4 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.primary}cc;
      bottom: 180px;
      right: -20px;
    }
    
    .tri-r5 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.secondary}99;
      bottom: 240px;
      right: 0;
    }
    
    .tri-r6 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.primary}99;
      bottom: 300px;
      right: -20px;
    }
    
    .tri-r7 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.secondary}66;
      bottom: 360px;
      right: 0;
    }
    
    .tri-r8 {
      border-left: 40px solid transparent;
      border-right: 40px solid transparent;
      border-top: 70px solid ${config.colors.primary}66;
      bottom: 420px;
      right: -20px;
    }
    
    /* Gold badge */
    .gold-badge {
      position: absolute;
      top: 15mm;
      right: 100px;
      width: 80px;
      height: 80px;
    }
    
    .badge-outer {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, ${config.colors.accent} 0%, #f59e0b 50%, ${config.colors.accent} 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
    }
    
    .badge-inner {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #fef3c7 0%, ${config.colors.accent} 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .badge-star {
      color: ${config.colors.primary};
      font-size: 28px;
    }
    
    .badge-ribbon {
      position: absolute;
      top: 70px;
      left: 50%;
      transform: translateX(-50%);
    }
    
    .ribbon-left, .ribbon-right {
      position: absolute;
      width: 20px;
      height: 40px;
      background: linear-gradient(180deg, ${config.colors.accent} 0%, #b8860b 100%);
    }
    
    .ribbon-left {
      left: -15px;
      transform: skewX(-15deg);
    }
    
    .ribbon-right {
      right: -15px;
      transform: skewX(15deg);
    }
    
    .content-wrapper {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 15mm 25mm;
    }
    
    .logo-bar {
      margin-bottom: 5mm;
    }
    
    .title {
      color: ${config.colors.primary};
      font-size: 46px;
    }
    
    .subtitle {
      color: ${config.colors.secondary};
      font-weight: 600;
    }
    
    .presented-to {
      color: #6b7280;
      margin-top: 12mm;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: ${config.colors.primary};
    }
    
    .name-underline {
      background: linear-gradient(90deg, ${config.colors.accent}, ${config.colors.primary}, ${config.colors.accent});
      height: 3px;
    }
    
    .description {
      color: #4b5563;
    }
    
    .signatories {
      color: ${config.colors.primary};
    }
    
    .signature-line {
      background: ${config.colors.secondary};
    }
    
    .sig-title {
      color: ${config.colors.secondary};
    }
    
    .certificate-id {
      color: ${config.colors.secondary};
    }
    
    /* Decorative lines */
    .decorative-line {
      position: absolute;
      height: 2px;
      background: linear-gradient(90deg, transparent, ${config.colors.accent}, transparent);
    }
    
    .line-top {
      top: 12mm;
      left: 100px;
      right: 100px;
    }
    
    .line-bottom {
      bottom: 12mm;
      left: 100px;
      right: 100px;
    }
  `

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${templateStyles}</style>
</head>
<body>
  <div class="certificate">
    <!-- Left triangle pattern -->
    <div class="triangle-pattern-left">
      <div class="triangle tri-1"></div>
      <div class="triangle tri-2"></div>
      <div class="triangle tri-3"></div>
      <div class="triangle tri-4"></div>
      <div class="triangle tri-5"></div>
      <div class="triangle tri-6"></div>
      <div class="triangle tri-7"></div>
      <div class="triangle tri-8"></div>
    </div>
    
    <!-- Right triangle pattern -->
    <div class="triangle-pattern-right">
      <div class="triangle tri-r1"></div>
      <div class="triangle tri-r2"></div>
      <div class="triangle tri-r3"></div>
      <div class="triangle tri-r4"></div>
      <div class="triangle tri-r5"></div>
      <div class="triangle tri-r6"></div>
      <div class="triangle tri-r7"></div>
      <div class="triangle tri-r8"></div>
    </div>
    
    <!-- Gold badge -->
    <div class="gold-badge">
      <div class="badge-outer">
        <div class="badge-inner">
          <span class="badge-star">★</span>
        </div>
      </div>
      <div class="badge-ribbon">
        <div class="ribbon-left"></div>
        <div class="ribbon-right"></div>
      </div>
    </div>
    
    <!-- Decorative lines -->
    <div class="decorative-line line-top"></div>
    <div class="decorative-line line-bottom"></div>
    
    <div class="content-wrapper">
      <div class="logo-bar">${logosHtml}</div>
      
      <div class="title">${escapeHtml(config.titleText)}</div>
      <div class="subtitle">${escapeHtml(config.subtitleText)}</div>
      
      <div class="presented-to">This is to certify that</div>
      <div class="recipient-name">${escapeHtml(data.name)}</div>
      <div class="name-underline"></div>
      
      <div class="description">${description}</div>
      
      <div class="signatories">${signatoriesHtml}</div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">Certificate No: ${escapeHtml(data.certificate_id)}</div>` : ''}
  </div>
</body>
</html>`
}
