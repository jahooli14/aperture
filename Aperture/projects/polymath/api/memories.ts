import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Memories API
 * GET /api/memories - List all memories
 * GET /api/memories?resurfacing=true - Get memories to resurface (spaced repetition)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { resurfacing } = req.query

    if (resurfacing === 'true') {
      // Resurfacing mode: spaced repetition algorithm
      return await handleResurfacing(req, res)
    }

    // Standard mode: list all memories
    const { data: memories, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[api/memories] Fetch error:', error)
      return res.status(500).json({ error: 'Failed to fetch memories' })
    }

    return res.status(200).json({ memories })

  } catch (error) {
    console.error('[api/memories] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Resurfacing algorithm: Spaced repetition
 *
 * Strategy:
 * 1. Find memories that haven't been "reviewed" in a while
 * 2. Use spaced intervals: 1d, 3d, 7d, 14d, 30d, 60d, 90d
 * 3. Prioritize:
 *    - High entity count (rich memories)
 *    - High bridge count (well-connected)
 *    - Matched to recent interests
 */
async function handleResurfacing(req: VercelRequest, res: VercelResponse) {
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

        // Priority score: entity count + bridge count (simulated) + recency factor
        const entityCount = memory.entities?.[0]?.count || 0
        const recencyFactor = Math.max(0, 1 - (daysSinceReview / 365)) // decay over year
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
