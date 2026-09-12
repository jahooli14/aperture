/**
 * What today's question is about, chosen from the whole corpus rather than
 * the last six weeks of it.
 *
 * Every selector this replaced was recency-bound — the newest 150
 * fragments, 45 days of notes, momentum-weighted projects — which meant a
 * corpus with years in it was only ever asked what happened lately. The
 * years are where the convictions are.
 *
 * A subject is now a TEMPORAL SHAPE (corpus-time.ts): a true, dated
 * statement computed from timestamps, with the captures that prove it.
 * "They have been saying this since March 2023 and never made it a
 * project" is arithmetic, not a judgement, and the model can neither
 * choose it nor invent it — it is handed one and asked to write the
 * question. Same inversion as the connector search, one level down.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { motifWords } from './spark-echo.js'
import { selectCorpusArticles, type CorpusArticle } from './reading-corpus.js'
import {
  describeTimeline,
  classifyTimeline,
  buildActivityBaseline,
  type ActivityBaseline,
  findSimultaneous,
  findDrift,
  simultaneityFact,
  monthYear,
  humanDuration,
  type Capture,
  type TemporalShape,
} from './corpus-time.js'
import type { MullSubjectKind } from './mull.js'

/** Whole-corpus reads are capped, not windowed. A cap loses the oldest
 *  only once someone has written more than this; a window loses them on
 *  day 46 forever. */
const CORPUS_LIMIT = 2000
/** A list item wanted for longer than this is a standing want, not a mood. */
const LONG_HELD_DAYS = 365

export interface Subject {
  kind: MullSubjectKind
  shape?: TemporalShape | 'simultaneity' | 'drift' | 'long_held'
  id: string
  projectId: string | null
  title: string
  /** Everything the prompt sees, already formatted. */
  block: string
  /** The same content unformatted — what the vocabulary rule compares
   *  connectors against. */
  ownWords: string
  /** Higher wins in rankPairs. Set from the shape's own strength. */
  strength: number
}

interface CorpusRow {
  id: string
  text: string
  createdAt: string
  projectId: string | null
}

/** Thoughts and fragments, all of them, with dates. Small columns only —
 *  this is a whole-corpus read and the bodies are fetched later, for the
 *  handful of captures that end up in a chosen shape. */
async function loadCaptures(supabase: SupabaseClient, userId: string): Promise<{
  thoughts: CorpusRow[]
  fragments: (CorpusRow & { projectTitle: string | null })[]
}> {
  const [{ data: memories }, { data: fragments }] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, created_at, project_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT),
    supabase
      .from('fragments')
      .select('id, text, created_at, project_id, projects(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT),
  ])

  return {
    thoughts: (memories ?? []).map((m: any) => ({
      id: m.id,
      text: typeof m.body === 'string' && m.body.trim() ? m.body : (m.title ?? ''),
      createdAt: m.created_at,
      projectId: m.project_id ?? null,
    })).filter(r => r.text.trim().length > 0),
    fragments: (fragments ?? []).map((f: any) => ({
      id: f.id,
      text: f.text ?? '',
      createdAt: f.created_at,
      projectId: f.project_id ?? null,
      projectTitle: f.projects?.title ?? null,
    })).filter(r => r.text.trim().length > 0),
  }
}

function quoteLines(rows: { text: string; createdAt: string }[], limit = 6): string {
  return [...rows]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, limit)
    .map(r => `  - ${monthYear(new Date(r.createdAt))}: "${r.text.slice(0, 300)}"`)
    .join('\n')
}

/**
 * The strongest subjects there are: a thing said across years.
 *
 * `joints` holds the semantic clusters (joint-miner.ts, now whole-corpus
 * and span-filtered). What it never had was a timeline, so a joint said
 * five times in one week outranked one said every autumn since 2023. The
 * dates of its own fragments settle that, and they cost one query.
 */
async function jointSubjects(
  supabase: SupabaseClient,
  userId: string,
  fragments: (CorpusRow & { projectTitle: string | null })[],
  baseline: ActivityBaseline,
): Promise<Subject[]> {
  const { data: joints } = await supabase
    .from('joints')
    .select('id, text, fragment_ids')
    .eq('user_id', userId)
    .limit(40)

  const byId = new Map(fragments.map(f => [f.id, f]))
  const { data: projectRows } = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', userId)
    .limit(200)
  const projectTitles = new Set((projectRows ?? []).map((p: any) => (p.title ?? '').toLowerCase()))

  const out: Subject[] = []
  for (const joint of (joints ?? []) as any[]) {
    const members = ((joint.fragment_ids ?? []) as string[])
      .map(id => byId.get(id))
      .filter((f): f is CorpusRow & { projectTitle: string | null } => !!f)
    if (members.length < 2) continue

    const timeline = describeTimeline(members.map(m => m.createdAt))
    if (!timeline) continue

    // "Has it ever become a project" decides between the two strongest
    // readings: a conviction you're acting on, and one you never have.
    const hasProject =
      members.some(m => m.projectId !== null) || projectTitles.has(String(joint.text ?? '').toLowerCase())

    const found = classifyTimeline({ timeline, hasProject, label: joint.text, baseline })
    if (!found) continue

    const drift = findDrift(members, motifWords)
    const driftLine = drift
      ? `\nHow they talk about it has changed: early on it was ${drift.early.slice(0, 4).join(', ')}; lately it's ${drift.late.slice(0, 4).join(', ')}.`
      : ''

    out.push({
      kind: 'joint',
      shape: drift ? 'drift' : found.shape,
      id: joint.id,
      projectId: members.find(m => m.projectId)?.projectId ?? null,
      title: joint.text,
      block: `Something they keep coming back to: "${joint.text}"\n${found.fact}${driftLine}\nIn their own words, oldest first:\n${quoteLines(members)}`,
      ownWords: `${joint.text} ${members.map(m => m.text).join(' ')}`,
      strength: found.strength,
    })
  }
  return out
}

/**
 * A project read as a timeline rather than as a heat score.
 *
 * Momentum weighting answered "what is warm", which is the question the
 * session contract already answers all day. The interesting projects here
 * are the ones with a shape: a rhythm that stopped in a nameable month, a
 * thing picked back up after a year away.
 */
async function projectSubjects(
  supabase: SupabaseClient,
  userId: string,
  fragments: (CorpusRow & { projectTitle: string | null })[],
  thoughts: CorpusRow[],
  baseline: ActivityBaseline,
): Promise<Subject[]> {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, description, metadata, last_closeout_text, created_at')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(100)

  const byProject = new Map<string, CorpusRow[]>()
  for (const row of [...fragments, ...thoughts]) {
    if (!row.projectId) continue
    if (!byProject.has(row.projectId)) byProject.set(row.projectId, [])
    byProject.get(row.projectId)!.push(row)
  }

  const out: Subject[] = []
  for (const project of (projects ?? []) as any[]) {
    const rows = byProject.get(project.id) ?? []
    if (rows.length < 2) continue
    const timeline = describeTimeline(rows.map(r => r.createdAt))
    if (!timeline) continue

    const found = classifyTimeline({ timeline, hasProject: true, label: project.title, baseline })
    if (!found) continue

    out.push({
      kind: 'project',
      shape: found.shape,
      id: project.id,
      projectId: project.id,
      title: project.title,
      block: [
        `Project: ${project.title}`,
        project.description ? `What it is: ${project.description}` : null,
        project.metadata?.end_goal ? `Where it ends: ${project.metadata.end_goal}` : null,
        found.fact,
        project.last_closeout_text ? `Last time they worked on it: "${project.last_closeout_text}"` : null,
        `What they've said about it, oldest first:\n${quoteLines(rows)}`,
      ].filter(Boolean).join('\n'),
      ownWords: `${project.title} ${project.description ?? ''} ${rows.map(r => r.text).join(' ')}`,
      strength: found.strength,
    })
  }
  return out
}

/**
 * Two things on their mind the same week, filed apart, never joined since.
 *
 * The one subject here with no semantic component at all. Vector search
 * can only return things that resemble each other, so the pair whose only
 * connection is a shared Tuesday in 2024 is invisible to every other
 * mechanism in this app — including the connector search downstream of
 * this. Purely a fact about when someone was typing.
 */
function simultaneitySubjects(
  fragments: (CorpusRow & { projectTitle: string | null })[],
  thoughts: CorpusRow[],
): Subject[] {
  const captures: Capture[] = [...fragments, ...thoughts].map(r => ({
    id: r.id, text: r.text, createdAt: r.createdAt, projectId: r.projectId, source: 'thought',
  }))

  const titleOf = new Map(fragments.filter(f => f.projectId).map(f => [f.projectId!, f.projectTitle]))

  return findSimultaneous(captures).slice(0, 2).map(pair => ({
    kind: 'joint' as const,
    shape: 'simultaneity' as const,
    id: `${pair.a.id}:${pair.b.id}`,
    projectId: pair.a.projectId,
    title: 'two things at once',
    block: `${simultaneityFact(pair)}

  Under ${titleOf.get(pair.a.projectId!) ?? 'one project'}: "${pair.a.text.slice(0, 400)}"
  Under ${titleOf.get(pair.b.projectId!) ?? 'another project'}: "${pair.b.text.slice(0, 400)}"`,
    ownWords: `${pair.a.text} ${pair.b.text}`,
    strength: 0.8,
  }))
}

/** A thing wanted for a year and still not done. A list is a record of
 *  intentions with dates on them, which nothing has ever read as one. */
async function longHeldSubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const cutoff = new Date(Date.now() - LONG_HELD_DAYS * 86_400_000).toISOString()
  const { data } = await supabase
    .from('list_items')
    .select('id, content, created_at, status, lists(title, type)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(20)

  const items = (data ?? []).filter((i: any) => typeof i.content === 'string' && i.content.trim())
  if (items.length === 0) return null
  const pick: any = items[Math.floor(Math.random() * Math.min(items.length, 6))]
  const age = humanDuration((Date.now() - new Date(pick.created_at).getTime()) / 86_400_000)

  return {
    kind: 'memory',
    shape: 'long_held',
    id: pick.id,
    projectId: null,
    title: pick.content,
    block: `They put "${pick.content}" on their ${pick.lists?.title ?? 'list'} in ${monthYear(new Date(pick.created_at))} — ${age} ago — and it is still sitting there, not done, not removed.`,
    ownWords: pick.content,
    strength: 0.55,
  }
}

/** Reading, no longer windowed: an article that earned its place two years
 *  ago is still something they vouched for. */
async function articleSubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const { data } = await supabase
    .from('reading_queue')
    .select('id, title, excerpt, resonance, tags, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(300)

  const eligible = selectCorpusArticles(
    (data ?? []) as (CorpusArticle & { id: string; title: string | null; excerpt: string | null })[],
  ).filter((a: any) => typeof a.excerpt === 'string' && a.excerpt.trim().length > 120)

  if (eligible.length === 0) return null
  const pick: any = eligible[Math.floor(Math.random() * Math.min(eligible.length, 12))]
  const framing = pick.resonance === 'good' ? 'read and marked good' : 'saved to read'

  return {
    kind: 'article',
    id: pick.id,
    projectId: null,
    title: pick.title ?? 'an article',
    block: `Something they ${framing} in ${monthYear(new Date(pick.created_at))} — "${pick.title ?? 'an article'}":\n"${pick.excerpt}"`,
    ownWords: `${pick.title ?? ''} ${pick.excerpt}`,
    strength: 0.4,
  }
}

/**
 * Who they are, as distinct from what they're doing.
 *
 * Lists are identity signals, not consumption logs. Never the subject of a
 * question and never quoted — none of these are the user's own words. They
 * set the register, and a question that reads as though the app has never
 * met you doesn't sit for three days.
 */
export async function identityBlock(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('list_items')
    .select('content, user_rating, created_at, lists(title, type)')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(60)

  const items = (data ?? []).filter((i: any) => typeof i.content === 'string' && i.content.trim())
  if (items.length === 0) return ''

  const loved = items.filter((i: any) => (i.user_rating ?? 0) >= 4)
  // Oldest and newest, not just newest: the things someone has kept caring
  // about and the things they've picked up lately say different things,
  // and a list read newest-first only ever shows the second.
  const pool = loved.length >= 6 ? loved : items
  const shown = [...pool.slice(0, 10), ...pool.slice(-8)]

  return `
Who they are, from what they've chosen to watch, read and listen to (context
only — never the subject of a question, and never quoted, since none of these
are their words):
${shown.map((i: any) => `  - ${i.content}${i.lists?.type ? ` (${i.lists.type})` : ''}`).join('\n')}
`
}

/**
 * Everything today could be about, strongest first.
 *
 * All of them, not one: three subjects go into a single blind-spot call, so
 * two can come back with nothing and the run still produces a question.
 * Ordering is by the shape's own strength — a thing said since 2023 and
 * never built outranks an article every time.
 */
export async function gatherSubjects(supabase: SupabaseClient, userId: string): Promise<Subject[]> {
  const { thoughts, fragments } = await loadCaptures(supabase, userId)

  // Built once from every capture there is, and handed to every shape: the
  // denominator that stops a life event reading as a decision about one
  // project (corpus-time.ts).
  const baseline = buildActivityBaseline([...thoughts, ...fragments].map(r => r.createdAt))

  const [joints, projects, longHeld, article] = await Promise.all([
    jointSubjects(supabase, userId, fragments, baseline),
    projectSubjects(supabase, userId, fragments, thoughts, baseline),
    longHeldSubject(supabase, userId),
    articleSubject(supabase, userId),
  ])

  const all = [
    ...joints,
    ...projects,
    ...simultaneitySubjects(fragments, thoughts),
    ...(longHeld ? [longHeld] : []),
    ...(article ? [article] : []),
  ].sort((a, b) => b.strength - a.strength)

  // One per kind-and-shape, so a corpus full of long convictions doesn't
  // spend all three slots saying the same thing in different words.
  const seen = new Set<string>()
  const picked: Subject[] = []
  for (const subject of all) {
    const key = `${subject.kind}:${subject.shape ?? 'none'}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(subject)
    if (picked.length >= 3) break
  }
  return picked
}
