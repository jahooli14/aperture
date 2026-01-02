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
 * - Pupils reminders (send-reminders job)
 *
 * Route with ?job= query parameter:
 * - /api/cron/jobs?job=daily (auto-scheduled)
 * - /api/cron/jobs?job=synthesis (manual or weekly)
 * - /api/cron/jobs?job=strengthen (manual)
 * - /api/cron/jobs?job=process_stuck (manual)
 * - /api/cron/jobs?job=send-reminders (Pupils daily reminders)
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
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

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

      // 2. Process stuck memories (including retrying failed ones)
      try {
        const { data: stuckMemories, error: fetchError } = await supabase
          .from('memories')
          .select('id, title, created_at')
          .eq('processed', false)
          // Removed .is('error', null) to allow retrying failed memories
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

      // 4b. Generate Power Hour Plan (Pre-calculation for instant load)
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

      // 5. Send Bedtime Push Notifications (if enabled)
      if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && now.getHours() === 21 && now.getMinutes() >= 30) { // Check if it's 9:30 PM UTC
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
      // Process any memories stuck in processing (including retrying failed ones)
      // process_stuck: >5 min old (backward compat)
      // process-memories: >30 seconds old (runs every 5 min)
      const ageThreshold = job === 'process-memories'
        ? 30 * 1000  // 30 seconds
        : 5 * 60 * 1000  // 5 minutes

      const { data: stuckMemories, error: fetchError } = await supabase
        .from('memories')
        .select('id, title, created_at')
        .eq('processed', false)
        // Removed .is('error', null) to allow retrying failed memories
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

    } else if (job === 'send-reminders') {
      // Pupils daily reminders
      console.log('[cron/jobs/send-reminders] Starting Pupils reminder job...')

      const resend = new Resend(process.env.RESEND_API_KEY)
      const pupilsSupabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: users, error: usersError } = await pupilsSupabase
        .from('user_settings')
        .select('user_id, reminder_email, reminder_time, timezone, push_subscription')
        .eq('reminders_enabled', true)

      if (usersError) {
        console.error('[cron/jobs/send-reminders] Error fetching users:', usersError)
        return res.status(500).json({ error: 'Failed to fetch users' })
      }

      if (!users || users.length === 0) {
        return res.status(200).json({ message: 'No users with reminders enabled', sent: 0 })
      }

      console.log(`[cron/jobs/send-reminders] Checking reminders for ${users.length} users...`)

      const emailsSent: string[] = []
      const pushSent: string[] = []
      const errors: { userId: string; error: string }[] = []

      for (const user of users) {
        // Check if user already uploaded today
        const now = new Date()
        const userLocalDate = getUserLocalDate(now, user.timezone || 'UTC')

        const { data: photos, error: photosError } = await pupilsSupabase
          .from('photos')
          .select('id')
          .eq('user_id', user.user_id)
          .gte('capture_date', userLocalDate)
          .lt('capture_date', new Date(new Date(userLocalDate).getTime() + 24 * 60 * 60 * 1000).toISOString())

        if (photosError) {
          console.error(`[cron/jobs/send-reminders] Error checking photos for user ${user.user_id}:`, photosError)
          errors.push({ userId: user.user_id, error: photosError.message })
          continue
        }

        // If user already uploaded today, skip
        if (photos && photos.length > 0) {
          continue
        }

        // Try push notification first (preferred for mobile)
        let pushSuccess = false
        if (user.push_subscription) {
          try {
            const payload = JSON.stringify({
              title: 'Don\'t forget today\'s photo! 📸',
              body: 'Keep the streak alive and capture today\'s memory',
              url: '/?upload=true'
            })

            await webpush.sendNotification(user.push_subscription, payload)
            pushSent.push(user.user_id)
            pushSuccess = true
            console.log(`[cron/jobs/send-reminders] Push notification sent to user ${user.user_id}`)
          } catch (pushError: any) {
            console.error(`[cron/jobs/send-reminders] Failed to send push to user ${user.user_id}:`, pushError)

            // If subscription is expired/invalid, remove it
            if (pushError.statusCode === 410 || pushError.statusCode === 404) {
              await pupilsSupabase
                .from('user_settings')
                .update({ push_subscription: null })
                .eq('user_id', user.user_id)
              console.log(`[cron/jobs/send-reminders] Removed expired push subscription for user ${user.user_id}`)
            }
          }
        }

        // Fall back to email if push failed or not available
        if (!pushSuccess && user.reminder_email) {
          try {
            await resend.emails.send({
              from: 'Pupils <onboarding@resend.dev>',
              to: user.reminder_email,
              subject: "Don't forget today's photo! 📸",
              html: generateEmailHTML(user.user_id),
            })

            emailsSent.push(user.reminder_email)
            console.log(`[cron/jobs/send-reminders] Email reminder sent to ${user.reminder_email}`)
          } catch (emailError) {
            console.error(`[cron/jobs/send-reminders] Failed to send email to ${user.reminder_email}:`, emailError)
            errors.push({
              userId: user.user_id,
              error: emailError instanceof Error ? emailError.message : String(emailError)
            })
          }
        }
      }

      return res.status(200).json({
        success: true,
        job: 'send-reminders',
        pushNotifications: pushSent.length,
        emailsSent: emailsSent.length,
        total: pushSent.length + emailsSent.length,
        pushRecipients: pushSent,
        emailRecipients: emailsSent,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      })

    } else {
      return res.status(400).json({ error: `Unknown job: ${job}. Use ?job=daily, ?job=synthesis, ?job=strengthen, ?job=process_stuck, ?job=process-memories, or ?job=send-reminders` })
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

// Helper functions for send-reminders job
function getUserLocalDate(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function generateEmailHTML(userId: string): string {
  const appUrl = process.env.VITE_APP_URL || 'https://aperture-production.vercel.app'
  const uploadUrl = `${appUrl}?upload=true`
  const settingsUrl = `${appUrl}?settings=true`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Photo Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <tr>
      <td style="padding: 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h1 style="margin: 0; color: white; font-size: 32px;">📸</h1>
        <h2 style="margin: 10px 0 0 0; color: white; font-size: 24px; font-weight: 600;">Pupils</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">Don't forget today's photo!</h2>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
          Hi there! 👋
        </p>
        <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px; line-height: 1.6;">
          You haven't captured today's memory yet. Take a quick photo to keep your daily journey going!
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="${uploadUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Upload Today's Photo</a>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
          Keep the streak alive and watch your baby grow day by day! ✨
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; text-align: center;">
          You're receiving this because you have daily reminders enabled.
          <br>
          <a href="${settingsUrl}" style="color: #667eea; text-decoration: none;">Manage your settings</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
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
