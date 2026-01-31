import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const navyGoldTemplate: CertificateTemplate = {
  id: 'navy-gold',
  name: 'Navy Gold',
  category: 'dark',
  thumbnail: '/thumbnails/navy-gold.png',
  description: 'Deep navy background with gold geometric accents and elegant award styling',
  defaultColors: {
    primary: '#ffd700',
    secondary: '#1a237e',
    accent: '#ffecb3',
  },
}

export function renderNavyGold(config: CertificateConfig, data: CertificateData): string {
  const { colors, logos, signatories, titleText, subtitleText, descriptionTemplate } = config
  const description = replaceVariables(descriptionTemplate, data)
  const nameFontSize = getNameFontSize(data.name)

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${fontImports}
  <style>
    ${baseStyles}
    
    body {
      background: linear-gradient(180deg, #1a237e 0%, #0d1442 100%);
    }
    
    .certificate {
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }
    
    /* Geometric pattern background */
    .geo-pattern {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      opacity: 0.08;
      background-image: 
        linear-gradient(30deg, ${colors.primary} 12%, transparent 12.5%, transparent 87%, ${colors.primary} 87.5%, ${colors.primary}),
        linear-gradient(150deg, ${colors.primary} 12%, transparent 12.5%, transparent 87%, ${colors.primary} 87.5%, ${colors.primary}),
        linear-gradient(30deg, ${colors.primary} 12%, transparent 12.5%, transparent 87%, ${colors.primary} 87.5%, ${colors.primary}),
        linear-gradient(150deg, ${colors.primary} 12%, transparent 12.5%, transparent 87%, ${colors.primary} 87.5%, ${colors.primary});
      background-size: 80px 140px;
      background-position: 0 0, 0 0, 40px 70px, 40px 70px;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    /* Gold border frame */
    .gold-frame {
      position: absolute;
      top: 12mm;
      left: 12mm;
      right: 12mm;
      bottom: 12mm;
      border: 2px solid ${colors.primary};
      pointer-events: none;
    }
    
    .gold-frame::before {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      right: 4px;
      bottom: 4px;
      border: 1px solid ${colors.primary}50;
    }
    
    /* Corner ornaments */
    .corner-ornament {
      position: absolute;
      width: 40px;
      height: 40px;
      border: 3px solid ${colors.primary};
    }
    
    .corner-ornament.top-left {
      top: 8mm;
      left: 8mm;
      border-right: none;
      border-bottom: none;
    }
    
    .corner-ornament.top-right {
      top: 8mm;
      right: 8mm;
      border-left: none;
      border-bottom: none;
    }
    
    .corner-ornament.bottom-left {
      bottom: 8mm;
      left: 8mm;
      border-right: none;
      border-top: none;
    }
    
    .corner-ornament.bottom-right {
      bottom: 8mm;
      right: 8mm;
      border-left: none;
      border-top: none;
    }
    
    /* Award badge */
    .award-badge {
      position: absolute;
      top: 15mm;
      right: 20mm;
      width: 70px;
      height: 85px;
    }
    
    .badge-circle {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${colors.primary} 0%, #b8860b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
    }
    
    .badge-star {
      color: ${colors.secondary};
      font-size: 36px;
      line-height: 1;
    }
    
    .badge-ribbon {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 50px;
      height: 25px;
    }
    
    .ribbon-left, .ribbon-right {
      position: absolute;
      bottom: 0;
      width: 20px;
      height: 25px;
      background: linear-gradient(135deg, ${colors.primary} 0%, #b8860b 100%);
    }
    
    .ribbon-left {
      left: 5px;
      transform: skewX(-15deg);
    }
    
    .ribbon-right {
      right: 5px;
      transform: skewX(15deg);
    }
    
    .title {
      color: ${colors.primary};
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .subtitle {
      color: ${colors.accent};
    }
    
    .presented-to {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: ${colors.primary};
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .name-underline {
      background: linear-gradient(90deg, transparent, ${colors.primary}, transparent);
      height: 2px;
    }
    
    .description {
      color: rgba(255, 255, 255, 0.9);
    }
    
    /* Gold divider lines */
    .gold-divider {
      width: 200px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${colors.primary}, transparent);
      margin: 8mm auto;
    }
    
    .signatories {
      color: #ffffff;
    }
    
    .signature-line {
      background: ${colors.primary};
    }
    
    .sig-name {
      color: ${colors.accent};
    }
    
    .sig-title, .sig-org {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .certificate-id {
      color: ${colors.primary}80;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="geo-pattern"></div>
    <div class="gold-frame"></div>
    <div class="corner-ornament top-left"></div>
    <div class="corner-ornament top-right"></div>
    <div class="corner-ornament bottom-left"></div>
    <div class="corner-ornament bottom-right"></div>
    
    <div class="award-badge">
      <div class="badge-circle">
        <span class="badge-star">&#9733;</span>
      </div>
      <div class="badge-ribbon">
        <div class="ribbon-left"></div>
        <div class="ribbon-right"></div>
      </div>
    </div>
    
    <div class="content-wrapper">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <h1 class="title">${escapeHtml(titleText)}</h1>
      <p class="subtitle">${escapeHtml(subtitleText)}</p>
      
      <div class="gold-divider"></div>
      
      <p class="presented-to">This is proudly presented to</p>
      <h2 class="recipient-name">${escapeHtml(data.name)}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${description}</p>
      
      <div class="signatories">
        ${renderSignatories(signatories)}
      </div>
      
      ${data.certificate_id ? `<div class="certificate-id">ID: ${escapeHtml(data.certificate_id)}</div>` : ''}
    </div>
  </div>
</body>
</html>`
}
