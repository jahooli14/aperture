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
  // Mind-reading: the app telling the user what they're feeling or dodging.
  /\bare you (avoiding|resisting|putting off|scared of|afraid of)\b/i,
  // Both forms. "you're avoiding" was blocked and "you are avoiding" was
  // not, which is the same accusation with an apostrophe missing.
  /\byou('| a)?re (avoiding|resisting|procrastinating|stalling)\b/i,
  /\b(he|she|they|the user) (is|are) (avoiding|resisting|procrastinating|stalling)\b/i,
  /\bwhat'?s really (stopping|holding) you\b/i,
  /\bcouldn't see from inside\b/i,
  /\bthe moment when [a-z\s]+ makes [a-z\s]+ possible\b/i,
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
- NEVER guess at their state of mind. You cannot see whether they are avoiding, resisting, procrastinating, afraid or stuck, and saying so reads as an accusation from something with no standing to make one. Talk about the work, not the person.
- If you can't say it plainly, stay silent.
BAD: "Is that actually the right next move, or are you avoiding the hard part?"
GOOD: "Does that still need doing, or has it moved on?"
BAD: "Your multifaceted engagement with constraint-based creation unlocks transformative potential."
GOOD: "You keep coming back to limits as a creative tool. This project fits that."`

/**
 * Extra rules for prompts that write ACTIONS -- a session step, a task on
 * the spine, a move to try -- as opposed to prose about a project.
 *
 * This is a different failure from the one PLAIN_ENGLISH_RULES catches.
 * That one is about pretension ("multifaceted engagement with
 * constraint-based creation"). This one is about opacity: craft shorthand
 * that is perfectly ordinary to someone in the trade and meaningless to
 * the person reading it at 9pm. "Re-record verse two, don't comp yet" is
 * plain, short, concrete -- and useless if you don't happen to know that
 * comping means joining the best bits of several takes together.
 *
 * BANNED_WORDS can't enumerate this: every craft has its own ("comp",
 * "bounce", "gesso", "key the surface", "kerf", "proof", "block in"), and
 * the same word is fine when the user says it themselves. So the rule is
 * a test rather than a list -- could you do this if you'd never done it
 * before? -- with the corpus as the arbiter of which shorthand is theirs.
 *
 * A step you have to decode is worse than no step: it stops the hour
 * before it starts, which is the exact cost this app exists to remove.
 *
 * The second half is the balance between thematic and procedural. A step
 * that is all procedure ("feed the rewrite comments to Claude") tells you
 * how to work and not what you're making, so you sit down and still have
 * to decide what the hour is about. A step that is all theme ("explore
 * slowing down") has no move in it. Every step names both: the part of
 * the work, in the user's words, and the thing you do to it.
 */
export const CLEAR_STEP_RULES = `Every step has to be doable without decoding it.
- Say what to physically DO. Someone who has never done this before should be able to follow it.
- Craft shorthand is only allowed if that exact word appears in the evidence above, in their words. Otherwise say the long version.
- No abbreviations the evidence doesn't use.
BAD:  "Re-record verse two, don't comp yet." -- "comp" is studio shorthand and nothing above uses it.
GOOD: "Record verse two three times through. Don't join the best bits together yet."

Every step names WHAT part of the work it's on and the MOVE you make on it.
- The what comes from the evidence, in their words: the chapter, the scene, the track, the argument, the idea it's about.
- The move is the thing you physically do to it: write, rewrite, cut, record, send.
- Only the move is a chore. It says how to work, not what gets made. BAD: "Feed the rewrite comments to the AI." -- which comments, on which part, to end up with what?
- Only the what is a mood. It names a subject and no action. BAD: "Explore the theme of slowing down."
- GOOD (if the notes mention the walking chapter and the editor's notes): "Rewrite the walking chapter's opening using the editor's notes on pace."
- A tool or app is part of the how. Name it only if the evidence does, and never let it be the whole step.
- If the evidence names no part of the work, the move alone is fine. Never invent a chapter, scene or theme to fill the gap.`

/**
 * How a creative step should sound. The failure isn't bad steps, it's
 * project-manager steps: "Research reference tracks", "Define palette",
 * "Source materials, sketch concepts". That's planning language, it reads
 * like homework, and nobody with Ableton or a sketchbook open goes back
 * to a phone to check it. A step that gets used is one move in the
 * medium's own verbs, on a thing the project actually has, with a clear
 * point where you can stop. Shared by the spine, the first cut and the
 * session split.
 */
export const CREATIVE_MOVE_RULES = `Write every step the way you'd say it to someone with the work already open in front of them.
- Use the verbs of the medium: play, loop, cut, sketch, paint, record, bounce, write, sand, glue, print. Not the verbs of a project manager.
- Name the real thing it's done to, from the notes: the vocal chop, the second verse, the pole, the last bounce. Never "materials", "concepts", "assets", "references" or "ideas" as the object.
- One move, not a phase. If it would take a whole afternoon to even start, it's a phase.
BAD:  "Research reference tracks" / "Define the palette" / "Source materials and sketch concepts"
      -- planning language. Reads like homework, and nobody at the easel goes back to a list for it.
GOOD: "Play the last bounce once and say one sentence about what's wrong with it"
GOOD: "Sketch the pole three times in pencil, ten minutes, no rubbing out"`

/**
 * The first move of a sitting is special: it's the one that has to get
 * someone from "opened the app" to "working" in the first five minutes.
 * So it's small, and it says when it's finished -- "done when" is what
 * lets you stop without wondering whether you did enough.
 */
export const FIRST_MOVE_RULES = `The FIRST move is the one that gets them working in the next five minutes.
- Under ten minutes. Smaller than feels useful. Starting is the hard part.
- Ends with "Done when ..." and something they could check: it loops without wincing, three sketches exist, the paragraph is written. Never "until you're happy with it".
- Keep the whole line under 110 characters.
BAD:  "Work on the drop"  -- no move, no end.
GOOD: "Loop bars 9-12 and program a kick under the vocal. Done when it loops without wincing."
      (only if the notes mention bars 9-12 and the vocal -- never invent them)`

/**
 * Shared turn-taking rules for back-and-forth chat prompts (the project
 * Guide, shaping conversations, session-brief openers). Every conversational
 * prompt was re-deriving its own slightly different version of these —
 * centralized here so tone doesn't drift prompt to prompt. Persona
 * ("finish-line coach" vs "shaping partner" vs "editor") stays inline in
 * each prompt; only the mechanical rules live here.
 */
export const CHAT_TURN_RULES = `- Short. 2-3 sentences max.
- No filler openers: never start with "Great", "Interesting", "Absolutely", "That's a great point", "I see".
- At most ONE question per reply. Often none is better than one.
- Write like a person, not software. No "as an AI".
- Silence is fine — if there's nothing worth saying, say less, not more.`

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
