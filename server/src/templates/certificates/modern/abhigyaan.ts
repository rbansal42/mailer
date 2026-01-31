import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const abhigyaanTemplate: CertificateTemplate = {
  id: 'abhigyaan',
  name: 'Abhigyaan Style',
  category: 'modern',
  thumbnail: '/templates/abhigyaan.png',
  description: 'Abstract organic shapes with pastel and vibrant colors, playful and creative design',
  defaultColors: {
    primary: '#6366f1',
    secondary: '#ec4899',
    accent: '#fef3c7',
  },
}

export function renderAbhigyaan(config: CertificateConfig, data: CertificateData): string {
  const description = replaceVariables(config.descriptionTemplate, data)
  const logosHtml = renderLogos(config.logos)
  const signatoriesHtml = renderSignatories(config.signatories)
  const nameFontSize = getNameFontSize(data.name)
  
  const templateStyles = `
    ${baseStyles}
    
    body {
      background: linear-gradient(135deg, ${config.colors.accent} 0%, #fdf4ff 50%, #ecfeff 100%);
    }
    
    .certificate {
      background: rgba(255, 255, 255, 0.85);
      border-radius: 20px;
      margin: 8mm;
      width: calc(100% - 16mm);
      height: calc(100% - 16mm);
      overflow: hidden;
    }
    
    /* Organic blob shapes */
    .blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.6;
      z-index: 0;
    }
    
    .blob-1 {
      width: 200px;
      height: 200px;
      background: ${config.colors.primary};
      top: -50px;
      left: -50px;
    }
    
    .blob-2 {
      width: 250px;
      height: 200px;
      background: ${config.colors.secondary};
      top: 30%;
      right: -80px;
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
    }
    
    .blob-3 {
      width: 180px;
      height: 180px;
      background: #22d3d1;
      bottom: -40px;
      left: 20%;
    }
    
    .blob-4 {
      width: 150px;
      height: 150px;
      background: #fbbf24;
      bottom: 20%;
      left: -30px;
    }
    
    .blob-5 {
      width: 120px;
      height: 120px;
      background: ${config.colors.primary};
      bottom: -30px;
      right: 15%;
      opacity: 0.4;
    }
    
    /* Abstract wave decoration */
    .wave-decoration {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 80px;
      overflow: hidden;
      z-index: 1;
    }
    
    .wave-decoration::before {
      content: '';
      position: absolute;
      top: -40px;
      left: -10%;
      width: 120%;
      height: 100px;
      background: linear-gradient(90deg, 
        ${config.colors.primary}40 0%, 
        ${config.colors.secondary}40 50%, 
        #22d3d140 100%
      );
      border-radius: 0 0 50% 50%;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 15mm;
    }
    
    .logo-bar {
      margin-bottom: 8mm;
    }
    
    .title {
      color: ${config.colors.primary};
      font-size: 44px;
      background: linear-gradient(135deg, ${config.colors.primary} 0%, ${config.colors.secondary} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .subtitle {
      color: ${config.colors.secondary};
      font-weight: 500;
    }
    
    .presented-to {
      color: #6b7280;
      margin-top: 12mm;
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      background: linear-gradient(135deg, ${config.colors.primary} 0%, ${config.colors.secondary} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .name-underline {
      background: linear-gradient(90deg, ${config.colors.primary}, ${config.colors.secondary}, #22d3d1);
      height: 3px;
      border-radius: 2px;
    }
    
    .description {
      color: #4b5563;
      font-size: 13px;
    }
    
    .signatories {
      color: ${config.colors.primary};
    }
    
    .signature-line {
      background: linear-gradient(90deg, ${config.colors.primary}, ${config.colors.secondary});
    }
    
    .sig-title, .sig-org {
      color: ${config.colors.secondary};
    }
    
    .certificate-id {
      color: ${config.colors.primary};
    }
    
    /* Decorative circles */
    .circle-decoration {
      position: absolute;
      border: 3px solid;
      border-radius: 50%;
      z-index: 1;
    }
    
    .circle-1 {
      width: 40px;
      height: 40px;
      border-color: ${config.colors.primary}60;
      top: 25%;
      right: 10%;
    }
    
    .circle-2 {
      width: 25px;
      height: 25px;
      border-color: ${config.colors.secondary}60;
      bottom: 30%;
      left: 8%;
    }
    
    .circle-3 {
      width: 15px;
      height: 15px;
      border-color: #22d3d160;
      top: 40%;
      left: 5%;
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
    <!-- Organic blobs -->
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
    <div class="blob blob-4"></div>
    <div class="blob blob-5"></div>
    
    <!-- Decorative circles -->
    <div class="circle-decoration circle-1"></div>
    <div class="circle-decoration circle-2"></div>
    <div class="circle-decoration circle-3"></div>
    
    <!-- Wave decoration -->
    <div class="wave-decoration"></div>
    
    <div class="content-wrapper">
      <div class="logo-bar">${logosHtml}</div>
      
      <div class="title">${config.titleText}</div>
      <div class="subtitle">${config.subtitleText}</div>
      
      <div class="presented-to">This certificate is proudly presented to</div>
      <div class="recipient-name">${data.name}</div>
      <div class="name-underline"></div>
      
      <div class="description">${description}</div>
      
      <div class="signatories">${signatoriesHtml}</div>
    </div>
    
    ${data.certificate_id ? `<div class="certificate-id">ID: ${data.certificate_id}</div>` : ''}
  </div>
</body>
</html>`
}
