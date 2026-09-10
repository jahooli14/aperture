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
import { SPARK_PROJECT_COOLDOWN_DAYS, recentlySparkedProjectIds, preferUnsparked } from './spark-rotation.js'
import { pickSparkSubject, type SubjectCandidate } from './spark-subject.js'
import { avoidBlock, echoesRecent, fetchRecentSparkTexts } from './spark-echo.js'
import { pickGap, genericGapQuestion } from './session-gap.js'
import {
  selectForgottenProject,
  forgottenSparkText,
  FORGOTTEN_SILENCE_DAYS,
  FORGOTTEN_COOLDOWN_DAYS,
} from './forgotten.js'
import { selectCorpusArticles, type CorpusArticle } from './reading-corpus.js'

const RECENT_FRAGMENT_LIMIT = 40
/**
 * Four days, not one.
 *
 * A spark is a question about a project you're not sitting down to work on,
 * and the whole value is that it gets to sit — you read it, you don't answer
 * it, and three days later on a walk the answer turns up. At 24 hours it
 * expired overnight, so it could only ever be answered on the spot or lost,
 * which is the opposite of how thinking about a thing in the background
 * works.
 */
const SPARK_SHELF_LIFE_HOURS = 96
/** A material fact is about a moment ("the trial ends Friday"), so it still
 *  goes stale on its own schedule rather than sitting. */
const MATERIAL_FACT_SHELF_LIFE_HOURS = 48

export interface BakedSpark {
  type: SparkType
  text: string
  project_id: string | null
  expires_at: string
}

/**
 * What the user has already been asked, carried into every generator.
 *
 * Rotating the type and the project isn't enough on its own: a different
 * type asked about a different project still reached for water and infinity
 * three days running, because nothing in the prompt or the check knew what
 * yesterday had said. `avoid` goes into the prompt, `recentTexts` is what
 * the finished spark is checked against (spark-echo.ts).
 */
export interface EchoContext {
  recentTexts: string[]
  avoid: string
}

export async function loadEchoContext(supabase: SupabaseClient, userId: string): Promise<EchoContext> {
  const recentTexts = await fetchRecentSparkTexts(supabase, userId)
  return { recentTexts, avoid: avoidBlock(recentTexts) }
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

async function generateNoticing(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const references = fragments.filter(f => f.role === 'reference')
  if (references.length === 0) return null

  const prompt = `Here are things the user has recently captured as references or inspirations:
${references.slice(0, 15).map(f => `- "${f.text}" (project: ${f.projects?.title ?? 'unfiled'})`).join('\n')}

Pick ONE and hold up something specific and true about it -- a detail, a technique, a structural
choice -- without asking a question. Just the noticing, one or two sentences.

${echo.avoid}
${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null, "fragment_id": "the id you used, or null" }`

  const raw = await askForSparkWithId(prompt)
  if (!raw) return null
  return { type: 'noticing', text: raw.text, project_id: findProjectForFragment(fragments, raw.fragmentId), expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

/** Like askForSpark, but also pulls a second named field out of the same
 *  JSON response -- the pattern every generator that needs to attribute
 *  its spark to a specific fragment/project uses, rather than trying to
 *  recover that attribution by substring-matching the free-text spark
 *  afterwards. */
async function askForSparkWithField(
  prompt: string,
  field: string,
): Promise<{ text: string; value: string | null } | null> {
  try {
    const response = await generateText(prompt, { responseFormat: 'json' })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.spark === 'string' ? parsed.spark.trim() : ''
    if (text.length === 0) return null
    return { text, value: typeof parsed?.[field] === 'string' ? parsed[field] : null }
  } catch (e) {
    console.warn('[spark-generator] generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}

async function askForSparkWithId(prompt: string): Promise<{ text: string; fragmentId: string | null } | null> {
  const raw = await askForSparkWithField(prompt, 'fragment_id')
  return raw ? { text: raw.text, fragmentId: raw.value } : null
}

function findProjectForFragment(fragments: FragmentRow[], fragmentId: string | null): string | null {
  if (!fragmentId) return null
  return fragments.find(f => f.id === fragmentId)?.project_id ?? null
}

async function generateTransferredConstraint(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const byProject = new Map<string, FragmentRow[]>()
  for (const f of fragments) {
    if (!byProject.has(f.project_id)) byProject.set(f.project_id, [])
    byProject.get(f.project_id)!.push(f)
  }
  if (byProject.size < 2) return null

  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, title, metadata')
    .eq('user_id', userId)
    .in('id', [...byProject.keys()])

  const onCooldown = new Set(
    await recentlySparkedProjectIds(supabase, userId, SPARK_PROJECT_COOLDOWN_DAYS)
  )

  const candidates = (projectRows ?? [])
    .map((p: any) => ({
      id: p.id as string,
      title: p.title as string,
      tags: Array.isArray(p.metadata?.tags) ? p.metadata.tags.filter((t: unknown) => typeof t === 'string') : [],
      fragments: byProject.get(p.id) ?? [],
    }))
    .filter(p => p.fragments.length > 0)

  if (candidates.length < 2) return null

  // The pair is NOT chosen here. Picking two projects and then asking for a
  // rule that links them is the machine that produces "you like how Tame
  // Impala treats synths, does the water dancing scene do that too" — handed
  // a pair and told to bridge it, the model always finds something, and what
  // it finds is a resemblance dressed as a rule. Composites were fixed by
  // inverting exactly this (SPEC/CLAUDE.md: joint → pair, never pair →
  // invented bridge), so the same inversion applies here: show everything,
  // ask for a rule that is already visibly load-bearing in one project, and
  // let the destination fall out of the rule. Most of the time the honest
  // answer is that no rule travels, which is why silence is the default and
  // not a footnote.
  const block = candidates
    .map(p => {
      const label = p.tags.length ? ` [${p.tags.join(', ')}]` : ''
      const quotes = p.fragments.slice(0, 4).map(f => `    - "${f.text}"`).join('\n')
      return `  ${p.title}${label} (id: ${p.id})\n${quotes}`
    })
    .join('\n\n')

  const eligible = candidates.filter(p => !onCooldown.has(p.id)).map(p => p.id)
  if (eligible.length === 0) return null

  const prompt = `Here is what the user has captured, grouped by project:

${block}

Look for a RULE the user follows — a constraint, a working method, a standard they
hold themselves to — that is plainly visible in the captures of ONE project, in more
than one line if possible. Then, and only then, ask whether that same rule applies to
a DIFFERENT project where they clearly are not applying it yet.

The rule has to be load-bearing: something that changes what you would DO, not a mood,
a theme, an aesthetic, or a resemblance between two subjects.

Do not build a bridge because two things sound poetic together. Two projects both being
"about generation" or "about water" or "about memory" is a resemblance, not a
transferable rule, and a question built on one is worthless.

BAD (a resemblance dressed up as a question — never write this):
"You love how Tame Impala treats synths as machines that generate ideas on their own.
Does the water dancing scene in your book do that same work for the story?"

GOOD (a real working rule, carried somewhere it isn't being applied):
"On the mixes you commit to one take and refuse to fix it afterwards. The book chapters
have been rewritten four times each — what happens if a first draft has to stand?"

Silence is the normal answer. If no rule in these captures genuinely transfers, return
{ "spark": null }. Do not lower the bar to produce something.

${echo.avoid}
${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "spark": "..." | null, "to_project_id": "the id of the project the rule is being carried INTO, or null" }`

  const raw = await askForSparkWithProject(prompt)
  if (!raw) return null

  // The rule has to land on a real project that isn't already on cooldown,
  // otherwise there's nothing honest to attribute the question to.
  const target = raw.projectId && eligible.includes(raw.projectId) ? raw.projectId : null
  if (!target) return null

  return { type: 'transferred_constraint', text: raw.text, project_id: target, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function askForSparkWithProject(prompt: string): Promise<{ text: string; projectId: string | null } | null> {
  try {
    const response = await generateText(prompt, { responseFormat: 'json' })
    const parsed = JSON.parse(response)
    const text = typeof parsed?.spark === 'string' ? parsed.spark.trim() : ''
    if (text.length === 0) return null
    return { text, projectId: typeof parsed?.to_project_id === 'string' ? parsed.to_project_id : null }
  } catch (e) {
    console.warn('[spark-generator] transferred-constraint generation failed:', e instanceof Error ? e.message : e)
    return null
  }
}

async function generateUnfinishedThought(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
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

${echo.avoid}
${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'unfinished_thought', text: raw, project_id: pick.project_id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateContradiction(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
  const fragments = await fetchRecentFragments(supabase, userId)
  const constraints = fragments.filter(f => f.role === 'constraint')
  if (constraints.length < 2) return null

  const prompt = `Here are things the user has said should constrain their projects:
${constraints.slice(0, 10).map(f => `- "${f.text}" (${f.projects?.title ?? 'unfiled'})`).join('\n')}

Find two that sit in real tension with each other -- not invented, actually there. Name both,
side by side, and leave it unresolved. Don't tell them which one is right.

${echo.avoid}
${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'contradiction', text: raw, project_id: null, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateScaleJump(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
  // Same subject rule as the gap: follow what's actually moving this week,
  // and swerve to something quieter every few sparks rather than circling
  // one project until it's the only one left warm enough to spark at all.
  const subject = await chooseSubject(supabase, userId)
  if (!subject) return null
  const pick = subject.row

  const prompt = `Project: "${pick.title}" -- ${pick.description || 'no description yet'}

Ask ONE question that jumps to the wrong altitude on purpose: if they've been thinking about
small details, ask the big-picture question ("what's this about, today, in one sentence?"); if
the project sounds vague and big, ask a small concrete question instead.

${echo.avoid}
${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null }`

  const raw = await askForSpark(prompt)
  if (!raw) return null
  return { type: 'scale_jump', text: raw, project_id: pick.id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

async function generateMaterialFact(supabase: SupabaseClient, userId: string, _echo: EchoContext): Promise<BakedSpark | null> {
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

async function generateOutsideReach(supabase: SupabaseClient, userId: string, echo: EchoContext): Promise<BakedSpark | null> {
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

  if (!projects || projects.length === 0) return null

  let readingLines: string[]
  if (highlights && highlights.length > 0) {
    readingLines = highlights.slice(0, 8).map((h: any) => `- "${h.highlight_text}" (from "${h.reading_queue?.title ?? 'an article'}")`)
  } else {
    // Nothing manually highlighted -- fall back to the corpus itself
    // (reading-corpus.ts's own eligibility rule: vouched-for articles
    // first, hand-saved ones as the legacy implicit signal). Without
    // this fallback outside_reach never fired for anyone who reads but
    // doesn't highlight, despite SPEC.md calling it "not optional."
    const { data: articles } = await supabase
      .from('reading_queue')
      .select('title, excerpt, resonance, tags')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    const eligible = selectCorpusArticles((articles ?? []) as (CorpusArticle & { title: string | null; excerpt: string | null })[])
    if (eligible.length === 0) return null
    readingLines = eligible.slice(0, 8).map(a => `- "${a.excerpt || a.title || 'an article'}" (from "${a.title ?? 'an article'}")`)
  }

  const prompt = `Recent reading (from outside the user's own projects):
${readingLines.join('\n')}

Their projects, each with an id:
${projects.map((p: any) => `- ${p.id}: ${p.title}`).join('\n')}

Find a technique, idea, or approach in the reading that's genuinely from OUTSIDE what they'd
normally think of for one of these projects, and name a concrete way it could apply. This has to
actually come from the reading, not just be a generic idea.

${echo.avoid}
${PLAIN_ENGLISH_RULES}
${SILENCE_INSTRUCTION}

Respond with JSON only: { "spark": "..." | null, "target_project_id": "the id from the list above, or null" }`

  const raw = await askForSparkWithField(prompt, 'target_project_id')
  if (!raw) return null

  const matchedProject = projects.find((p: any) => p.id === raw.value)

  return {
    type: 'outside_reach',
    text: raw.text,
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
async function generateForgotten(supabase: SupabaseClient, userId: string, _echo: EchoContext): Promise<BakedSpark | null> {
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


/** How far back "this week" reaches when reading momentum. A little over a
 *  week, so a project worked on last Sunday still counts on Tuesday. */
const MOMENTUM_WINDOW_DAYS = 10

interface SubjectRow extends SubjectCandidate {
  description: string | null
  metadata: any
  slots: any
  last_closeout_text: string | null
}

/**
 * Which project today's spark is about: mostly whatever has real movement
 * behind it this week, with a deliberate swerve to something quieter every
 * few sparks (spark-subject.ts). Shared by every type whose choice is
 * genuinely "which project", rather than "which fragment".
 */
async function chooseSubject(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ row: SubjectRow; deviation: boolean } | null> {
  const since = new Date(Date.now() - MOMENTUM_WINDOW_DAYS * 86_400_000).toISOString()
  const [{ data: projects }, { data: frags }, { data: sessions }, { data: recentSubjects }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, description, metadata, slots, last_closeout_text, last_active, last_session_ended_at, created_at')
      .eq('user_id', userId)
      .neq('state', 'harvested')
      .in('status', ['active', 'upcoming', 'dormant'])
      .limit(30),
    supabase.from('fragments').select('project_id').eq('user_id', userId).gte('created_at', since),
    supabase.from('sessions').select('project_id').eq('user_id', userId).gte('started_at', since),
    // Most-recent-first: the subject rotation reads the run, not just the
    // last one, to decide when a swerve is owed.
    supabase
      .from('sparks')
      .select('project_id, created_at')
      .eq('user_id', userId)
      .not('project_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
  if (!projects || projects.length === 0) return null

  const countBy = (rows: any[] | null, key = 'project_id') => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) {
      if (r?.[key]) m.set(r[key], (m.get(r[key]) ?? 0) + 1)
    }
    return m
  }
  const fragCounts = countBy(frags)
  const sessionCounts = countBy(sessions)

  const candidates: SubjectRow[] = projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    recentFragments: fragCounts.get(p.id) ?? 0,
    recentSessions: sessionCounts.get(p.id) ?? 0,
    lastTouchedAt: [p.last_session_ended_at, p.last_active, p.created_at].filter(Boolean).sort().pop() ?? null,
    description: p.description ?? null,
    metadata: p.metadata ?? {},
    slots: p.slots,
    last_closeout_text: p.last_closeout_text ?? null,
  }))

  const choice = pickSparkSubject(
    candidates,
    (recentSubjects ?? []).map((s: any) => s.project_id),
  )
  if (!choice) return null
  const row = candidates.find(c => c.id === choice.project.id)
  return row ? { row, deviation: choice.deviation } : null
}

/**
 * The gap: the one thing the app genuinely doesn't know about a project,
 * asked at the only moment it isn't an interruption.
 *
 * pickGap (session-gap.ts) already ranks these deterministically -- no
 * model call, because a model asked what it doesn't know goes back to
 * guessing. It was only ever reachable mid-session-shaping, i.e. exactly
 * when you'd sat down to WORK and the app couldn't build you a plan. That
 * is the worst possible moment for a question. This is the right one.
 */
async function generateGap(supabase: SupabaseClient, userId: string, _echo: EchoContext): Promise<BakedSpark | null> {
  const subject = await chooseSubject(supabase, userId)
  if (!subject) return null
  const { row } = subject

  const openTaskCount = Array.isArray(row.metadata?.tasks)
    ? row.metadata.tasks.filter((t: any) => t && !t.done).length
    : 0
  const gap = pickGap({
    title: row.title,
    endGoal: row.metadata?.end_goal ?? null,
    lastCloseout: row.last_closeout_text,
    openTaskCount,
    unfilledSlots: (Array.isArray(row.slots) ? row.slots : [])
      .filter((sl: any) => sl && !sl.filled)
      .map((sl: any) => sl?.name)
      .filter(Boolean),
  })

  // No real gap means the app understands this project well enough, and a
  // manufactured question is worse than silence -- the generic fallback is
  // only for a project it has almost nothing on.
  if (!gap) {
    const barelyKnown = !row.last_closeout_text?.trim() && openTaskCount === 0 && !row.description?.trim()
    if (!barelyKnown) return null
    return {
      type: 'gap',
      text: genericGapQuestion(row.title),
      project_id: row.id,
      expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS),
    }
  }

  return { type: 'gap', text: gap.question, project_id: row.id, expires_at: expiresAt(SPARK_SHELF_LIFE_HOURS) }
}

const GENERATORS: Record<SparkType, (supabase: SupabaseClient, userId: string, echo: EchoContext) => Promise<BakedSpark | null>> = {
  noticing: generateNoticing,
  gap: generateGap,
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
  type: SparkType,
  echo?: EchoContext,
): Promise<BakedSpark | null> {
  const context = echo ?? (await loadEchoContext(supabase, userId))
  const baked = await GENERATORS[type](supabase, userId, context)
  if (!baked) return null

  // The prompt was asked not to repeat itself; this is the part that makes
  // it a rule. A dropped spark isn't a lost day — the bake loop tries the
  // next type, and a fourth question about water is worse than one fewer
  // question.
  if (echoesRecent(baked.text, context.recentTexts)) {
    console.log(`[spark-generator] dropped ${type}: echoes a recent spark`)
    return null
  }
  return baked
}
