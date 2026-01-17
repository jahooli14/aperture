import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, generateId, queueForSync } from '../lib/db'
import { generateChecklist, validateScene } from '../lib/validation'
import type {
  ManuscriptState,
  SceneNode,
  NarrativeSection,
  Sense,
  SensoryAuditState,
  Reverberation,
  GlassesMention
} from '../types/manuscript'

interface ManuscriptStore {
  // State
  manuscript: ManuscriptState | null
  activeSceneId: string | null
  isLoading: boolean
  isSyncing: boolean
  pendingSyncCount: number

  // Actions
  createManuscript: (title: string, protagonistName?: string) => Promise<void>
  loadManuscript: (id: string) => Promise<void>
  updateManuscript: (updates: Partial<ManuscriptState>) => Promise<void>
  deleteManuscript: (id: string) => Promise<void>
  getAllManuscripts: () => Promise<ManuscriptState[]>
  clearCurrentManuscript: () => void

  // Scene actions
  createScene: (section: NarrativeSection, title: string) => Promise<SceneNode>
  importScenes: (scenes: { title: string; section: NarrativeSection; prose: string }[]) => Promise<void>
  updateScene: (sceneId: string, updates: Partial<SceneNode>) => Promise<void>
  deleteScene: (sceneId: string) => Promise<void>
  reorderScenes: (sceneIds: string[]) => Promise<void>
  setActiveScene: (sceneId: string | null) => void

  // Mask mode
  toggleMaskMode: () => Promise<void>

  // Sensory tracking
  activateSense: (sense: Sense, sceneId: string) => Promise<void>

  // Reverberations
  addReverberation: (reverberation: Omit<Reverberation, 'id' | 'createdAt'>) => Promise<void>
  linkReverberation: (revId: string, revealSceneId: string) => Promise<void>

  // Glasses mentions
  addGlassesMention: (mention: Omit<GlassesMention, 'id' | 'createdAt'>) => Promise<void>
  updateGlassesMention: (mentionId: string, updates: Partial<GlassesMention>) => Promise<void>

  // Sync
  syncToCloud: () => Promise<void>
}

const defaultSensoryAudit: SensoryAuditState = {
  sight: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
  smell: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
  sound: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
  taste: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 },
  touch: { activated: false, activationSceneId: null, strength: 'weak', occurrences: 0 }
}

export const useManuscriptStore = create<ManuscriptStore>()(
  persist(
    (set, get) => ({
      manuscript: null,
      activeSceneId: null,
      isLoading: false,
      isSyncing: false,
      pendingSyncCount: 0,

      createManuscript: async (title, protagonistName = '') => {
        const now = new Date().toISOString()
        const manuscript: ManuscriptState = {
          id: generateId(),
          title,
          protagonistRealName: protagonistName,
          maskModeEnabled: false,
          currentSection: 'departure',
          totalWordCount: 0,
          scenes: [],
          alexIdentity: {
            alPatterns: [],
            lexiPatterns: [],
            syncStatus: 'synced',
            lastSyncCheck: null
          },
          sensoryAudit: defaultSensoryAudit,
          reverberationLibrary: [],
          revealAuditUnlocked: false,
          createdAt: now,
          updatedAt: now
        }

        await db.manuscripts.put(manuscript)
        await queueForSync({ type: 'create', table: 'manuscripts', data: manuscript as unknown as Record<string, unknown> })

        set({ manuscript })
      },

      loadManuscript: async (id) => {
        set({ isLoading: true })
        try {
          const manuscript = await db.manuscripts.get(id)
          if (manuscript) {
            const scenes = await db.sceneNodes
              .where('manuscriptId')
              .equals(id)
              .sortBy('order')

            manuscript.scenes = scenes as SceneNode[]
            set({ manuscript, isLoading: false })
          }
        } catch (error) {
          console.error('Failed to load manuscript:', error)
          set({ isLoading: false })
        }
      },

      updateManuscript: async (updates) => {
        const { manuscript } = get()
        if (!manuscript) return

        const updated = {
          ...manuscript,
          ...updates,
          updatedAt: new Date().toISOString()
        }

        await db.manuscripts.put(updated)
        await queueForSync({ type: 'update', table: 'manuscripts', data: updated as unknown as Record<string, unknown> })
        set({ manuscript: updated })
      },

      deleteManuscript: async (id) => {
        const { manuscript } = get()

        // Delete all related data
        await db.sceneNodes.where('manuscriptId').equals(id).delete()
        await db.reverberations.where('manuscriptId').equals(id).delete()
        await db.glassesMentions.where('manuscriptId').equals(id).delete()
        await db.speechPatterns.where('manuscriptId').equals(id).delete()
        await db.manuscripts.delete(id)

        await queueForSync({ type: 'delete', table: 'manuscripts', data: { id } })

        // Clear current manuscript if it was the deleted one
        if (manuscript?.id === id) {
          set({ manuscript: null, activeSceneId: null })
        }
      },

      getAllManuscripts: async () => {
        const manuscripts = await db.manuscripts.orderBy('updatedAt').reverse().toArray()
        return manuscripts
      },

      clearCurrentManuscript: () => {
        set({ manuscript: null, activeSceneId: null })
      },

      createScene: async (section, title) => {
        const { manuscript } = get()
        if (!manuscript) throw new Error('No manuscript loaded')

        const now = new Date().toISOString()
        const scene: SceneNode = {
          id: generateId(),
          order: manuscript.scenes.length,
          title,
          section,
          chapterId: null,
          chapterTitle: null,
          sceneNumber: null,
          sceneBeat: null,
          chapterTheme: null,
          charactersPresent: [],
          motifTags: [],
          prose: '',
          footnotes: '',
          wordCount: 0,
          identityType: null,
          sensoryFocus: null,
          senseNotes: null,
          awarenessLevel: null,
          footnoteTone: null,
          status: 'draft',
          validationStatus: 'yellow',
          checklist: [],
          sensesActivated: [],
          glassesmentions: [],
          reverberations: [],
          createdAt: now,
          updatedAt: now,
          pulseCheckCompletedAt: null
        }

        await db.sceneNodes.put({ ...scene, manuscriptId: manuscript.id })
        await queueForSync({ type: 'create', table: 'sceneNodes', data: { ...scene, manuscriptId: manuscript.id } as unknown as Record<string, unknown> })

        const updatedScenes = [...manuscript.scenes, scene]
        set({
          manuscript: { ...manuscript, scenes: updatedScenes, updatedAt: now }
        })

        return scene
      },

      importScenes: async (scenes) => {
        const { manuscript } = get()
        if (!manuscript) throw new Error('No manuscript loaded')

        const now = new Date().toISOString()
        const newScenes: SceneNode[] = []

        for (let i = 0; i < scenes.length; i++) {
          const imported = scenes[i]
          const scene: SceneNode = {
            id: generateId(),
            order: i,
            title: imported.title,
            section: imported.section,
            chapterId: null,
            chapterTitle: null,
            sceneNumber: null,
            sceneBeat: null,
            chapterTheme: null,
            charactersPresent: [],
            motifTags: [],
            prose: imported.prose,
            footnotes: '',
            wordCount: imported.prose.trim().split(/\s+/).filter(Boolean).length,
            identityType: null,
            sensoryFocus: null,
            senseNotes: null,
            awarenessLevel: null,
            footnoteTone: null,
            status: 'draft',
            validationStatus: 'yellow',
            checklist: [],
            sensesActivated: [],
            glassesmentions: [],
            reverberations: [],
            createdAt: now,
            updatedAt: now,
            pulseCheckCompletedAt: null
          }

          await db.sceneNodes.put({ ...scene, manuscriptId: manuscript.id })
          newScenes.push(scene)
        }

        const totalWordCount = newScenes.reduce((sum, s) => sum + s.wordCount, 0)

        set({
          manuscript: {
            ...manuscript,
            scenes: newScenes,
            totalWordCount,
            updatedAt: now
          }
        })
      },

      updateScene: async (sceneId, updates) => {
        const { manuscript } = get()
        if (!manuscript) return

        const sceneIndex = manuscript.scenes.findIndex(s => s.id === sceneId)
        if (sceneIndex === -1) return

        const now = new Date().toISOString()
        let updatedScene = {
          ...manuscript.scenes[sceneIndex],
          ...updates,
          updatedAt: now
        }

        // Recalculate word count
        if (updates.prose !== undefined) {
          updatedScene.wordCount = updates.prose.trim().split(/\s+/).filter(Boolean).length
        }

        // Regenerate checklist if pulse check fields changed
        if (updates.identityType !== undefined ||
            updates.sensoryFocus !== undefined ||
            updates.awarenessLevel !== undefined) {
          updatedScene.checklist = generateChecklist(updatedScene)
        }

        // Revalidate scene
        updatedScene.validationStatus = validateScene(updatedScene)

        const updatedScenes = [...manuscript.scenes]
        updatedScenes[sceneIndex] = updatedScene

        // Update total word count
        const totalWordCount = updatedScenes.reduce((sum, s) => sum + s.wordCount, 0)

        await db.sceneNodes.put({ ...updatedScene, manuscriptId: manuscript.id })
        await queueForSync({ type: 'update', table: 'sceneNodes', data: { ...updatedScene, manuscriptId: manuscript.id } as unknown as Record<string, unknown> })

        set({
          manuscript: { ...manuscript, scenes: updatedScenes, totalWordCount, updatedAt: now }
        })
      },

      deleteScene: async (sceneId: string) => {
        const { manuscript } = get()
        if (!manuscript) return

        const updatedScenes = manuscript.scenes.filter((s: SceneNode) => s.id !== sceneId)

        await db.sceneNodes.delete(sceneId)
        await queueForSync({ type: 'delete', table: 'sceneNodes', data: { id: sceneId } })

        const totalWordCount = updatedScenes.reduce((sum: number, s: SceneNode) => sum + s.wordCount, 0)

        set({
          manuscript: { ...manuscript, scenes: updatedScenes, totalWordCount },
          activeSceneId: get().activeSceneId === sceneId ? null : get().activeSceneId
        })
      },

      reorderScenes: async (sceneIds: string[]) => {
        const { manuscript } = get()
        if (!manuscript) return

        const reorderedScenes = sceneIds.map((id: string, index: number) => {
          const scene = manuscript.scenes.find((s: SceneNode) => s.id === id)!
          return { ...scene, order: index }
        })

        for (const scene of reorderedScenes) {
          await db.sceneNodes.put({ ...scene, manuscriptId: manuscript.id })
        }

        set({ manuscript: { ...manuscript, scenes: reorderedScenes } })
      },

      setActiveScene: (sceneId: string | null) => {
        set({ activeSceneId: sceneId })
      },

      toggleMaskMode: async () => {
        const { manuscript, updateManuscript } = get()
        if (!manuscript) return
        await updateManuscript({ maskModeEnabled: !manuscript.maskModeEnabled })
      },

      activateSense: async (sense: Sense, sceneId: string) => {
        const { manuscript, updateManuscript } = get()
        if (!manuscript) return

        const updatedAudit = { ...manuscript.sensoryAudit }
        updatedAudit[sense] = {
          ...updatedAudit[sense],
          activated: true,
          activationSceneId: sceneId,
          occurrences: updatedAudit[sense].occurrences + 1
        }

        // Update strength based on occurrences
        if (updatedAudit[sense].occurrences >= 5) {
          updatedAudit[sense].strength = 'strong'
        } else if (updatedAudit[sense].occurrences >= 2) {
          updatedAudit[sense].strength = 'moderate'
        }

        await updateManuscript({ sensoryAudit: updatedAudit })
      },

      addReverberation: async (reverberation: Omit<Reverberation, 'id' | 'createdAt'>) => {
        const { manuscript, updateManuscript } = get()
        if (!manuscript) return

        const newReverb: Reverberation = {
          ...reverberation,
          id: generateId(),
          createdAt: new Date().toISOString()
        }

        await db.reverberations.put({ ...newReverb, manuscriptId: manuscript.id })
        await queueForSync({ type: 'create', table: 'reverberations', data: { ...newReverb, manuscriptId: manuscript.id } as unknown as Record<string, unknown> })

        await updateManuscript({
          reverberationLibrary: [...manuscript.reverberationLibrary, newReverb]
        })
      },

      linkReverberation: async (revId: string, revealSceneId: string) => {
        const { manuscript, updateManuscript } = get()
        if (!manuscript) return

        const updatedLibrary = manuscript.reverberationLibrary.map((r: Reverberation) =>
          r.id === revId ? { ...r, linkedRevealSceneId: revealSceneId } : r
        )

        await updateManuscript({ reverberationLibrary: updatedLibrary })
      },

      addGlassesMention: async (mention: Omit<GlassesMention, 'id' | 'createdAt'>) => {
        const { manuscript, updateScene } = get()
        if (!manuscript) return

        const newMention: GlassesMention = {
          ...mention,
          id: generateId(),
          createdAt: new Date().toISOString()
        }

        await db.glassesMentions.put({ ...newMention, manuscriptId: manuscript.id })
        await queueForSync({ type: 'create', table: 'glassesMentions', data: { ...newMention, manuscriptId: manuscript.id } as unknown as Record<string, unknown> })

        const scene = manuscript.scenes.find((s: SceneNode) => s.id === mention.sceneId)
        if (scene) {
          await updateScene(scene.id, {
            glassesmentions: [...scene.glassesmentions, newMention]
          })
        }
      },

      updateGlassesMention: async (mentionId: string, updates: Partial<GlassesMention>) => {
        const { manuscript } = get()
        if (!manuscript) return

        const mention = await db.glassesMentions.get(mentionId)
        if (mention) {
          const updated = { ...mention, ...updates }
          await db.glassesMentions.put(updated)
          await queueForSync({ type: 'update', table: 'glassesMentions', data: updated as unknown as Record<string, unknown> })
        }
      },

      syncToCloud: async () => {
        // TODO: Implement cloud sync with Supabase
        set({ isSyncing: true })
        try {
          // Sync logic will go here
          await new Promise(resolve => setTimeout(resolve, 1000))
        } finally {
          set({ isSyncing: false })
        }
      }
    }),
    {
      name: 'analogue-manuscript',
      partialize: (state: ManuscriptStore) => ({
        manuscript: state.manuscript,
        activeSceneId: state.activeSceneId
      })
    }
  )
)
