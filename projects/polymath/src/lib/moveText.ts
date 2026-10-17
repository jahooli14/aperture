/**
 * A first move ends "Done when …" (plain-english.ts, FIRST_MOVE_RULES).
 * On screen that's two things: the move, which is what you do, and the
 * stopping point, which is quieter and sits under it. Text without one
 * comes back whole.
 */
export function splitDoneWhen(text: string): { move: string; doneWhen: string | null } {
  const m = text.match(/^(.*?[.!?])\s+(done when\b.*)$/i)
  if (!m) return { move: text, doneWhen: null }
  return { move: m[1].trim(), doneWhen: m[2].trim().replace(/^done when/i, 'Done when') }
}
