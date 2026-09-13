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
/** How many subjects go into the one blind-spot call. */
const SUBJECT_SLOTS = 3
/** A list item wanted for longer than this is a standing want, not a mood. */
const LONG_HELD_DAYS = 365
/** Old enough that not filing it was a choice, not a backlog. */
const UNFILED_DAYS = 120

export interface Subject {
  kind: MullSubjectKind
  shape?: TemporalShape | 'simultaneity' | 'drift' | 'long_held' | 'unfiled'
  id: string
  projectId: string | null
  title: string
  /** Everything the BLIND-SPOT call sees, already formatted. Rich on
   *  purpose: naming what a project never examines needs its whole history. */
  block: string
  /**
   * What the DRAFT call sees instead — one dated fact, no quoted fragments.
   *
   * The draft used to get `block` too, and a project's block quotes every
   * fragment it has. Handed ten of the user's own statements, the model does
   * the obvious thing: it picks two and sets them against each other. That
   * is pair-first invention rebuilt inside a single subject, and the
   * connector never gets to do any work. A real run produced "You wanted to
   * map all 198 countries to a memory palace. Yet you left your painted
   * coasters sitting for eleven months after writing down the Esqui ice
   * saga" — three fragments of one project, collided, with the connector
   * absent and the user asking what any of it had to do with the rest.
   *
   * So the draft gets one line. The only quotable language left in front of
   * it is the connector's, which is the whole design: joint → pair, never
   * pair → invented bridge.
   */
  line: string
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
async function loadCaptures(
  supabase: SupabaseClient,
  userId: string,
  trace: string[] = [],
): Promise<{
  thoughts: CorpusRow[]
  fragments: (CorpusRow & { projectTitle: string | null })[]
  /** memory_id -> project_id, via the fragments link table. */
  filedMemoryIds: Set<string>
}> {
  // `memories` has no project_id column -- fragments is the link table
  // (memory_id + project_id), which is how the rest of the app relates a
  // thought to a project. Selecting a column that does not exist makes
  // PostgREST reject the whole query, and an unchecked `data` then looks
  // exactly like an empty corpus.
  const [memoriesRes, fragmentsRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT),
    supabase
      .from('fragments')
      .select('id, text, created_at, memory_id, project_id, projects(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(CORPUS_LIMIT),
  ])

  noteQuery(trace, 'memories', memoriesRes)
  noteQuery(trace, 'fragments', fragmentsRes)

  const fragments = (fragmentsRes.data ?? []).map((f: any) => ({
    id: f.id,
    text: f.text ?? '',
    createdAt: f.created_at,
    projectId: f.project_id ?? null,
    projectTitle: f.projects?.title ?? null,
    memoryId: f.memory_id ?? null,
  })).filter(r => r.text.trim().length > 0)

  const projectOfMemory = new Map<string, string>()
  const filedMemoryIds = new Set<string>()
  for (const f of fragments) {
    if (!f.memoryId) continue
    filedMemoryIds.add(f.memoryId)
    if (f.projectId) projectOfMemory.set(f.memoryId, f.projectId)
  }

  return {
    thoughts: (memoriesRes.data ?? []).map((m: any) => ({
      id: m.id,
      text: typeof m.body === 'string' && m.body.trim() ? m.body : (m.title ?? ''),
      createdAt: m.created_at,
      projectId: projectOfMemory.get(m.id) ?? null,
    })).filter(r => r.text.trim().length > 0),
    fragments,
    filedMemoryIds,
  }
}

/**
 * A failed query and an empty table are the same value.
 *
 * Every read here was `const { data } = await ...`, so a rejected query --
 * a column that does not exist, an RLS policy, a bad filter -- produced
 * `undefined` and was read as "the user has nothing". That is how a
 * missing column turned into "subjects: none" and cost a day. The error
 * goes in the trace now, where it is the first thing you see.
 */
function noteQuery(trace: string[], label: string, res: { data: unknown[] | null; error: unknown }) {
  const err = res.error as { message?: string } | null
  if (err) trace.push(`!! ${label} query FAILED: ${err.message ?? String(err)}`)
  else trace.push(`${label}: ${res.data?.length ?? 0} rows`)
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
  trace: string[] = [],
): Promise<Subject[]> {
  const jointsRes = await supabase
    .from('joints')
    .select('id, text, fragment_ids')
    .eq('user_id', userId)
    .limit(40)
  noteQuery(trace, 'joints', jointsRes)
  const joints = jointsRes.data

  const byId = new Map(fragments.map(f => [f.id, f]))
  const projectsRes = await supabase
    .from('projects')
    .select('id, title')
    .eq('user_id', userId)
    .limit(200)
  noteQuery(trace, 'joint-project-titles', projectsRes)
  const projectRows = projectsRes.data
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
      line: `Something they keep saying: "${joint.text}". ${found.fact}`,
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
  trace: string[] = [],
): Promise<Subject[]> {
  const projectsRes = await supabase
    .from('projects')
    .select('id, title, description, metadata, last_closeout_text, created_at')
    .eq('user_id', userId)
    .neq('state', 'harvested')
    .limit(100)
  noteQuery(trace, 'projects', projectsRes)
  const projects = projectsRes.data

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
      line: [
        `Their project "${project.title}"`,
        project.description ? `— ${project.description}` : null,
        `. ${found.fact}`,
      ].filter(Boolean).join(' '),
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
    kind: 'pair' as const,
    shape: 'simultaneity' as const,
    id: `${pair.a.id}:${pair.b.id}`,
    projectId: pair.a.projectId,
    title: 'two things at once',
    block: `${simultaneityFact(pair)}

  Under ${titleOf.get(pair.a.projectId!) ?? 'one project'}: "${pair.a.text.slice(0, 400)}"
  Under ${titleOf.get(pair.b.projectId!) ?? 'another project'}: "${pair.b.text.slice(0, 400)}"`,
    // The only subject whose two halves are both the point -- the fact IS
    // that these two were said days apart and never joined.
    line: `${simultaneityFact(pair)}\n  One: "${pair.a.text.slice(0, 260)}"\n  The other: "${pair.b.text.slice(0, 260)}"`,
    ownWords: `${pair.a.text} ${pair.b.text}`,
    strength: 0.8,
  }))
}

/**
 * A thought old enough to have been filed somewhere, that never was.
 *
 * Thoughts fed the timelines and turned up as connectors, but could never
 * be the thing asked about — so a striking note that belongs to no project
 * was invisible to the channel that exists to find exactly that. Its shape
 * is not recurrence; it is that nobody ever did anything with it.
 */
async function unfiledThoughtSubject(
  supabase: SupabaseClient,
  userId: string,
  filedMemoryIds: Set<string>,
  trace: string[] = [],
): Promise<Subject | null> {
  const cutoff = new Date(Date.now() - UNFILED_DAYS * 86_400_000).toISOString()
  // "Never filed" = no fragment points at it. There is no project_id on
  // memories to be null.
  const res = await supabase
    .from('memories')
    .select('id, title, body, created_at')
    .eq('user_id', userId)
    .lt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(120)
  noteQuery(trace, 'unfiled-candidates', res)

  const unattached = (res.data ?? []).filter((m: any) => !filedMemoryIds.has(m.id))
  const usable = unattached.filter(
    (m: any) => typeof m.body === 'string' && m.body.trim().length > 150,
  )
  trace.push(
    `unfiled: ${res.data?.length ?? 0} old notes -> ${unattached.length} with no fragment ` +
    `pointing at them -> ${usable.length} long enough to be a subject`,
  )
  if (usable.length === 0) return null
  const pick: any = usable[Math.floor(Math.random() * Math.min(usable.length, 8))]
  const age = humanDuration((Date.now() - new Date(pick.created_at).getTime()) / 86_400_000)

  return {
    kind: 'memory',
    shape: 'unfiled',
    id: pick.id,
    projectId: null,
    title: pick.title ?? 'a note',
    block: `They said this in ${monthYear(new Date(pick.created_at))} — ${age} ago — and it has never been attached to a project or acted on:\n"${pick.body}"`,
    line: `Said in ${monthYear(new Date(pick.created_at))}, ${age} ago, never attached to a project: "${pick.body.slice(0, 400)}"`,
    ownWords: `${pick.title ?? ''} ${pick.body}`,
    strength: 0.7,
  }
}

/** A thing wanted for a year and still not done. A list is a record of
 *  intentions with dates on them, which nothing has ever read as one. */
async function longHeldSubject(
  supabase: SupabaseClient, userId: string, trace: string[] = [],
): Promise<Subject | null> {
  const cutoff = new Date(Date.now() - LONG_HELD_DAYS * 86_400_000).toISOString()
  const res = await supabase
    .from('list_items')
    .select('id, content, created_at, status, lists(title, type)')
    .eq('user_id', userId)
    // gather.ts's vocabulary: a wanted-but-not-done item can be 'pending'
    // as well as 'active'. Taking only 'active' silently skipped most lists.
    .in('status', ['pending', 'active'])
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(20)
  noteQuery(trace, 'long-held-candidates', res)

  const items = (res.data ?? []).filter((i: any) => typeof i.content === 'string' && i.content.trim())
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
    line: `They put "${pick.content}" on their ${pick.lists?.title ?? 'list'} in ${monthYear(new Date(pick.created_at))}, ${age} ago, and it is still sitting there.`,
    ownWords: pick.content,
    strength: 0.55,
  }
}

/** Reading, no longer windowed: an article that earned its place two years
 *  ago is still something they vouched for. */
async function articleSubject(
  supabase: SupabaseClient, userId: string, trace: string[] = [],
): Promise<Subject | null> {
  const res = await supabase
    .from('reading_queue')
    .select('id, title, excerpt, resonance, tags, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(300)
  noteQuery(trace, 'article-candidates', res)

  // 198 rows in, 0 out told us nothing: an unvouched RSS backlog and a
  // table of articles with no stored excerpt look identical from outside.
  const corpus = selectCorpusArticles(
    (res.data ?? []) as (CorpusArticle & { id: string; title: string | null; excerpt: string | null })[],
  )
  const eligible = corpus.filter(
    (a: any) => typeof a.excerpt === 'string' && a.excerpt.trim().length > 120,
  )
  trace.push(
    `articles: ${res.data?.length ?? 0} rows -> ${corpus.length} in corpus ` +
    `(good or hand-saved) -> ${eligible.length} with an excerpt over 120 chars`,
  )

  if (eligible.length === 0) return null
  const pick: any = eligible[Math.floor(Math.random() * Math.min(eligible.length, 12))]
  const framing = pick.resonance === 'good' ? 'read and marked good' : 'saved to read'

  return {
    kind: 'article',
    id: pick.id,
    projectId: null,
    title: pick.title ?? 'an article',
    block: `Something they ${framing} in ${monthYear(new Date(pick.created_at))} — "${pick.title ?? 'an article'}":\n"${pick.excerpt}"`,
    line: `Something they ${framing} in ${monthYear(new Date(pick.created_at))}, "${pick.title ?? 'an article'}": "${pick.excerpt.slice(0, 400)}"`,
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
export async function identityBlock(
  supabase: SupabaseClient, userId: string, trace: string[] = [],
): Promise<string> {
  const res = await supabase
    .from('list_items')
    .select('content, user_rating, created_at, lists(title, type)')
    .eq('user_id', userId)
    .in('status', ['pending', 'active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(60)
  noteQuery(trace, 'identity-list-items', res)

  const items = (res.data ?? []).filter((i: any) => typeof i.content === 'string' && i.content.trim())
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
export async function gatherSubjects(
  supabase: SupabaseClient,
  userId: string,
  trace: string[] = [],
): Promise<Subject[]> {
  const { thoughts, fragments, filedMemoryIds } = await loadCaptures(supabase, userId, trace)

  // Built once from every capture there is, and handed to every shape: the
  // denominator that stops a life event reading as a decision about one
  // project (corpus-time.ts).
  const baseline = buildActivityBaseline([...thoughts, ...fragments].map(r => r.createdAt))

  const [joints, projects, unfiled, longHeld, article] = await Promise.all([
    jointSubjects(supabase, userId, fragments, baseline, trace),
    projectSubjects(supabase, userId, fragments, thoughts, baseline, trace),
    unfiledThoughtSubject(supabase, userId, filedMemoryIds, trace),
    longHeldSubject(supabase, userId, trace),
    articleSubject(supabase, userId, trace),
  ])

  const all = [
    ...joints,
    ...projects,
    ...simultaneitySubjects(fragments, thoughts),
    ...(unfiled ? [unfiled] : []),
    ...(longHeld ? [longHeld] : []),
    ...(article ? [article] : []),
  ].sort((a, b) => b.strength - a.strength)

  // Per-gatherer counts. "subjects: none" was true and useless: five paths
  // decline for five different reasons and only the totals were visible.
  trace.push(
    `gatherers: joints ${joints.length}, projects ${projects.length}, ` +
    `pairs ${simultaneitySubjects(fragments, thoughts).length}, ` +
    `unfiled ${unfiled ? 1 : 0}, long-held ${longHeld ? 1 : 0}, article ${article ? 1 : 0}`,
  )

  // Strongest first, never more than two of one kind.
  //
  // The cap is by KIND only. Deduping by kind-and-shape as well collapsed
  // ten project subjects into one, because they all happened to classify
  // the same way -- and one subject means one blind spot, one pair, one
  // draft, so a single gate rejection at the end produces nothing at all.
  // Three subjects exist precisely so two can fail. Two projects with the
  // same shape are still two different projects.
  const perKind = new Map<string, number>()
  const picked: Subject[] = []
  for (const subject of all) {
    if ((perKind.get(subject.kind) ?? 0) >= 2) continue
    perKind.set(subject.kind, (perKind.get(subject.kind) ?? 0) + 1)
    picked.push(subject)
    if (picked.length >= SUBJECT_SLOTS) break
  }

  // Reading keeps its slot whenever there is any. A corpus-only system can
  // only recombine the user -- SPEC.md calls the outside bridge "not
  // optional" -- and on strength alone an article (no temporal shape, so
  // the lowest score there is) would never once be chosen.
  if (article && !picked.includes(article)) {
    picked.splice(Math.max(0, SUBJECT_SLOTS - 1), 1, article)
  }
  return picked
}
