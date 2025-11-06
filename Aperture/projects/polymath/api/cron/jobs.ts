/**
 * Consolidated Cron Jobs Handler
 *
 * Handles:
 * - Daily job (runs strengthen + process_stuck every day at 00:00 UTC)
 * - Weekly synthesis (Mondays only)
 * - Manual triggers for individual jobs
 *
 * Route with ?job= query parameter:
 * - /api/cron/jobs?job=daily (auto-scheduled)
 * - /api/cron/jobs?job=synthesis (manual or weekly)
 * - /api/cron/jobs?job=strengthen (manual)
 * - /api/cron/jobs?job=process_stuck (manual)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../lib/supabase.js'
import { getUserId } from '../lib/auth.js'
import { runSynthesis } from '../../lib/synthesis.js'
import { strengthenNodes } from '../../lib/strengthen-nodes.js'
import { processMemory } from '../../lib/process-memory.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId()
  // Verify authorization
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  const isManualTrigger = req.method === 'POST' && !req.headers['x-vercel-cron']

  if (!isManualTrigger && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const job = req.query.job as string

  if (!job) {
    return res.status(400).json({ error: 'Missing job parameter. Use ?job=daily, ?job=synthesis, ?job=strengthen, or ?job=process_stuck' })
  }

  console.log(`[cron/jobs] Starting ${job}...`, isManualTrigger ? '(manual trigger)' : '(scheduled cron)')

  const now = new Date()

  try {
    if (job === 'daily') {
      // Daily job: strengthen nodes + process stuck memories
      // On Mondays, also run synthesis
      const isMonday = now.getUTCDay() === 1

      const results: any = {
        success: true,
        job: 'daily',
        timestamp: new Date().toISOString(),
        tasks: {}
      }

      // 1. Strengthen nodes
      try {
        const updates = await strengthenNodes(24)
        results.tasks.strengthen = {
          success: true,
          nodes_strengthened: updates?.length || 0
        }
        console.log(`[cron/jobs/daily] Strengthened ${updates?.length || 0} nodes`)
      } catch (error) {
        results.tasks.strengthen = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('[cron/jobs/daily] Strengthen failed:', error)
      }

      // 2. Process stuck memories
      try {
        const { data: stuckMemories, error: fetchError } = await supabase
          .from('memories')
          .select('id, title, created_at')
          .eq('processed', false)
          .is('error', null)
          .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('created_at', { ascending: true })
          .limit(10)

        if (fetchError) throw fetchError

        const processed = []
        const failed = []

        for (const memory of stuckMemories || []) {
          try {
            console.log(`[cron/jobs/daily] Processing stuck memory: ${memory.id} - ${memory.title}`)
            await processMemory(memory.id)
            processed.push(memory.id)
          } catch (error) {
            console.error(`[cron/jobs/daily] Failed to process memory ${memory.id}:`, error)
            failed.push({ id: memory.id, error: error instanceof Error ? error.message : 'Unknown error' })
          }
        }

        results.tasks.process_stuck = {
          success: true,
          found: stuckMemories?.length || 0,
          processed: processed.length,
          failed: failed.length,
          failures: failed
        }
        console.log(`[cron/jobs/daily] Processed ${processed.length}/${stuckMemories?.length || 0} stuck memories`)
      } catch (error) {
        results.tasks.process_stuck = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('[cron/jobs/daily] Process stuck failed:', error)
      }

      // 3. Run synthesis on Mondays
      if (isMonday) {
        try {
          const userId = process.env.userId || 'default-user'
          const suggestions = await runSynthesis(userId)
          results.tasks.synthesis = {
            success: true,
            suggestions_generated: suggestions?.length || 0
          }
          console.log(`[cron/jobs/daily] Generated ${suggestions?.length || 0} suggestions (Monday synthesis)`)
        } catch (error) {
          results.tasks.synthesis = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
          console.error('[cron/jobs/daily] Synthesis failed:', error)
        }
      }

      return res.status(200).json(results)

    } else if (job === 'synthesis') {
      const userId = process.env.userId || 'default-user'
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

    } else if (job === 'process_stuck' || job === 'process-memories') {
      // Process any memories stuck in processing
      // process_stuck: >5 min old (backward compat)
      // process-memories: >30 seconds old (runs every 5 min)
      const ageThreshold = job === 'process-memories'
        ? 30 * 1000  // 30 seconds
        : 5 * 60 * 1000  // 5 minutes

      const { data: stuckMemories, error: fetchError } = await supabase
        .from('memories')
        .select('id, title, created_at')
        .eq('processed', false)
        .is('error', null)
        .lt('created_at', new Date(Date.now() - ageThreshold).toISOString())
        .order('created_at', { ascending: true })
        .limit(10)

      if (fetchError) {
        throw new Error(`Failed to fetch stuck memories: ${fetchError.message}`)
      }

      const processed = []
      const failed = []

      for (const memory of stuckMemories || []) {
        try {
          console.log(`[cron/jobs] Processing memory: ${memory.id} - ${memory.title}`)
          await processMemory(memory.id)
          processed.push(memory.id)
        } catch (error) {
          console.error(`[cron/jobs] Failed to process memory ${memory.id}:`, error)
          failed.push({ id: memory.id, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }

      return res.status(200).json({
        success: true,
        job,
        found: stuckMemories?.length || 0,
        processed: processed.length,
        failed: failed.length,
        failures: failed,
        timestamp: new Date().toISOString()
      })

    } else {
      return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=daily, ?job=synthesis, ?job=strengthen, ?job=process_stuck, or ?job=process-memories` })
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

// Vercel cron configuration (in vercel.json):
/*
{
  "crons": [
    {
      "path": "/api/cron/jobs?job=daily",
      "schedule": "0 0 * * *"
    }
  ]
}
Note: Hobby accounts limited to 1 cron/day. Daily job runs:
- Node strengthening (every day)
- Stuck memory processing (every day)
- Synthesis (Mondays only)
*/
