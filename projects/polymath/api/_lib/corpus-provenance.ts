/**
 * Which rows in the corpus did the user say, and which did the app cause?
 *
 * The mull channel's whole claim rests on the corpus being a record of what
 * someone said unprompted. `corpus-time.ts` computes facts like "they have
 * kept coming back to this since March 2023" precisely because nobody can
 * hallucinate a timestamp.
 *
 * An app-caused note breaks that. Answer a question about a project that has
 * been silent fourteen months and the answer is filed under that project,
 * dated today — so the next run reports "they went quiet about this for
 * fourteen months and came back to it a day ago." They didn't. The app poked
 * them, and then read its own poke as evidence. The same write resets the
 * project's silence to zero, so nothing the channel asks about can ever be
 * `went_quiet` again: it burns its best material by using it.
 *
 * So provenance is marked at insert and filtered at read. These notes are
 * still real thoughts — searchable, embedded, readable — they just don't
 * count as *captures* on anyone's timeline.
 *
 * This is not new debt. Morning follow-ups and bedtime syntheses have been
 * flowing in unmarked for months; answering a question daily would only have
 * multiplied a leak that was already open.
 */

/** A voiced answer to one of the app's own questions. */
export const SPARK_RESPONSE_TAG = 'spark-response'

/**
 * Every tag meaning "the app caused this row to exist".
 *
 * Kept as one list so a new app-authored note type is one line here rather
 * than a new hole in six queries.
 */
export const APP_AUTHORED_TAGS = [
  SPARK_RESPONSE_TAG,
  'morning-followup',
  'bedtime-synthesis',
  'proposal-rejected',
] as const

export interface MaybeTagged {
  tags?: string[] | null
}

/** True when the app caused this row, so it is not evidence of what the user does unprompted. */
export function isAppAuthored(row: MaybeTagged | null | undefined): boolean {
  const tags = row?.tags
  if (!Array.isArray(tags)) return false
  return tags.some(t => (APP_AUTHORED_TAGS as readonly string[]).includes(t))
}

/**
 * Drop app-authored rows.
 *
 * Filtered in JS on purpose. `tags` is nullable, and PostgREST's `.not(...)`
 * and `.neq()` drop NULL rows — so a query-level filter would silently hide
 * every untagged note, which is almost the entire corpus. That trap has cost
 * this codebase a day at least twice.
 */
export function userSaid<T extends MaybeTagged>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter(r => !isAppAuthored(r))
}
