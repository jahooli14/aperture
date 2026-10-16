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

import { readThemes } from './project-themes.js'
import { readSeason, leadsWithFun, tellsToStartNow, type Season, type SeasonProject } from './season.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { parseModelJson } from './schemas.js'
import { echoesRecent, fetchRecentSparkTexts, fetchRecentSparkProjectIds, fetchRecentSparkSubjectIds } from './spark-echo.js'
import { SPARK_CORRECTION_TAG, isAppAuthored } from './corpus-provenance.js'
import { loadCorpus, normaliseTitle, type Corpus, type CorpusRow } from './mull-corpus.js'
import { checkCandidate, crossingDepth, CROSSING_BONUS, TRIFECTA_BONUS, slotOf, orderBySlots, type Slot, judgePercent, judgeRank, parseJudgeScores, type Candidate, type Grounded, type JudgeScore } from './mull.js'
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
/** With this much time left and nobody waiting, write two drafts at once, a
 *  different lens each. The model writes about 80 tokens a second, so one
 *  draft of six takes would take longer than the whole budget; two drafts of
 *  three take as long as one. */
const PARALLEL_DRAFT_MIN_MS = 18_000

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
/** "Ask me something else" with an empty bank. Pressing it has to produce
 *  something, so it gets room to: the model measured at 12-13s end to end,
 *  and the button shows "thinking…" while it works. */
export const LIVE_BUDGET_MS = 25_000
/** The nightly bake and the cron retire-and-rebake have nobody waiting on
 *  them, so they get room to finish: the draft is the slow part and a bigger
 *  corpus plus a season made it miss ten seconds. The reroll button keeps
 *  the ten-second ceiling. Vercel's limit for the route is 90s. */
export const NIGHTLY_BUDGET_MS = 30_000
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
  /** Every row the question was built on, by plain title -- what was put
   *  next to what. Shown under the question. */
  sources?: { kind: string; title: string }[]
  /** The judge's backing, 0-100 (mean of its four scores). Absent when unjudged. */
  score?: number
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
  /** Where they are now; see loadFocus. */
  focus?: string
  /** The project they're working on, for the crossing (mull.ts). */
  live?: { id: string; title: string } | null
  /** What matters this stretch (season.ts): the main project, the others, the date. */
  season?: Season | null
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
  const [{ data: answered }, { data: ignored }, { data: tapped, error: tapErr }] = await Promise.all([
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
      // A bare yes / no / sort of leaves no memory but is an answer, not a miss.
      .is('answered_at', null)
      .lt('expires_at', new Date().toISOString())
      .order('shown_at', { ascending: false })
      .limit(6),
    // A bare tap on a take: yes, no or sort of, with nothing said. The
    // cheapest answer there is, and the most common -- a "no" is a take
    // that was wrong about them, which the next draft should know.
    // `stance` arrives with 20261004_spark_stance.sql; before that this
    // query fails and is simply left out.
    supabase
      .from('sparks')
      .select('text, stance')
      .eq('user_id', userId)
      .not('answered_at', 'is', null)
      .is('response_memory_id', null)
      .order('answered_at', { ascending: false })
      .limit(8),
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
      return reply ? `  Shown: "${s.text}"\n  They said back: "${reply.slice(0, 400)}"` : null
    })
    .filter(Boolean)

  const missed = (ignored ?? []).map((s: any) => `  - "${s.text}"`)
  const taps = tapErr ? [] : tapLines(tapped ?? [])
  if (landed.length === 0 && missed.length === 0 && taps.length === 0) return ''

  return `
${landed.length > 0 ? `THESE ONES WORKED — they stopped and answered out loud:\n${landed.join('\n\n')}\n` : ''}${missed.length > 0 ? `\nTHESE ONES DIDN'T — read, and left to expire without a word:\n${missed.join('\n')}\n` : ''}${taps.length > 0 ? `\nTHEY TAPPED AN ANSWER, NO WORDS. "no" means the claim was wrong about them -- don't make it again in new words:\n${taps.join('\n')}\n` : ''}
Whatever made the first group worth answering is what matters. Not their
subject or their wording -- what they put in front of the person, and how sharp
the claim was.
`
}

const STANCE_WORDS: Record<string, string> = { yes: 'yes', no: 'no', sort_of: 'sort of' }

/** One line per tapped take: what they tapped, then the take. A row with
 *  no stance (an old question, or one answered before the column) says
 *  nothing about agreement and is left out. */
export function tapLines(rows: { text?: unknown; stance?: unknown }[]): string[] {
  return rows
    .filter(s => typeof s.text === 'string' && typeof s.stance === 'string' && STANCE_WORDS[s.stance])
    .map(s => `  - ${STANCE_WORDS[s.stance as string]}: "${s.text}"`)
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

/**
 * What they're on right now: the live project and its next move, plus the
 * last few things they captured. The draft leans toward these so the
 * question meets them where they are, instead of landing anywhere in the
 * corpus. Context only -- never quotable, evidence still comes from rows.
 */
export async function loadFocus(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    return await readFocus(supabase, userId)
  } catch (e) {
    // A garnish: never costs the run.
    console.warn('[mull] could not read focus:', e instanceof Error ? e.message : String(e))
    return ''
  }
}

async function readFocus(supabase: SupabaseClient, userId: string): Promise<string> {
  const [{ data: proj, error: projErr }, { data: notes, error: notesErr }] = await Promise.all([
    supabase.from('projects').select('title, metadata')
      .eq('user_id', userId).eq('status', 'active')
      .or('state.eq.live,is_priority.eq.true')
      .order('last_active', { ascending: false }).limit(1),
    supabase.from('memories').select('title, tags')
      .eq('user_id', userId).eq('processed', true)
      .order('created_at', { ascending: false }).limit(15),
  ])
  if (projErr) console.warn('[mull] focus: projects query failed:', projErr.message)
  if (notesErr) console.warn('[mull] focus: memories query failed:', notesErr.message)
  const p = (proj ?? [])[0] as { title?: string; metadata?: { next_move?: { text?: string } } } | undefined
  const move = p?.metadata?.next_move?.text
  // What the live project is steering by (project-themes.ts): weeks-long,
  // in their own words, so a question can point at where the work is
  // actually heading rather than at one step of it.
  const themes = readThemes(p?.metadata).map(t => t.text)
  // Notes the app elicited (spark answers, corrections) aren't fresh
  // capture -- same rule as the corpus. Filtered in JS: `tags` is nullable.
  const recent = (notes ?? [])
    .filter((n: any) => !isAppAuthored(n.tags))
    .map((n: any) => n.title)
    .filter((t: unknown): t is string => typeof t === 'string' && !!t)
    .slice(0, 5)
  if (!p?.title && recent.length === 0) return ''
  return `
WHERE THEY ARE RIGHT NOW (context -- never quote it, evidence still comes from rows):
${p?.title ? `- Live project: "${p.title}"${move ? `. Next move: ${move}` : ''}\n` : ''}${p?.title && themes.length ? `- What it's steering by (their words): ${themes.map(t => `"${t}"`).join('; ')}\n` : ''}${recent.length ? `- Just captured: ${recent.map(t => `"${t}"`).join('; ')}\n` : ''}Use these as one half of a collision, not as a filter. The best question puts
something from here next to something that looks unrelated -- a person or
occasion in their life beside a material, skill or old project. Don't stay inside
the live project; reach out from it.
`
}

/** What matters this stretch (season.ts). The main project is the live
 *  one, the same pick as the home card. Null is fine: no aim is asked for. */
export async function loadSeason(supabase: SupabaseClient, userId: string): Promise<Season | null> {
  try {
    const { data, error } = await supabase.from('projects')
      .select('id, title, state, status, is_priority, metadata')
      .eq('user_id', userId)
      // Not just the newest: declare-live doesn't touch last_active, so a
      // live but idle project could fall off a short list.
      .order('created_at', { ascending: false }).limit(500)
    if (error) {
      console.warn('[mull] could not read the season:', error.message)
      return null
    }
    const season = readSeason((data ?? []) as SeasonProject[])
    return season.main ? season : null
  } catch (e) {
    // A garnish: never costs the run.
    console.warn('[mull] could not read the season:', e instanceof Error ? e.message : String(e))
    return null
  }
}

export async function loadEchoContext(
  supabase: SupabaseClient, userId: string,
): Promise<EchoContext> {
  const [recentTexts, recentProjectIds, recentSubjectIds, resonance, corrections, focus, season] = await Promise.all([
    fetchRecentSparkTexts(supabase, userId),
    fetchRecentSparkProjectIds(supabase, userId),
    fetchRecentSparkSubjectIds(supabase, userId),
    loadResonance(supabase, userId),
    loadCorrections(supabase, userId),
    loadFocus(supabase, userId),
    loadSeason(supabase, userId),
  ])
  return { recentTexts, recentProjectIds, recentSubjectIds, resonance, corrections, focus, live: season?.main ?? null, season }
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
    // `take` is the key the prompt asks for; `question` is still read, so a
    // model that falls back to the old shape loses nothing.
    question: str(c?.take) || str(c?.question),
    noticing: str(c?.noticing),
    doubt: str(c?.doubt) || undefined,
    stake: str(c?.stake),
    project: str(c?.project) || null,
    evidence: Array.isArray(c?.evidence)
      ? c.evidence.map((e: any) => ({ ref: str(e?.ref), quote: str(e?.quote) })).filter((e: { quote: string }) => e.quote)
      : [],
  })).filter(c => c.question)
}

type Usage = { input: number; output: number; thinking: number; model?: string; total?: number } | null

const tokens = (u: Usage) =>
  u ? ` (tokens: ${u.input} in, ${u.thinking} thinking, ${u.output} out${u.model ? `, model ${u.model}` : ''}${u.total != null ? `, API total ${u.total}, unaccounted ${u.total - u.input - u.output - u.thinking}` : ''})` : ''

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

async function judge(grounded: Grounded[], timeoutMs: number, trace: MullTrace, liveTitle?: string | null): Promise<Map<number, JudgeScore> | null> {
  const start = Date.now()
  let usage: Usage = null
  try {
    const raw = await generateText(judgePrompt(grounded, liveTitle), {
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

/** Titles of the distinct captures behind a question, for display. */
export function sourcesOf(rows: CorpusRow[]): { kind: string; title: string }[] {
  const seen = new Set<string>()
  const out: { kind: string; title: string }[] = []
  for (const r of rows) {
    const title = (r.title || r.text).replace(/\s+/g, ' ').trim().slice(0, 60)
    if (!title || seen.has(r.captureId)) continue
    seen.add(r.captureId)
    out.push({ kind: r.kind, title })
  }
  return out.slice(0, 4)
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
  /** The last pass of a press that found nothing: one draft that stays away
   *  from the live project and goes for the furthest-apart pair it can find.
   *  Honesty gates unchanged. */
  reach = false,
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

  const parallel = !reach && deadline - Date.now() >= PARALLEL_DRAFT_MIN_MS
  const promptFor = (lens?: 'live' | 'elsewhere') => draftPrompt({
    corpusText: corpus.text,
    // Never more, season or not: every extra candidate is output the model
    // has to write inside the ten-second ceiling. Six of them timed the
    // draft out live (6.8s allowed, aborted) and nothing shipped at all.
    howMany: parallel ? 3 : CANDIDATES_PER_RUN,
    lens,
    recentQuestions: recentTexts,
    recentRefs: corpus.rows.filter(r => recentIds.has(r.id)).map(r => r.ref),
    resonance: echo.resonance,
    corrections: echo.corrections,
    focus: echo.focus ?? '',
    liveTitle: echo.season?.main?.title ?? echo.live?.title ?? null,
    alsoTitles: echo.season?.active ? echo.season.also.map(p => p.title) : [],
    waitingTitles: echo.season?.active ? echo.season.also.filter(p => p.blocked).map(p => p.title) : [],
    seasonActive: !!echo.season?.active,
  })
  const prompt = promptFor(reach ? 'elsewhere' : parallel && echo.live ? 'live' : undefined)
  trace.push(`draft prompt: ${prompt.length} chars`)

  const draftBudget = deadline - Date.now() - MIN_JUDGE_MS - TAIL_MS
  if (draftBudget < 1_000) {
    trace.push(`!! out of time before the draft (${deadline - Date.now()}ms left)`)
    return []
  }
  const drafted = parallel
    ? (await Promise.all([
        draft(prompt, draftBudget, trace),
        draft(promptFor('elsewhere'), draftBudget, trace),
      ])).flat()
    : await draft(prompt, draftBudget, trace)
  if (parallel) trace.push(`two drafts in parallel: ${drafted.length} candidates between them`)

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
    ? await judge(grounded, judgeBudget, trace, echo.live?.title ?? null)
    : (trace.push(`judge skipped: ${judgeBudget}ms left`), null)
  // The Venn: a take that crosses the live project outranks one that stays
  // inside it (mull.ts, CROSSING_BONUS). Judged by the rows it cites, and
  // by the judge's own read as a second opinion.
  const mainId = echo.season?.main?.id ?? echo.live?.id ?? null
  const liveId = mainId
  // Season-shaped behaviour (the order, the others, the wild one) only when
  // a season has actually been set. A live project alone is just that.
  const seasonOn = !!echo.season?.active
  const alsoIds = seasonOn ? echo.season!.also.map(p => p.id) : []
  const slotFor = (g: Grounded) => slotOf(
    g.rows, mainId, alsoIds, g.project ? corpus.projectIdByTitle.get(normaliseTitle(g.project)) ?? null : null,
  )
  const depths = new Map<Grounded, 0 | 1 | 2>()
  const ranks = new Map<Grounded, number>()
  const percents = new Map<Grounded, number>()
  // The judge's own read ("crosses") can lift a 0 to a 1 -- and only for a
  // take about the main project, never past it. Only the cited rows can
  // prove the trifecta.
  const depthOf = (g: Grounded, s?: JudgeScore): 0 | 1 | 2 => {
    const d = crossingDepth(g.rows, corpus, liveId)
    return d === 0 && liveId && s?.crosses === true && slotFor(g).slot === 'main' ? 1 : d
  }
  const bonus = (d: 0 | 1 | 2) => (d >= 1 ? CROSSING_BONUS : 0) + (d === 2 ? TRIFECTA_BONUS : 0)
  const mark = (d: 0 | 1 | 2) => (d === 2 ? ' TRIFECTA' : d === 1 ? ' CROSSES' : '')
  let ranked: Grounded[]
  if (scores) {
    grounded.forEach((g, i) => {
      const s = scores.get(i + 1)
      trace.push(s
        ? `judge ${s.verdict.toUpperCase()} r${s.revelation} t${s.truth} s${s.specific} a${s.answerable}${s.overreach ? ' OVERREACH' : ''}${mark(depthOf(g, s))}: ${s.reason} -- ${label(g)}`
        : `judge: no score -- ${label(g)}`)
    })
    ranked = grounded
      .map((g, i) => ({ g, s: scores.get(i + 1) }))
      .filter((x): x is { g: Grounded; s: JudgeScore } => !!x.s)
      .map(x => {
        const d = depthOf(x.g, x.s)
        depths.set(x.g, d)
        const rank = judgeRank(x.s) + bonus(d)
        ranks.set(x.g, rank)
        percents.set(x.g, judgePercent(x.s))
        return { ...x, rank }
      })
      .sort((a, b) => b.rank - a.rank)
      .map(x => x.g)
  } else {
    // No judge, no taste check -- so only the drafter's own first choice,
    // never a queue of unjudged ones banked for days. The deepest crossing
    // goes first.
    trace.push('judge unavailable -- shipping the first honest candidate only')
    const best = [...grounded].sort((a, b) => depthOf(b) - depthOf(a))[0]
    depths.set(best, depthOf(best))
    ranked = [best]
  }

  // Shipped questions never share a row. Settled in rank order, BEFORE the
  // season reorders anything, so a wild take that shares a row with a
  // better one can't bury it.
  // A project that can't be started yet gets thinking, never "go and make it".
  const blockedIds = new Set(seasonOn ? echo.season!.also.filter(p => p.blocked).map(p => p.id) : [])
  if (blockedIds.size > 0) {
    ranked = ranked.filter(g => {
      const sl = slotFor(g)
      if (sl.slot !== 'also' || !sl.projectId || !blockedIds.has(sl.projectId)) return true
      const bad = tellsToStartNow(g.stake, g.question)
      if (bad) trace.push(`dropped, tells you to start something that is still waiting -- ${label(g)}`)
      return !bad
    })
  }
  const used = new Set<string>()
  ranked = ranked.filter(g => {
    if (g.rows.some(r => used.has(r.id))) return false
    g.rows.forEach(r => used.add(r.id))
    return true
  })

  // The season decides the order, but never over quality (mull.ts,
  // orderBySlots): main, then the others, then the wild one; the wild one
  // first about one run in three.
  const slots = new Map<Grounded, { slot: Slot; projectId: string | null }>()
  if (seasonOn) {
    for (const g of ranked) slots.set(g, slotFor(g))
    ranked = orderBySlots(ranked, g => slots.get(g)!.slot, leadsWithFun(new Date(Date.now())), g => ranks.get(g) ?? 0)
    trace.push(`season: ${ranked.map(g => slots.get(g)!.slot).join(' > ') || 'nothing shipped'}`)
  } else if (!echo.season) {
    trace.push('season: no live project found, so nothing is aimed at')
  }
  if (liveId) {
    const n = (d: number) => ranked.filter(g => (depths.get(g) ?? 0) >= d).length
    trace.push(`crossing: ${n(1)} of ${ranked.length} shipped candidates cross "${echo.season?.main?.title ?? echo.live?.title}" (${n(2)} with a note and a list item)`)
  }

  // Four slots (main, two others, wild) need four takes; otherwise three.
  const perRun = parallel || (seasonOn && alsoIds.length > 1) ? QUESTIONS_PER_RUN + 1 : QUESTIONS_PER_RUN
  const baked: BakedSpark[] = []
  for (const g of ranked) {
    if (baked.length >= perRun) break
    baked.push({
      type: 'mull',
      text: g.question,
      // A crossing is about the live project, whatever else it leans on.
      project_id: slots.get(g)?.slot === 'also'
        ? slots.get(g)!.projectId
        : (depths.get(g) ?? 0) > 0 && liveId ? liveId : projectFor(g, corpus),
      // Each banked one lives a shelf-life longer than the one in front of
      // it, so the queue order is carried by expiry and nothing expires
      // unseen while it waits.
      expires_at: expiresAt(SHELF_LIFE_HOURS * (baked.length + 1)),
      stake: g.stake || undefined,
      subject_id: g.rows[0].id,
      subject_kind: g.rows[0].kind,
      sources: sourcesOf(g.rows),
      score: percents.get(g),
      banked: baked.length > 0,
    })
  }
  if (baked.length === 0) trace.push('the judge shipped nothing')
  return baked
}

/**
 * Where the time goes, measured on its own (bake-explain only): a one-word
 * answer to a tiny prompt (the fixed cost of a call), a one-word answer to
 * your real notes (reading them), and a long answer to a tiny prompt (how
 * fast it writes). The draft is some mix of the three.
 */
export async function probeLatency(supabase: SupabaseClient, userId: string, trace: MullTrace): Promise<void> {
  const run = async (label: string, prompt: string, maxTokens: number) => {
    const start = Date.now()
    let usage: Usage = null
    try {
      await generateText(prompt, { model: MODEL, maxTokens, thinkingLevel: 'low', timeoutMs: 30_000, onUsage: u => { usage = u } })
      const ms = Date.now() - start
      const rate = usage && (usage as NonNullable<Usage>).output > 50 ? `, ${Math.round((usage as NonNullable<Usage>).output / (ms / 1000))} tokens/s overall` : ''
      trace.push(`probe ${label}: ${ms}ms${tokens(usage)}${rate}`)
    } catch (e) {
      trace.push(`probe ${label} FAILED after ${Date.now() - start}ms: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  await run('tiny prompt, one word out', 'Reply with the single word OK.', 8)
  const corpus = await loadCorpus(supabase, userId, [])
  await run(`your notes (${corpus.text.length} chars) in, one word out`, `${corpus.text}\n\nReply with the single word OK.`, 8)
  await run('tiny prompt, ~600 tokens out', 'Write about 450 words on why a small wooden toy takes longer to finish than it looks. Plain prose.', 2048)
  await run('your notes in, one word out (again)', `${corpus.text}\n\nReply with the single word OK.`, 8)

  // Is the ~1.5s floor the model, the SDK, or the network? Same tiny prompt
  // three more ways: straight over HTTP, the Lite model, and streamed.
  const key = process.env.GEMINI_API_KEY
  trace.push(`probe region: ${process.env.VERCEL_REGION ?? 'unknown'}`)
  const raw = async (label: string, model: string, stream: boolean) => {
    const start = Date.now()
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${key}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }], generationConfig: { maxOutputTokens: 8 } }),
        signal: AbortSignal.timeout(30_000),
      })
      const headersMs = Date.now() - start
      await r.text()
      trace.push(`probe ${label}: ${Date.now() - start}ms (status ${r.status}, headers after ${headersMs}ms)`)
    } catch (e) {
      trace.push(`probe ${label} FAILED after ${Date.now() - start}ms: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  if (key) {
    await raw('raw HTTP, flash, tiny', MODEL, false)
    await raw('raw HTTP, flash, tiny (again)', MODEL, false)
    await raw('raw HTTP, flash-lite, tiny', 'gemini-flash-lite-latest', false)
    await raw('raw HTTP, flash, streamed', MODEL, true)
  }
}

export async function bakeMull(
  supabase: SupabaseClient,
  userId: string,
  echo?: EchoContext,
  trace: MullTrace = [],
  creative = false,
  /** Whole-run budget. Defaults to the reroll's ten seconds. */
  budgetMs = TOTAL_BUDGET_MS,
  reach = false,
): Promise<BakedSpark[]> {
  const mulls = await generateMull(
    supabase, userId, echo ?? loadEchoContext(supabase, userId), trace, creative, Date.now() + budgetMs, reach,
  )
  if (mulls.length === 0) trace.push('nothing worth asking -- empty slot')
  return mulls
}
