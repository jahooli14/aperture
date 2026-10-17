/**
 * A project's one next move (api/_lib/next-move.ts), and the few calls that
 * change it. This used to be the session store: start, timer, close-out. The
 * session is gone (nobody presses start and stop; the main button is Update,
 * UpdateSheet.tsx), and what is left is just the move.
 */

import { create } from 'zustand'
import { useProjectStore } from './useProjectStore'

/** The one next move, as the server stores it (metadata.next_move). */
export interface SessionMove {
  text: string
  kind: 'move' | 'fork'
  from?: string
  written_at?: string
}

export type MoveChange =
  | { action: 'feedback'; reason: 'too_big' | 'wrong_thing'; text?: undefined }
  | { action: 'say' | 'answer' | 'set'; text: string; reason?: undefined }

export function readStoredMove(metadata: unknown): SessionMove | null {
  const m = (metadata as { next_move?: Partial<SessionMove> } | null | undefined)?.next_move
  if (!m || typeof m.text !== 'string' || !m.text.trim()) return null
  return { text: m.text.trim(), kind: m.kind === 'fork' ? 'fork' : 'move', from: m.from, written_at: m.written_at }
}

/** Keep the cached project in step, so the card shows the new move at once. */
function patchCachedMove(projectId: string, move: SessionMove) {
  const store = useProjectStore.getState()
  const project = store.allProjects.find(p => p.id === projectId)
  if (!project) return
  useProjectStore.setState({
    allProjects: store.allProjects.map(p =>
      p.id === projectId ? { ...p, metadata: { ...(p.metadata ?? {}), next_move: move } } : p),
  })
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

interface MoveState {
  /** The project's one next move, and which project it's for. */
  move: SessionMove | null
  moveFor: string | null
  moveBusy: boolean
  error: string | null
  /** Shows the stored move at once (it's in the cached project), then
   *  asks the server only if there isn't one. */
  loadMove: (projectId: string) => Promise<void>
  /** "Too big" / "wrong thing", their own words, a fork answer, or a move
   *  they wrote themselves -- each comes back as a new move. */
  reworkMove: (projectId: string, change: MoveChange) => Promise<void>
  /** The move was just done and no new one came back: drop it, so it is
   *  never offered again as "next". */
  forgetMove: (projectId: string) => void
  /** Puts a move the server just wrote (an Update on a one-off) on the card. */
  setMove: (projectId: string, move: SessionMove) => void
  declareLive: (projectId: string) => Promise<void>
  /** "That's mix 5 — line up the next one." Files what the finished one
   *  took and plans the next from that shape. */
  startNextCycle: (projectId: string) => Promise<boolean>
}

export const useMoveStore = create<MoveState>((set, get) => ({
  move: null,
  moveFor: null,
  moveBusy: false,
  error: null,

  loadMove: async (projectId) => {
    const cached = useProjectStore.getState().allProjects.find(p => p.id === projectId)
    const stored = readStoredMove(cached?.metadata)
    set({ move: stored, moveFor: projectId, error: null })
    if (stored) return
    set({ moveBusy: true })
    try {
      const { move } = await postJson<{ move: SessionMove }>(
        '/api/utilities?resource=move', { project_id: projectId, action: 'get' },
      )
      // Cache it on the project too, so the card and the page can swap in
      // the move the moment it lands.
      patchCachedMove(projectId, move)
      if (get().moveFor === projectId) set({ move, moveBusy: false })
    } catch (e) {
      console.error('[move] could not get the next move:', e)
      set({ moveBusy: false })
    }
  },

  reworkMove: async (projectId, change) => {
    set({ moveBusy: true, error: null })
    try {
      const { move } = await postJson<{ move: SessionMove }>(
        '/api/utilities?resource=move',
        { project_id: projectId, action: change.action, reason: change.reason, text: change.text },
      )
      set({ move, moveFor: projectId, moveBusy: false })
      patchCachedMove(projectId, move)
    } catch (e) {
      console.error('[move] could not change the move:', e)
      set({ moveBusy: false, error: 'Couldn’t change it just now — the move is as it was.' })
    }
  },

  forgetMove: (projectId) => {
    if (get().moveFor === projectId) set({ move: null })
    const store = useProjectStore.getState()
    useProjectStore.setState({
      allProjects: store.allProjects.map(p => {
        if (p.id !== projectId || !p.metadata) return p
        const { next_move: _gone, ...rest } = p.metadata as Record<string, unknown>
        return { ...p, metadata: rest as typeof p.metadata }
      }),
    })
  },

  setMove: (projectId, move) => {
    set({ move, moveFor: projectId })
    patchCachedMove(projectId, move)
  },

  declareLive: async (projectId) => {
    await postJson('/api/utilities?resource=declare-live', { project_id: projectId })
  },

  startNextCycle: async (projectId) => {
    try {
      await postJson('/api/utilities?resource=next-cycle', { project_id: projectId })
      // The project's task list has just been rewritten server-side, so the
      // cached copy is now wrong.
      await useProjectStore.getState().fetchProjects()
      return true
    } catch (e) {
      console.error('[move] could not line up the next one:', e)
      return false
    }
  },
}))
