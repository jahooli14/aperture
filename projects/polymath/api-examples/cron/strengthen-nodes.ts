/**
 * Daily Node Strengthening Cron Job
 * Copy to: projects/memory-os/api/cron/strengthen-nodes.ts
 *
 * Triggered by Vercel Cron daily at 00:00 UTC
 * Updates node strengths based on git activity
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { strengthenNodes } from '../../scripts/polymath/strengthen-nodes'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[cron/strengthen-nodes] Starting daily node strengthening...')

  try {
    // Check last 24 hours of git activity
    const updates = await strengthenNodes(24)

    console.log(`[cron/strengthen-nodes] Strengthened ${updates?.length || 0} nodes`)

    return res.status(200).json({
      success: true,
      nodes_strengthened: updates?.length || 0,
      updates: updates || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[cron/strengthen-nodes] Error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

// Vercel cron configuration (add to vercel.json):
/*
{
  "crons": [
    {
      "path": "/api/cron/strengthen-nodes",
      "schedule": "0 0 * * *"
    }
  ]
}
*/
