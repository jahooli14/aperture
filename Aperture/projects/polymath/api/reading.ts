/**
 * Consolidated Reading API
 * Handles articles, highlights, and all reading operations
 * Enhanced with Mozilla Readability + DOMPurify sanitization
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app

/**
 * Extract article content using Jina AI Reader
 * (Readability + JSDOM disabled due to ESM/CommonJS conflicts in serverless)
 */
async function fetchArticle(url: string) {
  try {
    console.log('[Article Extraction] Using Jina AI for:', url)
    return await fetchArticleWithJina(url)
  } catch (error) {
    console.error('[Article Extraction] Error:', error)
    throw error
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

    const data = await response.json()

    return {
      title: data.title || 'Untitled',
      content: data.content || '',
      excerpt: data.description || data.content?.substring(0, 200) || '',
      author: null,
      publishedDate: null,
      thumbnailUrl: null,
      faviconUrl: null,
      url: data.url || url
    }
  } catch (error) {
    console.error('[Jina AI] Fetch error:', error)
    throw new Error('Failed to fetch article content')
  }
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
        console.error('[API] Create highlight error:', error)
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
        console.error('[API] Update highlight error:', error)
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
        console.error('[API] Delete highlight error:', error)
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
          .eq('user_id', USER_ID)
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
            .eq('user_id', USER_ID)

          article.status = 'reading'
          article.read_at = new Date().toISOString()
        }

        return res.status(200).json({
          success: true,
          article,
          highlights: highlights || []
        })
      } catch (error) {
        console.error('[API] Fetch article error:', error)
        return res.status(500).json({ error: 'Failed to fetch article' })
      }
    }

    // List articles
    try {
      const { status, limit = 50 } = req.query

      let query = supabase
        .from('reading_queue')
        .select('*')
        .eq('user_id', USER_ID)
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
      console.error('[API] Fetch error:', error)
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

      console.log('[API] Fetching article:', url)

      const { data: existing } = await supabase
        .from('reading_queue')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('url', url)
        .single()

      if (existing) {
        return res.status(200).json({
          success: true,
          article: existing,
          message: 'Article already in reading queue'
        })
      }

      const article = await fetchArticle(url)

      const articleData = {
        user_id: USER_ID,
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
        console.error('[API] Database error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log('[API] Article saved:', data.id)

      return res.status(201).json({
        success: true,
        article: data
      })

    } catch (error) {
      console.error('[API] Error saving article:', error)
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
        } else if (status === 'reading' || status === 'unread') {
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
        .eq('user_id', USER_ID)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        article: data
      })
    } catch (error) {
      console.error('[API] Update error:', error)
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
        .eq('user_id', USER_ID)

      if (error) throw error

      return res.status(204).send('')
    } catch (error) {
      console.error('[API] Delete error:', error)
      return res.status(500).json({ error: 'Failed to delete article' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
