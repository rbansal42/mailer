import DOMPurify from 'isomorphic-dompurify'

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char])
}

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
 * Resolve a URL - prepend baseUrl for relative paths
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return url
  // If it's a relative path (starts with /), prepend base URL
  if (url.startsWith('/')) {
    return `${baseUrl}${url}`
  }
  return url
}

/**
 * Compile a header block to HTML
 */
function compileHeader(props: Record<string, unknown>, baseUrl: string): string {
  const bgColor = String(props.backgroundColor || '#ffffff')
  const imageUrl = resolveUrl(String(props.imageUrl || ''), baseUrl)
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
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'span', 'mark'],
    ALLOWED_ATTR: ['href', 'style', 'class'],
  })

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="text-block">
      <tr>
        <td class="text-block" style="padding: 10px 20px; font-size: ${fontSize}px; line-height: 1.5; text-align: ${align}; color: #333333; font-family: Arial, sans-serif;">
          ${content}
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile an image block to HTML
 */
function compileImage(props: Record<string, unknown>, data: Record<string, string>, baseUrl: string): string {
  const width = Number(props.width) || 100
  const align = String(props.align || 'center')
  const alt = replaceVariables(String(props.alt || ''), data)
  const url = resolveUrl(replaceVariables(String(props.url || ''), data), baseUrl)

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
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="divider-block">
      <tr>
        <td style="padding: 10px 20px;">
          <hr class="divider-block" style="border: none; border-top: 1px ${style} ${color}; margin: 0;" />
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
    <table width="100%" cellpadding="0" cellspacing="0" border="0" class="footer-block" style="background-color: #f5f5f5;">
      <tr>
        <td class="footer-block" align="center" style="padding: 20px; font-size: 12px; color: #666666; font-family: Arial, sans-serif; line-height: 1.5;">
          ${text}
        </td>
      </tr>
    </table>
  `
}

/**
 * Compile an action button block to HTML
 * The {{action_url}} placeholder will be replaced by injectTracking with the tracking URL
 */
function compileActionButton(props: Record<string, unknown>): string {
  const align = String(props.align || 'center')
  const color = String(props.color || '#10b981')
  const label = escapeHtml(String(props.label || 'Click Here'))

  return `
    <div style="text-align: ${align}; padding: 16px;">
      <a href="{{action_url}}" 
         data-action-button="true"
         style="display: inline-block; padding: 14px 28px; background-color: ${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        ${label}
      </a>
    </div>
  `
}

/**
 * Compile a single block to HTML
 */
function compileBlock(block: BlockInput, data: Record<string, string>, baseUrl: string): string {
  const { type, props } = block

  switch (type) {
    case 'header':
      return compileHeader(props, baseUrl)
    case 'text':
      return compileText(props, data)
    case 'image':
      return compileImage(props, data, baseUrl)
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
    case 'action-button':
      return compileActionButton(props)
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

  // Handle action buttons - replace placeholder URLs with tracking URLs
  const actionButtonRegex = /href="(#action-button|{{action_url}})"/gi
  result = result.replace(actionButtonRegex, () => {
    return `href="${baseUrl}/t/${trackingToken}/action"`
  })

  // Also handle action-button blocks rendered as links with data attribute
  const actionAttrRegex = /data-action-button="true"[^>]*href="[^"]*"/gi
  result = result.replace(actionAttrRegex, (match) => {
    return match.replace(/href="[^"]*"/, `href="${baseUrl}/t/${trackingToken}/action"`)
  })

  return result
}

/**
 * Compile an array of blocks to a complete HTML email
 * @param baseUrl - Base URL for resolving relative media paths (e.g., https://mailer.example.com)
 */
export function compileTemplate(blocks: BlockInput[], data: Record<string, string>, baseUrl: string = ''): string {
  const bodyContent = blocks.map((block) => compileBlock(block, data, baseUrl)).join('')

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
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
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body, .email-body {
        background-color: #1a1a1a !important;
      }
      .email-wrapper {
        background-color: #2d2d2d !important;
      }
      .email-content {
        background-color: #2d2d2d !important;
        color: #e5e5e5 !important;
      }
      h1, h2, h3, h4, h5, h6 {
        color: #ffffff !important;
      }
      p, span, div, td {
        color: #e5e5e5 !important;
      }
      .text-block {
        color: #e5e5e5 !important;
      }
      .text-block a {
        color: #60a5fa !important;
      }
      .footer-block {
        color: #888888 !important;
      }
      .divider-block {
        border-color: #444444 !important;
      }
    }
    /* Additional dark mode utilities for Outlook */
    [data-ogsc] .email-content,
    [data-ogsc] .email-wrapper {
      background-color: #2d2d2d !important;
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" class="email-wrapper" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" class="container email-content" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff;">
          <tr>
            <td class="email-content">
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
