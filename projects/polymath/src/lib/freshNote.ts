/**
 * The receipt for saying something: when a take was built from a note said
 * in the last couple of days, the card says so. Only notes count (a project
 * or a list item has no "said" moment), and only when we know the date.
 */
const DAY = 24 * 60 * 60 * 1000

export function freshNoteLabel(
  sources: { kind: string; at?: string }[] | null | undefined,
  now: number = Date.now(),
): string | null {
  let newest = -1
  for (const s of sources ?? []) {
    if (s.kind !== 'memory' && s.kind !== 'fragment') continue
    const t = s.at ? Date.parse(s.at) : NaN
    if (Number.isNaN(t) || t > now) continue
    newest = Math.max(newest, t)
  }
  if (newest < 0) return null
  const age = now - newest
  if (age <= DAY) return 'Built from what you said today.'
  if (age <= 2 * DAY) return 'Built from what you said yesterday.'
  return null
}
