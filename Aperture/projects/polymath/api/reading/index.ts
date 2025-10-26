/**
 * Reading Queue API
 * CRUD operations for saved articles
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb' // Single-user app

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET - List articles
  if (req.method === 'GET') {
    try {
      const { status, limit = 50 } = req.query

      let query = supabase
        .from('reading_queue')
        .select('*')
        .eq('user_id', USER_ID)
        .order('created_at', { ascending: false })
        .limit(Number(limit))

      // Filter by status if provided
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

  // PATCH - Update article (mark as read/archived, update status)
  if (req.method === 'PATCH') {
    try {
      const { id, status, tags } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Article ID is required' })
      }

      const updates: any = {}

      if (status) {
        updates.status = status

        // Set timestamps based on status
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
        .eq('id', id)
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

  // DELETE - Remove article from queue
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Article ID is required' })
      }

      const { error } = await supabase
        .from('reading_queue')
        .delete()
        .eq('id', id)
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
