/**
 * Writers on a story — inviting, joining, leaving.
 *
 * POST   /api/members?story=X&resource=invite -> mint an invite code (owner)
 * GET    /api/members?resource=preview&code=C -> what you'd be joining
 * POST   /api/members?resource=join           -> redeem a code
 * PATCH  /api/members?story=X                 -> turn your own notifications on/off
 * DELETE /api/members?story=X[&user=U]        -> leave, or remove someone (owner)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { fail, firstParam, handleErrors } from './_lib/http.js'
import { ensureProfile, loadProfiles, loadStory, makeInviteCode } from './_lib/stories.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return fail(res, 401, 'Sign in first')

  const supabase = getSupabaseClient()
  const storyId = firstParam(req, 'story')
  const resource = firstParam(req, 'resource')

  return handleErrors(res, async () => {
    if (req.method === 'GET' && resource === 'preview') return previewInvite(req, res, supabase)
    if (req.method === 'POST' && resource === 'join') return joinStory(req, res, supabase, userId)
    if (!storyId) return fail(res, 400, 'Which story?')
    if (req.method === 'POST' && resource === 'invite') {
      return createInvite(req, res, supabase, userId, storyId)
    }
    if (req.method === 'PATCH') return setNotify(req, res, supabase, userId, storyId)
    if (req.method === 'DELETE') return removeMember(req, res, supabase, userId, storyId)
    return fail(res, 405, 'Method not allowed')
  })
}

type Client = ReturnType<typeof getSupabaseClient>

async function createInvite(
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
  if (me.role !== 'owner') return fail(res, 403, 'Only the person who started it can invite')

  const remaining = loaded.story.max_members - loaded.members.length
  if (remaining <= 0) {
    return fail(res, 409, `This story is full at ${loaded.story.max_members} writers`)
  }

  const requested = Number(req.body?.max_uses ?? 1)
  const maxUses = Math.min(Math.max(Number.isFinite(requested) ? requested : 1, 1), remaining)

  const { data, error } = await supabase
    .from('invites')
    .insert({ story_id: storyId, code: makeInviteCode(), created_by: userId, max_uses: maxUses })
    .select('code, expires_at, max_uses')
    .single()
  if (error) throw error

  return res.status(201).json({ invite: data })
}

async function previewInvite(req: VercelRequest, res: VercelResponse, supabase: Client) {
  const code = (firstParam(req, 'code') ?? '').trim().toUpperCase()
  if (!code) return fail(res, 400, 'No code given')

  const { data: invite } = await supabase
    .from('invites')
    .select('story_id, expires_at, revoked_at, uses, max_uses')
    .eq('code', code)
    .maybeSingle()

  if (!invite) return fail(res, 404, 'That code is not valid')
  if (invite.revoked_at) return fail(res, 410, 'That invite has been cancelled')
  if (Date.parse(invite.expires_at) < Date.now()) return fail(res, 410, 'That invite has expired')
  if (invite.uses >= invite.max_uses) return fail(res, 410, 'That invite has already been used')

  const loaded = await loadStory(supabase, invite.story_id)
  if (!loaded) return fail(res, 404, 'Story not found')

  const names = await loadProfiles(supabase, loaded.members.map((m) => m.user_id))

  return res.status(200).json({
    story: { id: loaded.story.id, title: loaded.story.title, blurb: loaded.story.blurb },
    writers: loaded.members.map((m) => names[m.user_id] ?? 'Writer'),
  })
}

async function joinStory(req: VercelRequest, res: VercelResponse, supabase: Client, userId: string) {
  const code = String(req.body?.code ?? '').trim().toUpperCase()
  if (!code) return fail(res, 400, 'Enter your invite code')

  await ensureProfile(supabase, userId)

  const { data, error } = await supabase.rpc('redeem_invite', { invite_code: code, joiner: userId })
  if (error) {
    // The function raises for every "you can't join" case with a readable
    // message; pass it straight through rather than inventing one.
    return fail(res, 409, error.message.replace(/^.*?:\s*/, '') || 'That code is not valid')
  }

  return res.status(200).json({ story_id: data })
}

async function setNotify(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Client,
  userId: string,
  storyId: string
) {
  if (typeof req.body?.notify !== 'boolean') return fail(res, 400, 'notify must be true or false')

  const { error } = await supabase
    .from('story_members')
    .update({ notify: req.body.notify })
    .eq('story_id', storyId)
    .eq('user_id', userId)
  if (error) throw error

  return res.status(200).json({ notify: req.body.notify })
}

async function removeMember(
  req: VercelRequest,
  res: VercelResponse,
  supabase: Client,
  userId: string,
  storyId: string
) {
  const target = firstParam(req, 'user') ?? userId

  const loaded = await loadStory(supabase, storyId)
  if (!loaded) return fail(res, 404, 'Story not found')

  const me = loaded.members.find((m) => m.user_id === userId)
  if (!me) return fail(res, 403, "You're not in this story")
  if (target !== userId && me.role !== 'owner') {
    return fail(res, 403, 'Only the person who started it can remove someone')
  }
  if (target === userId && me.role === 'owner' && loaded.members.length > 1) {
    return fail(res, 409, 'Hand the story over before you leave it')
  }

  const { error } = await supabase
    .from('story_members')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', target)
  if (error) throw error

  // Whoever was up may have just left. Point the turn at the top of the queue
  // so the story can carry on.
  if (loaded.story.next_author_id === target) {
    const remaining = loaded.members.filter((m) => m.user_id !== target)
    await supabase
      .from('stories')
      .update({ next_author_id: remaining[0]?.user_id ?? null })
      .eq('id', storyId)
  }

  return res.status(200).json({ removed: target })
}
