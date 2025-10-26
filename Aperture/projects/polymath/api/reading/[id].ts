/**
 * Single Article API
 * Fetch article by ID with highlights
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Article ID required' })
  }

  if (req.method === 'GET') {
    try {
      // Fetch article
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

      // Fetch highlights
      const { data: highlights, error: highlightsError } = await supabase
        .from('article_highlights')
        .select('*')
        .eq('article_id', id)
        .order('created_at', { ascending: true })

      if (highlightsError) throw highlightsError

      // Update status to 'reading' if currently 'unread'
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

  return res.status(405).json({ error: 'Method not allowed' })
}
