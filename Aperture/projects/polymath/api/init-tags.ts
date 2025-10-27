/**
 * Initialize Tag System
 * One-time endpoint to generate embeddings for seed tags
 * Call this after running the canonical tags migration
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateSeedEmbeddings } from '../lib/tag-normalizer.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Optional: Add auth check here for security
  // const authHeader = req.headers.authorization
  // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' })
  // }

  try {
    await generateSeedEmbeddings()

    return res.status(200).json({
      success: true,
      message: 'Seed tag embeddings generated successfully'
    })
  } catch (error) {
    console.error('[api/init-tags] Error:', error)
    return res.status(500).json({
      error: 'Failed to initialize tags',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
