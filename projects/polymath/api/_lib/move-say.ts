/**
 * What someone says about a project, read against its one next move.
 *
 * Shared by the move box's "say" and by Update (project-update.ts), so the
 * card and the reply can't disagree. If they've done the move it is logged as
 * done BEFORE the next move is written, so the writer sees it in the log and
 * moves on instead of repeating it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { logMoveDone, readSaid } from './move-said.js'
import { writeNextMove, type NextMove } from './next-move.js'
import { loadMoveContext, saveMove, type MoveContext } from './next-move-store.js'

export const MAX_SAID_CHARS = 2000

/** Reads `said` against the move on the card. Mutates `ctx.input` so the
 *  writer sees what was said and what was done. */
export async function applySaidToMove(
  supabase: SupabaseClient, userId: string, projectId: string, ctx: MoveContext, said: string,
): Promise<{ loggedDone: string | null; projectDone: boolean }> {
  ctx.input.said = said.slice(0, MAX_SAID_CHARS)
  let loggedDone: string | null = null
  let projectDone = false
  if (ctx.current?.kind === 'move') {
    const verdict = await readSaid(ctx.current.text, said, prompt => generateText(prompt, {
      model: MODELS.SESSION_SHAPE_CHAT, responseFormat: 'json', temperature: 0, maxTokens: 80, thinkingLevel: 'low',
    }))
    if (verdict.moveDone) {
      loggedDone = await logMoveDone(supabase, userId, projectId, ctx.current.text)
      if (loggedDone) ctx.input.did = [...ctx.input.did, loggedDone]
    }
    projectDone = verdict.projectDone
  }
  return { loggedDone, projectDone }
}

/** For Update: if the project has a stored move, read the update against it,
 *  log it done if it was, and write the next one. A project that only has
 *  "Keep in mind" lines, or a fork still waiting for an answer, has nothing
 *  to do here. */
export async function moveFromUpdate(
  supabase: SupabaseClient, userId: string, projectId: string, said: string,
): Promise<{ move: NextMove; logged: string | null; projectDone: boolean } | null> {
  const ctx = await loadMoveContext(supabase, userId, projectId)
  if (!ctx || ctx.current?.kind !== 'move') return null
  try {
    const { loggedDone, projectDone } = await applySaidToMove(supabase, userId, projectId, ctx, said)
    const { move } = await writeNextMove(ctx.input, 'reshape')
    await saveMove(supabase, userId, projectId, move)
    return { move, logged: loggedDone, projectDone }
  } catch (e) {
    console.warn('[project-update] could not move the move on:', e instanceof Error ? e.message : e)
    return null
  }
}
