/**
 * Shared cache for the pending project-idea queue (utilities?resource=
 * project-ideas) — the same evidence-backed rows ProjectIdeasHome's full
 * deck and TodaysAnswerCard's "already noticed" chips both draw from.
 *
 * Before this existed, each component fetched and cached the queue
 * independently. Resolving an idea in one (chip tap, save, reject) left
 * the other showing a stale copy until its own next fetch — in the worst
 * case, acting on the same idea twice from two different surfaces in one
 * session. One store, one fetch, both surfaces read and mutate the same
 * list.
 */

import { create } from 'zustand'
import { api } from '../lib/apiClient'

export interface IdeaEvidence {
  kind: string
  source_id: string
  label: string
  date: string
  excerpt: string
}

export interface ProjectIdea {
  id: string
  batch_id: string
  rank: number
  title: string
  pitch: string
  why_now: string
  next_step: string
  evidence: IdeaEvidence[]
  status: 'pending' | 'saved' | 'rejected' | 'built'
  generated_at: string
  /** 'crossover' for the locked-pairs / permissive paths (the default).
   *  'read' for the longitudinal pattern reader — the row also carries a
   *  non-empty `pattern` and the card leads with it as the hero block.
   *  'hour' for a self-contained one-hour thing, complete start to finish. */
  mode?: 'crossover' | 'read' | 'hour'
  pattern?: string | null
  /** Read-only: model's honest 0–100 self-score on the pattern. */
  confidence?: number | null
  /** Read-mode sub-shape. 'reshape' / 'recent_forgotten' are resurrections. */
  shape?: 'coalescing' | 'recent_forgotten' | 'reshape' | 'extend' | null
}

interface ProjectIdeasResponse {
  ideas: ProjectIdea[]
  generated_at: string | null
  has_any: boolean
}

interface ProjectIdeasStoreState {
  ideas: ProjectIdea[]
  /** True once a fetch has completed (success or failure) — distinct from
   *  `ideas.length === 0`, which is also true before the first fetch ever
   *  runs. Lets a caller show "nothing waiting" only once it actually knows
   *  that, not just because it hasn't asked yet. */
  loaded: boolean
  loading: boolean
  /** Idempotent — whichever surface (ProjectIdeasHome's mount, or
   *  TodaysAnswerCard's first "or steer it" tap) gets here first does the
   *  real fetch; the other just reads the same cached result. */
  load: () => Promise<void>
  /** Full replace — used after a fresh generation returns a new batch. */
  setIdeas: (ideas: ProjectIdea[]) => void
  /** Drops one idea after it's rejected or built, everywhere it's shown. */
  removeIdea: (id: string) => void
}

export const useProjectIdeasStore = create<ProjectIdeasStoreState>((set, get) => ({
  ideas: [],
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })
    try {
      const res = await api.get('utilities?resource=project-ideas') as ProjectIdeasResponse
      // Only pending ideas belong in either deck — saved ideas have become
      // real projects and live in the projects section now.
      const active = (res.ideas ?? []).filter(i => i.status === 'pending').slice(0, 3)
      set({ ideas: active, loaded: true })
    } catch {
      // Swallow — both callers already treat a load failure as "show
      // nothing" rather than surfacing a raw network error.
      set({ loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  setIdeas: (ideas) => set({ ideas, loaded: true }),
  removeIdea: (id) => set(s => ({ ideas: s.ideas.filter(i => i.id !== id) })),
}))
