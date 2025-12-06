/**
 * Share Handler
 * Robust, cross-platform share link handling for Rosette PWA
 *
 * Key Improvements:
 * - Uses localStorage for persistent storage
 * - Supports multiple share sources (web, native)
 * - Improved error handling and logging
 * - Extended data retention
 */

export interface ShareData {
  url: string
  title?: string
  text?: string
  timestamp: number
  source: 'web' | 'native'
  processed: boolean
}

const SHARE_DATA_KEY = 'rosette_share_data'
const MAX_SHARE_AGE = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Utility to validate if a string is a valid HTTP/HTTPS URL
 */
/**
 * Advanced URL validation with comprehensive checks
 */
function isValidUrl(str: string | null): boolean {
  if (!str) return false

  try {
    const url = new URL(str)

    // Strict protocol check
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    // Optional: Additional domain validation
    const validDomainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!validDomainRegex.test(url.hostname)) {
      return false
    }

    // Optional length checks
    return url.toString().length <= 2048
  } catch {
    return false
  }
}

/**
 * Sanitize and validate shared URL with enhanced security
 */
function sanitizeUrl(url: string): string {
  try {
    // Decode URL to handle encoded characters
    const decodedUrl = decodeURIComponent(url.trim())

    // Create URL object
    const cleanUrl = new URL(decodedUrl)

    // Whitelist allowed protocols
    const allowedProtocols = ['http:', 'https:']
    if (!allowedProtocols.includes(cleanUrl.protocol)) {
      throw new Error('Unsupported protocol')
    }

    // Remove tracking and potentially malicious parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'wickedSource', 'wickedid', 'wtrid'
    ]

    const filteredSearchParams = new URLSearchParams()
    for (const [key, value] of cleanUrl.searchParams) {
      if (!trackingParams.includes(key)) {
        filteredSearchParams.append(key, value)
      }
    }

    // Reconstruct URL with filtered parameters
    cleanUrl.search = filteredSearchParams.toString()
    cleanUrl.hash = ''  // Remove hash fragments

    // Additional security: limit URL length
    const maxUrlLength = 2048
    const sanitizedUrl = cleanUrl.toString()
    return sanitizedUrl.length > maxUrlLength
      ? sanitizedUrl.substring(0, maxUrlLength)
      : sanitizedUrl
  } catch (error) {
    console.warn('[ShareHandler] URL sanitization error:', error)
    return '' // Return empty string for invalid URLs
  }
}

/**
 * Initialize share handler - captures share target params
 */
export function initShareHandler() {
  // Performance and environment tracking
  const startTime = performance.now()

  // Only run on client side
  if (typeof window === 'undefined') {
    console.warn('[ShareHandler] Not running on client side')
    return
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const textParam = params.get('text')
    const urlParam = params.get('url')
    const sharedParam = params.get('shared') // Add shared parameter check
    const titleParam = params.get('title')

    // Log EVERYTHING for debugging
    const fullShareLog = {
      textParam,
      urlParam,
      sharedParam,
      titleParam,
      fullSearch: window.location.search,
      fullUrl: window.location.href
    }

    // Write extensive log file for debugging
    const logFileName = `/Users/danielcroome-horgan/Aperture/projects/rosette/logs/share_log_${Date.now()}.json`
    try {
      if (typeof window !== 'undefined') {
        const fs = require('fs')
        fs.writeFileSync(logFileName, JSON.stringify(fullShareLog, null, 2))
        console.log(`[ShareHandler] Extensive log written to ${logFileName}`)
      }
    } catch (logError) {
      console.error('[ShareHandler] Failed to write log file:', logError)
    }

    // Detailed console logging
    console.group('[ShareHandler] Comprehensive Share Detection')
    console.log('Full Share Log:', fullShareLog)
    console.groupEnd()

    // Prioritize URL detection
    let sharedUrl: string | null = null

    // Check in order: shared param, text param, url param
    if (isValidUrl(sharedParam)) {
      sharedUrl = sanitizeUrl(sharedParam)
      console.log('[ShareHandler] URL sourced from shared parameter')
    } else if (isValidUrl(textParam)) {
      sharedUrl = sanitizeUrl(textParam)
      console.log('[ShareHandler] URL sourced from text parameter')
    } else if (isValidUrl(urlParam)) {
      sharedUrl = sanitizeUrl(urlParam)
      console.log('[ShareHandler] URL sourced from URL parameter')
    }

    if (sharedUrl) {
      const shareData: ShareData = {
        url: sharedUrl,
        title: titleParam || undefined,
        text: textParam || sharedParam || undefined,
        timestamp: Date.now(),
        source: sharedParam ? 'native' : 'web',
        processed: false
      }

      try {
        // Store in localStorage for persistent, cross-session storage
        localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))

        // Enhanced logging with performance metrics
        const endTime = performance.now()
        console.group('[ShareHandler] Share Link Stored')
        console.log('Full Share Data:', shareData)
        console.log('Processing Time:', (endTime - startTime).toFixed(2), 'ms')
        console.log('Storage Mechanism: localStorage')
        console.groupEnd()

        // Attempt to trigger custom event for immediate processing
        if (typeof window !== 'undefined') {
          const shareEvent = new CustomEvent('pwa-share', {
            detail: {
              shared: sharedUrl,
              source: shareData.source
            }
          })
          window.dispatchEvent(shareEvent)
          console.log('[ShareHandler] Dispatched custom share event')
        }
      } catch (error) {
        console.error('[ShareHandler] Comprehensive storage error:', error)

        // More aggressive error reporting
        if (typeof window !== 'undefined') {
          const errorReport = {
            error: 'Share Link Storage Failed',
            details: error instanceof Error ? error.message : String(error),
            url: sharedUrl,
            timestamp: new Date().toISOString()
          }

          try {
            // Log to localStorage for later retrieval
            localStorage.setItem('share-error-log', JSON.stringify(errorReport))

            // Send beacon if possible
            if (window.navigator.sendBeacon) {
              const errorBlob = new Blob([JSON.stringify(errorReport)], {type: 'application/json'})
              window.navigator.sendBeacon('/api/share-error', errorBlob)
            }
          } catch (reportError) {
            console.error('[ShareHandler] Failed to log error:', reportError)
          }
        }
      }
    } else {
      console.warn('[ShareHandler] No valid URL found in share parameters', {
        textParam,
        urlParam,
        sharedParam
      })
    }
  } catch (unexpectedError) {
    console.error('[ShareHandler] Catastrophic error during initialization:', unexpectedError)
  }
}

/**
 * Get and consume share data
 * @param markAsProcessed Whether to mark the share data as processed
 */
export function consumeShareData(markAsProcessed = true): ShareData | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(SHARE_DATA_KEY)
  if (!stored) return null

  try {
    const shareData = JSON.parse(stored) as ShareData

    // Check data age (24-hour retention)
    const age = Date.now() - shareData.timestamp
    if (age > MAX_SHARE_AGE) {
      localStorage.removeItem(SHARE_DATA_KEY)
      return null
    }

    // Optionally mark as processed to prevent duplicate handling
    if (markAsProcessed && !shareData.processed) {
      shareData.processed = true
      localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
    }

    return shareData
  } catch (error) {
    console.error('[ShareHandler] Failed to parse share data:', error)
    localStorage.removeItem(SHARE_DATA_KEY)
    return null
  }
}

/**
 * Clear stored share data
 */
export function clearShareData() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SHARE_DATA_KEY)
}

/**
 * Check if we have pending, unprocessed share data
 */
export function hasPendingShareData(): boolean {
  if (typeof window === 'undefined') return false

  const stored = localStorage.getItem(SHARE_DATA_KEY)
  if (!stored) return false

  try {
    const shareData = JSON.parse(stored) as ShareData
    const age = Date.now() - shareData.timestamp
    return age <= MAX_SHARE_AGE && !shareData.processed
  } catch {
    return false
  }
}

/**
 * Add a new share link programmatically
 */
export function addShareLink(url: string, title?: string, text?: string) {
  if (typeof window === 'undefined') return

  const shareData: ShareData = {
    url: sanitizeUrl(url),
    title,
    text,
    timestamp: Date.now(),
    source: 'native', // For links added programmatically
    processed: false
  }

  try {
    localStorage.setItem(SHARE_DATA_KEY, JSON.stringify(shareData))
  } catch (error) {
    console.error('[ShareHandler] Failed to add share link:', error)
  }
}
