/**
 * Stories.
 *
 * GET    /api/stories                     -> every story you're in
 * GET    /api/stories?id=X                -> one story, its writers and its stats
 * POST   /api/stories                     -> create one
 * PATCH  /api/stories?id=X                -> rename / re-blurb / change turn mode (owner)
 * POST   /api/stories?id=X&resource=skip  -> nudge past whoever's stalling
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { cleanText, fail, firstParam, handleErrors } from './_lib/http.js'
import { ensureProfile, loadProfiles, loadStory } from './_lib/stories.js'
import { canWrite, nextInRotation, whoseTurn, type TurnMode } from './_lib/turns.js'
import { summarise, type StatLine } from './_lib/stats.js'

const TURN_MODES: TurnMode[] = ['rotation', 'open']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return fail(res, 401, 'Sign in first')

  const supabase = getSupabaseClient()
  const storyId = firstParam(req, 'id')
  const resource = firstParam(req, 'resource')

  return handleErrors(res, async () => {
    if (req.method === 'GET' && storyId) return getStory(res, supabase, userId, storyId)
    if (req.method === 'GET') return listStories(res, supabase, userId)
    if (req.method === 'POST' && resource === 'skip' && storyId) {
      return skipTurn(res, supabase, userId, storyId)
    }
    if (req.method === 'POST') return createStory(req, res, supabase, userId)
    if (req.method === 'PATCH' && storyId) return updateStory(req, res, supabase, userId, storyId)
    return fail(res, 405, 'Method not allowed')
  })
}

type Client = ReturnType<typeof getSupabaseClient>

async function listStories(res: VercelResponse, supabase: Client, userId: string) {
  await ensureProfile(supabase, userId)

  const { data: memberships, error } = await supabase
    .from('story_members')
    .select('story_id')
    .eq('user_id', userId)
  if (error) throw error

  const storyIds = (memberships ?? []).map((m) => m.story_id as string)
  if (storyIds.length === 0) return res.status(200).json({ stories: [] })

  const { data: stories, error: storyError } = await supabase
    .from('stories')
    .select('*')
    .in('id', storyIds)
    .neq('status', 'archived')
    .order('last_line_at', { ascending: false, nullsFirst: false })
  if (storyError) throw storyError

  const { data: members } = await supabase
    .from('story_members')
    .select('story_id, user_id, turn_order')
    .in('story_id', storyIds)
    .order('turn_order')

  // One line per story is enough for the list — the tail of the thread and
  // whether it's your move.
  const { data: recentLines } = await supabase
    .from('lines')
    .select('story_id, author_id, body, position, created_at')
    .in('story_id', storyIds)
    .order('position', { ascending: false })

  const names = await loadProfiles(supabase, (members ?? []).map((m) => m.user_id as string))
  const lastByStory = new Map<string, { author_id: string; body: string }>()
  for (const line of recentLines ?? []) {
    if (!lastByStory.has(line.story_id)) lastByStory.set(line.story_id, line)
  }

  const payload = (stories ?? []).map((story) => {
    const storyMembers = (members ?? []).filter((m) => m.story_id === story.id)
    const last = lastByStory.get(story.id) ?? null
    return {
      ...story,
      members: storyMembers.map((m) => ({ ...m, display_name: names[m.user_id] ?? 'Writer' })),
      last_line: last ? { ...last, display_name: names[last.author_id] ?? 'Writer' } : null,
      whose_turn: whoseTurn({
        mode: story.turn_mode,
        members: storyMembers,
        nextAuthorId: story.next_author_id,
      }),
      can_write: canWrite({
        mode: story.turn_mode,
        members: storyMembers,
        nextAuthorId: story.next_author_id,
        lastAuthorId: last?.author_id ?? null,
        userId,
      }),
    }
  })

  return res.status(200).json({ stories: payload })
}

async function getStory(res: VercelResponse, supabase: Client, userId: string, storyId: string) {
  const loaded = await loadStory(supabase, storyId)
  if (!loaded) return fail(res, 404, 'Story not found')
  if (!loaded.members.some((m) => m.user_id === userId)) {
    return fail(res, 403, "You're not in this story")
  }

  const { data: lines, error } = await supabase
    .from('lines')
    .select('author_id, body, position, created_at, chapter_title')
    .eq('story_id', storyId)
    .order('position')
  if (error) throw error

  const names = await loadProfiles(supabase, loaded.members.map((m) => m.user_id))
  const last = (lines ?? [])[(lines ?? []).length - 1] ?? null

  return res.status(200).json({
    story: loaded.story,
    members: loaded.members.map((m) => ({ ...m, display_name: names[m.user_id] ?? 'Writer' })),
    stats: summarise((lines ?? []) as StatLine[]),
    whose_turn: whoseTurn({
      mode: loaded.story.turn_mode,
      members: loaded.members,
      nextAuthorId: loaded.story.next_author_id,
    }),
    can_write: canWrite({
      mode: loaded.story.turn_mode,
      members: loaded.members,
      nextAuthorId: loaded.story.next_author_id,
      lastAuthorId: last?.author_id ?? null,
      userId,
    }),
  })
}

async function createStory(req: VercelRequest, res: VercelResponse, supabase: Client, userId: string) {
  const title = cleanText(req.body?.title, 120)
  if (!title) return fail(res, 400, 'Give the story a title')

  const blurb = req.body?.blurb ? cleanText(req.body.blurb, 400) : null
  const turnMode: TurnMode = TURN_MODES.includes(req.body?.turn_mode) ? req.body.turn_mode : 'rotation'

  await ensureProfile(supabase, userId)

  const { data: story, error } = await supabase
    .from('stories')
    .insert({ title, blurb, created_by: userId, turn_mode: turnMode, next_author_id: userId })
    .select('*')
    .single()
  if (error) throw error

  const { error: memberError } = await supabase
    .from('story_members')
    .insert({ story_id: story.id, user_id: userId, role: 'owner' })
  if (memberError) throw memberError

  return res.status(201).json({ story })
}

async function updateStory(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Client,
  userId: string,
  storyId: string
) {
  const loaded = await loadStory(supabase, storyId)
  if (!loaded) return fail(res, 404, 'Story not found')

  const me = loaded.members.find((m) => m.user_id === userId)
  if (!me) return fail(res, 403, "You're not in this story")
  if (me.role !== 'owner') return fail(res, 403, 'Only the person who started it can change this')

  const updates: Record<string, unknown> = {}
  if (req.body?.title !== undefined) {
    const title = cleanText(req.body.title, 120)
    if (!title) return fail(res, 400, 'Give the story a title')
    updates.title = title
  }
  if (req.body?.blurb !== undefined) updates.blurb = cleanText(req.body.blurb, 400)
  if (req.body?.turn_mode !== undefined) {
    if (!TURN_MODES.includes(req.body.turn_mode)) return fail(res, 400, 'Unknown turn mode')
    updates.turn_mode = req.body.turn_mode
  }
  if (req.body?.status !== undefined) {
    if (!['active', 'finished', 'archived'].includes(req.body.status)) {
      return fail(res, 400, 'Unknown status')
    }
    updates.status = req.body.status
  }
  if (Object.keys(updates).length === 0) return fail(res, 400, 'Nothing to update')

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('stories')
    .update(updates)
    .eq('id', storyId)
    .select('*')
    .single()
  if (error) throw error

  return res.status(200).json({ story: data })
}

/**
 * Skip. Any member can move the turn on — a strict rotation is only worth
 * having if it can't wedge the story when someone's away for a fortnight.
 */
async function skipTurn(res: VercelResponse, supabase: Client, userId: string, storyId: string) {
  const loaded = await loadStory(supabase, storyId)
  if (!loaded) return fail(res, 404, 'Story not found')
  if (!loaded.members.some((m) => m.user_id === userId)) {
    return fail(res, 403, "You're not in this story")
  }
  if (loaded.story.turn_mode !== 'rotation') {
    return fail(res, 400, 'This story is open — anyone can write, so there is nothing to skip')
  }

  const current = whoseTurn({
    mode: 'rotation',
    members: loaded.members,
    nextAuthorId: loaded.story.next_author_id,
  })
  const next = nextInRotation(loaded.members, current)

  const { error } = await supabase
    .from('stories')
    .update({ next_author_id: next, updated_at: new Date().toISOString() })
    .eq('id', storyId)
  if (error) throw error

  return res.status(200).json({ whose_turn: next })
}
