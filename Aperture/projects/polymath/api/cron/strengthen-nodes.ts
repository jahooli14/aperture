/**
 * Daily Node Strengthening Cron Job
 * Copy to: projects/memory-os/api/cron/strengthen-nodes.ts
 *
 * Triggered by Vercel Cron daily at 00:00 UTC
 * Updates node strengths based on git activity
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { strengthenNodes } from '../../lib/strengthen-nodes.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow POST requests from frontend (manual triggers)
  // Verify cron requests with CRON_SECRET
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  const isManualTrigger = req.method === 'POST' && !req.headers['x-vercel-cron']

  // If this is a cron job (has x-vercel-cron header), verify auth
  if (!isManualTrigger && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[cron/strengthen-nodes] Starting daily node strengthening...',
    isManualTrigger ? '(manual trigger)' : '(scheduled cron)')

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
