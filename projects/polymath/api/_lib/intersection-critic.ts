/**
 * Intersection Critic — quality gate for generated crossover cards.
 *
 * The writer prompt in intersection-engine.ts is strict, but Gemini still
 * ships cards that violate its own rules: hooks that open with "Your" or
 * "I'm looking at", first_steps like "Pick one from your X list", pattern
 * and experiment that say the same thing twice.
 *
 * This module is the server-side safety net. Every candidate passes through
 * two gates:
 *
 *   1. validateCandidate — deterministic regex checks. Cheap, zero
 *      latency, no false negatives on the rules it covers.
 *   2. critiqueCandidate — one Flash call per survivor. Catches the subtler
 *      failures a regex can't see (horoscope-grade generalities, mashups
 *      dressed as observations).
 *
 * `auditCandidate` runs both in sequence and short-circuits: if the
 * deterministic pass rejects, we skip the LLM round-trip.
 *
 * False positives here are cheaper than false negatives. Users prefer two
 * sharp cards over five mediocre ones; an over-zealous critic is a feature.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'

export interface CandidateFields {
  crossover_title?: string
  hook?: string
  the_pattern?: string
  the_experiment?: string
  first_steps?: string[]
}

export interface AuditResult {
  ok: boolean
  reasons: string[]
}

// --- Deterministic rules --------------------------------------------------

/**
 * Opening phrases that mark a card as a product pitch instead of an
 * observation. Any hook or pattern starting with one of these gets rejected.
 * Mirrors the BANNED OPENING PHRASES block in the writer prompt.
 */
const BANNED_OPENERS: RegExp[] = [
  /^if you (put|combine|mix|merge|mash)/i,
  /^you could (build|write|make|create|design|launch|ship)/i,
  /^you should\b/i,
  /^you've basically\b/i,
  /^imagine (a|an|the)\b/i,
  /^picture (a|an|the)\b/i,
  /^what if you\b/i,
  /^together they\b/i,
  /^this lets you\b/i,
  /^i('m| am) (looking at|seeing|noticing)\b/i,
  /^it feels like\b/i,
  /^here's (an|the) idea\b/i,
]

/**
 * Hook must start with "You" + verb, naming what the person is ALREADY
 * doing. "Your" (possessive), "You're" (state, not action), and conditional
 * modals ("You could / should / would / might") all miss the point.
 */
function checkHookOpening(hook: string): string | null {
  const trimmed = hook.trim()
  if (!trimmed) return 'hook is empty'
  if (/^your\b/i.test(trimmed)) return 'hook starts with "Your" (possessive) — must start with "You" + verb'
  if (/^you're\b/i.test(trimmed)) return 'hook starts with "You\'re" — must start with "You" + present-tense verb'
  if (/^you (could|should|would|might|may|can|will)\b/i.test(trimmed)) {
    return 'hook uses a conditional ("You could/should/...") — must name what they\'re already doing'
  }
  if (!/^you\b/i.test(trimmed)) return 'hook must start with "You" + verb'
  return null
}

/**
 * Shorthand detection for first_steps. The writer prompt warns against
 * "Pick one from your X list" but the model ships it anyway when it can't
 * be bothered to quote a specific source item. Caught server-side so the
 * model has to do the work.
 */
const SHORTHAND_PATTERNS: RegExp[] = [
  /\bfrom your [\w-]+ (list|notes|collection|types|items|ideas|stuff|things|set|file|folder)\b/i,
  /\b(pick|choose|select|grab) (one|a|an|a single)( specific)? (\w+)( from your)?\s*$/i,
  /\bone specific \w+\b/i,
  /\ba single \w+ (from|that|which)\b/i,
]

function checkShorthand(step: string): string | null {
  for (const re of SHORTHAND_PATTERNS) {
    if (re.test(step)) return `shorthand — no specific source item named`
  }
  return null
}

/**
 * Jargon words the writer prompt explicitly bans. Worth checking server-side
 * because the model still slips them in, especially under temperature 1.0.
 */
const BANNED_WORDS: string[] = [
  'stochastic', 'ontological', 'epistemological', 'heuristic', 'emergent',
  'bifurcation', 'isomorphism', 'bisociation', 'exaptation', 'orthogonal',
  'teleological', 'dialectical', 'paradigm', 'paradigmatic', 'topology',
  'actualize', 'ideate', 'leverage', 'synergy', 'synergies',
]

/**
 * Cringe phrases that survived the first prompt tightening. Mostly marketing
 * copy energy ("massive flex"), flattery verbs ("deeply fascinated"), and
 * LLM tells that make the output sound like a LinkedIn post.
 */
const CRINGE_PATTERNS: RegExp[] = [
  /\bmassive flex\b/i,
  /\b(humble|stealth|flex) brag\b/i,
  /\bdeeply (fascinated|obsessed|interested|committed)\b/i,
  /\b(truly|deeply|profoundly) (beautiful|meaningful|significant|important)\b/i,
  /\b(at the intersection of|the sweet spot between)\b/i,
  /\bnext-level\b/i,
  /\bgame-?changer\b/i,
  /\bunlock(s|ing)? (new|hidden|deeper)\b/i,
]

/**
 * Titles should name the mechanism concretely. Flowery abstract nouns
 * ("profound meaning in mundanity") and -ness endings ("strangeness",
 * "sameness") are the marker of an LLM reaching for poetry.
 */
const TITLE_CRINGE_PATTERNS: RegExp[] = [
  /\b(profound|unconventional|radical|ultimate|masterful|brilliant|exquisite)\b/i,
  /\b\w+ness\b/i,
  /\bin (mundanity|liminality|otherness)\b/i,
]

function checkField(text: string, fieldName: string): string[] {
  const reasons: string[] = []
  const lower = text.toLowerCase()
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(lower)) {
      reasons.push(`${fieldName} uses banned word "${w}"`)
    }
  }
  for (const re of CRINGE_PATTERNS) {
    if (re.test(text)) reasons.push(`${fieldName} uses cringe phrase (${re.source})`)
  }
  return reasons
}

/**
 * Rough paraphrase detector. If the_pattern and the_experiment share most
 * content words, the model restated one as the other instead of giving two
 * different jobs to two different fields.
 *
 * Threshold tuned conservatively — real pairs that happen to share 2-3
 * project names shouldn't trip it, but "things drift over time" / "write a
 * scene about drifting" will.
 */
/** Crude stemmer — strips common English suffixes so "drift", "drifts",
 * "drifted" and "drifting" all collapse to the same token. Good enough for
 * paraphrase detection; we're not doing linguistics. */
function stem(word: string): string {
  const suffixes = ['ations', 'ation', 'ingly', 'ings', 'ing', 'ies', 'ied', 'ers', 'ers', 'est', 'ers', 'ness', 'ment', 'ed', 'es', 'er', 'ly', 's']
  for (const suf of suffixes) {
    if (word.length > suf.length + 2 && word.endsWith(suf)) {
      return word.slice(0, word.length - suf.length)
    }
  }
  return word
}

function jaccardOverlap(a: string, b: string): number {
  const tokens = (s: string) => new Set(
    s.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4)
      .map(stem)
  )
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  const inter = new Set([...ta].filter(w => tb.has(w)))
  const union = new Set([...ta, ...tb])
  return inter.size / union.size
}

export function validateCandidate(c: CandidateFields): AuditResult {
  const reasons: string[] = []
  const title = (c.crossover_title || '').trim()
  const hook = (c.hook || '').trim()
  const pattern = (c.the_pattern || '').trim()
  const experiment = (c.the_experiment || '').trim()
  const steps = (c.first_steps || []).map(s => (s || '').trim()).filter(Boolean)

  // Required fields
  if (!title) reasons.push('missing crossover_title')
  if (!hook) reasons.push('missing hook')
  if (!pattern) reasons.push('missing the_pattern')
  if (!experiment) reasons.push('missing the_experiment')
  if (steps.length < 3) reasons.push(`only ${steps.length} first_steps (need 3)`)

  // Hook opening format
  const hookErr = checkHookOpening(hook)
  if (hookErr) reasons.push(hookErr)

  // Banned openers on hook and pattern
  for (const re of BANNED_OPENERS) {
    if (re.test(hook)) reasons.push(`hook starts with banned opener (${re.source})`)
    if (re.test(pattern)) reasons.push(`the_pattern starts with banned opener (${re.source})`)
  }

  // Per-step checks
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const shortErr = checkShorthand(step)
    if (shortErr) reasons.push(`first_steps[${i + 1}] ${shortErr}: "${step}"`)
    const wordCount = step.split(/\s+/).filter(Boolean).length
    if (wordCount < 6) reasons.push(`first_steps[${i + 1}] too short (${wordCount} words)`)
    if (wordCount > 22) reasons.push(`first_steps[${i + 1}] too long (${wordCount} words)`)
  }

  // Jargon + cringe across every text field
  reasons.push(...checkField(title, 'title'))
  reasons.push(...checkField(hook, 'hook'))
  reasons.push(...checkField(pattern, 'the_pattern'))
  reasons.push(...checkField(experiment, 'the_experiment'))
  for (let i = 0; i < steps.length; i++) {
    reasons.push(...checkField(steps[i], `first_steps[${i + 1}]`))
  }

  // Title-specific
  for (const re of TITLE_CRINGE_PATTERNS) {
    if (re.test(title)) reasons.push(`title uses flowery phrase (${re.source})`)
  }
  const titleWords = title.split(/\s+/).filter(Boolean).length
  if (titleWords > 7) reasons.push(`title too long (${titleWords} words, target 3-6)`)

  // Pattern vs experiment paraphrase
  if (pattern && experiment) {
    const overlap = jaccardOverlap(pattern, experiment)
    if (overlap > 0.55) {
      reasons.push(`the_pattern and the_experiment overlap heavily (Jaccard=${overlap.toFixed(2)})`)
    }
  }

  return { ok: reasons.length === 0, reasons }
}

// --- LLM critic -----------------------------------------------------------

/**
 * One Flash call per candidate that survived deterministic checks. Asks the
 * critic to spot the failures the writer fooled itself about: disguised
 * mashups, horoscope-grade generalities, unfalsifiable flattery.
 *
 * Output is a single word verdict + one-line reason so the call stays cheap.
 */
export async function critiqueCandidate(c: CandidateFields): Promise<AuditResult> {
  const prompt = `You are a sharp critic reviewing one card before it ships to the user. Your job is to catch failures the writer fooled itself about.

CARD:
Title: ${c.crossover_title || ''}
Hook: ${c.hook || ''}
The pattern: ${c.the_pattern || ''}
To try: ${c.the_experiment || ''}
First steps:
${(c.first_steps || []).map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

REJECT the card if ANY of these are true:

1. MASHUP IN DISGUISE. The card only makes sense as "take A and combine it with B to make AB". A true observation would still land even if the user dropped one of the projects.

2. HOROSCOPE. The pattern applies to most creative people, not specifically THIS person. "You use tools to make art" is a horoscope. "You hide philosophy inside daily routines, in your sandwich book and your postman story" is specific.

3. FLATTERY, NOT OBSERVATION. The card tells the user how deep / fascinating / brilliant they are, without naming a specific behaviour they could plausibly disagree with. A good observation feels slightly uncomfortable.

4. PATTERN = EXPERIMENT. The "to try" just restates the pattern with a verb in front.

5. VAGUE FIRST STEPS. Any step could apply to a different project without changing a word.

6. CRINGE PHRASING. "Massive flex", "deeply fascinated", "at the intersection of", "truly beautiful" — any marketing copy tone.

Respond with plain JSON only, no markdown:
{"verdict": "PASS" | "REJECT", "reason": "one short sentence if REJECT, empty string if PASS"}`

  try {
    const raw = await generateText(prompt, {
      model: MODELS.DEFAULT_CHAT,
      responseFormat: 'json',
      temperature: 0.2,
      maxTokens: 200,
    })
    const parsed = JSON.parse(raw) as { verdict?: string; reason?: string }
    if (parsed.verdict === 'REJECT') {
      return { ok: false, reasons: [`critic: ${parsed.reason || 'rejected'}`] }
    }
    return { ok: true, reasons: [] }
  } catch (err) {
    // Critic failures shouldn't drop an otherwise-valid card. If Flash is
    // down or returns garbage, fall open — the deterministic pass already
    // did the strict rule enforcement.
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[intersection-critic] critic call failed, falling open:', message)
    return { ok: true, reasons: [] }
  }
}

/**
 * Combined audit: deterministic pass first (free), then LLM critic only on
 * survivors. Caller decides what to do with the result — typically drop the
 * candidate and log the reasons.
 */
export async function auditCandidate(c: CandidateFields): Promise<AuditResult> {
  const rule = validateCandidate(c)
  if (!rule.ok) return rule
  const critic = await critiqueCandidate(c)
  return critic
}

// --- SPARK schema (runSynthesis) -----------------------------------------
//
// SPARK cards use a different shape: title + description + reasoning prose.
// Same failure modes still apply — first-person observer voice ("I'm looking
// at your..."), mashup framing ("directly combines A with B"), cringe copy
// ("massive flex"), horoscope-grade generalities.

export interface SparkFields {
  title?: string
  description?: string
  reasoning?: string
}

/**
 * Reasoning must OPEN with what the writer noticed, in the person's own
 * voice — the prompt in synthesis.ts already says "must open with what you
 * noticed, not what they should do". This enforces it server-side.
 */
function checkReasoningOpening(reasoning: string): string | null {
  const trimmed = reasoning.trim()
  if (!trimmed) return 'reasoning is empty'
  if (/^i('m| am) (looking at|seeing|noticing|reading)\b/i.test(trimmed)) {
    return 'reasoning opens with first-person observer voice ("I\'m looking at...")'
  }
  if (/^it (feels like|seems like|looks like) you\b/i.test(trimmed)) {
    return 'reasoning opens with hedged observer voice ("It feels like you...")'
  }
  if (/^(imagine|picture) (a|an|the|you)\b/i.test(trimmed)) {
    return 'reasoning opens with hypothetical ("Imagine...", "Picture...")'
  }
  if (/^here's (an|the|what)\b/i.test(trimmed)) {
    return 'reasoning opens with "Here\'s..." — state the observation directly'
  }
  if (/^(so|okay|alright|now),?\b/i.test(trimmed)) {
    return 'reasoning opens with filler word'
  }
  return null
}

export function validateSpark(s: SparkFields): AuditResult {
  const reasons: string[] = []
  const title = (s.title || '').trim()
  const description = (s.description || '').trim()
  const reasoning = (s.reasoning || '').trim()

  if (!title) reasons.push('missing title')
  if (!description) reasons.push('missing description')
  if (!reasoning) reasons.push('missing reasoning')

  // Reasoning opening — first-person / hedged / hypothetical all rejected.
  const openErr = checkReasoningOpening(reasoning)
  if (openErr) reasons.push(openErr)

  // Banned mashup openers — reasoning should be an observation, not a pitch.
  for (const re of BANNED_OPENERS) {
    if (re.test(reasoning)) reasons.push(`reasoning starts with banned opener (${re.source})`)
    if (re.test(description)) reasons.push(`description starts with banned opener (${re.source})`)
  }

  // Jargon + cringe across every text field.
  reasons.push(...checkField(title, 'title'))
  reasons.push(...checkField(description, 'description'))
  reasons.push(...checkField(reasoning, 'reasoning'))

  // Mashup-phrase detector specific to SPARK — "directly combines X with Y"
  // was the telltale on the "penrose portfolio website" card.
  const MASHUP_TELLS: RegExp[] = [
    /\bdirectly combines? (your|the)\b/i,
    /\bmash(es|ed|ing)? (together|up)\b/i,
    /\b(ties|brings|pulls) (your|the) (\w+ )?(work|projects?|ideas?) together\b/i,
    /\bfuses? (your|the)\b/i,
  ]
  for (const re of MASHUP_TELLS) {
    if (re.test(reasoning)) reasons.push(`reasoning uses mashup tell (${re.source})`)
    if (re.test(description)) reasons.push(`description uses mashup tell (${re.source})`)
  }

  // Title rules — mirror INSIGHT deck.
  for (const re of TITLE_CRINGE_PATTERNS) {
    if (re.test(title)) reasons.push(`title uses flowery phrase (${re.source})`)
  }
  const titleWords = title.split(/\s+/).filter(Boolean).length
  if (titleWords > 7) reasons.push(`title too long (${titleWords} words, target 3-6)`)

  // Description <> reasoning paraphrase — if the reasoning just restates the
  // description with more adjectives, it isn't pulling its weight.
  if (description && reasoning) {
    const overlap = jaccardOverlap(description, reasoning)
    if (overlap > 0.6) {
      reasons.push(`description and reasoning overlap heavily (Jaccard=${overlap.toFixed(2)})`)
    }
  }

  return { ok: reasons.length === 0, reasons }
}

/**
 * Flash critic for SPARK — shorter prompt since the card has fewer fields.
 * Same failure modes as INSIGHT though, so the criteria translate directly.
 */
export async function critiqueSpark(s: SparkFields): Promise<AuditResult> {
  const prompt = `You are a sharp critic reviewing one project suggestion card before it ships to the user. Your job is to catch failures the writer fooled itself about.

CARD:
Title: ${s.title || ''}
Description: ${s.description || ''}
Reasoning: ${s.reasoning || ''}

REJECT the card if ANY of these are true:

1. MASHUP IN DISGUISE. The reasoning only makes sense as "combine A and B into AB". A real observation would still land even without one of the sources.

2. HOROSCOPE. The reasoning applies to most creative people, not specifically THIS person. Every sentence should name something specific from their notes.

3. FIRST-PERSON OBSERVER. The reasoning reads like a consultant narrating themselves reading notes ("I'm looking at...", "It feels like you..."). The user doesn't need a narrator — just the observation.

4. MARKETING COPY. "Massive flex", "deeply fascinated", "at the intersection of", "truly beautiful" — any tone that belongs in a pitch deck.

5. FLATTERY WITHOUT SPECIFICS. The card tells the user they're deep / brilliant / obsessed without naming the specific behaviour.

Respond with plain JSON only, no markdown:
{"verdict": "PASS" | "REJECT", "reason": "one short sentence if REJECT, empty string if PASS"}`

  try {
    const raw = await generateText(prompt, {
      model: MODELS.DEFAULT_CHAT,
      responseFormat: 'json',
      temperature: 0.2,
      maxTokens: 200,
    })
    const parsed = JSON.parse(raw) as { verdict?: string; reason?: string }
    if (parsed.verdict === 'REJECT') {
      return { ok: false, reasons: [`critic: ${parsed.reason || 'rejected'}`] }
    }
    return { ok: true, reasons: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[intersection-critic] SPARK critic call failed, falling open:', message)
    return { ok: true, reasons: [] }
  }
}

export async function auditSpark(s: SparkFields): Promise<AuditResult> {
  const rule = validateSpark(s)
  if (!rule.ok) return rule
  return critiqueSpark(s)
}
