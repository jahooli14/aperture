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
import { avoidBlock, echoesRecent, fetchRecentSparkTexts, motifWords } from './spark-echo.js'
import { examplesBlock } from './mull-examples.js'
import { gatherSubjects, identityBlock, type Subject } from './mull-subjects.js'
import {
  selectConnectors,
  connectorCeiling,
  CONNECTOR_FLOOR,
  rankPairs,
  rejectionReason,
  type MullCandidate,
  type MullSourceKind,
  type MullSubjectKind,
} from './mull.js'

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

/** One to show, one banked behind it. Extra survivors are dropped: the
 *  depth exists so the gates have slack, not to fill the app with
 *  questions. */
const QUESTIONS_PER_RUN = 2

/** A little over a week, so a project worked on last Sunday still counts
 *  as warm on Tuesday. */
const MOMENTUM_WINDOW_DAYS = 10
/** How far back a note or an article can be and still be worth examining. */
const SUBJECT_LOOKBACK_DAYS = 45

/** Every `sparks.type` this channel can write. A runtime array rather than
 *  a bare union because `sparks_type_check` has to list the same values, and
 *  the one time it didn't, every insert 500'd for four days while the trace
 *  showed questions being written fine (`bake?explain=1` skips the insert).
 *  `spark-type-schema.test.ts` checks this against the migration. */
export const SPARK_TYPES_WRITTEN = ['mull'] as const

export type SparkType = (typeof SPARK_TYPES_WRITTEN)[number]

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

/**
 * Why a run produced nothing.
 *
 * Every decline was a console.log, which is only readable in Vercel's log
 * viewer for an hour. That made "the channel is silent" an unanswerable
 * report: silence is the designed outcome of four separate steps, and from
 * outside they are indistinguishable. The trace names which one, with the
 * numbers it decided on, and `bake?explain=1` returns it without writing
 * anything or spending a model call it did not already need.
 */
export type MullTrace = string[]

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
Each one comes with DATES — when it was first said, how often, how long the
silences were, when it stopped. Those lines are computed from their actual
capture history. They are true, you cannot improve them, and you must not
contradict them or invent new ones.

The dates are usually where the blind spot is. Someone who has said a thing
since 2023 and never built it is not short of the idea; they are assuming
something about what it would have to be. Someone who dropped a thing for a
year and came back did not need it and came back anyway. Read the timeline
first, then the words.

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
  - A THING THEY KEEP MENTIONING AND HAVE NEVER STARTED. If the dates say
    years and no project, this is almost always the one: what do they
    believe it would have to be before they'd begin?
  - A CHANGE THEY HAVEN'T NOTICED. The dates sometimes say the wording
    drifted, or a rhythm stopped in a particular month. They were there for
    it and still can't see it from inside; the shape only shows from
    outside, across years.

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
  trace: MullTrace = [],
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

    const connectors = selectConnectors(candidates, { subjectText: blind.subject.ownWords, excludeIds })
    // The numbers, not a verdict: how many the vector returned at all, the
    // best score it saw, and the band it had to fit. An empty search and a
    // search whose every hit was a restatement look identical from outside
    // and need completely different fixes.
    const best = candidates.reduce((m, c) => Math.max(m, c.similarity), 0)
    trace.push(
      `search [${blind.subject.kind}]: ${candidates.length} candidates, best ${best.toFixed(2)}, ` +
      `band ${CONNECTOR_FLOOR}-${connectorCeiling(blind.subject.ownWords).toFixed(2)} -> ` +
      (connectors.length > 0
        ? `${connectors.length} in band (${connectors.map(c => c.similarity.toFixed(2)).join(', ')})`
        : 'nothing in band'),
    )
    return connectors.map(connector => ({ ...blind, connector }))
  }))

  return searches.flat()
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
  // `line`, never `block`. A project's block quotes every fragment it has,
  // and handed ten of the user's own statements the model picks two and
  // collides them -- pair-first invention rebuilt inside one subject, with
  // the connector left doing nothing. See Subject.line.
  const blocks = pairings.map((p, i) => `--- PAIR ${i + 1} ---
What they've been working on:
${p.subject.line}

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
- The date is available to you, and when the length of time IS the point —
  they have believed this since 2023, they stopped in August — say it exactly:
  a real date is the one part they cannot argue with and the one part they had
  no way of seeing from inside. When the question works without it, leave it
  out. A date bolted onto the front of a question that doesn't turn on it is
  decoration, and it reads as the app showing its working. Never round one
  into "a while ago", and never state a date the lines above didn't give you.
- Specific enough to be WRONG. A question they could answer "no, it's not that
  at all" to is doing its job — that's a revelation too. A question that can't
  be wrong ("what's this really about?") is inert.
- Do NOT explain the link. Put the two things side by side and ask the
  question. If you write "which mirrors" or "this connects to" or "both are
  about", you have explained it, and explaining it is the tell that there was
  nothing there.
- Never pivot on "but you", "yet you", "though you". That construction always
  means the same thing — you have decided they are being inconsistent and are
  about to catch them out. You are not catching them out. Two facts, side by
  side, and a question.
- Their work gets their words. "Painting wood" for a set of painted coasters
  is you being clever at their expense, and it is the fastest way to make
  someone close the app. Call the thing what they call it.
- One fact about the project, one thing from the note. Not three things. If
  the question needs a second fact about the project to make sense, it isn't
  a question yet.
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

ALSO BAD, and this is the easy trap — "you said A, but you're doing B, so
what is B really?":
"You wrote that a memory needs to be trapped in a physical object right after
it happens, but you're also spending hours designing personalized t-shirts for
four friends. When does the moment actually become real?"
Two things wrong with it. The "but" manufactures a contradiction that isn't
there — designing the t-shirts IS trapping the memory in an object, so there
is nothing to resolve and nothing to think about. And the question walks away
from both halves into something you could ask about anything. A question that
fits any subject gets carried by nobody.
The note is a LENS you look at the project THROUGH. It is not evidence you
hold against them. Never set the two up as a gotcha, and make the question
land on something specific enough to name — a chapter, a deadline, a person,
a decision they are actually facing.

GOOD — the note does the work, the question is theirs, and something happens
either way. Ten of them, and they are not ten versions of one question. Some
end in a choice, some in a name, some in a counterfactual, some ask for a fact
you have and the notes don't. Copy the register, never the skeleton:
${examplesBlock()}
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
  trace: MullTrace = [],
): Promise<BakedSpark[]> {
  const subjects = await gatherSubjects(supabase, userId, trace)
  trace.push(
    subjects.length === 0
      ? 'subjects: none — no joint, project, thought, list item or article qualified'
      : `subjects: ${subjects.map(s => `${s.kind}/${s.shape ?? 'none'} "${s.title.slice(0, 40)}"`).join(' | ')}`,
  )
  if (subjects.length === 0) return []

  const blindSpots = await nameBlindSpots(subjects, echo)
  trace.push(
    blindSpots.length === 0
      ? 'blind spots: none — the model found nothing unexamined in any subject'
      : `blind spots: ${blindSpots.map(b => `[${b.subject.kind}] ${b.searchQuery.slice(0, 60)}`).join(' | ')}`,
  )
  if (blindSpots.length === 0) return []

  const pairings = await findConnectors(supabase, userId, blindSpots, trace)
  if (pairings.length === 0) {
    trace.push('connectors: none in band for any blind spot — see the per-search lines above')
    return []
  }

  const chosen = rankPairs(
    pairings.map(p => ({
      ...p,
      subjectId: p.subject.id,
      connectorId: p.connector.id,
      similarity: p.connector.similarity,
      subjectStrength: p.subject.strength,
    })),
  )

  trace.push(`pairs: ${pairings.length} found, ${chosen.length} sent to draft`)
  const drafts = await draftAll(chosen, echo)
  trace.push(`drafts: ${drafts.length} of ${chosen.length} pairs written`)
  const baked: BakedSpark[] = []
  // Each draft stands on its own: one failing a gate doesn't take the
  // other with it, which is most of why they're written together.
  const seen = [...echo.recentTexts]
  // Distinctness is enforced on what SHIPS, not on what gets attempted.
  // Reserve pairs may repeat a subject; they exist so the gates have slack.
  // Two questions about the same thing is one question and a repeat, and
  // the second is what the user gets days later when it is most obvious.
  const shippedSubjects = new Set<string>()

  for (const draft of drafts) {
    if (shippedSubjects.has(draft.pairing.subject.id)) continue
    const reason = rejectionReason({
      text: draft.text,
      quote: draft.quote,
      stake: draft.stake,
      connectorText: draft.pairing.connector.text,
    })
    if (reason) {
      trace.push(`dropped: ${reason}`)
      console.log(`[mull] dropped: ${reason}`)
      continue
    }
    // Checked against the questions already asked AND against the other
    // draft from this same run — two questions written in one breath are
    // where a repeated image is most likely and least excusable.
    if (echoesRecent(draft.text, seen)) {
      // Name the overlap. "Echoes a recent question" four times in a row
      // says the filter fired, not what it caught -- and what it caught
      // was a project title carried in by the forgotten offer.
      const shared = motifWords(draft.text).filter(w =>
        seen.some(prev => motifWords(prev).includes(w)))
      trace.push(`dropped: echoes a recent question (shared: ${shared.slice(0, 6).join(', ') || 'a repeated motif'})`)
      console.log('[mull] dropped: echoes a recent question')
      continue
    }
    seen.push(draft.text)
    shippedSubjects.add(draft.pairing.subject.id)

    // Attribute to a project where there is one, so the card can say what
    // it's about and the answer files itself somewhere. A note with no
    // project and an article both leave this null rather than guessing.
    if (baked.length >= QUESTIONS_PER_RUN) break
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
 * What the bake and the reroll both call. Two model calls, up to two
 * questions, and nothing at all when the corpus has nothing to say.
 *
 * There used to be a consolation prize here: "you set down <project> N
 * months ago". Elapsed time is a fact about the calendar, not a reason to
 * care, and because it was the FALLBACK it only ever appeared when the
 * channel had found no insight — a card that by construction carried
 * none. It also held the slot for four days and, being made of project
 * titles, blocked every real question about those projects as an echo of
 * itself.
 *
 * Resurfacing a dormant project is still the channel's job; it just has to
 * earn it. `long_unfinished` and `return` (corpus-time.ts) do exactly
 * that, with a dated fact and a question attached. An empty slot is the
 * honest alternative, and the home surface already renders nothing there.
 */
export async function bakeMull(
  supabase: SupabaseClient,
  userId: string,
  echo?: EchoContext,
  trace: MullTrace = [],
): Promise<BakedSpark[]> {
  const context = echo ?? (await loadEchoContext(supabase, userId))
  const mulls = await generateMull(supabase, userId, context, trace)
  if (mulls.length === 0) trace.push('nothing worth asking — empty slot')
  return mulls
}
