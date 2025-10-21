import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Unified Memories API
 * GET /api/memories - List all memories
 * GET /api/memories?resurfacing=true - Get memories to resurface (spaced repetition)
 * POST /api/memories - Mark memory as reviewed (requires id in body)
 * GET /api/memories?bridges=true&id=xxx - Get bridges for memory
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { resurfacing, bridges, id } = req.query

    // POST: Mark memory as reviewed
    if (req.method === 'POST') {
      const memoryId = req.body.id || id
      return await handleReview(memoryId as string, res)
    }

    // GET: Bridges for memory
    if (req.method === 'GET' && bridges === 'true') {
      return await handleBridges(id as string | undefined, res)
    }

    // GET: Resurfacing queue
    if (req.method === 'GET' && resurfacing === 'true') {
      return await handleResurfacing(res)
    }

    // GET: List all memories (default)
    if (req.method === 'GET') {
      const { data: memories, error } = await supabase
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[api/memories] Fetch error:', error)
        return res.status(500).json({ error: 'Failed to fetch memories' })
      }

      return res.status(200).json({ memories })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[api/memories] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Mark memory as reviewed
 */
async function handleReview(memoryId: string, res: VercelResponse) {
  if (!memoryId) {
    return res.status(400).json({ error: 'Memory ID required' })
  }

  try {
    // First, get current review count
    const { data: existing } = await supabase
      .from('memories')
      .select('review_count')
      .eq('id', memoryId)
      .single()

    // Update review metadata
    const { data: memory, error } = await supabase
      .from('memories')
      .update({
        last_reviewed_at: new Date().toISOString(),
        review_count: (existing?.review_count || 0) + 1
      })
      .eq('id', memoryId)
      .select()
      .single()

    if (error) {
      console.error('[api/memories/review] Update error:', error)
      return res.status(500).json({ error: 'Failed to mark as reviewed' })
    }

    return res.status(200).json({
      success: true,
      memory
    })
  } catch (error) {
    console.error('[api/memories/review] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Get bridges for memory
 */
async function handleBridges(memoryId: string | undefined, res: VercelResponse) {
  try {
    if (memoryId) {
      // Get bridges for specific memory
      const { data: bridges, error } = await supabase
        .from('bridges')
        .select(`
          *,
          memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
          memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
        `)
        .or(`memory_a.eq.${memoryId},memory_b.eq.${memoryId}`)
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

/**
 * Resurfacing algorithm: Spaced repetition
 */
async function handleResurfacing(res: VercelResponse) {
  try {
    // Get all memories with metadata
    const { data: memories, error } = await supabase
      .from('memories')
      .select(`
        *,
        entities:entities(count)
      `)
      .eq('processed', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate which memories should be resurfaced
    const now = new Date()
    const resurfacingCandidates = memories
      .map(memory => {
        const createdAt = new Date(memory.created_at)
        const lastReviewed = memory.last_reviewed_at
          ? new Date(memory.last_reviewed_at)
          : createdAt

        const daysSinceReview = Math.floor(
          (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Spaced repetition intervals
        const intervals = [1, 3, 7, 14, 30, 60, 90]
        const reviewCount = memory.review_count || 0
        const targetInterval = intervals[Math.min(reviewCount, intervals.length - 1)]

        // Should resurface if days since review >= target interval
        const shouldReview = daysSinceReview >= targetInterval

        // Priority score: entity count + recency factor
        const entityCount = memory.entities?.[0]?.count || 0
        const recencyFactor = Math.max(0, 1 - (daysSinceReview / 365))
        const priority = entityCount * 0.5 + recencyFactor * 0.5

        return {
          ...memory,
          shouldReview,
          daysSinceReview,
          targetInterval,
          priority
        }
      })
      .filter(m => m.shouldReview)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5) // Return top 5

    return res.status(200).json({
      memories: resurfacingCandidates,
      count: resurfacingCandidates.length
    })

  } catch (error) {
    console.error('[api/memories] Resurfacing error:', error)
    return res.status(500).json({ error: 'Failed to fetch resurfacing memories' })
  }
}
