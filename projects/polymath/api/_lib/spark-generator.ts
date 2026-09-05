/**
 * Spark generation (SPEC.md's mull channel).
 *
 * Baked overnight, one per user per day. Each spark type pulls a different
 * slice of the corpus and asks a differently-shaped question of it — see
 * SPEC.md's type table. Every generator can return null: "silence beats a
 * weak spark" is enforced here by literally allowing the model to produce
 * nothing, and by discarding output that doesn't ground itself in a real
 * quote from what was fetched.
 *
 * Type rotation lives in spark-types.ts (pure, tested). This file is the
 * IO half: given a chosen type, fetch the right slice of corpus and ask
 * Gemini the right question of it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import type { SparkType } from './spark-types.js'
import { pickCrossingPair, type CrossingProject } from './spark-crossing.js'
import { SPARK_PROJECT_COOLDOWN_DAYS, recentlySparkedProjectIds, preferUnsparked } from './spark-rotation.js'
import {
  selectForgottenProject,
  forgottenSparkText,
  FORGOTTEN_SILENCE_DAYS,
  FORGOTTEN_COOLDOWN_DAYS,
} from './forgotten.js'

const RECENT_FRAGMENT_LIMIT = 40
const SPARK_SHELF_LIFE_HOURS = 24
const MATERIAL_FACT_SHELF_LIFE_HOURS = 48

export interface BakedSpark {
  type: SparkType
  text: string
  project_id: string | null
  expires_at: string
}

interface FragmentRow {
  id: string
  text: string
  role: string
  project_id: string
  projects?: { title: string } | null
}

async function fetchRecentFragments(supabase: SupabaseClient, userId: string): Promise<FragmentRow[]> {
  const { data } = await supabase
    .from('fragments')
    .select('id, text, role, project_id, projects(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(RECENT_FRAGMENT_LIMIT)
  return (data ?? []) as unknown as FragmentRow[]
}

function expiresAt(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

async function askForSpark(prompt: string): Promise<string | null> {
  try {
    const response = await generateText(prompt, { responseFormat: 'json' })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.spark === 'string' ? parsed.spark.trim() : ''
    return text.length > 0 ? text : null
  } catch (e) {
    console.warn('[spark-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}

const SILENCE_INSTRUCTION = `If nothing here is real or interesting enough, respond with { "spark": null } instead of forcing one. A weak spark is worse than no spark.`

async function generateNoticing(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const references = fragments.filter(f => f.role === 'reference')
  if (references.length === 0) return null

  const prompt = `Here are things the user has recently captured as references or inspirations:
${references.slice(0, 15).map(f => `- "${f.text}" (project: ${f.projects?.title ?? 'unfiled'})`).join('\n')}

Pick ONE and hold up something specific and true about it -- a detail, a technique, a structural
choice -- without asking a question. Just the noticing, one or two sentences.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null, "fragment_id": "the id you used, or null" }`

  const raw = await askForSparkWithId(prompt)
  if (!raw) return null
  return { type: 'noticing', text: raw.text, project_id: findProjectForFragment(fragments, raw.fragmentId), expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function askForSparkWithId(prompt: string): Promise<{ text: string; fragmentId: string | null } | null> {
  try {
    const response = await generateText(prompt, { responseFormat: 'json' })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.spark === 'string' ? parsed.spark.trim() : ''
    if (text.length === 0) return null
    return { text, fragmentId: typeof parsed?.fragment_id === 'string' ? parsed.fragment_id : null }
  } catch (e) {
    console.warn('[spark-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}

function findProjectForFragment(fragments: FragmentRow[], fragmentId: string | null): string | null {
  if (!fragmentId) return null
  return fragments.find(f => f.id === fragmentId)?.project_id ?? null
}

async function generateTransferredConstraint(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const byProject = new Map<string, FragmentRow[]>()
  for (const f of fragments) {
    if (!byProject.has(f.project_id)) byProject.set(f.project_id, [])
    byProject.get(f.project_id)!.push(f)
  }
  if (byProject.size < 2) return null

  // Labels are what make this a polymath question rather than an
  // adjacency one -- a rule carried from woodwork into a song has to be
  // re-derived to survive the trip, and what survives is the part only
  // this user could have made. Two music projects would be neither.
  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, title, metadata')
    .eq('user_id', userId)
    .in('id', [...byProject.keys()])

  const candidates: CrossingProject[] = (projectRows ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    tags: Array.isArray(p.metadata?.tags) ? p.metadata.tags.filter((t: unknown) => typeof t === 'string') : [],
    fragmentCount: byProject.get(p.id)?.length ?? 0,
  }))
  if (candidates.length < 2) return null

  const pair = pickCrossingPair(
    candidates,
    await recentlySparkedProjectIds(supabase, userId, SPARK_PROJECT_COOLDOWN_DAYS),
  )
  if (!pair) return null

  const quote = (id: string) =>
    (byProject.get(id) ?? []).slice(0, 4).map(f => `- "${f.text}"`).join('\n') || '- (nothing captured)'

  const distance = pair.crossesDisciplines
    ? `These two are from different parts of their life${pair.from.tags.length && pair.to.tags.length ? ` (${pair.from.tags.join('/')} and ${pair.to.tags.join('/')})` : ''}. That distance is the point -- a rule that survives the trip is worth more than one that never had to travel.`
    : `These two are close to each other${pair.sharedTags.length ? ` (both ${pair.sharedTags.join(', ')})` : ''}, so the connection has to be genuinely non-obvious to be worth saying at all.`

  const prompt = `What the user has captured about "${pair.from.title}":
${quote(pair.from.id)}

And about "${pair.to.title}":
${quote(pair.to.id)}

${distance}

Find a RULE or CONSTRAINT that shows up clearly in the "${pair.from.title}" captures, and ask
whether it applies to "${pair.to.title}". Import the rule, don't invent a new connection -- the
rule has to actually be visible in what's quoted above. Name both, so they can tell what's being
carried where.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  // Attributed to the project being carried INTO -- that's what the spark
  // asks them to think about, and what the project rotation records so the
  // same project isn't the subject two sparks running.
  return { type: 'transferred_constraint', text: raw, project_id: pair.to.id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateUnfinishedThought(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const obstacles = fragments.filter(f => f.role === 'obstacle' || f.role === 'constraint')
  if (obstacles.length === 0) return null
  // Spread the subject across projects: an unanswered thought about the
  // shelf is worth as much as a third one about the song, and rotating is
  // what keeps the rest of the shelf warm enough to cross-reference.
  const eligible = preferUnsparked(
    obstacles,
    await recentlySparkedProjectIds(supabase, userId, SPARK_PROJECT_COOLDOWN_DAYS),
  )
  const pick = eligible[Math.floor(Math.random() * eligible.length)]

  const prompt = `The user once said, about their project "${pick.projects?.title ?? 'a project'}":
"${pick.text}"

They never finished that thought. Play it back to them plainly and ask what they meant --
without answering it for them.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'unfinished_thought', text: raw, project_id: pick.project_id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateContradiction(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const constraints = fragments.filter(f => f.role === 'constraint')
  if (constraints.length < 2) return null

  const prompt = `Here are things the user has said should constrain their projects:
${constraints.slice(0, 10).map(f => `- "${f.text}" (${f.projects?.title ?? 'unfiled'})`).join('\n')}

Find two that sit in real tension with each other -- not invented, actually there. Name both,
side by side, and leave it unresolved. Don't tell them which one is right.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'contradiction', text: raw, project_id: null, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateScaleJump(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, description')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(20)
  if (!projects || projects.length === 0) return null
  const eligible = preferUnsparked(
    projects as any[],
    await recentlySparkedProjectIds(supabase, userId, SPARK_PROJECT_COOLDOWN_DAYS),
    (p: any) => p.id,
  )
  const pick = eligible[Math.floor(Math.random() * eligible.length)]

  const prompt = `Project: "${pick.title}" -- ${pick.description || 'no description yet'}

Ask ONE question that jumps to the wrong altitude on purpose: if they've been thinking about
small details, ask the big-picture question ("what's this about, today, in one sentence?"); if
the project sounds vague and big, ask a small concrete question instead.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'scale_jump', text: raw, project_id: pick.id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateMaterialFact(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const materials = fragments.filter(f => f.role === 'material')
  if (materials.length === 0) return null
  const eligible = preferUnsparked(
    materials,
    await recentlySparkedProjectIds(supabase, userId, SPARK_PROJECT_COOLDOWN_DAYS),
  )
  const pick = eligible[Math.floor(Math.random() * eligible.length)]

  return {
    type: 'material_fact',
    text: `${pick.text} — still there, for "${pick.projects?.title ?? 'this'}".`,
    project_id: pick.project_id,
    expires_at: expiresAt(MATERIAL_FACT_SHELF_LIFE_HOURS),
  }
}

async function generateOutsideReach(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const { data: highlights } = await supabase
    .from('article_highlights')
    .select('highlight_text, article_id, reading_queue!inner(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(20)

  if (!highlights || highlights.length === 0 || !projects || projects.length === 0) return null

  const prompt = `Recent reading highlights (from outside the user's own projects):
${highlights.slice(0, 8).map((h: any) => `- "${h.highlight_text}" (from "${h.reading_queue?.title ?? 'an article'}")`).join('\n')}

Their projects: ${projects.map((p: any) => p.title).join(', ')}

Find a technique, idea, or approach in the reading that's genuinely from OUTSIDE what they'd
normally think of for one of these projects, and name a concrete way it could apply. This has to
actually come from the reading, not just be a generic idea.

${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null, "target_project_title": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null

  const jsonMatch = raw // already extracted text; project matching done loosely below
  const matchedProject = projects.find((p: any) => jsonMatch.toLowerCase().includes(p.title.toLowerCase()))

  return {
    type: 'outside_reach',
    text: raw,
    project_id: matchedProject?.id ?? null,
    expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS),
  }
}

/**
 * The last branch of the stale router (see forgotten.ts for the full
 * rationale). Deterministic -- no Gemini call -- because the useful output
 * here is a plain fact, not a generated sentence, and because it must be
 * able to decline cheaply: most nights it returns null and the rotation
 * picks another type.
 *
 * The routing filter is the important part: a project the corpus has been
 * talking about belongs to the morph path, and asking a vague "still want
 * this?" about it instead of proposing something concrete would be strictly
 * worse than staying quiet.
 */
async function generateForgotten(supabase: SupabaseClient, userId: string): Promise<BakedSpark | null> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, state, last_active, last_session_ended_at, created_at')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(200)

  if (!projects || projects.length === 0) return null

  const silenceCutoff = new Date(Date.now() - FORGOTTEN_SILENCE_DAYS * 86400000).toISOString()
  const { data: recentFragments } = await supabase
    .from('fragments')
    .select('project_id')
    .eq('user_id', userId)
    .gte('created_at', silenceCutoff)

  const cooldownCutoff = new Date(Date.now() - FORGOTTEN_COOLDOWN_DAYS * 86400000).toISOString()
  const { data: recentOffers } = await supabase
    .from('sparks')
    .select('project_id')
    .eq('user_id', userId)
    .eq('type', 'forgotten')
    .gte('created_at', cooldownCutoff)
    .not('project_id', 'is', null)

  const picked = selectForgottenProject({
    projects: projects.map((p: any) => ({
      id: p.id,
      title: p.title,
      state: p.state,
      // Most recent real signal of activity on the project.
      last_touched_at: [p.last_session_ended_at, p.last_active, p.created_at]
        .filter(Boolean)
        .sort()
        .pop() ?? null,
    })),
    projectIdsWithRecentFragments: (recentFragments ?? []).map((f: any) => f.project_id),
    recentlyOfferedProjectIds: (recentOffers ?? []).map((s: any) => s.project_id),
  })

  if (!picked) return null

  return {
    type: 'forgotten',
    text: forgottenSparkText(picked.project.title, picked.daysUntouched),
    project_id: picked.project.id,
    expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS),
  }
}

const GENERATORS: Record<SparkType, (supabase: SupabaseClient, userId: string) => Promise<BakedSpark | null>> = {
  noticing: generateNoticing,
  transferred_constraint: generateTransferredConstraint,
  unfinished_thought: generateUnfinishedThought,
  contradiction: generateContradiction,
  scale_jump: generateScaleJump,
  material_fact: generateMaterialFact,
  outside_reach: generateOutsideReach,
  forgotten: generateForgotten,
}

export async function generateSpark(
  supabase: SupabaseClient,
  userId: string,
  type: SparkType
): Promise<BakedSpark | null> {
  return GENERATORS[type](supabase, userId)
}
