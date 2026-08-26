/**
 * How the model is allowed to write. Interpolate RULES into any prompt whose
 * output a person will read.
 *
 * Relay's bar is higher than most: two friends wrote this story themselves,
 * and an app that starts explaining it back to them in critic-voice is
 * insufferable. Notes describe, they never interpret.
 */
export const RULES = `Write like a person, not a literary critic.

- Short, plain sentences. One idea each. No semicolons.
- Describe only what the text says. Never explain what it "means",
  "explores", "reveals", or "reflects".
- No literary-criticism words: narrative, motif, juxtaposition, liminal,
  meditation, exploration, poignant, evocative, subverts, underscores,
  interrogates, journey, tapestry, lens, resonance, thematic.
- No praise and no judgement. You are writing an index, not a review.
- British spelling.

BAD:  "Pasco, a fox whose journey through the liminal spaces of the city
       becomes a poignant meditation on displacement."
GOOD: "A fox. Breaks into a room, kills a stuffed echidna, sleeps in bin bags."

BAD:  "Detroit serves as a symbolic crucible where the narrative pivots."
GOOD: "Detroit. Where the peanuts end up after the shipping mix-up."`

/** Words that mean the model slipped into critic voice. Checked after generation. */
export const BANNED_WORDS: readonly string[] = [
  'narrative', 'motif', 'motifs', 'juxtaposition', 'juxtaposes', 'liminal',
  'meditation', 'exploration', 'explores', 'poignant', 'evocative',
  'subverts', 'underscores', 'interrogates', 'journey', 'tapestry',
  'resonance', 'thematic', 'symbolic', 'symbolises', 'symbolizes',
  'metaphor', 'metaphorical', 'allegory', 'allegorical', 'juxtaposed',
  'serves as', 'speaks to', 'reflects on', 'grapples with',
]

const WORD_BOUNDARY = (word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

/** Which banned words a piece of generated copy used. Empty means it's clean. */
export function findVoiceViolations(text: string): string[] {
  return BANNED_WORDS.filter((word) => WORD_BOUNDARY(word).test(text))
}
