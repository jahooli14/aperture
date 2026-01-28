/**
 * Consolidated Reading API
 * Handles articles, highlights, RSS feeds, and all reading operations
 * Uses Mozilla Readability for robust article extraction (same as Omnivore)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { marked } from 'marked'
import Parser from 'rss-parser'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { updateItemConnections } from './_lib/connection-logic.js' // New import

const rssParser = new Parser()

// API Keys for third-party extraction services (Strategy B: Orchestrator Pattern)
const DIFFBOT_API_KEY = process.env.DIFFBOT_API_KEY || '' // 10k credits/month free
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY || '' // 1k credits/month free

/**
 * Decode HTML entities in text
 */
function decodeHTMLEntities(text: string): string {
  if (!text) return text
  // Use linkedom's HTML parsing to decode entities
  const { document } = parseHTML(`<div>${text}</div>`) as any
  return document.querySelector('div')?.textContent || text
}

/**
 * Strip HTML tags from a string for excerpts/titles.
 */
function stripHtml(html: string): string {
  if (!html) return ''
  const { document } = parseHTML(`<div>${html}</div>`) as any
  return document.querySelector('div')?.textContent || ''
}

/**
 * Clean extracted HTML to ensure a beautiful reading experience.
 * Removes boilerplate, ads, navigation, and problematic styling.
 */
function cleanHtml(html: string, url: string): string {
  if (!html || typeof html !== 'string') return ''

  let document: any
  try {
    const parsed = parseHTML(html) as any
    document = parsed.document
  } catch (e) {
    console.error('[cleanHtml] Fatal parse error:', e)
    return html
  }

  if (!document) return html

  // Fix for Linkedom handling of HTML fragments (e.g. from Readability)
  // If documentElement is null, linkedom can't access body/head without crashing
  // If the input is just "<div>...</div>", Linkedom might not put it in document.body
  const hasValidDocumentElement = document.documentElement !== null
  const bodyContent = hasValidDocumentElement ? document.body?.innerHTML?.trim() : ''

  if (!hasValidDocumentElement || !document.body || bodyContent.length === 0) {
    // If body is empty but we have content, try wrapping it
    try {
      const wrapped = `<!DOCTYPE html><html><body>${html}</body></html>`
      const parsedWrapped = parseHTML(wrapped) as any
      // Check documentElement first to avoid linkedom crash when accessing body
      if (parsedWrapped.document && parsedWrapped.document.documentElement && parsedWrapped.document.body) {
        document = parsedWrapped.document
      }
    } catch (e) {
      // Fallback to original document if wrapping fails
    }
  }

  // Final safety check - if we still don't have a valid document structure, return original HTML
  if (!document.documentElement || !document.body) {
    return html
  }

  // 1. Remove obvious junk
  const selectorsToRemove = [
    'nav', 'header', 'footer', 'aside', '.sidebar', '.ad', '.ads', '.advertisement',
    '.social', '.share', '.comments', '.newsletter', '.subscribe', '.popup', '.modal',
    '.cookie-banner', '.promo', '.promotion', '.related', '.recommended',
    '.bottom-bar', '.top-bar', '.modal-backdrop', '.overlay', '.loading',
    '[class*="ad-"]', '[class*="ads-"]', '[id*="ad-"]', '[id*="ads-"]',
    '[class*="social-"]', '[class*="share-"]', '[class*="newsletter-"]',
    'iframe', 'script', 'style', 'noscript', 'canvas', 'svg', 'embed', 'object'
  ]

  selectorsToRemove.forEach(selector => {
    document.querySelectorAll(selector).forEach((el: any) => el.remove())
  })

  // 2. Clean up attributes - only keep essential ones
  const allowedAttributes = ['src', 'srcset', 'sizes', 'href', 'alt', 'title', 'class', 'width', 'height', 'loading', 'referrerpolicy']
  document.querySelectorAll('*').forEach((el: any) => {
    const attributes = el.attributes ? Array.from(el.attributes) as any[] : []
    attributes.forEach(attr => {
      if (attr && attr.name && !allowedAttributes.includes(attr.name)) {
        el.removeAttribute(attr.name)
      }
    })

    // Remove empty classes
    if (el.getAttribute('class') === '') {
      el.removeAttribute('class')
    }
  })

  // 3. Normalize link URLs
  const baseURL = new URL(url)
  document.querySelectorAll('a').forEach((el: any) => {
    const href = el.getAttribute('href')
    if (href && !href.startsWith('http') && !href.startsWith('#')) {
      try {
        el.setAttribute('href', new URL(href, baseURL.origin).toString())
      } catch (e) { }
    }
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  })

  // 4. Normalize image URLs
  document.querySelectorAll('img').forEach((el: any) => {
    const src = el.getAttribute('src')
    if (src && !src.startsWith('http')) {
      try {
        el.setAttribute('src', new URL(src, baseURL.origin).toString())
      } catch (e) { }
    }
    // High quality display & privacy protection
    el.setAttribute('loading', 'lazy')
    el.setAttribute('referrerpolicy', 'no-referrer') // Crucial for loading images from other domains
    el.setAttribute('style', 'max-width: 100%; height: auto; border-radius: 0.5rem; margin: 2rem auto; display: block;')
  })

  // 5. Remove empty paragraphs or segments
  document.querySelectorAll('p, div, span').forEach((el: any) => {
    if (el.textContent.trim() === '' && el.children.length === 0) {
      el.remove()
    }
  })

  // Defensive check: Ensure we can safely access the body and its content.
  // In some environments, linkedom's 'body' getter crashes if the document is malformed.
  try {
    if (!document || !document.documentElement || !document.body) {
      console.warn('[cleanHtml] Document or body is missing after parsing. Returning original content.')
      return html
    }
    return document.body.innerHTML
  } catch (e) {
    console.error('[cleanHtml] Crash while accessing document body:', e)
    return html
  }
}

/**
 * Extract article content using Mozilla Readability (same as Omnivore)
 * This is the industry-standard, battle-tested extraction library
 */
async function fetchArticleWithReadability(url: string): Promise<any> {
  console.log('[Readability] Fetching article:', url)

  try {
    // Fetch HTML with timeout (15s - we have 60s total, be patient)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Check for anti-bot protection (DataDome, Cloudflare, etc.)
    if (!response.ok) {
      const server = response.headers.get('server') || ''
      const dataDome = response.headers.get('x-datadome') || ''
      const cfRay = response.headers.get('cf-ray') || ''

      if (response.status === 403 && (dataDome || server.toLowerCase().includes('datadome'))) {
        throw new Error('Site blocked by DataDome anti-bot protection. Try viewing the original article.')
      }

      if (response.status === 403 && cfRay) {
        throw new Error('Site blocked by Cloudflare anti-bot protection. Try viewing the original article.')
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[Readability] HTML fetched, length:', html.length)

    // Parse HTML with linkedom (DOM implementation for Node.js)
    const { document } = parseHTML(html) as any

    // Set base URL for relative links
    const baseURL = new URL(url)
    const base = document.createElement('base')
    base.href = baseURL.origin
    document.head?.appendChild(base)

    // Use Mozilla Readability to extract article content
    // Relaxed settings to match successful debug script
    const reader = new Readability(document, {
      debug: false,
      maxElemsToParse: 50000,
      nbTopCandidates: 5,
      charThreshold: 0, // Accept even short content
      classesToPreserve: ['caption', 'emoji', 'hashtag', 'mention']
    })

    const article = reader.parse()

    if (!article) {
      throw new Error('Readability failed to extract article content')
    }

    console.log('[Readability] Extracted:', article.title)

    // Extract metadata efficiently (limit querySelector scope)
    const head = document.head
    const getMetaContent = (names: string[]) => {
      if (!head) return null
      for (const name of names) {
        const selector = `meta[property="${name}"], meta[name="${name}"]`
        const tag = head.querySelector(selector)
        if (tag) return tag.getAttribute('content')
      }
      return null
    }

    // Extract thumbnail - try multiple sources
    let thumbnailUrl = getMetaContent(['og:image', 'twitter:image', 'og:image:url', 'twitter:image:src'])

    // If no meta tag image, try to extract first image from article content
    if (!thumbnailUrl && article.content) {
      const imgMatch = article.content.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (imgMatch && imgMatch[1]) {
        thumbnailUrl = imgMatch[1]
        // Make relative URLs absolute
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          const baseURL = new URL(url)
          thumbnailUrl = new URL(thumbnailUrl, baseURL.origin).toString()
        }
      }
    }

    // Return in format expected by rest of codebase
    return {
      title: decodeHTMLEntities(article.title || getMetaContent(['og:title', 'twitter:title']) || 'Untitled'),
      content: cleanHtml(article.content || '', url),
      excerpt: stripHtml(article.excerpt || getMetaContent(['og:description', 'description']) || '').substring(0, 300),
      author: article.byline || getMetaContent(['author', 'article:author']) || null,
      source: article.siteName || getMetaContent(['og:site_name']) || extractDomain(url),
      publishedDate: getMetaContent(['article:published_time']),
      thumbnailUrl,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=128`,
      length: article.length || 0
    }
  } catch (error: any) {
    console.error('[Readability] Error:', error.message)
    throw error
  }
}

/**
 * Extract article content using Diffbot Article API
 * Tier 4: Specialized structured data extractor (10k free credits/month)
 * Returns clean JSON (title, author, text, images)
 */
async function fetchArticleWithDiffbot(url: string): Promise<any> {
  if (!DIFFBOT_API_KEY) {
    throw new Error('DIFFBOT_API_KEY not configured')
  }

  console.log('[Diffbot] Fetching article:', url)

  try {
    const diffbotUrl = `https://api.diffbot.com/v3/article?token=${DIFFBOT_API_KEY}&url=${encodeURIComponent(url)}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

    const response = await fetch(diffbotUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Diffbot API returned ${response.status}`)
    }

    const data = await response.json() as any

    if (!data.objects || data.objects.length === 0) {
      throw new Error('Diffbot returned no article data')
    }

    const article = data.objects[0]

    console.log('[Diffbot] Extracted:', article.title)

    return {
      title: decodeHTMLEntities(article.title || 'Untitled'),
      content: cleanHtml(article.html || article.text || '', url),
      excerpt: stripHtml(article.text || article.html || '').substring(0, 300),
      author: article.author || null,
      source: article.siteName || extractDomain(url),
      publishedDate: article.date || null,
      thumbnailUrl: article.images?.[0]?.url || null,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=128`,
      length: article.text?.length || 0
    }
  } catch (error: any) {
    console.error('[Diffbot] Error:', error.message)
    throw error
  }
}

/**
 * Extract article content using ScraperAPI
 * Tier 5: Anti-bot specialist (1k free credits/month)
 * Use ONLY for sites that block all other methods (DataDome, Cloudflare)
 */
async function fetchArticleWithScraperAPI(url: string): Promise<any> {
  if (!SCRAPERAPI_KEY) {
    throw new Error('SCRAPERAPI_KEY not configured')
  }

  console.log('[ScraperAPI] Fetching article (anti-bot bypass):', url)

  try {
    // ScraperAPI proxies the request through rotating residential IPs
    const scraperUrl = `https://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodeURIComponent(url)}&render=true`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout for slow sites

    const response = await fetch(scraperUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`ScraperAPI returned ${response.status}`)
    }

    const html = await response.text()
    console.log('[ScraperAPI] HTML fetched, length:', html.length)

    // Parse with linkedom + Readability
    const { document } = parseHTML(html) as any

    const baseURL = new URL(url)
    const base = document.createElement('base')
    base.href = baseURL.origin
    document.head?.appendChild(base)

    const reader = new Readability(document, {
      debug: false,
      maxElemsToParse: 8000,
      nbTopCandidates: 5,
      charThreshold: 200,
      classesToPreserve: ['caption', 'emoji', 'hashtag', 'mention']
    })

    const article = reader.parse()

    if (!article) {
      throw new Error('ScraperAPI: Readability failed to extract article content')
    }

    console.log('[ScraperAPI] Extracted:', article.title)

    // Extract metadata
    const head = document.head
    const getMetaContent = (names: string[]) => {
      if (!head) return null
      for (const name of names) {
        const tag = head.querySelector(`meta[property="${name}"], meta[name="${name}"]`)
        if (tag) return tag.getAttribute('content')
      }
      return null
    }

    const thumbnailUrl = getMetaContent(['og:image', 'twitter:image']) || null

    return {
      title: decodeHTMLEntities(article.title || 'Untitled'),
      content: cleanHtml(article.content || '', url),
      excerpt: stripHtml(article.excerpt || getMetaContent(['og:description', 'description']) || '').substring(0, 300),
      author: article.byline || getMetaContent(['author']) || null,
      source: article.siteName || extractDomain(url),
      publishedDate: getMetaContent(['article:published_time']),
      thumbnailUrl,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${extractDomain(url)}&sz=128`,
      length: article.length || 0
    }
  } catch (error: any) {
    console.error('[ScraperAPI] Error:', error.message)
    throw error
  }
}

/**
 * Extract tweet content using fxtwitter.com (Fixup Twitter)
 * This is a proxy that renders server-side HTML with rich OpenGraph tags
 * Perfect for scraping without API keys or heavy browsers
 */
async function fetchTweet(url: string): Promise<any> {
  console.log('[fetchTweet] Fetching tweet via fxtwitter:', url)

  try {
    // Convert to fxtwitter URL
    const urlObj = new URL(url)
    // Handle both twitter.com and x.com
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      urlObj.hostname = 'fxtwitter.com'
    } else {
      throw new Error('Not a Twitter/X URL')
    }

    const fxtwitterUrl = urlObj.toString()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    // User-Agent is important - fxtwitter might behave differently for bots
    // We spoof Discordbot to ensure we get the rich embed HTML
    const response = await fetch(fxtwitterUrl, {
      headers: {
        'User-Agent': 'Discordbot/2.0; +https://discordapp.com',
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`fxtwitter returned ${response.status}`)
    }

    const html = await response.text()

    // Parse HTML
    const { document } = parseHTML(html) as any

    // Extract metadata from OpenGraph tags
    const getMeta = (prop: string) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ||
      document.querySelector(`meta[name="${prop}"]`)?.getAttribute('content')

    const title = getMeta('og:title') || 'Tweet'
    const description = getMeta('og:description') || ''
    const image = getMeta('og:image') || getMeta('twitter:image')
    const author = title.split(' on X')[0].split(' on Twitter')[0] // "Name (@handle)" usually

    if (!description && !image) {
      throw new Error('Failed to extract tweet content')
    }

    // Format content as simple HTML
    let content = `<p>${description}</p>`
    if (image) {
      content += `<img src="${image}" alt="Tweet image" />`
    }

    // Add link to original
    content += `<p><a href="${url}">View original tweet</a></p>`

    return {
      title: `Tweet by ${author}`,
      content,
      excerpt: description,
      author,
      source: 'Twitter',
      publishedDate: new Date().toISOString(), // fxtwitter doesn't always give date in meta
      thumbnailUrl: image,
      faviconUrl: 'https://abs.twimg.com/favicons/twitter.2.ico',
      length: description.length
    }

  } catch (error: any) {
    console.error('[fetchTweet] Error:', error.message)
    throw error
  }
}

/**
 * Extract article content with 4-tier Free API Alliance (Strategy B: Orchestrator Pattern)
 * Shifts from CPU-bound (Puppeteer) to I/O-bound (API calls)
 * Stays within Vercel Hobby plan limits: 4 CPU-hours, 250MB bundle, 300s timeout
 *
 * Tier 1: Mozilla Readability (local, fast, 0 cost)
 * Tier 2: Jina Reader API (10M free tokens/month)
 * Tier 3: Diffbot Article API (10k free credits/month)
 * Tier 4: ScraperAPI (1k free credits/month - anti-bot specialist)
 */
async function fetchArticle(url: string) {
  console.log('[fetchArticle] Starting 4-tier orchestrator extraction:', url)

  const errors: string[] = []

  // Tier 0: Special handling for Twitter/X (uses fxtwitter proxy)
  if (url.includes('twitter.com') || url.includes('x.com')) {
    try {
      console.log('[fetchArticle] Tier 0: Twitter/X specialized handler...')
      const result = await fetchTweet(url)
      console.log('[fetchArticle] ✅ Tier 0 succeeded (Twitter)')
      return result
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Tier 0: ${msg}`)
      console.error('[fetchArticle] Tier 0 failed:', msg)
      // Fall through to other tiers (though they likely won't work well for Twitter)
    }
  }

  // Tier 1: Try Mozilla Readability (fastest, works for 80% of sites)
  try {
    console.log('[fetchArticle] Tier 1: Mozilla Readability (local)...')
    const result = await fetchArticleWithReadability(url)

    if (result.content && result.content.length > 100) {
      console.log('[fetchArticle] ✅ Tier 1 succeeded (Readability)')
      return result
    }

    throw new Error('Readability: Insufficient content')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Tier 1: ${msg}`)
    console.error('[fetchArticle] Tier 1 failed:', msg)
  }

  // Tier 2: Try Jina Reader API (handles JS-rendered sites, largest free tier)
  try {
    console.log('[fetchArticle] Tier 2: Jina Reader API...')
    const result = await fetchArticleWithJina(url)

    if (result.content && result.content.length > 300) {
      console.log('[fetchArticle] ✅ Tier 2 succeeded (Jina)')
      return result
    }

    throw new Error('Jina: Insufficient content')
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Tier 2: ${msg}`)
    console.error('[fetchArticle] Tier 2 failed:', msg)
  }

  // Tier 3: Try Diffbot Article API (structured data extractor, high quality)
  if (DIFFBOT_API_KEY) {
    try {
      console.log('[fetchArticle] Tier 3: Diffbot Article API...')
      const result = await fetchArticleWithDiffbot(url)

      if (result.content && result.content.length > 200) {
        console.log('[fetchArticle] ✅ Tier 3 succeeded (Diffbot)')
        return result
      }

      throw new Error('Diffbot: Insufficient content')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Tier 3: ${msg}`)
      console.error('[fetchArticle] Tier 3 failed:', msg)
    }
  } else {
    console.log('[fetchArticle] Tier 3 skipped: DIFFBOT_API_KEY not configured')
  }

  // Tier 4: Try ScraperAPI (anti-bot specialist, last resort - most expensive)
  if (SCRAPERAPI_KEY) {
    try {
      console.log('[fetchArticle] Tier 4: ScraperAPI (anti-bot bypass)...')
      const result = await fetchArticleWithScraperAPI(url)

      if (result.content && result.content.length > 200) {
        console.log('[fetchArticle] ✅ Tier 4 succeeded (ScraperAPI)')
        return result
      }

      throw new Error('ScraperAPI: Insufficient content')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Tier 4: ${msg}`)
      console.error('[fetchArticle] Tier 4 failed:', msg)
    }
  } else {
    console.log('[fetchArticle] Tier 4 skipped: SCRAPERAPI_KEY not configured')
  }

  // All tiers exhausted
  console.error('[fetchArticle] All extraction tiers failed')
  throw new Error(`All extraction methods failed. ${errors.join(' | ')}`)
}

/**
 * Clean markdown content by removing common boilerplate but preserving semantic structure
 * This runs before HTML conversion to keep processing fast
 */
function cleanMarkdownContent(markdown: string): string {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const cleaned: string[] = []

  const removeLinePatterns = [
    // Obvious ad/promo patterns
    /^(subscribe|sign up|get unlimited access|daily digest|homepage feed|posts from)/i,
    // Obvious privacy/legal UI
    /^(privacy policy|terms of service|cookie policy|do not sell|opt out|manage consent|your preference signal)/i,
    // Accessibility and UI controls that are clearly not content
    /^(toggle|expand|collapse|show|hide)/i,
    // Generic e-commerce/product listing UI (usually short lines)
    /^(any price|deals|product name|retailer name)/i,
    /^[☆★]{3,5}$/, // Star ratings
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') {
      cleaned.push('')
      continue
    }

    // Skip problematic patterns
    let skipLine = false
    for (const pattern of removeLinePatterns) {
      if (pattern.test(line)) {
        skipLine = true
        break
      }
    }
    if (skipLine) continue

    cleaned.push(lines[i]) // Keep original indentation
  }

  // Remove excessive whitespace and empty lines
  let result = cleaned.join('\n')
    .replace(/\n{4,}/g, '\n\n\n') // Max 3 newlines
    .replace(/[ \t]{2,}/g, ' ')   // Max 1 space
    .replace(/\n\s+\n/g, '\n\n')  // Clean empty lines with whitespace
    .trim()

  return result
}

/**
 * Extract article content using Jina AI Reader API with retry logic
 * Jina AI provides clean, reader-friendly content
 * Note: Sanitization happens client-side before rendering
 */
async function fetchArticleWithJina(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 1 // Retry up to 1 time (2 attempts total)
  const RETRY_DELAYS = [2000] // Wait 2s before retry
  const TIMEOUT_MS = 12000 // 12 second timeout - reduced to prevent exceeding 50s internal budget

  try {
    const jinaUrl = `https://r.jina.ai/${url}`
    console.log(`[Jina AI] Attempt ${retryCount + 1}/${MAX_RETRIES + 1}: Fetching ${jinaUrl}`)

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    // Read response text first (can only read body once)
    const text = await response.text()

    if (!response.ok) {
      console.error('[Jina AI Error]', response.status, text.substring(0, 500))
      throw new Error(`Jina AI returned ${response.status}: ${text.substring(0, 200)}`)
    }

    // Handle empty responses
    if (!text || text.trim().length === 0) {
      throw new Error('Jina AI returned empty response')
    }

    // Parse JSON
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('[Jina AI] Failed to parse JSON response:', text.substring(0, 500))
      throw new Error('Jina AI returned invalid JSON')
    }

    if (!data || !data.data) {
      throw new Error('Jina AI returned invalid response structure')
    }

    // Extract markdown content from JSON response
    const markdownContent = data.data.content || ''
    const jinaTitle = data.data.title || ''

    console.log('[Jina AI] Received response - Markdown length:', markdownContent.length, 'Jina title:', jinaTitle)

    if (!markdownContent || markdownContent.trim().length === 0) {
      throw new Error('Jina AI returned empty content')
    }

    // Clean markdown content before conversion (remove navigation, UI elements, etc.)
    const cleanedMarkdown = cleanMarkdownContent(markdownContent)
    console.log('[Jina AI] Cleaned markdown - original length:', markdownContent.length, 'cleaned length:', cleanedMarkdown.length)

    // Convert markdown to HTML
    const html = await marked.parse(cleanedMarkdown)

    // Helper function to check if a string is URL-like
    const isUrlLike = (str: string): boolean => {
      // Check for URL schemes
      if (/^https?:\/\//i.test(str)) return true
      // Check for URL-encoded characters
      if (/%[0-9A-F]{2}/i.test(str)) return true
      // Check for common URL patterns (domain with path/query)
      if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(str)) return true
      // Check for URL fragments and query strings
      if (/[?&#]/.test(str) && str.length > 50) return true
      return false
    }

    // Validate HTML content quality before proceeding
    // Remove script, style, and meta tags to check actual content
    let htmlForValidation = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<link[^>]*>/gi, '')

    // Extract text content for validation
    const textForValidation = htmlForValidation
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    console.log('[Jina AI] Validation - HTML length:', html.length, 'Text content length:', textForValidation.length)

    // If the extracted content is mostly empty or just boilerplate, reject it
    if (textForValidation.length < 50) {
      console.error('[Jina AI] Content validation failed - insufficient text content after stripping tags')
      throw new Error('Jina AI returned insufficient text content (possible JavaScript-heavy site)')
    }

    // Extract H1 from HTML content using regex ([\s\S] matches any char including newlines)
    let title = 'Untitled'
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)

    if (h1Match && h1Match[1]) {
      // Strip HTML tags from the H1 content
      const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim()
      console.log('[Jina AI] Found H1 tag, text:', h1Text.substring(0, 100))

      // Use H1 if it's valid and not generic
      if (h1Text.length > 0 && h1Text.length < 200 && !isUrlLike(h1Text) && !h1Text.toLowerCase().includes('homepage')) {
        title = h1Text
        console.log('[Jina AI] Using H1 title from HTML:', title)
      } else {
        console.log('[Jina AI] H1 rejected (length:', h1Text.length, 'isUrl:', isUrlLike(h1Text), 'hasHomepage:', h1Text.toLowerCase().includes('homepage') + ')')
      }
    } else {
      console.log('[Jina AI] No H1 tag found in HTML')
    }

    // Fallback to Jina's title if H1 extraction failed and Jina title is valid
    if (title === 'Untitled' && jinaTitle && jinaTitle.length > 0 && !jinaTitle.toLowerCase().includes('homepage')) {
      title = jinaTitle
      console.log('[Jina AI] Using Jina metadata title:', title)
    }

    // If still using generic title, try to extract from URL
    if (title === 'Untitled' || isUrlLike(title) || title.toLowerCase().includes('homepage')) {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace('www.', '')
        // Try to get a better title from the URL path
        const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0)
        const lastPart = pathParts[pathParts.length - 1]
        if (lastPart && lastPart.length > 3 && lastPart.length < 100) {
          // Clean up the path part (remove extensions, decode URL, replace hyphens/underscores)
          const cleanPart = lastPart
            .replace(/\.(html?|php|aspx?|jsp)$/i, '')
            .replace(/%20/g, ' ')
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
          title = cleanPart
        } else {
          // Fall back to domain name
          title = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
        }
      } catch (e) {
        // Keep existing title if URL parsing fails
        if (title === 'Untitled') {
          title = 'Untitled Article'
        }
      }
    }

    // Extract description/excerpt from metadata
    const description = data.data.description || ''

    // Create excerpt from description or first 200 chars of text content
    // First remove style and script tags and their contents
    let htmlForExcerpt = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    const textContent = htmlForExcerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Always limit excerpt to 100 chars max (2 lines on mobile)
    let excerpt = ''
    if (description && description.length > 0) {
      excerpt = description.substring(0, 100).trim()
      // Add ellipsis if truncated
      if (description.length > 100) {
        excerpt += '...'
      }
    } else if (textContent && textContent.length > 0) {
      excerpt = textContent.substring(0, 100).trim() + '...'
    }

    // Only show incomplete message if text content is genuinely short or missing
    if (!textContent || textContent.length < 200) {
      excerpt = `Content extraction from ${extractDomain(url)} may be incomplete. Click to view the original article.`
    }

    // Remove the H1 from content to avoid duplication (we display title separately)
    // Always remove H1 tags, regardless of whether we used them for the title
    let contentWithoutH1 = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')

    if (contentWithoutH1 !== html) {
      console.log('[Jina AI] Removed H1 tag(s) from content')
    } else {
      console.log('[Jina AI] No H1 tags to remove from content')
    }

    // Additional HTML cleaning to remove ads, navigation, and other junk
    let cleanedContent = contentWithoutH1
      // Remove common ad/navigation patterns
      .replace(/<div[^>]*class="[^"]*ad[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*advertisement[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*navigation[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*footer[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*social[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*share[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*cookie[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*newsletter[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      // Remove common semantic tags for ads/navigation
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      // Remove multiple consecutive line breaks (convert to max 2)
      .replace(/(<br\s*\/?>[\s\n]*){3,}/gi, '<br><br>')
      // Remove empty paragraphs
      .replace(/<p[^>]*>\s*<\/p>/gi, '')
      // Remove paragraphs with only &nbsp;
      .replace(/<p[^>]*>(&nbsp;|\s)+<\/p>/gi, '')

    console.log('[Jina AI] Final extraction - Title:', title, 'Original content length:', contentWithoutH1.length, 'Cleaned content length:', cleanedContent.length)

    // Extract thumbnail - use Jina's image or extract from content
    let thumbnailUrl = data.data.image || null

    // If Jina didn't provide an image, try to extract from content
    if (!thumbnailUrl && cleanedContent) {
      const imgMatch = cleanedContent.match(/<img[^>]+src=["']([^"']+)["']/i)
      if (imgMatch && imgMatch[1]) {
        thumbnailUrl = imgMatch[1]
        // Make relative URLs absolute
        if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
          try {
            const baseURL = new URL(url)
            thumbnailUrl = new URL(thumbnailUrl, baseURL.origin).toString()
          } catch (e) {
            thumbnailUrl = null
          }
        }
      }
    }

    return {
      title: decodeHTMLEntities(title || 'Untitled'),
      content: cleanHtml(cleanedContent || `<p>Unable to extract content. <a href="${url}" target="_blank">View original article</a></p>`, url),
      excerpt: stripHtml(cleanedContent).substring(0, 300),
      author: data.data.author || null,
      publishedDate: data.data.publishedTime || null,
      thumbnailUrl,
      faviconUrl: data.data.favicon || null,
      url
    }
  } catch (error) {
    console.error('[fetchArticleWithJina] Error:', error)

    // Check if error is due to timeout
    const isTimeout = error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch article content'

    // Retry logic - retry both network errors and timeouts for robustness
    // Timeouts can mean either the site is slow OR Jina AI is slow - worth retrying
    const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')
    const shouldRetry = isNetworkError || isTimeout

    if (retryCount < MAX_RETRIES && shouldRetry) {
      const delay = RETRY_DELAYS[retryCount]
      const reason = isTimeout ? 'Timeout' : 'Network error'
      console.log(`[Jina AI] ${reason}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))

      // Retry
      return fetchArticleWithJina(url, retryCount + 1)
    }

    // All retries exhausted
    if (isTimeout) {
      console.log(`[Jina AI] All retries exhausted after timeout (${retryCount + 1} attempts) - site or Jina AI may be slow/blocking`)
    } else if (shouldRetry) {
      console.log(`[Jina AI] All retries exhausted after network error (${retryCount + 1} attempts)`)
    } else {
      console.log(`[Jina AI] Non-retryable error after ${retryCount + 1} attempt(s): ${errorMessage.substring(0, 100)}`)
    }

    // Throw error to trigger next tier fallback
    throw new Error(errorMessage)
  }
}

/**
 * Clean article content (for Jina AI plain text output from RSS)
 * Removes common boilerplate but preserves useful text
 */
function cleanArticleContent(content: string): string {
  if (!content) return ''

  // Split into lines for processing
  let lines = content.split('\n')

  // Patterns to remove (case-insensitive)
  const removePatterns = [
    // Obvious ad/promo patterns
    /^(subscribe|sign up|get updates|stay updated|get our|receive|join our|be the first)/i,
    /^(newsletter|email|enter your email|your email address)/i,
    // Obvious privacy/legal UI
    /^(we use cookies|this (site|website) uses cookies|cookie (notice|policy))/i,
    /^(by (using|continuing)|accept (all )?cookies|manage cookies)/i,
    /^(consent|privacy settings|your privacy|we value your privacy)/i,
    // Advertising and sponsorship
    /^(advertisement|sponsored|partner content|affiliate)/i,
    /^(ad choices|why (am i|this ad)|opt out)/i,
    /^(promoted|featured|special offer)/i,
    // Comments and engagement
    /^(comments?|leave a comment|post a comment|add a comment)/i,
    /^(show comments|hide comments|load more|view replies)/i,
    /^(join the (discussion|conversation)|what do you think)/i,
    // Footer and metadata
    /^(copyright|©|all rights reserved|\(c\))/i,
    /^(powered by|built with|designed by|created by)/i,
    /^(last updated|published|posted|updated on)/i,
    /^(tags?:|categories:|filed under|topics?:)/i,
    // App promotions
    /^(download (our )?app|get (the|our) app|available on|app store)/i,
    /^(open in app|use app|switch to app)/i,
  ]

  // Filter out lines matching removal patterns
  lines = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed === '') return true

    // Remove if matches any pattern
    if (removePatterns.some(pattern => pattern.test(trimmed))) {
      return false
    }

    return true
  })

  // Join lines back together
  let cleaned = lines.join('\n')

  // Remove excessive whitespace
  cleaned = cleaned
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines
    .replace(/[ \t]{2,}/g, ' ')     // Max 1 space
    .replace(/\n\s+\n/g, '\n\n')    // Clean empty lines with whitespace
    .trim()

  return cleaned
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

function estimateReadTime(content: string): number {
  // Strip HTML tags before counting words
  const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = textOnly.split(/\s+/).length
  const minutes = Math.ceil(words / 225)
  return Math.max(1, minutes)
}

function countWords(content: string): number {
  // Strip HTML tags before counting words
  const textOnly = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return textOnly.split(/\s+/).length
}

async function internalHandler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId(req)
  const { resource, id } = req.query

  // HIGHLIGHTS RESOURCE
  if (resource === 'highlights') {
    // POST - Create highlight
    if (req.method === 'POST') {
      try {
        const { article_id, highlight_text, start_position, end_position, color, notes } = req.body

        if (!article_id || !highlight_text) {
          return res.status(400).json({ error: 'article_id and highlight_text required' })
        }

        const highlightData = {
          article_id,
          highlight_text,
          start_position: start_position || null,
          end_position: end_position || null,
          color: color || 'yellow',
          notes: notes || null,
          created_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('article_highlights')
          .insert([highlightData])
          .select()
          .single()

        if (error) throw error

        return res.status(201).json({
          success: true,
          highlight: data
        })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to create highlight' })
      }
    }

    // PATCH - Update highlight
    if (req.method === 'PATCH') {
      try {
        const { id: highlightId, notes, color } = req.body

        if (!highlightId) {
          return res.status(400).json({ error: 'Highlight ID required' })
        }

        const updates: any = {}
        if (notes !== undefined) updates.notes = notes
        if (color !== undefined) updates.color = color

        const { data, error } = await supabase
          .from('article_highlights')
          .update(updates)
          .eq('id', highlightId)
          .select()
          .single()

        if (error) throw error

        return res.status(200).json({
          success: true,
          highlight: data
        })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update highlight' })
      }
    }

    // DELETE - Remove highlight
    if (req.method === 'DELETE') {
      try {
        const highlightId = id

        if (!highlightId || typeof highlightId !== 'string') {
          return res.status(400).json({ error: 'Highlight ID required' })
        }

        const { error } = await supabase
          .from('article_highlights')
          .delete()
          .eq('id', highlightId)

        if (error) throw error

        return res.status(204).send('')
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete highlight' })
      }
    }
  }

  // ARTICLES RESOURCE (default - only if no resource specified)

  // GET - List articles OR get single article
  if (req.method === 'GET' && !resource) {
    // Get single article with highlights
    if (id && typeof id === 'string') {
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

        let query = supabase
          .from('reading_queue')
          .select('*')
          .eq('user_id', userId)

        if (isUUID) {
          query = query.eq('id', id)
        } else {
          // Handle slug/legacy ID passing
          // For now, if it's not a UUID, exact match against URL or return 404
          try {
            const url = new URL(id).toString()
            query = query.eq('url', url)
          } catch {
            // Not a URL, try metadata->>slug just in case
            query = query.filter('metadata->>slug', 'eq', id)
          }
        }

        const { data: article, error: articleError } = await query.maybeSingle()

        if (articleError) throw articleError
        if (!article) {
          return res.status(404).json({ error: 'Article not found' })
        }

        const { data: highlights, error: highlightsError } = await supabase
          .from('article_highlights')
          .select('*')
          .eq('article_id', id)
          .order('created_at', { ascending: true })

        if (highlightsError) throw highlightsError

        if (article.status === 'unread') {
          await supabase
            .from('reading_queue')
            .update({ status: 'reading', read_at: new Date().toISOString() })
            .eq('id', article.id)
            .eq('user_id', userId)

          article.status = 'reading'
          article.read_at = new Date().toISOString()
        }

        return res.status(200).json({
          success: true,
          article,
          highlights: highlights || []
        })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch article' })
      }
    }

    // List articles
    try {
      const { status, limit = 50 } = req.query

      let query = supabase
        .from('reading_queue')
        .select('*') // Select new columns -> Reverted temporarily
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(Number(limit))

      if (status && typeof status === 'string') {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) throw error

      // Calculate rotting status
      const THRESHOLD_DAYS = 20
      const now = new Date()
      const articlesWithRottingStatus = (data || []).map(article => {
        const lastActiveDate = article.last_active_at ? new Date(article.last_active_at) : new Date(article.created_at)
        const inboxEntryDate = article.inbox_entry_at ? new Date(article.inbox_entry_at) : new Date(article.created_at)

        const daysInInbox = Math.floor((now.getTime() - inboxEntryDate.getTime()) / (1000 * 60 * 60 * 24))
        const daysSinceActivity = Math.floor((now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))

        return {
          ...article,
          days_in_inbox: daysInInbox,
          days_since_activity: daysSinceActivity,
          is_rotting: daysSinceActivity >= THRESHOLD_DAYS && article.status === 'unread'
        }
      })

      return res.status(200).json({
        success: true,
        articles: articlesWithRottingStatus || []
      })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch articles' })
    }
  }

  // POST - Save new article (only if no resource specified)
  if (req.method === 'POST' && !resource) {
    try {
      const { url, tags, title, content, excerpt } = req.body

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' })
      }

      try {
        new URL(url)
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' })
      }


      // Check for duplicates
      const { data: existing } = await supabase
        .from('reading_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('url', url)
        .single()

      if (existing) {
        return res.status(200).json({
          success: true,
          article: existing,
          message: 'Article already in reading queue'
        })
      }

      // Save URL immediately
      // If content is provided (e.g. from RSS), mark as processed immediately
      const isPreProcessed = !!content && content.length > 0

      const placeholderArticle = {
        user_id: userId,
        url,
        title: title || url, // Use provided title if available
        author: null,
        content: content ? cleanHtml(content, url) : null, // Clean and normalize content (fix relative URLs, add referrer policy)
        excerpt: excerpt || (isPreProcessed ? 'Content loaded from feed.' : 'Extracting article content...'),
        published_date: null,
        thumbnail_url: null,
        favicon_url: null,
        source: extractDomain(url),
        read_time_minutes: content ? Math.ceil(content.length / 1000) : 0,
        word_count: content ? content.split(/\s+/).length : 0,
        status: 'unread',
        tags: tags || [],
        processed: isPreProcessed, // Mark as processed if we have content
        created_at: new Date().toISOString(),
      }

      const { data: savedArticle, error: insertError } = await supabase
        .from('reading_queue')
        .insert([placeholderArticle])
        .select()
        .single()

      if (insertError) {
        console.error('[reading] Database insert error:', insertError)
        throw new Error(`Database error: ${insertError.message}`)
      }

      console.log(`[reading] Article saved, ID: ${savedArticle.id}, Processed: ${isPreProcessed}`)

      // If already processed (RSS), we are done. Return immediately.
      if (isPreProcessed) {
        // Trigger async embedding generation/connections in background, but don't block response
        generateArticleEmbeddingAndConnect(savedArticle.id, savedArticle.title, savedArticle.excerpt, userId)
          .then(() => console.log(`[reading] ✅ Connections processed for ${savedArticle.id}`))
          .catch(err => console.error('[reading] Async embedding/connection error:', err))

        return res.status(201).json({
          success: true,
          article: savedArticle,
          message: 'Article saved and ready to read!'
        })
      }

      // OTHERWISE: Process article content in background (start promise chain before returning)
      const extractionStartTime = Date.now()
      console.log(`[reading] Starting background extraction for ${savedArticle.id} at ${new Date().toISOString()}`)

      // Wrap extraction in a timeout to catch failures BEFORE Vercel kills us at 60s
      // This ensures .catch() runs and updates article status (prevents zombies)
      const INTERNAL_TIMEOUT_MS = 50000 // 50 seconds - gives 10s buffer before Vercel's 60s limit

      const extractionPromise = fetchArticle(url)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Internal timeout: Extraction took longer than 50s')), INTERNAL_TIMEOUT_MS)
      )

      Promise.race([extractionPromise, timeoutPromise])
        .then(async (article: any) => {
          const extractionTime = Date.now() - extractionStartTime
          console.log(`[reading] Extraction successful in ${extractionTime}ms for ${savedArticle.id}`)

          // Update with extracted content
          const { error: updateError } = await supabase
            .from('reading_queue')
            .update({
              title: article.title,
              author: article.author,
              content: article.content,
              excerpt: article.excerpt,
              published_date: article.publishedDate,
              thumbnail_url: article.thumbnailUrl,
              favicon_url: article.faviconUrl,
              read_time_minutes: estimateReadTime(article.content),
              word_count: countWords(article.content),
              processed: true,
            })
            .eq('id', savedArticle.id)

          if (updateError) {
            console.error(`[reading] Failed to update article ${savedArticle.id}:`, updateError)
          } else {
            console.log(`[reading] ✅ Article extraction complete for ${savedArticle.id} - Title: "${article.title}" (took ${extractionTime}ms)`)
          }

          // Generate embedding and auto-connect (async, run after article is marked processed)
          // This way UI gets updated faster, connections happen in background
          generateArticleEmbeddingAndConnect(savedArticle.id, article.title, article.excerpt, userId)
            .then(() => console.log(`[reading] ✅ Connections processed for ${savedArticle.id}`))
            .catch(err => console.error('[reading] Async embedding/connection error:', err))
        })
        .catch(async (extractError) => {
          const extractionTime = Date.now() - extractionStartTime
          console.error(`[reading] ❌ Extraction failed for ${savedArticle.id} after ${extractionTime}ms:`, extractError.message || extractError)

          // Mark as failed but keep the record with helpful error message
          const errorMessage = extractError instanceof Error ? extractError.message : 'Unknown error'
          let userFriendlyMessage = 'Extraction in progress. '

          // Check for Jina AI domain blocks (451 error) - updated for more clarity to USER
          if (errorMessage.includes('451') || errorMessage.includes('blocked') || errorMessage.includes('SecurityCompromiseError')) {
            // Try to extract the blocked-until timestamp
            const blockedUntilMatch = errorMessage.match(/blocked until ([^)]+)/i)
            if (blockedUntilMatch && blockedUntilMatch[1]) {
              try {
                const blockedUntil = new Date(blockedUntilMatch[1])
                const blockedUntilStr = blockedUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
                userFriendlyMessage = `The extraction service (Jina AI) is restricted from this domain until ${blockedUntilStr} to prevent abuse. Retrying with other methods...`
              } catch {
                userFriendlyMessage = 'The extraction service (Jina AI) is temporarily restricted from this domain. Retrying with other methods...'
              }
            } else {
              userFriendlyMessage = 'The extraction service (Jina AI) is temporarily restricted from this domain. Retrying with other methods...'
            }
          } else if (errorMessage.includes('JavaScript-heavy site')) {
            userFriendlyMessage = 'This site requires JavaScript rendering. Content extraction may be incomplete.'
          } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
            // Backend extraction timed out - client will auto-retry via zombie detection
            userFriendlyMessage = 'Extraction timed out - auto-retry initiated. Page may be slow to load.'
          } else if (errorMessage.includes('All extraction methods failed')) {
            userFriendlyMessage = 'All extraction methods failed. Site may have heavy anti-bot protection or requires login. Try the original article.'
          } else {
            userFriendlyMessage = 'Content extraction failed. You can still view the original URL.'
          }

          // Determine if error is permanent
          // Note: Anti-bot protection is no longer a permanent failure since we now handle it with Puppeteer
          const isPermanentFailure = false // Allow retries for all errors (zombie detection will handle it)

          // Ensure database update always happens - wrap in try/catch
          try {
            const { error: updateError } = await supabase
              .from('reading_queue')
              .update({
                excerpt: userFriendlyMessage,
                processed: true,
              })
              .eq('id', savedArticle.id)

            if (updateError) {
              console.error(`[reading] Failed to update article status after extraction failure:`, updateError)
            } else {
              console.log(`[reading] Article ${savedArticle.id} marked with error status: "${userFriendlyMessage.substring(0, 60)}..."`)
            }
          } catch (dbError) {
            console.error(`[reading] Database update failed critically for ${savedArticle.id}:`, dbError)
            // Article will remain stuck - zombie detection should catch it
          }
        })

      // Return immediately with placeholder (must return to prevent double response at line 874)
      return res.status(201).json({
        success: true,
        article: savedArticle,
        message: 'Article saved! Extracting content in background...'
      })

    } catch (error) {
      return res.status(500).json({
        error: 'Failed to save article',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // PATCH - Update article (only if no resource specified)
  if (req.method === 'PATCH' && !resource) {
    try {
      const { id: articleId, status, tags } = req.body

      if (!articleId) {
        return res.status(400).json({ error: 'Article ID is required' })
      }

      const updates: any = {}

      if (status) {
        updates.status = status

        if (status === 'archived') {
          updates.archived_at = new Date().toISOString()
        } else if (status === 'reading') {
          updates.read_at = new Date().toISOString()
        }
        // updates.last_active_at = new Date().toISOString() // Update last_active_at on status change
      }

      if (tags !== undefined) {
        updates.tags = tags
      }

      // Allow updating other fields
      if (req.body.title !== undefined) updates.title = req.body.title
      if (req.body.excerpt !== undefined) updates.excerpt = req.body.excerpt
      if (req.body.content !== undefined) updates.content = req.body.content
      if (req.body.processed !== undefined) updates.processed = req.body.processed
      if (req.body.thumbnail_url !== undefined) updates.thumbnail_url = req.body.thumbnail_url
      if (req.body.favicon_url !== undefined) updates.favicon_url = req.body.favicon_url

      const { data, error } = await supabase
        .from('reading_queue')
        .update(updates)
        .eq('id', articleId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        article: data
      })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to update article' })
    }
  }

  // ANALYZE RESOURCE - Extract entities/themes from article
  if (resource === 'analyze' && req.method === 'POST') {
    try {
      const articleId = Array.isArray(id) ? id[0] : id
      if (!articleId || typeof articleId !== 'string') {
        return res.status(400).json({ error: 'Article ID required' })
      }

      const { data: article, error: fetchError } = await supabase
        .from('reading_queue')
        .select('*')
        .eq('id', articleId)
        .single()

      if (fetchError || !article) {
        throw new Error('Article not found')
      }

      // Use Gemini to extract entities/themes
      // We use the same model config as memories for consistency
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `Analyze this article and extract key information.

Title: ${article.title}
Content: ${article.content.substring(0, 10000)} // First 10k chars

Extract:
{
  "entities": {
    "people": ["names"],
    "topics": ["specific technologies, concepts, or subjects discussed"],
    "organizations": ["companies, institutions mentioned"],
    "skills": ["user skills or capabilities mentioned in the article if it's about learning/doing something - e.g. 'Python', 'woodworking', 'data analysis']
  },
  "themes": ["high-level themes - max 3"],
  "key_insights": ["2-3 key takeaways"]
}

Return ONLY the JSON, no other text.`

      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const jsonMatch = text.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0])

        // Update article with analysis
        const { error: updateError } = await supabase
          .from('reading_queue')
          .update({
            entities: analysis.entities,
            themes: analysis.themes,
            metadata: {
              ...article.metadata,
              key_insights: analysis.key_insights,
              analyzed_at: new Date().toISOString()
            },
            processed: true
          })
          .eq('id', articleId)

        if (updateError) throw updateError

        // Store skills as capabilities
        if (analysis.entities?.skills && analysis.entities.skills.length > 0) {
          await storeCapabilitiesFromArticle(
            articleId,
            analysis.entities.skills,
            article.title
          ).catch(err => console.error('Background capability storage failed:', err))
        }

        // Also trigger embedding generation if not already done
        if (!article.embedding) {
          // Fire and forget
          generateArticleEmbeddingAndConnect(articleId, article.title, article.excerpt, userId)
            .catch(err => console.error('Background embedding failed:', err))
        }

        return res.status(200).json({ success: true, analysis })
      }

      throw new Error('Failed to generate analysis JSON')

    } catch (error) {
      console.error('[article analyze] Error:', error)
      return res.status(500).json({
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // DELETE - Remove article (only if no resource specified)
  if (req.method === 'DELETE' && !resource) {
    try {
      const articleId = id

      if (!articleId || typeof articleId !== 'string') {
        return res.status(400).json({ error: 'Article ID is required' })
      }

      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('id', articleId)
        .eq('user_id', userId)

      if (error) throw error

      return res.status(204).send('')
    } catch (error) {
      return res.status(500).json({ error: 'Failed to delete article' })
    }
  }

  // RSS FEEDS RESOURCE - Consolidated from api/rss.ts
  if (resource === 'rss' || resource === 'feeds') {
    // Sync RSS feeds (must check action first!)
    if (req.query.action === 'sync' && req.method === 'POST') {
      try {
        const { data: feeds } = await supabase
          .from('rss_feeds')
          .select('*')
          .eq('user_id', userId)
          .eq('enabled', true)

        if (!feeds || feeds.length === 0) {
          return res.status(200).json({ success: true, message: 'No enabled feeds', articlesAdded: 0 })
        }

        let totalArticlesAdded = 0
        for (const feed of feeds) {
          try {
            const feedData = await rssParser.parseURL(feed.feed_url)

            // 1. Process new items
            for (const item of feedData.items.slice(0, 5)) {
              const existing = await supabase.from('reading_queue').select('id').eq('user_id', userId).eq('url', item.link || '').single()
              if (existing.data) continue

              const jinaUrl = `https://r.jina.ai/${item.link}`
              const response = await fetch(jinaUrl, { headers: { 'Accept': 'application/json', 'X-Return-Format': 'json' } })
              let content = item.contentSnippet || item.description || ''

              const text = await response.text()
              if (response.ok && text) {
                try {
                  const result = JSON.parse(text)
                  const rawContent = result.data?.content || result.content || content
                  const cleanedMarkdown = cleanMarkdownContent(rawContent)
                  const parsedHtml = marked.parse(cleanedMarkdown)
                  const htmlString = typeof parsedHtml === 'string' ? parsedHtml : await (parsedHtml as any)
                  content = cleanHtml(htmlString, item.link || '')
                } catch (e) {
                  console.error('[RSS Sync] Failed to parse Jina response for', item.link)
                  // Fallback to basic cleaning if Jina fails
                  content = '' // Reset to trigger fallback below
                }
              } else {
                content = cleanHtml(content, item.link || '')
              }

              // FALLBACK: If Jina failed or returned empty content, use feed content
              if (!content || content.length < 50) {
                const feedContent = item['content:encoded'] || item.content || item.description || item.summary || ''
                if (feedContent) {
                  content = cleanHtml(feedContent, item.link || '')
                }
              }

              await supabase.from('reading_queue').insert([{
                user_id: userId,
                url: item.link || '',
                title: decodeHTMLEntities(item.title || 'Untitled'),
                author: item.creator || item.author || null,
                content: content || '',
                excerpt: stripHtml(content).substring(0, 200),
                published_date: item.pubDate || item.isoDate || null,
                source: new URL(item.link || '').hostname.replace('www.', ''),
                read_time_minutes: Math.ceil(stripHtml(content).split(/\s+/).length / 225),
                word_count: stripHtml(content).split(/\s+/).length,
                status: 'unread',
                tags: ['rss', 'auto-imported'],
                processed: !!content
              }])
              totalArticlesAdded++
            }

            // 2. Cleanup: Only keep latest 5 unread items per feed
            // Items that are 'reading', 'read', or 'archived' are PROTECTED
            const { data: currentUnread } = await supabase
              .from('reading_queue')
              .select('id, created_at')
              .eq('user_id', userId)
              .eq('status', 'unread')
              .contains('tags', ['rss'])
              .eq('source', new URL(feed.feed_url).hostname.replace('www.', ''))
              .order('created_at', { ascending: false })

            if (currentUnread && currentUnread.length > 5) {
              const toDelete = currentUnread.slice(5).map(i => i.id)
              await supabase.from('reading_queue').delete().in('id', toDelete)
              console.log(`[RSS Sync] Purged ${toDelete.length} old unread RSS items for ${feed.title}`)
            }

            await supabase.from('rss_feeds').update({ last_fetched_at: new Date().toISOString() }).eq('id', feed.id)
          } catch (err) {
            console.error(`[RSS Sync] Failed to process feed ${feed.feed_url}:`, err)
          }
        }
        return res.status(200).json({ success: true, feedsSynced: feeds.length, articlesAdded: totalArticlesAdded })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to sync feeds' })
      }
    }

    // Discover RSS feeds
    if (req.query.action === 'discover' && req.method === 'GET') {
      try {
        const { query } = req.query
        if (!query || typeof query !== 'string') {
          return res.status(400).json({ error: 'query required' })
        }

        console.log(`[RSS Discover] Searching for: ${query}`)
        const response = await fetch(`https://cloud.feedly.com/v3/search/feeds?query=${encodeURIComponent(query)}`)

        if (!response.ok) {
          throw new Error(`Feedly search failed with status: ${response.status}`)
        }

        const data = await response.json() as any
        const results = (data.results || []).map((f: any) => ({
          title: f.title,
          description: f.description,
          feed_url: f.feedId.startsWith('feed/') ? f.feedId.substring(5) : f.feedId,
          site_url: f.website,
          favicon_url: f.iconUrl || f.visualUrl,
          subscribers: f.subscribers,
          topics: f.topics || []
        }))

        return res.status(200).json({ success: true, results })
      } catch (error) {
        console.error('[RSS Discover] Error:', error)
        return res.status(500).json({ error: 'Failed to discover feeds' })
      }
    }

    // Fetch RSS feed items (without adding to reading queue)
    if (req.query.action === 'items' && req.method === 'GET') {
      try {
        const { feed_id } = req.query

        if (!feed_id || typeof feed_id !== 'string') {
          return res.status(400).json({ error: 'feed_id required' })
        }

        // Get the feed
        const { data: feed } = await supabase
          .from('rss_feeds')
          .select('*')
          .eq('id', feed_id)
          .eq('user_id', userId)
          .single()

        if (!feed) {
          return res.status(404).json({ error: 'Feed not found' })
        }

        // Fetch RSS feed items
        const feedData = await rssParser.parseURL(feed.feed_url)

        // Return the latest 20 items
        // Simplified parsing: prioritize content:encoded > content > description > summary
        // We apply minimal cleaning here and let the frontend sanitizer do the heavy lifting safely
        const items = feedData.items.slice(0, 20).map((item: any) => {
          const rawContent = item['content:encoded'] || item.content || item.description || item.summary || ''
          const rawDescription = item.contentSnippet || item.description || item.summary || ''

          return {
            guid: item.guid || item.link,
            feed_id: feed.id,
            title: decodeHTMLEntities(item.title || 'Untitled'),
            link: item.link || '',
            // Ensure we have SOMETHING in the content field
            content: rawContent ? cleanHtml(rawContent, item.link || '') : '',
            description: rawDescription ? cleanHtml(rawDescription, item.link || '') : '',
            published_at: item.pubDate || item.isoDate || null,
            author: item.creator || item.author || null
          }
        })

        return res.status(200).json({
          success: true,
          items
        })
      } catch (error) {
        console.error('[RSS Items] Error:', error)
        return res.status(500).json({ error: 'Failed to fetch RSS items' })
      }
    }

    // GET feeds (no action specified)
    if (req.method === 'GET' && !req.query.action) {
      try {
        if (id) {
          const { data, error } = await supabase.from('rss_feeds').select('*').eq('id', id).eq('user_id', userId).single()
          if (error) throw error
          return res.status(data ? 200 : 404).json(data ? { success: true, feed: data } : { error: 'Not found' })
        }
        const { data, error } = await supabase.from('rss_feeds').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json({ success: true, feeds: data || [] })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch feeds' })
      }
    }

    // POST - Subscribe (no action specified)
    if (req.method === 'POST' && !req.query.action) {
      try {
        console.log('[RSS Subscribe] Request body:', JSON.stringify(req.body, null, 2))
        const { feed_url } = req.body
        if (!feed_url) {
          console.log('[RSS Subscribe] Missing feed_url in body:', req.body)
          return res.status(400).json({
            error: 'feed_url required',
            received: req.body,
            details: `Received body keys: ${Object.keys(req.body || {}).join(', ') || 'none'}`
          })
        }

        const { data: existing, error: existingError } = await supabase.from('rss_feeds').select('id').eq('user_id', userId).eq('feed_url', feed_url).single()
        if (existingError && existingError.code !== 'PGRST116') throw existingError
        if (existing) return res.status(200).json({ success: true, feed: existing, message: 'Already subscribed' })

        console.log('[RSS Subscribe] Fetching RSS feed:', feed_url)
        let feedData
        try {
          feedData = await rssParser.parseURL(feed_url)
          console.log('[RSS Subscribe] Feed parsed successfully:', feedData.title)
        } catch (parseError) {
          console.error('[RSS Subscribe] Failed to parse RSS feed:', parseError)
          return res.status(400).json({
            error: 'Failed to parse RSS feed',
            details: parseError instanceof Error ? parseError.message : 'Invalid RSS feed URL or feed is unreachable'
          })
        }

        const { data, error } = await supabase.from('rss_feeds').insert([{
          user_id: userId,
          feed_url,
          title: feedData.title || 'Untitled',
          description: feedData.description || null,
          site_url: feedData.link || null,
          favicon_url: feedData.image?.url || null,
          enabled: true
        }]).select().single()

        if (error) {
          console.error('[RSS Subscribe] Database insert failed:', error)
          throw error
        }

        console.log('[RSS Subscribe] Successfully subscribed to feed:', data.title)

        // Auto-import latest 3 articles immediately (no cron needed!)
        let articlesAdded = 0
        try {
          console.log('[RSS Subscribe] Auto-importing latest articles...')
          for (const item of feedData.items.slice(0, 3)) {
            const existing = await supabase.from('reading_queue').select('id').eq('user_id', userId).eq('url', item.link || '').single()
            if (existing.data) continue

            const jinaUrl = `https://r.jina.ai/${item.link}`
            const response = await fetch(jinaUrl, { headers: { 'Accept': 'application/json', 'X-Return-Format': 'json' } })
            let content = item.contentSnippet || item.description || ''

            const text = await response.text()
            if (response.ok && text) {
              try {
                const result = JSON.parse(text)
                const rawContent = result.data?.content || result.content || content
                const cleanedMarkdown = cleanMarkdownContent(rawContent)
                content = cleanHtml(marked.parse(cleanedMarkdown).toString(), item.link || '')
              } catch (e) {
                console.error('[RSS Subscribe] Failed to parse Jina response for', item.link)
              }
            }

            await supabase.from('reading_queue').insert([{
              user_id: userId,
              url: item.link || '',
              title: decodeHTMLEntities(item.title || 'Untitled'),
              author: item.creator || item.author || null,
              content,
              excerpt: content.substring(0, 200),
              published_date: item.pubDate || item.isoDate || null,
              source: new URL(item.link || '').hostname.replace('www.', ''),
              read_time_minutes: Math.ceil(content.split(/\s+/).length / 225),
              word_count: content.split(/\s+/).length,
              status: 'unread',
              tags: ['rss', 'auto-imported'],
              processed: true
            }])
            articlesAdded++
          }

          await supabase.from('rss_feeds').update({ last_fetched_at: new Date().toISOString() }).eq('id', data.id)
          console.log(`[RSS Subscribe] Auto-imported ${articlesAdded} articles`)
        } catch (importError) {
          console.error('[RSS Subscribe] Auto-import failed:', importError)
          // Don't fail the subscription if import fails
        }

        return res.status(201).json({
          success: true,
          feed: data,
          articlesAdded,
          message: `Subscribed! ${articlesAdded} articles added to your reading queue.`
        })
      } catch (error) {
        console.error('[RSS Subscribe] Unexpected error:', error)
        return res.status(500).json({
          error: 'Failed to subscribe to feed',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // PATCH - Update
    if (req.method === 'PATCH') {
      try {
        const { id: feedId, enabled } = req.body
        if (!feedId) return res.status(400).json({ error: 'Feed ID required' })

        const { data, error } = await supabase.from('rss_feeds').update({ enabled, updated_at: new Date().toISOString() }).eq('id', feedId).eq('user_id', userId).select().single()
        if (error) throw error
        return res.status(200).json({ success: true, feed: data })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to update feed' })
      }
    }

    // DELETE - Unsubscribe
    if (req.method === 'DELETE' && id) {
      try {
        const { error } = await supabase.from('rss_feeds').delete().eq('id', id).eq('user_id', userId)
        if (error) throw error
        return res.status(204).send('')
      } catch (error) {
        return res.status(500).json({ error: 'Failed to delete feed' })
      }
    }
  }

  // IMAGE PROXY RESOURCE - To bypass CORS for offline caching
  if (resource === 'proxy' && req.method === 'GET') {
    try {
      const { url: imageUrl } = req.query
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: 'url required' })
      }

      // Reject blob URLs - they're browser-specific and can't be fetched from server
      if (imageUrl.startsWith('blob:')) {
        console.warn(`[Image Proxy] Rejected blob URL: ${imageUrl}`)
        return res.status(400).json({ error: 'Blob URLs cannot be proxied. They are browser-specific and only exist in client memory.' })
      }

      console.log(`[Image Proxy] Fetching: ${imageUrl}`)
      const imgRes = await fetch(imageUrl)

      if (!imgRes.ok) {
        throw new Error(`Upstream returned ${imgRes.status}`)
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
      const buffer = await imgRes.arrayBuffer()

      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return res.status(200).send(Buffer.from(buffer))

    } catch (error) {
      console.error('[Image Proxy] Failed:', error)
      return res.status(500).json({ error: 'Proxy failed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * Generate embedding for an article and auto-suggest/create connections
 * Runs asynchronously after article content extraction
 */
async function generateArticleEmbeddingAndConnect(
  articleId: string,
  title: string,
  excerpt: string,
  userId: string
) {
  const supabase = getSupabaseClient()

  try {
    console.log(`[reading] Generating embedding for article ${articleId}`)

    // Generate embedding from title + excerpt
    const content = `${title}\n\n${excerpt || ''}`
    const embedding = await generateEmbedding(content)

    // Store embedding in database (note: table is reading_queue, not articles)
    const { error: updateError } = await supabase
      .from('reading_queue')
      .update({ embedding })
      .eq('id', articleId)

    if (updateError) {
      console.error('[reading] Failed to store embedding:', updateError)
      return
    }

    console.log(`[reading] Embedding stored, finding connections...`)
    await updateItemConnections(articleId, 'article', embedding, userId); // Use shared connection logic

  } catch (error) {
    console.error('[reading] Embedding/connection generation failed:', error)
  }
}

/**
 * Store capabilities from article skills
 * Similar to memory processing but for articles
 */
async function storeCapabilitiesFromArticle(
  articleId: string,
  skills: string[],
  articleTitle: string
): Promise<void> {
  if (!skills || skills.length === 0) {
    return
  }

  const supabase = getSupabaseClient()
  console.log(`[reading] Storing ${skills.length} capabilities from article ${articleId}`)

  for (const skillName of skills) {
    try {
      // Check if capability already exists
      const { data: existing } = await supabase
        .from('capabilities')
        .select('id, strength, last_used')
        .eq('name', skillName)
        .maybeSingle()

      if (existing) {
        // Update existing capability: increment strength
        const newStrength = existing.strength + 0.1
        await supabase
          .from('capabilities')
          .update({
            strength: newStrength,
            last_used: new Date().toISOString(),
          })
          .eq('id', existing.id)

        console.log(`[reading] Updated capability '${skillName}' strength: ${existing.strength} → ${newStrength}`)
      } else {
        // Create new capability
        const embedding = await generateEmbedding(skillName)

        await supabase
          .from('capabilities')
          .insert({
            name: skillName,
            description: `User capability: ${skillName}`,
            source_project: 'user',
            code_references: [{ article_id: articleId, article_title: articleTitle }],
            strength: 1.0,
            last_used: new Date().toISOString(),
            embedding,
          })

        console.log(`[reading] Created new capability: ${skillName}`)
      }
    } catch (error) {
      console.error(`[reading] Error storing capability '${skillName}':`, error)
    }
  }
}


// Error handling wrapper
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await internalHandler(req, res)
  } catch (error: any) {
    console.error('[API Error] Unhandled exception:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    })
  }
}
