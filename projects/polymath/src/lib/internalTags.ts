/**
 * Tags the app writes for its own bookkeeping, never something the user
 * typed. Mirrors corpus-provenance.ts's APP_AUTHORED_TAGS on the API side
 * (duplicated rather than imported -- src/ doesn't reach across into
 * api/_lib/ in this codebase). Never shown as a generic tag pill, never
 * exposed in a plain-text tag editor.
 */
export const APP_AUTHORED_TAGS = [
  'spark-response',
  'spark-correction',
  'morning-followup',
  'bedtime-synthesis',
  'proposal-rejected',
]

/** offline-pending is a different kind of internal tag -- sync state, not
 *  note provenance -- but the same rule applies: never a generic pill. */
export const NEVER_SHOWN_AS_TAG = [...APP_AUTHORED_TAGS, 'offline-pending']
