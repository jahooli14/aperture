/**
 * Admin endpoint to regenerate knowledge graph connections
 * Re-scans all items to create embeddings and semantic connections
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from '../_lib/auth.js'
import { maintainEmbeddings } from '../_lib/embeddings-maintenance.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const userId = getUserId()
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    console.log('[regenerate-connections] Starting full knowledge graph regeneration...')

    // Re-embed all items (force = true) with a higher limit
    // This will regenerate embeddings for all items and create connections
    const stats = await maintainEmbeddings(userId, 1000, true)

    console.log('[regenerate-connections] Complete:', stats)

    return res.status(200).json({
      success: true,
      message: `Knowledge graph regenerated: ${stats.embeddings_created} embeddings, ${stats.connections_created} connections`,
      stats
    })
  } catch (error) {
    console.error('[regenerate-connections] Error:', error)
    return res.status(500).json({
      error: 'Failed to regenerate connections',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
