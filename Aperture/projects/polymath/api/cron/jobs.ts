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
import { processMemory } from '../../lib/process-memory.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    return res.status(400).json({ error: 'Missing job parameter. Use ?job=synthesis, ?job=strengthen, or ?job=process_stuck' })
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

    } else if (job === 'process_stuck') {
      // Process any memories stuck in processing (>5 min old, not processed, no error)
      const { data: stuckMemories, error: fetchError } = await supabase
        .from('memories')
        .select('id, title, created_at')
        .eq('processed', false)
        .is('error', null)
        .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })
        .limit(10)

      if (fetchError) {
        throw new Error(`Failed to fetch stuck memories: ${fetchError.message}`)
      }

      const processed = []
      const failed = []

      for (const memory of stuckMemories || []) {
        try {
          console.log(`[cron/jobs] Processing stuck memory: ${memory.id} - ${memory.title}`)
          await processMemory(memory.id)
          processed.push(memory.id)
        } catch (error) {
          console.error(`[cron/jobs] Failed to process memory ${memory.id}:`, error)
          failed.push({ id: memory.id, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      return res.status(200).json({
        success: true,
        job: 'process_stuck',
        found: stuckMemories?.length || 0,
        processed: processed.length,
        failed: failed.length,
        failures: failed,
        timestamp: new Date().toISOString()
      })

    } else {
      return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=synthesis, ?job=strengthen, or ?job=process_stuck` })
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
    },
    {
      "path": "/api/cron/jobs?job=process_stuck",
      "schedule": "*/10 * * * *"
    }
  ]
}
*/
