// server/src/lib/url-validation.ts
// URL validation to prevent SSRF attacks when loading external images

/**
 * Private/internal IP ranges that should be blocked:
 * - 10.0.0.0/8 (Class A private)
 * - 172.16.0.0/12 (Class B private)  
 * - 192.168.0.0/16 (Class C private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local)
 * - 0.0.0.0/8 (Current network)
 */

const PRIVATE_IP_PATTERNS = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,           // 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
  /^192\.168\.\d{1,3}\.\d{1,3}$/,              // 192.168.x.x
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,          // 127.x.x.x (loopback)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,              // 169.254.x.x (link-local)
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,            // 0.x.x.x
]

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '*.localhost',
  'internal',
  '*.internal',
  'local',
  '*.local',
]

function isPrivateIP(hostname: string): boolean {
  // Check against private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true
    }
  }
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const lowerHostname = hostname.toLowerCase()
  
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (blocked.startsWith('*.')) {
      // Wildcard match
      const suffix = blocked.slice(1) // Remove *
      if (lowerHostname.endsWith(suffix) || lowerHostname === blocked.slice(2)) {
        return true
      }
    } else if (lowerHostname === blocked) {
      return true
    }
  }
  return false
}

export interface UrlValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates a URL to prevent SSRF attacks.
 * 
 * Allows:
 * - http:// and https:// URLs to public hosts
 * - data: URLs (base64-encoded inline images)
 * 
 * Blocks:
 * - file://, ftp://, and other dangerous protocols
 * - Private IP addresses (10.x, 172.16-31.x, 192.168.x, 127.x)
 * - localhost and other internal hostnames
 */
export function validateImageUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' }
  }

  const trimmedUrl = url.trim()

  // Allow data: URLs (base64-encoded images are safe - they're inline)
  if (trimmedUrl.startsWith('data:')) {
    // Validate it's an image data URL
    if (trimmedUrl.startsWith('data:image/')) {
      return { valid: true }
    }
    return { valid: false, error: 'Only image data URLs are allowed' }
  }

  // Parse the URL
  let parsed: URL
  try {
    parsed = new URL(trimmedUrl)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Only allow http and https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { 
      valid: false, 
      error: `Protocol "${parsed.protocol.replace(':', '')}" is not allowed. Only http and https are permitted.` 
    }
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block private IPs
  if (isPrivateIP(hostname)) {
    return { valid: false, error: 'Private IP addresses are not allowed' }
  }

  // Block localhost and internal hostnames
  if (isBlockedHostname(hostname)) {
    return { valid: false, error: 'Internal hostnames are not allowed' }
  }

  // Block IPv6 localhost
  if (hostname === '[::1]' || hostname === '::1') {
    return { valid: false, error: 'Loopback addresses are not allowed' }
  }

  return { valid: true }
}

/**
 * Validates an array of logo objects, checking each URL.
 * Returns the first validation error found, or null if all valid.
 */
export function validateLogoUrls(logos: Array<{ url: string; width?: number }> | undefined): string | null {
  if (!logos || !Array.isArray(logos)) {
    return null // No logos to validate
  }

  for (let i = 0; i < logos.length; i++) {
    const logo = logos[i]
    if (!logo.url) continue
    
    const result = validateImageUrl(logo.url)
    if (!result.valid) {
      return `Logo ${i + 1}: ${result.error}`
    }
  }

  return null
}

/**
 * Validates an array of signatory objects, checking signature URLs.
 * Returns the first validation error found, or null if all valid.
 */
export function validateSignatoryUrls(
  signatories: Array<{ name: string; designation: string; organization?: string; signatureUrl?: string }> | undefined
): string | null {
  if (!signatories || !Array.isArray(signatories)) {
    return null // No signatories to validate
  }

  for (let i = 0; i < signatories.length; i++) {
    const signatory = signatories[i]
    if (!signatory.signatureUrl) continue
    
    const result = validateImageUrl(signatory.signatureUrl)
    if (!result.valid) {
      return `Signatory "${signatory.name}" signature: ${result.error}`
    }
  }

  return null
}
