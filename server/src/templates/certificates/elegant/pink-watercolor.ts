import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize, escapeHtml } from '../../../services/certificate-templates'

export const pinkWatercolorTemplate: CertificateTemplate = {
  id: 'elegant-pink-watercolor',
  name: 'Pink Watercolor',
  category: 'elegant',
  thumbnail: '/thumbnails/elegant-pink-watercolor.png',
  description: 'Soft pink gradient with watercolor effect and subtle frame. Feminine and elegant.',
  defaultColors: {
    primary: '#d81b60',
    secondary: '#f48fb1',
    accent: '#fce4ec',
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
      background: linear-gradient(135deg, ${colors.accent} 0%, #ffffff 50%, ${colors.accent} 100%);
      position: relative;
      overflow: hidden;
    }
    
    /* Watercolor effect layers */
    .watercolor-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }
    
    .watercolor-blob-1 {
      position: absolute;
      top: -50px;
      left: -50px;
      width: 300px;
      height: 300px;
      background: radial-gradient(ellipse at center, ${colors.secondary}40 0%, transparent 70%);
      border-radius: 60% 40% 70% 30%;
      transform: rotate(-15deg);
    }
    
    .watercolor-blob-2 {
      position: absolute;
      bottom: -80px;
      right: -60px;
      width: 350px;
      height: 280px;
      background: radial-gradient(ellipse at center, ${colors.secondary}35 0%, transparent 65%);
      border-radius: 40% 60% 30% 70%;
      transform: rotate(20deg);
    }
    
    .watercolor-blob-3 {
      position: absolute;
      top: 50%;
      left: -100px;
      width: 200px;
      height: 400px;
      background: radial-gradient(ellipse at center, ${colors.accent}60 0%, transparent 60%);
      border-radius: 50%;
      transform: translateY(-50%) rotate(45deg);
    }
    
    .watercolor-blob-4 {
      position: absolute;
      top: 30%;
      right: -80px;
      width: 180px;
      height: 350px;
      background: radial-gradient(ellipse at center, ${colors.accent}50 0%, transparent 55%);
      border-radius: 50%;
      transform: translateY(-50%) rotate(-30deg);
    }
    
    /* Subtle frame border */
    .frame {
      position: absolute;
      top: 12mm;
      left: 12mm;
      right: 12mm;
      bottom: 12mm;
      border: 1px solid ${colors.secondary}80;
      border-radius: 2px;
      pointer-events: none;
    }
    
    .frame-inner {
      position: absolute;
      top: 3mm;
      left: 3mm;
      right: 3mm;
      bottom: 3mm;
      border: 0.5px solid ${colors.secondary}50;
      border-radius: 1px;
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
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
  </style>
</head>
<body>
  <div class="certificate">
    <div class="watercolor-layer">
      <div class="watercolor-blob-1"></div>
      <div class="watercolor-blob-2"></div>
      <div class="watercolor-blob-3"></div>
      <div class="watercolor-blob-4"></div>
    </div>
    
    <div class="frame">
      <div class="frame-inner"></div>
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
