/**
 * The project page's sit-down card, worked out once so each fact is said
 * once: where you are, what you've said since, what's next.
 *
 * Pure, so the rules can be tested without the page.
 */

/** Text the app wrote, not the person: the old close-out logged a ticked
 *  move as "Did: <move>. Done when <check>." and it was saved as if they'd
 *  said it. Never quote that back as their words. */
export function isOwnWords(text: string | null | undefined): text is string {
  if (!text) return false
  const t = text.trim()
  if (t.length < 25) return false // "Done." is an acknowledgement, not a note
  if (/^did:/i.test(t)) return false
  if (/\bdone when\b/i.test(t)) return false
  return true
}

export interface Dated { text: string; at: string }

/** One "where you are" line. The newest wins: your own last Update beats an
 *  older summary of your notes, and a summary beats an older Update. */
export function pickWhere(input: {
  summary?: { text: string; at: string | null } | null
  closeout?: { text: string | null; at: string | null } | null
}): { text: string; at: string | null; own: boolean } | null {
  const own = input.closeout && isOwnWords(input.closeout.text)
    ? { text: input.closeout.text!.trim(), at: input.closeout.at, own: true }
    : null
  const sum = input.summary?.text?.trim()
    ? { text: input.summary.text.trim(), at: input.summary.at, own: false }
    : null
  if (own && sum) {
    const o = own.at ? Date.parse(own.at) : 0
    const s = sum.at ? Date.parse(sum.at) : 0
    return o >= s ? own : sum
  }
  return own ?? sum
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Notes said after the "where you are" line, minus that line itself. */
export function sinceLastTime(updates: Dated[], whereAt: string | null, whereText: string | null): Dated[] {
  const cutoff = whereAt ? Date.parse(whereAt) : NaN
  const key = whereText ? norm(whereText).slice(0, 60) : null
  return updates.filter(u => {
    if (key && norm(u.text).slice(0, 60) === key) return false
    if (Number.isNaN(cutoff)) return false
    return Date.parse(u.at) > cutoff
  })
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'my', 'your', 'it', 'into', 'for', 'with', 'at', 'is', 'be', 'all', 'every', 'everything', 'this', 'that'])
const words = (s: string) => new Set(norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w)))

/** The move says what one of their own threads already says. On an ongoing
 *  project the thread is theirs and the move is the app's guess, so the
 *  move is the one that steps aside. */
export function moveRepeatsAThread(threads: string[], move: string | null): boolean {
  if (!move) return false
  const m = words(move)
  return threads.some(t => {
    const w = [...words(t)]
    if (w.length === 0) return false
    return w.filter(x => m.has(x)).length / w.length >= 0.6
  })
}

/** "Updates" rows arrive as "Title — body". The title is the app's
 *  summary of the body, so show the body: it's what was said. */
export function spokenPart(text: string): string {
  const i = text.indexOf(' — ')
  const body = i > 0 ? text.slice(i + 3).trim() : text.trim()
  return body.replace(/^spark response[,:]?\s*/i, '') || text.trim()
}
