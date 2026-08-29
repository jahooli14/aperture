/**
 * The streak-loss nudge — fired hourly, from a GitHub Actions schedule
 * rather than Relay's own Vercel cron (that slot is spent on the daily
 * turn-gone-cold nudge, and Hobby allows one). Each firing checks whether
 * it's currently 6pm in any writer's own saved timezone, and if the story's
 * streak is alive but nothing has been written today, sends them one push.
 *
 * Only fires for someone who can actually act: whoever's turn it is in a
 * rotation story, or anyone but the last writer in an open one. Nudging
 * someone who isn't allowed to write yet would just be noise.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_lib/supabase.js'
import { computeStreak, localDateKey, localHour } from '../_lib/streaks.js'
import { canWrite } from '../_lib/turns.js'
import { notifyUser } from '../_lib/notify.js'

const NUDGE_HOUR = 18

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Not authorised' })
  }

  const supabase = getSupabaseClient()
  const now = new Date()

  try {
    const { data: stories, error } = await supabase
      .from('stories')
      .select('id, title, turn_mode, next_author_id')
      .eq('status', 'active')
    if (error) throw error

    const nudged: string[] = []

    for (const story of stories ?? []) {
      const { data: members } = await supabase
        .from('story_members')
        .select('user_id, turn_order, timezone, last_streak_alert_sent_on')
        .eq('story_id', story.id)
      if (!members || members.length < 2) continue

      const { data: lines } = await supabase
        .from('lines')
        .select('author_id, created_at')
        .eq('story_id', story.id)
        .order('position', { ascending: true })
      if (!lines || lines.length === 0) continue

      const lastAuthorId = lines[lines.length - 1].author_id
      const streak = computeStreak(lines.map((l) => l.created_at))
      if (streak.activeToday || streak.current < 1) continue

      for (const member of members) {
        if (!member.timezone) continue
        if (localHour(now, member.timezone) !== NUDGE_HOUR) continue

        const today = localDateKey(now, member.timezone)
        if (member.last_streak_alert_sent_on === today) continue

        const eligible = canWrite({
          mode: story.turn_mode,
          members,
          nextAuthorId: story.next_author_id,
          lastAuthorId,
          userId: member.user_id,
        })
        if (!eligible) continue

        const { sent } = await notifyUser(supabase, member.user_id, {
          title: `Keep the streak going — ${story.title}`,
          body:
            streak.current === 1
              ? "You've written today for the first day running. Add a line to make it two."
              : `${streak.current} days running. Add a line before midnight to keep it going.`,
          url: `/story/${story.id}`,
          tag: `streak-${story.id}`,
        })

        await supabase
          .from('story_members')
          .update({ last_streak_alert_sent_on: today })
          .eq('story_id', story.id)
          .eq('user_id', member.user_id)

        nudged.push(`${story.title} -> ${member.user_id.slice(0, 8)} (${sent} device${sent === 1 ? '' : 's'})`)
      }
    }

    return res.status(200).json({ nudged })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Streak check failed'
    console.error('[relay/cron/streak-check]', message, e)
    return res.status(500).json({ error: message })
  }
}
