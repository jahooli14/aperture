import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Mark memory as reviewed
 * POST /api/memories/[id]/review
 *
 * Updates last_reviewed_at and increments review_count
 * This strengthens the memory in the spaced repetition algorithm
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const memoryId = req.query.id as string

    if (!memoryId) {
      return res.status(400).json({ error: 'Memory ID required' })
    }

    // Update review metadata
    const { data: memory, error } = await supabase
      .from('memories')
      .update({
        last_reviewed_at: new Date().toISOString(),
        review_count: supabase.sql`COALESCE(review_count, 0) + 1`
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
