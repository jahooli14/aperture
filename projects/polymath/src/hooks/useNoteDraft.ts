/**
 * useNoteDraft — persists in-progress note content to localStorage so it
 * survives sheet close, refresh, or app kill. Keep-style.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChecklistItem } from '../types'

export interface NoteDraft {
  body: string
  title: string
  isChecklistMode: boolean
  checklistItems: ChecklistItem[]
  memoryType: '' | 'foundational' | 'event' | 'insight' | 'quick-note'
  tags: string
  updatedAt: number
}

const DRAFT_KEY = 'polymath:thought-draft:v1'
const PERSIST_DEBOUNCE_MS = 250

const EMPTY_DRAFT: NoteDraft = {
  body: '',
  title: '',
  isChecklistMode: false,
  checklistItems: [],
  memoryType: '',
  tags: '',
  updatedAt: 0,
}

function readDraft(): NoteDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NoteDraft>
    if (!parsed.body && !parsed.title && !(parsed.checklistItems?.length)) return null
    return { ...EMPTY_DRAFT, ...parsed }
  } catch {
    return null
  }
}

function writeDraft(draft: NoteDraft) {
  try {
    const hasContent =
      draft.body.trim().length > 0 ||
      draft.title.trim().length > 0 ||
      draft.checklistItems.some((i) => i.text.trim().length > 0)
    if (!hasContent) {
      localStorage.removeItem(DRAFT_KEY)
      return
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // localStorage may be full or disabled — degrade silently
  }
}

export function useNoteDraft() {
  // Read once on mount so the dialog can open with the previous draft restored
  const [initialDraft] = useState<NoteDraft | null>(() => readDraft())
  const persistTimer = useRef<number | null>(null)

  const persist = useCallback((draft: Omit<NoteDraft, 'updatedAt'>) => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      writeDraft({ ...draft, updatedAt: Date.now() })
    }, PERSIST_DEBOUNCE_MS)
  }, [])

  const clear = useCallback(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      /* noop */
    }
  }, [])

  useEffect(() => () => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current)
  }, [])

  return { initialDraft, persist, clear }
}
