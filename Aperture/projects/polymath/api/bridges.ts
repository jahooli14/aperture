import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Bridges API
 * GET /api/bridges?memory_id=xxx - Get bridges for a specific memory
 * GET /api/bridges - Get all bridges
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { memory_id } = req.query

    if (memory_id) {
      // Get bridges for specific memory
      const { data: bridges, error } = await supabase
        .from('bridges')
        .select(`
          *,
          memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
          memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
        `)
        .or(`memory_a.eq.${memory_id},memory_b.eq.${memory_id}`)
        .order('strength', { ascending: false })

      if (error) {
        console.error('[api/bridges] Fetch error:', error)
        return res.status(500).json({ error: 'Failed to fetch bridges' })
      }

      return res.status(200).json({ bridges })
    }

    // Get all bridges
    const { data: bridges, error } = await supabase
      .from('bridges')
      .select(`
        *,
        memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
        memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
      `)
      .order('strength', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[api/bridges] Fetch error:', error)
      return res.status(500).json({ error: 'Failed to fetch bridges' })
    }

    return res.status(200).json({ bridges })

  } catch (error) {
    console.error('[api/bridges] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
