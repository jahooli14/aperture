/**
 * The bridge between onboarding and the first time home opens.
 *
 * Everything the app does to keep you moving is built from what you've
 * already said and done: a move comes out of your last note, a question out
 * of your corpus, overnight. On day one there is no last note and no night
 * has passed, so the first open used to land on a project with no move and an
 * empty question slot — a capture tool, not something that drives you.
 *
 * So the moment onboarding has saved what you told it, this does the three
 * things that would otherwise take days:
 *   1. the project you named becomes your live one (you declared it — the app
 *      never picks);
 *   2. its first move is written now, so home opens on Go;
 *   3. the first question is baked now, from your own words, rather than
 *      waiting for the nightly run.
 * Best-effort throughout: onboarding has already succeeded by this point, and
 * anything that fails here simply happens the normal way later.
 */

import { api } from './apiClient'
import { useProjectStore } from '../stores/useProjectStore'
import { chooseLiveStarter } from './liveStarter'

/** At most this many projects get a first move written up front. */
const MAX_FIRST_MOVES = 2

export async function startThingsMoving(createdProjectIds: string[]): Promise<void> {
  const store = useProjectStore.getState()

  const liveId = chooseLiveStarter(createdProjectIds, store.allProjects.filter(p => !createdProjectIds.includes(p.id)))
  if (liveId) {
    try { await store.setPriority(liveId) } catch (e) { console.warn('[start-moving] could not make it live:', e) }
  }

  for (const id of createdProjectIds.slice(0, MAX_FIRST_MOVES)) {
    try {
      await api.post('utilities?resource=move', { project_id: id, action: 'get' }, { timeout: 60_000 })
    } catch (e) {
      console.warn('[start-moving] could not write the first move:', e)
    }
  }
  if (createdProjectIds.length > 0) {
    try { await useProjectStore.getState().fetchProjects() } catch { /* home refetches anyway */ }
  }

  // A thin corpus often has nothing strict enough to ask about, so if the
  // first pass comes back empty, take the looser one: day one is exactly
  // when "nothing worth asking yet" is the wrong answer.
  try {
    const first = await api.post('utilities?resource=reroll-spark', {}, { timeout: 120_000 }) as { rerolled?: boolean }
    if (!first?.rerolled) {
      await api.post('utilities?resource=reroll-spark', { creative: true }, { timeout: 120_000 })
    }
  } catch (e) {
    console.warn('[start-moving] could not bake the first question:', e)
  }
}
