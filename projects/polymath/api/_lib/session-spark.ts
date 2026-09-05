/**
 * "While you're in there" — one thing to try, from what this week has
 * actually been made of.
 *
 * The lists, the reading and the captures that never got filed are the
 * identity layer: reading a book about cutting things back makes you a
 * different person at the desk than reading one about maximalism. Until
 * now that layer reached the session as `identityLine` — one sentence of
 * ambient tone, deliberately held OUT of the evidence/citation system so
 * it could never become a step. That was the right call while the only
 * alternative was letting it leak into the plan unlabelled.
 *
 * This is the labelled alternative. At most ONE item, and it is:
 *   - cited to a real thing from the week -- a list addition, a highlight,
 *     a capture that never landed on a project. No signal, no spark.
 *   - carrying no taskId, so it is not a step on the project and only ever
 *     becomes one the way every other ungrounded session item does: at
 *     close-out, and only if actually ticked (api/utilities.ts)
 *   - time-boxed and small, so a bad idea costs ten minutes, not the hour
 *   - last in the list, never displacing the real work
 *
 * The source line is built mechanically from the signal it cited, not
 * written by the model — so the receipt under the item ("you've had garage
 * on all week") is always literally true of the corpus rather than a
 * plausible sentence about it.
 *
 * Empty is the common, correct answer. Silence over slop.
 */

import { generateText } from './gemini-chat.js'
import { MODELS } from './models.js'
import { PLAIN_ENGLISH_RULES, CLEAR_STEP_RULES } from './plain-english.js'
import { filterGrounded, type Evidence, type GroundedItem } from './session-grounding.js'
import { sanitizeRawItems, dedupeSimilar } from './session-items.js'
import { nearestEstimate } from './session-estimate.js'

/** Never more than this, whatever the window: the spark is a punt, and a
 *  punt that eats half the sitting isn't a punt. */
const MAX_SPARK_MINUTES = 15
/** Nor more than this share of the window -- ten minutes out of twenty is
 *  a different proposition to ten out of ninety. */
const MAX_SPARK_WINDOW_SHARE = 0.25

/** One thing from the week, already shaped like Evidence so it can go
 *  through the same citation gate as everything else. */
export interface WeekSignal extends Evidence {
  /** Plain phrase naming where it came from, used to build the item's
   *  visible source line: "you've been reading X", "you saved X". */
  source: string
}

export interface SparkInput {
  title: string
  /** What the project is -- so the spark connects to real work rather
   *  than floating free. */
  projectEvidence: Evidence[]
  weekSignals: WeekSignal[]
  /** The session's real steps, so the spark doesn't restate one. */
  currentItems: string[]
  windowMinutes: number | null
}

export function sparkMinutesCap(windowMinutes: number | null): number {
  if (windowMinutes == null) return MAX_SPARK_MINUTES
  return Math.max(5, Math.min(MAX_SPARK_MINUTES, Math.floor(windowMinutes * MAX_SPARK_WINDOW_SHARE)))
}

export function buildSparkPrompt(input: SparkInput): string {
  const { title, projectEvidence, weekSignals, currentItems, windowMinutes } = input
  const current = currentItems.length
    ? currentItems.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(nothing yet)'
  const cap = sparkMinutesCap(windowMinutes)

  return `Someone is about to work on "${title}".

WHAT THIS PROJECT IS:
${projectEvidence.map(e => `[${e.id}] ${e.text}`).join('\n')}

WHAT THEY'VE BEEN INTO LATELY -- outside this project:
${weekSignals.map(s => `[${s.id}] ${s.text}`).join('\n')}

ALREADY ON THE PLAN FOR THIS SESSION:
${current}

Is there ONE small thing worth trying on this project, this sitting,
that comes out of what they've been into lately? Something they'd
probably never have thought of at the desk, because the two things live
in different parts of their head.

It must cite the id of the lately-item it comes from. If nothing up there
genuinely suggests anything, say so with an empty list -- that is the
right answer most of the time, and a forced connection is worse than
none.

Rules:
- ${cap} minutes at the outside. It's a punt, not a plan.
- It has to be doable inside this session, on this project, today.
- Concrete and physical: something they DO, with a result they can hear,
  see or hold by the end of it.
- Never admin: research, plan, outline, decide, list, consider, explore.
- Never a repeat or rewording of anything already on the plan.
- Never name a tool, brand, format, person or place that isn't word for
  word above.
- One line. No explanation -- the app says where it came from itself.

${PLAIN_ENGLISH_RULES}

${CLEAR_STEP_RULES}

Say the project is a song stuck on its second verse, and lately they've
been listening to a lot of garage.
  BAD:  "Explore how garage production techniques could inform the
        arrangement." -- admin, and nobody talks like that.
  BAD:  "Add a Roland TR-909 shuffle." -- no 909 anywhere above.
  GOOD: "Chop a vocal into a stutter under the second half and see if it
        lifts." -- one concrete move, ten minutes, obviously from the
        garage listening.
  ALSO GOOD: an empty list, when the week and the project genuinely have
        nothing to say to each other.

Respond with JSON only:
{ "items": [ { "text": "...", "evidence": ["w1"], "minutes": 10 } ] }`
}

/**
 * At most one item, always labelled, never carrying a taskId. Null when
 * there's no signal, nothing groundable, or the call fails.
 */
export async function sparkForSession(input: SparkInput): Promise<GroundedItem | null> {
  if (input.weekSignals.length === 0 || input.projectEvidence.length === 0) return null
  const cap = sparkMinutesCap(input.windowMinutes)
  try {
    const response = await generateText(buildSparkPrompt(input), {
      model: MODELS.SESSION_SHAPE_CHAT,
      responseFormat: 'json',
      temperature: 0.6,
      maxTokens: 700,
      thinkingLevel: 'low',
    })
    const parsed = JSON.parse(response)
    const raw = Array.isArray(parsed?.items) ? parsed.items.slice(0, 1) : []
    const cleaned = sanitizeRawItems(raw, 1)
    if (cleaned.length === 0) return null

    // Grounded against the union: the spark is legitimately a bridge
    // between the project and the week, so either side may supply the
    // specifics it names -- but something outside both is still invention.
    const allEvidence = [...input.projectEvidence, ...input.weekSignals]
    const { kept, rejected } = filterGrounded(cleaned, allEvidence, input.title)
    if (rejected.length > 0) {
      console.warn(`[session-spark] dropped an ungrounded spark for "${input.title}":`,
        rejected.map(r => `"${r.text}" — ${r.reason}`))
    }
    const deduped = dedupeSimilar(kept, input.currentItems.map(text => ({ text })))
    const item = deduped[0]
    if (!item) return null

    // The signal it actually cited decides the visible source line, so the
    // receipt is true by construction rather than by the model's word.
    const citedId = cleaned[0]?.evidence?.find(id => input.weekSignals.some(s => s.id === id))
    const signal = input.weekSignals.find(s => s.id === citedId)
    if (!signal) return null

    const rawMinutes = typeof (raw[0] as any)?.minutes === 'number' ? (raw[0] as any).minutes : 10
    const minutes = Math.min(cap, nearestEstimate(Math.max(5, rawMinutes)))

    return {
      text: item.text,
      source: `while you're in there — ${signal.source} · ${minutes} min`,
      taskId: null,
      partial: false,
    }
  } catch (e) {
    console.error('[session-spark] failed, going without:', e)
    return null
  }
}
