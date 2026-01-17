import { create } from 'zustand'

interface EditorStore {
  // Footnote drawer state
  footnoteDrawerOpen: boolean
  footnoteDrawerHeight: number // percentage

  // Selection for tagging
  selectedText: string
  selectionStart: number
  selectionEnd: number

  // UI state
  showPulseCheck: boolean
  showReverbTagging: boolean
  showSensoryAudit: boolean
  showRevealAudit: boolean
  focusMode: boolean
  lastSavedAt: number | null
  isSaving: boolean

  // Actions
  openFootnoteDrawer: () => void
  closeFootnoteDrawer: () => void
  setFootnoteDrawerHeight: (height: number) => void

  setSelection: (text: string, start: number, end: number) => void
  clearSelection: () => void

  setShowPulseCheck: (show: boolean) => void
  setShowReverbTagging: (show: boolean) => void
  setShowSensoryAudit: (show: boolean) => void
  setShowRevealAudit: (show: boolean) => void
  toggleFocusMode: () => void
  setSaving: (saving: boolean) => void
  markSaved: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  // Initial state
  footnoteDrawerOpen: false,
  footnoteDrawerHeight: 30,
  selectedText: '',
  selectionStart: 0,
  selectionEnd: 0,
  showPulseCheck: false,
  showReverbTagging: false,
  showSensoryAudit: false,
  showRevealAudit: false,
  focusMode: false,
  lastSavedAt: null,
  isSaving: false,

  // Actions
  openFootnoteDrawer: () => set({ footnoteDrawerOpen: true }),
  closeFootnoteDrawer: () => set({ footnoteDrawerOpen: false }),
  setFootnoteDrawerHeight: (height) => set({ footnoteDrawerHeight: Math.min(70, Math.max(20, height)) }),

  setSelection: (text, start, end) => set({
    selectedText: text,
    selectionStart: start,
    selectionEnd: end
  }),
  clearSelection: () => set({
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0
  }),

  setShowPulseCheck: (show) => set({ showPulseCheck: show }),
  setShowReverbTagging: (show) => set({ showReverbTagging: show }),
  setShowSensoryAudit: (show) => set({ showSensoryAudit: show }),
  setShowRevealAudit: (show) => set({ showRevealAudit: show }),
  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
  setSaving: (saving) => set({ isSaving: saving }),
  markSaved: () => set({ lastSavedAt: Date.now(), isSaving: false })
}))
