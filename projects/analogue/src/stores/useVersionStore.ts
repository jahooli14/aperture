import { create } from 'zustand'
import { db, generateId } from '../lib/db'
import type { ManuscriptVersion, ManuscriptVersionScene } from '../lib/db'
import type { ManuscriptState } from '../types/manuscript'

export type { ManuscriptVersion }

interface VersionStore {
  versions: ManuscriptVersion[]
  isLoading: boolean
  error: string | null

  loadVersions: () => Promise<void>
  saveVersion: (name: string, manuscript: ManuscriptState) => Promise<void>
  deleteVersion: (id: string) => Promise<void>
  clearError: () => void
}

export const useVersionStore = create<VersionStore>()((set) => ({
  versions: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadVersions: async () => {
    set({ isLoading: true })
    try {
      const versions = await db.manuscriptVersions.orderBy('timestamp').reverse().toArray()
      set({ versions, isLoading: false })
    } catch {
      set({ isLoading: false, error: 'Failed to load versions' })
    }
  },

  saveVersion: async (name, manuscript) => {
    set({ isLoading: true, error: null })
    try {
      const scenes: ManuscriptVersionScene[] = manuscript.scenes.map(s => ({
        id: s.id,
        title: s.title,
        section: s.section,
        order: s.order,
        prose: s.prose,
        footnotes: s.footnotes,
        sceneBeat: s.sceneBeat,
        wordCount: s.wordCount,
      }))

      const version: ManuscriptVersion = {
        id: generateId(),
        name: name.trim() || defaultVersionName(),
        timestamp: Date.now(),
        wordCount: manuscript.totalWordCount,
        sceneCount: manuscript.scenes.length,
        scenes,
      }

      await db.manuscriptVersions.add(version)
      set(state => ({ versions: [version, ...state.versions], isLoading: false }))
    } catch {
      set({ isLoading: false, error: 'Failed to save version' })
    }
  },

  deleteVersion: async (id) => {
    try {
      await db.manuscriptVersions.delete(id)
      set(state => ({ versions: state.versions.filter(v => v.id !== id) }))
    } catch {
      set({ error: 'Failed to delete version' })
    }
  },
}))

function defaultVersionName(): string {
  const now = new Date()
  return now.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' +
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
