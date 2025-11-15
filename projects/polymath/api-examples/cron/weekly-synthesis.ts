/**
 * Weekly Synthesis Cron Job
 * Copy to: projects/memory-os/api/cron/weekly-synthesis.ts
 *
 * Triggered by Vercel Cron every Monday at 09:00 UTC
 * Runs synthesis for all users
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runSynthesis } from '../../scripts/polymath/synthesis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request (Vercel sets this header)
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[cron/weekly-synthesis] Starting weekly synthesis...')

  try {
    // For single-user app, just use the default user ID
    const userId = process.env.USER_ID || 'default-user'

    const suggestions = await runSynthesis(userId)

    console.log(`[cron/weekly-synthesis] Generated ${suggestions?.length || 0} suggestions`)

    return res.status(200).json({
      success: true,
      suggestions_generated: suggestions?.length || 0,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[cron/weekly-synthesis] Error:', error)
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
      "path": "/api/cron/weekly-synthesis",
      "schedule": "0 9 * * 1"
    }
  ]
}
*/
