/**
 * Should we ask for a verdict on the way out?
 *
 * The verdict is the only thing that lets an article into the corpus
 * (reading-corpus.ts), and it is deliberately strict. But the two buttons
 * live at the END of the article, and almost nobody reaches the end — so
 * the gate was working perfectly against an input that was never filled.
 * Live: 297 articles, zero verdicts, across the whole life of the feature.
 *
 * The rule is not the problem and is not being loosened. What is being
 * fixed is where it is reachable from: you leave a piece by going back, by
 * swiping, by pressing Escape — anywhere but the bottom. So ask there too.
 *
 * Asked once, never twice, and only of someone who actually read enough to
 * have an opinion. A prompt on an article you opened and immediately closed
 * is a nag about something you have no view on.
 */

/** Read enough to have a view. Below this you bounced off it. */
export const ENOUGH_READ_PERCENT = 25

export interface VerdictPromptState {
  /** Their verdict, if they have already given one. */
  resonance: string | null | undefined
  /** How far down the article they got, 0-100. */
  progress: number
  /** Whether this article has already been asked about this visit. */
  alreadyAsked: boolean
}

export function shouldAskVerdict(s: VerdictPromptState): boolean {
  if (s.resonance) return false
  if (s.alreadyAsked) return false
  return s.progress >= ENOUGH_READ_PERCENT
}
