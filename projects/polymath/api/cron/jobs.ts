/**
 * Consolidated Cron Jobs Handler
 *
 * Handles:
 * - Daily job (runs at 21:30 UTC / 9:30pm GMT):
 *   - Process stuck memories
 *   - Generate bedtime prompts
 *   - Weekly synthesis (Mondays only)
 * - Manual triggers for individual jobs
 *
 * Route with ?job= query parameter:
 * - /api/cron/jobs?job=daily (auto-scheduled)
 * - /api/cron/jobs?job=synthesis (manual or weekly)
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
import { recomputeHeatForUser } from '../_lib/metabolism.js'
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
  // Cron jobs run server-side — get all active users and process first one
  // (extend to loop over all users when multi-user is needed)
  const { data: users } = await supabase.from('memories').select('user_id').not('user_id', 'is', null).limit(1)
  const userId = users?.[0]?.user_id || null
  // Verify authorization.
  // Only Vercel's own scheduler is trusted without a secret — it sets the
  // x-vercel-cron header, which Vercel strips from inbound external requests
  // so it can't be forged. Anything else (including a manual POST) must carry
  // the CRON_SECRET bearer. Previously a POST lacking the cron header was
  // treated as an authorized "manual trigger", which let anyone run these
  // expensive jobs / fire user notifications unauthenticated.
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = !!req.headers['x-vercel-cron']
  const isManualTrigger = req.method === 'POST' && !isVercelCron

  // The GitHub Actions dispatcher (.github/workflows/cron.yml) only knows
  // IDEA_ENGINE_SECRET — same token every other cron-triggered resource in
  // this app (api/idea-engine.ts, api/projects.ts, api/utilities.ts) accepts.
  // voice-reminder is dispatched hourly from there, so it needs to accept
  // that token too, not just CRON_SECRET (which only Vercel's native cron —
  // job=daily — sends).
  const ideaEngineSecret = process.env.IDEA_ENGINE_SECRET
  const isIdeaEngineAuthed = !!ideaEngineSecret && authHeader === `Bearer ${ideaEngineSecret}`

  if (!isVercelCron && !isIdeaEngineAuthed && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

      // 1. Process stuck memories (including retrying failed ones, but only
      // up to MAX_PROCESS_ATTEMPTS — see process-memory.ts).
      try {
        const { data: stuckMemories, error: fetchError } = await supabase
          .from('memories')
          .select('id, title, created_at, process_attempts')
          .eq('processed', false)
          .or('process_attempts.is.null,process_attempts.lt.5')
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

      // 2. Run synthesis on Mondays
      if (isMonday) {
        try {
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

      // 3. Generate bedtime prompts (runs once daily)
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

      // 3b. Generate Power Hour Plan (Pre-calculation for instant load)
      try {
        const { generatePowerHourPlan } = await import('../_lib/power-hour-generator.js')
        console.log('[cron/jobs/daily] Generating Power Hour plan...')
        const tasks = await generatePowerHourPlan(userId)

        if (tasks && tasks.length > 0) {
          const { error: insertError } = await supabase
            .from('daily_power_hour')
            .insert({
              user_id: userId,
              tasks: tasks,
              created_at: new Date().toISOString()
            })

          if (insertError) throw insertError

          results.tasks.power_hour = { success: true, count: tasks.length }
          console.log(`[cron/jobs/daily] Saved Power Hour plan with ${tasks.length} tasks`)
        } else {
          results.tasks.power_hour = { success: true, count: 0, message: 'No tasks generated' }
        }
      } catch (error) {
        console.error('[cron/jobs/daily] Power Hour generation failed:', error)
        results.tasks.power_hour = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }

      // 4. Send Bedtime Push Notifications (if enabled).
      // Gate only on VAPID config — the daily job is itself scheduled for
      // 21:30 UTC, so re-checking the wall clock here just meant a delayed
      // cron run (common, per CLAUDE.md) silently skipped the push. Also the
      // env var must match the one configured above (NEXT_PUBLIC_VAPID_PUBLIC_KEY);
      // the old VAPID_PUBLIC_KEY was always undefined, so this never ran.
      if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
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

      // 5. Identify Rotting Projects
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

      // 6. Maintenance (Embeddings & Capabilities)
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

      // 7. Metabolism: Recompute heat scores for drawer projects (daily)
      if (userId) {
        try {
          console.log('[cron/jobs/daily] Recomputing heat scores...')
          const heatResult = await recomputeHeatForUser(supabase, userId)
          results.tasks.recompute_heat = { success: true, ...heatResult }
          console.log(`[cron/jobs/daily] Heat recomputed: ${heatResult.updated} updated, ${heatResult.skipped} skipped`)
        } catch (error) {
          console.error('[cron/jobs/daily] Heat recompute failed:', error)
          results.tasks.recompute_heat = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }

      // 8. Metabolism: Generate drawer digest (Sundays only)
      const isSunday = now.getUTCDay() === 0
      if (isSunday && userId) {
        try {
          console.log('[cron/jobs/daily] Generating drawer digest...')
          const { generateDigestForUser } = await import('../_lib/metabolism.js')
          const digestResult = await generateDigestForUser(supabase, userId)
          results.tasks.drawer_digest = { success: true, ...digestResult }
          console.log(`[cron/jobs/daily] Drawer digest: ${digestResult.warmed} warmed, ${digestResult.evolutions} evolutions`)
        } catch (error) {
          console.error('[cron/jobs/daily] Drawer digest failed:', error)
          results.tasks.drawer_digest = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }

      // Evolution events (evolution_events table) are generated once daily
      // by the GitHub Actions cron at 08:00 UTC via POST
      // /api/projects?resource=evolve — not here. This job used to also call
      // evolveProjectsForUser() with an identical prompt against the same
      // active/upcoming projects, so every project got evolved twice a day
      // for no benefit (double the Gemini calls, near-duplicate rows). See
      // git history for the removed duplicate.

      return res.status(200).json(results)

    } else if (job === 'link-all') {
      // Re-link all items using the AI linker
      // Processes items that haven't been linked recently
      // POST /api/cron/jobs?job=link-all to trigger manually
      console.log('[cron/jobs/link-all] Starting full AI re-linking pass...')

      const results: any = {
        success: true,
        job: 'link-all',
        timestamp: new Date().toISOString(),
        processed: 0,
        autoLinked: 0,
        suggestions: 0
      }

      // Fetch all items with embeddings (limit per type to avoid timeouts)
      const [memoriesRes, projectsRes, articlesRes] = await Promise.all([
        supabase.from('memories').select('id, title, body, embedding').not('embedding', 'is', null).limit(50),
        supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(30),
        supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(30)
      ])

      const allItems = [
        ...(memoriesRes.data || []).map(m => ({
          id: m.id, type: 'thought' as const,
          content: [m.title, m.body].filter(Boolean).join('. ').slice(0, 500),
          embedding: m.embedding
        })),
        ...(projectsRes.data || []).map(p => ({
          id: p.id, type: 'project' as const,
          content: [p.title, p.description].filter(Boolean).join('. ').slice(0, 500),
          embedding: p.embedding
        })),
        ...(articlesRes.data || []).map(a => ({
          id: a.id, type: 'article' as const,
          content: [a.title, a.excerpt].filter(Boolean).join('. ').slice(0, 500),
          embedding: a.embedding
        }))
      ]

      console.log(`[cron/jobs/link-all] Processing ${allItems.length} items...`)

      for (const item of allItems) {
        try {
          const baseUrl = process.env.VITE_APP_URL || 'http://localhost:3000'
          const linkRes = await fetch(`${baseUrl}/api/connections?action=link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemId: item.id,
              itemType: item.type,
              content: item.content,
              embedding: item.embedding
            })
          })

          if (linkRes.ok) {
            const data = await linkRes.json() as { autoLinked?: number; suggestions?: number }
            results.processed++
            results.autoLinked += data.autoLinked || 0
            results.suggestions += data.suggestions || 0
          }
        } catch (error) {
          console.error(`[cron/jobs/link-all] Failed to link ${item.type}:${item.id}:`, error)
        }
      }

      console.log(`[cron/jobs/link-all] Done: ${results.processed} processed, ${results.autoLinked} auto-linked, ${results.suggestions} suggested`)
      return res.status(200).json(results)

    } else if (job === 'synthesis') {
      // userId already resolved above
      const mode = req.query.mode as string | undefined
      const suggestions = await runSynthesis(userId, mode)

      console.log(`[cron/jobs] Generated ${suggestions?.length || 0} suggestions`)

      return res.status(200).json({
        success: true,
        job: 'synthesis',
        suggestions_generated: suggestions?.length || 0,
        timestamp: new Date().toISOString()
      })

    } else if (job === 'process_stuck' || job === 'process-memories') {
      // Process any memories stuck in processing (including retrying failed ones)
      // process_stuck: >5 min old (backward compat)
      // process-memories: >30 seconds old (runs every 5 min)
      const ageThreshold = job === 'process-memories'
        ? 30 * 1000  // 30 seconds
        : 5 * 60 * 1000  // 5 minutes

      // Cap matches MAX_PROCESS_ATTEMPTS in process-memory.ts. Filtering here
      // keeps the query cheap and stops us even selecting rows that would be
      // skipped downstream.
      const { data: stuckMemories, error: fetchError } = await supabase
        .from('memories')
        .select('id, title, created_at, process_attempts')
        .eq('processed', false)
        .or('process_attempts.is.null,process_attempts.lt.5')
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

    } else if (job === 'voice-reminder') {
      // Daily "record a voice note" push reminder. Runs every 2h (see
      // .github/workflows/cron.yml), so this can't wait for an exact local-hour
      // match — half of all (timezone, hour) combos would never line up with an
      // even UTC hour and would never fire. Instead it fires once local time has
      // reached the target hour, gated by last_sent_date so it still only sends
      // once per day. Skips anyone who's already captured a memory today or
      // already got today's reminder.
      console.log('[cron/jobs/voice-reminder] Checking voice reminder schedules...')

      const results: any = {
        success: true,
        job: 'voice-reminder',
        timestamp: new Date().toISOString(),
        sent: 0,
        skipped_already_captured: 0,
        skipped_hour_mismatch: 0,
      }

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        results.success = false
        results.error = 'VAPID keys not configured'
        return res.status(200).json(results)
      }

      const { data: schedules, error: schedulesError } = await supabase
        .from('voice_reminder_settings')
        .select('user_id, hour, minute, timezone, last_sent_date')
        .eq('enabled', true)

      if (schedulesError) throw schedulesError

      for (const schedule of schedules || []) {
        const localHour = getUserLocalHour(now, schedule.timezone || 'UTC')
        if (localHour < schedule.hour) {
          results.skipped_hour_mismatch++
          continue
        }

        const localDate = getUserLocalDate(now, schedule.timezone || 'UTC')
        if (schedule.last_sent_date === localDate) continue // already sent today

        const dayStart = new Date(`${localDate}T00:00:00`)
        const { data: todaysMemories, error: memError } = await supabase
          .from('memories')
          .select('id')
          .eq('user_id', schedule.user_id)
          .gte('created_at', dayStart.toISOString())
          .limit(1)

        if (memError) {
          console.error(`[cron/jobs/voice-reminder] Failed to check memories for ${schedule.user_id}:`, memError)
          continue
        }

        if (todaysMemories && todaysMemories.length > 0) {
          results.skipped_already_captured++
          // Mark as sent for today so we don't re-check every hour once
          // they've already captured something.
          await supabase.from('voice_reminder_settings').update({ last_sent_date: localDate }).eq('user_id', schedule.user_id)
          continue
        }

        const { data: subscriptions, error: subError } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', schedule.user_id)

        if (subError) {
          console.error(`[cron/jobs/voice-reminder] Failed to fetch subscriptions for ${schedule.user_id}:`, subError)
          continue
        }

        if (!subscriptions || subscriptions.length === 0) continue

        let anySent = false
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            }, JSON.stringify({
              title: 'What\'s on your mind today?',
              body: 'Tap to record a voice note.',
              url: '/',
            }))
            anySent = true
            results.sent++
          } catch (pushError: any) {
            console.error(`[cron/jobs/voice-reminder] Push failed for ${schedule.user_id}:`, pushError)
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          }
        }

        if (anySent) {
          await supabase.from('voice_reminder_settings').update({ last_sent_date: localDate }).eq('user_id', schedule.user_id)
        }
      }

      return res.status(200).json(results)

    } else {
      return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=daily, ?job=link-all, ?job=synthesis, ?job=process_stuck, ?job=process-memories, or ?job=voice-reminder` })
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

function getUserLocalDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

// Helper for voice-reminder job: current hour (0-23) in the user's timezone.
function getUserLocalHour(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })
  // en-US with hour12: false can format midnight as "24" instead of "0".
  return Number(formatter.format(date)) % 24
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
- Stuck memory processing (every day)
- Bedtime prompts generation (every day)
- Synthesis (Mondays only)
*/
