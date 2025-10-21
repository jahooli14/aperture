/**
 * Suggestions API Endpoint
 * GET /api/suggestions - List project suggestions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = process.env.USER_ID || 'default-user'

    // Query parameters
    const {
      status = 'pending',
      limit = '20',
      offset = '0',
      include_rated = 'false'
    } = req.query

    let query = supabase
      .from('project_suggestions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('total_points', { ascending: false })

    // Filter by status
    if (status !== 'all') {
      if (include_rated === 'true') {
        // Show pending + rated suggestions
        query = query.in('status', ['pending', 'spark', 'meh', 'saved'])
      } else {
        // Only show pending
        query = query.eq('status', status)
      }
    }

    // Pagination
    query = query.range(
      Number(offset),
      Number(offset) + Number(limit) - 1
    )

    const { data, error, count } = await query

    if (error) {
      console.error('[api/suggestions] Error fetching suggestions:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      suggestions: data || [],
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    })

  } catch (error) {
    console.error('[api/suggestions] Unexpected error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
