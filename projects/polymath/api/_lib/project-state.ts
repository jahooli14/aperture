/**
 * What "this project is dead" actually means in storage, in one place.
 *
 * There are two independent fields and only one obvious-looking guard.
 * `state: 'harvested'` is set by completion or by drift-decay silently
 * letting a stalled project go (drift-runner.ts). But burying a project
 * by hand ("send to graveyard", projects.ts) sets `status: 'abandoned'`
 * and leaves `state` at `'mull'` -- the two fields track different
 * events and neither implies the other.
 *
 * Six call sites across the codebase used to guard against a dead
 * project with `.neq('state', 'harvested')` alone: composite-generator's
 * stalled-project pool, fragments' best-project-match for a new memory,
 * retro-parser's title match, slot-seed's backfill, drift-runner's own
 * candidate pool, and the mull channel's project subjects and required
 * connectors. Every one of them let a project the user had explicitly
 * buried through, because none of them looked at `status`. A project
 * that's dead by either signal is dead everywhere this matters.
 */
export function isGraveyarded(project: { state?: string | null; status?: string | null }): boolean {
  return project.state === 'harvested' || project.status === 'abandoned'
}
