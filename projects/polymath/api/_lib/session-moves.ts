/**
 * "I'm stuck" -- one move back into the step you're on.
 *
 * Mid-session you're either flowing or stuck, and neither wants a list.
 * Stuck wants one thing to do with your hands: smaller, sideways, or a
 * constraint. Never a new plan, and never saved -- if it helped, the
 * close-out will say so in your own words. (Getting started is the other
 * moment that needs help; that's next-move.ts.)
 *
 * Grounded like every generated line: nothing named that the project's
 * evidence doesn't name. Pure except `stuckMove`.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES, CREATIVE_MOVE_RULES, FIRST_MOVE_RULES } from './plain-english.js'
import { evidenceHaystack, hasOnlyKnownSpecifics, type Evidence } from './session-grounding.js'
import { sanitizeRawItems } from './session-items.js'

function evidenceBlock(evidence: Evidence[]): string {
  return evidence.length
    ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
    : '(nothing beyond the title)'
}

export interface StuckInput {
  title: string
  /** The step they're stuck on. */
  step: string
  progressNote: string | null
  /** What they said is wrong, if they said anything. */
  said: string | null
  evidence: Evidence[]
}

export function buildStuckPrompt(input: StuckInput): string {
  return `Someone is mid-session on "${input.title}" and stuck.

THE STEP THEY'RE ON: "${input.step}"
${input.progressNote ? `WHERE THEY'D GOT TO ON IT: "${input.progressNote}"\n` : ''}${input.said ? `WHAT THEY SAY IS WRONG: "${input.said}"\n` : ''}
EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidenceBlock(input.evidence)}

That list is the whole of it. Anything not in it, you do not know.

Give ONE move that gets their hands back on this step. Not a new plan,
not a different task, not advice. Pick whichever of these fits:
- Smaller: the tiniest piece of the step that still counts.
- Sideways: come at the same thing from another angle -- a different
  bit of it, or the same bit done badly on purpose.
- A constraint: a hard limit that forces a choice (three colours, one
  take, eight bars, one sentence).
  BAD:  "Take a break and come back to it with fresh eyes"
        -- advice, and nothing is touched.
  BAD:  "Break the step into smaller tasks" -- a plan about a plan.
  GOOD: "Mute everything but the drums and play bars 9-12 on loop. Done when one thing is changed."
        (only if the notes mention bars 9-12)
  GOOD: "Write the ending badly in three lines. Done when three lines exist."

${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

${CREATIVE_MOVE_RULES}

${FIRST_MOVE_RULES}

Respond with JSON only:
{ "move": "..." }`
}

/**
 * The gate for a single generated move: a line that survives the shared
 * cleaning (no admin verbs, not too long) and names nothing the project's
 * evidence -- plus any extra text the move is by construction about --
 * doesn't name. Null when it fails: silence beats an invented move.
 */
export function groundMove(raw: unknown, evidence: Evidence[], title: string, extra: string[] = []): string | null {
  if (typeof raw !== 'string') return null
  const [item] = sanitizeRawItems([raw], 1)
  if (!item) return null
  const haystack = `${evidenceHaystack(evidence, title)} ${extra.join(' ').toLowerCase()}`
  return hasOnlyKnownSpecifics(item.text, haystack) ? item.text : null
}

async function askForMove(prompt: string): Promise<unknown> {
  const response = await generateText(prompt, {
    model: MODELS.SESSION_SHAPE_CHAT,
    responseFormat: 'json',
    temperature: 0.4,
    maxTokens: 400,
    // One line against a closed evidence set. Uncapped, a thinking model
    // can spend the whole budget before writing any JSON.
    thinkingLevel: 'low',
  })
  return JSON.parse(response)?.move
}

export async function stuckMove(input: StuckInput): Promise<string | null> {
  try {
    return groundMove(
      await askForMove(buildStuckPrompt(input)),
      input.evidence,
      input.title,
      [input.step, input.progressNote ?? '', input.said ?? ''],
    )
  } catch (e) {
    console.error('[session-moves] stuck move failed:', e)
    return null
  }
}
