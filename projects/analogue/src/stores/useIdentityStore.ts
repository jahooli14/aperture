import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SpeechPattern, PatternOccurrence } from '../types/manuscript'
import { generateId } from '../lib/db'

interface IdentityStore {
  // Al (Doctor) patterns
  alPatterns: SpeechPattern[]

  // Lexi (Villager) patterns
  lexiPatterns: SpeechPattern[]

  // Sync status
  syncStatus: 'synced' | 'divergent' | 'needs-review'
  divergentPatterns: string[] // IDs of patterns that don't match

  // Actions
  addAlPattern: (phrase: string, sceneId: string, position: number, context: string) => void
  addLexiPattern: (phrase: string, sceneId: string, position: number, context: string) => void

  removePattern: (patternId: string, character: 'al' | 'lexi') => void

  checkSync: () => void
  markAsReviewed: (patternId: string) => void

  // Get combined "Alex" voice
  getAlexPatterns: () => SpeechPattern[]
}

export const useIdentityStore = create<IdentityStore>()(
  persist(
    (set, get) => ({
      alPatterns: [],
      lexiPatterns: [],
      syncStatus: 'synced',
      divergentPatterns: [],

      addAlPattern: (phrase, sceneId, position, context) => {
        const { alPatterns } = get()

        // Check if pattern already exists
        const existing = alPatterns.find(p =>
          p.phrase.toLowerCase() === phrase.toLowerCase()
        )

        if (existing) {
          const occurrence: PatternOccurrence = { sceneId, position, context }
          const updated = alPatterns.map(p =>
            p.id === existing.id
              ? { ...p, occurrences: [...p.occurrences, occurrence] }
              : p
          )
          set({ alPatterns: updated })
        } else {
          const newPattern: SpeechPattern = {
            id: generateId(),
            phrase,
            characterSource: 'al',
            occurrences: [{ sceneId, position, context }]
          }
          set({ alPatterns: [...alPatterns, newPattern] })
        }

        get().checkSync()
      },

      addLexiPattern: (phrase, sceneId, position, context) => {
        const { lexiPatterns } = get()

        const existing = lexiPatterns.find(p =>
          p.phrase.toLowerCase() === phrase.toLowerCase()
        )

        if (existing) {
          const occurrence: PatternOccurrence = { sceneId, position, context }
          const updated = lexiPatterns.map(p =>
            p.id === existing.id
              ? { ...p, occurrences: [...p.occurrences, occurrence] }
              : p
          )
          set({ lexiPatterns: updated })
        } else {
          const newPattern: SpeechPattern = {
            id: generateId(),
            phrase,
            characterSource: 'lexi',
            occurrences: [{ sceneId, position, context }]
          }
          set({ lexiPatterns: [...lexiPatterns, newPattern] })
        }

        get().checkSync()
      },

      removePattern: (patternId, character) => {
        if (character === 'al') {
          set({ alPatterns: get().alPatterns.filter(p => p.id !== patternId) })
        } else {
          set({ lexiPatterns: get().lexiPatterns.filter(p => p.id !== patternId) })
        }
        get().checkSync()
      },

      checkSync: () => {
        const { alPatterns, lexiPatterns } = get()

        // Find patterns that should be shared (appear in both Al and Lexi)
        // but have different phrasing or are missing from one
        const divergent: string[] = []

        // Al patterns that don't have a Lexi equivalent
        for (const alP of alPatterns) {
          const hasLexi = lexiPatterns.some(lp =>
            lp.phrase.toLowerCase() === alP.phrase.toLowerCase()
          )
          if (!hasLexi && alP.occurrences.length > 1) {
            // Significant pattern missing from Lexi
            divergent.push(alP.id)
          }
        }

        // Lexi patterns that don't have an Al equivalent
        for (const lexiP of lexiPatterns) {
          const hasAl = alPatterns.some(ap =>
            ap.phrase.toLowerCase() === lexiP.phrase.toLowerCase()
          )
          if (!hasAl && lexiP.occurrences.length > 1) {
            divergent.push(lexiP.id)
          }
        }

        const syncStatus = divergent.length === 0
          ? 'synced'
          : divergent.length > 3
            ? 'divergent'
            : 'needs-review'

        set({ syncStatus, divergentPatterns: divergent })
      },

      markAsReviewed: (patternId) => {
        set({
          divergentPatterns: get().divergentPatterns.filter(id => id !== patternId)
        })
        // Recheck sync after marking reviewed
        const remaining = get().divergentPatterns
        set({
          syncStatus: remaining.length === 0 ? 'synced' : 'needs-review'
        })
      },

      getAlexPatterns: () => {
        const { alPatterns, lexiPatterns } = get()

        // Merge patterns, combining occurrences for matching phrases
        const combined: SpeechPattern[] = [...alPatterns]

        for (const lexiP of lexiPatterns) {
          const existing = combined.find(p =>
            p.phrase.toLowerCase() === lexiP.phrase.toLowerCase()
          )

          if (existing) {
            // Merge occurrences
            const mergedOccurrences = [
              ...existing.occurrences,
              ...lexiP.occurrences
            ].sort((a, b) => a.position - b.position)

            const index = combined.findIndex(p => p.id === existing.id)
            combined[index] = { ...existing, occurrences: mergedOccurrences }
          } else {
            combined.push(lexiP)
          }
        }

        return combined
      }
    }),
    {
      name: 'analogue-identity'
    }
  )
)
