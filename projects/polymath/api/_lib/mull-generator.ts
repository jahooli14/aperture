/**
 * The mull channel: one thing to carry around, built from the whole corpus
 * at once.
 *
 * This used to compute a subject, name what it never examined, strip that
 * of its own vocabulary, and search the corpus for a connector in band —
 * three separate model-adjacent steps built to stop the model inventing a
 * link between two things. Measured against the real corpus and the real
 * gates (rejectionReason, in mull.ts), that turned out not to be what kept
 * it honest. The GATES did. A single call handed the whole corpus passed
 * the same grounding checks just as cleanly, covered ten different subjects
 * across ten sequential pulls with zero repeats once told plainly what had
 * already been asked, and never went silent. So the search is gone; the
 * gates are exactly as strict as they were.
 *
 * One call, up to two questions. The second is banked, unexpired, behind
 * the first — it becomes the next standing question and the instant
 * answer to "ask me something else", with no further calls at all.
 *
 * The one thing the old design got right that this has to replicate by
 * hand: a QUOTE alone doesn't say where it came from. The model reports
 * one; this resolves it back to a real row in the corpus (mull-corpus.ts's
 * findSource) and then gates the drafted QUESTION against that row's FULL
 * text — not the short quote the model handed back. A live test caught the
 * gap this closes: a real quote ("restrain from being overly clever") with
 * an invented "Penrose stairs" dressed around it in the question, which a
 * quote-only check would have missed entirely.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { avoidBlock, echoesRecent, fetchRecentSparkTexts, fetchRecentSparkProjectIds, fetchRecentSparkSubjectIds, motifWords } from './spark-echo.js'
import { SPARK_CORRECTION_TAG } from './corpus-provenance.js'
import { examplesBlock } from './mull-examples.js'
import { loadCorpus, findSource, normaliseTitle, type Corpus, type CorpusRow } from './mull-corpus.js'
import { rejectionReason, draftQuality, longestSharedRun } from './mull.js'

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

/** One to show, one banked behind it. */
const QUESTIONS_PER_RUN = 2

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
  /** What the user would DO differently depending on the answer — the
   *  gates' own evidence, stored so a leak is diagnosable afterwards. */
  stake?: string
  /** The corpus row this was drafted from — a real project/memory/fragment/
   *  list_item/article id, and its kind. Used to demote the same source
   *  next time (fetchRecentSparkSubjectIds), the same schema the old
   *  computed-subject design used, now naming a literal row instead. */
  subject_id?: string
  subject_kind?: string
  /** Written now, shown later. Held behind the standing question rather
   *  than replacing it — the channel's cheapest question is the one that
   *  was already paid for days ago. */
  banked?: boolean
}

/**
 * Why a run produced nothing.
 *
 * Every query and every drop reports itself here rather than reading a
 * rejected query as an empty corpus — the exact bug (`memories.project_id`
 * did not exist, `sparks.type` missing `'mull'`) that has cost this channel
 * a day at least three times. `bake?explain=1` returns this without writing
 * anything or spending a model call it did not already need.
 */
export type MullTrace = string[]

export interface EchoContext {
  recentTexts: string[]
  /** Projects a recent question was already about, by id. */
  recentProjectIds?: Set<string>
  /** Same idea, generalised to any row kind. */
  recentSubjectIds?: Set<string>
  avoid: string
  /** Questions this person actually answered, and what they said back —
   *  plus the ones they read and ignored. See loadResonance. */
  resonance: string
  /** Premises earlier questions got wrong, now on record. See
   *  loadCorrections. Plain context, not corpus — never something to quote
   *  from or draft a new question around. */
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
Whatever is different between those two groups is what matters here. Match the
first group. Not their subject — their shape, their nerve, how much they left
for the reader to do.
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
  return { recentTexts, recentProjectIds, recentSubjectIds, avoid: avoidBlock(recentTexts), resonance, corrections }
}

function expiresAt(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

interface Drafted {
  row: CorpusRow
  text: string
  quote: string
  stake: string
  project: string | null
}

/** The model mis-reports what it quoted far more often than it invents
 *  (same lesson mull.ts's rejectionReason is built on) — so a quote that
 *  doesn't resolve verbatim isn't given up on before checking whether the
 *  QUESTION ITSELF still carries a real run of some row's own words. */
function resolveSource(corpus: Corpus, quote: string, text: string): CorpusRow | null {
  return findSource(corpus, quote) ?? corpus.rows.find(r => longestSharedRun(text, r.text) !== null) ?? null
}

/**
 * One call, up to two questions, drawn from the whole corpus at once.
 */
async function draftFromCorpus(
  corpus: Corpus, echo: EchoContext, howMany: 1 | 2, trace: MullTrace,
): Promise<Drafted[]> {
  const prompt = `Here is everything one person has captured in a personal creative app -- their
projects, notes, things they said in passing, list items, articles they
vouched for.

${corpus.text}
${echo.avoid}
Your job: find ${howMany === 1 ? 'something' : 'up to two things'} in here worth asking them about. Not a summary,
not encouragement -- a question that makes them think, that they carry
around for a few days before the answer arrives on a walk.

What makes a good one:
- It quotes their own words back at them -- a real phrase, copied exactly,
  not paraphrased, and that phrase has to appear in the QUESTION ITSELF,
  not only in the sentence that sets it up.
- It has a real stake: something changes depending on how they answer.
  "They'd understand themselves better" is not a stake. "They cut chapters
  nine to twelve" is a stake.
- It is answerable -- not a riddle, not a quiz. They should feel like they
  already have the answer and can't quite reach it.
- It does not explain itself. State the setup in one plain sentence, then
  ask. Never write "which shows," "this reveals," or "both are about."
- Start the question with What, How, or Which ONE. Never Does, Is, Are,
  Will, Should, or Can -- that shape narrows to a yes/no pick between two
  things you invented, answerable in five seconds and forgotten.
- Name the project it's about, if it's clearly about one -- the EXACT
  title as written above. If it isn't really about a specific project,
  say null. Don't guess a project just to fill the field.
- If nothing here holds a real question right now, say so -- return
  "spark": null rather than manufacturing one. An honest "nothing" is
  correct and better than a forced question.
${howMany === 2 ? '- The two questions must be about genuinely different subjects, not two angles on the same one.\n' : ''}${echo.resonance}${echo.corrections}
GOOD -- ten of them, and they are not ten versions of one question. Some end
in a choice, some in a name, some in a counterfactual, some ask for a fact
you have and the notes don't. Copy the register, never the skeleton:
${examplesBlock()}
${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "questions": [ { "quote": "exact words copied character-for-character from the corpus above", "spark": "setup. question?" | null, "stake": "what changes", "project": "exact project title from above" | null }, ${howMany === 2 ? '... up to 2 entries' : 'one entry'} ] }

The quote is checked against the corpus. If the words you hand back are not
in it, the question is thrown away unread however good it is -- so copy
them, and make sure some of them survive into the question itself.`

  try {
    // Timed because "the reroll timed out" has no other way to say which
    // part was slow — bake-explain prints this line.
    const draftStart = Date.now()
    // Capped at medium: at the default depth a reroll could think past the
    // app's timeout. The owner's call, and the one creative call that is
    // capped -- if questions get worse, raise it here first.
    const raw = await generateText(prompt, { responseFormat: 'json', model: 'gemini-flash-latest', maxTokens: 8192, thinkingLevel: 'medium' })
    trace.push(`draft call: ${Date.now() - draftStart}ms, prompt ${prompt.length} chars`)
    const parsed = JSON.parse(raw)
    const rows = Array.isArray(parsed?.questions) ? parsed.questions : []
    const out: Drafted[] = []
    let declined = 0
    let ungrounded = 0
    for (const q of rows) {
      const text = typeof q?.spark === 'string' ? q.spark.trim() : ''
      const quote = typeof q?.quote === 'string' ? q.quote.trim() : ''
      const stake = typeof q?.stake === 'string' ? q.stake.trim() : ''
      const project = typeof q?.project === 'string' ? q.project.trim() : null
      if (!text) { declined++; continue }
      const source = resolveSource(corpus, quote, text)
      if (!source) { ungrounded++; continue }
      out.push({ row: source, text, quote, stake, project })
    }
    trace.push(
      `draft call: ${rows.length} questions came back` +
      `${Array.isArray(parsed?.questions) ? '' : ' (no `questions` array in the response)'}` +
      `${declined ? `, ${declined} declined by the model` : ''}` +
      `${ungrounded ? `, ${ungrounded} whose quote matched nothing in the corpus` : ''}`,
    )
    return out
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    trace.push(`!! draft call FAILED: ${message}`)
    console.warn('[mull] draft failed:', message)
    return []
  }
}

// ─── The channel ──────────────────────────────────────────────────────

export async function generateMull(
  supabase: SupabaseClient,
  userId: string,
  echo: EchoContext,
  trace: MullTrace = [],
  /** "Get more creative" — reroll's fallback tier once the regular pass has
   *  come back empty. Drops the avoid-list (there's nothing left but
   *  recently-covered ground once this tier is reached) and relaxes
   *  rejectionReason's taste gates. Grounding never relaxes — a quote still
   *  has to resolve to a real row regardless of tier. */
  creative = false,
): Promise<BakedSpark[]> {
  const corpusStart = Date.now()
  const corpus = await loadCorpus(supabase, userId, trace)
  const corpusMs = Date.now() - corpusStart
  if (corpus.rows.length === 0) {
    trace.push('corpus: nothing to draw from — no project, note, fragment, list item or article qualified')
    return []
  }
  trace.push(`corpus: ${corpus.rows.length} rows, ${corpus.text.length} chars, loaded in ${corpusMs}ms`)

  // `avoidBlock` only ever caught a repeated TEXT or a close paraphrase —
  // the exact same source material asked about with fresh wording slipped
  // past it, which is the original bug `fetchRecentSparkSubjectIds` was
  // built to fix (a subject could ship, get dismissed, and rank exactly as
  // high the next run because nothing recorded that it had been used).
  // `subject_id` is now a literal row id, so it can be checked directly
  // against the rows still in this corpus and named by title, rather than
  // relying on the question text alone to carry the signal.
  const recentSubjectTitles = !creative
    ? corpus.rows.filter(r =>
        echo.recentSubjectIds?.has(r.id) || (r.kind === 'project' && echo.recentProjectIds?.has(r.id)),
      ).map(r => r.title || r.kind)
    : []
  const subjectAvoid = recentSubjectTitles.length > 0
    ? `\nAlso already covered, whatever the wording — do not draw a question from any of these again: ${[...new Set(recentSubjectTitles)].join(', ')}.\n`
    : ''

  const runEcho: EchoContext = creative ? { ...echo, avoid: '' } : { ...echo, avoid: echo.avoid + subjectAvoid }
  const drafts = await draftFromCorpus(corpus, runEcho, QUESTIONS_PER_RUN, trace)

  const baked: BakedSpark[] = []
  const seen = [...echo.recentTexts]
  const shippedRows = new Set<string>()

  // Gates first, then rank what survived — draftQuality is the difference
  // between a question that used its source and one that could have been
  // asked with no corpus at all, and it's measured after grounding, not
  // instead of it.
  const survivors: Drafted[] = []
  for (const draft of drafts) {
    const reason = rejectionReason({
      text: draft.text,
      quote: draft.quote,
      stake: draft.stake,
      // The FULL source row, not the short quote — a real quote with
      // invented dressing around it passes a quote-only check and fails
      // this one. subjectText just has to be truthy to switch the
      // unsupportedSpecifics check on; there's no separate "subject" here
      // the way there was a computed one before, so the row's own title
      // is enough.
      connectorText: draft.row.text,
      subjectText: draft.row.title || draft.row.kind,
      loose: creative,
    })
    if (reason) {
      trace.push(`dropped: ${reason}`)
      console.log(`[mull] dropped: ${reason}`)
      continue
    }
    survivors.push(draft)
  }
  survivors.sort((a, b) => draftQuality(b.text, b.row.text) - draftQuality(a.text, a.row.text))
  if (survivors.length > 1) {
    trace.push(`ranked ${survivors.length} that cleared the gates: ` +
      survivors.map(d => draftQuality(d.text, d.row.text).toFixed(2)).join(', '))
  }

  // A zero means the note never reached the question. A lone zero still
  // ships — the slot is otherwise empty — but not when something better
  // exists to spend the slot on instead.
  const best = survivors.length > 0 ? draftQuality(survivors[0].text, survivors[0].row.text) : 0
  const worthShipping = best > 0 ? survivors.filter(d => draftQuality(d.text, d.row.text) > 0) : survivors

  for (const draft of worthShipping) {
    if (shippedRows.has(draft.row.id)) continue
    if (echoesRecent(draft.text, seen)) {
      const shared = motifWords(draft.text).filter(w => seen.some(prev => motifWords(prev).includes(w)))
      trace.push(`dropped: echoes a recent question (shared: ${shared.slice(0, 6).join(', ') || 'a repeated motif'})`)
      continue
    }
    seen.push(draft.text)
    shippedRows.add(draft.row.id)

    // The model names the project itself (or says null); matched against
    // the real corpus's titles rather than trusted outright, so a
    // near-miss or a hallucinated title never reaches a foreign-key column.
    const projectId = draft.project
      ? corpus.projectIdByTitle.get(normaliseTitle(draft.project)) ?? null
      : null

    if (baked.length >= QUESTIONS_PER_RUN) break
    baked.push({
      type: 'mull',
      text: draft.text,
      project_id: projectId,
      expires_at: expiresAt(SHELF_LIFE_HOURS),
      stake: draft.stake,
      subject_id: draft.row.id,
      subject_kind: draft.row.kind,
      banked: baked.length > 0,
    })
  }

  if (baked.length > 1) {
    baked[1].expires_at = expiresAt(SHELF_LIFE_HOURS * 2)
  }

  return baked
}

export async function bakeMull(
  supabase: SupabaseClient,
  userId: string,
  echo?: EchoContext,
  trace: MullTrace = [],
  creative = false,
): Promise<BakedSpark[]> {
  const echoStart = Date.now()
  const context = echo ?? (await loadEchoContext(supabase, userId))
  if (!echo) trace.push(`echo context: loaded in ${Date.now() - echoStart}ms`)
  const mulls = await generateMull(supabase, userId, context, trace, creative)
  if (mulls.length === 0) trace.push('nothing worth asking — empty slot')
  return mulls
}
