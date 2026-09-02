/**
 * When the app can't fill a session honestly, which single question is
 * worth asking?
 *
 * "What are you working on?" is a shrug. It gets a vague answer, stores it
 * as another undifferentiated note, and the app is no better placed next
 * time. The useful question is the one that closes the specific gap that
 * stopped the plan — and its answer should be filed as the thing it is,
 * so it fixes the PROJECT rather than padding this one session.
 *
 * Ranked, and deterministic: picking the question is code, not a model
 * call. A model asked to choose what it doesn't know is back in the
 * business of guessing.
 */

export type GapKind = 'first_step' | 'next_step' | 'slot'

export interface GapInput {
  title: string
  endGoal: string | null
  lastCloseout: string | null
  openTaskCount: number
  /** Names of slots the project has never filled in. */
  unfilledSlots: string[]
}

export interface Gap {
  kind: GapKind
  question: string
  /** The slot this answer fills, when kind is 'slot'. */
  slotName?: string
}

/** Does the close-out already say what comes next? */
export function closeoutNamesNextStep(text: string | null): boolean {
  if (!text) return false
  return /\b(next|then|tomorrow|after that|still (?:need|needs|to)|carry on|pick up)\b/i.test(text)
}

/** A short, quotable piece of the close-out to say back to them. */
export function quoteCloseout(text: string, maxWords = 12): string {
  const words = text.trim().replace(/\s+/g, ' ').split(' ')
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`
}

export function pickGap(input: GapInput): Gap | null {
  // The finish line is never asked for. An ongoing project has none, and
  // the app plans forward from what the project is when it's missing
  // (project-shaping.ts, session-shaper.ts). When the user volunteers one
  // it is used; it is not a gate.

  // 1. Nothing started. Ask for the first real thing, not a plan.
  if (!input.lastCloseout?.trim() && input.openTaskCount === 0) {
    return {
      kind: 'first_step',
      question: `What's the first thing that has to exist for ${input.title}?`,
    }
  }

  // 2. A close-out that says where they got to but not where they're going.
  //    Quoting it back means they answer from memory instead of reconstructing.
  if (input.lastCloseout?.trim() && !closeoutNamesNextStep(input.lastCloseout)) {
    return {
      kind: 'next_step',
      question: `Last time you said "${quoteCloseout(input.lastCloseout)}" — what's the next bit?`,
    }
  }

  // 3. A named open question on the project that has never been answered.
  if (input.unfilledSlots.length > 0) {
    const slotName = input.unfilledSlots[0]
    return {
      kind: 'slot',
      question: `You still haven't picked a ${slotName} for ${input.title}. Got one?`,
      slotName,
    }
  }

  return null
}

/** The fallback when nothing specific is missing but there's still too
 *  little to work from. Plain, and honest that it's the app's limit. */
export function genericGapQuestion(title: string): string {
  return `That's all I can say for certain about ${title}. What are you working on with it right now?`
}
