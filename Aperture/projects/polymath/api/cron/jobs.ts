/**
 * Consolidated Cron Jobs Handler
 *
 * Handles both:
 * - Weekly synthesis (Mondays 09:00 UTC)
 * - Daily node strengthening (00:00 UTC)
 *
 * Route with ?job= query parameter:
 * - /api/cron/jobs?job=synthesis
 * - /api/cron/jobs?job=strengthen
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runSynthesis } from '../../lib/synthesis.js'
import { strengthenNodes } from '../../lib/strengthen-nodes.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify authorization
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  const isManualTrigger = req.method === 'POST' && !req.headers['x-vercel-cron']

  if (!isManualTrigger && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const job = req.query.job as string

  if (!job) {
    return res.status(400).json({ error: 'Missing job parameter. Use ?job=synthesis or ?job=strengthen' })
  }

  console.log(`[cron/jobs] Starting ${job}...`, isManualTrigger ? '(manual trigger)' : '(scheduled cron)')

  try {
    if (job === 'synthesis') {
      const userId = process.env.USER_ID || 'default-user'
      const suggestions = await runSynthesis(userId)

      console.log(`[cron/jobs] Generated ${suggestions?.length || 0} suggestions`)

      return res.status(200).json({
        success: true,
        job: 'synthesis',
        suggestions_generated: suggestions?.length || 0,
        timestamp: new Date().toISOString()
      })

    } else if (job === 'strengthen') {
      const updates = await strengthenNodes(24)

      console.log(`[cron/jobs] Strengthened ${updates?.length || 0} nodes`)

      return res.status(200).json({
        success: true,
        job: 'strengthen',
        nodes_strengthened: updates?.length || 0,
        updates: updates || [],
        timestamp: new Date().toISOString()
      })

    } else {
      return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=synthesis or ?job=strengthen` })
    }

  } catch (error) {
    console.error(`[cron/jobs] Error in ${job}:`, error)
    return res.status(500).json({
      success: false,
      job,
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
      "path": "/api/cron/jobs?job=synthesis",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/jobs?job=strengthen",
      "schedule": "0 0 * * *"
    }
  ]
}
*/
