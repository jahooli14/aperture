/**
 * POST /api/stories?id=X&resource=nudge — tell whoever's up that the story is
 * waiting on them. Rules live in nudge.ts; this is the IO around them.
 */
import type { VercelResponse } from '@vercel/node'
import type { RelayClient } from './supabase.js'
import { fail } from './http.js'
import { loadProfiles, loadStory } from './stories.js'
import { notifyUser } from './notify.js'
import { nudgeAllowed, nudgeRecipients } from './nudge.js'

export async function nudgeTurn(
  res: VercelResponse,
  supabase: RelayClient,
  userId: string,
  storyId: string
) {
  const loaded = await loadStory(supabase, storyId)
  if (!loaded) return fail(res, 404, 'Story not found')
  const { story, members } = loaded
  if (!members.some((m) => m.user_id === userId)) return fail(res, 403, "You're not in this story")
  if (story.status !== 'active') return fail(res, 409, 'This story is finished')

  const { data: lastRows, error } = await supabase
    .from('lines')
    .select('author_id, body, created_at')
    .eq('story_id', storyId)
    .order('position', { ascending: false })
    .limit(1)
  if (error) throw error
  const last = lastRows?.[0] ?? null

  const recipients = nudgeRecipients({
    mode: story.turn_mode,
    members,
    nextAuthorId: story.next_author_id,
    lastAuthorId: last?.author_id ?? null,
    userId,
  })
  if (recipients.length === 0) return fail(res, 409, "It's your turn — no one to nudge")

  const now = new Date().toISOString()
  if (!nudgeAllowed({ lastLineAt: last?.created_at ?? null, lastNudgeAt: story.last_nudge_at, now })) {
    return fail(res, 429, 'Already nudged — give them a day')
  }

  // Stamped before sending, so a double tap can't send two.
  const { error: stampError } = await supabase
    .from('stories')
    .update({ last_nudge_at: now })
    .eq('id', storyId)
  if (stampError) throw stampError

  const names = await loadProfiles(supabase, [userId])
  const from = names[userId] ?? 'Someone'
  const preview = last ? (last.body.length > 110 ? `${last.body.slice(0, 107)}…` : last.body) : null

  // Someone who muted this story muted nudges too.
  const listening = new Set(members.filter((m) => m.notify).map((m) => m.user_id))

  let sent = 0
  for (const recipient of recipients.filter((id) => listening.has(id))) {
    const result = await notifyUser(supabase, recipient, {
      title: `${from} nudged you — ${story.title}`,
      body: preview ? `Your turn. The last line: ${preview}` : 'Your turn.',
      url: `/story/${storyId}`,
      tag: `story-${storyId}`,
    })
    sent += result.sent
  }

  return res.status(200).json({ nudged: recipients.length, sent })
}
