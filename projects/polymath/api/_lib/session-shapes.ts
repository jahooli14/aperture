/**
 * Session shapes — turning "what should I do" into a 1-3 item list without
 * ever asking the user to write a to-do list.
 *
 * SPEC.md's derivation order:
 *   1. The last close-out. "What's next" from the previous session IS the
 *      next shape — the primary source, and the reason close-out is
 *      non-negotiable.
 *   2. Empty slots. No first track -> "find one" is a real 20-minute shape.
 *   3. Decomposition, only when the window is smaller than the project's
 *      minimum viable session: split the stated next move into a piece
 *      that fits, and say plainly it isn't the whole thing.
 *   4. A brand-new project (no closeout, no slots, no MVS) has no shapes at
 *      all -- its first session is always a "start it" shape.
 *
 * Pure and synchronous on purpose: this is the thing a wrong answer costs
 * the most for (a bad list at the top of a rare hour), so it stays testable
 * without a database or a model call. The one place a model belongs is
 * turning a chosen shape's text into something specific -- that happens
 * upstream of this function, not inside it.
 */

export interface SlotInput {
  name: string
  filled: boolean
}

export interface ShapeInput {
  lastClosingText: string | null
  slots: SlotInput[]
  mvsMinutes: number | null
  windowMinutes: number | null
}

export interface SessionShape {
  text: string
  source: 'closeout' | 'slot' | 'decomposition' | 'start'
  /** True when this shape is a deliberately partial piece of a bigger move. */
  partial: boolean
}

const MAX_ITEMS = 3

/**
 * Everything after "next:" (or the whole text, if there's no such marker)
 * read back as the shape. Close-out capture doesn't force users into a
 * "what's next" sentence structure, so this degrades gracefully to just
 * quoting the whole close-out rather than inventing structure that wasn't
 * there.
 */
function shapeFromCloseout(text: string): SessionShape {
  const marker = /next[:\-]\s*/i
  const match = text.match(marker)
  const body = match ? text.slice((match.index ?? 0) + match[0].length).trim() : text.trim()
  return { text: body || text.trim(), source: 'closeout', partial: false }
}

function shapeFromSlot(slot: SlotInput): SessionShape {
  return { text: `Find or decide: ${slot.name}`, source: 'slot', partial: false }
}

/**
 * Only invoked when the window is smaller than MVS. Deliberately vague
 * ("first piece of") rather than pretending to know what a sub-slice looks
 * like -- that judgement belongs to whatever's calling this (a model with
 * the actual project context), not to this pure function.
 */
function decompose(baseShape: SessionShape): SessionShape {
  return {
    text: `A first piece of: ${baseShape.text}`,
    source: 'decomposition',
    partial: true,
  }
}

export function deriveSessionShapes(input: ShapeInput): SessionShape[] {
  const shapes: SessionShape[] = []

  if (input.lastClosingText && input.lastClosingText.trim().length > 0) {
    shapes.push(shapeFromCloseout(input.lastClosingText))
  }

  for (const slot of input.slots) {
    if (shapes.length >= MAX_ITEMS) break
    if (!slot.filled) shapes.push(shapeFromSlot(slot))
  }

  if (shapes.length === 0) {
    return [{ text: 'Start it.', source: 'start', partial: false }]
  }

  const needsDecomposition =
    input.mvsMinutes != null &&
    input.windowMinutes != null &&
    input.windowMinutes < input.mvsMinutes

  if (needsDecomposition) {
    return [decompose(shapes[0])]
  }

  return shapes.slice(0, MAX_ITEMS)
}

/**
 * MVS is unseeded (null) until either the user answers the one-line seeding
 * question or three "moved" sessions exist to measure from. Call sites use
 * this to decide whether to ask the seeding question this session.
 */
export function needsMvsSeed(mvsMinutes: number | null, priorSessionCount: number): boolean {
  return mvsMinutes == null && priorSessionCount === 0
}

/**
 * The 25th-percentile duration of sessions that moved, per SPEC.md. Takes
 * only durations that already passed the `moved` filter -- callers query
 * for that, this just does the percentile so the math is unit-testable
 * without a database.
 */
export function measuredMvs(movedDurationsMinutes: number[]): number | null {
  if (movedDurationsMinutes.length < 3) return null
  const sorted = [...movedDurationsMinutes].sort((a, b) => a - b)
  const idx = Math.floor(sorted.length * 0.25)
  return sorted[Math.min(idx, sorted.length - 1)]
}
