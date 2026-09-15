/**
 * Fragments — attaching a voicing to a project with a role (SPEC.md).
 *
 * "A project with three references and no deadline behaves differently
 * from the reverse" is the whole point of roles: accumulation without
 * structure is just a longer description. This runs fire-and-forget from
 * capture (process-memory.ts), mirroring bumpHeatFromNewMemory's pattern —
 * a fragment-attach failure must never block memory processing.
 *
 * Best-matching project is found the same way heat scoring does (cosine
 * similarity against project embeddings), then a single capped-thinking
 * Gemini call decides the role and whether it fills a named empty slot.
 * One call, not two — a separate slot-matching pass would double the cost
 * for a decision that's really one judgement ("what kind of thing is this,
 * and does it answer a question this project is already asking").
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { cosineSimilarity } from './gemini-embeddings.js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { isGraveyarded } from './project-state.js'

const ATTACH_SIM_THRESHOLD = 0.5
/**
 * How far the best project must beat the second-best before we believe it.
 *
 * The absolute threshold alone decides almost nothing here. Measured on the
 * live corpus, every note scores 0.55-0.66 against its nearest project --
 * p10 0.56, p90 0.66 -- so 0.5 admits 98% of everything, and the pick is
 * then whichever project won by a hair. Half of them won by less than 0.02:
 * "cervical spine injection recovery" landed on "Painting where you tip the
 * canvas" by a margin of 0.000, and "nutritional profile of yellow tropical
 * fruit" on "Create custom t-shirts for friends".
 *
 * That is not a near miss, it is a coin toss, and a fragment is not a
 * harmless guess: it dates a capture onto a project's timeline, and every
 * shape in corpus-time.ts is arithmetic over those dates. Wrong evidence is
 * worse than none.
 *
 * 0.06 is where the measured pairs stop being arguable. Above it: the
 * Aperture note to Aperture, the dream-door note to the vivid dreams book,
 * the woodwork course to the wood block, the paradox note to the paradox
 * project, the baby's milestone to Pupils. Just below it, a note about
 * Arsenal's defensive organisation attaches to "The Geometry of Good Vibes".
 *
 * Most captures belong to no project, and that is a real answer -- they stay
 * unfiled, where `unfiled` in mull-subjects.ts can find them and ask why.
 */
const ATTACH_MARGIN = 0.06
const ROLES = ['reference', 'constraint', 'material', 'deadline', 'obstacle', 'collaborator'] as const
type FragmentRole = typeof ROLES[number]

interface ProjectCandidate {
  id: string
  title: string
  embedding: number[] | null
  slots: Array<{ name: string; filled: boolean }>
  state?: string | null
  status?: string | null
}

/**
 * Which project a capture belongs to, or none.
 *
 * Pure so it can be tested against real numbers rather than reasoned about.
 * Takes similarities sorted high to low; returns the index of the winner, or
 * null when nothing wins clearly enough to be worth writing down.
 */
export function chooseProject(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  if (sorted[0] < ATTACH_SIM_THRESHOLD) return null
  // One candidate has nothing to beat, so the floor is the whole test.
  if (sorted.length === 1) return 0
  return sorted[0] - sorted[1] >= ATTACH_MARGIN ? 0 : null
}

interface ClassifyResult {
  role: FragmentRole
  fillsSlot: string | null
}

async function classifyFragment(text: string, project: ProjectCandidate): Promise<ClassifyResult | null> {
  const openSlots = project.slots.filter(s => !s.filled).map(s => s.name)

  // The premise used to be asserted -- "a thought that CONNECTS to their
  // project" -- so the model was only ever asked what kind of connection it
  // was, and an unreadable answer fell back to 'reference'. There was no way
  // for anything in this chain to say no. The vectors now have to clear a
  // real margin before we get here (chooseProject), and this is the second
  // look: the model sees the project and the thought and may say they have
  // nothing to do with each other.
  const prompt = `Someone captured a thought. The vectors say it may belong to their project "${project.title}".

Thought: "${text}"

Open questions this project still has: ${openSlots.length > 0 ? openSlots.join(', ') : 'none named yet'}

First: does this thought actually have anything to do with that project? If it does not, answer {"role": "none"} and nothing else. Being unrelated is the common case and it is a fine answer — say so rather than reaching for a link.

If it does belong, what KIND of thing is it, in relation to the project? Pick exactly one:
- reference: an inspiration or example
- constraint: a rule or limit it should follow
- material: a physical thing, resource, or asset available to use
- deadline: a time pressure or date
- obstacle: something blocking progress
- collaborator: a person who could help

Does it answer one of the open questions above? If yes, name that exact open question. If no, say null.

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "role": "..." | "none", "fills_slot": "exact open question text or null" }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'minimal' })
    const parsed = JSON.parse(response)
    if (parsed?.role === 'none') return null
    const role = ROLES.includes(parsed?.role) ? (parsed.role as FragmentRole) : 'reference'
    const fillsSlot = typeof parsed?.fills_slot === 'string' && openSlots.includes(parsed.fills_slot)
      ? parsed.fills_slot
      : null
    return { role, fillsSlot }
  } catch (e) {
    console.warn('[fragments] classifyFragment failed:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function attachFragmentFromMemory(
  supabase: SupabaseClient,
  userId: string,
  memory: { id: string; content: string; embedding: number[] | null }
): Promise<number> {
  if (!memory.embedding || memory.embedding.length === 0) return 0

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, embedding, slots, state, status')
    .eq('user_id', userId)
    .limit(200)

  if (!projects || projects.length === 0) return 0

  // A new capture doesn't get silently filed under a project the user
  // buried. Was `.neq('state', 'harvested')` in the query, which missed
  // one sent to the graveyard by hand -- see project-state.ts.
  const scored: Array<{ project: ProjectCandidate; sim: number }> = []
  for (const p of projects as ProjectCandidate[]) {
    if (isGraveyarded(p)) continue
    if (!p.embedding) continue
    scored.push({
      project: { ...p, slots: Array.isArray(p.slots) ? p.slots : [] },
      sim: cosineSimilarity(memory.embedding, p.embedding),
    })
  }
  scored.sort((a, b) => b.sim - a.sim)

  const pick = chooseProject(scored.map(s => s.sim))
  if (pick === null) return 0
  const best = scored[pick].project
  const bestSim = scored[pick].sim

  const classification = await classifyFragment(memory.content, best)
  if (!classification) return 0

  const { error: insertErr } = await supabase.from('fragments').insert({
    user_id: userId,
    project_id: best.id,
    memory_id: memory.id,
    role: classification.role,
    fills_slot: classification.fillsSlot,
    text: memory.content,
  })
  if (insertErr) {
    console.warn('[fragments] insert failed:', insertErr.message)
    return 0
  }

  if (classification.fillsSlot) {
    const updatedSlots = best.slots.map(s =>
      s.name === classification.fillsSlot ? { ...s, filled: true } : s
    )
    const { error: updateErr } = await supabase
      .from('projects')
      .update({ slots: updatedSlots })
      .eq('id', best.id)
      .eq('user_id', userId)
    if (updateErr) console.warn('[fragments] slot update failed (non-fatal):', updateErr.message)
  }

  return 1
}

/**
 * Attach fragments for thoughts that already have embeddings but never got one.
 *
 * Fragments are only ever created at capture time, and creation needs BOTH the
 * thought's embedding and the project's. Those writes were failing (the model
 * was asked for its default 3072 dimensions against vector(768) columns), so
 * every attach returned 0 and this table stayed empty — which silently starved
 * the mull channel, since a project's captures are most of what a blind spot
 * is found in and the description alone rarely has one in it.
 * Fixing the dimensions only helps thoughts captured from now on;
 * the years already in the corpus need this.
 *
 * Bounded per run: each attach is a model call.
 */
export async function backfillFragments(
  supabase: SupabaseClient,
  userId: string,
  limit = 15
): Promise<number> {
  const { data: existing } = await supabase
    .from('fragments')
    .select('memory_id')
    .eq('user_id', userId)
    .not('memory_id', 'is', null)

  const alreadyAttached = new Set((existing ?? []).map((r: { memory_id: string }) => r.memory_id))

  const { data: memories } = await supabase
    .from('memories')
    .select('id, title, body, embedding')
    .eq('user_id', userId)
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  let attached = 0
  for (const m of (memories ?? []) as Array<{ id: string; title: string | null; body: string | null; embedding: unknown }>) {
    if (attached >= limit) break
    if (alreadyAttached.has(m.id)) continue

    // Supabase hands vectors back as a JSON string on some paths.
    const embedding = Array.isArray(m.embedding)
      ? m.embedding as number[]
      : typeof m.embedding === 'string'
        ? (() => { try { return JSON.parse(m.embedding as string) as number[] } catch { return null } })()
        : null
    if (!embedding) continue

    const content = `${m.title ?? ''} ${m.body ?? ''}`.trim()
    if (!content) continue

    attached += await attachFragmentFromMemory(supabase, userId, { id: m.id, content, embedding })
  }

  return attached
}
