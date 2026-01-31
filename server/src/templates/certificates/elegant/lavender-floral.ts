import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const lavenderFloralTemplate: CertificateTemplate = {
  id: 'elegant-lavender-floral',
  name: 'Lavender Floral',
  category: 'elegant',
  thumbnail: '/thumbnails/elegant-lavender-floral.png',
  description: 'Lavender and purple theme with decorative floral corner flourishes.',
  defaultColors: {
    primary: '#7b1fa2',
    secondary: '#ce93d8',
    accent: '#f3e5f5',
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
    
    body {
      background: ${colors.accent};
    }
    
    .certificate {
      background: linear-gradient(180deg, #ffffff 0%, ${colors.accent} 100%);
      position: relative;
    }
    
    /* Subtle texture overlay */
    .texture-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: 
        radial-gradient(circle at 20% 80%, ${colors.accent}40 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, ${colors.accent}40 0%, transparent 50%);
      pointer-events: none;
    }
    
    /* Floral corner decorations using CSS */
    .corner-flourish {
      position: absolute;
      width: 120px;
      height: 120px;
      pointer-events: none;
    }
    
    .corner-flourish svg {
      width: 100%;
      height: 100%;
    }
    
    .corner-tl { top: 8mm; left: 8mm; }
    .corner-tr { top: 8mm; right: 8mm; transform: scaleX(-1); }
    .corner-bl { bottom: 8mm; left: 8mm; transform: scaleY(-1); }
    .corner-br { bottom: 8mm; right: 8mm; transform: scale(-1, -1); }
    
    /* Decorative border */
    .border-frame {
      position: absolute;
      top: 10mm;
      left: 10mm;
      right: 10mm;
      bottom: 10mm;
      border: 2px solid ${colors.secondary}60;
      pointer-events: none;
    }
    
    .content {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .title {
      color: ${colors.primary};
      font-weight: 700;
    }
    
    .subtitle {
      color: ${colors.secondary};
    }
    
    .presented-to {
      color: #666;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: ${colors.primary};
    }
    
    .name-underline {
      background: linear-gradient(90deg, transparent, ${colors.secondary}, transparent);
    }
    
    .description {
      color: #555;
    }
    
    .signatories {
      color: #444;
    }
    
    .signature-line {
      background: ${colors.secondary};
    }
    
    .certificate-id {
      color: ${colors.secondary};
    }
    
    /* Small flower accents */
    .flower-accent {
      position: absolute;
      pointer-events: none;
    }
    
    .flower-accent-1 {
      top: 35%;
      left: 18mm;
      width: 30px;
      height: 30px;
    }
    
    .flower-accent-2 {
      top: 35%;
      right: 18mm;
      width: 30px;
      height: 30px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="texture-overlay"></div>
    <div class="border-frame"></div>
    
    <!-- Corner flourishes with floral SVG design -->
    <div class="corner-flourish corner-tl">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 90 Q10 50 30 30 Q50 10 90 10" stroke="${colors.secondary}" stroke-width="1.5" fill="none"/>
        <path d="M15 85 Q15 55 32 35 Q50 18 85 15" stroke="${colors.secondary}80" stroke-width="1" fill="none"/>
        <!-- Flower at corner -->
        <circle cx="20" cy="80" r="8" fill="${colors.secondary}40"/>
        <circle cx="20" cy="80" r="4" fill="${colors.primary}60"/>
        <ellipse cx="12" cy="78" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-30 12 78)"/>
        <ellipse cx="18" cy="72" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(20 18 72)"/>
        <ellipse cx="26" cy="74" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-10 26 74)"/>
        <ellipse cx="28" cy="82" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(40 28 82)"/>
        <ellipse cx="22" cy="88" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-20 22 88)"/>
        <!-- Leaves -->
        <path d="M35 65 Q45 60 50 50" stroke="${colors.primary}40" stroke-width="1" fill="none"/>
        <ellipse cx="42" cy="58" rx="8" ry="4" fill="${colors.primary}20" transform="rotate(-40 42 58)"/>
        <path d="M55 45 Q65 38 75 35" stroke="${colors.primary}30" stroke-width="0.8" fill="none"/>
        <ellipse cx="65" cy="38" rx="6" ry="3" fill="${colors.primary}15" transform="rotate(-25 65 38)"/>
      </svg>
    </div>
    <div class="corner-flourish corner-tr">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 90 Q10 50 30 30 Q50 10 90 10" stroke="${colors.secondary}" stroke-width="1.5" fill="none"/>
        <path d="M15 85 Q15 55 32 35 Q50 18 85 15" stroke="${colors.secondary}80" stroke-width="1" fill="none"/>
        <circle cx="20" cy="80" r="8" fill="${colors.secondary}40"/>
        <circle cx="20" cy="80" r="4" fill="${colors.primary}60"/>
        <ellipse cx="12" cy="78" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-30 12 78)"/>
        <ellipse cx="18" cy="72" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(20 18 72)"/>
        <ellipse cx="26" cy="74" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-10 26 74)"/>
        <ellipse cx="28" cy="82" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(40 28 82)"/>
        <ellipse cx="22" cy="88" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-20 22 88)"/>
        <path d="M35 65 Q45 60 50 50" stroke="${colors.primary}40" stroke-width="1" fill="none"/>
        <ellipse cx="42" cy="58" rx="8" ry="4" fill="${colors.primary}20" transform="rotate(-40 42 58)"/>
        <path d="M55 45 Q65 38 75 35" stroke="${colors.primary}30" stroke-width="0.8" fill="none"/>
        <ellipse cx="65" cy="38" rx="6" ry="3" fill="${colors.primary}15" transform="rotate(-25 65 38)"/>
      </svg>
    </div>
    <div class="corner-flourish corner-bl">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 90 Q10 50 30 30 Q50 10 90 10" stroke="${colors.secondary}" stroke-width="1.5" fill="none"/>
        <path d="M15 85 Q15 55 32 35 Q50 18 85 15" stroke="${colors.secondary}80" stroke-width="1" fill="none"/>
        <circle cx="20" cy="80" r="8" fill="${colors.secondary}40"/>
        <circle cx="20" cy="80" r="4" fill="${colors.primary}60"/>
        <ellipse cx="12" cy="78" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-30 12 78)"/>
        <ellipse cx="18" cy="72" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(20 18 72)"/>
        <ellipse cx="26" cy="74" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-10 26 74)"/>
        <ellipse cx="28" cy="82" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(40 28 82)"/>
        <ellipse cx="22" cy="88" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-20 22 88)"/>
        <path d="M35 65 Q45 60 50 50" stroke="${colors.primary}40" stroke-width="1" fill="none"/>
        <ellipse cx="42" cy="58" rx="8" ry="4" fill="${colors.primary}20" transform="rotate(-40 42 58)"/>
        <path d="M55 45 Q65 38 75 35" stroke="${colors.primary}30" stroke-width="0.8" fill="none"/>
        <ellipse cx="65" cy="38" rx="6" ry="3" fill="${colors.primary}15" transform="rotate(-25 65 38)"/>
      </svg>
    </div>
    <div class="corner-flourish corner-br">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 90 Q10 50 30 30 Q50 10 90 10" stroke="${colors.secondary}" stroke-width="1.5" fill="none"/>
        <path d="M15 85 Q15 55 32 35 Q50 18 85 15" stroke="${colors.secondary}80" stroke-width="1" fill="none"/>
        <circle cx="20" cy="80" r="8" fill="${colors.secondary}40"/>
        <circle cx="20" cy="80" r="4" fill="${colors.primary}60"/>
        <ellipse cx="12" cy="78" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-30 12 78)"/>
        <ellipse cx="18" cy="72" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(20 18 72)"/>
        <ellipse cx="26" cy="74" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-10 26 74)"/>
        <ellipse cx="28" cy="82" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(40 28 82)"/>
        <ellipse cx="22" cy="88" rx="5" ry="3" fill="${colors.secondary}50" transform="rotate(-20 22 88)"/>
        <path d="M35 65 Q45 60 50 50" stroke="${colors.primary}40" stroke-width="1" fill="none"/>
        <ellipse cx="42" cy="58" rx="8" ry="4" fill="${colors.primary}20" transform="rotate(-40 42 58)"/>
        <path d="M55 45 Q65 38 75 35" stroke="${colors.primary}30" stroke-width="0.8" fill="none"/>
        <ellipse cx="65" cy="38" rx="6" ry="3" fill="${colors.primary}15" transform="rotate(-25 65 38)"/>
      </svg>
    </div>
    
    <!-- Small flower accents on sides -->
    <div class="flower-accent flower-accent-1">
      <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="5" fill="${colors.secondary}50"/>
        <circle cx="15" cy="15" r="2" fill="${colors.primary}70"/>
        <ellipse cx="15" cy="8" rx="3" ry="4" fill="${colors.secondary}40"/>
        <ellipse cx="22" cy="15" rx="4" ry="3" fill="${colors.secondary}40"/>
        <ellipse cx="15" cy="22" rx="3" ry="4" fill="${colors.secondary}40"/>
        <ellipse cx="8" cy="15" rx="4" ry="3" fill="${colors.secondary}40"/>
      </svg>
    </div>
    <div class="flower-accent flower-accent-2">
      <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="15" cy="15" r="5" fill="${colors.secondary}50"/>
        <circle cx="15" cy="15" r="2" fill="${colors.primary}70"/>
        <ellipse cx="15" cy="8" rx="3" ry="4" fill="${colors.secondary}40"/>
        <ellipse cx="22" cy="15" rx="4" ry="3" fill="${colors.secondary}40"/>
        <ellipse cx="15" cy="22" rx="3" ry="4" fill="${colors.secondary}40"/>
        <ellipse cx="8" cy="15" rx="4" ry="3" fill="${colors.secondary}40"/>
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
