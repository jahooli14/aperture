/**
 * Save Article to Reading Queue
 * Fetches article content and stores in reading_queue table
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app

/**
 * Extract article content using Jina AI Reader
 */
async function fetchArticle(url: string) {
  try {
    // Jina AI Reader - free tier, converts any URL to clean markdown
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`

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

    // Jina returns: { title, content (markdown), url, description }
    return {
      title: data.title || 'Untitled',
      content: data.content || '',
      excerpt: data.description || data.content?.substring(0, 200) || '',
      url: data.url || url,
    }
  } catch (error) {
    console.error('[Jina AI] Fetch error:', error)
    throw new Error('Failed to fetch article content')
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

/**
 * Estimate read time from content
 * Average reading speed: 200-250 words per minute
 */
function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / 225) // 225 wpm average
  return Math.max(1, minutes) // Minimum 1 minute
}

/**
 * Count words in content
 */
function countWords(content: string): number {
  return content.trim().split(/\s+/).length
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url, tags } = req.body

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }

    console.log('[API] Fetching article:', url)

    // Check if article already exists
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

    // Fetch article content
    const article = await fetchArticle(url)

    // Prepare article data
    const articleData = {
      user_id: USER_ID,
      url: article.url,
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      source: extractDomain(article.url),
      read_time_minutes: estimateReadTime(article.content),
      word_count: countWords(article.content),
      status: 'unread',
      tags: tags || [],
      created_at: new Date().toISOString(),
    }

    // Insert into database
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
