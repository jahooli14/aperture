/**
 * Generator — writes up to 3 project ideas from two cooperating modes.
 *
 *   READ MODE (the hero). Looks at the user's whole creative life — every
 *   project state with feedback, voice notes back ~24 months, lists with
 *   reactions, reading + highlights, prior idea outcomes — and names the
 *   through-line nobody (including the user) has said out loud. Then names
 *   the project that breaks or extends it. The wow is the audacity of the
 *   read; the project is the consequence. Returns 0 or 1 idea.
 *
 *   CROSSOVER MODE (the original). The seed-picker chooses (centre × arrival)
 *   pairs in code; the LLM verifies each pair and either writes the idea or
 *   nulls the slot. Locked pairs prevent same-corpus runs collapsing onto
 *   the same convergence. Returns up to 3 ideas.
 *
 * Both modes run in parallel and the results merge: when Read fires it takes
 * the hero slot (rank 1) and crossover ideas slide to ranks 2/3. When Read
 * stays silent, crossover carries the surface as before. The UI checks
 * `mode` per row and renders Read with a leading pattern block.
 *
 * Permissive fallback: when Read + crossover both return nothing, fall back
 * to a permissive single-idea prompt, then to a no-LLM template floor, so a
 * run is never empty. Both the user button and cron now run with force=true:
 * a silent cron run inserts nothing, never supersedes the prior pending idea,
 * and that stale row then short-circuits every user press — the "no new idea
 * for a month" deadlock. The floor keeps the queue refreshing.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import { pickSeedPairs, tokenise, relatedness, parseEmbedding, type SeedCandidate } from './seed-picker.js'
import { PLAIN_ENGLISH_RULES } from '../plain-english.js'
import { DEFAULT_IDEA_BRIEF } from './default-prompt.js'
import type { ArrivalKind, CentreKind, GatherResult, GenerationResult, IdeaEvidence, IdeaOutcome, ProjectIdea, SeedPair } from './types.js'

/** Built ideas now carry their real outcome (see types.ts / gather.ts). The
 *  generator surfaces that outcome so it can repeat what ships and back off
 *  what stalls — "built" alone was never the signal; the result is. */
type BuiltIdea = GatherResult['prior_ideas']['built'][number]

const OUTCOME_TAG: Record<IdeaOutcome, string> = {
  shipped: '✓ SHIPPED — they took this all the way',
  worked: '▸ in progress — they actually started building it',
  claimed: 'built, not yet moved',
  stalled: '✗ STALLED — they built it and it went nowhere',
}

/** One line for a built idea, tagged with what actually happened to it. */
function builtLine(b: BuiltIdea, opts: { feedback?: number } = {}): string {
  const tag = b.outcome ? ` [${OUTCOME_TAG[b.outcome]}]` : ''
  const fb = opts.feedback && b.feedback ? ` — ${truncate(b.feedback, opts.feedback)}` : ''
  return `  · "${b.title}"${tag}${fb}`
}

const MIN_SIGNALS = 8

export type SessionFeeling = 'focused' | 'scattered' | 'restless'

export interface GenerateOptions {
  /** force=true falls back to the permissive prompt — then a no-LLM
   *  template floor — when Read + crossover both return nothing, so the
   *  result is never empty. Both the user button and cron pass force=true:
   *  an empty cron run leaves a stale pending idea that the user button
   *  then re-serves forever. The `fast` flag, not this one, is what
   *  distinguishes the cron and user pipelines. */
  force?: boolean
  /** fast=true is the on-demand user path: skip Read (the slow
   *  reasoning-heavy mode), and ask Flash for ONE idea instead of three.
   *  Stays on FLASH_CHAT for quality — the speed win is from less work,
   *  not a smaller model. Lands in ~10s instead of ~30s. Cron keeps the
   *  full pipeline because cron has no user waiting. */
  fast?: boolean
  /** Session feeling captured by FeelingPill at app open — calibrates
   *  the on-demand fast path to right-now state. The cron path doesn't
   *  use this (cron has no user; runs against a population). */
  feeling?: SessionFeeling | null
  /** User-customised editorial brief for the fast-path idea prompt. NULL
   *  or empty string → use DEFAULT_IDEA_BRIEF. Lives on user_settings.
   *  Only the fast path uses it today — cron stays on the locked-pair
   *  pipeline so the longitudinal Read mode keeps its full structure. */
  brief?: string | null
}

export async function generateProjectIdeas(
  gathered: GatherResult,
  opts: GenerateOptions = {},
): Promise<GenerationResult> {
  if (gathered.total_signal_count < MIN_SIGNALS) {
    console.log(`[project-ideas] insufficient_data: ${gathered.total_signal_count} signals (min ${MIN_SIGNALS})`)
    return { ideas: [], reason: 'insufficient_data', attempts: 0 }
  }

  const seeds = pickSeedPairs(gathered, { count: 3 })
  console.log(`[project-ideas] seed picker chose ${seeds.length} pair(s)${seeds.length ? `: ${seeds.map(s => `${s.centre.kind}#${s.centre.id.slice(0, 8)}×${s.arrival.kind}#${s.arrival.id.slice(0, 8)} (score=${s.score.toFixed(2)}, rel=${s.relatedness.toFixed(2)}${s.semantic ? ' sem' : ' tok'})`).join('; ')}` : ''}`)

  if (opts.fast) {
    // Fast path — user is waiting. ONE Flash call over the WHOLE gathered
    // corpus (no Lite pre-digest). Flash's context window swallows the
    // full ~9-table gather easily; the old two-stage compression was the
    // main reason the button kept returning the same idea (Lite ran near-
    // deterministically and only ever surfaced the top dormant project).
    // Feeding the raw corpus restores variety and lets the model ground
    // the idea in any signal, not just the five Lite chose to keep.
    //
    // Repeats are now blocked at the PROJECT level, not just by title:
    // gathered.blocked_project_ids holds every centre the user rejected
    // (~180d) or was just shown (~30d), and we filter dormant candidates
    // against it before the model ever sees them. Relaxed only when that
    // would leave nothing to suggest.
    //
    // If the LLM path fails twice a server-side template synthesises an
    // idea without an LLM call, so the button NEVER returns empty.
    // One diagnostic line that answers "timeout vs data?" at a glance:
    // exact corpus counts going into the model + how many centres are
    // blocked. If counts here are healthy but the LLM still falls back,
    // it's a Flash timeout (see the attempt logs); if counts are thin,
    // it's a gather/RLS data problem.
    const corpus = `mem=${gathered.memories.length} list=${gathered.list_items.length} dorm=${gathered.dormant_projects.length} act=${gathered.active_projects.length} read=${gathered.reading.length} hl=${gathered.highlights.length} blocked=${gathered.blocked_project_ids.length}`
    console.log(`[project-ideas] fast path: single full-corpus Flash${opts.feeling ? ` (feeling=${opts.feeling})` : ''}${opts.brief ? ' (custom brief)' : ''}; ${corpus}`)
    const tFast = Date.now()
    const fastIdea = await runFastSingle(gathered, opts.feeling ?? null, opts.brief ?? null)
    if (fastIdea) {
      console.log(`[project-ideas] fast path: LLM idea in ${Date.now() - tFast}ms — "${fastIdea.title}"`)
      return { ideas: [{ ...fastIdea, mode: 'crossover' }], attempts: 1 }
    }
    // Flash misbehaved on both attempts (or budget ran out). The template
    // never returns null — the button is guaranteed to come back with
    // something. The WARN + corpus line makes a recurring fallback
    // obvious in the logs without needing to repro.
    console.warn(`[project-ideas] fast path: LLM produced nothing after ${Date.now() - tFast}ms — serving template fallback; ${corpus}`)
    const synth = synthesiseFallbackIdea(gathered)
    return { ideas: [{ ...synth, mode: 'crossover' }], attempts: 2, fallback: true }
  }

  // Read and crossover run in parallel — the wow shape and the convergence
  // shape compete for the hero slot. Read returns 0 or 1; crossover returns
  // 0–3. When Read fires it takes rank 1 and crossover slides behind it.
  const [readIdeas, crossoverIdeas] = await Promise.all([
    runRead(gathered),
    seeds.length > 0 ? runLockedPairs(gathered, seeds) : Promise.resolve([] as ProjectIdea[]),
  ])

  const merged = mergeIdeas(readIdeas, crossoverIdeas)
  if (merged.length > 0) return { ideas: merged, attempts: 1 }

  if (opts.force) {
    console.log(`[project-ideas] read+crossover produced 0; force=true, falling back to permissive`)
    const fallback = await runPermissive(gathered)
    if (fallback.length > 0) return { ideas: fallback, attempts: 2 }
    // Permissive also came back empty (LLM error / parse-fail). Returning
    // [] here is what let a stale pending idea sit in the queue and get
    // re-served forever, so synthesise a no-LLM template idea as the floor.
    // Flagged fallback:true so the caller stores it 'superseded', not
    // 'pending' — it clears the stale row without parking filler at the
    // front of the queue.
    console.warn(`[project-ideas] permissive also empty; serving template floor`)
    const synth = synthesiseFallbackIdea(gathered)
    return { ideas: [{ ...synth, mode: 'crossover' }], attempts: 3, fallback: true }
  }

  return { ideas: [], reason: 'parse_failure', attempts: 1 }
}

/** Merge Read (0 or 1) and crossover (0–3) into a single ranked deck capped
 *  at 3. Read takes rank 1 when it fires; crossover fills the rest. When
 *  Read stays silent, crossover carries the deck as before. */
function mergeIdeas(readIdeas: ProjectIdea[], crossoverIdeas: ProjectIdea[]): ProjectIdea[] {
  const out: ProjectIdea[] = []
  if (readIdeas.length > 0) out.push({ ...readIdeas[0], mode: 'read' })
  for (const idea of crossoverIdeas) {
    if (out.length >= 3) break
    out.push({ ...idea, mode: 'crossover' })
  }
  return out.map((idea, i) => ({ ...idea, rank: i + 1 }))
}

async function runLockedPairs(gathered: GatherResult, seeds: SeedCandidate[], opts: { fast?: boolean } = {}): Promise<ProjectIdea[]> {
  const prompt = buildLockedPrompt(gathered, seeds)
  console.log(`[project-ideas] locked-pairs prompt: ${prompt.length} chars; pairs=${seeds.length}; fast=${!!opts.fast}`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      // Fast path asks for one slot only, so output is ~1/3 the length
      // and Flash returns much sooner. maxTokens shrinks accordingly.
      maxTokens: opts.fast ? 5000 : 16000,
      temperature: 0.85,
      responseFormat: 'json',
    })
  } catch (err) {
    console.error(`[project-ideas] Flash call threw after ${Date.now() - t0}ms:`, err)
    return []
  }
  console.log(`[project-ideas] Flash responded in ${Date.now() - t0}ms (${raw.length} chars)`)

  const ideas = parseLockedSlots(raw, gathered, seeds)
  if (ideas.length === 0) {
    console.warn(`[project-ideas] no valid ideas after parse. raw length: ${raw.length}`)
    for (let i = 0; i < raw.length; i += 1500) {
      console.warn(`[project-ideas] raw[${i}..]: ${raw.slice(i, i + 1500)}`)
    }
  } else {
    console.log(`[project-ideas] produced ${ideas.length} valid ideas`)
  }
  return ideas
}

async function runPermissive(gathered: GatherResult, opts: { fast?: boolean } = {}): Promise<ProjectIdea[]> {
  const prompt = buildPermissivePrompt(gathered)
  console.log(`[project-ideas] permissive prompt: ${prompt.length} chars; fast=${!!opts.fast}`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      maxTokens: opts.fast ? 3500 : 8000,
      temperature: 0.85,
      responseFormat: 'json',
    })
  } catch (err) {
    console.error(`[project-ideas] permissive Flash call threw after ${Date.now() - t0}ms:`, err)
    return []
  }
  console.log(`[project-ideas] permissive Flash responded in ${Date.now() - t0}ms (${raw.length} chars)`)
  return parsePermissive(raw, gathered)
}

/** Read mode — looks at the user's whole creative life and names the
 *  through-line the user hasn't said out loud yet, then names the project
 *  that breaks or extends it. Returns 0 (silent — no real pattern visible)
 *  or 1 idea. The bar is "would the user say 'huh, that's me' before they
 *  say anything else." */
/** Hard cap per LLM call in the fast path. Gemini Flash has been observed
 *  serving 125 output tokens over 17s (~7 tok/s) when overloaded; without
 *  a cap a single bad backend day produces 40s waits and an empty card.
 *  We'd rather bail to the next stage / the template and ship something.
 *  The underlying call continues in the background (Promise.race doesn't
 *  cancel) but we stop waiting.
 *
 *  Raised 15s → 25s → 45s as the corpus widened to "give it everything".
 *  A full-history prompt on a thinking model is genuinely slower; the
 *  user explicitly chose completeness over speed and will wait for a
 *  real thought rather than get the template's fake one. The queue
 *  short-circuit means the NEXT press is instant, so the wait is paid
 *  once, not every time. */
const FAST_STAGE_TIMEOUT_MS = 45_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ])
}

const FEELING_GUIDANCE: Record<SessionFeeling, string> = {
  focused: 'They are FOCUSED right now — they can take on something demanding. Pick the project that needs their full attention; the next_step can ask for an hour of real work.',
  scattered: 'They are SCATTERED right now — short attention, hard to commit. Pick a project where the next_step is a 10-minute concrete move that produces a visible artefact. Nothing that asks them to "decide" or "plan."',
  restless: 'They are RESTLESS right now — they want a change of texture. Prefer a project that uses a different sense or tool than the obvious one (away from the screen if they\'ve been on it; back to a screen if they\'ve been in the workshop). The next_step should physically move them.',
}

/** Cheap, deterministic taste line from theme frequency across the user's
 *  voice notes. Replaces the Lite-generated taste sentence — good enough to
 *  orient the model, costs nothing, and never invents. */
function deriveTasteLine(g: GatherResult): string {
  const counts = new Map<string, number>()
  for (const m of g.memories) {
    for (const theme of m.themes ?? []) {
      const key = theme.trim().toLowerCase()
      if (key.length < 3) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const top = Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([t]) => t)
  return top.length ? `Still forming — recently circling: ${top.join(', ')}.` : 'Still forming.'
}

/** Single full-corpus fast path. ONE Flash call over the whole gather.
 *  Dormant candidates the user rejected (~180d) or was just shown (~30d)
 *  are filtered out before the model sees them — that, not a title string
 *  match, is what stops the same project coming back reworded. When that
 *  filter would leave nothing we relax it but tell the model the truth so
 *  it finds a new angle instead of reword #5. Retries once hotter; returns
 *  null only if both attempts fail (caller then serves the template). */
/** Total LLM wall-clock budget for the fast path. The client aborts the
 *  POST at 75s (ProjectIdeasHome); gather + supersede + insert + network
 *  eat into that, so the budget sits below it. With the full-history
 *  prompt one good attempt is usually all there's time for — the retry
 *  only fires when an early failure leaves real budget. */
const FAST_TOTAL_BUDGET_MS = 66_000
/** Don't start a retry unless this much budget is left — a retry that
 *  can't realistically finish is worse than bailing straight to the
 *  (instant) template. */
const MIN_RETRY_BUDGET_MS = 7_000

async function runFastSingle(
  gathered: GatherResult,
  feeling: SessionFeeling | null,
  brief: string | null,
): Promise<ProjectIdea | null> {
  const blocked = new Set(gathered.blocked_project_ids)
  let dormant = gathered.dormant_projects.filter(p => !blocked.has(p.id))
  let allDormantSeen = false
  if (dormant.length === 0 && gathered.dormant_projects.length > 0) {
    dormant = gathered.dormant_projects
    allDormantSeen = true
  }
  const started = Date.now()
  const firstTimeout = Math.min(FAST_STAGE_TIMEOUT_MS, FAST_TOTAL_BUDGET_MS)
  const first = await runFastSingleAttempt(gathered, dormant, allDormantSeen, feeling, brief, { attempt: 1, temperature: 0.9, timeoutMs: firstTimeout })
  if (first) return first
  // Only retry if there's real budget left under the client's 40s cap. A
  // 25s retry after a 25s timeout would land past it and the user just
  // sees an error — bail to the instant template instead. The server-side
  // insert still happens, so a subsequent press is instant via the queue.
  const remaining = FAST_TOTAL_BUDGET_MS - (Date.now() - started)
  if (remaining < MIN_RETRY_BUDGET_MS) {
    console.log(`[project-ideas] fast/single skipping retry — only ${remaining}ms budget left`)
    return null
  }
  // Hotter retry so attempt 2 doesn't reproduce attempt 1's parse-fail.
  const second = await runFastSingleAttempt(gathered, dormant, allDormantSeen, feeling, brief, { attempt: 2, temperature: 1.0, timeoutMs: Math.min(FAST_STAGE_TIMEOUT_MS, remaining) })
  return second
}

async function runFastSingleAttempt(
  gathered: GatherResult,
  dormant: GatherResult['dormant_projects'],
  allDormantSeen: boolean,
  feeling: SessionFeeling | null,
  brief: string | null,
  opts: { attempt: number; temperature: number; timeoutMs: number },
): Promise<ProjectIdea | null> {
  const prompt = buildFastSinglePrompt(gathered, dormant, allDormantSeen, feeling, brief)
  console.log(`[project-ideas] fast/single prompt: ${prompt.length} chars; attempt=${opts.attempt}; dormant=${dormant.length}${allDormantSeen ? ' (all seen — relaxed)' : ''}; timeout=${opts.timeoutMs}ms`)
  const t0 = Date.now()
  let raw: string
  try {
    raw = await withTimeout(
      generateText(prompt, {
        model: MODELS.FLASH_CHAT,
        // FLASH_CHAT is a Gemini 3.x thinking model — internal reasoning
        // tokens count against maxOutputTokens. 1400 was being consumed
        // almost entirely by thinking, leaving ~40 tokens for the answer
        // and a truncated, unparseable JSON. 8000 matches the Read /
        // permissive paths (same model) which produce full output.
        maxTokens: 8000,
        temperature: opts.temperature,
        responseFormat: 'json',
      }),
      opts.timeoutMs,
      `fast/single attempt ${opts.attempt}`,
    )
  } catch (err) {
    console.error(`[project-ideas] fast/single attempt ${opts.attempt} threw after ${Date.now() - t0}ms:`, err)
    return null
  }
  console.log(`[project-ideas] fast/single attempt ${opts.attempt} responded in ${Date.now() - t0}ms (${raw.length} chars)`)
  return parseFastIdea(raw, gathered, dormant)
}

function buildFastSinglePrompt(
  g: GatherResult,
  dormant: GatherResult['dormant_projects'],
  allDormantSeen: boolean,
  feeling: SessionFeeling | null,
  brief: string | null,
): string {
  const feelingBlock = feeling ? `\n═══════ HOW THEY'RE FEELING RIGHT NOW ═══════\n${FEELING_GUIDANCE[feeling]}\n` : ''
  // The editorial brief is user-editable in Settings. NULL or empty
  // string → fall back to the built-in default. The user's text replaces
  // the brief verbatim — they get to set the editorial discipline (which
  // moves are allowed, what the title can look like, what the next step
  // must be). Plain-English rules and JSON structure stay non-editable.
  const ideaBrief = (brief && brief.trim()) ? brief.trim() : DEFAULT_IDEA_BRIEF

  // The model has a huge, cheap context window — give it the whole
  // corpus and let the prompt steer direction, rather than pre-trimming.
  // Caps here are generous safety bounds, not editorial choices; gather
  // already row-caps upstream.
  const dormantBlock = dormant.slice(0, 120).map(p => {
    const blockerLine = p.blocker ? `\n      blocked at: "${truncate(p.blocker, 200)}"` : ''
    const bookmarkLine = p.last_bookmark ? `\n      left off: "${truncate(p.last_bookmark, 200)}"` : ''
    return `  project_dormant#${p.id} "${p.title}" (last touched ${isoDate(p.updated_at)})${p.description ? ` — ${truncate(p.description, 320)}` : ''}${blockerLine}${bookmarkLine}`
  }).join('\n')

  const activeBlock = g.active_projects.slice(0, 80).map(p =>
    `  project_active#${p.id} "${p.title}" (last touched ${isoDate(p.updated_at)})${p.description ? ` — ${truncate(p.description, 200)}` : ''}`
  ).join('\n')

  // The full voice stream, oldest dates intact so THE ARC is readable.
  const memBlock = g.memories.slice(0, 350).map(m =>
    `  memory#${m.id} (${isoDate(m.created_at)}) — "${truncate(m.body, 420)}"`
  ).join('\n')

  // Lists grouped by type, reaction-tagged; "off" items filtered out.
  const reactionWeight = (r: 'sparked' | 'off' | 'make' | null): number =>
    r === 'make' ? 3 : r === 'sparked' ? 2 : r === 'off' ? -1 : 1
  const listsByType = groupBy(
    g.list_items
      .filter(li => li.reaction !== 'off')
      .sort((a, b) => reactionWeight(b.reaction) - reactionWeight(a.reaction)),
    li => li.list_type,
  )
  const listBlock = Array.from(listsByType.entries()).map(([type, items]) =>
    `  ${type}: ${items.slice(0, 60).map(li => {
      const tag = li.reaction === 'make' ? ' [WANT TO MAKE]' : li.reaction === 'sparked' ? ' [SPARKED]' : ''
      return `${truncate(li.content, 80)}${tag}`
    }).join('; ')}`
  ).join('\n')

  const readingBlock = g.reading.slice(0, 120).map(r =>
    `  "${r.title ?? '(untitled)'}"${r.excerpt ? ` — ${truncate(r.excerpt, 160)}` : ''}`
  ).join('\n')
  const highlightBlock = g.highlights.slice(0, 120).map(h =>
    `  "${truncate(h.quote, 200)}"${h.article_title ? ` — ${h.article_title}` : ''}`
  ).join('\n')

  // Rejected projects are already filtered out of the dormant list by id;
  // we still name them with the reason so the model doesn't reach for the
  // same SHAPE under a new title.
  const rejectedBlock = g.prior_ideas.rejected.length
    ? g.prior_ideas.rejected.map(r => `  • "${r.title}"${r.feedback ? ` — they said: ${truncate(r.feedback, 140)}` : ''}`).join('\n')
    : '  (none yet)'
  const seenBlock = [
    ...g.prior_ideas.built.map(b => `  • ${b.outcome ? OUTCOME_TAG[b.outcome] : 'BUILT'}: "${b.title}"`),
    ...g.prior_ideas.saved.map(s => `  • saved: "${s.title}"`),
    ...g.recent_titles.map(t => `  • just shown: "${t.title}"`),
  ].join('\n') || '  (none yet)'
  // Source-rotation: the wells the last few ideas were mined from. If
  // every line points at the same subject/place/photo set, that vein is
  // exhausted for THIS press — a different project from the same well is
  // still the same well.
  const minedBlock = g.recently_mined.length
    ? g.recently_mined.map(m => `  • "${m.title}" — mined from ${m.source}`).join('\n')
    : '  (nothing yet — first idea, no rotation constraint)'

  // When every dormant project has been shown/rejected, stop calling
  // dormant "preferred ground" — with a 1-project pool that framing makes
  // the model revive the same thing forever. Flip the bias to NAME.
  const dormantHeader = allDormantSeen
    ? `═══════ DORMANT / ON-HOLD PROJECTS — context only. The user has already been shown / has rejected the project(s) below. Do NOT revive or re-pitch them, even reworded or "from a new angle". ═══════`
    : `═══════ DORMANT / ON-HOLD PROJECTS (preferred ground — reviving the right one is usually the best answer) ═══════`
  const relaxNote = allDormantSeen
    ? `\nThe dormant pool is exhausted. The strongest move now is NAME: pull a genuinely new project out of the recent voice notes, lists, reading and highlights — something they're circling but haven't said out loud. Only EXTEND a dormant project if you can name a concretely DIFFERENT output (not the same pitch reworded). Reviving one as-is is off the table this run.\n`
    : ''

  return `You are a friend who's been paying attention, writing ONE project suggestion for someone who just opened the app and asked "give me one thing to work on today." You have their whole creative record below — use any of it, not just the projects.

═══════ VOICE RULES (non-negotiable) ═══════

${PLAIN_ENGLISH_RULES}
${feelingBlock}
═══════ WHO THEY ARE ═══════

${deriveTasteLine(g)}

═══════ THE ARC — time is a dimension, use it ═══════
Every project and note below carries a date. Read the gap between the oldest and newest: what has changed — new skills, sharper taste, different constraints, what they keep returning to. Two of the strongest moves live here:
  • GROWTH: a recent capture shows they've outgrown where an old project stalled. Don't restart it as-was — name the version that fits who they are NOW.
  • RESURFACE: a genuinely good old project that went quiet because life moved on, not because it was wrong. Bring it back, framed for the present self.
Old is not stale. Old + still resonant = the best material there is. But "why_now" must still point at something real (a recent capture, or a concrete shift over time) — never invent a connection.

${dormantHeader}
${dormantBlock || '  (none yet)'}
${relaxNote}
═══════ ACTIVE PROJECTS — you MAY build on these, but ONLY as EXTEND: a sharp, specific NEW direction or output a recent capture points at. NEVER "finish / ship / continue / complete / polish X" — that's admin Keep Going already handles, not ignition. The title names the NEW thing, not the parent project. ═══════
${activeBlock || '  (none)'}

═══════ RECENT VOICE NOTES (their own words) ═══════
${memBlock || '  (none)'}

═══════ LISTS — films / books / places (identity signal: who they're becoming) ═══════
${listBlock || '  (none)'}

═══════ READING ═══════
${readingBlock || '  (none)'}

═══════ HIGHLIGHTS (sentences they flagged) ═══════
${highlightBlock || '  (none)'}

═══════ YOU KEEP MINING THE SAME VEIN — ROTATE NOW (most important constraint this press) ═══════
The user pressed again, so the last idea did NOT land. Here is the well each recent idea was mined from:
${minedBlock}
If those lines point at the same subject / place / photo set / motif, that vein is OFF for this press. A different project from the same well (more petrol-station things, more glass things) is NOT rotation — it is the exact failure the user is complaining about. Build this idea from material that does NOT appear above: deliberately reach into the corners you have not used — the OLDEST dormant projects, the reading list, the films/books/places lists, notes from months ago, an active project's new direction. There is far more to this person than their most-photographed obsession. Prove it. "why_now" must still be real — pick a genuinely different thread that also has a true reason to surface now.

═══════ WHAT THEY'VE REJECTED — LEARN THE RULE, DON'T JUST SKIP THE TITLE ═══════
${rejectedBlock}
Every "not for me" (and its reason) describes a CATEGORY they don't want — a medium, a scale, a subject, a vibe — not just that one title. Infer the rule behind the nos and stay out of the whole category. Re-pitching a rejected shape under a new name is the single biggest failure mode here. Weight this list heavily.

═══════ ALREADY BUILT / SAVED / JUST SHOWN — never re-emit these titles or a near-paraphrase ═══════
${seenBlock}
The tag on each BUILT line is what actually happened to it. "✓ SHIPPED" = they took that shape all the way — lean toward that KIND of idea (the medium, the scale, the way of working), never that exact title. "✗ STALLED — built and went nowhere" = that shape claims them but they don't finish it; offer it again only if a recent capture genuinely unblocks it, otherwise pick a different shape.

═══════ THE BRIEF (the user wrote this themselves — follow it) ═══════

${ideaBrief}

═══════ OUTPUT (strict JSON, no markdown fences, no extra fields) ═══════
{
  "move": "revive | extend | name",
  "centre_id": "the EXACT project_dormant#<id> OR project_active#<id> this is about, copied verbatim from the lists above. null only for a brand-new 'name' idea.",
  "title": "≤6 words. Names the artefact or the action. For extend-on-active: name the NEW output, not the parent.",
  "pitch": "2 sentences. Sentence 1 = what the project IS. Sentence 2 = what done looks like in one observable test.",
  "why_now": "ONE sentence. The specific recent capture OR the arc-over-time fact that makes this the right one right now.",
  "next_step": "ONE physical action they can do TODAY. Cut, drill, flash, commit a named file with named first content, drive, phone. NOT 'research,' 'plan,' 'sketch,' 'outline,' 'decide.'"
}

revive = restart a dormant project (optionally reshaped for who they are NOW — see THE ARC). extend = a specific NEW direction/output for a dormant OR active project. name = a brand-new project the captures point at (centre_id null). Use ALL of it — every project (dormant and active), every voice note, every list item, reading and highlights — not just one section. Decide the move from where the strongest real energy is, not from a fixed preference order. If the brief and the data don't line up cleanly, follow the brief.`
}

/** Parses the single-call Flash response. Resolves the model's centre_id
 *  against the dormant projects we actually offered (+ active projects),
 *  builds honest evidence from real rows, and — crucially — attaches a
 *  seed_pair keyed on that centre so the NEXT press can debounce this
 *  project at the id level instead of just its title. No LLM-fabricated
 *  source_ids: evidence is synthesised from the resolved centre + the
 *  voice note that best resonates with it. */
function parseFastIdea(
  raw: string,
  gathered: GatherResult,
  allowedDormant: GatherResult['dormant_projects'],
): ProjectIdea | null {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') {
    console.warn(`[project-ideas] fast/single unparseable response (${raw.length} chars): ${raw.slice(0, 300).replace(/\s+/g, ' ')}`)
    return null
  }
  const item = payload as { move?: string; centre_id?: string | null; title?: string; pitch?: string; why_now?: string; next_step?: string }
  if (!item.title || !item.pitch || !item.next_step) {
    console.warn(`[project-ideas] fast/single missing required fields (hasTitle=${!!item.title} hasPitch=${!!item.pitch} hasNextStep=${!!item.next_step}); raw: ${raw.slice(0, 300).replace(/\s+/g, ' ')}`)
    return null
  }
  const title = String(item.title).trim().slice(0, 140)
  if (title.length < 3) {
    console.warn(`[project-ideas] fast/single title too short: "${title}"`)
    return null
  }

  // Resolve centre_id against the dormant projects we offered, then the
  // active projects (EXTEND is now allowed on active projects — a sharp
  // NEW direction, never "finish X"). Anything unresolvable is treated as
  // a "name" idea rather than a hard fail.
  const rawCentre = typeof item.centre_id === 'string' ? item.centre_id : ''
  const bareCentre = rawCentre.includes('#') ? rawCentre.slice(rawCentre.indexOf('#') + 1).trim() : rawCentre.trim()
  const resolve = <T extends { id: string }>(rows: T[]): T | null =>
    !bareCentre ? null
      : (rows.find(r => r.id === bareCentre)
        ?? (bareCentre.length >= 6 ? rows.find(r => r.id.startsWith(bareCentre)) ?? null : null))
  const centreDormant = resolve(allowedDormant)
  const centreActive = centreDormant ? null : resolve(gathered.active_projects)

  // The ONLY active-project title rule: never "finish / ship / continue /
  // complete X" against an active project (that's Keep Going admin, not
  // ignition). A NEW-direction title that happens to mention the parent
  // is fine — this mirrors the GET-side filter so the idea won't be
  // dropped downstream.
  const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?|continue(\s+the)?)\b/i
  if (FINISH_RE.test(title) && gathered.active_projects.some(p => p.title.trim() && title.toLowerCase().includes(p.title.toLowerCase()))) {
    console.log(`[project-ideas] fast/single dropped "${title}" — "finish/ship X" against an active project`)
    return null
  }

  const arrival = pickResonantMemory(gathered, centreDormant ?? centreActive ?? null)
  const evidence: IdeaEvidence[] = []
  let seed_pair: SeedPair | undefined
  if (centreDormant) {
    evidence.push({
      kind: 'project_dormant',
      source_id: centreDormant.id,
      label: `dormant project: ${centreDormant.title}`,
      date: isoDate(centreDormant.updated_at),
      excerpt: truncate(centreDormant.description ?? centreDormant.title, 220),
    })
    if (arrival) seed_pair = { centre_kind: 'project_dormant', centre_id: centreDormant.id, arrival_kind: 'memory', arrival_id: arrival.id }
  } else if (centreActive) {
    evidence.push({
      kind: 'project',
      source_id: centreActive.id,
      label: `active project: ${centreActive.title}`,
      date: isoDate(centreActive.updated_at),
      excerpt: truncate(centreActive.description ?? centreActive.title, 220),
    })
    if (arrival) seed_pair = { centre_kind: 'project_active', centre_id: centreActive.id, arrival_kind: 'memory', arrival_id: arrival.id }
  }
  if (arrival) {
    evidence.push({
      kind: 'memory',
      source_id: arrival.id,
      label: 'voice note',
      date: isoDate(arrival.created_at),
      excerpt: truncate(arrival.body, 220),
    })
  }
  // A "name" idea with no project centre cites a second recent memory so
  // the "from N signals" drawer isn't a single row.
  if (!centreDormant && !centreActive) {
    const second = gathered.memories.find(m => m.id !== arrival?.id)
    if (second) {
      evidence.push({
        kind: 'memory',
        source_id: second.id,
        label: 'voice note',
        date: isoDate(second.created_at),
        excerpt: truncate(second.body, 220),
      })
    }
  }

  // Degenerate case (no centre, no memories at all) — keep the drawer
  // non-empty. synthesiseEvidence never cites an active project.
  if (evidence.length === 0) evidence.push(...synthesiseEvidence(gathered))

  const idea: ProjectIdea = {
    rank: 1,
    title,
    pitch: String(item.pitch).trim().slice(0, 800),
    why_now: String(item.why_now ?? '').trim().slice(0, 400) || 'A recent capture pointed straight at this.',
    next_step: String(item.next_step).trim().slice(0, 400),
    evidence,
  }
  return seed_pair ? { ...idea, seed_pair } : idea
}

/** The recent voice note that best overlaps the centre's text, or the most
 *  recent note when there's no centre. Drives both the arrival half of the
 *  stored seed_pair (so the next press debounces this project) and the
 *  second evidence row. */
function pickResonantMemory(
  g: GatherResult,
  centre: { title: string; description?: string | null; embedding?: number[] | string | null } | null,
): GatherResult['memories'][number] | null {
  if (g.memories.length === 0) return null
  if (centre) {
    const centreTokens = tokenise(`${centre.title} ${centre.description ?? ''}`)
    const centreEmbedding = parseEmbedding(centre.embedding)
    if (centreTokens.size > 0 || centreEmbedding) {
      // Same relatedness as the seed picker: cosine when both sides are
      // embedded, token overlap otherwise.
      let best: { m: GatherResult['memories'][number]; rel: number } | null = null
      for (const m of g.memories) {
        const rel = relatedness(
          { embedding: centreEmbedding, tokens: centreTokens },
          { embedding: parseEmbedding(m.embedding), tokens: tokenise(`${m.title ?? ''} ${m.body} ${m.themes.join(' ')}`) },
        ).value
        if (rel > 0 && (!best || rel > best.rel)) best = { m, rel }
      }
      if (best) return best.m
    }
  }
  return g.memories[0] ?? null
}

/** Builds 2 evidence rows from real gathered data — the top dormant project
 *  and the most recent memory. Never fabricates source_ids; the UI can
 *  expand the "signals" drawer and link through. */
function synthesiseEvidence(g: GatherResult): IdeaEvidence[] {
  const out: IdeaEvidence[] = []
  if (g.dormant_projects[0]) {
    const p = g.dormant_projects[0]
    out.push({
      kind: 'project_dormant',
      source_id: p.id,
      label: `dormant project: ${p.title}`,
      date: isoDate(p.updated_at),
      excerpt: truncate(p.description ?? p.title, 220),
    })
  }
  if (g.memories[0]) {
    const m = g.memories[0]
    out.push({
      kind: 'memory',
      source_id: m.id,
      label: 'voice note',
      date: isoDate(m.created_at),
      excerpt: truncate(m.body, 220),
    })
  }
  return out
}

/** Last-resort server-side template. No LLM call. Used when both LLM stages
 *  fail — guarantees the button always returns something rather than 40s
 *  of nothing. Tiers, ordered by quality:
 *    1. Dormant project whose themes overlap a recent voice note — the
 *       resurfacing is earned and the why_now names the specific resonance.
 *    2. Top dormant project with no resonance — still surfaced, but the
 *       why_now names the gap, not a "today is as good a day as any" bromide.
 *    3. Most recent voice note + follow-it framing.
 *    4. Top "want to make" list reaction.
 *    5. Universal fallback — never returns null.
 *  Lower quality than LLM output; always better than empty. */
export function synthesiseFallbackIdea(g: GatherResult): ProjectIdea {
  // Tier 1 + 2 — dormant project. Pick the one whose themes overlap a
  // recent voice note over the top-of-list pick; otherwise fall back to
  // most-recently-touched.
  const match = findResonantDormantProject(g)
  if (match) {
    console.warn(`[project-ideas] fallback tier=dormant project="${match.project.title}" resonant=${!!match.memory}`)
    return buildDormantRevival(match, g)
  }
  // Tier 3: a recent voice note to follow.
  const memory = g.memories[0]
  if (memory) {
    console.warn(`[project-ideas] fallback tier=voice (no usable dormant project; ${g.dormant_projects.length} exist, all blocked/empty)`)
    const excerpt = truncate(memory.body.replace(/\s+/g, ' ').trim(), 240)
    const days = daysAgo(memory.created_at)
    return {
      rank: 1,
      title: 'Follow what you said',
      pitch: `"${excerpt}" — that was you, ${describeRecency(days)}. The shape is half-named already. Make the version of it that exists by tonight.`,
      why_now: `${describeRecency(days, { capitalise: true })} you put this on the record. It hasn\'t cooled yet — that\'s the window.`,
      next_step: 'Re-read it once. Then spend 30 minutes making the smallest real version — write a draft, cut a clip, sketch the frame. Stop when the timer ends.',
      evidence: synthesiseEvidence(g),
    }
  }
  // Tier 4: a "want to make" list reaction.
  const wantsToMake = g.list_items.find((li) => li.reaction === 'make')
  if (wantsToMake) {
    console.warn('[project-ideas] fallback tier=list-make (no dormant project, no voice notes)')
    return {
      rank: 1,
      title: truncate(wantsToMake.content, 60),
      pitch: `You marked this "want to make" — that\'s your own past self handing you the brief. Spend an hour today on the version that\'s ugly but real.`,
      why_now: 'You already said yes to this. It\'s been sitting on the list waiting for the hour.',
      next_step: 'Set a 30-minute timer. Make the rough first version. Save it somewhere you\'ll find it tomorrow.',
      evidence: [],
    }
  }
  // Tier 4b: something they reacted to ("sparked"), or — failing that —
  // any list item / reading / highlight. The universal tier below is for
  // a genuinely empty account; if there's ANY identity signal, use it
  // rather than telling a user with a full app to "go record a thought."
  const sparked = g.list_items.find((li) => li.reaction === 'sparked')
  const anyListItem = sparked ?? g.list_items.find((li) => li.reaction !== 'off')
  if (anyListItem) {
    console.warn(`[project-ideas] fallback tier=list-${sparked ? 'sparked' : 'any'} (no dormant project, no voice notes)`)
    return {
      rank: 1,
      title: truncate(anyListItem.content, 60),
      pitch: `This is on your ${anyListItem.list_type} list${sparked ? ' and you said it sparked you' : ''}. The lists aren\'t a to-read pile — they\'re who you\'re becoming. Make the smallest thing this points at.`,
      why_now: 'You put this on a list yourself. That\'s a signal worth acting on before it goes quiet.',
      next_step: 'Spend 30 minutes making one rough thing this pulls out of you — a page, a sketch, a clip. Stop at the timer.',
      evidence: [],
    }
  }
  const article = g.reading[0]
  const highlight = g.highlights[0]
  if (article || highlight) {
    console.warn(`[project-ideas] fallback tier=${highlight ? 'highlight' : 'reading'} (no project, voice, or list signal)`)
    const source = highlight ? `"${truncate(highlight.quote, 140)}"` : `"${truncate(article!.title ?? 'something you saved', 80)}"`
    return {
      rank: 1,
      title: 'Make something from this',
      pitch: `${source} — you flagged this while reading. Reading without making is just input. Turn the one idea you can\'t stop thinking about into something small and real.`,
      why_now: 'You highlighted this for a reason. Acting on it now is what separates a reader from a maker.',
      next_step: 'Re-read it once. Then spend 30 minutes making the first rough version of whatever it makes you want to build.',
      evidence: [],
    }
  }
  // Tier 4d (last resort before universal): a dormant project the user
  // HAS seen/rejected. Only reached when there is no unblocked project,
  // no voice note, no list item, no reading at all — a seen real project
  // still beats "go record a thought". This ordering is the fix for the
  // "every press returns the one blocked project" loop: it now sits
  // BELOW voice/list/reading instead of above them.
  const relaxedMatch = findResonantDormantProject(g, { allowBlocked: true })
  if (relaxedMatch) {
    console.warn(`[project-ideas] fallback tier=dormant-relaxed project="${relaxedMatch.project.title}" (only material left is an already-seen project)`)
    return buildDormantRevival(relaxedMatch, g)
  }

  // Tier 5: genuinely empty account — no projects, notes, lists, or
  // reading. The button must never come back empty.
  console.warn('[project-ideas] fallback tier=universal — account looks empty (no projects/notes/lists/reading reached the generator)')
  return {
    rank: 1,
    title: 'Capture before you make',
    pitch: 'There\'s nothing on the record yet to point at a specific project. The next move is to feed the harness — record the half-formed thought you came in with so the next idea has somewhere to land.',
    why_now: 'Nothing captured yet. Today\'s job is to put a thought on the record, not to ship something.',
    next_step: 'Open the recorder. Talk for two minutes about whatever you came here thinking about. Don\'t edit, don\'t polish — just leave a trace.',
    evidence: [],
  }
}

interface DormantMatch {
  project: GatherResult['dormant_projects'][number]
  /** The recent voice note whose themes overlap this project, if any. */
  memory?: GatherResult['memories'][number]
  /** Jaccard overlap between project text and memory text. 0 if no memory. */
  overlap: number
}

/** Pick the dormant project most worth resurfacing today. Prefers thematic
 *  overlap with a recent voice note — that's the signal that the user is
 *  back in this project's territory without realising it. Falls back to the
 *  top-of-list dormant project (most recently touched) when nothing
 *  resonates, so the button still answers. Returns null only when there
 *  are no dormant projects at all. */
function findResonantDormantProject(
  g: GatherResult,
  opts: { allowBlocked?: boolean } = {},
): DormantMatch | null {
  // Strict by default: only projects the user hasn't rejected (~180d) or
  // just seen (~30d). The caller deliberately retries with
  // allowBlocked=true ONLY as a last resort (better a seen project than
  // the "go capture a thought" universal tier) — never ahead of the
  // voice / list / reading tiers, or a user with one blocked dormant
  // project gets the same revival on every single press.
  const blocked = new Set(g.blocked_project_ids)
  let pool = g.dormant_projects.filter(p => !blocked.has(p.id))
  if (pool.length === 0 && opts.allowBlocked) pool = g.dormant_projects
  if (pool.length === 0) return null

  const now = Date.now()
  const NINETY_DAYS_MS = 90 * 86_400_000
  // Pre-parse each recent memory's tokens + embedding once so the pool ×
  // memory loop below isn't re-tokenising / re-parsing on every project.
  const recentMemories = g.memories
    .filter((m) => {
      const t = new Date(m.created_at).getTime()
      return !Number.isNaN(t) && now - t <= NINETY_DAYS_MS
    })
    .map((m) => ({
      memory: m,
      tokens: tokenise(`${m.title ?? ''} ${m.body} ${m.themes.join(' ')}`),
      embedding: parseEmbedding(m.embedding),
    }))

  let best: DormantMatch | null = null
  for (const project of pool) {
    const projectTokens = tokenise(`${project.title} ${project.description ?? ''}`)
    const projectEmbedding = parseEmbedding(project.embedding)
    if (projectTokens.size === 0 && !projectEmbedding) continue
    for (const cand of recentMemories) {
      // Cosine when both embedded, token overlap otherwise (see seed-picker).
      const rel = relatedness(
        { embedding: projectEmbedding, tokens: projectTokens },
        { embedding: cand.embedding, tokens: cand.tokens },
      ).value
      if (rel <= 0) continue
      if (!best || rel > best.overlap) {
        best = { project, memory: cand.memory, overlap: rel }
      }
    }
  }
  if (best) return best
  return { project: pool[0], overlap: 0 }
}

function buildDormantRevival(match: DormantMatch, g: GatherResult): ProjectIdea {
  const { project, memory, overlap } = match
  const desc = (project.description ?? '').trim()
  const weeks = weeksAgo(project.updated_at)

  // Pitch leads with what the project actually IS. No "Pick this back up"
  // preamble — that's the template tell. If there's no description, lean
  // on the title shape rather than a generic line.
  const pitch = desc
    ? truncate(desc, 280)
    : `You started "${project.title}" and walked away. The shape was clear enough to name; that\'s usually clear enough to restart.`

  // Why now names the actual reason this project is surfacing today.
  // Resonance > dormancy length > "you set this down."
  let why_now: string
  if (memory && overlap > 0) {
    const excerpt = truncate(memory.body.replace(/\s+/g, ' ').trim(), 180)
    why_now = `${describeRecency(daysAgo(memory.created_at), { capitalise: true })} you said: "${excerpt}" — same territory as this project, ${weeks ? `which has been sitting ${weeks} week${weeks === 1 ? '' : 's'}.` : 'which is waiting.'}`
  } else if (weeks >= 16) {
    why_now = `Dormant ${weeks} weeks. You\'re a different maker than the one who set it down — that\'s the point of looking again.`
  } else if (weeks >= 4) {
    why_now = `${weeks} weeks since you touched this. Long enough to forget the friction, short enough to still mean it.`
  } else {
    why_now = 'You moved past this in the last few weeks. Look once before it slides further out of reach.'
  }

  const next_step = buildDormantNextStep(project, !!memory)

  return {
    rank: 1,
    title: project.title,
    pitch,
    why_now,
    next_step,
    evidence: synthesiseEvidence(g),
  }
}

/** Build a next-step line tied to the project's own description when we
 *  can — the first imperative-looking clause is usually a real action.
 *  Falls back to a concrete-but-generic move that doesn't say "open the
 *  project" or "smallest visible change" (the template tells). */
function buildDormantNextStep(
  project: GatherResult['dormant_projects'][number],
  hasResonance: boolean,
): string {
  const desc = (project.description ?? '').trim()
  if (desc) {
    const firstClause = desc.split(/(?<=[.!?])\s+|[,;]/, 1)[0]?.trim() ?? ''
    // Verb-led first clause: looks like "Cut the beech strip", "Smash some
    // glass", "Write the cold open". Use it as the action directly.
    if (/^[A-Z][a-z]+\s+\S/.test(firstClause) && firstClause.length >= 8 && firstClause.length <= 110) {
      return `${firstClause} — today, not tomorrow. One real version, not a plan.`
    }
  }
  if (hasResonance) {
    return 'Re-open the project. Use the recent capture above as the way back in — write one paragraph or make one piece that ties them together.'
  }
  return 'Open it today. Read the description back to yourself, then do whichever sentence sounds easiest. Stop before you start planning.'
}

function daysAgo(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function weeksAgo(dateStr: string | null | undefined): number {
  return Math.floor(daysAgo(dateStr) / 7)
}

function describeRecency(days: number, opts: { capitalise?: boolean } = {}): string {
  let phrase: string
  if (days <= 1) phrase = 'yesterday'
  else if (days <= 7) phrase = `${days} days ago`
  else if (days <= 14) phrase = 'last week'
  else if (days <= 30) phrase = 'a few weeks back'
  else if (days <= 60) phrase = 'last month'
  else phrase = 'a couple of months ago'
  return opts.capitalise ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase
}

async function runRead(gathered: GatherResult): Promise<ProjectIdea[]> {
  const prompt = buildReadPrompt(gathered)
  console.log(`[project-ideas] read prompt: ${prompt.length} chars`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      maxTokens: 8000,
      // Slightly lower than crossover (0.85) — Read has to commit to one
      // pattern claim and one project; we want it deliberate, not breezy.
      temperature: 0.7,
      responseFormat: 'json',
    })
  } catch (err) {
    console.error(`[project-ideas] read Flash call threw after ${Date.now() - t0}ms:`, err)
    return []
  }
  console.log(`[project-ideas] read Flash responded in ${Date.now() - t0}ms (${raw.length} chars)`)
  return parseRead(raw, gathered)
}

function buildLockedPrompt(g: GatherResult, seeds: SeedCandidate[]): string {
  const lockedBlock = seeds.map((s, i) => {
    const centreLine = `  CENTRE: ${s.centre.kind}#${s.centre.id} — "${s.centre.title}" (last touched ${isoDate(s.centre.last_touched)})${s.centre.description ? `\n    desc: ${truncate(s.centre.description, 200)}` : ''}`
    const arrivalLine = `  ARRIVAL: ${s.arrival.kind}#${s.arrival.id} (${isoDate(s.arrival.date)}) — "${truncate(s.arrival.excerpt, 240)}"`
    return `PAIR ${i + 1}:\n${centreLine}\n${arrivalLine}`
  }).join('\n\n')

  // Active projects are listed compactly so the model can refuse "finish X"
  // framing against them. Any active project is already on Keep Going, so
  // proposing a continuation as an idea is duplication.
  const activeProjBlock = g.active_projects.slice(0, 12).map(p =>
    `  project#${p.id} [${p.status}] "${p.title}"`
  ).join('\n')

  // List items by type — taste / identity signal only. Compact form.
  // Items the user reacted to (sparked, want to make) carry more weight
  // than unreacted items, and items they marked "off" are filtered out.
  const reactionWeight = (r: 'sparked' | 'off' | 'make' | null | undefined): number => {
    if (r === 'make') return 3
    if (r === 'sparked') return 2
    if (r === 'off') return -1
    return 1
  }
  const listsByType = groupBy(
    g.list_items
      .filter((li: any) => li.reaction !== 'off')
      .sort((a: any, b: any) => reactionWeight(b.reaction) - reactionWeight(a.reaction)),
    li => li.list_type,
  )
  const listBlock = Array.from(listsByType.entries()).map(([type, items]) =>
    `  ${type}: ${items.slice(0, 6).map((li: any) => {
      const tag = li.reaction === 'make' ? ' [WANT TO MAKE]'
        : li.reaction === 'sparked' ? ' [SPARKED]'
        : (typeof li.user_rating === 'number' && li.user_rating >= 4) ? ` [${li.user_rating}★]`
        : ''
      return `${truncate(li.content, 60)}${tag}`
    }).join('; ')}`
  ).join('\n')

  // High-signal items the user explicitly reacted to. The model should
  // weight these as identity input above unreacted items.
  const reactedItems = g.list_items.filter((li: any) => li.reaction === 'make' || li.reaction === 'sparked').slice(0, 8)
  const reactedBlock = reactedItems.map((li: any) =>
    `  · ${li.list_type}: "${truncate(li.content, 80)}" — they said: ${li.reaction === 'make' ? 'want to make' : 'sparked me'}`
  ).join('\n')

  // Recent voice notes (≤30d) so the model can pick a real why_now phrase
  // beyond the locked arrival when relevant.
  const recentMems = g.memories.filter(m => isWithinDays(m.created_at, 30)).slice(0, 8)
  const recentMemBlock = recentMems.map(m =>
    `  memory#${m.id} (${isoDate(m.created_at)}) — "${truncate(m.body, 200)}"`
  ).join('\n')

  const seenBlock = [
    ...g.prior_ideas.built.map(t => builtLine(t, { feedback: 120 })),
    ...g.prior_ideas.saved.map(t => `  · saved: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
    ...g.prior_ideas.rejected.map(t => `  · rejected: "${t.title}"${t.feedback ? ` — reason: ${truncate(t.feedback, 120)}` : ''}`),
  ].join('\n')

  // Titles from the last ~14 days that are still pending or were superseded
  // by a regen. Fed in separately so the model sees "you literally just
  // wrote this" — the do-not-repeat rule otherwise misses superseded rows
  // and the user can hit regen and get the same title back.
  const justShownBlock = (g.recent_titles ?? [])
    .slice(0, 12)
    .map(t => `  · "${t.title}"`)
    .join('\n')

  const slotShape = seeds.map((_s, i) =>
    `    { "pair_index": ${i}, "idea": <idea-object> | null, "skip_reason": "<one short sentence; only when idea is null>" }`,
  ).join(',\n')

  return `You are a friend who's been paying attention. Not a coach. Not a therapist. A maker who would actually build the thing themselves. You write in plain English the way a friend talks. You'd rather say nothing than say something that doesn't ring true.

Your job today is NOT to find ideas — the system has already proposed candidate (centre × arrival) pairs below. Your job is to verify each pair and either WRITE the idea or NULL the slot. Most pairs may be null. The user prefers silence over decorative output.

═══════ HOW TO WRITE ═══════

${PLAIN_ENGLISH_RULES}
NEVER invent a hyphenated phrase in scare-quotes ("friction-over-function," "blind-edit"). If the term needs scare-quotes to be understood, rewrite it.
NEVER explain to the user what they "are doing" in coach-voice ("You are shifting from a consumer to a producer of..."). Just say what you'd say to a friend.
ONE idea per sentence. If a sentence has three clauses, it's wrong.
Concrete nouns. "Logic Pro trial expired" beats "your reliance on the 90-day trial of Logic Pro acted as an artificial deadline."
If you can't say it plainly, you don't see the picture clearly enough — null the slot.

═══════ THE TEST ═══════

A pair is real ONLY when both halves are real:

  HALF A — The CENTRE is a project-centre that already exists in the data: artefact-shaped, the user has been quietly building toward it. You can name what the finished thing IS in one sentence.

  HALF B — The ARRIVAL is a recent capture that supplies the SPECIFIC missing piece the centre was waiting for. Not "thematically related." Not "could be combined with." The missing piece. The thing without which the project couldn't ship.

If the centre isn't a real artefact-shaped project, or if the arrival is just a stylistic preference / consumption signal / coincidence, NULL THE SLOT. Do not wedge a real centre and a real arrival into a pretend match.

WORKED EXAMPLE: CENTRE = dormant Raspberry Pi project. ARRIVAL = woodwork course finished three weeks ago. The case was the missing piece. Title: "Build your synth." This is the bar.

ANTI-EXAMPLE 1: "Wooden mouse-dock." No real centre — "computer mouse" is a peripheral. NULL.
ANTI-EXAMPLE 2: "Catch-22 logic-filter for Aperture." Real centre, fake arrival match — Aperture isn't waiting on paradox detection. NULL.
ANTI-EXAMPLE 3: "Paradox-indexed memory palace." Real centre, fake arrival match — paradoxes don't unblock 198 country mappings. NULL.
ANTI-EXAMPLE 4: "Finish the Graham song" / "Ship Aperture" against an ACTIVE PROJECT. Already on Keep Going. Words like "Finish", "Ship", "Complete", "Wrap up", "Polish", "Continue" against any active project are an automatic NULL. The only valid active-project idea is a genuinely NEW direction.

═══════ LOCKED PAIRS — verify each, write or null ═══════

${lockedBlock}

═══════ CONTEXT FOR VERIFICATION + FRAMING ═══════

ACTIVE PROJECTS (NEVER propose "finish / ship / complete / wrap up / polish / continue X" for any of these — Keep Going already surfaces them):
${activeProjBlock || '  (none)'}

LIST ITEMS (films/books/places — taste / identity signal; NEVER lead evidence):
${listBlock || '  (none)'}

ITEMS THE USER EXPLICITLY REACTED TO (these are identity signals — carry more weight than unreacted items):
${reactedBlock || '  (none yet)'}

RECENT VOICE NOTES (last 30 days — for why_now phrasing):
${recentMemBlock || '  (none)'}

PREVIOUSLY SURFACED IDEAS (do NOT repeat any title; honour rejection reasons):
${seenBlock || '  (none)'}

JUST SHOWN — these are the titles the user is currently looking at or just regenerated away from. NEVER emit any of these titles, and do not write a near-paraphrase ("Build your synth" → "Build the synth" / "Make your synth" all count as repeats). Pick a different angle entirely:
${justShownBlock || '  (none)'}

═══════ FOR EACH WRITTEN IDEA ═══════

  - title: ≤6 words. Names the artefact or the action ("Build your synth"; "Ship Aperture's homepage"; "Wire the bird cam"). NO abstract nouns: no "exploration," "study," "series," "totem," "memory of," "in conversation with," "investigation into," "meditation on," "directory," "tracker," "second brain," "digital garden," "newsletter," "podcast," "Substack," "zine," "installation," "portrait series."
  - pitch: 2–3 sentences. Sentence 1 = name the centre AND the missing piece the arrival supplies. Sentence 2 = which toolkit item plays which role. Sentence 3 = what done looks like, in one observable test.
  - why_now: ONE sentence. What arrived recently that turns "someday" into "now." If you can't point to something specific, NULL the slot.
  - next_step: ONE physical action that STARTS the build. Cut, drill, flash, commit (with named file path AND named first content), drive, phone. NOT "research," "plan," "sketch," "outline," "open settings," "decide," "list," "measure." If the only first action is admin, the idea wasn't actually unblocked — NULL.
  - evidence: 2–5 items, each {kind, source_id, label, date, excerpt}. excerpt must be a verbatim substring of the source content shown in the locked pair (will be substring-checked). LEAD evidence (item 0) is the centre from the locked pair. Item 1 is the arrival from the locked pair. The remaining slots can cite related captures from the context blocks.
  - rank_role: one of "convergence" | "dormant_revival" | "growing_edge" — best-effort, not strict.

═══════ OUTPUT (strict JSON, no markdown fences) ═══════
{
  "slots": [
${slotShape}
  ]
}

Each slot's idea-object shape (when not null):
{
  "rank": 1,
  "rank_role": "convergence",
  "title": "...",
  "pitch": "...",
  "why_now": "...",
  "next_step": "...",
  "evidence": [
    { "kind": "project_dormant", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
  ]
}

If a pair is genuinely a forced wedge, set "idea": null and write a one-sentence skip_reason. Returning 3 nulls is correct when no pair holds up.`
}

function isWithinDays(dateStr: string, days: number): boolean {
  if (!dateStr) return false
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= days * 86_400_000
}

/**
 * Permissive prompt — the fallback for manual "show me ideas" when the
 * strict missing-piece pass returns nothing. Lower bar: produce ONE
 * grounded idea drawn from the corpus, even if no recent capture has
 * unblocked it. Still respects the active-project rule (never "finish
 * X" for active) and the no-list-as-lead-evidence rule.
 *
 * Used only when the user explicitly clicks the "show me ideas" button
 * and we'd otherwise be silent. The cron path stays strict.
 */
function buildPermissivePrompt(g: GatherResult): string {
  const memBlock = g.memories.slice(0, 35).map(m =>
    `  memory#${m.id} (${isoDate(m.created_at)}) "${truncate(m.body, 220)}"`,
  ).join('\n')

  const dormantBlock = g.dormant_projects.map(p =>
    `  project_dormant#${p.id} [${p.status}] "${p.title}"${p.description ? ` — ${truncate(p.description, 180)}` : ''}`,
  ).join('\n')

  const activeBlock = g.active_projects.map(p =>
    `  project#${p.id} "${p.title}"`,
  ).join('\n')

  const readingBlock = g.reading.slice(0, 12).map(r =>
    `  reading#${r.id} "${r.title ?? '(untitled)'}"${r.excerpt ? ` — ${truncate(r.excerpt, 140)}` : ''}`,
  ).join('\n')

  const highlightBlock = g.highlights.slice(0, 10).map(h =>
    `  highlight#${h.id} "${truncate(h.quote, 180)}"`,
  ).join('\n')

  const seenBlock = [
    ...g.prior_ideas.built.map(t => builtLine(t)),
    ...g.prior_ideas.saved.map(t => `  · saved: "${t.title}"`),
    ...g.prior_ideas.rejected.map(t => `  · rejected: "${t.title}"`),
  ].join('\n')

  const justShownBlock = (g.recent_titles ?? [])
    .slice(0, 12)
    .map(t => `  · "${t.title}"`)
    .join('\n')

  return `You are a friend looking through someone's recent thoughts and projects, asked directly: "give me one project idea I should think about." Don't be silent — they asked. But don't fake it either: ground the idea in real captures.

Plain English. No "leveraging," "synergies," "soundscapes," "narrative substrate," or scare-quoted invented phrases. Talk like a friend.

═══════ HARD RULES ═══════
1. Output exactly ONE idea (the rank-1 slot).
2. NEVER propose "finish / ship / complete / wrap up / polish / continue" for any active project. Active projects are already on the user's plate. Active project ids are listed below — don't write a continuation idea for them.
3. The idea must cite at least 2 evidence items from the data below. Lead evidence must be a memory, dormant project, or highlight — never a list item.
4. Title ≤ 6 words. No abstract nouns: no "exploration", "study", "series", "totem", "memory of", "in conversation with", "meditation on".
5. The next_step must be a real first action (cut, drill, flash, commit a named file, drive somewhere, phone someone). NOT "research", "plan", "sketch", "outline".
6. Do not repeat any title in PREVIOUSLY SURFACED IDEAS or in JUST SHOWN, and do not write a near-paraphrase of either.

═══════ DATA ═══════

VOICE NOTES:
${memBlock || '  (none)'}

DORMANT / ON-HOLD / ARCHIVED PROJECTS (preferred ground for an idea):
${dormantBlock || '  (none)'}

ACTIVE PROJECTS (forbidden as continuation; only mention if a NEW direction emerges):
${activeBlock || '  (none)'}

READING:
${readingBlock || '  (none)'}

HIGHLIGHTS:
${highlightBlock || '  (none)'}

PREVIOUSLY SURFACED (do not repeat):
${seenBlock || '  (none)'}

JUST SHOWN — titles the user is currently looking at or just regenerated away from. NEVER emit any of these or a near-paraphrase. Pick a different angle entirely:
${justShownBlock || '  (none)'}

═══════ OUTPUT (strict JSON, no markdown fences) ═══════
{
  "ideas": [
    {
      "rank": 1,
      "rank_role": "convergence",
      "title": "...",
      "pitch": "2-3 sentences. What the project is, what's already in their data that supports it, what done looks like.",
      "why_now": "ONE sentence pointing at why this is worth thinking about today.",
      "next_step": "ONE physical action, doable in under an hour with what they already own.",
      "evidence": [
        { "kind": "memory", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "..." }
      ]
    }
  ]
}`
}

/**
 * Read prompt — the longitudinal pattern reader. Hands the model the user's
 * whole creative life and asks for one sentence about what it sees, then
 * the project that consequence demands. The pattern is the wow; the project
 * is the consequence. The model is instructed to stay silent (`idea: null`)
 * unless it can name a real recurring shape, not a single-capture vibe.
 */
function buildReadPrompt(g: GatherResult): string {
  // PROJECT GRAVEYARD — every state, with the user's framing intact. This
  // is what no other tool sees: started / shipped / abandoned, with the
  // user's words still attached. The pattern hides in the deltas between
  // these states (started but never finished; shape that always stalls).
  const activeProjBlock = g.active_projects.slice(0, 15).map(p => {
    const blockerLine = p.blocker ? `\n      BLOCKER (their own words): "${truncate(p.blocker, 200)}"` : ''
    const bookmarkLine = p.last_bookmark ? `\n      LAST BOOKMARK (where they left off after the last focus session): "${truncate(p.last_bookmark, 200)}"` : ''
    return `  project_active#${p.id} "${p.title}" — last touched ${isoDate(p.updated_at)}${p.description ? `; ${truncate(p.description, 160)}` : ''}${blockerLine}${bookmarkLine}`
  }).join('\n')
  const dormantProjBlock = g.dormant_projects.slice(0, 15).map(p => {
    const blockerLine = p.blocker ? `\n      BLOCKER (their own words at the moment they paused): "${truncate(p.blocker, 200)}"` : ''
    const bookmarkLine = p.last_bookmark ? `\n      LAST BOOKMARK (where they left off — the pickup move sits here): "${truncate(p.last_bookmark, 200)}"` : ''
    return `  project_dormant#${p.id} [${p.status}] "${p.title}" — last touched ${isoDate(p.updated_at)}${p.description ? `; ${truncate(p.description, 160)}` : ''}${blockerLine}${bookmarkLine}`
  }).join('\n')

  // PRIOR IDEA OUTCOMES — what the system has already proposed and what the
  // user did with each. Built / saved / rejected outcomes are the strongest
  // taste signal we have. Rejection reasons name what the user is sick of.
  const priorBuilt = g.prior_ideas.built.map(t => builtLine(t, { feedback: 140 })).join('\n')

  // Bet 3 — the resurrection signal. A reshape / recent-forgotten idea that
  // the user BUILT and then actually shipped or worked on is the single
  // strongest proof the harness can do its rarest, most valuable job: hand
  // back a dormant project at the right moment and have it take. Call those
  // out explicitly so the Read prompt leans toward repeating that move.
  const resurrections = g.prior_ideas.built.filter(
    b => (b.shape === 'reshape' || b.shape === 'recent_forgotten') &&
         (b.outcome === 'shipped' || b.outcome === 'worked'),
  )
  const stalledResurrections = g.prior_ideas.built.filter(
    b => (b.shape === 'reshape' || b.shape === 'recent_forgotten') && b.outcome === 'stalled',
  )
  const resurrectionBlock = resurrections.length
    ? resurrections.map(b => `  · "${b.title}" — a dormant project you woke up, and it ${b.outcome === 'shipped' ? 'got finished' : 'got real traction'}.`).join('\n')
    : null
  const stalledResurrectionBlock = stalledResurrections.length
    ? stalledResurrections.map(b => `  · "${b.title}" — woken up but stalled again. Don't re-pitch this one unless a NEW recent capture clearly unblocks it.`).join('\n')
    : null
  const priorSaved = g.prior_ideas.saved.map(t => `  · saved: "${t.title}"${t.feedback ? ` — ${truncate(t.feedback, 140)}` : ''}`).join('\n')
  const priorRejected = g.prior_ideas.rejected.map(t => `  · rejected: "${t.title}"${t.feedback ? ` — reason: ${truncate(t.feedback, 140)}` : ''}`).join('\n')

  // VOICE NOTES — the raw thought-stream. Group by quarter so the model can
  // see drift over time without us having to label it. Older notes matter
  // more here than in crossover; the pattern needs longitudinal range.
  const memoriesByQuarter = groupBy(
    [...g.memories].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    m => quarterKey(m.created_at),
  )
  const memBlock = Array.from(memoriesByQuarter.entries())
    .map(([q, items]) => {
      const lines = items.slice(0, 12).map(m => {
        const tasteMarker = m.triage_category === 'taste_signal' ? ' [TASTE SIGNAL]' : ''
        return `    memory#${m.id} (${isoDate(m.created_at)})${tasteMarker} — "${truncate(m.body, 220)}"`
      }).join('\n')
      return `  ${q}:\n${lines}`
    })
    .join('\n')

  // LISTS WITH REACTIONS — taste / identity signal. Reactions are the
  // strongest thing here: "want to make" + "sparked" point at a shape the
  // user is trying to be. "off" items rule out shapes they're not.
  const reactedItems = g.list_items.filter((li) => li.reaction === 'make' || li.reaction === 'sparked').slice(0, 12)
  const reactedBlock = reactedItems.map((li) =>
    `  · ${li.list_type}: "${truncate(li.content, 90)}" — ${li.reaction === 'make' ? 'WANTS TO MAKE' : 'sparked'}`
  ).join('\n')
  const offItems = g.list_items.filter((li) => li.reaction === 'off').slice(0, 8)
  const offBlock = offItems.map((li) =>
    `  · ${li.list_type}: "${truncate(li.content, 90)}"`
  ).join('\n')

  // READING + HIGHLIGHTS — what they're consuming alongside making. The
  // highlight is the strongest signal: they actively flagged this sentence.
  const readingBlock = g.reading.slice(0, 12).map(r =>
    `  reading#${r.id} (${isoDate(r.created_at)}) "${r.title ?? '(untitled)'}"${r.excerpt ? ` — ${truncate(r.excerpt, 160)}` : ''}`
  ).join('\n')
  const highlightBlock = g.highlights.slice(0, 10).map(h =>
    `  highlight#${h.id} (${isoDate(h.created_at)}) "${truncate(h.quote, 200)}"${h.article_title ? ` — from ${h.article_title}` : ''}`
  ).join('\n')

  const justShownBlock = (g.recent_titles ?? [])
    .slice(0, 12)
    .map(t => `  · "${t.title}"`)
    .join('\n')

  return `You are a friend who has been quietly watching this person try to make things for years. You've heard every voice note. You've seen every project they started and dropped. You've watched what they read, what they bookmark, what they react to. They don't know you've been paying this much attention.

Today they opened the app. Your one job: name the through-line nobody — including them — has said out loud. Then name the project that comes from it.

This is not a "give me an idea" exercise. It's a "tell me what you see" exercise. The wow is when they read your one sentence and say "huh. that's me." The project is just the natural consequence.

═══════ HOW TO WRITE ═══════

${PLAIN_ENGLISH_RULES}
NEVER invent a hyphenated phrase in scare-quotes ("friction-over-function"). If the term needs scare-quotes to be understood, rewrite it.
NEVER explain to the user what they "are doing" in coach voice. Show them what you see, the way a friend would: short, specific, grounded in the data they recognise.
ONE idea per sentence. Three clauses = wrong.
Concrete. "You start music projects every spring and never finish one" beats "you have a recurring affinity for sonic ideation."

═══════ THE BAR ═══════

Pattern must be REAL. It must be visible across at least 3 separate captures or projects in the data below — not pulled from one voice note. Real shapes:

  - A repeating MOVE: "you almost-start music projects four times a year and stall at format."
  - A repeating BLOCK: "every project you've abandoned was bigger than three weekends."
  - A repeating TASTE: "everything you keep is small, physical, made by one person, and resists being sold."
  - A drift in IDENTITY: "you used to read about systems; this year you read about hands."
  - A circle: "you've named [thing] in three different ways across two years and never started it."
  - A RECENT FORGOTTEN thread (project last touched 3–16 weeks ago + recent captures resonate with it): "you stopped touching [Project] 6 weeks ago, and the last three voice notes are about exactly what blocked you." The "project" you write up is the pickup move on that dormant project, not a new one. If the project carries a LAST BOOKMARK line, the next_step is literally that bookmark — don't invent a different opening move.
  - A LONG-DORMANT RESHAPE (project last touched 4+ months ago + you've changed since): "[Project] from a year ago — the version that fits who you are now is [reshape]." Honour the original capture; the reshape uses what they've acquired since (skills, reading, taste). If the project carries a BLOCKER line, the reshape must directly answer or sidestep that blocker — don't propose a version that hits the same wall.
  - An EXTEND (a recent capture, ≤30 days, points at a concrete new direction for one active or recently-dormant project): "the voice note from Tuesday says exactly the feature [Project] is missing." The "project" you write up is that named extension.

If you cannot point at the specific captures that prove the pattern, OUTPUT NULL. There is no consolation prize. A weak pattern read is worse than silence — it makes the whole surface untrustworthy.

═══════ THE PROJECT ═══════

Once the pattern is real, name the ONE project that is the consequence of it:

  - Breaks the block (if the pattern is a recurring failure shape)
  - Honours the taste (if the pattern is a fingerprint)
  - Makes the next-self real (if the pattern is a drift)
  - Names the unnamed circle (if the pattern is a recurring near-start)
  - Picks up the recent forgotten (if the pattern is a RECENT FORGOTTEN thread — the title is the pickup, e.g. "Cadence playlist: 3 tracks tonight")
  - Reshapes the long-dormant (if the pattern is a LONG-DORMANT RESHAPE — the title is the reshaped version, e.g. "Synth book: one page a day")
  - Names the extension (if the pattern is an EXTEND — the title is the specific NEW output for the existing project, e.g. "Logic Pro project: add the cadence track")

The project must be specific, artefact-shaped, and small enough that the first move can happen today. ≤6 words for the title. NO abstract nouns: no "exploration," "study," "series," "directory," "newsletter," "podcast," "zine," "investigation," "meditation on," "in conversation with."

═══════ ACTIVE PROJECTS (already on Keep Going — never propose vague "finish / ship / complete / continue X." You MAY propose a specific NEW output or direction for an active project, but only as an EXTEND pattern when a recent capture clearly names the new thing — and the title must name that new thing, not the parent project.) ═══════
${activeProjBlock || '  (none)'}

═══════ DORMANT / ON-HOLD / ARCHIVED PROJECTS ═══════
${dormantProjBlock || '  (none)'}

═══════ PRIOR IDEAS — BUILT (with what ACTUALLY happened to each — the strongest taste signal there is) ═══════
${priorBuilt || '  (none yet — pattern reads should treat this as itself a signal)'}
The tag is the real outcome, not just that they tapped "save". "✓ SHIPPED" = the pattern behind that idea is one they can finish — trust it, look for its next instance. "✗ STALLED" = a shape that pulls them in but they don't carry to the end; naming THAT is itself a valid pattern read.
${resurrectionBlock ? `\n═══════ RESURRECTIONS THAT LANDED — a dormant project you handed back at the right moment, and it took. This is the harness doing its rarest job well. Find the next one like it. ═══════\n${resurrectionBlock}` : ''}${stalledResurrectionBlock ? `\n═══════ RESURRECTIONS THAT DIDN'T TAKE ═══════\n${stalledResurrectionBlock}` : ''}

═══════ PRIOR IDEAS — SAVED (kept on the radar, not built) ═══════
${priorSaved || '  (none)'}

═══════ PRIOR IDEAS — REJECTED (with reasons — these tell you what they're sick of) ═══════
${priorRejected || '  (none)'}

═══════ VOICE NOTES BY QUARTER (oldest first — drift over time matters here. Notes marked [TASTE SIGNAL] are the user's identity signals — small things they reacted to or noticed. Weight them heavily for taste-fingerprint patterns and lightly for action-shape patterns.) ═══════
${memBlock || '  (none)'}

═══════ THINGS THEY EXPLICITLY WANT TO MAKE OR FELT SPARKED BY ═══════
${reactedBlock || '  (none yet)'}

═══════ THINGS THEY MARKED AS "OFF" (anti-taste — never centre an idea on these) ═══════
${offBlock || '  (none)'}

═══════ READING ═══════
${readingBlock || '  (none)'}

═══════ HIGHLIGHTS (sentences they actively flagged) ═══════
${highlightBlock || '  (none)'}

═══════ JUST SHOWN — titles already on screen or just regenerated away from. NEVER emit any of these or a near-paraphrase ═══════
${justShownBlock || '  (none)'}

═══════ OUTPUT (strict JSON, no markdown fences) ═══════
{
  "idea": <object> | null,
  "skip_reason": "<one short sentence; only when idea is null>"
}

When the pattern is real, the idea object is:
{
  "pattern": "ONE sentence in the user's frame, naming the through-line. ≤24 words. The wow line — what makes them say 'huh, that's me.' Concrete, not abstract.",
  "shape": "<one of: coalescing | recent_forgotten | reshape | extend — see below>",
  "title": "≤6 words. The project the pattern points to. Names the artefact or the action.",
  "pitch": "2 sentences. Sentence 1 = how the project breaks / honours / completes the pattern. Sentence 2 = what done looks like, in one observable test.",
  "why_now": "ONE sentence. The single most recent capture or completed project that proves the pattern is current, not historical.",
  "next_step": "ONE physical action they can do today (cut, drill, flash, commit a named file with named first content, drive, phone). NOT 'research,' 'plan,' 'sketch,' 'outline,' 'decide.'",
  "evidence": [
    { "kind": "memory|project_dormant|project|reading|highlight|list_item", "source_id": "...", "label": "...", "date": "YYYY-MM-DD", "excerpt": "verbatim substring of the source body shown above" }
  ],
  "confidence": <integer 0–100, see below>
}

SHAPE — pick the one that best matches which shape from the "Real shapes" list fired. The surface uses this to render a different eyebrow per shape so the user can tell at a glance what they're looking at:

  - coalescing       — Mode 1 NEW IDEA COALESCING. The user is quietly circling a new idea across multiple captures and you're naming it for the first time.
  - recent_forgotten — Mode 2a RECENT FORGOTTEN. A 3–16 week dormant project whose pickup move is now obvious from recent captures.
  - reshape          — Mode 2b LONG-DORMANT RESHAPE. A 4+ month dormant project that needs the version-for-who-they-are-now treatment.
  - extend           — Mode 3 EXTEND. A recent capture names a specific new direction for an existing active or dormant project.

If none of these match cleanly — for example the pattern is a recurring taste / drift / block that doesn't map onto a project pickup — use "coalescing" since the resulting project is a new artefact.

Evidence rules: 3–6 items. Each excerpt MUST be a verbatim substring of a body shown above (will be substring-checked; fabrications are dropped). Together the evidence proves the pattern.

CONFIDENCE — be honest. This number gates whether the home page surfaces the pattern as the prominent "there's something I want to show you" teaser, or just stores it in the queue for a button click. Calibrate to:

  90–100 — the pattern is undeniable, the project is the right one, the evidence is rock-solid. The user will say "huh, that's me" instantly.
  70–89  — solid pattern, solid project. Worth surfacing as the teaser.
  50–69  — real but not the wow. Better to sit in the queue than lead.
  0–49   — weak. Either return null with a skip_reason, or write the idea but mark it low so it doesn't lead.

Honest 60s are more useful than dishonest 80s. Inflated confidence is the failure mode.

If no real pattern is visible, return: { "idea": null, "skip_reason": "..." } and we'll lean on crossover. Silence is honest.`
}

function quarterKey(dateStr: string): string {
  if (!dateStr) return 'undated'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'undated'
  const q = Math.floor(d.getUTCMonth() / 3) + 1
  return `${d.getUTCFullYear()} Q${q}`
}

interface RawIdea {
  rank?: number
  rank_role?: string
  title?: string
  pitch?: string
  why_now?: string
  next_step?: string
  evidence?: Array<{ kind?: string; source_id?: string; label?: string; date?: string; excerpt?: string }>
}

const VALID_KINDS = new Set([
  'memory',
  'list_item',
  'project',
  'project_dormant',
  'reading',
  'highlight',
  'suggestion',
  'idea_engine',
])

/** Per-idea validation. Returns the idea on success, null when the model
 *  fabricated evidence ids, omitted required fields, or undershot the ≥2
 *  evidence floor. Caller chooses what to do with rank / dedup / seed_pair. */
function validateRawIdea(item: RawIdea, sourceLookup: Map<string, SourceRow>): ProjectIdea | null {
  if (!item.title || !item.pitch || !item.next_step || !item.why_now) return null
  if (!Array.isArray(item.evidence)) return null

  const evidence: IdeaEvidence[] = []
  const seenSources = new Set<string>()
  for (const e of item.evidence) {
    if (!e.source_id) continue
    // The prompt formats ids as `kind#uuid` so the model can keep types
    // and ids together visually. Two reasons we trust the prefix over
    // the model-supplied `kind` field:
    //   1. Models echo the prefix back in source_id reliably.
    //   2. Models conflate the evidence-kind set (memory/list_item/...)
    //      with the toolkit-kind set (SKILL/TOOL/MATERIAL/DORMANT) and
    //      put the wrong word in the kind field, dropping every item.
    // So: extract kind from prefix if present; fall back to the model
    // field only when there's no prefix.
    const rawId = e.source_id
    const hashIdx = rawId.indexOf('#')
    let kindFromPrefix: string | undefined
    let bareId = rawId
    if (hashIdx > 0) {
      kindFromPrefix = rawId.slice(0, hashIdx).toLowerCase()
      bareId = rawId.slice(hashIdx + 1)
    }
    const kind = kindFromPrefix && VALID_KINDS.has(kindFromPrefix)
      ? kindFromPrefix
      : (typeof e.kind === 'string' ? e.kind.toLowerCase() : '')
    if (!VALID_KINDS.has(kind)) continue

    // The model often truncates UUIDs to ~8 chars in its output (likely
    // imitating short-hash style from in-prompt examples). Accept any
    // prefix match — at 6+ chars UUIDs are unique within one user's
    // gather (~100 rows). Resolve to the full id for canonical storage.
    let resolvedId = bareId
    let real = sourceLookup.get(bareId)
    if (!real && bareId.length >= 6 && bareId.length < 36) {
      for (const key of sourceLookup.keys()) {
        if (key.startsWith(bareId)) {
          resolvedId = key
          real = sourceLookup.get(key)
          break
        }
      }
    }
    if (!real) continue // fabricated id
    if (seenSources.has(resolvedId)) continue // dedupe within an idea
    seenSources.add(resolvedId)

    const labelOut = (e.label ?? '').slice(0, 120) || real.label
    const dateOut = real.date || (e.date ?? '').slice(0, 32)
    const excerptOut = verifyOrReplaceExcerpt(e.excerpt ?? '', real.body)
    evidence.push({
      kind: kind as IdeaEvidence['kind'],
      // Persist the canonical full uuid (resolvedId) — the UI never
      // shows source_id, but storing the full form keeps later joins
      // / debugging sane regardless of how the model truncated.
      source_id: resolvedId,
      label: labelOut,
      date: dateOut,
      excerpt: excerptOut,
    })
  }
  // Be lenient (≥2) — better to ship a slightly thin idea than 0 ideas
  // because of strict validation. The UI labels "from N signals" so
  // small N is visible and self-correcting.
  if (evidence.length < 2) return null

  return {
    rank: typeof item.rank === 'number' ? item.rank : 1,
    title: item.title.trim().slice(0, 140),
    pitch: item.pitch.trim().slice(0, 800),
    why_now: item.why_now.trim().slice(0, 400),
    next_step: item.next_step.trim().slice(0, 400),
    evidence,
  }
}

interface RawSlot {
  pair_index?: number
  idea?: RawIdea | null
  skip_reason?: string
}

/** Locked-pairs response: `{ slots: [{ pair_index, idea | null, skip_reason }] }`.
 *  Each kept idea gets the seed_pair attached from the matching seed candidate
 *  so the next batch can enforce cooldown. */
function parseLockedSlots(raw: string, gathered: GatherResult, seeds: SeedCandidate[]): ProjectIdea[] {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') return []
  const slots = (payload as { slots?: RawSlot[] }).slots
  if (!Array.isArray(slots)) return []

  const sourceLookup = buildSourceLookup(gathered)
  const activeIds = new Set(gathered.active_projects.map(p => p.id))
  const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?|continue(\s+the)?)\b/i

  const out: ProjectIdea[] = []
  let nullCount = 0
  let invalidCount = 0
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object') continue
    if (!slot.idea) {
      nullCount++
      if (slot.skip_reason) console.log(`[project-ideas] slot ${slot.pair_index ?? '?'} skipped: ${truncate(slot.skip_reason, 200)}`)
      continue
    }
    const seed = typeof slot.pair_index === 'number' ? seeds[slot.pair_index] : undefined
    if (!seed) {
      console.warn(`[project-ideas] slot has invalid pair_index=${slot.pair_index}`)
      invalidCount++
      continue
    }
    const idea = validateRawIdea(slot.idea, sourceLookup)
    if (!idea) {
      invalidCount++
      continue
    }
    if (FINISH_RE.test(idea.title) && idea.evidence.some(e => activeIds.has(e.source_id))) {
      console.log(`[project-ideas] dropped idea "${idea.title}" — "finish/ship X" against active project (Keep Going dup)`)
      invalidCount++
      continue
    }
    out.push({ ...idea, seed_pair: seed.pair })
  }

  // Cross-batch cooldown is handled by the picker. Within-batch evidence
  // overlap can't happen any more — the picker already chose distinct
  // centres — but we still rank-renumber from the kept order.
  const final = out.map((idea, i) => ({ ...idea, rank: i + 1 }))
  console.log(`[project-ideas] locked-pair parse: ${final.length} kept, ${nullCount} null, ${invalidCount} invalid (of ${slots.length} slots)`)
  return final
}

/** Permissive single-idea response: `{ ideas: [...] }`. We derive a seed_pair
 *  from the validated evidence (lead centre-kind item × first arrival-kind
 *  item) so the row participates in the picker's cooldown the next time the
 *  permissive path fires — without this, regen on a sparse corpus kept
 *  re-emitting the same idea. The active-project / "finish X" filter still
 *  applies. */
function parsePermissive(raw: string, gathered: GatherResult): ProjectIdea[] {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') return []
  const ideasRaw = (payload as { ideas?: RawIdea[] }).ideas
  if (!Array.isArray(ideasRaw)) return []

  const sourceLookup = buildSourceLookup(gathered)
  const activeIds = new Set(gathered.active_projects.map(p => p.id))
  const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?|continue(\s+the)?)\b/i

  const out: ProjectIdea[] = []
  for (const item of ideasRaw) {
    const idea = validateRawIdea(item, sourceLookup)
    if (!idea) continue
    if (FINISH_RE.test(idea.title) && idea.evidence.some(e => activeIds.has(e.source_id))) {
      console.log(`[project-ideas] dropped idea "${idea.title}" — "finish/ship X" against active project (Keep Going dup)`)
      continue
    }
    const seed_pair = deriveSeedPairFromEvidence(idea.evidence)
    out.push(seed_pair ? { ...idea, seed_pair } : idea)
    if (out.length >= 1) break
  }
  return out.map((idea, i) => ({ ...idea, rank: i + 1 }))
}

/** Read-mode response: `{ idea: <obj> | null, skip_reason }`. Returns 0 or 1
 *  validated idea. The pattern field is required and non-empty when idea is
 *  present — that's the wow. Evidence is verified the same way as crossover.
 *  The active-project / "finish X" filter still applies. */
function parseRead(raw: string, gathered: GatherResult): ProjectIdea[] {
  const payload = robustJsonParse(raw)
  if (!payload || typeof payload !== 'object') return []
  const root = payload as { idea?: RawReadIdea | null; skip_reason?: string }
  if (!root.idea) {
    if (root.skip_reason) console.log(`[project-ideas] read skipped: ${truncate(root.skip_reason, 200)}`)
    return []
  }
  const item = root.idea
  if (!item.pattern || typeof item.pattern !== 'string' || item.pattern.trim().length < 12) {
    console.warn('[project-ideas] read dropped — pattern missing or too short')
    return []
  }
  const sourceLookup = buildSourceLookup(gathered)
  const base = validateRawIdea(item, sourceLookup)
  if (!base) {
    console.warn('[project-ideas] read dropped — failed base validation')
    return []
  }
  const activeIds = new Set(gathered.active_projects.map(p => p.id))
  const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?|continue(\s+the)?)\b/i
  if (FINISH_RE.test(base.title) && base.evidence.some(e => activeIds.has(e.source_id))) {
    console.log(`[project-ideas] read dropped "${base.title}" — "finish/ship X" against active project`)
    return []
  }
  // Confidence is honest-self-score 0–100 from the model. Clamp + default
  // to 50 (below threshold) when missing or invalid — better to under-show
  // than over-promise. The home auto-surfaces only when confidence >= 70.
  let confidence = 50
  if (typeof item.confidence === 'number' && Number.isFinite(item.confidence)) {
    confidence = Math.max(0, Math.min(100, Math.round(item.confidence)))
  }
  // Shape — the model's self-tag for which of the four Moment sub-shapes
  // fired. Default null when the model omits or returns an unknown value;
  // the UI gracefully falls back to the generic Read eyebrow.
  const VALID_SHAPES = new Set(['coalescing', 'recent_forgotten', 'reshape', 'extend'])
  const shape = typeof item.shape === 'string' && VALID_SHAPES.has(item.shape)
    ? (item.shape as 'coalescing' | 'recent_forgotten' | 'reshape' | 'extend')
    : null
  console.log(`[project-ideas] read produced "${base.title}" — confidence=${confidence}, shape=${shape ?? 'untagged'}`)
  return [{
    ...base,
    mode: 'read',
    pattern: item.pattern.trim().slice(0, 280),
    confidence,
    shape,
  }]
}

interface RawReadIdea extends RawIdea {
  pattern?: string
  confidence?: number
  shape?: string
}

const CENTRE_KINDS: ReadonlySet<CentreKind> = new Set(['project_dormant', 'project_active', 'memory'])
const ARRIVAL_KINDS: ReadonlySet<ArrivalKind> = new Set(['memory', 'reading', 'highlight'])

/** Best-effort SeedPair from a permissive idea's evidence. Lead item is the
 *  centre when its kind is centre-eligible; the first remaining item with an
 *  arrival-eligible kind (and a different source_id) is the arrival. Returns
 *  undefined when the evidence shape doesn't yield a valid pair — in that
 *  case the row is stored with seed_pair=null as before. */
function deriveSeedPairFromEvidence(evidence: IdeaEvidence[]): SeedPair | undefined {
  let centreIdx = -1
  for (let i = 0; i < evidence.length; i++) {
    if (CENTRE_KINDS.has(evidence[i].kind as CentreKind)) {
      centreIdx = i
      break
    }
  }
  if (centreIdx === -1) return undefined
  const centre = evidence[centreIdx]
  for (let j = 0; j < evidence.length; j++) {
    if (j === centreIdx) continue
    const a = evidence[j]
    if (a.source_id === centre.source_id) continue
    if (ARRIVAL_KINDS.has(a.kind as ArrivalKind)) {
      return {
        centre_kind: centre.kind as CentreKind,
        centre_id: centre.source_id,
        arrival_kind: a.kind as ArrivalKind,
        arrival_id: a.source_id,
      }
    }
  }
  return undefined
}

interface SourceRow {
  body: string
  date: string
  label: string
}

function buildSourceLookup(g: GatherResult): Map<string, SourceRow> {
  const m = new Map<string, SourceRow>()
  for (const r of g.memories) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.body}`.trim(), date: isoDate(r.created_at), label: 'voice note' })
  }
  for (const li of g.list_items) {
    m.set(li.id, { body: li.content, date: isoDate(li.created_at), label: li.list_title ? `${li.list_type} list — ${li.list_title}` : `${li.list_type} list` })
  }
  for (const p of g.active_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `project: ${p.title}` })
  }
  for (const p of g.dormant_projects) {
    m.set(p.id, { body: `${p.title} ${p.description ?? ''}`.trim(), date: isoDate(p.updated_at), label: `dormant project: ${p.title}` })
  }
  for (const r of g.reading) {
    m.set(r.id, { body: `${r.title ?? ''} ${r.excerpt ?? ''}`.trim(), date: isoDate(r.created_at), label: r.title ? `article: ${r.title}` : 'article' })
  }
  for (const h of g.highlights) {
    m.set(h.id, { body: h.quote, date: isoDate(h.created_at), label: h.article_title ? `highlight from ${h.article_title}` : 'highlight' })
  }
  for (const s of g.prior_suggestions) {
    m.set(s.id, { body: s.title, date: '', label: `suggestion: ${s.title}` })
  }
  for (const i of g.ie_ideas) {
    m.set(i.id, { body: `${i.title} ${i.description}`.trim(), date: '', label: `idea-engine: ${i.title}` })
  }
  return m
}

/**
 * If the LLM-supplied excerpt is a verbatim substring of the real source
 * body (whitespace-normalised), keep it. Otherwise fall back to the real
 * body, trimmed — the citation should never let the model put words in
 * the user's mouth.
 */
function verifyOrReplaceExcerpt(claimed: string, body: string): string {
  const normalisedBody = body.replace(/\s+/g, ' ').trim()
  const normalisedClaim = claimed.replace(/\s+/g, ' ').trim()
  if (normalisedClaim && normalisedClaim.length >= 8 && normalisedBody.toLowerCase().includes(normalisedClaim.toLowerCase())) {
    return normalisedClaim.slice(0, 220)
  }
  return truncate(normalisedBody, 220)
}

/**
 * Robust JSON parse with three salvage passes — Pro at 8000 tokens
 * shouldn't truncate often, but when it does we'd rather ship 2 ideas
 * than 0.
 */
function robustJsonParse(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '')
  // Pass 1: full parse
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  // Pass 2: find the last balanced `}` and try parsing through there
  const lastBrace = trimmed.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(trimmed.slice(0, lastBrace + 1)) } catch { /* fall through */ }
  }
  // Pass 3: extract just the "ideas" array if we can locate a clean
  // closing `]` after `"ideas":` — covers truncation in the trailing
  // metadata after the array.
  const ideasIdx = trimmed.indexOf('"ideas"')
  if (ideasIdx >= 0) {
    const arrStart = trimmed.indexOf('[', ideasIdx)
    const arrEnd = trimmed.lastIndexOf(']')
    if (arrStart > 0 && arrEnd > arrStart) {
      try {
        const arr = JSON.parse(trimmed.slice(arrStart, arrEnd + 1))
        return { ideas: arr }
      } catch { /* fall through */ }
    }
  }
  return null
}

function isoDate(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function truncate(s: string, n: number): string {
  if (!s) return ''
  const trimmed = s.trim().replace(/\s+/g, ' ')
  return trimmed.length <= n ? trimmed : trimmed.slice(0, n - 1) + '…'
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const it of items) {
    const k = key(it)
    const arr = m.get(k) ?? []
    arr.push(it)
    m.set(k, arr)
  }
  return m
}
