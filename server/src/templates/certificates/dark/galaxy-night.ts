import type { CertificateTemplate, CertificateConfig, CertificateData } from '../../../lib/certificate-types'
import { baseStyles, fontImports } from '../base-styles'
import { replaceVariables, renderLogos, renderSignatories, getNameFontSize } from '../../../services/certificate-templates'

export const galaxyNightTemplate: CertificateTemplate = {
  id: 'galaxy-night',
  name: 'Galaxy Night',
  category: 'dark',
  thumbnail: '/thumbnails/galaxy-night.png',
  description: 'Dark starry background with glowing purple text and elegant cosmic styling',
  defaultColors: {
    primary: '#e040fb',
    secondary: '#7c4dff',
    accent: '#ea80fc',
  },
}

export function renderGalaxyNight(config: CertificateConfig, data: CertificateData): string {
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
    }
    
    .certificate {
      color: #ffffff;
      position: relative;
      overflow: hidden;
    }
    
    /* Star field background */
    .stars {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      background-image: 
        radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.8), transparent),
        radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 200px 50px, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 250px 90px, rgba(255,255,255,0.8), transparent),
        radial-gradient(2px 2px at 300px 140px, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 350px 60px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 400px 100px, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 450px 30px, rgba(255,255,255,0.8), transparent),
        radial-gradient(2px 2px at 500px 150px, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 550px 70px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 600px 110px, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 650px 45px, rgba(255,255,255,0.8), transparent),
        radial-gradient(2px 2px at 700px 130px, rgba(255,255,255,0.6), transparent),
        radial-gradient(1px 1px at 750px 85px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 800px 55px, rgba(255,255,255,0.7), transparent),
        radial-gradient(1px 1px at 850px 125px, rgba(255,255,255,0.8), transparent),
        radial-gradient(2px 2px at 900px 95px, rgba(255,255,255,0.5), transparent),
        radial-gradient(1px 1px at 950px 35px, rgba(255,255,255,0.9), transparent),
        radial-gradient(2px 2px at 1000px 75px, rgba(255,255,255,0.6), transparent);
      background-size: 100% 100%;
    }
    
    /* Nebula glow effect */
    .nebula {
      position: absolute;
      top: -50%;
      left: -20%;
      width: 140%;
      height: 200%;
      background: radial-gradient(ellipse at 30% 50%, rgba(124, 77, 255, 0.15) 0%, transparent 50%),
                  radial-gradient(ellipse at 70% 60%, rgba(224, 64, 251, 0.1) 0%, transparent 40%);
      pointer-events: none;
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
      text-shadow: 
        0 0 20px ${colors.primary}80,
        0 0 40px ${colors.primary}50,
        0 0 60px ${colors.primary}30;
      letter-spacing: 8px;
    }
    
    .subtitle {
      color: ${colors.accent};
      text-shadow: 0 0 15px ${colors.accent}60;
      opacity: 0.9;
    }
    
    .presented-to {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .recipient-name {
      font-size: ${nameFontSize}px;
      color: #ffffff;
      text-shadow: 
        0 0 30px ${colors.secondary}80,
        0 0 60px ${colors.secondary}40;
    }
    
    .name-underline {
      background: linear-gradient(90deg, transparent, ${colors.primary}, ${colors.secondary}, ${colors.primary}, transparent);
      height: 2px;
      box-shadow: 0 0 15px ${colors.primary}80;
    }
    
    .description {
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    }
    
    .signatories {
      color: #ffffff;
    }
    
    .signature-line {
      background: linear-gradient(90deg, transparent, ${colors.accent}, transparent);
      box-shadow: 0 0 10px ${colors.accent}50;
    }
    
    .sig-title, .sig-org {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .certificate-id {
      color: rgba(255, 255, 255, 0.4);
    }
    
    /* Decorative corner stars */
    .corner-star {
      position: absolute;
      width: 60px;
      height: 60px;
      opacity: 0.5;
    }
    
    .corner-star::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 20px;
      background: ${colors.accent};
      box-shadow: 0 0 10px ${colors.accent};
    }
    
    .corner-star::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(90deg);
      width: 4px;
      height: 20px;
      background: ${colors.accent};
      box-shadow: 0 0 10px ${colors.accent};
    }
    
    .corner-star.top-left { top: 20px; left: 20px; }
    .corner-star.top-right { top: 20px; right: 20px; }
    .corner-star.bottom-left { bottom: 20px; left: 20px; }
    .corner-star.bottom-right { bottom: 20px; right: 20px; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="stars"></div>
    <div class="nebula"></div>
    <div class="corner-star top-left"></div>
    <div class="corner-star top-right"></div>
    <div class="corner-star bottom-left"></div>
    <div class="corner-star bottom-right"></div>
    
    <div class="content-wrapper">
      <div class="logo-bar">
        ${renderLogos(logos)}
      </div>
      
      <h1 class="title">${titleText}</h1>
      <p class="subtitle">${subtitleText}</p>
      
      <p class="presented-to">This is proudly presented to</p>
      <h2 class="recipient-name">${data.name}</h2>
      <div class="name-underline"></div>
      
      <p class="description">${description}</p>
      
      <div class="signatories">
        ${renderSignatories(signatories)}
      </div>
      
      ${data.certificate_id ? `<div class="certificate-id">ID: ${data.certificate_id}</div>` : ''}
    </div>
  </div>
</body>
</html>`
}
