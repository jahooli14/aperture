/**
 * Topping up a session when the real backlog runs out before the window
 * does -- e.g. a project has one open step and an hour to fill.
 *
 * This is deliberately NOT the mechanism session-shaper.ts's header
 * comment describes ripping out: the old shaper invented 3-6 items every
 * session to fill the window, with spares on a bench to swap in, and that
 * is where the imaginary microphones came from. This is narrower and
 * grounded the same way everything else in this file is:
 *   - only runs when the real backlog is genuinely exhausted, never as a
 *     replacement for it
 *   - every item must cite real evidence (filterGrounded) or it doesn't
 *     exist -- no evidence to ground a suggestion in means no suggestion
 *   - capped small (the window's own remaining-slot budget)
 *   - labelled as a suggestion, not folded in as if it were a real step
 *     (see TOPUP_SOURCE) -- and carries no taskId, so it only becomes a
 *     real task the same way every other ungrounded session item already
 *     does: at close-out, and only if actually ticked off
 *     (api/utilities.ts, resource=start)
 *
 * Silence over slop: nothing groundable, or the model call fails, means
 * an empty list -- the session just stays short, same as today.
 *
 * Pure except `topUpSession`.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES } from './plain-english.js'
import { filterGrounded, type Evidence, type GroundedItem } from './session-grounding.js'
import { sanitizeRawItems, dedupeSimilar } from './session-items.js'

/** Distinct from every other session-item caption ('already on the
 *  project', 'last time: ...') on purpose -- reads as a proposal, not a
 *  committed plan step, wherever SessionContract.tsx renders it. */
export const TOPUP_SOURCE = 'a possible next move — not committed yet'

export interface TopupInput {
  title: string
  evidence: Evidence[]
  /** Text already on the plan for this session -- so the model doesn't
   *  repeat it, and so a near-duplicate can still be caught mechanically
   *  afterward (dedupeSimilar), same backstop the reshape path uses. */
  currentItems: string[]
  /** Real minutes left in the window after the already-selected items,
   *  when it's known exactly (the plain task-list path). Null when it
   *  isn't -- e.g. after a split, whose moves deliberately carry no
   *  numeric estimate (session-split.ts). Null still means "there is
   *  probably real time left," just not a number to be precise about;
   *  the model is trusted to judge how much is actually worth proposing
   *  rather than being handed a guessed figure to anchor on. */
  remainingMinutes: number | null
  /** itemCountForWindow's own ceiling, minus what's already selected --
   *  the hard structural cap regardless of how the model reads the time. */
  maxItems: number
}

export function buildTopupPrompt(input: TopupInput): string {
  const { title, evidence, currentItems, remainingMinutes, maxItems } = input
  const current = currentItems.length
    ? currentItems.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(nothing yet)'
  const timeLeft = remainingMinutes != null
    ? `about ${remainingMinutes} minutes left`
    : 'some real time left, though not a precise amount -- the last step just got cut down to fit, so use your judgment on how much more, if anything, actually belongs in this sitting'

  return `Someone is partway into a session on "${title}", with ${timeLeft}
after the steps already on their plan.

EVERYTHING KNOWN ABOUT THIS PROJECT:
${evidence.length
  ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing yet — the user has not said anything about this project)'}

That list is the whole of it. Anything not in it, you do not know.

ALREADY ON THE PLAN FOR THIS SESSION -- don't repeat these:
${current}

Is there a REAL next move against the work -- something the evidence
above actually supports -- that would fill some of what's left? Up to
${maxItems} more items, each citing the evidence id it comes from. An
empty list is the right, honest answer far more often than a full one --
only propose something you can actually cite.

What none of them may be:
- Admin dressed as building: research, plan, outline, decide, list,
  consider, review, think about, set up, brainstorm, explore.
- A repeat or rewording of anything already on the plan above.
- Anything naming a tool, brand, format, setting, person or place that
  isn't word for word in the evidence.
- One line each. No sub-bullets, no time estimates, no explanation.

${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

Say the evidence has: "[e1] Next: fix the transition out of track two."
and the plan already has "Fix the transition out of track two" on it.
  BAD:  "Master the whole EP." -- nothing above says anything about
        mastering an EP.
  GOOD: "Listen back to track three and note anything else that's off."
        -- a real move the evidence's own next-step framing supports,
        and it doesn't repeat what's already on the plan.
  ALSO GOOD: an empty list, when nothing above actually supports another
        real move.

Respond with JSON only:
{ "items": [ { "text": "...", "evidence": ["e1"] } ] }`
}

/**
 * Null-safe evidence gate + the fixed suggestion label, no taskId --
 * both of which the caller relies on for the "easy to drop, only becomes
 * real if worked on" guarantee.
 */
export async function topUpSession(input: TopupInput): Promise<GroundedItem[]> {
  if (input.maxItems <= 0 || input.evidence.length === 0) return []
  try {
    const response = await generateText(buildTopupPrompt(input), {
      model: MODELS.SESSION_SHAPE_CHAT,
      responseFormat: 'json',
      temperature: 0.3,
      maxTokens: 700,
      // Without a cap, an uncapped thinking model can spend the whole
      // maxTokens budget reasoning before writing any JSON, leaving
      // nothing to parse. Proposing 0-2 grounded lines isn't open-ended
      // prose -- 'low' matches checkReady's own choice.
      thinkingLevel: 'low',
    })
    const parsed = JSON.parse(response)
    const cleaned = sanitizeRawItems(parsed?.items, input.maxItems)
    const { kept, rejected } = filterGrounded(cleaned, input.evidence, input.title)
    if (rejected.length > 0) {
      console.warn(`[session-topup] dropped ${rejected.length} ungrounded suggestion(s) for "${input.title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    const deduped = dedupeSimilar(kept, input.currentItems.map(text => ({ text })))
    return deduped.map(item => ({ ...item, source: TOPUP_SOURCE, taskId: null }))
  } catch (e) {
    console.error('[session-topup] failed, staying short rather than inventing:', e)
    return []
  }
}
