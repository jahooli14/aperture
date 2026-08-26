/**
 * The session contract (SPEC.md) — declare a live project, open a session,
 * run the timer, capture the close-out. This is the foundation the rest of
 * the rebuild depends on: `last_closeout_text` only exists once a session
 * has actually been closed.
 *
 * Deliberately thin: network calls and timer bookkeeping only. The UI
 * (SessionContract.tsx) owns the two-minute opening flow and the voice
 * capture; this store just holds what's in flight.
 */

import { create } from 'zustand'

export interface SessionShape {
  text: string
  source: 'closeout' | 'slot' | 'decomposition' | 'start' | 'ignition'
  partial: boolean
}

/** The windows the card offers. Not a gate -- a control on the card. */
export const WINDOW_PRESETS = [20, 60, 120] as const

const WINDOW_KEY = 'aperture-window-minutes'

/** Remembered for the browser session only: "how long have you got" is a
 *  fact about right now, not a preference, so it must not persist to
 *  tomorrow. */
export function loadWindowMinutes(): number | null {
  try {
    const raw = sessionStorage.getItem(WINDOW_KEY)
    const n = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function saveWindowMinutes(minutes: number | null) {
  try {
    if (minutes == null) sessionStorage.removeItem(WINDOW_KEY)
    else sessionStorage.setItem(WINDOW_KEY, String(minutes))
  } catch {
    // Storage unavailable -- the chips still work for this render.
  }
}

export interface ActiveSession {
  id: string
  project_id: string
  started_at: string
  window_minutes: number | null
  shapes: SessionShape[]
  askMvsSeed: boolean
}

export interface PendingCloseout {
  id: string
  project_id: string
  started_at: string
  window_minutes: number | null
  projects: { title: string } | null
}

interface SessionState {
  /** How long you've got, this browser session. Lives in the store rather
   *  than in the card's local state because three surfaces set it: the
   *  chips on the answer card, and the Focus chat when it has already
   *  asked. A card-local useState would silently ignore the other two. */
  windowMinutes: number | null
  setWindowMinutes: (minutes: number | null) => void

  active: ActiveSession | null
  starting: boolean
  closing: boolean
  pendingCloseout: PendingCloseout | null
  error: string | null

  startSession: (projectId: string, windowMinutes: number | null, source?: string) => Promise<void>
  closeSession: (closeoutText: string, mvsSeedMinutes?: number) => Promise<{ moved: boolean | null; duration_minutes: number } | null>
  checkPendingCloseout: () => Promise<void>
  closeoutForPending: (closeoutText: string) => Promise<void>
  dismissPendingCloseout: () => void
  declareLive: (projectId: string) => Promise<void>
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

export const useSessionStore = create<SessionState>((set, get) => ({
  windowMinutes: loadWindowMinutes(),
  setWindowMinutes: (minutes) => {
    saveWindowMinutes(minutes)
    set({ windowMinutes: minutes })
  },

  active: null,
  starting: false,
  closing: false,
  pendingCloseout: null,
  error: null,

  startSession: async (projectId, windowMinutes, source = 'live') => {
    set({ starting: true, error: null })
    try {
      const data = await postJson<{ session: any; shapes: SessionShape[]; ask_mvs_seed: boolean }>(
        '/api/utilities?resource=start',
        { project_id: projectId, window_minutes: windowMinutes, source }
      )
      set({
        active: {
          id: data.session.id,
          project_id: projectId,
          started_at: data.session.started_at,
          window_minutes: windowMinutes,
          shapes: data.shapes,
          askMvsSeed: data.ask_mvs_seed,
        },
        starting: false,
      })
    } catch (e) {
      set({ starting: false, error: e instanceof Error ? e.message : 'Could not start the session.' })
    }
  },

  closeSession: async (closeoutText, mvsSeedMinutes) => {
    const active = get().active
    if (!active) return null
    set({ closing: true, error: null })
    try {
      const result = await postJson<{ ok: boolean; moved: boolean | null; duration_minutes: number }>(
        '/api/utilities?resource=close',
        { session_id: active.id, closeout_text: closeoutText, mvs_seed_minutes: mvsSeedMinutes }
      )
      set({ active: null, closing: false })
      return { moved: result.moved, duration_minutes: result.duration_minutes }
    } catch (e) {
      set({ closing: false, error: e instanceof Error ? e.message : 'Could not save the close-out.' })
      return null
    }
  },

  checkPendingCloseout: async () => {
    try {
      const res = await fetch('/api/utilities?resource=pending-closeout')
      if (!res.ok) return
      const data = await res.json()
      set({ pendingCloseout: data.pending ?? null })
    } catch {
      // Silent — a missed deferred close-out check isn't worth surfacing an error for.
    }
  },

  closeoutForPending: async (closeoutText) => {
    const pending = get().pendingCloseout
    if (!pending) return
    set({ closing: true, error: null })
    try {
      await postJson('/api/utilities?resource=close', { session_id: pending.id, closeout_text: closeoutText })
      set({ pendingCloseout: null, closing: false })
    } catch (e) {
      set({ closing: false, error: e instanceof Error ? e.message : 'Could not save the close-out.' })
    }
  },

  dismissPendingCloseout: () => set({ pendingCloseout: null }),

  declareLive: async (projectId) => {
    await postJson('/api/utilities?resource=declare-live', { project_id: projectId })
  },
}))
