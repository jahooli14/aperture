/**
 * Input sanitization utilities to prevent prompt injection and other security issues
 */

/**
 * Sanitize user input before sending to AI models
 * Removes potential prompt injection attempts while preserving legitimate content
 */
export function sanitizeForAI(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  let sanitized = input

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Limit excessive newlines (potential prompt breaking)
  sanitized = sanitized.replace(/\n{5,}/g, '\n\n\n\n')

  // Remove potential system prompt injections
  // Look for patterns like "Ignore previous instructions" or "You are now"
  const suspiciousPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|commands?)/gi,
    /disregard\s+(previous|prior|above)\s+(instructions?|prompts?)/gi,
    /you\s+are\s+now\s+(a|an)\s+/gi,
    /new\s+instructions?:/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
  ]

  // Log suspicious patterns but don't completely block them
  // (they might be legitimate in some contexts)
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      console.warn('[Sanitize] Detected potential prompt injection pattern:', pattern.source)
      // Add a warning prefix but allow the content
      sanitized = `[User Content] ${sanitized}`
      break
    }
  }

  // Trim excessive whitespace
  sanitized = sanitized.trim()

  // Limit total length to prevent token exhaustion attacks
  const MAX_LENGTH = 50000 // ~12,500 tokens
  if (sanitized.length > MAX_LENGTH) {
    console.warn(`[Sanitize] Input truncated from ${sanitized.length} to ${MAX_LENGTH} characters`)
    sanitized = sanitized.substring(0, MAX_LENGTH) + '...[truncated]'
  }

  return sanitized
}

/**
 * Sanitize HTML content to prevent XSS
 * For simple text sanitization only - use DOMPurify for rich HTML
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return ''
  }

  const trimmed = url.trim().toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      console.warn('[Sanitize] Blocked dangerous URL protocol:', protocol)
      return ''
    }
  }

  // Only allow http, https, and relative URLs
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('/')
  ) {
    // Assume it's a relative URL or missing protocol
    return `https://${url}`
  }

  return url.trim()
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }

  const trimmed = email.trim().toLowerCase()

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmed)) {
    return null
  }

  return trimmed
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'untitled'
  }

  // Remove path separators and parent directory references
  let sanitized = filename
    .replace(/[\/\\]/g, '_')
    .replace(/\.\./g, '')
    .replace(/^\./, '')

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '')

  // Trim and ensure not empty
  sanitized = sanitized.trim() || 'untitled'

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop()
    const name = sanitized.substring(0, 240)
    sanitized = ext ? `${name}.${ext}` : name
  }

  return sanitized
}

/**
 * Rate limiting helper for user actions
 */
export class RateLimiter {
  private attempts = new Map<string, number[]>()

  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}

  /**
   * Check if action is allowed for given key (e.g., user ID, IP address)
   * Returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []

    // Remove attempts outside the time window
    const recentAttempts = attempts.filter(
      timestamp => now - timestamp < this.windowMs
    )

    if (recentAttempts.length >= this.maxAttempts) {
      console.warn(`[RateLimiter] Rate limit exceeded for key: ${key}`)
      return false
    }

    // Record this attempt
    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)

    return true
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.attempts.delete(key)
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.attempts.clear()
  }
}
