import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_lib/supabase.js'
import { getUserId } from '../_lib/auth.js'
import { updateItemConnections } from '../_lib/connection-logic.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getSupabaseClient()
  const userId = getUserId()

  try {
    console.log('[Regenerate] Starting connection regeneration for user:', userId)
    let processedCount = 0

    // 1. Fetch all items with embeddings
    const [projects, thoughts, articles] = await Promise.all([
      supabase.from('projects').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null),
      supabase.from('memories').select('id, embedding').not('embedding', 'is', null), // memories has no user_id column
      supabase.from('reading_queue').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null)
    ])

    const allProjects = projects.data || []
    const allThoughts = thoughts.data || []
    const allArticles = articles.data || []

    console.log(`[Regenerate] Found ${allProjects.length} projects, ${allThoughts.length} thoughts, ${allArticles.length} articles`)

    // 2. Process Projects
    for (const p of allProjects) {
      await updateItemConnections(p.id, 'project', p.embedding, userId)
      processedCount++
    }

    // 3. Process Thoughts (Memories)
    for (const t of allThoughts) {
      await updateItemConnections(t.id, 'thought', t.embedding, userId)
      processedCount++
    }

    // 4. Process Articles
    for (const a of allArticles) {
      await updateItemConnections(a.id, 'article', a.embedding, userId)
      processedCount++
    }

    return res.status(200).json({
      success: true,
      message: `Regenerated connections for ${processedCount} items`,
      processed: processedCount
    })

  } catch (error) {
    console.error('[Regenerate] Error:', error)
    return res.status(500).json({
      error: 'Failed to regenerate connections',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
