/**
 * Consolidated Reading API
 * Handles articles, highlights, RSS feeds, and all reading operations
 * Uses Mozilla Readability for robust article extraction (same as Omnivore)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase'
import { getUserId } from './lib/auth'
import { marked } from 'marked'
import Parser from 'rss-parser'
import { generateEmbedding, cosineSimilarity } from './lib/gemini-embeddings'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

const rssParser = new Parser()

// API Keys for third-party extraction services (Strategy B: Orchestrator Pattern)
const DIFFBOT_API_KEY = process.env.DIFFBOT_API_KEY || '' // 10k credits/month free
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY || '' // 1k credits/month free

/**
 * Decode HTML entities in text
 * Converts &rsquo; to ', &mdash; to —, &amp; to &, etc.
 */
function decodeHTMLEntities(text: string): string {
  if (!text) return text

  // Use linkedom's HTML parsing to decode entities
  const { document } = parseHTML(`<div>${text}</div>`)
  return document.querySelector('div')?.textContent || text
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    const { document } = parseHTML(html)

    // Set base URL for relative links
    const baseURL = new URL(url)
    const base = document.createElement('base')
    base.href = baseURL.origin
    document.head?.appendChild(base)

    // Use Mozilla Readability to extract article content
    // Settings based on Omnivore's production config
    const reader = new Readability(document, {
      debug: false,
      maxElemsToParse: 8000, // Limit to prevent hanging on huge pages
      nbTopCandidates: 5,
      charThreshold: 500,
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
      content: article.content || '',
      excerpt: article.excerpt || getMetaContent(['og:description', 'description']) || '',
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

    const data = await response.json()

    if (!data.objects || data.objects.length === 0) {
      throw new Error('Diffbot returned no article data')
    }

    const article = data.objects[0]

    console.log('[Diffbot] Extracted:', article.title)

    return {
      title: decodeHTMLEntities(article.title || 'Untitled'),
      content: article.html || article.text || '',
      excerpt: article.text?.substring(0, 200) + '...' || '',
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
    const { document } = parseHTML(html)

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
      content: article.content || '',
      excerpt: article.excerpt || getMetaContent(['og:description', 'description']) || '',
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
    const { document } = parseHTML(html)

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

    if (result.content && result.content.length > 300) {
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
 * Clean markdown content by removing navigation, UI elements, and boilerplate
 * This runs before HTML conversion to keep processing fast
 */
function cleanMarkdownContent(markdown: string): string {
  const lines = markdown.split('\n')
  const cleaned: string[] = []
  let inNavigationBlock = false
  let navigationLinkCount = 0
  let consecutiveLinks = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : ''

    // Skip empty lines at the start
    if (cleaned.length === 0 && line === '') continue

    // Detect navigation blocks (many links in a row)
    const isLink = /^\*\s+\[/.test(line) || /^\-\s+\[/.test(line) || /^\d+\.\s+\[/.test(line)

    if (isLink) {
      consecutiveLinks++
      // If we see 4+ consecutive links, it's likely navigation
      if (consecutiveLinks >= 4) {
        inNavigationBlock = true
        navigationLinkCount++
        continue
      }
    } else {
      // End of navigation block detection
      if (inNavigationBlock && consecutiveLinks >= 4) {
        // Skip the navigation
        inNavigationBlock = false
        consecutiveLinks = 0
        continue
      }
      consecutiveLinks = 0
    }

    // Skip common UI patterns (case-insensitive matching)
    const lowerLine = line.toLowerCase()

    // Skip subscription/auth prompts
    if (
      lowerLine.startsWith('subscribe') ||
      lowerLine.startsWith('sign in') ||
      lowerLine.startsWith('sign up') ||
      lowerLine === 'already have an account?' ||
      /^by subscribing,? i agree/i.test(line) ||
      /^over \d+[\d,]* subscribers?$/i.test(line) ||
      /^discover more from/i.test(line) ||
      /^continue reading with/i.test(line) ||
      /^get unlimited access/i.test(line) ||
      lowerLine.includes('daily digest') ||
      lowerLine.includes('homepage feed') ||
      lowerLine.includes('posts from')
    ) {
      continue
    }

    // Skip audio/video player UI
    if (
      lowerLine.includes('audio playback') ||
      lowerLine.includes('please upgrade') ||
      /^\d+:\d+$/.test(line) || // Timestamps like "0:00"
      lowerLine === 'article voiceover'
    ) {
      continue
    }

    // Skip share/social buttons and follow prompts
    if (
      lowerLine === 'share' ||
      lowerLine === 'follow' ||
      lowerLine === 'comments' ||
      lowerLine.startsWith('share this') ||
      /^(like|comment|restack|share|follow|comments drawer)$/i.test(line) ||
      /^posts from this (author|topic)/i.test(line) ||
      lowerLine.includes('will be added to your') ||
      lowerLine.includes('navigation drawer')
    ) {
      continue
    }

    // Skip privacy/legal UI
    if (
      /^©\s*\d{4}/.test(line) ||
      lowerLine.includes('all rights reserved') ||
      lowerLine.includes('privacy policy') ||
      lowerLine.includes('terms of service') ||
      lowerLine.includes('cookie policy') ||
      lowerLine.includes('privacy center') ||
      lowerLine.includes('do not sell') ||
      lowerLine.includes('opt out') ||
      lowerLine.includes('manage consent') ||
      lowerLine.includes('your preference signal')
    ) {
      continue
    }

    // Skip "Most Popular" / "More in" / "Top Stories" sections
    if (
      lowerLine === 'most popular' ||
      lowerLine === 'more in' ||
      lowerLine === 'top stories' ||
      lowerLine === 'related' ||
      lowerLine === 'trending' ||
      lowerLine.startsWith('more from')
    ) {
      continue
    }

    // Skip image labels without content
    if (/^image \d+:?$/i.test(line)) {
      continue
    }

    // Skip menu/navigation headers
    if (
      lowerLine === 'menu' ||
      lowerLine === 'navigation' ||
      lowerLine === 'close' ||
      lowerLine === '[menu]' ||
      /^\[menu\]\(#\)$/i.test(line) ||
      lowerLine === 'search'
    ) {
      continue
    }

    // Skip category/section labels that are just single words
    if (
      /^(tech|reviews|science|entertainment|cars|videos|podcasts|newsletters)$/i.test(line) ||
      /^(column|entertainment|music)$/i.test(line)
    ) {
      continue
    }

    // Skip action buttons and navigation
    if (
      /^(apply|cancel|confirm|clear|allow all)$/i.test(line) ||
      /^(back to|view vendor|checkbox label|switch label)$/i.test(line) ||
      /^(arrow|filters?|category|brand|processor|showing \d+ of)$/i.test(line) ||
      /^arrow$/i.test(line) ||
      /^filters?[☰✕✖✗]/i.test(line) ||
      /^sort\s*by/i.test(line)
    ) {
      continue
    }

    // Skip e-commerce/product listing UI
    if (
      /^(any price|deals|price \(|product name \(|retailer name \()/i.test(line) ||
      /^showing \d+ of \d+/i.test(line) ||
      /^\d+\s*(gb|tb|inch|hz|ghz|gb ram)\b/i.test(line) ||
      /^\(\d+[.\d]*-inch/i.test(line) ||
      /^\(.*?(gb|tb|oled|ssd|ram).*?\)$/i.test(line) ||
      /^[\$€£¥]\d+[,\d]*(\.\d{2})?$/i.test(line)
    ) {
      continue
    }

    // Skip review ratings and numbers
    if (
      /^[☆★]{3,5}$/i.test(line) ||
      /^our review$/i.test(line) ||
      /^\d+$/.test(line)  // Standalone numbers (product list indexes)
    ) {
      continue
    }

    // Skip author bio lines (long descriptive sentences about people)
    if (
      line.length > 100 &&
      (/\b(editor|journalist|author|writer|contributor|reporter)\b/i.test(line) &&
        /\b(is an?|has been|known for)\b/i.test(line))
    ) {
      continue
    }

    // Skip domain names and read time indicators
    if (
      /^\w+\.(com|net|org|io|co|ai)$/i.test(line) ||
      /^\d+\s+min$/i.test(line)
    ) {
      continue
    }

    // Skip "Latest Articles" sections
    if (/^latest articles?$/i.test(line)) {
      continue
    }

    // Skip image credits
    if (/^\(image credit:/i.test(line)) {
      continue
    }

    // Skip separators that are too long (likely decorative)
    if (/^[=\-_*]{10,}$/.test(line)) {
      continue
    }

    // If we're past the navigation and see actual content, keep it
    cleaned.push(lines[i]) // Keep original indentation
  }

  // Remove leading/trailing empty lines
  while (cleaned.length > 0 && cleaned[0].trim() === '') {
    cleaned.shift()
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') {
    cleaned.pop()
  }

  // Join and do final inline cleanup for concatenated patterns
  let result = cleaned.join('\n')

  // Remove inline e-commerce patterns that might be concatenated
  const inlinePatterns = [
    /Filters?[☰✕✖✗]/gi,
    /SORT\s*BY.{0,15}?(low to high|high to low|A to Z|Z to A)/gi,  // Sort options
    /Price \((low to high|high to low)\)/gi,
    /Product Name \([AZ]+ to [AZ]+\)/gi,
    /Retailer name \([AZ]+ to [AZ]+\)/gi,
    /\(Image credit:[^)]{0,100}\)/gi,  // Limited to prevent backtracking
    /Our Review\s*[☆★]{3,5}/gi
  ]

  inlinePatterns.forEach(pattern => {
    result = result.replace(pattern, '')
  })

  // Clean up any resulting double spaces or empty lines
  result = result
    .replace(/  +/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return result
}

/**
 * Extract article content using Jina AI Reader API with retry logic
 * Jina AI provides clean, reader-friendly content
 * Note: Sanitization happens client-side before rendering
 */
async function fetchArticleWithJina(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 0 // No retries in Jina tier - fail fast to Cheerio
  const RETRY_DELAYS = [] // No retries
  const TIMEOUT_MS = 15000 // 15 second timeout - we have 60s total budget

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
    let cleanHtml = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    const textContent = cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

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
      content: cleanedContent || `<p>Unable to extract content. <a href="${url}" target="_blank">View original article</a></p>`,
      excerpt,
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
      console.log(`[Jina AI] ${reason}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))

      // Retry
      return fetchArticleWithJina(url, retryCount + 1)
    }

    // All retries exhausted
    if (isTimeout) {
      console.log(`[Jina AI] All retries exhausted after timeout - site or Jina AI may be slow/blocking`)
    }

    // Throw error to trigger Cheerio fallback
    throw new Error(errorMessage)
  }
}

/**
 * Clean article content (for Jina AI plain text output)
 * Removes navigation, footers, ads, cookie notices, UI elements, etc.
 */
function cleanArticleContent(content: string): string {
  if (!content) return ''

  // Split into lines for processing
  let lines = content.split('\n')

  // Patterns to remove (case-insensitive)
  const removePatterns = [
    // Navigation and UI elements
    /^(skip to|jump to|go to|navigate to|menu|navigation|breadcrumb)/i,
    /^(search|sign in|log in|subscribe|register|create account|my account)/i,
    /^(home|about|contact|privacy|terms|cookies?|legal|help|support)/i,
    /^(view all|see all|show all|browse|explore)/i,
    /^(back to|return to|previous|next page)/i,
    /^(arrow|filters?|sort by|showing \d+)/i,

    // Social media and sharing
    /^(share|share on|follow us|connect with|like us|follow|tweet|pin)/i,
    /^(facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|reddit)/i,
    /^(social media|social|connect|join us)/i,
    /^follow\s+.+\s+to get\b/i,

    // Newsletter and subscription
    /^(newsletter|email|subscribe|sign up|get updates|stay updated)/i,
    /^(get our|receive|join our|be the first)/i,
    /^(enter your email|your email address)/i,

    // Cookie notices and consent
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

    // Related content and CTAs
    /^(related:?|you may also|you might like|recommended|more from)/i,
    /^(read (more|next)|continue reading|keep reading)/i,
    /^(check out|discover|explore more|learn more)/i,
    /^(popular|trending|latest|recent articles?)/i,
    /^latest articles?$/i,

    // Footer and metadata
    /^(copyright|©|all rights reserved|\(c\))/i,
    /^(powered by|built with|designed by|created by)/i,
    /^(last updated|published|posted|updated on)/i,
    /^(tags?:|categories:|filed under|topics?:)/i,

    // App promotions
    /^(download (our )?app|get (the|our) app|available on|app store)/i,
    /^(open in app|use app|switch to app)/i,

    // Accessibility and UI controls
    /^(toggle|expand|collapse|show|hide|more|less)/i,
    /^(loading|please wait|redirecting)/i,

    // Product/e-commerce patterns
    /^(category|brand|processor|ram|storage size|screen size|colou?r|condition|price)/i,
    /^(any price|our review|deals|showing \d+ of \d+)/i,
    /^(compare prices?|buy now|add to cart|in stock)/i,
    /^filters?[☰✕✖✗]/i,  // Filter buttons with icons
    /^sort\s*by/i,  // Sort options
    /^\d+\s*(gb|tb|inch|hz|ghz|gb ram)\b/i,  // Technical specs
    /^[☆★]{3,5}$/,  // Star ratings
    /^\(\d+(\.\d+)?-inch\s+\d+gb\)/i,  // Product specs like "(13.3-inch 64GB)"
    /^\(.*?(gb|tb|oled|ssd|ram).*?\)$/i,  // Product specs in parentheses
    /^[\$€£¥]\d+[,\d]*(\.\d{2})?$/,  // Standalone prices like "$799" or "€1,299"

    // Author bio indicators
    /^.{0,50}\b(editor|journalist|author|writer|contributor|reporter)\b/i,
    /\b(is an? (award-winning|celebrated|bestselling|leading|certified))\b/i,
    /\b(earned (a|her|his|their) (loyal|readership))\b/i,
    /\blives in\b.*$/i,  // Common bio ending
    /\b(mom|dad|parent) of \d+\b/i,  // Personal bio details

    // List/link dumps (common pattern: just a link text with no context)
    /^[\[\(]?https?:\/\//i,  // Lines starting with URLs
    /^(source|via|link|url):/i,

    // Website domain names (often appear at start of articles)
    /^\w+\.(com|net|org|io|co|ai)$/i,
    /^\d+\s+min$/i,  // Read time estimates like "6 min"

    // Short non-content lines (likely UI elements)
    /^[\w\s]{1,3}$/,  // 1-3 character lines (buttons like "OK", "Yes", etc)
    /^\d+$/,  // Lines with just numbers
  ]

  // Track if we're in an author bio section
  let inAuthorBio = false
  let bioStartIndex = -1

  // First pass: identify and mark author bio sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Start of author bio detection
    if (!inAuthorBio && (
      /\b(editor|journalist|author|writer|contributor)\b/i.test(line) &&
      /\b(is an?|has been)\b/i.test(line) &&
      line.length > 100  // Bio lines tend to be long
    )) {
      inAuthorBio = true
      bioStartIndex = i
    }

    // End of author bio (usually after 3-5 lines or hitting next section)
    if (inAuthorBio && (
      i - bioStartIndex > 5 ||
      /^#{1,3}\s/.test(line) ||  // Markdown heading
      (line.length > 0 && !line.match(/\b(she|he|they|her|his|their)\b/i) && line.match(/^[A-Z]/))
    )) {
      inAuthorBio = false
    }

    // Mark bio lines for removal
    if (inAuthorBio) {
      lines[i] = '__REMOVE_BIO__'
    }
  }

  // Filter out lines matching removal patterns
  lines = lines.filter((line, index) => {
    const trimmed = line.trim()

    // Remove marked bio lines
    if (line === '__REMOVE_BIO__') return false

    // Keep empty lines for paragraph breaks
    if (trimmed === '') return true

    // Remove if matches any pattern
    if (removePatterns.some(pattern => pattern.test(trimmed))) {
      return false
    }

    // Remove lines that are just markdown links without context
    // Pattern: [text](url) with nothing else
    if (/^\[.+?\]\(.+?\)$/.test(trimmed) && trimmed.length < 100) {
      return false
    }

    // Remove lines that are just image references
    if (/^!\[.*?\]\(.*?\)$/.test(trimmed)) {
      return false
    }

    // Remove image credit lines
    if (/^\(image credit:/i.test(trimmed)) {
      return false
    }

    // Keep lines that seem like content (have punctuation, reasonable length)
    return true
  })

  // Join lines back together
  let cleaned = lines.join('\n')

  // Remove common inline phrases that sneak through
  const phrasePatterns = [
    /\b(click here|tap here|read more|learn more|find out more)\b/gi,
    /\b(subscribe to|sign up for|get notified|stay informed)\b/gi,
    /\b(cookie policy|privacy policy|terms of service|terms and conditions)\b/gi,
    /\b(view (all|more)|see (all|more)|show (all|more))\b/gi,
    /\b(download (the |our )?app|get (the |our )?app)\b/gi,
    /\[\d+\]/g,  // Remove citation numbers like [1], [2], etc.
    /\(Image credit:.*?\)/gi,  // Remove image credits
    /Our Review\s*[☆★]{3,5}/gi,  // Remove review ratings
  ]

  phrasePatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })

  // Remove excessive whitespace
  cleaned = cleaned
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines
    .replace(/[ \t]{2,}/g, ' ')     // Max 1 space
    .replace(/\n\s+\n/g, '\n\n')    // Clean empty lines with whitespace
    .trim()

  // Final pass: remove any remaining single-word lines that are likely UI elements
  lines = cleaned.split('\n')
  lines = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed === '') return true

    // Keep lines with multiple words or punctuation (likely real content)
    const wordCount = trimmed.split(/\s+/).length
    const hasPunctuation = /[.!?,;:]/.test(trimmed)

    return wordCount > 2 || hasPunctuation
  })

  return lines.join('\n').trim()
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = await getUserId(req)
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
        const { data: article, error: articleError } = await supabase
          .from('reading_queue')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single()

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
            .eq('id', id)
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
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(Number(limit))

      if (status && typeof status === 'string') {
        query = query.eq('status', status)
      }

      const { data, error } = await query

      if (error) throw error

      return res.status(200).json({
        success: true,
        articles: data || []
      })
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch articles' })
    }
  }

  // POST - Save new article (only if no resource specified)
  if (req.method === 'POST' && !resource) {
    try {
      const { url, tags } = req.body

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

      // Save URL immediately with placeholder - extraction happens in background
      const placeholderArticle = {
        user_id: userId,
        url,
        title: url, // Use URL as temporary title
        author: null,
        content: null, // Will be filled by background processing
        excerpt: 'Extracting article content...',
        published_date: null,
        thumbnail_url: null,
        favicon_url: null,
        source: extractDomain(url),
        read_time_minutes: 0,
        word_count: 0,
        status: 'unread',
        tags: tags || [],
        processed: false, // Mark as unprocessed
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

      console.log(`[reading] Article placeholder saved, ID: ${savedArticle.id}`)

      // Process article content in background (start promise chain before returning)
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

          // Check for Jina AI domain blocks (451 error)
          if (errorMessage.includes('451') || errorMessage.includes('blocked') || errorMessage.includes('SecurityCompromiseError')) {
            // Try to extract the blocked-until timestamp
            const blockedUntilMatch = errorMessage.match(/blocked until ([^)]+)/i)
            if (blockedUntilMatch && blockedUntilMatch[1]) {
              try {
                const blockedUntil = new Date(blockedUntilMatch[1])
                const blockedUntilStr = blockedUntil.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
                userFriendlyMessage = `This domain is temporarily blocked until ${blockedUntilStr} due to abuse prevention. Try again after that time or view the original article.`
              } catch {
                userFriendlyMessage = 'This domain is temporarily blocked by the content extraction service due to abuse prevention. Try again later or view the original article.'
              }
            } else {
              userFriendlyMessage = 'This domain is temporarily blocked by the content extraction service due to abuse prevention. Try again later or view the original article.'
            }
          } else if (errorMessage.includes('JavaScript-heavy site')) {
            userFriendlyMessage = 'This site requires JavaScript rendering. Content extraction may be incomplete.'
          } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted') || errorMessage.includes('AbortError')) {
            // Backend extraction timed out - client will auto-retry via zombie detection
            userFriendlyMessage = 'Extraction timed out - will auto-retry. Page may be slow to load.'
          } else if (errorMessage.includes('Failed to extract article after trying all methods')) {
            userFriendlyMessage = 'All extraction methods failed. Site may require JavaScript or have anti-bot protection.'
          } else {
            userFriendlyMessage = 'Content extraction failed. You can still view the original URL.'
          }

          // Determine if error is permanent
          // Note: Anti-bot protection is no longer a permanent failure since we now handle it with Puppeteer
          const isPermanentFailure = false // Allow retries for all errors (zombie detection will handle it)

          await supabase
            .from('reading_queue')
            .update({
              excerpt: userFriendlyMessage,
              processed: isPermanentFailure,
            })
            .eq('id', savedArticle.id)
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
      }

      if (tags !== undefined) {
        updates.tags = tags
      }

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
      const articleId = id
      if (!articleId) {
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
                  // Clean the content before storing
                  content = cleanArticleContent(rawContent)
                } catch (e) {
                  console.error('[RSS Sync] Failed to parse Jina response for', item.link)
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
                tags: ['rss', 'auto-imported']
              }])
              totalArticlesAdded++
            }
            await supabase.from('rss_feeds').update({ last_fetched_at: new Date().toISOString() }).eq('id', feed.id)
          } catch (err) {
          }
        }
        return res.status(200).json({ success: true, feedsSynced: feeds.length, articlesAdded: totalArticlesAdded })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to sync feeds' })
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
        const items = feedData.items.slice(0, 20).map(item => ({
          guid: item.guid || item.link,
          feed_id: feed.id,
          title: decodeHTMLEntities(item.title || 'Untitled'),
          link: item.link || '',
          description: item.contentSnippet || item.description || null,
          published_at: item.pubDate || item.isoDate || null,
          author: item.creator || item.author || null
        }))

        return res.status(200).json({
          success: true,
          items
        })
      } catch (error) {
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
                content = cleanArticleContent(rawContent)
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

    const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }> = []

    // Search projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50)

    if (projects) {
      for (const p of projects) {
        if (p.embedding) {
          const similarity = cosineSimilarity(embedding, p.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency across all item types
          if (similarity > 0.55) {
            candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
          }
        }
      }
    }

    // Search memories
    const { data: memories } = await supabase
      .from('memories')
      .select('id, title, body, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(50)

    if (memories) {
      for (const m of memories) {
        if (m.embedding) {
          const similarity = cosineSimilarity(embedding, m.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency across all item types
          if (similarity > 0.55) {
            candidates.push({ type: 'thought', id: m.id, title: m.title || m.body?.slice(0, 50) + '...', similarity })
          }
        }
      }
    }

    // Search other articles (use reading_queue table)
    const { data: articles } = await supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .neq('id', articleId)
      .not('embedding', 'is', null)
      .limit(50)

    if (articles) {
      for (const a of articles) {
        if (a.embedding) {
          const similarity = cosineSimilarity(embedding, a.embedding)
          // Lowered threshold from 0.7 to 0.55 for consistency across all item types
          if (similarity > 0.55) {
            candidates.push({ type: 'article', id: a.id, title: a.title, similarity })
          }
        }
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity)

    console.log(`[reading] Found ${candidates.length} potential connections`)

    // Auto-link >85%, suggest 55-85% (consistent with memories and projects)
    const autoLinked = []
    const suggestions = []

    for (const candidate of candidates.slice(0, 10)) {
      if (candidate.similarity > 0.85) {
        // Auto-create connection (with deduplication check)
        const { data: existing } = await supabase
          .from('connections')
          .select('id')
          .or(`and(source_type.eq.article,source_id.eq.${articleId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.article,target_id.eq.${articleId})`)
          .maybeSingle()

        if (!existing) {
          await supabase
            .from('connections')
            .insert({
              source_type: 'article',
              source_id: articleId,
              target_type: candidate.type,
              target_id: candidate.id,
              connection_type: 'relates_to',
              created_by: 'ai',
              ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match`
            })
          autoLinked.push(candidate)
        }
      } else if (candidate.similarity > 0.55) {
        suggestions.push(candidate)
      }
    }

    console.log(`[reading] Auto-linked ${autoLinked.length}, suggested ${suggestions.length}`)

    // Store suggestions
    if (suggestions.length > 0) {
      const suggestionInserts = suggestions.map(s => ({
        from_item_type: 'article',
        from_item_id: articleId,
        to_item_type: s.type,
        to_item_id: s.id,
        reasoning: `${Math.round(s.similarity * 100)}% semantic similarity`,
        confidence: s.similarity,
        user_id: userId,
        status: 'pending'
      }))

      await supabase
        .from('connection_suggestions')
        .insert(suggestionInserts)
    }

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
