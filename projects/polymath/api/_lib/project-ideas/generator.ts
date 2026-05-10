/**
 * Generator — writes up 0–3 project ideas from seed pairs the picker has
 * already chosen.
 *
 * Architectural split (the fix for "two runs gave the same idea twice"):
 *   1. seed-picker enumerates and scores (centre × arrival) pairs in code,
 *      enforcing a 12-week cooldown so the same convergence can't re-fire.
 *   2. THIS module gives the LLM those locked pairs and asks only "is this
 *      a real missing-piece match? if yes, write the idea; if no, null."
 *   3. Picking moved out of the LLM means same-corpus runs no longer
 *      collapse onto the same convergence — different pairs per batch.
 *
 * The LLM still does the things only it can do: voice, framing, calibrating
 * whether a forced wedge ("Catch-22 logic-filter for Aperture") should be
 * killed. Server-side evidence verification stays — the model can't put
 * fabricated quotes in the user's mouth.
 *
 * Permissive fallback: when the picker returns 0 candidates (no recent
 * arrivals or no centres) AND the user explicitly clicked "show me ideas",
 * fall back to the old single-idea permissive prompt so the button isn't
 * dead. Cron stays strict — silence is acceptable on cron.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import { pickSeedPairs, type SeedCandidate } from './seed-picker.js'
import type { ArrivalKind, CentreKind, GatherResult, GenerationResult, IdeaEvidence, ProjectIdea, SeedPair } from './types.js'

const MIN_SIGNALS = 8

export interface GenerateOptions {
  /** force=true falls back to the permissive prompt when the seed-pair
   *  pass returns nothing. Used by the manual "show me ideas" button —
   *  the user explicitly asked, so silence is not an acceptable reply.
   *  The cron path stays strict and is allowed to return empty. */
  force?: boolean
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
  console.log(`[project-ideas] seed picker chose ${seeds.length} pair(s)${seeds.length ? `: ${seeds.map(s => `${s.centre.kind}#${s.centre.id.slice(0, 8)}×${s.arrival.kind}#${s.arrival.id.slice(0, 8)} (score=${s.score.toFixed(2)}, overlap=${s.topical_overlap.toFixed(2)})`).join('; ')}` : ''}`)

  if (seeds.length > 0) {
    const ideas = await runLockedPairs(gathered, seeds)
    if (ideas.length > 0) return { ideas, attempts: 1 }
  }

  if (opts.force) {
    console.log(`[project-ideas] seed-pair pass produced 0; force=true, falling back to permissive`)
    const fallback = await runPermissive(gathered)
    if (fallback.length > 0) return { ideas: fallback, attempts: 2 }
  }

  return { ideas: [], reason: 'parse_failure', attempts: opts.force ? 2 : 1 }
}

async function runLockedPairs(gathered: GatherResult, seeds: SeedCandidate[]): Promise<ProjectIdea[]> {
  const prompt = buildLockedPrompt(gathered, seeds)
  console.log(`[project-ideas] locked-pairs prompt: ${prompt.length} chars; pairs=${seeds.length}`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      maxTokens: 16000,
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

async function runPermissive(gathered: GatherResult): Promise<ProjectIdea[]> {
  const prompt = buildPermissivePrompt(gathered)
  console.log(`[project-ideas] permissive prompt: ${prompt.length} chars`)

  const t0 = Date.now()
  let raw: string
  try {
    raw = await generateText(prompt, {
      model: MODELS.FLASH_CHAT,
      maxTokens: 8000,
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
    ...g.prior_ideas.built.map(t => `  · BUILT: "${t.title}"${t.feedback ? ` — note: ${truncate(t.feedback, 120)}` : ''}`),
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

Plain English. Short sentences. Words people actually say.
NEVER use: "leveraging," "synergies," "soundscapes," "narrative substrate," "feature-rich," "psychological defenses," "high-impact transition," "creative momentum," "experiential."
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
    ...g.prior_ideas.built.map(t => `  · BUILT: "${t.title}"`),
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
