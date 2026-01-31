import puppeteer, { Browser } from 'puppeteer'
import { randomBytes } from 'crypto'
import { logger } from '../lib/logger'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browser
}

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    // A4 landscape at 300 DPI
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

// Auto-scaling font size calculation
export function calculateFontSize(
  text: string,
  maxWidth: number,
  baseFontSize: number,
  minFontSize: number
): number {
  // Approximate character width ratio for script fonts
  const avgCharWidth = baseFontSize * 0.5
  const estimatedWidth = text.length * avgCharWidth
  
  if (estimatedWidth <= maxWidth) return baseFontSize
  
  const scaleFactor = maxWidth / estimatedWidth
  return Math.max(Math.floor(baseFontSize * scaleFactor), minFontSize)
}

// Generate unique certificate ID using cryptographically secure random bytes
export function generateCertificateId(): string {
  const year = new Date().getFullYear()
  const random = randomBytes(6).toString('hex').toUpperCase()
  return `CERT-${year}-${random}`
}
