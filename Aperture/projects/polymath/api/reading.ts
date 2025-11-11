/**
 * Consolidated Reading API
 * Handles articles, highlights, RSS feeds, and all reading operations
 * Uses Jina AI Reader API for clean article extraction, with Cheerio fallback for blocked domains
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { marked } from 'marked'
import Parser from 'rss-parser'
import { generateEmbedding, cosineSimilarity } from './lib/gemini-embeddings.js'
import * as cheerio from 'cheerio'

const rssParser = new Parser()

/**
 * Extract article content using Cheerio (lightweight HTML parser)
 * Used as fallback when Jina AI blocks domains or fails
 * Note: This won't render JavaScript, but provides basic extraction for static HTML
 */
async function fetchArticleWithCheerio(url: string): Promise<any> {
  console.log('[Cheerio] Fetching article with basic HTML extraction:', url)

  try {
    // Fetch HTML with timeout (generous timeout for robustness)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[Cheerio] HTML fetched, length:', html.length)

    // Load HTML with Cheerio
    const $ = cheerio.load(html)

    // Remove unwanted elements - extensive list for clean extraction
    $('script, style, nav, header, footer, aside, iframe, noscript').remove()
    $('.advertisement, .ads, .ad, .advert, [class*="ad-"], [id*="ad-"]').remove()
    $('.social-share, .share-buttons, .social-buttons, [class*="share"], [class*="social"]').remove()
    $('.cookie-notice, .cookie-banner, .gdpr, [class*="cookie"], [class*="consent"]').remove()
    $('.newsletter-signup, .newsletter, .email-signup, [class*="newsletter"]').remove()
    $('.comments, .comment-section, [class*="comment"]').remove()
    $('.related-articles, .recommended, .trending, .popular, [class*="related"]').remove()
    $('.subscribe, .subscription, [class*="subscribe"], [class*="paywall"]').remove()
    $('.navigation, .nav-drawer, .sidebar, [class*="drawer"]').remove()
    $('.privacy, .legal, [class*="privacy"], [class*="terms"]').remove()
    $('[role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').remove()

    // Try to extract title from multiple sources
    let title =
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      'Untitled'

    title = title.trim().substring(0, 200)

    // Try to find the main content area using common selectors
    let content = ''
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.post-body',
      '.article-body'
    ]

    for (const selector of contentSelectors) {
      const element = $(selector)
      if (element.length > 0 && element.text().trim().length > 100) {
        content = element.html() || ''
        console.log('[Cheerio] Found content using selector:', selector)
        break
      }
    }

    // Fallback: if no content found, try to get all paragraphs
    if (!content || content.length < 100) {
      console.log('[Cheerio] Using fallback: extracting all paragraphs')
      const paragraphs = $('p').map((i, el) => $(el).html()).get()
      content = paragraphs.join('\n\n')
    }

    // Extract text for validation
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    if (textContent.length < 50) {
      throw new Error('Cheerio extraction returned insufficient content (site may require JavaScript)')
    }

    console.log('[Cheerio] Extraction successful - Text length:', textContent.length)

    // Extract metadata
    const author =
      $('meta[property="article:author"]').attr('content') ||
      $('meta[name="author"]').attr('content') ||
      $('.author').first().text().trim() ||
      null

    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''

    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      null

    // Extract domain for favicon
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace('www.', '')

    // Create excerpt
    const excerpt = description || textContent.substring(0, 200) + '...'

    return {
      title,
      content,
      excerpt,
      author,
      publishedDate: null,
      thumbnailUrl: image,
      faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      url
    }
  } catch (error) {
    console.error('[Cheerio] Extraction failed:', error)
    throw error
  }
}

/**
 * Extract article content using Jina AI, with Cheerio fallback
 * Jina AI provides clean, reader-friendly content extraction
 */
async function fetchArticle(url: string) {
  try {
    console.log('[fetchArticle] Extracting article with Jina AI:', url)
    const result = await fetchArticleWithJina(url)

    // Check if Jina AI returned meaningful content
    if (result.content && result.content.length > 100) {
      console.log('[fetchArticle] Jina AI succeeded')
      return result
    }

    console.log('[fetchArticle] Jina AI returned insufficient content')
    throw new Error('Jina AI extraction returned insufficient content')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[fetchArticle] Jina AI failed:', errorMessage)

    // If timeout or blocked domain, try Cheerio fallback
    const isTimeout = errorMessage.includes('aborted') || errorMessage.includes('timeout')
    const isBlocked = errorMessage.includes('451') || errorMessage.includes('blocked') || errorMessage.includes('SecurityCompromiseError')

    if (isTimeout || isBlocked) {
      const reason = isTimeout ? 'timed out' : 'blocked'
      console.log(`[fetchArticle] Jina AI ${reason}, trying Cheerio fallback...`)
      try {
        const result = await fetchArticleWithCheerio(url)
        console.log('[fetchArticle] Cheerio fallback succeeded')
        return result
      } catch (cheerioError) {
        console.error('[fetchArticle] Cheerio fallback also failed:', cheerioError instanceof Error ? cheerioError.message : 'Unknown error')
        throw new Error(`Failed to extract article: Jina AI ${reason}, Cheerio fallback also failed`)
      }
    }

    // For other errors, just throw
    throw new Error(`Failed to extract article: ${errorMessage}`)
  }
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
      /^(arrow|filters?|category|brand|processor|showing \d+ of)$/i.test(line)
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

    // Skip product specs and e-commerce content
    if (
      /^\(\d+(\.\d+)?-inch\s+\d+gb\)/i.test(line) ||
      /^\(.*?(gb|tb|oled|ssd|ram).*?\)$/i.test(line) ||
      /^[☆★]{3,5}$/i.test(line) ||
      /^our review$/i.test(line)
    ) {
      continue
    }

    // Skip "Latest Articles" sections with just numbers
    if (/^latest articles?$/i.test(line) || /^\d+$/.test(line)) {
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

  return cleaned.join('\n')
}

/**
 * Extract article content using Jina AI Reader API with retry logic
 * Jina AI provides clean, reader-friendly content
 * Note: Sanitization happens client-side before rendering
 */
async function fetchArticleWithJina(url: string, retryCount = 0): Promise<any> {
  const MAX_RETRIES = 3 // Increased for robustness - quality over speed
  const RETRY_DELAYS = [2000, 4000, 8000] // Exponential backoff: 2s, 4s, 8s
  const TIMEOUT_MS = 45000 // 45 second timeout (sites can be slow, Jina AI can be slow)

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

    return {
      title: title || 'Untitled',
      content: cleanedContent || `<p>Unable to extract content. <a href="${url}" target="_blank">View original article</a></p>`,
      excerpt,
      author: data.data.author || null,
      publishedDate: data.data.publishedTime || null,
      thumbnailUrl: data.data.image || null,
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
    /^\d+\s*(gb|tb|inch|hz|ghz|gb ram)\b/i,  // Technical specs
    /^[☆★]{3,5}$/,  // Star ratings
    /^\(\d+(\.\d+)?-inch\s+\d+gb\)/i,  // Product specs like "(13.3-inch 64GB)"
    /^\(.*?(gb|tb|oled|ssd|ram).*?\)$/i,  // Product specs in parentheses

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

  // Remove author bio blocks (multi-line pattern matching)
  // Pattern: Name + title + long bio text
  cleaned = cleaned.replace(/([A-Z][a-z]+ [A-Z][a-z]+[A-Z][a-z]+ (Editor|Writer|Journalist|Author|Contributor)[A-Z][a-z]+ [A-Z][a-z]+[\s\S]{100,800}?(lives in|mom of|dad of|parent of)[\s\S]{0,100}?\n)/gi, '\n')

  // Remove product listing sections
  cleaned = cleaned.replace(/Category\s*Arrow[\s\S]*?Price\s*Arrow[\s\S]*?$/gi, '')
  cleaned = cleaned.replace(/More from [A-Z][a-z' ]+\s*Category[\s\S]*$/gi, '')
  cleaned = cleaned.replace(/LATEST ARTICLES?\s*\d+\s*\d+\s*\d+[\s\S]*$/gi, '')

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
  const userId = getUserId()
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
      fetchArticle(url)
        .then(async (article) => {
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
            console.log(`[reading] ✅ Article extraction complete for ${savedArticle.id} - Title: "${article.title}"`)
          }

          // Generate embedding and auto-connect (async, run after article is marked processed)
          // This way UI gets updated faster, connections happen in background
          generateArticleEmbeddingAndConnect(savedArticle.id, article.title, article.excerpt, userId)
            .then(() => console.log(`[reading] ✅ Connections processed for ${savedArticle.id}`))
            .catch(err => console.error('[reading] Async embedding/connection error:', err))
        })
        .catch(async (extractError) => {
          console.error(`[reading] ❌ Extraction failed for ${savedArticle.id}:`, extractError.message || extractError)

          // Mark as failed but keep the record with helpful error message
          const errorMessage = extractError instanceof Error ? extractError.message : 'Unknown error'
          let userFriendlyMessage = 'Failed to extract content. '

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
            userFriendlyMessage += 'This site may require JavaScript rendering. Try viewing the original article.'
          } else if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
            userFriendlyMessage += 'Request timed out. Click to retry.'
          } else {
            userFriendlyMessage += 'Click to view the original article.'
          }

          await supabase
            .from('reading_queue')
            .update({
              excerpt: userFriendlyMessage,
              processed: false,
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
                title: item.title || 'Untitled',
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
          title: item.title || 'Untitled',
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
              title: item.title || 'Untitled',
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
