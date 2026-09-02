/**
 * Is the next step actually startable?
 *
 * The plan is ordered, but "ordered" only means the steps that exist are
 * in the right sequence. It doesn't mean nothing is MISSING between them.
 * A spine is 5-8 steps for a whole project, so the gaps are real: the next
 * step says "pour the paint over the stencil" and nobody ever wrote down
 * that the stencil has to be taped to the board first. Sitting down to a
 * step you can't start is the worst thing a rare hour can produce -- worse
 * than a vague list, because you've already committed.
 *
 * So before a session opens, the top step gets one question: can this be
 * started right now, or does something have to happen first? Three answers:
 *
 *   ready   — the normal answer, and the one the prompt is biased toward.
 *   move    — the missing thing is ALREADY on the list, further down. Then
 *             the fix is to reorder, not to add: the step moves up.
 *   add     — it genuinely isn't on the list. It gets written to the
 *             project in front of the step it blocks, and becomes the
 *             session. This is a real step of the project, discovered late
 *             -- not session filler, which is why writing it down is right.
 *
 * The invention risk here is obvious and specific: a model asked "what has
 * to happen first?" will always find something ("gather your materials",
 * "set up your workspace"). Every gate that stops that is mechanical:
 *   - admin verbs are rejected outright (isAdminItem)
 *   - a "blocker" that's a restatement of the step is rejected
 *   - a new step must cite evidence and invent no specifics (filterGrounded)
 *   - anything that fails any gate is treated as `ready`
 * Silence over slop: when in doubt, the step was fine.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import {
  filterGrounded, sharesSubstantialWording,
  type Evidence, type GroundedItem,
} from './session-grounding.js'
import { isAdminItem } from './session-items.js'
import { nearestEstimate, DEFAULT_ESTIMATE_MINUTES, type EstimateMinutes } from './session-estimate.js'
import type { BudgetTask } from './session-budget.js'

export interface ReadyInput {
  title: string
  /** The step the session would open with. */
  step: BudgetTask
  /** The rest of the open list, in plan order, so a missing prerequisite
   *  that's already further down can be pointed at rather than duplicated. */
  laterSteps: BudgetTask[]
  evidence: Evidence[]
}

export type Readiness =
  | { kind: 'ready' }
  /** The prerequisite is already on the list -- move it above the step. */
  | { kind: 'move'; taskId: string; text: string }
  /** The prerequisite isn't on the list -- write it in before the step. */
  | { kind: 'add'; item: GroundedItem; minutes: EstimateMinutes }

export function buildReadyPrompt(input: ReadyInput): string {
  const { step, laterSteps } = input
  return `Someone is about to sit down and work on "${input.title}". The next step on
their plan is:

  "${step.text}"

Could they start that right now, or does something else have to be
finished first?

EVERYTHING KNOWN ABOUT THIS PROJECT:
${input.evidence.length
  ? input.evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing beyond the step itself)'}

That list is the whole of it. Anything not in it, you do not know.

${laterSteps.length
  ? `THE REST OF THEIR LIST, in order, after this step:\n${laterSteps.map(t => `[${t.id}] ${t.text}`).join('\n')}`
  : '(nothing else on the list)'}

READY IS THE NORMAL ANSWER. A plan is usually in the right order, and
saying "actually, do this other thing first" when the step was fine
wastes the hour they came to work in. Only answer "blocked" when the
step is genuinely impossible until something specific and physical has
happened -- a thing that must EXIST, be CUT, be BOUGHT, be SENT, be
FIXED, or be UNDONE first.

NOT blockers, ever:
- Getting ready, gathering things, setting up, tidying, planning,
  deciding, researching, checking, reviewing, thinking about it. None of
  those are steps; they're just starting.
- Anything you'd say about any project ("open the file", "find your
  notes"). If it isn't specific to THIS work, the step was ready.
- A restatement of the step in different words.
- Something the evidence says is already finished.

If it IS blocked, is the missing thing already on their list above? If
so, give its id in "existing_task_id" -- don't write it out again.
Otherwise write it as one line, cite the evidence ids it comes from, and
give a rough one-sitting time.

Name no tool, brand, model number, format, setting, person or place that
doesn't appear word for word above.

${PLAIN_ENGLISH_RULES}

The step is "Pour the paint over the stencil":
  READY:   if the evidence says the stencil is cut and the board's ready.
  BLOCKED: "Tape the stencil down to the board" -- but ONLY if the notes
           actually mention taping or the stencil moving. If they don't,
           you invented it, and the answer is ready.
  NEVER:   "Get your paints and workspace ready." That's just starting.

Respond with JSON only:
{
  "verdict": "ready" | "blocked",
  "blocker": { "text": "...", "evidence": ["e1"], "existing_task_id": null, "estimated_minutes": 15 } | null
}`
}

/**
 * Model output -> a decision the app can act on. Every gate here is
 * mechanical, and failing any of them means `ready` -- never a guess
 * written into the user's permanent task list.
 */
export function sanitizeReadiness(raw: unknown, input: ReadyInput): Readiness {
  const ready: Readiness = { kind: 'ready' }
  if (!raw || typeof raw !== 'object') return ready
  const parsed = raw as { verdict?: unknown; blocker?: any }
  if (parsed.verdict !== 'blocked' || !parsed.blocker || typeof parsed.blocker !== 'object') return ready

  const text = typeof parsed.blocker.text === 'string' ? parsed.blocker.text.trim() : ''

  // Already on the list further down: reorder rather than duplicate.
  const citedId = typeof parsed.blocker.existing_task_id === 'string' ? parsed.blocker.existing_task_id : null
  const cited = citedId ? input.laterSteps.find(t => t.id === citedId) : undefined
  if (cited) return { kind: 'move', taskId: cited.id, text: cited.text }

  if (!text || text.length > 140) return ready
  // Admin dressed as a prerequisite is the failure mode this whole check
  // invites, so it's rejected before anything else looks at it.
  if (isAdminItem(text)) return ready
  // A "blocker" that just says the step again isn't one.
  if (sharesSubstantialWording(text, input.step.text)) return ready
  // The model didn't cite it, but it's on the list anyway -- move it.
  const already = input.laterSteps.find(t => sharesSubstantialWording(text, t.text))
  if (already) return { kind: 'move', taskId: already.id, text: already.text }

  // Same grounding gates as any other written line -- plus a stricter
  // one. filterGrounded lets an UNCITED item through when it asserts
  // nothing beyond the project's own name ("open it and look at where you
  // left it"), which is right for a session item and wrong here: a
  // prerequisite always asserts something ("the board needs priming"),
  // and this one is being written into the permanent plan. So it has to
  // point at a real note, not merely avoid naming gear.
  const cites = Array.isArray(parsed.blocker.evidence)
    ? parsed.blocker.evidence.filter((x: unknown): x is string => typeof x === 'string')
    : []
  if (cites.length === 0) return ready
  const { kept } = filterGrounded([{ text, evidence: cites }], input.evidence, input.title)
  if (kept.length === 0 || kept[0].source === null) return ready

  const rawMinutes = parsed.blocker.estimated_minutes
  return {
    kind: 'add',
    item: { text: kept[0].text, source: `needed before: ${input.step.text}`, taskId: null },
    minutes: typeof rawMinutes === 'number' ? nearestEstimate(rawMinutes) : DEFAULT_ESTIMATE_MINUTES,
  }
}

/**
 * Ready on any failure. A missed prerequisite costs one awkward session;
 * a wrongly-inserted one rewrites the plan and is read as the app not
 * knowing the project.
 */
export async function checkReady(input: ReadyInput): Promise<Readiness> {
  if (input.evidence.length === 0) return { kind: 'ready' }
  try {
    const response = await generateText(buildReadyPrompt(input), {
      responseFormat: 'json',
      temperature: 0.2,
      // Checking a stated step against a fixed evidence list, not composing.
      thinkingLevel: 'low',
      maxTokens: 500,
    })
    return sanitizeReadiness(JSON.parse(response), input)
  } catch (e) {
    console.warn('[session-ready] check failed, taking the step as-is:', e instanceof Error ? e.message : e)
    return { kind: 'ready' }
  }
}
