import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const creamClassicTemplate: CertificateTemplate = {
  id: 'elegant-cream-classic',
  name: 'Cream Classic',
  category: 'elegant',
  thumbnail: '/thumbnails/elegant-cream-classic.png',
  description: 'Traditional cream and ivory theme with ornate gold double border. Formal and academic.',
  defaultColors: {
    primary: '#8b7355',
    secondary: '#c9a962',
    accent: '#fffef0',
  },
}

export function render(config: CertificateConfig, data: CertificateData): string {
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
    
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap');
    
    body {
      background: ${colors.accent};
    }
    
    .certificate {
      background: linear-gradient(180deg, ${colors.accent} 0%, #faf8f0 50%, ${colors.accent} 100%);
      position: relative;
    }
    
    /* Subtle paper texture effect */
    .paper-texture {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(139, 115, 85, 0.01) 2px,
          rgba(139, 115, 85, 0.01) 4px
        );
      pointer-events: none;
    }
    
    /* Ornate double border */
    .outer-border {
      position: absolute;
      top: 8mm;
      left: 8mm;
      right: 8mm;
      bottom: 8mm;
      border: 3px solid ${colors.secondary};
      pointer-events: none;
    }
    
    .inner-border {
      position: absolute;
      top: 12mm;
      left: 12mm;
      right: 12mm;
      bottom: 12mm;
      border: 1px solid ${colors.secondary};
      pointer-events: none;
    }
    
    /* Decorative corner ornaments */
    .corner-ornament {
      position: absolute;
      width: 40px;
      height: 40px;
      pointer-events: none;
    }
    
    .corner-ornament svg {
      width: 100%;
      height: 100%;
    }
    
    .corner-tl { top: 5mm; left: 5mm; }
    .corner-tr { top: 5mm; right: 5mm; transform: scaleX(-1); }
    .corner-bl { bottom: 5mm; left: 5mm; transform: scaleY(-1); }
    .corner-br { bottom: 5mm; right: 5mm; transform: scale(-1, -1); }
    
    /* Gold accent lines */
    .gold-line-top,
    .gold-line-bottom {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      height: 2px;
      width: 40%;
      pointer-events: none;
    }
    
    .gold-line-top {
      top: 18mm;
      background: linear-gradient(90deg, transparent, ${colors.secondary}, transparent);
    }
    
    .gold-line-bottom {
      bottom: 18mm;
      background: linear-gradient(90deg, transparent, ${colors.secondary}, transparent);
    }
    
    .content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .title {
      font-family: 'Cormorant Garamond', 'Playfair Display', serif;
      color: ${colors.primary};
      font-weight: 700;
      letter-spacing: 8px;
    }
    
    .subtitle {
      font-family: 'Cormorant Garamond', serif;
      color: ${colors.secondary};
      letter-spacing: 4px;
    }
    
    .presented-to {
      font-family: 'Cormorant Garamond', serif;
      color: ${colors.primary};
      font-size: 16px;
      font-style: italic;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: ${colors.primary};
    }
    
    .name-underline {
      background: ${colors.secondary};
      height: 1px;
    }
    
    .description {
      font-family: 'Cormorant Garamond', serif;
      color: ${colors.primary};
      font-size: 14px;
      line-height: 1.8;
    }
    
    .signatories {
      color: ${colors.primary};
    }
    
    .signature-line {
      background: ${colors.secondary};
    }
    
    .sig-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 14px;
    }
    
    .sig-title {
      font-family: 'Cormorant Garamond', serif;
    }
    
    .certificate-id {
      color: ${colors.secondary};
      font-family: 'Cormorant Garamond', serif;
    }
    
    /* Seal decoration */
    .seal {
      position: absolute;
      bottom: 25mm;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 60px;
      pointer-events: none;
      opacity: 0.15;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="paper-texture"></div>
    
    <!-- Ornate double border -->
    <div class="outer-border"></div>
    <div class="inner-border"></div>
    
    <!-- Corner ornaments -->
    <div class="corner-ornament corner-tl">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 35 L5 15 Q5 5 15 5 L35 5" stroke="${colors.secondary}" stroke-width="2" fill="none"/>
        <path d="M8 32 L8 18 Q8 8 18 8 L32 8" stroke="${colors.secondary}" stroke-width="1" fill="none"/>
        <circle cx="5" cy="35" r="3" fill="${colors.secondary}"/>
        <circle cx="35" cy="5" r="3" fill="${colors.secondary}"/>
        <path d="M12 28 Q12 12 28 12" stroke="${colors.secondary}60" stroke-width="0.5" fill="none"/>
      </svg>
    </div>
    <div class="corner-ornament corner-tr">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 35 L5 15 Q5 5 15 5 L35 5" stroke="${colors.secondary}" stroke-width="2" fill="none"/>
        <path d="M8 32 L8 18 Q8 8 18 8 L32 8" stroke="${colors.secondary}" stroke-width="1" fill="none"/>
        <circle cx="5" cy="35" r="3" fill="${colors.secondary}"/>
        <circle cx="35" cy="5" r="3" fill="${colors.secondary}"/>
        <path d="M12 28 Q12 12 28 12" stroke="${colors.secondary}60" stroke-width="0.5" fill="none"/>
      </svg>
    </div>
    <div class="corner-ornament corner-bl">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 35 L5 15 Q5 5 15 5 L35 5" stroke="${colors.secondary}" stroke-width="2" fill="none"/>
        <path d="M8 32 L8 18 Q8 8 18 8 L32 8" stroke="${colors.secondary}" stroke-width="1" fill="none"/>
        <circle cx="5" cy="35" r="3" fill="${colors.secondary}"/>
        <circle cx="35" cy="5" r="3" fill="${colors.secondary}"/>
        <path d="M12 28 Q12 12 28 12" stroke="${colors.secondary}60" stroke-width="0.5" fill="none"/>
      </svg>
    </div>
    <div class="corner-ornament corner-br">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 35 L5 15 Q5 5 15 5 L35 5" stroke="${colors.secondary}" stroke-width="2" fill="none"/>
        <path d="M8 32 L8 18 Q8 8 18 8 L32 8" stroke="${colors.secondary}" stroke-width="1" fill="none"/>
        <circle cx="5" cy="35" r="3" fill="${colors.secondary}"/>
        <circle cx="35" cy="5" r="3" fill="${colors.secondary}"/>
        <path d="M12 28 Q12 12 28 12" stroke="${colors.secondary}60" stroke-width="0.5" fill="none"/>
      </svg>
    </div>
    
    <!-- Gold accent lines -->
    <div class="gold-line-top"></div>
    <div class="gold-line-bottom"></div>
    
    <!-- Decorative seal watermark -->
    <div class="seal">
      <svg viewBox="0 0 60 60" fill="${colors.secondary}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="28" fill="none" stroke="${colors.secondary}" stroke-width="2"/>
        <circle cx="30" cy="30" r="22" fill="none" stroke="${colors.secondary}" stroke-width="1"/>
        <path d="M30 8 L32 20 L44 15 L36 25 L48 30 L36 35 L44 45 L32 40 L30 52 L28 40 L16 45 L24 35 L12 30 L24 25 L16 15 L28 20 Z" fill="${colors.secondary}"/>
      </svg>
    </div>
    
    <div class="content">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <h1 class="title">${escapeHtml(titleText)}</h1>
      ${subtitleText ? `<p class="subtitle">${escapeHtml(subtitleText)}</p>` : ''}
      
      <p class="presented-to">This certificate is proudly presented to</p>
      
      <h2 class="recipient-name">${escapeHtml(data.name)}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${description}</p>
      
      <div class="signatories">
        ${renderSignatories(signatories)}
      </div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">${escapeHtml(data.certificate_id)}</div>` : ''}
  </div>
</body>
</html>`
}
