/**
 * Lines — the story itself.
 *
 * GET  /api/lines?story=X[&from=1&limit=500]  -> lines in order, plus the total
 * POST /api/lines?story=X                     -> add the next line
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { cleanText, fail, firstParam, handleErrors } from './_lib/http.js'
import { loadProfiles, loadStory } from './_lib/stories.js'
import { canWrite, whoseTurn } from './_lib/turns.js'
import { notifyStory } from './_lib/notify.js'

const MAX_PAGE = 500

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return fail(res, 401, 'Sign in first')

  const storyId = firstParam(req, 'story')
  if (!storyId) return fail(res, 400, 'Which story?')

  const supabase = getSupabaseClient()

  return handleErrors(res, async () => {
    const loaded = await loadStory(supabase, storyId)
    if (!loaded) return fail(res, 404, 'Story not found')
    if (!loaded.members.some((m) => m.user_id === userId)) {
      return fail(res, 403, "You're not in this story")
    }

    if (req.method === 'GET') return listLines(req, res, supabase, storyId, loaded.members)
    if (req.method === 'POST') return addLine(req, res, supabase, userId, storyId, loaded)
    return fail(res, 405, 'Method not allowed')
  })
}

type Client = ReturnType<typeof getSupabaseClient>
type Loaded = NonNullable<Awaited<ReturnType<typeof loadStory>>>

async function listLines(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Client,
  storyId: string,
  members: Loaded['members']
) {
  const from = Number(firstParam(req, 'from') ?? 1)
  const limit = Math.min(Number(firstParam(req, 'limit') ?? MAX_PAGE), MAX_PAGE)

  const { data, error } = await supabase
    .from('lines')
    .select('id, author_id, body, position, created_at, chapter_title')
    .eq('story_id', storyId)
    .gte('position', Number.isFinite(from) ? from : 1)
    .order('position')
    .limit(Number.isFinite(limit) && limit > 0 ? limit : MAX_PAGE)
  if (error) throw error

  const { count } = await supabase
    .from('lines')
    .select('id', { count: 'exact', head: true })
    .eq('story_id', storyId)

  const names = await loadProfiles(supabase, members.map((m) => m.user_id))

  return res.status(200).json({
    lines: (data ?? []).map((line) => ({ ...line, display_name: names[line.author_id] ?? 'Writer' })),
    total: count ?? 0,
  })
}

async function addLine(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Client,
  userId: string,
  storyId: string,
  loaded: Loaded
) {
  const { story, members } = loaded

  if (story.status !== 'active') return fail(res, 409, 'This story is finished')

  const body = cleanText(req.body?.body, 2000)
  if (!body) return fail(res, 400, 'Write a line first')

  const chapterTitle = req.body?.chapter_title ? cleanText(req.body.chapter_title, 120) : null

  const { data: lastRows } = await supabase
    .from('lines')
    .select('author_id')
    .eq('story_id', storyId)
    .order('position', { ascending: false })
    .limit(1)
  const lastAuthorId = lastRows?.[0]?.author_id ?? null

  const allowed = canWrite({
    mode: story.turn_mode,
    members,
    nextAuthorId: story.next_author_id,
    lastAuthorId,
    userId,
  })
  if (!allowed) {
    return fail(
      res,
      409,
      story.turn_mode === 'rotation'
        ? "It's not your turn yet"
        : 'You wrote the last line — someone else goes next'
    )
  }

  // The position trigger and the unique index race with a simultaneous post.
  // One retry is enough: the loser re-reads and takes the next number.
  let inserted = null
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const { data, error } = await supabase
      .from('lines')
      .insert({ story_id: storyId, author_id: userId, body, chapter_title: chapterTitle })
      .select('id, author_id, body, position, created_at, chapter_title')
      .single()

    if (!error) {
      inserted = data
      break
    }
    if (error.code !== '23505') throw error
  }
  if (!inserted) return fail(res, 409, 'Someone else just wrote — have another look')

  await sendTurnNotification(supabase, { storyId, story, members, userId, body })

  return res.status(201).json({ line: inserted })
}

async function sendTurnNotification(
  supabase: Client,
  opts: {
    storyId: string
    story: Loaded['story']
    members: Loaded['members']
    userId: string
    body: string
  }
) {
  try {
    const names = await loadProfiles(supabase, [opts.userId])
    const author = names[opts.userId] ?? 'Someone'

    // next_author_id was just moved on by the database trigger.
    const { data: fresh } = await supabase
      .from('stories')
      .select('next_author_id')
      .eq('id', opts.storyId)
      .maybeSingle()

    const upNext = whoseTurn({
      mode: opts.story.turn_mode,
      members: opts.members,
      nextAuthorId: fresh?.next_author_id ?? null,
    })

    const preview = opts.body.length > 140 ? `${opts.body.slice(0, 137)}…` : opts.body
    const url = `/story/${opts.storyId}`

    await notifyStory(supabase, {
      storyId: opts.storyId,
      exceptUserId: opts.userId,
      payload: (recipient) => {
        const yours = opts.story.turn_mode === 'open' || recipient === upNext
        return {
          title: yours ? `Your turn — ${opts.story.title}` : opts.story.title,
          body: `${author}: ${preview}`,
          url,
          tag: `story-${opts.storyId}`,
        }
      },
    })
  } catch (e) {
    // A push that doesn't send must never lose the line that triggered it.
    console.error('[relay/lines] notification failed:', e)
  }
}
