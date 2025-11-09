/**
 * Consolidated Reading API
 * Handles articles, highlights, RSS feeds, and all reading operations
 * Uses Jina AI Reader API for clean article extraction
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { marked } from 'marked'
import Parser from 'rss-parser'
import { generateEmbedding, cosineSimilarity } from './lib/gemini-embeddings.js'

const rssParser = new Parser()

/**
 * Extract article content using Jina AI
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
    console.error('[fetchArticle] Jina AI failed:', error instanceof Error ? error.message : 'Unknown error')
    throw new Error(`Failed to extract article: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract article content using Jina AI Reader API
 * Jina AI provides clean, reader-friendly content
 * Note: Sanitization happens client-side before rendering
 */
async function fetchArticleWithJina(url: string) {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Jina AI Error]', response.status, errorText)
      throw new Error(`Jina AI returned ${response.status}: ${errorText.substring(0, 200)}`)
    }

    const rawText = await response.text()

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Jina AI returned empty content')
    }

    // Extract title from first H1 in markdown (# Title)
    const lines = rawText.split('\n')
    let title = 'Untitled'
    let contentStartIndex = 0

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

    // Look for first H1 heading (# Title) in markdown
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim()

      // Check for H1 markdown syntax
      if (line.startsWith('# ')) {
        const h1Title = line.substring(2).trim()
        if (h1Title.length > 0 && h1Title.length < 200 && !isUrlLike(h1Title)) {
          title = h1Title
          contentStartIndex = i + 1
          console.log('[Jina AI] Found H1 title:', title)
          break
        }
      }

      // Fallback: if no H1 found yet, look for any reasonable title line
      if (title === 'Untitled' && line.length > 0 && line.length < 200 && !isUrlLike(line) && !line.startsWith('#')) {
        title = line
        contentStartIndex = i + 1
      }
    }

    // If title is still URL-like or "Untitled", try to extract from URL
    if (title === 'Untitled' || isUrlLike(title)) {
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
        // Keep "Untitled" if URL parsing fails
        title = 'Untitled Article'
      }
    }

    // Get content after title
    const contentLines = lines.slice(contentStartIndex)
    const rawContent = contentLines.join('\n')

    // Clean the content aggressively
    const cleanedContent = cleanArticleContent(rawContent)

    // Check if the content is mostly just the URL - this means extraction failed
    const contentLooksLikeUrl = isUrlLike(cleanedContent) || cleanedContent.length < 50

    // Convert to simple HTML with paragraphs
    const htmlContent = cleanedContent
      .split('\n\n')
      .filter(para => para.trim().length > 0 && !isUrlLike(para.trim()))
      .map(para => `<p>${para.trim()}</p>`)
      .join('\n')

    // Create a better excerpt
    let excerpt = cleanedContent.substring(0, 200) || ''
    if (contentLooksLikeUrl || !htmlContent || htmlContent.length < 100) {
      excerpt = `Content extraction from ${extractDomain(url)} may be incomplete. Click to view the original article.`
    }

    return {
      title: title || 'Untitled',
      content: htmlContent || `<p>Unable to extract content. <a href="${url}" target="_blank">View original article</a></p>`,
      excerpt,
      author: null,
      publishedDate: null,
      thumbnailUrl: null,
      faviconUrl: null,
      url
    }
  } catch (error) {
    console.error('[fetchArticleWithJina] Error:', error)
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch article content')
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

    // Social media and sharing
    /^(share|share on|follow us|connect with|like us|follow|tweet|pin)/i,
    /^(facebook|twitter|instagram|linkedin|youtube|tiktok|whatsapp|reddit)/i,
    /^(social media|social|connect|join us)/i,

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
    /^(popular|trending|latest|recent articles)/i,

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

    // List/link dumps (common pattern: just a link text with no context)
    /^[\[\(]?https?:\/\//i,  // Lines starting with URLs
    /^(source|via|link|url):/i,

    // Short non-content lines (likely UI elements)
    /^[\w\s]{1,3}$/,  // 1-3 character lines (buttons like "OK", "Yes", etc)
  ]

  // Filter out lines matching removal patterns
  lines = lines.filter(line => {
    const trimmed = line.trim()

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
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / 225)
  return Math.max(1, minutes)
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).length
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
            console.log(`[reading] ✅ Article extraction complete for ${savedArticle.id}`)

            // Generate embedding and auto-connect (async, non-blocking)
            generateArticleEmbeddingAndConnect(savedArticle.id, article.title, article.excerpt, userId)
              .then(() => console.log(`[reading] ✅ Connections processed for ${savedArticle.id}`))
              .catch(err => console.error('[reading] Async embedding/connection error:', err))
          }
        })
        .catch(async (extractError) => {
          console.error(`[reading] Extraction failed for ${savedArticle.id}:`, extractError)

          // Mark as failed but keep the record
          await supabase
            .from('reading_queue')
            .update({
              excerpt: 'Failed to extract content. Click to retry.',
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
              if (response.ok) {
                const result = await response.json()
                const rawContent = result.data?.content || result.content || content
                // Clean the content before storing
                content = cleanArticleContent(rawContent)
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
            if (response.ok) {
              const result = await response.json()
              const rawContent = result.data?.content || result.content || content
              content = cleanArticleContent(rawContent)
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
