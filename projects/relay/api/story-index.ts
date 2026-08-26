/**
 * The story index.
 *
 * GET  /api/story-index?story=X -> the cached index, and whether it's behind
 * POST /api/story-index?story=X -> rebuild it from the story as it stands
 *
 * Nothing here writes or suggests story text. It reads what the two of them
 * wrote and points back at line numbers.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { fail, firstParam, handleErrors } from './_lib/http.js'
import { loadStory } from './_lib/stories.js'
import { generateIndex, geminiConfigured } from './_lib/index/generate.js'
import { isEmptyIndex, type SourceLine, type StoryIndex } from './_lib/index/ground.js'

const MIN_LINES = 6

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

    const { data: latest } = await supabase
      .from('lines')
      .select('position')
      .eq('story_id', storyId)
      .order('position', { ascending: false })
      .limit(1)
    const lastPosition = latest?.[0]?.position ?? 0

    if (req.method === 'GET') {
      const { data: cached } = await supabase
        .from('story_index')
        .select('payload, up_to_position, generated_at')
        .eq('story_id', storyId)
        .maybeSingle()

      return res.status(200).json({
        index: (cached?.payload as StoryIndex) ?? null,
        generated_at: cached?.generated_at ?? null,
        up_to_position: cached?.up_to_position ?? 0,
        last_position: lastPosition,
        // How many lines have been written since it was last built.
        behind_by: Math.max(0, lastPosition - (cached?.up_to_position ?? 0)),
        available: geminiConfigured(),
        enough_lines: lastPosition >= MIN_LINES,
      })
    }

    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')

    if (!geminiConfigured()) return fail(res, 503, 'The index needs GEMINI_KEY set on the server')
    if (lastPosition < MIN_LINES) {
      return fail(res, 409, `Write a few more lines first — the index needs at least ${MIN_LINES}`)
    }

    const { data: lines, error } = await supabase
      .from('lines')
      .select('position, body')
      .eq('story_id', storyId)
      .order('position')
    if (error) throw error

    const index = await generateIndex((lines ?? []) as SourceLine[])

    if (isEmptyIndex(index)) {
      return fail(res, 422, "Nothing in the story could be indexed yet. Try again once there's more of it.")
    }

    const { error: saveError } = await supabase.from('story_index').upsert(
      {
        story_id: storyId,
        payload: index,
        up_to_position: lastPosition,
        built_by: userId,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'story_id' }
    )
    if (saveError) throw saveError

    return res.status(200).json({
      index,
      generated_at: new Date().toISOString(),
      up_to_position: lastPosition,
      last_position: lastPosition,
      behind_by: 0,
      available: true,
      enough_lines: true,
    })
  })
}
