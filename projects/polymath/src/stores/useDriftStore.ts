/**
 * Tracks the current drift session's question so the global voice FAB
 * can wrap any thought captured during a drift with that context. When
 * `active` is null, the FAB behaves normally; when it's set, transcripts
 * are framed as a response to the prompt before being saved.
 */

import { create } from 'zustand'

export interface DriftContext {
  prompt: string
  metaphor?: string | null
  context?: string | null
  mode: 'sleep' | 'break'
}

interface DriftStore {
  active: DriftContext | null
  setActive: (ctx: DriftContext | null) => void
  clear: () => void
}

export const useDriftStore = create<DriftStore>((set) => ({
  active: null,
  setActive: (ctx) => set({ active: ctx }),
  clear: () => set({ active: null }),
}))

/**
 * Wrap a voice transcript with the drift question so the saved thought
 * reads as a coherent response, not a free-floating note. Returns the
 * raw transcript when no drift is active.
 */
export function wrapWithDriftContext(text: string, ctx: DriftContext | null): string {
  if (!ctx) return text
  const lead = ctx.metaphor || ctx.context
  const intro = lead
    ? `Drift prompt — "${lead}" / ${ctx.prompt}`
    : `Drift prompt — ${ctx.prompt}`
  return `${intro}\n\n${text}`
}
