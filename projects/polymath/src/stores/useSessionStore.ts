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
  source: 'closeout' | 'slot' | 'decomposition' | 'start' | 'ignition' | 'shaped'
  partial: boolean
  /** The task this shape is grounded in, when it has one. Sending this
   *  back at close time is what lets a tick mark the real task done,
   *  surviving whatever the model paraphrased the item's text into. */
  taskId?: string | null
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

/** The two minutes of planning, in seconds. Long enough to reshape a list
 *  once or twice; short enough that shaping can't become the session. */
export const PLANNING_SECONDS = 120

export interface PlanItem {
  text: string
  /** Where it came from ("from your last close-out"). Null when the item
   *  asserts nothing that needs a source. Every item is either traceable
   *  or trivially generic -- there is no third category, because that
   *  third category is invention. */
  source: string | null
  /** The real id of the open task this item is grounded in, when it has
   *  one. Sent back at close time so a tick marks the actual task done --
   *  matching on the model's session-item wording would silently fail,
   *  since it's prompted to paraphrase whatever task it's citing. */
  taskId: string | null
}

export interface PlanDraft {
  projectId: string
  windowMinutes: number | null
  items: PlanItem[]
  /** Spares generated with the list. Swapping pulls from here so "not
   *  that one" is instant instead of a model round-trip. */
  bench: PlanItem[]
  /** Set when the app couldn't fill the session from what it actually
   *  knows. It asks rather than padding the list out with guesses. */
  needsInput: string | null
  /** Which gap the question is closing, so the answer gets filed as the
   *  thing it is (a finish line, a next step, a slot) rather than as
   *  another undifferentiated note. */
  gapKind: string | null
  slotName: string | null
  /** 'tasks' means (at least part of) this plan is the project's own open
   *  task list, verbatim. 'derived' means the model was unreachable and
   *  this is the fallback list -- both worth saying out loud rather than
   *  passing either off as a freshly-invented plan. */
  source: 'ai' | 'derived' | 'tasks'
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

  /** The plan being agreed right now, before the clock starts. */
  plan: PlanDraft | null
  shaping: boolean

  shapePlan: (projectId: string, windowMinutes: number | null) => Promise<void>
  reshapePlan: (instruction: string) => Promise<void>
  swapPlanItem: (index: number) => void
  clearPlan: () => void

  startSession: (projectId: string, windowMinutes: number | null, source?: string, items?: PlanItem[]) => Promise<void>
  /** Answers the app's "I don't know enough" question. Saves the answer to
   *  the project so it's evidence next time, then re-shapes on it. */
  answerPlanQuestion: (answer: string) => Promise<void>
  closeSession: (closeoutText: string, mvsSeedMinutes?: number, doneItems?: { text: string; taskId: string | null }[]) => Promise<{ moved: boolean | null; duration_minutes: number } | null>
  checkPendingCloseout: () => Promise<void>
  closeoutForPending: (closeoutText: string) => Promise<void>
  dismissPendingCloseout: () => void
  declareLive: (projectId: string) => Promise<void>
}

interface ShapeResponse {
  items: PlanItem[]
  bench: PlanItem[]
  source: 'ai' | 'derived' | 'tasks'
  needs_input: string | null
  gap_kind: string | null
  slot_name: string | null
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
  plan: null,
  shaping: false,
  starting: false,
  closing: false,
  pendingCloseout: null,
  error: null,

  shapePlan: async (projectId, windowMinutes) => {
    set({ shaping: true, error: null })
    try {
      const data = await postJson<ShapeResponse>(
        '/api/utilities?resource=shape',
        { project_id: projectId, window_minutes: windowMinutes }
      )
      set({
        plan: {
          projectId, windowMinutes,
          items: data.items, bench: data.bench ?? [],
          source: data.source, needsInput: data.needs_input ?? null,
          gapKind: data.gap_kind ?? null, slotName: data.slot_name ?? null,
        },
        shaping: false,
      })
    } catch (e) {
      // Raw transport errors ("Request failed: 404") are not something to
      // read two minutes before you start. Log them, say the plain thing.
      console.error('[session] shape failed:', e)
      set({ shaping: false, error: 'Could not shape a list just now.' })
    }
  },

  reshapePlan: async (instruction) => {
    const plan = get().plan
    if (!plan) return
    set({ shaping: true, error: null })
    try {
      const data = await postJson<ShapeResponse>(
        '/api/utilities?resource=shape',
        {
          project_id: plan.projectId,
          window_minutes: plan.windowMinutes,
          instruction,
          current_items: plan.items.map(i => i.text),
        }
      )
      set({
        plan: {
          ...plan,
          items: data.items, bench: data.bench ?? [],
          source: data.source, needsInput: data.needs_input ?? null,
          gapKind: data.gap_kind ?? null, slotName: data.slot_name ?? null,
        },
        shaping: false,
      })
    } catch (e) {
      // Keep the list that's on screen -- a failed reshape must never
      // leave the user staring at nothing two minutes before they start.
      console.error('[session] reshape failed:', e)
      set({ shaping: false, error: "Didn't catch that — the list is unchanged." })
    }
  },

  // One tap is cheaper than a sentence when the only problem is that one
  // item doesn't suit today. It SWAPS rather than deletes: a five-item
  // hour that becomes a four-item hour because you rejected one line is
  // the app quietly shrinking the session you asked for. The rejected
  // item goes to the back of the bench, so tapping through is a carousel
  // and nothing is lost by accident.
  swapPlanItem: (index) => {
    const plan = get().plan
    if (!plan || plan.bench.length === 0) return
    const [next, ...restOfBench] = plan.bench
    const replaced = plan.items[index]
    set({
      plan: {
        ...plan,
        items: plan.items.map((t, i) => (i === index ? next : t)),
        bench: [...restOfBench, replaced],
      },
    })
  },

  clearPlan: () => set({ plan: null }),

  // The answer to "I don't know enough about this yet" is worth more than
  // this one session: it's saved as a fragment, so the project is better
  // known next time and the app has to ask less often.
  answerPlanQuestion: async (answer) => {
    const plan = get().plan
    if (!plan || !answer.trim()) return
    set({ shaping: true, error: null })
    try {
      await postJson('/api/utilities?resource=shape', {
        project_id: plan.projectId,
        window_minutes: plan.windowMinutes,
        remember: answer.trim(),
        gap_kind: plan.gapKind,
        slot_name: plan.slotName,
      })
    } catch (e) {
      console.error('[session] could not save the answer:', e)
    }
    set({ shaping: false })
    await get().shapePlan(plan.projectId, plan.windowMinutes)
  },

  startSession: async (projectId, windowMinutes, source = 'live', items) => {
    set({ starting: true, error: null })
    try {
      const data = await postJson<{ session: any; shapes: SessionShape[]; ask_mvs_seed: boolean }>(
        '/api/utilities?resource=start',
        { project_id: projectId, window_minutes: windowMinutes, source, items }
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
        plan: null,
        starting: false,
      })
    } catch (e) {
      set({ starting: false, error: e instanceof Error ? e.message : 'Could not start the session.' })
    }
  },

  closeSession: async (closeoutText, mvsSeedMinutes, doneItems) => {
    const active = get().active
    if (!active) return null
    set({ closing: true, error: null })
    try {
      const result = await postJson<{ ok: boolean; moved: boolean | null; duration_minutes: number }>(
        '/api/utilities?resource=close',
        {
          session_id: active.id,
          closeout_text: closeoutText,
          mvs_seed_minutes: mvsSeedMinutes,
          done_items: doneItems,
        }
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
