/**
 * What someone says to a project's next move: "I did that", "got the first
 * cut done, the left side is 2cm low", "the whole table is done".
 *
 * This is the one place free text about a project lands now. The Guide chat
 * that used to sit above the move did the same job on a different engine: it
 * read the old step list, said "I've marked it done" and only proposed it,
 * and named a different next step from the card right below it. Here the
 * answer is read against the ONE move on the card, and when they say they've
 * done it, it is logged as done for real before the next move is written.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { stripDoneWhen } from './session-items.js'

export interface SaidVerdict {
  /** They said they finished the move on the card. */
  moveDone: boolean
  /** They said the whole project is finished, not just this move. */
  projectDone: boolean
}

type Generate = (prompt: string) => Promise<string>

/** Plain statements that need no model to read. Deliberately narrow: a miss
 *  falls through to the model, a false hit would log work that wasn't done. */
const PLAIN_DONE = /^\s*(?:ok(?:ay)?[,.! ]*)?(?:yes[,.! ]*)?(?:i(?:'ve| have)?\s+)?(?:did|done|finished|completed|sorted|nailed)(?:\s+(?:it|that|this))?\s*[.!]*\s*$/i

export function plainlyDone(said: string): boolean {
  return PLAIN_DONE.test(said)
}

export function buildVerdictPrompt(moveText: string, said: string): string {
  return `A person is working on a project. The one thing they were asked to do next:

"${moveText}"

They just said:

"${said}"

Answer with JSON only:
{ "move_done": true | false, "project_done": true | false }

- move_done: true ONLY if they say they have finished that thing, or clearly
  did it. Part way, "started", "working on it", a question or a new problem
  is false.
- project_done: true ONLY if they say the whole project is finished, not just
  this step. "The whole book is done", "the table is finished and oiled".
  Finishing one step, even a big one, is false.
If project_done is true, move_done is true as well.`
}

export function parseVerdict(raw: string): SaidVerdict {
  try {
    const parsed = JSON.parse(raw)
    const projectDone = parsed?.project_done === true
    return { moveDone: projectDone || parsed?.move_done === true, projectDone }
  } catch {
    return { moveDone: false, projectDone: false }
  }
}

/** Reads what they said against the move. Never throws: if the model can't
 *  be reached, nothing is logged as done, which is the safe direction. */
export async function readSaid(moveText: string, said: string, generate: Generate): Promise<SaidVerdict> {
  if (plainlyDone(said)) return { moveDone: true, projectDone: false }
  try {
    return parseVerdict(await generate(buildVerdictPrompt(moveText, said)))
  } catch (e) {
    console.warn('[move-said] could not read what they said:', e instanceof Error ? e.message : e)
    return { moveDone: false, projectDone: false }
  }
}

/**
 * Logs a move as done work. Reads the project fresh first so a slow model call
 * can't overwrite a list that changed meanwhile, and does nothing if the same
 * text is already logged as done (a retry must not log it twice).
 */
export async function logMoveDone(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  moveText: string,
  at: Date = new Date(),
): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects').select('metadata').eq('id', projectId).eq('user_id', userId).single()
  if (error || !data) return null

  const metadata = (data.metadata as Record<string, unknown>) ?? {}
  const tasks: any[] = Array.isArray(metadata.tasks) ? [...(metadata.tasks as any[])] : []
  const text = stripDoneWhen(moveText)
  const same = (t: any) => typeof t?.text === 'string' && t.text.trim().toLowerCase() === text.trim().toLowerCase()
  if (tasks.some(t => t?.done && same(t))) return text

  tasks.push({
    id: `t-${at.getTime()}`,
    text,
    done: true,
    created_at: at.toISOString(),
    completed_at: at.toISOString(),
    order: tasks.length,
    origin: 'said',
    source: null,
  })
  const { error: saveErr } = await supabase
    .from('projects')
    .update({ metadata: { ...metadata, tasks }, last_active: at.toISOString() })
    .eq('id', projectId).eq('user_id', userId)
  if (saveErr) {
    console.error('[move-said] could not log the move as done:', saveErr.message)
    return null
  }
  return text
}
