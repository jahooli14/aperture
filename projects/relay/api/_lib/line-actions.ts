/**
 * The two things you can do to a line that already exists: fix a typo in your
 * own most recent one, and mark someone else's as good.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { RelayClient } from './supabase.js'
import { cleanText, fail, firstParam } from './http.js'

/**
 * Long enough to fix a typo you spotted as you sent it, short enough that the
 * record stays honest.
 */
export const EDIT_WINDOW_MS = 5 * 60_000

export async function editLine(
  req: VercelRequest,
  res: VercelResponse,
  supabase: RelayClient,
  userId: string,
  storyId: string
) {
  const lineId = firstParam(req, 'line')
  if (!lineId) return fail(res, 400, 'Which line?')

  const body = cleanText(req.body?.body, 2000)
  if (!body) return fail(res, 400, 'A line cannot be empty')

  const { data: line } = await supabase
    .from('lines')
    .select('id, author_id, position, created_at')
    .eq('id', lineId)
    .eq('story_id', storyId)
    .maybeSingle()

  if (!line) return fail(res, 404, 'That line is gone')
  if (line.author_id !== userId) return fail(res, 403, 'You can only edit your own lines')

  if (Date.now() - Date.parse(line.created_at) > EDIT_WINDOW_MS) {
    return fail(res, 409, 'Too late to edit that one — it has been sent a while')
  }

  // Editing a line someone has already replied to would rewrite what they were
  // answering, so only the newest line can change.
  const { data: newest } = await supabase
    .from('lines')
    .select('position')
    .eq('story_id', storyId)
    .order('position', { ascending: false })
    .limit(1)

  if ((newest?.[0]?.position ?? 0) !== line.position) {
    return fail(res, 409, 'Someone has written since — that line is part of the story now')
  }

  const { data: updated, error } = await supabase
    .from('lines')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', lineId)
    .select('id, author_id, body, position, created_at, chapter_title, edited_at')
    .single()
  if (error) throw error

  return res.status(200).json({ line: updated })
}

/** One tap to say a line landed. Deliberately silent — no push, no reply. */
export async function toggleMark(
  req: VercelRequest,
  res: VercelResponse,
  supabase: RelayClient,
  userId: string,
  storyId: string
) {
  const lineId = req.body?.line_id
  if (typeof lineId !== 'string') return fail(res, 400, 'Which line?')

  const { data: line } = await supabase
    .from('lines')
    .select('id')
    .eq('id', lineId)
    .eq('story_id', storyId)
    .maybeSingle()
  if (!line) return fail(res, 404, 'That line is gone')

  const { data: existing } = await supabase
    .from('line_marks')
    .select('line_id')
    .eq('line_id', lineId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    await supabase.from('line_marks').delete().eq('line_id', lineId).eq('user_id', userId)
  } else {
    await supabase.from('line_marks').insert({ line_id: lineId, user_id: userId })
  }

  const { count } = await supabase
    .from('line_marks')
    .select('line_id', { count: 'exact', head: true })
    .eq('line_id', lineId)

  return res.status(200).json({ marked: !existing, marks: count ?? 0 })
}
