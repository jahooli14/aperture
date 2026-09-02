/**
 * Splitting one real step into the piece of it that fits this sitting.
 *
 * SPEC.md's third derivation rule, and the one the old shaper never did:
 * "Decomposition, only when the window is smaller than the step: split the
 * stated next move into a piece that fits, and say plainly that it isn't
 * the whole thing." Instead of splitting, the old shaper generated NEW
 * items to fill the window -- which is where the invented moves came from.
 *
 * The model's job here is deliberately tiny: it is handed ONE step, told
 * the window, and asked for the first 2-3 moves of THAT step ending at a
 * real stopping point. Every move is a piece of the step by construction,
 * so the citation gate is the specifics gate only (nothing named that the
 * step or the project's evidence doesn't name) -- word-overlap with the
 * step text isn't required, because "Trace the outline onto card" is a
 * perfectly honest first piece of "Design and cut the stencil" and shares
 * no distinctive word with it.
 *
 * Pure except `splitStep`; the prompt and the grounding are unit-tested.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import {
  evidenceHaystack, hasOnlyKnownSpecifics, extractSpecifics,
  type Evidence, type GroundedItem,
} from './session-grounding.js'
import { sanitizeRawItems } from './session-items.js'
import type { BudgetTask } from './session-budget.js'

export const MAX_SPLIT_MOVES = 3

export interface SplitInput {
  title: string
  step: BudgetTask
  /** Where they got to on this step last time, if the close-out said. */
  progressNote: string | null
  windowMinutes: number
  evidence: Evidence[]
}

export interface SplitResult {
  moves: GroundedItem[]
  /** What exists at the end of the sitting if the moves land. */
  doneLooksLike: string | null
}

export function buildSplitPrompt(input: SplitInput): string {
  const { step, windowMinutes } = input
  return `Someone has ${windowMinutes} minutes on "${input.title}". The next step on their
plan is bigger than that, so give them the first piece of it that fits.

THE STEP: "${step.text}" (about ${step.minutes} minutes in one sitting)
${input.progressNote ? `WHERE THEY GOT TO LAST TIME: "${input.progressNote}"\n` : ''}
EVERYTHING KNOWN ABOUT THIS PROJECT:
${input.evidence.length
  ? input.evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing beyond the step itself)'}

That list is the whole of it. Anything not in it, you do not know.

Give 2-${MAX_SPLIT_MOVES} moves, in order, that are the FIRST part of this step and fit
inside ${windowMinutes} minutes. If they already got part way, start from there,
not from the top.

- Each move is a piece of THIS step. Not a different task, not preparation
  for the step, not "get set up" -- the step itself, begun.
- The last move ends at a real stopping point: something exists that
  didn't before, and picking up next time is obvious. Say what that is
  in "done_looks_like", one plain sentence.
- Under-reach. Too small is fine; too big means stopping mid-thing.
- No tools, gear, brands, model numbers, formats, settings, people or
  places unless they appear word for word above. If the notes never
  mention a scalpel, this project has no scalpel.
- One line each. No sub-bullets, no time estimates, no explanation.

${PLAIN_ENGLISH_RULES}

Say the step is "Design and cut the stencil" and they have 20 minutes:
  BAD:  "Set up your cutting mat and X-Acto knife under good light."
        -- a cutting mat, a knife brand and lighting: none of it was said.
  GOOD: "Draw the outline of the design on the card, actual size."
        "Cut the two biggest shapes out and stop there."
        done_looks_like: "The outline is drawn and the big shapes are cut."

Respond with JSON only:
{
  "moves": [ { "text": "..." } ],
  "done_looks_like": "..."
}`
}

/**
 * The gate for split moves: nothing invented. Citation-by-construction to
 * the step (see file comment), so no word-overlap check.
 */
export function groundMoves(
  raw: unknown,
  step: BudgetTask,
  evidence: Evidence[],
  title: string,
): { kept: GroundedItem[]; rejected: { text: string; reason: string }[] } {
  const haystack = `${evidenceHaystack(evidence, title)} ${step.text.toLowerCase()}`
  const kept: GroundedItem[] = []
  const rejected: { text: string; reason: string }[] = []
  for (const item of sanitizeRawItems(raw, MAX_SPLIT_MOVES)) {
    if (!hasOnlyKnownSpecifics(item.text, haystack)) {
      const unknown = extractSpecifics(item.text).filter(s => !haystack.includes(s.toLowerCase()))
      rejected.push({ text: item.text, reason: `invented: ${unknown.join(', ')}` })
      continue
    }
    kept.push({ text: item.text, source: `part of: ${step.text}`, taskId: step.id, partial: true })
  }
  return { kept, rejected }
}

export function sanitizeDoneLooksLike(raw: unknown, haystack: string): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > 160) return null
  if (!hasOnlyKnownSpecifics(text, haystack)) return null
  return text
}

/**
 * What "done today" means when the plan is real steps taken verbatim --
 * no model needed. One step: it's ticked. Several: through to the last.
 */
export function doneLineForSteps(steps: { text: string }[]): string | null {
  if (steps.length === 0) return null
  const last = steps[steps.length - 1].text.replace(/[.!?]+$/, '')
  if (steps.length === 1) return `"${last}" ticked off.`
  return `Through to "${last}".`
}

/**
 * Null when the split couldn't be trusted (model down, or fewer than two
 * moves survived grounding). The caller then shows the step itself, which
 * is honest, rather than a one-line "split" that's really just a
 * paraphrase.
 */
export async function splitStep(input: SplitInput): Promise<SplitResult | null> {
  try {
    const response = await generateText(buildSplitPrompt(input), {
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 900,
    })
    const parsed = JSON.parse(response)
    const { kept, rejected } = groundMoves(parsed?.moves, input.step, input.evidence, input.title)
    if (rejected.length > 0) {
      console.warn(`[session-split] dropped ${rejected.length} move(s) for "${input.step.text}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    if (kept.length < 2) return null
    const haystack = `${evidenceHaystack(input.evidence, input.title)} ${input.step.text.toLowerCase()}`
    return { moves: kept, doneLooksLike: sanitizeDoneLooksLike(parsed?.done_looks_like, haystack) }
  } catch (e) {
    console.error('[session-split] failed, showing the step whole:', e)
    return null
  }
}
