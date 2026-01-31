import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const techCyanTemplate: CertificateTemplate = {
  id: 'tech-cyan',
  name: 'Tech Cyan',
  category: 'dark',
  thumbnail: '/thumbnails/tech-cyan.png',
  description: 'Futuristic dark theme with cyan neon lines and grid pattern',
  defaultColors: {
    primary: '#00bcd4',
    secondary: '#006064',
    accent: '#84ffff',
  },
}

export function renderTechCyan(config: CertificateConfig, data: CertificateData): string {
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
      background: linear-gradient(180deg, #0a0a0f 0%, #121218 50%, #0a0a0f 100%);
    }
    
    .certificate {
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }
    
    /* Grid background */
    .grid-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      background-image: 
        linear-gradient(rgba(0, 188, 212, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 188, 212, 0.05) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    
    /* Horizontal scan lines */
    .scan-lines {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0, 188, 212, 0.03) 2px,
        rgba(0, 188, 212, 0.03) 4px
      );
    }
    
    .content-wrapper {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    /* Corner brackets */
    .corner-bracket {
      position: absolute;
      width: 50px;
      height: 50px;
      pointer-events: none;
    }
    
    .corner-bracket::before,
    .corner-bracket::after {
      content: '';
      position: absolute;
      background: ${colors.primary};
      box-shadow: 0 0 10px ${colors.primary}, 0 0 20px ${colors.primary}50;
    }
    
    .corner-bracket.top-left::before {
      top: 0; left: 0; width: 3px; height: 30px;
    }
    .corner-bracket.top-left::after {
      top: 0; left: 0; width: 30px; height: 3px;
    }
    
    .corner-bracket.top-right::before {
      top: 0; right: 0; width: 3px; height: 30px;
    }
    .corner-bracket.top-right::after {
      top: 0; right: 0; width: 30px; height: 3px;
    }
    
    .corner-bracket.bottom-left::before {
      bottom: 0; left: 0; width: 3px; height: 30px;
    }
    .corner-bracket.bottom-left::after {
      bottom: 0; left: 0; width: 30px; height: 3px;
    }
    
    .corner-bracket.bottom-right::before {
      bottom: 0; right: 0; width: 3px; height: 30px;
    }
    .corner-bracket.bottom-right::after {
      bottom: 0; right: 0; width: 30px; height: 3px;
    }
    
    .corner-bracket.top-left { top: 10mm; left: 10mm; }
    .corner-bracket.top-right { top: 10mm; right: 10mm; }
    .corner-bracket.bottom-left { bottom: 10mm; left: 10mm; }
    .corner-bracket.bottom-right { bottom: 10mm; right: 10mm; }
    
    /* Neon line accents */
    .neon-line-top, .neon-line-bottom {
      position: absolute;
      left: 60px;
      right: 60px;
      height: 2px;
      background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.accent}, ${colors.primary}, transparent);
      box-shadow: 0 0 10px ${colors.primary}, 0 0 20px ${colors.primary}50;
    }
    
    .neon-line-top { top: 8mm; }
    .neon-line-bottom { bottom: 8mm; }
    
    /* Side circuit lines */
    .circuit-line {
      position: absolute;
      width: 2px;
      background: linear-gradient(180deg, transparent, ${colors.primary}50, ${colors.primary}, ${colors.primary}50, transparent);
      box-shadow: 0 0 5px ${colors.primary};
    }
    
    .circuit-line.left {
      left: 6mm;
      top: 30%;
      height: 40%;
    }
    
    .circuit-line.right {
      right: 6mm;
      top: 30%;
      height: 40%;
    }
    
    .title {
      color: ${colors.primary};
      text-shadow: 
        0 0 10px ${colors.primary},
        0 0 20px ${colors.primary}80,
        0 0 30px ${colors.primary}40;
      letter-spacing: 10px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
    }
    
    .subtitle {
      color: ${colors.accent};
      text-shadow: 0 0 10px ${colors.accent}80;
      font-family: 'Montserrat', sans-serif;
      letter-spacing: 5px;
    }
    
    .presented-to {
      color: rgba(255, 255, 255, 0.6);
      font-family: 'Montserrat', sans-serif;
      text-transform: uppercase;
      letter-spacing: 3px;
      font-size: 12px;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: #ffffff;
      text-shadow: 
        0 0 20px ${colors.primary}80,
        0 0 40px ${colors.primary}40;
    }
    
    .name-underline {
      background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.accent}, ${colors.primary}, transparent);
      height: 2px;
      box-shadow: 0 0 10px ${colors.primary};
    }
    
    .description {
      color: rgba(255, 255, 255, 0.8);
    }
    
    /* Tech divider */
    .tech-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin: 8mm auto;
    }
    
    .tech-divider .line {
      width: 80px;
      height: 1px;
      background: linear-gradient(90deg, transparent, ${colors.primary});
    }
    
    .tech-divider .line:last-child {
      background: linear-gradient(90deg, ${colors.primary}, transparent);
    }
    
    .tech-divider .dot {
      width: 8px;
      height: 8px;
      background: ${colors.primary};
      box-shadow: 0 0 10px ${colors.primary};
      transform: rotate(45deg);
    }
    
    .signatories {
      color: #ffffff;
    }
    
    .signature-line {
      background: ${colors.primary};
      box-shadow: 0 0 5px ${colors.primary};
    }
    
    .sig-name {
      color: ${colors.accent};
    }
    
    .sig-title, .sig-org {
      color: rgba(255, 255, 255, 0.6);
    }
    
    .certificate-id {
      color: ${colors.primary}80;
      font-family: 'Montserrat', monospace;
      letter-spacing: 2px;
    }
    
    /* Data display badge */
    .data-badge {
      position: absolute;
      top: 15mm;
      left: 15mm;
      padding: 5px 15px;
      border: 1px solid ${colors.primary}50;
      background: rgba(0, 188, 212, 0.1);
      font-family: 'Montserrat', monospace;
      font-size: 10px;
      color: ${colors.accent};
      letter-spacing: 2px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="grid-bg"></div>
    <div class="scan-lines"></div>
    <div class="neon-line-top"></div>
    <div class="neon-line-bottom"></div>
    <div class="circuit-line left"></div>
    <div class="circuit-line right"></div>
    <div class="corner-bracket top-left"></div>
    <div class="corner-bracket top-right"></div>
    <div class="corner-bracket bottom-left"></div>
    <div class="corner-bracket bottom-right"></div>
    
    <div class="data-badge">CERTIFIED</div>
    
    <div class="content-wrapper">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <h1 class="title">${escapeHtml(titleText)}</h1>
      <p class="subtitle">${escapeHtml(subtitleText)}</p>
      
      <div class="tech-divider">
        <div class="line"></div>
        <div class="dot"></div>
        <div class="line"></div>
      </div>
      
      <p class="presented-to">This is presented to</p>
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
