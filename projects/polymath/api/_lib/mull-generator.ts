/**
 * The mull channel: one thing to carry around, built in three steps.
 *
 * See mull.ts for why it works this way. This file is the IO half —
 * choose what to look at, ask what each one never examines, search the
 * corpus with those questions stripped of their own vocabulary, and write
 * the collisions that come back.
 *
 * It is built around which parts cost money. Model calls are the expense;
 * Postgres and embeddings are close to free. So the run spends exactly TWO
 * model calls whatever happens, and puts as much work as it can either
 * side of them:
 *
 *   - Call one asks about every subject at once — a project, a recent
 *     note, an article — so three blind spots cost what one did.
 *   - Retrieval then runs three searches instead of one, which is the step
 *     most likely to come back empty, and the one that costs nothing to
 *     repeat.
 *   - Call two writes up the best TWO surviving pairs together. The second
 *     question is banked, unexpired, behind the first: it becomes the next
 *     standing question and the instant answer to "ask me something else",
 *     with no further calls at all.
 *
 * The earlier version of this file asked about one subject, searched once,
 * and wrote one question — so a single empty search wasted both calls and
 * the day. Same price, and now a run usually feeds the channel for a week.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { batchGenerateEmbeddings } from './gemini-embeddings.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { avoidBlock, echoesRecent, fetchRecentSparkTexts } from './spark-echo.js'
import { pickSparkSubject, type SubjectCandidate } from './spark-subject.js'
import { selectCorpusArticles, type CorpusArticle } from './reading-corpus.js'
import {
  selectConnector,
  rankPairs,
  rejectionReason,
  type MullCandidate,
  type MullSourceKind,
  type MullSubjectKind,
} from './mull.js'
import {
  selectForgottenProject,
  forgottenSparkText,
  FORGOTTEN_SILENCE_DAYS,
  FORGOTTEN_COOLDOWN_DAYS,
} from './forgotten.js'

/**
 * Four days.
 *
 * The whole value of a mull is that it gets to sit — you read it, you
 * don't answer it, and three days later on a walk the answer turns up. At
 * 24 hours it expired overnight, so it could only ever be answered on the
 * spot or lost, which is the opposite of how thinking about a thing in
 * the background works.
 */
export const SHELF_LIFE_HOURS = 96

/** A little over a week, so a project worked on last Sunday still counts
 *  as warm on Tuesday. */
const MOMENTUM_WINDOW_DAYS = 10
/** How far back a note or an article can be and still be worth examining. */
const SUBJECT_LOOKBACK_DAYS = 45

export type SparkType = 'mull' | 'forgotten'

export interface BakedSpark {
  type: SparkType
  text: string
  project_id: string | null
  expires_at: string
  /** Written now, shown later. Held behind the standing question rather
   *  than replacing it — the channel's cheapest question is the one that
   *  was already paid for days ago. */
  banked?: boolean
}

export interface EchoContext {
  recentTexts: string[]
  avoid: string
  /** Questions this person actually answered, and what they said back —
   *  plus the ones they read and ignored. See loadResonance. */
  resonance: string
  /** Lists: films, books, records. Register, not material. */
  identity: string
}

/**
 * What has actually landed with THIS person, and what hasn't.
 *
 * `sparks.response_memory_id` is set only when a question got a real voice
 * answer, and that answer is a row in `memories`. Since the type bandit was
 * deleted nothing read either of them, which means the app was throwing
 * away the only evidence it has about what makes this particular person
 * stop and talk back. Generic advice about what makes a good question is
 * worth much less than six examples of the ones that worked on them.
 *
 * The ignored ones matter just as much and are cheaper to be honest about:
 * a question shown and left to expire is a question that didn't land, and
 * saying so in the prompt costs nothing.
 */
async function loadResonance(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ data: answered }, { data: ignored }] = await Promise.all([
    supabase
      .from('sparks')
      .select('text, response_memory_id')
      .eq('user_id', userId)
      .not('response_memory_id', 'is', null)
      .order('answered_at', { ascending: false })
      .limit(6),
    supabase
      .from('sparks')
      .select('text')
      .eq('user_id', userId)
      .not('shown_at', 'is', null)
      .is('response_memory_id', null)
      .lt('expires_at', new Date().toISOString())
      .order('shown_at', { ascending: false })
      .limit(6),
  ])

  const memoryIds = (answered ?? []).map((s: any) => s.response_memory_id).filter(Boolean)
  const replies = new Map<string, string>()
  if (memoryIds.length > 0) {
    const { data: memories } = await supabase
      .from('memories')
      .select('id, body')
      .eq('user_id', userId)
      .in('id', memoryIds)
    for (const m of memories ?? []) {
      if (typeof (m as any).body === 'string') replies.set((m as any).id, (m as any).body)
    }
  }

  const landed = (answered ?? [])
    .map((s: any) => {
      const reply = replies.get(s.response_memory_id)
      return reply ? `  Q: "${s.text}"\n  They said back: "${reply.slice(0, 400)}"` : null
    })
    .filter(Boolean)

  const missed = (ignored ?? []).map((s: any) => `  - "${s.text}"`)
  if (landed.length === 0 && missed.length === 0) return ''

  return `
${landed.length > 0 ? `THESE ONES WORKED — they stopped and answered out loud:\n${landed.join('\n\n')}\n` : ''}${missed.length > 0 ? `\nTHESE ONES DIDN'T — read, and left to expire without a word:\n${missed.join('\n')}\n` : ''}
Whatever is different between those two groups is what matters here. Match the
first group. Not their subject — their shape, their nerve, how much they left
for the reader to do.
`
}

export async function loadEchoContext(supabase: SupabaseClient, userId: string): Promise<EchoContext> {
  const [recentTexts, resonance, identity] = await Promise.all([
    fetchRecentSparkTexts(supabase, userId),
    loadResonance(supabase, userId),
    identityBlock(supabase, userId),
  ])
  return { recentTexts, avoid: avoidBlock(recentTexts), resonance, identity }
}

function expiresAt(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

/** The thing today's question is about, flattened so one prompt can take
 *  a project, a note or an article without three shapes of prompt. */
interface Subject {
  kind: MullSubjectKind
  id: string
  projectId: string | null
  title: string
  /** Everything the prompt gets to see, already formatted. */
  block: string
  /** The same content unformatted — what the vocabulary rule compares
   *  connectors against. */
  ownWords: string
}

// ─── Step 1: what today is about ──────────────────────────────────────

interface ProjectRow extends SubjectCandidate {
  description: string | null
  metadata: any
  last_closeout_text: string | null
}

async function projectSubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const since = new Date(Date.now() - MOMENTUM_WINDOW_DAYS * 86_400_000).toISOString()
  const [{ data: projects }, { data: frags }, { data: sessions }, { data: recentSubjects }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, description, metadata, last_closeout_text, last_active, last_session_ended_at, created_at')
      .eq('user_id', userId)
      .neq('state', 'harvested')
      .in('status', ['active', 'upcoming', 'dormant'])
      .limit(30),
    supabase.from('fragments').select('project_id').eq('user_id', userId).gte('created_at', since),
    supabase.from('sessions').select('project_id').eq('user_id', userId).gte('started_at', since),
    supabase
      .from('sparks')
      .select('project_id, created_at')
      .eq('user_id', userId)
      .not('project_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
  ])
  if (!projects || projects.length === 0) return null

  const countBy = (rows: any[] | null) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) if (r?.project_id) m.set(r.project_id, (m.get(r.project_id) ?? 0) + 1)
    return m
  }
  const fragCounts = countBy(frags)
  const sessionCounts = countBy(sessions)

  const candidates: ProjectRow[] = projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    recentFragments: fragCounts.get(p.id) ?? 0,
    recentSessions: sessionCounts.get(p.id) ?? 0,
    lastTouchedAt: [p.last_session_ended_at, p.last_active, p.created_at].filter(Boolean).sort().pop() ?? null,
    description: p.description ?? null,
    metadata: p.metadata ?? {},
    last_closeout_text: p.last_closeout_text ?? null,
  }))

  const choice = pickSparkSubject(candidates, (recentSubjects ?? []).map((s: any) => s.project_id))
  if (!choice) return null
  const row = candidates.find(c => c.id === choice.project.id)
  if (!row) return null

  // The captures are what make a blind spot findable: a description says
  // what the project is, the fragments say what the user keeps saying
  // about it, and an assumption only shows up in the second one.
  const { data: fragmentRows } = await supabase
    .from('fragments')
    .select('text, role')
    .eq('user_id', userId)
    .eq('project_id', row.id)
    .order('created_at', { ascending: false })
    .limit(8)

  const parts = [
    `Project: ${row.title}`,
    row.description ? `What it is: ${row.description}` : null,
    row.metadata?.end_goal ? `Where it ends: ${row.metadata.end_goal}` : null,
    row.last_closeout_text ? `Last time they worked on it: "${row.last_closeout_text}"` : null,
    (fragmentRows ?? []).length > 0
      ? `Things they've said about it:\n${(fragmentRows ?? []).map((f: any) => `  - "${f.text}"`).join('\n')}`
      : null,
  ].filter(Boolean)

  return {
    kind: 'project',
    id: row.id,
    projectId: row.id,
    title: row.title,
    block: parts.join('\n'),
    ownWords: parts.join(' '),
  }
}

async function memorySubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const cutoff = new Date(Date.now() - SUBJECT_LOOKBACK_DAYS * 86_400_000).toISOString()
  const { data } = await supabase
    .from('memories')
    .select('id, title, body, project_id, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(25)

  const usable = (data ?? []).filter((m: any) => typeof m.body === 'string' && m.body.trim().length > 120)
  if (usable.length === 0) return null
  const pick: any = usable[Math.floor(Math.random() * usable.length)]

  const block = `Something they said on ${new Date(pick.created_at).toDateString()}:\n"${pick.body}"`
  return {
    kind: 'memory',
    id: pick.id,
    projectId: pick.project_id ?? null,
    title: pick.title ?? 'a note',
    block,
    ownWords: `${pick.title ?? ''} ${pick.body}`,
  }
}

async function articleSubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const cutoff = new Date(Date.now() - SUBJECT_LOOKBACK_DAYS * 86_400_000).toISOString()
  const { data } = await supabase
    .from('reading_queue')
    .select('id, title, excerpt, resonance, tags, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(40)

  // Only an article that earned its place. An unread RSS headline is not
  // something the user has a blind spot about (reading-corpus.ts).
  const eligible = selectCorpusArticles(
    (data ?? []) as (CorpusArticle & { id: string; title: string | null; excerpt: string | null })[],
  ).filter((a: any) => typeof a.excerpt === 'string' && a.excerpt.trim().length > 120)

  if (eligible.length === 0) return null
  const pick: any = eligible[Math.floor(Math.random() * eligible.length)]

  const vouched = pick.resonance === 'good'
  const framing = vouched ? 'Something they read and marked good' : 'Something they saved to read'
  const block = `${framing} — "${pick.title ?? 'an article'}":\n"${pick.excerpt}"`
  return {
    kind: 'article',
    id: pick.id,
    projectId: null,
    title: pick.title ?? 'an article',
    block,
    ownWords: `${pick.title ?? ''} ${pick.excerpt}`,
  }
}

/**
 * The strongest subject there is: something said more than once.
 *
 * `joints` is already mined weekly for composites (joint-miner.ts) and was
 * read by nothing else. It is the corpus answering "what does this person
 * keep coming back to" — clustered from their own fragments, quoted, with
 * an occurrence count. A blind spot found on a recurrence is not "what
 * does this project assume"; it is "you have said this four times and
 * never made the thing it implies", which is the shortest path there is to
 * a revelation.
 *
 * Preferred over recency everywhere: it gets the largest ranking bonus,
 * and the most-repeated joint that hasn't been asked about recently wins.
 */
async function jointSubject(supabase: SupabaseClient, userId: string): Promise<Subject | null> {
  const { data } = await supabase
    .from('joints')
    .select('id, text, fragment_ids, occurrence_count, last_seen_at')
    .eq('user_id', userId)
    .order('occurrence_count', { ascending: false })
    .limit(10)

  const usable = (data ?? []).filter((j: any) => typeof j.text === 'string' && j.text.trim().length > 0)
  if (usable.length === 0) return null

  // Rotate: the top joint every week is the same joint every week.
  const pick: any = usable[Math.floor(Math.random() * Math.min(usable.length, 4))]

  // The joint sentence is a summary; the fragments are the user's actual
  // words. Both go in, because the question has to quote them and not it.
  const { data: fragments } = await supabase
    .from('fragments')
    .select('text, project_id, projects(title)')
    .eq('user_id', userId)
    .in('id', (pick.fragment_ids ?? []).slice(0, 8))

  const lines = (fragments ?? []).map((f: any) => `  - "${f.text}" (${f.projects?.title ?? 'unfiled'})`)
  const block = [
    `Something they keep coming back to, said ${pick.occurrence_count ?? lines.length} times across different projects:`,
    `  "${pick.text}"`,
    lines.length > 0 ? `In their own words each time:\n${lines.join('\n')}` : null,
  ].filter(Boolean).join('\n')

  return {
    kind: 'joint',
    id: pick.id,
    // Attribute to whichever project the recurrence touched most recently,
    // so an answer files itself somewhere rather than floating.
    projectId: (fragments ?? [])[0]?.project_id ?? null,
    title: pick.text,
    block,
    ownWords: `${pick.text} ${(fragments ?? []).map((f: any) => f.text).join(' ')}`,
  }
}

/**
 * Who they are, as distinct from what they're doing.
 *
 * Lists are identity signals, not consumption logs — the films, books and
 * records someone chose say something their project notes never will. They
 * are never the subject and never the thing quoted (they carry no words of
 * the user's own). They set the register: a question framed for someone
 * whose list is Herzog and Bach lands differently from the same question
 * framed for someone else, and a question that reads as though the app has
 * never met you doesn't sit for three days.
 */
async function identityBlock(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('list_items')
    .select('content, user_rating, lists(title, type)')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(40)

  const items = (data ?? []).filter((i: any) => typeof i.content === 'string' && i.content.trim())
  if (items.length === 0) return ''

  const loved = items.filter((i: any) => (i.user_rating ?? 0) >= 4)
  const shown = (loved.length >= 5 ? loved : items).slice(0, 18)

  return `
Who they are, from what they've chosen to watch, read and listen to (context
only — never the subject of a question, and never quoted, since none of these
are their words):
${shown.map((i: any) => `  - ${i.content}${i.lists?.type ? ` (${i.lists.type})` : ''}`).join('\n')}
`
}

/**
 * Everything today could be about. All of them, not one — the whole point
 * of asking about three subjects in a single call is that two of them can
 * come back with nothing and the run still produces a question.
 */
async function gatherSubjects(supabase: SupabaseClient, userId: string): Promise<Subject[]> {
  const found = await Promise.all([
    jointSubject(supabase, userId),
    projectSubject(supabase, userId),
    memorySubject(supabase, userId),
    articleSubject(supabase, userId),
  ])
  return found.filter((s): s is Subject => s !== null)
}

// ─── Step 2: the blind spots, and the queries that leave them behind ──

interface BlindSpot {
  subject: Subject
  blindSpot: string
  searchQuery: string
}

/**
 * One call for every subject there is.
 *
 * Naming an assumption and stripping a sentence of its jargon is close to
 * extraction, so this is the call that gets its thinking capped — the
 * prose budget belongs to the draft, which is the half the user reads.
 */
async function nameBlindSpots(subjects: Subject[], echo: EchoContext): Promise<BlindSpot[]> {
  const blocks = subjects
    .map((s, i) => `--- SUBJECT ${i + 1} ---\n${s.block}`)
    .join('\n\n')

  const prompt = `Here are ${subjects.length} things from the user's own corpus.

${blocks}
${echo.identity}
For EACH one, two jobs.

1. Name the BLIND SPOT: the one thing it takes for granted and has never
examined. Not a missing next step — a step is work, not a blind spot. The
assumption underneath it that would change what they make if it turned out to
be wrong. One plain sentence.

The four shapes worth looking for, in rough order of how often they end in
someone deciding to make something:
  - A TENSION they've carried for months without noticing. Two things they
    keep saying that can't both be true. Naming it is the whole job; the way
    out of it is usually the thing they make.
  - A CONSTRAINT they think is fixed and isn't. They've never tested it
    because they've never said it out loud.
  - A RULE visible across several of these at once, which none of them is
    purely made of yet.
  - A THING THEY KEEP MENTIONING AND HAVE NEVER STARTED. If the subject is
    something they've said more than once, this is almost always the one:
    what do they believe it would have to be before they'd begin?

2. Write a SEARCH QUERY for it. This is the part that matters and it is NOT the
blind spot reworded. Take out every word that belongs to that subject — its
title, its medium, its craft words, the names in it — and write the same
question as a plain human one, the way someone who had never heard of the
project would ask it.

Example of the two together:
  Subject: a novel where characters get swapped out partway through.
  blind_spot: "It assumes replacing someone is a different thing from watching them change, and never says what the difference is."
  search_query: "what it's like when someone you know turns into a different person, and whether you can tell being left behind from them simply changing"

Notice the search query has no novel, no characters, no chapters in it. That is
the whole point: each one gets matched against everything the user has ever
written or read, and a query still carrying its subject's words will only ever
find that subject again.

A subject with nothing genuinely unexamined about it gets "blind_spot": null.
Say so rather than reaching — the other subjects are there for exactly this.
${echo.avoid}
${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "subjects": [ { "n": 1, "blind_spot": "..." | null, "search_query": "..." }, ... ] }`

  try {
    const parsed = JSON.parse(await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'low' }))
    const rows = Array.isArray(parsed?.subjects) ? parsed.subjects : []
    const out: BlindSpot[] = []
    for (const row of rows) {
      const subject = subjects[Number(row?.n) - 1]
      const blindSpot = typeof row?.blind_spot === 'string' ? row.blind_spot.trim() : ''
      const searchQuery = typeof row?.search_query === 'string' ? row.search_query.trim() : ''
      if (subject && blindSpot && searchQuery) out.push({ subject, blindSpot, searchQuery })
    }
    return out
  } catch (e) {
    console.warn('[mull] blind spots failed:', e instanceof Error ? e.message : e)
    return []
  }
}

// ─── Step 3: what the corpus says about those questions ───────────────

/** Deliberately below mull.ts's floor: the band does the filtering, and
 *  asking Postgres for a wider set means the vocabulary rule has
 *  something left to choose from after it throws the near ones out. */
const RPC_THRESHOLD = 0.35

interface Pairing extends BlindSpot {
  connector: MullCandidate
}

/**
 * Search every blind spot at once. Nine RPCs and one batched embedding
 * call — the cheapest part of the run, and the part most likely to come
 * back with nothing, which is exactly why it's the part that gets
 * repeated rather than the model calls.
 */
async function findConnectors(
  supabase: SupabaseClient,
  userId: string,
  blindSpots: BlindSpot[],
): Promise<Pairing[]> {
  let embeddings: number[][]
  try {
    embeddings = await batchGenerateEmbeddings(blindSpots.map(b => b.searchQuery))
  } catch (e) {
    console.warn('[mull] embedding failed:', e instanceof Error ? e.message : e)
    return []
  }

  const searches = await Promise.all(blindSpots.map(async (blind, i) => {
    const args = {
      query_embedding: `[${embeddings[i].join(',')}]`,
      filter_user_id: userId,
      match_threshold: RPC_THRESHOLD,
    }
    const [memories, projects, reading] = await Promise.all([
      supabase.rpc('match_memories', { ...args, match_count: 20 }),
      supabase.rpc('match_projects', { ...args, match_count: 10 }),
      supabase.rpc('match_reading', { ...args, match_count: 10 }),
    ])

    const candidates: MullCandidate[] = [
      ...(memories.data ?? []).map((m: any) => ({
        kind: 'memory' as const, id: m.id, title: m.title ?? 'a note', text: m.body ?? '', similarity: m.similarity,
      })),
      ...(projects.data ?? []).map((p: any) => ({
        kind: 'project' as const, id: p.id, title: p.title, text: p.description ?? '', similarity: p.similarity,
      })),
      ...(reading.data ?? []).map((a: any) => ({
        kind: 'article' as const, id: a.id, title: a.title ?? 'an article', text: a.excerpt ?? '', similarity: a.similarity,
      })),
    ]

    // A project subject excludes itself both as a row and as the parent of
    // the notes filed under it — those are the subject in other words, and
    // the band alone wouldn't catch a briefly-worded one.
    const excludeIds = [blind.subject.id]
    if (blind.subject.projectId) excludeIds.push(blind.subject.projectId)

    const connector = selectConnector(candidates, { subjectText: blind.subject.ownWords, excludeIds })
    return connector ? { ...blind, connector } : null
  }))

  return searches.filter((p): p is Pairing => p !== null)
}

// ─── Step 4: the collisions, written down ─────────────────────────────

const CONNECTOR_LABEL: Record<MullSourceKind, string> = {
  memory: 'A note they made, about something else entirely',
  project: 'A different project of theirs',
  article: 'Something they read and vouched for',
}

interface Drafted {
  pairing: Pairing
  text: string
  quote: string
  /** What the user would do differently. Validated, not displayed — a
   *  question that can't name one is an observation with a question mark
   *  on the end. */
  stake: string
}

/**
 * One call, both questions. The second is not a spare in case the first
 * fails validation — it's banked and served days later, so the channel
 * keeps going without another run. Writing them together also means the
 * model can see it's about to say the same thing twice.
 */
async function draftAll(pairings: Pairing[], echo: EchoContext): Promise<Drafted[]> {
  const blocks = pairings.map((p, i) => `--- PAIR ${i + 1} ---
What they've been working on:
${p.subject.block}

The thing it never examines:
"${p.blindSpot}"

${CONNECTOR_LABEL[p.connector.kind]} — "${p.connector.title}":
"${p.connector.text.slice(0, 1200)}"`).join('\n\n')

  const prompt = `${blocks}
${echo.identity}
Each note above was NOT picked because it looks like the project it sits with.
It was found by searching for that pair's unexamined question, in plain words.
So the link is already there before you write anything.

For each pair, write ONE thing for them to carry around.

WHAT THIS IS FOR. They read it on the way past and do nothing. It sits for
three days. On a walk, on the fourth day, they work out the answer — and the
answer leaves them with something to make. You are not naming that thing.
Naming it is the one move that guarantees they don't get there themselves,
and getting there themselves is the entire point. You stop one step short.

The band it has to land in, and this is the hard part:
- TOO EASY is a quiz. If they can answer it in five seconds it's gone in five
  seconds and nothing happens for three days.
- TOO HARD is a riddle. If there's no answer in them at all they read it,
  feel nothing, and it expires.
- RIGHT is when they know they have the answer and can't quite reach it. That
  irritation is the whole mechanism. Aim there.

What makes it good:
- The note is the LENS. The question should be one they could only ask because
  that note exists.
- Use the note's own concrete detail. Not "your recent reflections on family" —
  say the thing it actually said. Their words, not a summary of their words:
  they can dismiss you, they can't dismiss themselves from eight months ago.
- Specific enough to be WRONG. A question they could answer "no, it's not that
  at all" to is doing its job — that's a revelation too. A question that can't
  be wrong ("what's this really about?") is inert.
- Do NOT explain the link. Put the two things side by side and ask the
  question. If you write "which mirrors" or "this connects to" or "both are
  about", you have explained it, and explaining it is the tell that there was
  nothing there.
- Do not resolve it. No advice, no "you could try". They answer, not you.
- At most three sentences, ending in the question.
- The pairs get read days apart, so they must not be two versions of the same
  question. If the second one would be, return null for it.
- If the only honest link in a pair is that the two things are broadly about
  the same topic, there is no link. Return null for that pair.

Then, for each, say what CHANGES depending on their answer. Not what they'd
understand — what they'd DO. "They cut chapters nine to twelve" is a stake.
"They'd have a deeper sense of their themes" is not a stake, it's a way of
saying there isn't one. If you can't write a real one, the question isn't
ready: return null for that pair.
${echo.resonance}
BAD — a resemblance dressed up, explained to death, and nothing turns on it:
"You love how Tame Impala treats synths as machines that generate ideas on their
own. Does the water dancing scene in your book do that same work for the story?"

GOOD — the note does the work, the question is theirs, and something happens
either way:
"You wrote that you've probably got ten more proper conversations left with your
dad, and you're spending them on the garden. The book swaps Lena out in chapter
nine and nobody left in it notices. What are those chapters for?"
  stake: "If the answer is nothing, chapters nine to twelve come out."
${echo.avoid}
${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "pairs": [ { "n": 1, "spark": "..." | null, "quote": "the words from that pair's note you used, copied out exactly", "stake": "what they would actually DO differently" }, ... ] }`

  try {
    const parsed = JSON.parse(await generateText(prompt, { responseFormat: 'json' }))
    const rows = Array.isArray(parsed?.pairs) ? parsed.pairs : []
    const out: Drafted[] = []
    for (const row of rows) {
      const pairing = pairings[Number(row?.n) - 1]
      const text = typeof row?.spark === 'string' ? row.spark.trim() : ''
      const quote = typeof row?.quote === 'string' ? row.quote.trim() : ''
      const stake = typeof row?.stake === 'string' ? row.stake.trim() : ''
      if (pairing && text && quote && stake) out.push({ pairing, text, quote, stake })
    }
    return out
  } catch (e) {
    console.warn('[mull] draft failed:', e instanceof Error ? e.message : e)
    return []
  }
}

// ─── The channel ──────────────────────────────────────────────────────

export async function generateMull(
  supabase: SupabaseClient,
  userId: string,
  echo: EchoContext,
): Promise<BakedSpark[]> {
  const subjects = await gatherSubjects(supabase, userId)
  if (subjects.length === 0) return []

  const blindSpots = await nameBlindSpots(subjects, echo)
  if (blindSpots.length === 0) {
    console.log('[mull] nothing unexamined in', subjects.length, 'subjects')
    return []
  }

  const pairings = await findConnectors(supabase, userId, blindSpots)
  if (pairings.length === 0) {
    console.log('[mull] corpus had no answer to any of:', blindSpots.map(b => b.searchQuery))
    return []
  }

  const chosen = rankPairs(
    pairings.map(p => ({
      ...p,
      subjectKind: p.subject.kind,
      subjectId: p.subject.id,
      connectorId: p.connector.id,
      similarity: p.connector.similarity,
    })),
  )

  const drafts = await draftAll(chosen, echo)
  const baked: BakedSpark[] = []
  // Each draft stands on its own: one failing a gate doesn't take the
  // other with it, which is most of why they're written together.
  const seen = [...echo.recentTexts]

  for (const draft of drafts) {
    const reason = rejectionReason({
      text: draft.text,
      quote: draft.quote,
      stake: draft.stake,
      connectorText: draft.pairing.connector.text,
    })
    if (reason) {
      console.log(`[mull] dropped: ${reason}`)
      continue
    }
    // Checked against the questions already asked AND against the other
    // draft from this same run — two questions written in one breath are
    // where a repeated image is most likely and least excusable.
    if (echoesRecent(draft.text, seen)) {
      console.log('[mull] dropped: echoes a recent question')
      continue
    }
    seen.push(draft.text)

    // Attribute to a project where there is one, so the card can say what
    // it's about and the answer files itself somewhere. A note with no
    // project and an article both leave this null rather than guessing.
    baked.push({
      type: 'mull',
      text: draft.text,
      project_id: draft.pairing.subject.projectId,
      expires_at: expiresAt(SHELF_LIFE_HOURS),
      // The second question is not shown yet: it waits behind the first
      // and only becomes the standing question once that one is answered
      // or runs out. Its shelf life is measured from then, not from now,
      // or it would expire in the queue having never been seen.
      banked: baked.length > 0,
    })
  }

  if (baked.length > 1) {
    baked[1].expires_at = expiresAt(SHELF_LIFE_HOURS * 2)
  }

  return baked
}

/**
 * The one thing the mull channel doesn't do: offer a long-silent project
 * back into play.
 *
 * It isn't a question — the useful answer is a tap, not words — which is
 * why the attention slot renders it with an action instead of a
 * microphone, and why StandingQuestion filters it out. Deterministic, no
 * model call: the useful output is a plain fact about how long it's been.
 *
 * It runs only when the mull channel has nothing, and it declines on its
 * own most nights. A project the corpus is still talking about belongs to
 * the morph path, and a vague "still want this?" about it would be
 * strictly worse than silence.
 */
export async function generateForgotten(
  supabase: SupabaseClient,
  userId: string,
): Promise<BakedSpark | null> {
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
    expires_at: expiresAt(SHELF_LIFE_HOURS),
  }
}

/**
 * What the bake and the reroll both call. Two model calls, up to two
 * questions, and the forgotten-project offer if there were none — it costs
 * nothing and it's the only other thing the channel has to say.
 */
export async function bakeMull(
  supabase: SupabaseClient,
  userId: string,
  echo?: EchoContext,
): Promise<BakedSpark[]> {
  const context = echo ?? (await loadEchoContext(supabase, userId))
  const mulls = await generateMull(supabase, userId, context)
  if (mulls.length > 0) return mulls
  const forgotten = await generateForgotten(supabase, userId)
  return forgotten ? [forgotten] : []
}
