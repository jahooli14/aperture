/**
 * One move, at the two moments a session actually needs help.
 *
 * A plan helps least in the middle of creative work: once you're in it,
 * you're either flowing or stuck, and neither wants a list. The moments
 * that want help are getting going and getting unstuck, and both want the
 * same thing -- ONE small move in the medium's own verbs, with a clear
 * point where it's done. Never a new plan.
 *
 *   - RE-ENTRY. A project left for a month has a plan written by someone
 *     who remembered it. Its top step is cold, and sitting down to it
 *     costs double. The first move back is to meet the work again: play
 *     the last bounce, read the last page, look at the last canvas, and
 *     say one sentence about it. That sentence is what the close-out then
 *     carries forward.
 *   - STUCK. Mid-session, on the step you're on. One move that gets hands
 *     back on it -- smaller, sideways, or a constraint -- not a replan.
 *
 * Both are grounded the same way as a split move: nothing named that the
 * project's own evidence doesn't name. Neither is written to the plan.
 * The re-entry move rides the session as a `pending-` item, so it only
 * becomes a (done) task if it's ticked at close-out. The stuck move is
 * scaffolding and is thrown away.
 *
 * Pure except `reentryMove` and `stuckMove`.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES, CREATIVE_MOVE_RULES, FIRST_MOVE_RULES } from './plain-english.js'
import { evidenceHaystack, hasOnlyKnownSpecifics, type Evidence, type GroundedItem } from './session-grounding.js'
import { sanitizeRawItems } from './session-items.js'

/** A month away and the plan is someone else's. Short of that, the
 *  re-entry line (the last close-out) is enough to get going. */
export const REENTRY_AFTER_DAYS = 28
/** What the re-entry move is budgeted at inside the window. */
export const REENTRY_MINUTES = 10
export const REENTRY_SOURCE = "a way back in — it's been a while"

export interface ReentryInput {
  title: string
  daysAway: number
  lastCloseout: string | null
  /** The step the plan would otherwise open on. */
  nextStep: string | null
  evidence: Evidence[]
}

export function needsReentry(daysAway: number, openStepCount: number): boolean {
  return openStepCount > 0 && daysAway >= REENTRY_AFTER_DAYS
}

function evidenceBlock(evidence: Evidence[]): string {
  return evidence.length
    ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
    : '(nothing beyond the title)'
}

export function buildReentryPrompt(input: ReentryInput): string {
  const weeks = Math.round(input.daysAway / 7)
  return `Nobody has worked on "${input.title}" for about ${weeks} weeks. They're sitting
down to it now. Give them ONE move to get back into it.

${input.lastCloseout ? `WHERE THEY STOPPED LAST TIME, in their words: "${input.lastCloseout}"\n` : ''}${input.nextStep ? `THE PLAN'S NEXT STEP (written before the break, probably cold now): "${input.nextStep}"\n` : ''}
EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidenceBlock(input.evidence)}

That list is the whole of it. Anything not in it, you do not know.

After a long break the old plan is out of date. Don't pick up where the
plan says. Meet the work again first: play, read, look at or run the
last thing that exists, then say one sentence out loud about what's
wrong with it or what it needs. That sentence is where the session goes
next.
  BAD:  "Review your notes and make a plan for the next stage"
        -- planning language, and nothing is touched.
  GOOD: "Play the last bounce once and say one sentence about what's wrong with it. Done when you've said it."
  GOOD: "Read the last page you wrote, out loud. Done when you can say what the next line needs."

If nothing above says what the last thing made was, name it plainly
("the last thing you made") rather than inventing it.

${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

${CREATIVE_MOVE_RULES}

${FIRST_MOVE_RULES}

Respond with JSON only:
{ "move": "..." }`
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

export async function reentryMove(input: ReentryInput, projectId: string): Promise<GroundedItem | null> {
  try {
    const text = groundMove(
      await askForMove(buildReentryPrompt(input)),
      input.evidence,
      input.title,
      [input.lastCloseout ?? '', input.nextStep ?? ''],
    )
    if (!text) return null
    return { text, source: REENTRY_SOURCE, taskId: `pending-reentry-${projectId}`, partial: false }
  } catch (e) {
    console.error('[session-moves] re-entry move failed, opening on the plan:', e)
    return null
  }
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
