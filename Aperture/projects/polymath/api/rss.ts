/**
 * RSS Feed API
 * Manages RSS feed subscriptions and automatic article ingestion
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app
const parser = new Parser()

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

/**
 * Fetch RSS feed and parse items
 */
async function fetchRSSFeed(feedUrl: string) {
  try {
    console.log('[RSS] Fetching feed:', feedUrl)
    const feed = await parser.parseURL(feedUrl)

    return {
      title: feed.title || 'Untitled Feed',
      description: feed.description || null,
      siteUrl: feed.link || null,
      faviconUrl: feed.image?.url || null,
      items: feed.items.map(item => ({
        guid: item.guid || item.link || '',
        title: item.title || 'Untitled',
        link: item.link || '',
        description: item.contentSnippet || item.description || null,
        publishedAt: item.pubDate || item.isoDate || null,
        author: item.creator || item.author || null
      }))
    }
  } catch (error) {
    console.error('[RSS] Fetch error:', error)
    throw new Error('Failed to fetch RSS feed')
  }
}

/**
 * Add article to reading queue from RSS item
 */
async function saveArticleFromRSS(feedId: string, item: any) {
  try {
    // Check if article already exists
    const { data: existing } = await supabase
      .from('reading_queue')
      .select('id')
      .eq('user_id', USER_ID)
      .eq('url', item.link)
      .single()

    if (existing) {
      console.log('[RSS] Article already exists:', item.link)
      return null
    }

    // Use Jina AI to fetch full content
    const jinaUrl = `https://r.jina.ai/${item.link}`
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'json'
      }
    })

    let content = item.description || ''
    let excerpt = item.description || ''
    let title = item.title

    if (response.ok) {
      const result = await response.json()
      const data = result.data || result
      if (data.content) {
        content = data.content
        excerpt = data.description || data.content.substring(0, 200)
        title = data.title || item.title
      }
    }

    const articleData = {
      user_id: USER_ID,
      url: item.link,
      title,
      author: item.author || null,
      content,
      excerpt,
      published_date: item.publishedAt || null,
      thumbnail_url: null,
      favicon_url: null,
      source: extractDomain(item.link),
      read_time_minutes: Math.ceil(content.split(/\s+/).length / 225),
      word_count: content.split(/\s+/).length,
      status: 'unread',
      tags: ['rss', 'auto-imported'],
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('reading_queue')
      .insert([articleData])
      .select()
      .single()

    if (error) {
      console.error('[RSS] Failed to save article:', error)
      return null
    }

    console.log('[RSS] Saved article:', data.id)
    return data
  } catch (error) {
    console.error('[RSS] Error saving article:', error)
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resource, id } = req.query

  // SYNC RESOURCE - Fetch new articles from all enabled feeds
  if (resource === 'sync') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      // Get all enabled feeds
      const { data: feeds, error: feedsError } = await supabase
        .from('rss_feeds')
        .select('*')
        .eq('user_id', USER_ID)
        .eq('enabled', true)

      if (feedsError) throw feedsError

      if (!feeds || feeds.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No enabled feeds to sync',
          articlesAdded: 0
        })
      }

      let totalArticlesAdded = 0

      // Process each feed
      for (const feed of feeds) {
        try {
          const feedData = await fetchRSSFeed(feed.feed_url)

          // Save new articles (limit to 5 most recent per feed per sync)
          const recentItems = feedData.items.slice(0, 5)

          for (const item of recentItems) {
            const article = await saveArticleFromRSS(feed.id, item)
            if (article) {
              totalArticlesAdded++
            }
          }

          // Update last_fetched_at
          await supabase
            .from('rss_feeds')
            .update({ last_fetched_at: new Date().toISOString() })
            .eq('id', feed.id)

        } catch (error) {
          console.error(`[RSS] Error syncing feed ${feed.id}:`, error)
          // Continue with other feeds even if one fails
        }
      }

      return res.status(200).json({
        success: true,
        feedsSynced: feeds.length,
        articlesAdded: totalArticlesAdded
      })
    } catch (error) {
      console.error('[RSS] Sync error:', error)
      return res.status(500).json({ error: 'Failed to sync feeds' })
    }
  }

  // GET - List feeds OR get single feed
  if (req.method === 'GET') {
    if (id && typeof id === 'string') {
      try {
        const { data, error } = await supabase
          .from('rss_feeds')
          .select('*')
          .eq('id', id)
          .eq('user_id', USER_ID)
          .single()

        if (error) throw error
        if (!data) {
          return res.status(404).json({ error: 'Feed not found' })
        }

        return res.status(200).json({
          success: true,
          feed: data
        })
      } catch (error) {
        console.error('[RSS] Fetch feed error:', error)
        return res.status(500).json({ error: 'Failed to fetch feed' })
      }
    }

    // List all feeds
    try {
      const { data, error } = await supabase
        .from('rss_feeds')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false })

      if (error) throw error

      return res.status(200).json({
        success: true,
        feeds: data || []
      })
    } catch (error) {
      console.error('[RSS] Fetch feeds error:', error)
      return res.status(500).json({ error: 'Failed to fetch feeds' })
    }
  }

  // POST - Subscribe to new feed
  if (req.method === 'POST') {
    try {
      const { feed_url } = req.body

      if (!feed_url || typeof feed_url !== 'string') {
        return res.status(400).json({ error: 'feed_url is required' })
      }

      // Check if feed already exists
      const { data: existing } = await supabase
        .from('rss_feeds')
        .select('id')
        .eq('user_id', USER_ID)
        .eq('feed_url', feed_url)
        .single()

      if (existing) {
        return res.status(200).json({
          success: true,
          feed: existing,
          message: 'Feed already subscribed'
        })
      }

      // Fetch feed to validate and get metadata
      const feedData = await fetchRSSFeed(feed_url)

      const feedRecord = {
        user_id: USER_ID,
        feed_url,
        title: feedData.title,
        description: feedData.description,
        site_url: feedData.siteUrl,
        favicon_url: feedData.faviconUrl,
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('rss_feeds')
        .insert([feedRecord])
        .select()
        .single()

      if (error) throw error

      // Immediately fetch first 3 articles from new feed
      const recentItems = feedData.items.slice(0, 3)
      for (const item of recentItems) {
        await saveArticleFromRSS(data.id, item)
      }

      return res.status(201).json({
        success: true,
        feed: data
      })
    } catch (error) {
      console.error('[RSS] Subscribe error:', error)
      return res.status(500).json({
        error: 'Failed to subscribe to feed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // PATCH - Update feed (enable/disable)
  if (req.method === 'PATCH') {
    try {
      const { id: feedId, enabled } = req.body

      if (!feedId) {
        return res.status(400).json({ error: 'Feed ID is required' })
      }

      const updates: any = {
        updated_at: new Date().toISOString()
      }

      if (typeof enabled === 'boolean') {
        updates.enabled = enabled
      }

      const { data, error } = await supabase
        .from('rss_feeds')
        .update(updates)
        .eq('id', feedId)
        .eq('user_id', USER_ID)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        feed: data
      })
    } catch (error) {
      console.error('[RSS] Update error:', error)
      return res.status(500).json({ error: 'Failed to update feed' })
    }
  }

  // DELETE - Unsubscribe from feed
  if (req.method === 'DELETE') {
    try {
      const feedId = id

      if (!feedId || typeof feedId !== 'string') {
        return res.status(400).json({ error: 'Feed ID is required' })
      }

      const { error } = await supabase
        .from('rss_feeds')
        .delete()
        .eq('id', feedId)
        .eq('user_id', USER_ID)

      if (error) throw error

      return res.status(204).send('')
    } catch (error) {
      console.error('[RSS] Delete error:', error)
      return res.status(500).json({ error: 'Failed to delete feed' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
