import { create } from 'zustand'

export interface ProseSnapshot {
  prose: string
  timestamp: number
  trigger: string
}

interface ProseHistoryStore {
  snapshots: Record<string, ProseSnapshot[]>
  snapshot: (sceneId: string, prose: string, trigger: string) => void
  getSnapshots: (sceneId: string) => ProseSnapshot[]
  hasSnapshots: (sceneId: string) => boolean
  remove: (sceneId: string, index: number) => void
  clearScene: (sceneId: string) => void
}

const MAX_SNAPSHOTS = 10

export const useProseHistoryStore = create<ProseHistoryStore>()((set, get) => ({
  snapshots: {},

  snapshot: (sceneId, prose, trigger) => {
    set(state => {
      const existing = state.snapshots[sceneId] ?? []
      const entry: ProseSnapshot = { prose, timestamp: Date.now(), trigger }
      return { snapshots: { ...state.snapshots, [sceneId]: [entry, ...existing].slice(0, MAX_SNAPSHOTS) } }
    })
  },

  getSnapshots: (sceneId) => get().snapshots[sceneId] ?? [],

  hasSnapshots: (sceneId) => (get().snapshots[sceneId]?.length ?? 0) > 0,

  remove: (sceneId, index) => {
    set(state => {
      const updated = (state.snapshots[sceneId] ?? []).filter((_, i) => i !== index)
      return { snapshots: { ...state.snapshots, [sceneId]: updated } }
    })
  },

  clearScene: (sceneId) => {
    set(state => {
      const { [sceneId]: _removed, ...rest } = state.snapshots
      return { snapshots: rest }
    })
  },
}))
