export const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap');
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    width: 297mm;
    height: 210mm;
    font-family: 'Montserrat', sans-serif;
    overflow: hidden;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .certificate {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 15mm;
  }
  
  .logo-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-bottom: 10mm;
  }
  
  .logo-bar img {
    height: 50px;
    width: auto;
    object-fit: contain;
  }
  
  .title {
    font-family: 'Playfair Display', serif;
    font-size: 48px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 6px;
    text-transform: uppercase;
  }
  
  .subtitle {
    font-size: 20px;
    text-align: center;
    margin-top: 5px;
    letter-spacing: 3px;
    text-transform: uppercase;
  }
  
  .presented-to {
    text-align: center;
    font-size: 14px;
    margin-top: 15mm;
    font-style: italic;
  }
  
  .recipient-name {
    font-family: 'Great Vibes', cursive;
    text-align: center;
    margin: 5mm 0;
    line-height: 1.2;
  }
  
  .name-underline {
    width: 60%;
    max-width: 300px;
    height: 2px;
    margin: 0 auto;
  }
  
  .description {
    text-align: center;
    font-size: 12px;
    line-height: 1.6;
    max-width: 80%;
    margin: 10mm auto;
  }
  
  .signatories {
    display: flex;
    justify-content: center;
    gap: 60px;
    margin-top: auto;
    padding-top: 10mm;
  }
  
  .signatory {
    text-align: center;
    min-width: 150px;
  }
  
  .signature-img {
    height: 40px;
    width: auto;
    margin-bottom: 5px;
  }
  
  .signature-line {
    width: 120px;
    height: 1px;
    background: currentColor;
    margin: 0 auto 8px;
  }
  
  .sig-name {
    font-weight: 600;
    font-size: 12px;
  }
  
  .sig-title {
    font-size: 10px;
    opacity: 0.8;
  }
  
  .sig-org {
    font-size: 9px;
    opacity: 0.7;
  }
  
  .certificate-id {
    position: absolute;
    bottom: 8mm;
    right: 10mm;
    font-size: 8px;
    opacity: 0.5;
  }
`

export const fontImports = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Montserrat:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
`
