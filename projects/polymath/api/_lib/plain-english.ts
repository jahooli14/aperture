/**
 * Plain-English mantra — single source of truth for the voice rules.
 *
 * Every AI prompt that produces user-facing copy should interpolate
 * PLAIN_ENGLISH_RULES into its system message. The detector functions are
 * for post-generation checks (used by intersection-critic and similar).
 *
 * If you find yourself adding new banned phrases or anti-examples in a
 * prompt file, add them here instead and let every prompt benefit.
 */

/** Words the model keeps slipping in despite instructions. Word-boundary match. */
export const BANNED_WORDS: readonly string[] = [
  // Corporate / consultant
  'leverage', 'leveraging', 'leveraged', 'synergy', 'synergies',
  'unlock', 'unlocks', 'unlocking', 'unlocked',
  'high-impact', 'feature-rich', 'experiential',
  'actualize', 'actualization', 'actualizes',
  'ideate', 'ideation',
  'transformative', 'transformational',
  'culmination', 'culminate', 'culminates',
  // Tech-Twitter
  'narrative substrate', 'soundscape', 'soundscapes',
  'psychological defense', 'psychological defenses',
  // LLM jargon
  'stochastic', 'ontological', 'ontologies', 'ontology',
  'epistemological', 'epistemology', 'epistemologies',
  'heuristic', 'heuristics', 'emergent',
  'bifurcation', 'isomorphism', 'bisociation', 'exaptation', 'orthogonal',
  'teleological', 'dialectical', 'paradigm', 'paradigmatic', 'topology',
  // Coach-voice
  'journey', 'essence', 'reimagined', 'evolved', 'multifaceted',
  'preoccupation', 'preoccupations',
  'interrogate', 'interrogates', 'interrogating',
  // Context-Engine specific cringe seen in the wild
  'through-line', 'throughline', 'thread of', 'central thread',
  'creative ontology', 'foundational premise', 'foundational premises',
  // Drift seen in project ideas + bedtime output
  'intentionality', 'discipline', 'practice of',
  'first principles', 'mental model', 'mental models',
  'creative practice', 'creative tension',
  'lean into', 'leaned into', 'leaning into',
  'double down', 'doubled down', 'doubling down',
  'sit with', 'sitting with',
  'embodied', 'embodiment',
  'arc of', 'the arc', 'narrative arc',
  'rich', 'richness',
  'curate', 'curated', 'curation', 'curatorial',
]

/** Phrases / patterns that still slip through even after BANNED_WORDS. */
export const CRINGE_PATTERNS: readonly RegExp[] = [
  /\bmassive flex\b/i,
  /\b(humble|stealth|flex) brag\b/i,
  /\bdeeply (fascinated|obsessed|interested|committed)\b/i,
  /\b(truly|deeply|profoundly) (beautiful|meaningful|significant|important)\b/i,
  /\b(at the intersection of|the sweet spot between)\b/i,
  /\bnext-level\b/i,
  /\bgame-?changer\b/i,
  /\bcreative momentum\b/i,
  /\bhigh-impact transition\b/i,
  // Newer drift seen in the Context Engine output
  /\binternally (in)?consistent\b/i,
  /\bcore assumption embedded\b/i,
  /\b(constraint-based|structure-based)\s+\w+\b/i,
  /\binevitable in retrospect\b/i,
  /\bcouldn't see from inside\b/i,
  /\bthe moment when [a-z\s]+ makes [a-z\s]+ possible\b/i,
  // Idea-generator drift
  /\b(the )?practice of [a-z]+ing\b/i,
  /\bsomething (deeper|bigger|more) than\b/i,
  /\bthe (tension|dance|interplay) between\b/i,
  /\bwhat (it means|it looks like) (to|when)\b/i,
  /\byour relationship (with|to)\b/i,
  /\b(quiet|loud) confidence\b/i,
  /\bthe shape of\b/i,
  /\bsmall but mighty\b/i,
]

/** Title-only patterns — abstract -ness nouns + flowery adjectives. */
export const TITLE_CRINGE_PATTERNS: readonly RegExp[] = [
  /\b(profound|unconventional|radical|ultimate|masterful|brilliant|exquisite)\b/i,
  /\b\w+ness\b/i,
  /\bin (mundanity|liminality|otherness)\b/i,
]

/**
 * The mantra in prose form. Drop into a prompt with template strings.
 *
 * Keep this short and concrete. Long mantras get ignored by the model.
 */
export const PLAIN_ENGLISH_RULES = `Plain English. Talk like a friend who's paying attention — not a consultant pitching.
- Real words people say. NEVER use: leverage, synergies, unlock, soundscapes, narrative substrate, feature-rich, journey, essence, reimagined.
- One idea per sentence. Short sentences.
- Concrete nouns. "Logic Pro trial expired" beats "your reliance on the 90-day trial."
- No scare-quoted invented terms ("friction-over-function," "blind-edit").
- If you can't say it plainly, stay silent.
BAD: "Your multifaceted engagement with constraint-based creation unlocks transformative potential."
GOOD: "You keep coming back to limits as a creative tool. This project fits that."`

/**
 * Quick post-generation check. Returns the list of violations (empty = clean).
 */
export function findVoiceViolations(text: string): string[] {
  const violations: string[] = []
  for (const w of BANNED_WORDS) {
    if (new RegExp(`\\b${w}\\b`, 'i').test(text)) {
      violations.push(`banned word: "${w}"`)
    }
  }
  for (const re of CRINGE_PATTERNS) {
    if (re.test(text)) violations.push(`cringe phrase: ${re.source}`)
  }
  return violations
}

export function findTitleViolations(text: string): string[] {
  const base = findVoiceViolations(text)
  for (const re of TITLE_CRINGE_PATTERNS) {
    if (re.test(text)) base.push(`title cringe: ${re.source}`)
  }
  return base
}
