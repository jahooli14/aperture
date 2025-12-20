/**
 * Consolidated Cron Jobs Handler
 *
 * Handles:
 * - Daily job (runs at 21:30 UTC / 9:30pm GMT):
 *   - Strengthen nodes
 *   - Process stuck memories
 *   - Generate bedtime prompts
 *   - Weekly synthesis (Mondays only)
 * - Manual triggers for individual jobs
 *
 * Route with ?job= query parameter:
 * - /api/cron/jobs?job=daily (auto-scheduled)
 * - /api/cron/jobs?job=synthesis (manual or weekly)
 * - /api/cron/jobs?job=strengthen (manual)
 * - /api/cron/jobs?job=process_stuck (manual)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_lib/supabase.js'
import { getUserId } from '../_lib/auth.js'
import { runSynthesis } from '../_lib/synthesis.js'
import { processMemory } from '../_lib/process-memory.js'
import { generateBedtimePrompts } from '../_lib/bedtime-ideas.js'
import { maintainEmbeddings } from '../_lib/embeddings-maintenance.js'
import { extractCapabilities } from '../_lib/capabilities-extraction.js'
import { identifyRottingProjects } from '../_lib/project-maintenance.js'
import webpush from 'web-push'

// Configure web-push (globally or within the handler if needed per-request)
// VAPID details from environment variables
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:your@email.com', // Replace with your contact email
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
} else {
  console.warn('[cron/jobs] Web Push VAPID keys not set. Push notifications will not work.')
}

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

      // 1. Strengthen nodes (Archived Feature)
      // try {
      //   const updates = await strengthenNodes(24)
      //   results.tasks.strengthen = {
      //     success: true,
      //     nodes_strengthened: updates?.length || 0
      //   }
      //   console.log(`[cron/jobs/daily] Strengthened ${updates?.length || 0} nodes`)
      // } catch (error) {
      //   results.tasks.strengthen = {
      //     success: false,
      //     error: error instanceof Error ? error.message : 'Unknown error'
      //   }
      //   console.error('[cron/jobs/daily] Strengthen failed:', error)
      // }
      results.tasks.strengthen = { success: true, nodes_strengthened: 0, message: 'Feature archived' }

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

      // 4. Generate bedtime prompts (runs once daily)
      try {
        const prompts = await generateBedtimePrompts(userId)
        results.tasks.bedtime = {
          success: true,
          prompts_generated: prompts?.length || 0
        }
        console.log(`[cron/jobs/daily] Generated ${prompts?.length || 0} bedtime prompts`)
      } catch (error) {
        results.tasks.bedtime = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('[cron/jobs/daily] Bedtime prompts failed:', error)
      }

      // 5. Send Bedtime Push Notifications (if enabled)
      if (webpush.VapidDetails && now.getHours() === 21 && now.getMinutes() >= 30) { // Check if it's 9:30 PM UTC
        try {
          const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId) // Assuming subscriptions are tied to user_id

          if (subError) throw subError

          console.log(`[cron/jobs/daily] Sending bedtime pushes to ${subscriptions.length} subscriptions...`)

          for (const sub of subscriptions) {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            }, JSON.stringify({
              title: "🌙 Bedtime Ideas Ready",
              body: "Your subconscious is ready to work. Tap to see tonight's prompts.",
              url: "/bedtime"
            }))
            console.log(`[cron/jobs/daily] Sent push to ${sub.endpoint.slice(0, 30)}...`)
          }
          results.tasks.push_notifications = { success: true, sent_count: subscriptions.length }
        } catch (error) {
          console.error('[cron/jobs/daily] Failed to send push notifications:', error)
          results.tasks.push_notifications = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }

      // 6. Identify Rotting Projects
      try {
        console.log('[cron/jobs/daily] Identifying rotting projects...')
        const rottingProjects = await identifyRottingProjects(userId)
        if (rottingProjects.length > 0) {
          results.tasks.rotting_projects = { success: true, count: rottingProjects.length, projects: rottingProjects.map((p: any) => p.title) }
          console.log(`[cron/jobs/daily] Found ${rottingProjects.length} rotting projects:`, rottingProjects.map((p: any) => p.title))
        } else {
          results.tasks.rotting_projects = { success: true, count: 0 }
        }
      } catch (error) {
        console.error('[cron/jobs/daily] Rotting projects identification failed:', error)
        results.tasks.rotting_projects = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }

      // 7. Maintenance (Embeddings & Capabilities)
      try {
        // Daily: Update embeddings for new/stale items (limit 20)
        console.log('[cron/jobs/daily] Running embedding maintenance...')
        const maintenanceStats = await maintainEmbeddings(userId, 20, false)
        results.tasks.embeddings = { success: true, stats: maintenanceStats }

        // Weekly (Sunday): Extract capabilities
        if (now.getUTCDay() === 0) {
          console.log('[cron/jobs/daily] Running weekly capability extraction...')
          const newCaps = await extractCapabilities(userId)
          results.tasks.capabilities = { success: true, extracted: newCaps.length }
        }
      } catch (error) {
        console.error('[cron/jobs/daily] Maintenance failed:', error)
        results.tasks.maintenance = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }

      return res.status(200).json(results)

    } else if (job === 'synthesis') {
      const userId = getUserId()
      const suggestions = await runSynthesis(userId)

      console.log(`[cron/jobs] Generated ${suggestions?.length || 0} suggestions`)

      return res.status(200).json({
        success: true,
        job: 'synthesis',
        suggestions_generated: suggestions?.length || 0,
        timestamp: new Date().toISOString()
      })

    } else if (job === 'strengthen') {
      // const updates = await strengthenNodes(24)
      // console.log(`[cron/jobs] Strengthened ${updates?.length || 0} nodes`)
      return res.status(200).json({
        success: true,
        job: 'strengthen',
        message: 'Feature archived'
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
      "schedule": "30 21 * * *"
    }
  ]
}
Note: Hobby accounts limited to 1 cron/day. Daily job runs at 21:30 UTC (9:30pm GMT / 8:30pm BST):
- Node strengthening (every day)
- Stuck memory processing (every day)
- Bedtime prompts generation (every day)
- Synthesis (Mondays only)
*/
