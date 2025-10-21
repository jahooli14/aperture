import type { VercelRequest, VercelResponse } from '@vercel/node'
import { processMemory } from './lib/process-memory'

/**
 * Background processing endpoint
 * Can be called manually or via cron job
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { memory_id } = req.body

  if (!memory_id) {
    return res.status(400).json({ error: 'memory_id required' })
  }

  try {
    await processMemory(memory_id)

    return res.status(200).json({
      success: true,
      message: 'Memory processed successfully'
    })
  } catch (error) {
    console.error('[process-api] Error:', error)
    return res.status(500).json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
