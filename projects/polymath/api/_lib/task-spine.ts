/**
 * The task spine — the ordered set of moves that actually reaches done.
 *
 * "The tasks being good is essentially the whole project." Everything else
 * in the app is downstream of this list: the session shaper picks its
 * moves from within it, the confidence score reads it, close-outs tick it
 * off. A vague or invented spine poisons all of that.
 *
 * The technique is BACKWARDS PLANNING, and it is the whole idea. Asking a
 * model "what should I do first?" invents, because nothing constrains the
 * answer — that's where "research your options" and imaginary microphones
 * come from. Asking "this is done; what had to be true just before that?"
 * is constrained at every step by the goal the user actually stated, and
 * it produces a list that reaches the end rather than one that just starts.
 *
 * Two hard limits, both structural rather than hoped for in the prompt:
 *   - 5-8 steps. Three isn't a project; forty is a chore sheet, and the
 *     user opens this app to stop deciding, not to read a backlog.
 *   - Every step goes through the same grounding gates as a session item
 *     (session-grounding.ts), against what the user actually said. No
 *     invented gear, brands, formats or people at the moment a project is
 *     born -- a spine is the thing every later session cites.
 */

import { generateText } from './gemini-chat.js'
import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { filterGrounded, type Evidence } from './session-grounding.js'
import { isAdminItem } from './session-items.js'
import { ESTIMATE_MINUTES, nearestEstimate, type EstimateMinutes } from './session-estimate.js'
import { orderSteps } from './task-order.js'

export const MIN_SPINE_STEPS = 4
export const MAX_SPINE_STEPS = 8

/**
 * The very first spine a project gets, at creation, is a different shape
 * from a replan: 3 broad moves that together are about an hour's work, not
 * 4-8 tight ones. A brand-new project doesn't have the texture yet to plan
 * tightly against, and pretending otherwise is how creation ends up
 * inventing detail nobody said. Loose now, precise once you're in it.
 */
export const FIRST_CUT_STEPS = 3

export interface SpineInput {
  title: string
  /** What done looks like, in the user's words. The whole thing hangs off
   *  this: with no goal there is nothing to work backwards FROM. */
  endGoal: string | null
  /** Everything the user has said about this project -- the capture dump,
   *  the shaping conversation, notes. This is the evidence set. */
  said: string[]
  /** Steps already on the project, so a re-plan extends rather than
   *  silently replaces work they've already agreed to. */
  existingSteps?: string[]
}

export interface SpineStep {
  text: string
  /** Where it came from, or null when it's a plainly generic move. */
  source: string | null
  /** Set once, at generation time, and persisted onto the stored task from
   *  then on -- the triage that plans a session against real minutes reads
   *  this rather than re-asking the model "how long is this" every time. */
  estimatedMinutes: EstimateMinutes | null
}

export function buildEvidenceFromSaid(title: string, endGoal: string | null, said: string[]): Evidence[] {
  const evidence: Evidence[] = []
  let n = 0
  const add = (label: string, text: string) => {
    if (!text?.trim()) return
    evidence.push({ id: `e${++n}`, label, text: text.trim() })
  }
  add('the finish line you set', endGoal ?? '')
  said.forEach(s => add('from what you said about it', s))
  return evidence
}

export function buildSpinePrompt(input: SpineInput, evidence: Evidence[]): string {
  const goal = input.endGoal?.trim()

  return `Lay out the steps that get "${input.title}" finished.

${goal ? `DONE MEANS: ${goal}` : 'The user has not said what done looks like.'}

EVERYTHING THEY HAVE SAID ABOUT IT:
${evidence.length
  ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing yet)'}

That list is the whole of it. Anything not in it, you do not know.
${input.existingSteps?.length
  ? `\nSTEPS ALREADY AGREED — keep these, in this order, and fill in around them:\n${input.existingSteps.map(s => `- ${s}`).join('\n')}\n`
  : ''}
HOW TO DO THIS — work backwards, not forwards:
Start at "done" and ask what had to be true immediately before it. Then
what had to be true before THAT. Keep going until you reach something they
could do in their next hour. Then write the chain out forwards.

Planning forwards from nothing is how lists end up full of "research the
options" and equipment nobody owns. Planning backwards from a finish line
they wrote themselves keeps every step tied to something real.

WHAT EACH STEP MUST BE:
- A move against the work, with something existing afterwards that didn't
  before: cut, write, record, build, send, book, phone, drive, commit.
- Roughly one to three sittings of work. Not a whole phase, not five
  minutes. "Record the vocals" not "make the album" and not "plug the mic in".
- Written so that in six weeks' time they'd still know what it meant.

WHAT NONE OF THEM MAY BE:
- Admin pretending to be building: research, plan, outline, decide, list,
  consider, review, think about, set up, brainstorm, explore.
- Anything naming a tool, brand, model number, file format, setting,
  instrument, person or place that does NOT appear verbatim above. If they
  never mentioned a guitar, this project has no guitar. Cite the evidence
  id each step comes from; if you can't cite it, you can't say it.
- A step that only makes sense if you assume how they work. You do not
  know what software they use or what they own.

Give ${MIN_SPINE_STEPS}-${MAX_SPINE_STEPS} steps, in the order they'd be done, first one first.
Fewer, honest steps beat a long list you had to invent to fill.

THE ORDER IS THE PLAN. Before you answer, read your list top to bottom and
ask of each step: could they actually do this with only the steps above it
finished? If not, it's in the wrong place.
  BAD:  1. Let the piece dry and peel the stencil off
        2. Design and cut the stencil
        -- there's nothing to peel off until the stencil exists.
  GOOD: 1. Design and cut the stencil
        2. Pour the paint over it
        3. Let it dry and peel the stencil off
For each step, list "after": the numbers of the steps that must be finished
before it can start. An empty list means it can be done any time.

For each step, also guess how long ONE SITTING of it takes -- not the whole
step if it spans several sessions, just a realistic single sitting. Pick
the closest value from EXACTLY this list: ${ESTIMATE_MINUTES.join(', ')}.

${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "steps": [ { "text": "...", "evidence": ["e1"], "after": [], "estimated_minutes": 20 } ] }`
}

/**
 * Model output -> a spine. Same shape of cleaning as session items, plus
 * the length rules that make it a spine rather than a backlog.
 */
export interface CleanStep {
  text: string
  evidence?: string[]
  estimatedMinutes: EstimateMinutes | null
  /** 1-based position in the model's own numbering -- what `after` refers to. */
  position: number
  /** Positions that must be finished first, as the model declared them. */
  after: number[]
}

export function sanitizeSteps(
  raw: unknown,
  maxCount: number = MAX_SPINE_STEPS,
): CleanStep[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CleanStep[] = []
  raw.forEach((entry, index) => {
    if (out.length >= maxCount) return
    const rawText = typeof entry === 'string' ? entry : entry?.text
    if (typeof rawText !== 'string') return
    const text = rawText.trim().replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '').trim()
    if (!text || text.length > 140) return
    if (isAdminItem(text)) return
    const key = text.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!key || seen.has(key)) return
    seen.add(key)
    const obj = typeof entry === 'object' && entry !== null ? (entry as any) : {}
    const rawMinutes = obj.estimated_minutes
    out.push({
      text,
      evidence: Array.isArray(obj.evidence)
        ? obj.evidence.filter((x: unknown): x is string => typeof x === 'string')
        : undefined,
      estimatedMinutes: typeof rawMinutes === 'number' ? nearestEstimate(rawMinutes) : null,
      position: index + 1,
      after: Array.isArray(obj.after)
        ? obj.after.filter((x: unknown): x is number => typeof x === 'number' && Number.isInteger(x))
        : [],
    })
  })
  return out
}

/**
 * Grounding drops steps and loses the estimate/order fields (it only
 * carries text and citation). Reattach them by text -- which survives the
 * pass unchanged -- then put the survivors in an order that respects what
 * the model said had to come first.
 */
export function assembleSteps(
  cleaned: CleanStep[],
  kept: { text: string; source: string | null }[],
): SpineStep[] {
  const byText = new Map(cleaned.map(c => [c.text, c]))
  const sequenced = kept.map(k => {
    const c = byText.get(k.text)
    return {
      text: k.text,
      source: k.source,
      estimatedMinutes: c?.estimatedMinutes ?? null,
      position: c?.position ?? 0,
      after: c?.after ?? [],
    }
  })
  return orderSteps(sequenced).map(({ after: _after, ...step }) => step)
}

/** The shape the app stores tasks in (metadata.tasks). Field names match
 *  TaskList.tsx's Task interface -- same record, read by both. */
export interface StoredTask {
  id: string
  text: string
  done: boolean
  created_at: string
  /** Position in the plan. Always set by anything that writes tasks --
   *  see task-order.ts for the invariant. */
  order: number
  /** Kept so a later session can show where the step came from, and so a
   *  re-plan can tell generated steps from ones the user wrote. */
  source?: string | null
  origin?: 'spine' | 'closeout' | 'user' | 'session'
  estimated_minutes?: number
  estimate_set?: boolean
  /** Where a session got to on a step it didn't finish, in the user's own
   *  words from the close-out. Read back at the next session so re-entry
   *  is specific ("got as far as cutting the outline"), and cleared when
   *  the step is ticked. */
  progress_note?: string
  progress_at?: string
}

export function toStoredTasks(steps: SpineStep[], now: Date = new Date(), startOrder = 0): StoredTask[] {
  return steps.map((s, i) => ({
    id: `t-${now.getTime()}-${i}`,
    text: s.text,
    done: false,
    created_at: now.toISOString(),
    // Always set. An absent order used to sort as 0 and land wherever the
    // engine's stable sort happened to put it relative to tasks that had
    // one -- the plan's order is not something to leave to chance.
    order: startOrder + i,
    source: s.source,
    origin: 'spine' as const,
    ...(s.estimatedMinutes != null ? { estimated_minutes: s.estimatedMinutes, estimate_set: true } : {}),
  }))
}

/**
 * Generates the spine. Returns an empty list rather than a bad one: a
 * project with no steps is honest and the app already knows how to ask
 * about it, whereas a project with five invented steps looks finished and
 * is worse than useless.
 */
export async function generateTaskSpine(input: SpineInput): Promise<SpineStep[]> {
  const evidence = buildEvidenceFromSaid(input.title, input.endGoal, input.said)
  if (evidence.length === 0) return []

  try {
    const response = await generateText(buildSpinePrompt(input, evidence), {
      responseFormat: 'json',
      // Low, like the session shaper: this is reading a stated goal and
      // working back from it, not inventing a project.
      temperature: 0.3,
      maxTokens: 2000,
    })
    const cleaned = sanitizeSteps(JSON.parse(response)?.steps)
    const { kept, rejected } = filterGrounded(cleaned, evidence, input.title)
    if (rejected.length > 0) {
      console.warn(
        `[task-spine] dropped ${rejected.length} ungrounded step(s) for "${input.title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`),
      )
    }
    return assembleSteps(cleaned, kept).slice(0, MAX_SPINE_STEPS)
  } catch (e) {
    console.error('[task-spine] generation failed:', e)
    return []
  }
}

/**
 * A brand-new project doesn't get a finish line -- an ongoing craft like
 * "producing music" or "DJing" has no "done" to plan backwards from, and
 * forcing one meant either inventing a fake one or rewriting it every time
 * the project moved on. What it does have, from the moment it's created, is
 * a description of what it actually is. That's what these plan FORWARD
 * from: not "what had to be true before done", but "what's a real first
 * move against this".
 */
export interface FirstCutInput {
  title: string
  /** What the project actually is, in the user's words. The anchor —
   *  with nothing here there is nothing to plan from. */
  description: string
  /** Anything else said while creating it -- conversation turns, a first
   *  step they mentioned. Extra evidence, not required. */
  said: string[]
}

export function buildFirstCutEvidence(title: string, description: string, said: string[]): Evidence[] {
  const evidence: Evidence[] = []
  let n = 0
  const add = (label: string, text: string) => {
    if (!text?.trim()) return
    evidence.push({ id: `e${++n}`, label, text: text.trim() })
  }
  add('what this project is', description)
  said.forEach(s => add('from what you said about it', s))
  return evidence
}

export function buildFirstCutPrompt(input: FirstCutInput, evidence: Evidence[]): string {
  return `"${input.title}" is a brand-new project, just started. Give it a first move.

WHAT THIS PROJECT IS:
${evidence.length
  ? evidence.map(e => `[${e.id}] ${e.text}`).join('\n')
  : '(nothing yet)'}

That's the whole of it. Anything not in it, you do not know.

HOW TO DO THIS -- forwards, not backwards:
There's no finish line yet, and none should be invented. Don't plan
backwards from a "done" that doesn't exist. Instead give ${FIRST_CUT_STEPS}
broad first moves: things that would genuinely get someone started today,
which together would fill about an hour.

They should be coarse ON PURPOSE. The precise plan comes later, once
they're actually in it and can see what the real next steps are — naming
the wrong specifics now is worse than leaving them open.

WHAT EACH MOVE MUST BE:
- A physical, concrete action against the work: open, sketch, record,
  write, build, try, make, send, book.
- Broad enough to leave room. "Sketch a rough loop" not "sketch a four-bar
  loop in C minor at 120bpm" — the second one invents specifics nobody
  gave you.
- Something that could plausibly happen in one sitting, today.

WHAT NONE OF THEM MAY BE:
- Admin pretending to be building: research, plan, outline, decide, list,
  consider, review, think about, brainstorm, explore.
- Anything naming a tool, brand, format, instrument, person or place that
  does NOT appear verbatim above.
- A finish line, a deadline, or a description of what "done" looks like —
  that's not what's being asked for here.

Give exactly ${FIRST_CUT_STEPS} moves, in the order they'd make sense to do.
Cite the evidence id each one comes from; a move that names nothing beyond
the project's own title needs no citation.

For each, also guess how long it takes in one sitting. Pick the closest
value from EXACTLY this list: ${ESTIMATE_MINUTES.join(', ')}.

${PLAIN_ENGLISH_RULES}

Respond with JSON only:
{ "steps": [ { "text": "...", "evidence": ["e1"], "estimated_minutes": 15 } ] }`
}

/**
 * Generates the first-cut list. Same honesty rule as the spine: nothing
 * beats an invented set of three, so a project with no description yet
 * gets an empty list back rather than three plausible-sounding guesses.
 */
export async function generateFirstCutTasks(input: FirstCutInput): Promise<SpineStep[]> {
  const evidence = buildFirstCutEvidence(input.title, input.description, input.said)
  if (evidence.length === 0) return []

  try {
    const response = await generateText(buildFirstCutPrompt(input, evidence), {
      responseFormat: 'json',
      temperature: 0.4,
      maxTokens: 800,
    })
    const cleaned = sanitizeSteps(JSON.parse(response)?.steps, FIRST_CUT_STEPS)
    const { kept, rejected } = filterGrounded(cleaned, evidence, input.title)
    if (rejected.length > 0) {
      console.warn(
        `[task-spine] dropped ${rejected.length} ungrounded first-cut step(s) for "${input.title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`),
      )
    }
    return assembleSteps(cleaned, kept).slice(0, FIRST_CUT_STEPS)
  } catch (e) {
    console.error('[task-spine] first-cut generation failed:', e)
    return []
  }
}
