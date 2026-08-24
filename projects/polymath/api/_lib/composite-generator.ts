/**
 * Composite proposal generation (SPEC.md).
 *
 * Inverted from the old crossover generator: joint -> pair, not pair ->
 * link. Given a mined joint ("contrast between clean and raw"), ask which
 * two STALLED projects it applies to, rather than handing the model two
 * projects and forcing it to invent a bridge (the old approach, and the
 * source of forced mashups -- the model must always answer when the
 * question is "how do these connect").
 *
 * Both conditions from SPEC.md are enforced here in code, not left to the
 * model's judgement: both projects must be stalled (drift.ts's isStalled),
 * and the model's answer is discarded if it doesn't name two projects
 * from the actual stalled set.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { isStalled, type ProjectForStall } from './drift.js'

export interface StalledProject extends ProjectForStall {
  id: string
  title: string
  description: string | null
}

export interface CompositeCandidate {
  projectIdA: string
  projectIdB: string
  proposedText: string
}

/** Fetches every project of the user's that qualifies as stalled (SPEC.md). */
export async function getStalledProjects(supabase: SupabaseClient, userId: string): Promise<StalledProject[]> {
  const { data } = await supabase
    .from('projects')
    .select('id, title, description, last_session_ended_at, slots')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(200)

  const projects = (data ?? []) as Array<{
    id: string
    title: string
    description: string | null
    last_session_ended_at: string | null
    slots: unknown
  }>

  return projects
    .map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      last_session_ended_at: p.last_session_ended_at,
      slots: Array.isArray(p.slots) ? (p.slots as Array<{ filled: boolean }>) : [],
    }))
    .filter(p => isStalled(p))
}

/**
 * Given a joint (a quoted, recurring theme) and the current stalled-project
 * set, asks which two projects it applies to -- if any. Returns null on
 * "not both stalled," "doesn't clearly apply to two," or a model answer
 * that doesn't map back to real project ids.
 */
export async function proposeComposite(
  joint: { id: string; text: string },
  stalledProjects: StalledProject[]
): Promise<CompositeCandidate | null> {
  if (stalledProjects.length < 2) return null

  const prompt = `The user keeps coming back to this, across different projects:
"${joint.text}"

Here are their projects that have been sitting stalled -- something they haven't touched in a
while, with a real open question still unanswered:
${stalledProjects.map(p => `[${p.id}] "${p.title}" -- ${p.description || 'no description'}`).join('\n')}

Does this recurring thing apply to exactly TWO of these projects in a way that could fuse them
into one small, concrete thing -- ideally a single object or session that serves both, not a
grand merger? Only answer if it's real and specific. If it doesn't clearly fit two of them, say so.

${PLAIN_ENGLISH_RULES}
Never invent hyphenated jargon in scare-quotes. If it needs scare-quotes, don't say it.

Respond with JSON only:
{ "project_id_a": "..." | null, "project_id_b": "..." | null, "proposal": "one or two sentences naming the concrete bridge, or null" }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.7 })
    const parsed = JSON.parse(response)
    const idA = typeof parsed?.project_id_a === 'string' ? parsed.project_id_a : null
    const idB = typeof parsed?.project_id_b === 'string' ? parsed.project_id_b : null
    const text = typeof parsed?.proposal === 'string' ? parsed.proposal.trim() : ''

    if (!idA || !idB || idA === idB || !text || text.toLowerCase() === 'null') return null

    const validIds = new Set(stalledProjects.map(p => p.id))
    if (!validIds.has(idA) || !validIds.has(idB)) return null // model must stay inside the real stalled set

    return { projectIdA: idA, projectIdB: idB, proposedText: text }
  } catch (e) {
    console.warn('[composite-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}
