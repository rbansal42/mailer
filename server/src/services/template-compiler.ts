import DOMPurify from 'isomorphic-dompurify'

// Block structure from frontend
interface BlockInput {
  id: string
  type: string
  props: Record<string, unknown>
}

export interface TrackingOptions {
  openTracking: boolean
  clickTracking: boolean
}

/**
 * Replace all {{key}} placeholders with corresponding data values
 */
export function replaceVariables(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key.toLowerCase()] ?? '')
}

/**
 * Compile a header block to HTML
 */
function compileHeader(props: Record<string, unknown>): string {
  const bgColor = String(props.backgroundColor || '#ffffff')
  const imageUrl = String(props.imageUrl || '')
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="Header" style="max-width: 200px; height: auto;" />`
    : ''

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${bgColor};">
      <tr>
        <td align="center" style="padding: 20px;">
          ${imageHtml}
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile a text block to HTML
 */
function compileText(props: Record<string, unknown>, data: Record<string, string>): string {
  const fontSize = Number(props.fontSize) || 16
  const align = String(props.align || 'left')
  let content = String(props.content || '')
  
  // Replace variables first
  content = replaceVariables(content, data)
  
  // Sanitize HTML
  content = DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'span'],
    ALLOWED_ATTR: ['href', 'style', 'class'],
  })

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding: 10px 20px; font-size: ${fontSize}px; line-height: 1.5; text-align: ${align}; color: #333333; font-family: Arial, sans-serif;">
          ${content}
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile an image block to HTML
 */
function compileImage(props: Record<string, unknown>, data: Record<string, string>): string {
  const width = Number(props.width) || 100
  const align = String(props.align || 'center')
  const alt = replaceVariables(String(props.alt || ''), data)
  const url = replaceVariables(String(props.url || ''), data)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="${align}" style="padding: 10px 20px;">
          <img src="${url}" alt="${alt}" style="max-width: ${width}%; height: auto; display: block;" />
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile a button block to HTML
 */
function compileButton(props: Record<string, unknown>, data: Record<string, string>): string {
  const color = String(props.color || '#0f172a')
  const align = String(props.align || 'center')
  const label = replaceVariables(String(props.label || 'Click Here'), data)
  const url = replaceVariables(String(props.url || '#'), data)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="${align}" style="padding: 20px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background-color: ${color}; border-radius: 4px;">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-family: Arial, sans-serif; color: #ffffff; text-decoration: none; font-weight: bold;">
                  ${label}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile a divider block to HTML
 */
function compileDivider(props: Record<string, unknown>): string {
  const style = String(props.style || 'solid')
  const color = String(props.color || '#e5e7eb')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding: 10px 20px;">
          <hr style="border: none; border-top: 1px ${style} ${color}; margin: 0;" />
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile a spacer block to HTML
 */
function compileSpacer(props: Record<string, unknown>): string {
  const height = Number(props.height) || 20
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="height: ${height}px; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>
    </table>
  `
}

/**
 * Compile a columns block to HTML
 */
function compileColumns(props: Record<string, unknown>): string {
  const count = Number(props.count) || 2
  const columnWidth = Math.floor(100 / count)

  const columns = Array.from({ length: count }, (_, i) => {
    return `
      <td width="${columnWidth}%" valign="top" style="padding: 10px; font-family: Arial, sans-serif; font-size: 14px; color: #333333;">
        Column ${i + 1}
      </td>
    `
  }).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 0 20px;">
      <tr>
        ${columns}
      </tr>
    </table>
  `
}

/**
 * Compile a footer block to HTML
 */
function compileFooter(props: Record<string, unknown>, data: Record<string, string>): string {
  const text = replaceVariables(String(props.text || ''), data)

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5;">
      <tr>
        <td align="center" style="padding: 20px; font-size: 12px; color: #666666; font-family: Arial, sans-serif; line-height: 1.5;">
          ${text}
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile a single block to HTML
 */
function compileBlock(block: BlockInput, data: Record<string, string>): string {
  const { type, props } = block

  switch (type) {
    case 'header':
      return compileHeader(props)
    case 'text':
      return compileText(props, data)
    case 'image':
      return compileImage(props, data)
    case 'button':
      return compileButton(props, data)
    case 'divider':
      return compileDivider(props)
    case 'spacer':
      return compileSpacer(props)
    case 'columns':
      return compileColumns(props)
    case 'footer':
      return compileFooter(props, data)
    default:
      return ''
  }
}

/**
 * Inject tracking pixel and rewrite links for click tracking
 */
export function injectTracking(
  html: string,
  trackingToken: string,
  baseUrl: string,
  options: TrackingOptions
): string {
  let result = html

  // Inject open tracking pixel before </body>
  if (options.openTracking) {
    const pixel = `<img src="${baseUrl}/t/${trackingToken}/open.gif" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
    result = result.replace('</body>', `${pixel}\n</body>`)
  }

  // Rewrite links for click tracking
  if (options.clickTracking) {
    let linkIndex = 0
    result = result.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*)>/gi, (match, before, url, after) => {
      // Skip mailto:, tel:, and # links
      if (url.startsWith('mailto:') || url.startsWith('tel:') || url === '#') {
        return match
      }
      
      // Skip tracking URLs (don't double-track)
      if (url.includes('/t/') && url.includes('/c/')) {
        return match
      }

      const trackingUrl = `${baseUrl}/t/${trackingToken}/c/${linkIndex++}?url=${encodeURIComponent(url)}`
      return `<a ${before}href="${trackingUrl}"${after}>`
    })
  }

  return result
}

/**
 * Compile an array of blocks to a complete HTML email
 */
export function compileTemplate(blocks: BlockInput[], data: Record<string, string>): string {
  const bodyContent = blocks.map((block) => compileBlock(block, data)).join('')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Email</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff;">
          <tr>
            <td>
              ${bodyContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
