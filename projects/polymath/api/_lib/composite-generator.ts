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
 *
 * The fusion text itself is grounded exactly like a session item
 * (session-grounding.ts): no tool, material, brand or person the user
 * never mentioned, and every specific claim has to cite evidence that
 * actually supports it. This was missing for a while -- composites ran
 * so rarely (weekly, needs a recurring joint plus two stalled projects)
 * that nobody noticed the fusion sentence itself was never checked
 * against anything, the same invented-detail failure mode the session
 * shaper had before it was fixed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { isStalled, type ProjectForStall } from './drift.js'
import { filterGrounded, hasAdequateCoverage, type Evidence } from './session-grounding.js'

const FRAGMENTS_PER_PROJECT = 4

export interface StalledProject extends ProjectForStall {
  id: string
  title: string
  description: string | null
  /** Recent fragments -- the real material this project has to draw on,
   *  so the fusion idea can name something concrete instead of the model
   *  guessing what either project has to work with. Empty until
   *  `attachFragments` has run. */
  fragments: { id: string; text: string }[]
}

export interface CompositeCandidate {
  projectIdA: string
  projectIdB: string
  proposedText: string
  /** Real fragment ids the proposal's citations traced back to, for the
   *  same receipt-on-screen treatment a morph gets. */
  citedFragmentIds: string[]
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
      fragments: [] as { id: string; text: string }[],
    }))
    .filter(p => isStalled(p))
}

/**
 * Attaches each stalled project's recent fragments -- separate from
 * `getStalledProjects` because eligibility (stalled or not) and evidence
 * (what's actually known) are different questions, and most call sites
 * only need the first one.
 */
export async function attachFragments(
  supabase: SupabaseClient,
  userId: string,
  projects: StalledProject[],
): Promise<StalledProject[]> {
  if (projects.length === 0) return projects

  const { data: rows } = await supabase
    .from('fragments')
    .select('id, project_id, text, created_at')
    .eq('user_id', userId)
    .in('project_id', projects.map(p => p.id))
    .order('created_at', { ascending: false })
    .limit(projects.length * FRAGMENTS_PER_PROJECT * 3) // headroom before the per-project cap below

  const byProject = new Map<string, { id: string; text: string }[]>()
  for (const r of rows ?? []) {
    if (!r.text) continue
    const list = byProject.get(r.project_id) ?? []
    if (list.length < FRAGMENTS_PER_PROJECT) list.push({ id: r.id, text: r.text })
    byProject.set(r.project_id, list)
  }

  return projects.map(p => ({ ...p, fragments: byProject.get(p.id) ?? [] }))
}

export interface BuiltCompositeEvidence {
  evidence: Evidence[]
  /** evidence id -> the real fragment it came from, for evidence entries
   *  built from a fragment (not the joint or a bare description). Lets an
   *  accepted proposal's citations resolve back to real fragment ids for
   *  storage, the same receipt a morph proposal carries. */
  fragmentIdByEvidenceId: Record<string, string>
}

/**
 * Everything the app actually knows that's relevant to this fusion: the
 * joint itself (already a real, recurring quote -- joint-miner.ts only
 * writes one once something has been said more than once) plus each
 * stalled project's description and recent fragments.
 */
export function buildCompositeEvidence(
  joint: { text: string },
  projects: StalledProject[],
): BuiltCompositeEvidence {
  const evidence: Evidence[] = []
  const fragmentIdByEvidenceId: Record<string, string> = {}
  let n = 0
  const add = (label: string, text: string, fragmentId?: string) => {
    if (!text?.trim()) return
    const id = `e${++n}`
    evidence.push({ id, label, text: text.trim() })
    if (fragmentId) fragmentIdByEvidenceId[id] = fragmentId
  }

  add('the recurring thing you keep saying', joint.text)
  for (const p of projects) {
    add(`what "${p.title}" is`, p.description ?? '')
    for (const f of p.fragments) add(`a note on "${p.title}"`, f.text, f.id)
  }

  return { evidence, fragmentIdByEvidenceId }
}

export function buildCompositePrompt(
  joint: { text: string },
  projects: StalledProject[],
  evidence: Evidence[],
): string {
  return `The user keeps coming back to this, across different projects:
"${joint.text}"

EVERYTHING KNOWN THAT'S RELEVANT:
${evidence.length ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n') : '(nothing beyond the projects\' titles)'}

That list is the whole of it. Anything not in it, you do not know.

Their projects that have been sitting stalled -- something they haven't touched in a while, with
a real open question still unanswered:
${projects.map(p => `[project:${p.id}] "${p.title}"`).join('\n')}

Does the recurring thing above apply to exactly TWO of these projects in a way that could fuse
them into one small, concrete thing -- ideally a single object or session that serves both, not
a grand merger? Only answer if it's real and specific. If it doesn't clearly fit two of them, say so.

NEVER INVENT A DETAIL: no tool, material, brand, model number, technique, instrument, person or
place unless it appears verbatim in the numbered evidence above. If neither project's evidence
mentions a specific material, don't name one -- say the fusion in terms of what you actually
know. Cite the evidence ids your proposal draws from; if you can't cite it, you can't say it.
Vague and true beats specific and invented.

${PLAIN_ENGLISH_RULES}
Never invent hyphenated jargon in scare-quotes. If it needs scare-quotes, don't say it.

Respond with JSON only:
{ "project_id_a": "..." | null, "project_id_b": "..." | null,
  "proposal": "one or two sentences naming the concrete bridge, or null",
  "evidence": ["e1", "e2"] }`
}

/**
 * Given a joint (a quoted, recurring theme) and the current stalled-project
 * set, asks which two projects it applies to -- if any. Returns null on
 * "not both stalled," "doesn't clearly apply to two," a model answer that
 * doesn't map back to real project ids, or a proposal that fails
 * grounding (invents a detail, or cites something that doesn't support it).
 */
export async function proposeComposite(
  joint: { id: string; text: string },
  stalledProjects: StalledProject[],
): Promise<CompositeCandidate | null> {
  if (stalledProjects.length < 2) return null

  const { evidence, fragmentIdByEvidenceId } = buildCompositeEvidence(joint, stalledProjects)
  const prompt = buildCompositePrompt(joint, stalledProjects, evidence)

  try {
    const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.7 })
    const parsed = JSON.parse(response)
    const idA = typeof parsed?.project_id_a === 'string' ? parsed.project_id_a : null
    const idB = typeof parsed?.project_id_b === 'string' ? parsed.project_id_b : null
    const text = typeof parsed?.proposal === 'string' ? parsed.proposal.trim() : ''
    const citedIds = Array.isArray(parsed?.evidence)
      ? parsed.evidence.filter((x: unknown): x is string => typeof x === 'string')
      : []

    if (!idA || !idB || idA === idB || !text || text.toLowerCase() === 'null') return null

    const validIds = new Set(stalledProjects.map(p => p.id))
    if (!validIds.has(idA) || !validIds.has(idB)) return null // model must stay inside the real stalled set

    // Same gates a session item goes through: no invented specifics, and
    // any specific claim has to be traceable to real evidence.
    const { kept, rejected } = filterGrounded([{ text, evidence: citedIds }], evidence, 'the composite')
    if (kept.length === 0) {
      console.warn(
        `[composite-generator] proposal failed grounding: "${text}" —`,
        rejected[0]?.reason ?? 'no reason recorded',
      )
      return null
    }

    // A composite fuses several pieces of evidence into one sentence, so
    // a single shared word can clear filterGrounded's per-citation check
    // while other specific words in the same sentence trace to nothing --
    // "Build the shelf from steel tubing" only needs "shelf" to pass. This
    // catches the rest of the sentence.
    if (!hasAdequateCoverage(text, evidence)) {
      console.warn(`[composite-generator] proposal failed word coverage: "${text}"`)
      return null
    }

    const citedFragmentIds = citedIds
      .map((id: string) => fragmentIdByEvidenceId[id])
      .filter((id: string | undefined): id is string => !!id)

    return { projectIdA: idA, projectIdB: idB, proposedText: text, citedFragmentIds }
  } catch (e) {
    console.warn('[composite-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}
