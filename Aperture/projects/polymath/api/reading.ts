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


const rssParser = new Parser()

/**
 * Extract article content using Jina AI Reader API
 * Jina AI provides clean, reader-friendly content extraction
 */
async function fetchArticle(url: string) {
  try {
    return await fetchArticleWithJina(url)
  } catch (error) {
    throw new Error('Failed to extract article content')
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
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      }
    })

    if (!response.ok) {
      throw new Error(`Jina AI returned ${response.status}`)
    }

    const result = await response.json()

    // Jina AI wraps the article data in a 'data' property
    const data = result.data || result

    // Clean the content before converting to HTML
    const cleanedContent = data.content ? cleanArticleContent(data.content) : ''

    // Convert markdown to HTML for better readability
    let htmlContent = ''
    if (cleanedContent) {
      try {
        // Configure marked for safe HTML rendering
        marked.setOptions({
          breaks: true,  // Convert line breaks to <br>
          gfm: true,     // GitHub Flavored Markdown
        })
        htmlContent = await marked.parse(cleanedContent)
      } catch (error) {
        htmlContent = cleanedContent // Fallback to raw content
      }
    }

    return {
      title: data.title || 'Untitled',
      content: htmlContent,
      excerpt: data.description || cleanedContent.substring(0, 200) || '',
      author: null,
      publishedDate: null,
      thumbnailUrl: null,
      faviconUrl: null,
      url: data.url || url
    }
  } catch (error) {
    throw new Error('Failed to fetch article content')
  }
}

/**
 * Clean markdown article content (for Jina AI output)
 * Removes navigation, footers, ads, cookie notices, etc.
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

  // ARTICLES RESOURCE (default)

  // GET - List articles OR get single article
  if (req.method === 'GET') {
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

  // POST - Save new article
  if (req.method === 'POST') {
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
        .select('id')
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

      // Fetch article content
      const article = await fetchArticle(url)

      // Prepare article data for database
      const articleData = {
        user_id: userId,
        url: article.url,
        title: article.title,
        author: article.author || null,
        content: article.content,
        excerpt: article.excerpt,
        published_date: article.publishedDate || null,
        thumbnail_url: article.thumbnailUrl || null,
        favicon_url: article.faviconUrl || null,
        source: extractDomain(article.url),
        read_time_minutes: estimateReadTime(article.content),
        word_count: countWords(article.content),
        status: 'unread',
        tags: tags || [],
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('reading_queue')
        .insert([articleData])
        .select()
        .single()

      if (error) {
        console.error('Database insert error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw new Error(`Database error: ${error.message}`)
      }


      return res.status(201).json({
        success: true,
        article: data
      })

    } catch (error) {
      return res.status(500).json({
        error: 'Failed to save article',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // PATCH - Update article
  if (req.method === 'PATCH') {
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

  // DELETE - Remove article
  if (req.method === 'DELETE') {
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
    // Sync RSS feeds
    if (resource === 'rss' && req.query.action === 'sync' && req.method === 'POST') {
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
    if (resource === 'rss' && req.query.action === 'items' && req.method === 'GET') {
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

    // GET feeds
    if (req.method === 'GET') {
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

    // POST - Subscribe
    if (req.method === 'POST') {
      try {
        const { feed_url } = req.body
        if (!feed_url) return res.status(400).json({ error: 'feed_url required' })

        const { data: existing, error: existingError } = await supabase.from('rss_feeds').select('id').eq('user_id', userId).eq('feed_url', feed_url).single()
        if (existingError && existingError.code !== 'PGRST116') throw existingError
        if (existing) return res.status(200).json({ success: true, feed: existing, message: 'Already subscribed' })

        const feedData = await rssParser.parseURL(feed_url)
        const { data, error } = await supabase.from('rss_feeds').insert([{
          user_id: userId,
          feed_url,
          title: feedData.title || 'Untitled',
          description: feedData.description || null,
          site_url: feedData.link || null,
          favicon_url: feedData.image?.url || null,
          enabled: true
        }]).select().single()

        if (error) throw error
        return res.status(201).json({ success: true, feed: data })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to subscribe to feed' })
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
