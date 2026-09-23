/**
 * The mull channel: questions that bring a revelation, built from the
 * whole corpus.
 *
 * The rebuild's one idea: a revelation is something the person already
 * knows and has never said, and it only shows when things they captured
 * apart are put side by side. The old channel grounded every question in
 * ONE row and checked it by regex, so it could only ever read a note back
 * with a question mark on the end -- live: "What is 'a piece they need to
 * create'?". Honest, and empty.
 *
 * Three steps now:
 *
 *   1. DRAFT. Flash reads the whole corpus and proposes up to four
 *      candidates, each built on two or more rows, cited by ref with
 *      verbatim quotes.
 *   2. GATE. mull.ts checks honesty only: every quote really in its row,
 *      every name/number/date in the question present in the cited rows,
 *      plain voice, not yes/no. Nothing about taste.
 *   3. JUDGE. One call reads each survivor against its FULL evidence rows
 *      and scores revelation, truth, specificity and answerability --
 *      harshly. Only what the judge ships, ships.
 *
 * Up to three per run: one to show, two banked behind it, so "ask me
 * something else" is instant and free most of the time.
 *
 * Everything reports into the trace, which `bake?explain=1` prints: every
 * candidate with its evidence, every gate rejection by name, every judge
 * score with its reason.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { echoesRecent, fetchRecentSparkTexts, fetchRecentSparkProjectIds, fetchRecentSparkSubjectIds } from './spark-echo.js'
import { SPARK_CORRECTION_TAG } from './corpus-provenance.js'
import { loadCorpus, normaliseTitle, type Corpus } from './mull-corpus.js'
import { checkCandidate, judgeShips, judgeRank, parseJudgeScores, type Candidate, type Grounded, type JudgeScore } from './mull.js'
import { draftPrompt, judgePrompt } from './mull-prompts.js'

/**
 * Four days.
 *
 * The whole value of a mull is that it gets to sit -- you read it, you
 * don't answer it, and three days later on a walk the answer turns up.
 */
export const SHELF_LIFE_HOURS = 96

/** One to show, two banked behind it. */
const QUESTIONS_PER_RUN = 3

/** Candidates per draft call; the judge sees all that pass the gates. */
const CANDIDATES_PER_RUN = 4

/** Flash throughout. Pro was tried in the rebuild and pulled: too slow
 *  for a reroll someone is waiting on, several times the cost, and Flash
 *  is close to as good here.
 *
 *  Both calls run at `low`, which on this model means NO hidden thinking
 *  (measured: 0 thinking tokens). The old draft ran at `medium` and took
 *  ~24s, almost all of it hidden reasoning before a word of the answer.
 *  The draft reasons in the open instead -- `noticing` and `doubt` per
 *  candidate. `minimal` is not supported on this model: it 400s. */
const MODEL = 'gemini-flash-latest'

/**
 * The whole run -- history, corpus, draft, judge -- inside ten seconds,
 * the owner's ceiling. Measured on a corpus this size (~17k input tokens):
 * corpus ~2.5s, draft 2.6-5.2s, judge ~1.5s. Each call gets whatever the
 * budget has left; a judge with no time left is skipped, and the draft's
 * first honest candidate ships alone.
 */
export const TOTAL_BUDGET_MS = 10_000
/** The judge needs about this long; below it, it isn't started. */
const MIN_JUDGE_MS = 1_200
/** Left for everything after the judge: gates, ranking, the insert. */
const TAIL_MS = 300

/** Every `sparks.type` this channel can write. A runtime array rather than
 *  a bare union because `sparks_type_check` has to list the same values.
 *  `spark-type-schema.test.ts` checks this against the migration. */
export const SPARK_TYPES_WRITTEN = ['mull'] as const

export type SparkType = (typeof SPARK_TYPES_WRITTEN)[number]

export interface BakedSpark {
  type: SparkType
  text: string
  project_id: string | null
  expires_at: string
  /** What they would do differently once they've answered. Stored so a
   *  question that shipped can be diagnosed afterwards. */
  stake?: string
  /** The first row the question was built on -- a real project / memory /
   *  fragment / list_item / article id -- so the next run can avoid it. */
  subject_id?: string
  subject_kind?: string
  /** Written now, shown later. */
  banked?: boolean
}

/** Why a run produced what it did. See the header. */
export type MullTrace = string[]

export interface EchoContext {
  recentTexts: string[]
  /** Projects a recent question was already about, by id. */
  recentProjectIds?: Set<string>
  /** Rows a recent question was built on, by id. */
  recentSubjectIds?: Set<string>
  /** Questions this person actually answered, and what they said back. */
  resonance: string
  /** Premises earlier questions got wrong. Context, never corpus. */
  corrections: string
}

/**
 * What has actually landed with THIS person, and what hasn't.
 *
 * `sparks.response_memory_id` is set only when a question got a real voice
 * answer, and that answer is a row in `memories`. Generic advice about what
 * makes a good question is worth much less than six examples of the ones
 * that worked on them.
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
    const memoriesRes = await supabase
      .from('memories')
      .select('id, body')
      .eq('user_id', userId)
      .in('id', memoryIds)
    if (memoriesRes.error) {
      console.warn('[mull] could not read past answers:', memoriesRes.error.message)
    }
    for (const m of memoriesRes.data ?? []) {
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
Whatever made the first group worth answering is what matters. Not their
subject or their wording -- what they put in front of the person, and how much
they left for the person to work out.
`
}

/**
 * Corrections a follow-up caught — a wrong premise, put right, in their own
 * words (spark-followup.ts, corpus-provenance.ts's SPARK_CORRECTION_TAG).
 *
 * These notes are excluded from `loadCorpus` for the same reason every
 * spark response is: dated today, filed as a "capture," they'd fake the
 * exact "just came back to it" signal the exclusion exists to prevent. But
 * throwing the correction away entirely means the channel can ask the same
 * wrong-premise question again — the whole point of the one follow-up was
 * to catch that. So it's handed to the draft prompt separately, as plain
 * context with no date attached: not material to quote from or build a new
 * question around, just a standing note of what's actually true now.
 */
async function loadCorrections(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('memories')
    .select('body, source_reference')
    .eq('user_id', userId)
    .contains('tags', [SPARK_CORRECTION_TAG])
    .order('created_at', { ascending: false })
    .limit(15)
  if (error) {
    console.warn('[mull] could not read past corrections:', error.message)
    return ''
  }

  const rows = (data ?? [])
    .map((m: any) => {
      const said = typeof m.body === 'string' ? m.body.trim() : ''
      if (!said) return null
      const asked = m.source_reference?.type === 'spark' ? m.source_reference.title : null
      return asked ? `  Asked: "${asked}"\n  They corrected it: "${said}"` : `  They corrected: "${said}"`
    })
    .filter((r): r is string => !!r)
  if (rows.length === 0) return ''

  return `
THEY'VE CORRECTED US BEFORE — premises earlier questions got wrong, now on record (${rows.length}):
${rows.join('\n\n')}
Don't build a new question on a premise one of these already corrected. These
are not material to quote from or ask about directly — just don't repeat the
mistake.
`
}

export async function loadEchoContext(
  supabase: SupabaseClient, userId: string,
): Promise<EchoContext> {
  const [recentTexts, recentProjectIds, recentSubjectIds, resonance, corrections] = await Promise.all([
    fetchRecentSparkTexts(supabase, userId),
    fetchRecentSparkProjectIds(supabase, userId),
    fetchRecentSparkSubjectIds(supabase, userId),
    loadResonance(supabase, userId),
    loadCorrections(supabase, userId),
  ])
  return { recentTexts, recentProjectIds, recentSubjectIds, resonance, corrections }
}

function expiresAt(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Model output read leniently: absent, null or malformed all read as absent. */
export function readCandidates(raw: unknown): Candidate[] {
  const list = (raw as { candidates?: unknown })?.candidates
  if (!Array.isArray(list)) return []
  return list.map((c: any): Candidate => ({
    question: str(c?.question),
    noticing: str(c?.noticing),
    stake: str(c?.stake),
    project: str(c?.project) || null,
    evidence: Array.isArray(c?.evidence)
      ? c.evidence.map((e: any) => ({ ref: str(e?.ref), quote: str(e?.quote) })).filter((e: { quote: string }) => e.quote)
      : [],
  })).filter(c => c.question)
}

type Usage = { input: number; output: number; thinking: number } | null

const tokens = (u: Usage) =>
  u ? ` (tokens: ${u.input} in, ${u.thinking} thinking, ${u.output} out)` : ''

async function draft(prompt: string, timeoutMs: number, trace: MullTrace): Promise<Candidate[]> {
  const start = Date.now()
  let usage: Usage = null
  try {
    const raw = await generateText(prompt, {
      responseFormat: 'json', model: MODEL, maxTokens: 16384,
      thinkingLevel: 'low', timeoutMs, onUsage: u => { usage = u },
    })
    const candidates = readCandidates(parseModelJson(raw))
    trace.push(`draft: ${candidates.length} candidates in ${Date.now() - start}ms${tokens(usage)}`)
    return candidates
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    trace.push(`!! draft FAILED after ${Date.now() - start}ms: ${message}`)
    console.warn('[mull] draft failed:', message)
    return []
  }
}

async function judge(grounded: Grounded[], loose: boolean, timeoutMs: number, trace: MullTrace): Promise<Map<number, JudgeScore> | null> {
  const start = Date.now()
  let usage: Usage = null
  try {
    const raw = await generateText(judgePrompt(grounded, loose), {
      responseFormat: 'json', model: MODEL, maxTokens: 8192,
      thinkingLevel: 'low', timeoutMs, onUsage: u => { usage = u },
    })
    const scores = parseJudgeScores(parseModelJson(raw), grounded.length)
    trace.push(`judge: scored ${scores.size} of ${grounded.length} in ${Date.now() - start}ms${tokens(usage)}`)
    return scores.size > 0 ? scores : null
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    trace.push(`!! judge FAILED after ${Date.now() - start}ms: ${message}`)
    console.warn('[mull] judge failed:', message)
    return null
  }
}

/** The project a question is about: the model's own answer, matched
 *  against real titles (never trusted as an id), else the first project
 *  its evidence cites or sits under. */
function projectFor(c: Grounded, corpus: Corpus): string | null {
  const named = c.project ? corpus.projectIdByTitle.get(normaliseTitle(c.project)) : undefined
  if (named) return named
  return c.rows.find(r => r.kind === 'project')?.id ?? c.rows.find(r => r.projectId)?.projectId ?? null
}

const label = (c: Grounded) => `"${c.question}" <- ${c.rows.map(r => r.ref).join(', ')}`

// ─── The channel ──────────────────────────────────────────────────────

export async function generateMull(
  supabase: SupabaseClient,
  userId: string,
  /** A promise is fine: bakeMull loads it alongside the corpus. */
  echoIn: EchoContext | Promise<EchoContext>,
  trace: MullTrace = [],
  /** "Get more creative" -- reroll's fallback once the strict pass came
   *  back empty. Recent ground is allowed again, the shape gates stand
   *  down and the judge's bar drops. Honesty (quotes, specifics, truth)
   *  never relaxes. */
  creative = false,
  /** When the whole run must be finished by. */
  deadline = Date.now() + TOTAL_BUDGET_MS,
): Promise<BakedSpark[]> {
  const corpusStart = Date.now()
  const [corpus, echo] = await Promise.all([loadCorpus(supabase, userId, trace), echoIn])
  if (corpus.rows.length === 0) {
    trace.push('corpus: nothing to draw from -- no project, note, fragment, list item or article qualified')
    return []
  }
  trace.push(`corpus + history: ${corpus.rows.length} rows, ${corpus.text.length} chars, loaded in ${Date.now() - corpusStart}ms`)

  const recentIds = new Set<string>(creative ? [] : [
    ...(echo.recentSubjectIds ?? []),
    ...corpus.rows.filter(r => r.kind === 'project' && echo.recentProjectIds?.has(r.id)).map(r => r.id),
  ])
  const recentTexts = creative ? [] : echo.recentTexts

  const prompt = draftPrompt({
    corpusText: corpus.text,
    howMany: CANDIDATES_PER_RUN,
    recentQuestions: recentTexts,
    recentRefs: corpus.rows.filter(r => recentIds.has(r.id)).map(r => r.ref),
    resonance: echo.resonance,
    corrections: echo.corrections,
  })
  trace.push(`draft prompt: ${prompt.length} chars`)

  const draftBudget = deadline - Date.now() - MIN_JUDGE_MS - TAIL_MS
  if (draftBudget < 1_000) {
    trace.push(`!! out of time before the draft (${deadline - Date.now()}ms left)`)
    return []
  }
  const drafted = await draft(prompt, draftBudget, trace)

  // Drop a question written twice in one response.
  const seenQuestions = new Set<string>()
  const pool = drafted.filter(c => {
    const key = c.question.toLowerCase().replace(/\W+/g, ' ').trim()
    if (seenQuestions.has(key)) return false
    seenQuestions.add(key)
    return true
  })

  const grounded: Grounded[] = []
  for (const c of pool) {
    const check = checkCandidate(c, corpus, creative)
    if (!check.ok) {
      trace.push(`dropped: ${check.reason} -- "${c.question.slice(0, 90)}"`)
      continue
    }
    const g = check.grounded
    if (g.rows.some(r => recentIds.has(r.id))) {
      trace.push(`dropped: built on a row a recent question used -- ${label(g)}`)
      continue
    }
    if (echoesRecent(g.question, recentTexts)) {
      trace.push(`dropped: echoes a recent question -- ${label(g)}`)
      continue
    }
    grounded.push(g)
  }
  if (grounded.length === 0) {
    trace.push('nothing survived the honesty gates')
    return []
  }

  const judgeBudget = deadline - Date.now() - TAIL_MS
  const scores = judgeBudget >= MIN_JUDGE_MS
    ? await judge(grounded, creative, judgeBudget, trace)
    : (trace.push(`judge skipped: ${judgeBudget}ms left`), null)
  let ranked: Grounded[]
  if (scores) {
    grounded.forEach((g, i) => {
      const s = scores.get(i + 1)
      trace.push(s
        ? `judge ${s.verdict.toUpperCase()} r${s.revelation} t${s.truth} s${s.specific} a${s.answerable}: ${s.reason} -- ${label(g)}`
        : `judge: no score -- ${label(g)}`)
    })
    ranked = grounded
      .map((g, i) => ({ g, s: scores.get(i + 1) }))
      .filter((x): x is { g: Grounded; s: JudgeScore } => !!x.s && judgeShips(x.s, creative))
      .sort((a, b) => judgeRank(b.s) - judgeRank(a.s))
      .map(x => x.g)
  } else {
    // No judge, no taste check -- so only the drafter's own first choice,
    // never a queue of unjudged ones banked for days.
    trace.push('judge unavailable -- shipping the first honest candidate only')
    ranked = grounded.slice(0, 1)
  }

  const baked: BakedSpark[] = []
  const usedRows = new Set<string>()
  for (const g of ranked) {
    if (baked.length >= QUESTIONS_PER_RUN) break
    if (g.rows.some(r => usedRows.has(r.id))) continue
    g.rows.forEach(r => usedRows.add(r.id))
    baked.push({
      type: 'mull',
      text: g.question,
      project_id: projectFor(g, corpus),
      // Each banked one lives a shelf-life longer than the one in front of
      // it, so the queue order is carried by expiry and nothing expires
      // unseen while it waits.
      expires_at: expiresAt(SHELF_LIFE_HOURS * (baked.length + 1)),
      stake: g.stake || undefined,
      subject_id: g.rows[0].id,
      subject_kind: g.rows[0].kind,
      banked: baked.length > 0,
    })
  }
  if (baked.length === 0) trace.push('the judge shipped nothing')
  return baked
}

export async function bakeMull(
  supabase: SupabaseClient,
  userId: string,
  echo?: EchoContext,
  trace: MullTrace = [],
  creative = false,
): Promise<BakedSpark[]> {
  const mulls = await generateMull(supabase, userId, echo ?? loadEchoContext(supabase, userId), trace, creative)
  if (mulls.length === 0) trace.push('nothing worth asking -- empty slot')
  return mulls
}
