/**
 * One reminder when a turn goes cold.
 *
 * The only push until now fired the moment someone wrote a line. Miss it and
 * there is silence forever, which is how a thread quietly dies — so once a
 * turn has been sitting for a few days, the person who owes a line gets a
 * single nudge with the line they're following. Once, not daily: nagging is
 * worse than forgetting.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from '../_lib/supabase.js'
import { loadProfiles } from '../_lib/stories.js'
import { notifyUser } from '../_lib/notify.js'

const NUDGE_AFTER_DAYS = 3
const QUIET_PERIOD_DAYS = 4

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.authorization
  if (secret && header !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Not authorised' })
  }

  const supabase = getSupabaseClient()

  try {
    const quietSince = new Date(Date.now() - QUIET_PERIOD_DAYS * 86_400_000).toISOString()

    const { data: stale, error } = await supabase
      .from('stale_turns')
      .select('story_id, title, next_author_id, last_line_at, last_nudge_at, days_waiting')
      .gte('days_waiting', NUDGE_AFTER_DAYS)
      .or(`last_nudge_at.is.null,last_nudge_at.lt.${quietSince}`)
    if (error) throw error

    const nudged: string[] = []

    for (const story of stale ?? []) {
      const { data: lastLines } = await supabase
        .from('lines')
        .select('body, author_id')
        .eq('story_id', story.story_id)
        .order('position', { ascending: false })
        .limit(1)

      const last = lastLines?.[0]
      const names = last ? await loadProfiles(supabase, [last.author_id]) : {}
      const author = last ? names[last.author_id] ?? 'They' : null
      const preview = last
        ? last.body.length > 110
          ? `${last.body.slice(0, 107)}…`
          : last.body
        : null

      const days = Math.floor(Number(story.days_waiting))
      const waited = days === 1 ? 'a day' : days < 14 ? `${days} days` : `${Math.round(days / 7)} weeks`

      const { sent } = await notifyUser(supabase, story.next_author_id, {
        title: `Still your turn — ${story.title}`,
        body: preview ? `${waited} since ${author} wrote: ${preview}` : `${waited} since the last line.`,
        url: `/story/${story.story_id}`,
        tag: `story-${story.story_id}`,
      })

      // Stamped whether or not a push landed, so a person with notifications
      // off doesn't get retried every single day.
      await supabase
        .from('stories')
        .update({ last_nudge_at: new Date().toISOString() })
        .eq('id', story.story_id)

      nudged.push(`${story.title} (${sent} device${sent === 1 ? '' : 's'})`)
    }

    return res.status(200).json({ considered: stale?.length ?? 0, nudged })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nudge failed'
    console.error('[relay/cron/nudge]', message, e)
    return res.status(500).json({ error: message })
  }
}
