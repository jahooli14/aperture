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
import { useProjectStore } from './useProjectStore'
import { buildOfflinePlan } from '../lib/offline/offlinePlan'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'
import { isOnline } from '../lib/network'

export interface SessionShape {
  text: string
  source: 'closeout' | 'slot' | 'decomposition' | 'start' | 'ignition' | 'shaped' | 'friction'
  partial: boolean
  /** The task this shape is grounded in, when it has one. Sending this
   *  back at close time is what lets a tick mark the real task done,
   *  surviving whatever the model paraphrased the item's text into. */
  taskId?: string | null
}

/** A session-specific setup step, added client-side to the running list
 *  when the plan carried one -- never sent to /resource=start as a real
 *  item, so it can never be promoted into a task the way an invented plan
 *  item can. Ticking it does nothing at close but feel good. */
export interface FrictionLine {
  text: string
  minutes: number
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
  /** Set when the start call couldn't reach the server -- this session
   *  exists only locally. `stashedStart` carries what's needed to replay
   *  start+close for real, either immediately at close (if connectivity is
   *  back by then) or via the sync queue. */
  offline?: boolean
  stashedStart?: {
    project_id: string
    window_minutes: number | null
    source: string
    items: PlanItem[]
    friction: FrictionLine | null
    started_at: string
  }
}

export interface PendingCloseout {
  id: string
  project_id: string
  started_at: string
  window_minutes: number | null
  projects: { title: string } | null
}

/** The two minutes of planning, in seconds. Long enough to reshape a list
 *  once or twice; short enough that shaping can't become the session. A
 *  flat two minutes taxes a genuinely short session hardest -- planning
 *  overhead that doesn't scale down with the window eats a much bigger
 *  share of 15 minutes than it does of an hour. */
export const PLANNING_SECONDS = 120
export const SHORT_PLANNING_SECONDS = 60
export const SHORT_WINDOW_CUTOFF_MINUTES = 20

export function planningSecondsFor(windowMinutes: number | null): number {
  return windowMinutes != null && windowMinutes <= SHORT_WINDOW_CUTOFF_MINUTES
    ? SHORT_PLANNING_SECONDS
    : PLANNING_SECONDS
}

export interface PlanItem {
  text: string
  /** Where it came from ("already on the project", "part of: <step>").
   *  Null when the item asserts nothing that needs a source. Every item
   *  is either traceable or trivially generic -- there is no third
   *  category, because that third category is invention. */
  source: string | null
  /** The real id of the open step this item is, or is a piece of. Sent
   *  back at close time so a tick lands on the actual step. */
  taskId: string | null
  /** True when this is a piece of a bigger step, not the whole of it --
   *  ticking it records progress on the step, never completion. */
  partial?: boolean
}

export type PlanSource = 'tasks' | 'split' | 'ai' | 'derived' | 'offline'

export interface PlanDraft {
  projectId: string
  windowMinutes: number | null
  items: PlanItem[]
  /** What exists at the end of the sitting if the list lands. */
  doneLooksLike: string | null
  /** Set when the app couldn't fill the session from what it actually
   *  knows. It asks rather than padding the list out with guesses. */
  needsInput: string | null
  /** Which gap the question is closing, so the answer gets filed as the
   *  thing it is (a finish line, a next step, a slot) rather than as
   *  another undifferentiated note. */
  gapKind: string | null
  slotName: string | null
  /** 'tasks' — the project's own next steps, verbatim. 'split' — the next
   *  step was bigger than the window, this is the first piece of it.
   *  'ai' — reshaped on what the user said. 'derived' — nothing to plan
   *  from, a placeholder rather than an invention. 'offline' — the network
   *  call failed; drawn client-side from the cached project's own next
   *  steps, same as 'tasks' but with no reshape/split/top-up available. */
  source: PlanSource
  /** Null on the verbatim, no-model-call path -- there's nothing to ask
   *  about friction when nothing was generated. */
  friction: FrictionLine | null
  /** How much of the real backlog wasn't even considered for this plan
   *  (the 24-task ceiling), so it can be said rather than silently eaten. */
  truncatedCount: number
  /** Steps the app planned onto the project first, because its list was
   *  empty -- said out loud, since it just rewrote the plan. */
  planned: number
  /** Set when the next step couldn't be started yet, so the plan changed:
   *  a step moved up from further down, or a missing one written in
   *  before it. Said out loud for the same reason. */
  unblocked: { text: string; before: string; added: boolean } | null
  /** Steps taken off the project for good on a reshape instruction --
   *  deleted from the plan, not just left out of today's session. Said
   *  out loud for the same reason `unblocked` is. */
  removed: { text: string }[]
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
  clearPlan: () => void

  startSession: (projectId: string, windowMinutes: number | null, source?: string, items?: PlanItem[], friction?: FrictionLine | null) => Promise<void>
  /** Answers the app's "I don't know enough" question. Saves the answer to
   *  the project so it's evidence next time, then re-shapes on it. */
  answerPlanQuestion: (answer: string) => Promise<void>
  closeSession: (closeoutText: string, mvsSeedMinutes?: number, doneItems?: { text: string; taskId: string | null; partial?: boolean }[]) => Promise<CloseResult | null>
  checkPendingCloseout: () => Promise<void>
  closeoutForPending: (closeoutText: string) => Promise<void>
  dismissPendingCloseout: () => void
  declareLive: (projectId: string) => Promise<void>
}

interface ShapeResponse {
  items: PlanItem[]
  done_looks_like: string | null
  source: PlanSource
  needs_input: string | null
  gap_kind: string | null
  slot_name: string | null
  friction: FrictionLine | null
  truncated_count: number
  planned: number
  unblocked: { text: string; before: string; added: boolean } | null
  removed: { text: string }[]
}

function draftFrom(projectId: string, windowMinutes: number | null, data: ShapeResponse): PlanDraft {
  return {
    projectId, windowMinutes,
    items: data.items,
    doneLooksLike: data.done_looks_like ?? null,
    source: data.source, needsInput: data.needs_input ?? null,
    gapKind: data.gap_kind ?? null, slotName: data.slot_name ?? null,
    friction: data.friction ?? null, truncatedCount: data.truncated_count ?? 0,
    planned: data.planned ?? 0, unblocked: data.unblocked ?? null,
    removed: data.removed ?? [],
  }
}

/** What actually happened to the task list at close -- the receipt shown
 *  for a beat before "Logged.", rather than a silent rewrite discovered
 *  weeks later. */
export interface CloseResult {
  moved: boolean | null
  duration_minutes: number
  markedDone: string[]
  created: string[]
  nextAdded: string[]
  /** Steps worked on but not finished, with where they got to. */
  progressNoted: string[]
  /** Set when the last open step was just ticked: is the finish line
   *  actually reached, and in one sentence why or why not. */
  finish: { reached: boolean; reason: string } | null
  /** Set when the close-out couldn't reach the server and was queued
   *  instead -- everything else here is a locally-synthesized best guess,
   *  since the real reconciliation (debrief matching, finish-line
   *  judgement) hasn't run yet. */
  pendingSync?: boolean
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
      set({ plan: draftFrom(projectId, windowMinutes, data), shaping: false })
    } catch (e) {
      // Raw transport errors ("Request failed: 404") are not something to
      // read two minutes before you start. Log them, say the plain thing.
      console.error('[session] shape failed:', e)
      // The project is already sitting in the persisted store from an
      // earlier fetch -- draw a real, honest plan from its own next steps
      // rather than a bare error. Only falls through to the generic error
      // if the project itself isn't cached, which shouldn't happen since
      // you navigated to it.
      const project = useProjectStore.getState().allProjects.find(p => p.id === projectId)
      if (project) {
        set({ plan: buildOfflinePlan(project, windowMinutes), error: null, shaping: false })
      } else {
        set({ shaping: false, error: 'Could not shape a list just now.' })
      }
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
      set({ plan: draftFrom(plan.projectId, plan.windowMinutes, data), shaping: false })
    } catch (e) {
      // Keep the list that's on screen -- a failed reshape must never
      // leave the user staring at nothing two minutes before they start.
      console.error('[session] reshape failed:', e)
      set({ shaping: false, error: "Didn't catch that — the list is unchanged." })
    }
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

  startSession: async (projectId, windowMinutes, source = 'live', items, friction) => {
    set({ starting: true, error: null })
    try {
      const data = await postJson<{ session: any; shapes: SessionShape[]; ask_mvs_seed: boolean }>(
        '/api/utilities?resource=start',
        { project_id: projectId, window_minutes: windowMinutes, source, items }
      )
      // Friction never goes to the server as a real plan item -- it's
      // added to the running list client-side, so it can never be
      // promoted into a task the way an invented item can.
      const shapes = friction
        ? [{ text: friction.text, source: 'friction' as const, partial: false, taskId: null }, ...data.shapes]
        : data.shapes
      set({
        active: {
          id: data.session.id,
          project_id: projectId,
          started_at: data.session.started_at,
          window_minutes: windowMinutes,
          shapes,
          askMvsSeed: data.ask_mvs_seed,
        },
        plan: null,
        starting: false,
      })
    } catch (e) {
      // Build a local session that starts running now and gets resolved
      // for real later -- same shape synthesis resource=start does for an
      // item with no grounded taskId, ported here so a session begun
      // offline reads identically once it does sync.
      console.warn('[session] start failed, falling back to a local session:', e)
      const startedAt = new Date().toISOString()
      const agreedItems = (items ?? []).slice(0, 6)
      const shaped: SessionShape[] = agreedItems.map((item, i) => ({
        text: item.text,
        source: 'shaped' as const,
        partial: item.partial ?? false,
        taskId: item.taskId ?? `pending-${Date.now()}-${i}`,
      }))
      const shapes = friction
        ? [{ text: friction.text, source: 'friction' as const, partial: false, taskId: null }, ...shaped]
        : shaped
      set({
        active: {
          id: `local-${crypto.randomUUID()}`,
          project_id: projectId,
          started_at: startedAt,
          window_minutes: windowMinutes,
          shapes,
          askMvsSeed: false,
          offline: true,
          stashedStart: {
            project_id: projectId,
            window_minutes: windowMinutes,
            source,
            items: agreedItems,
            friction: friction ?? null,
            started_at: startedAt,
          },
        },
        plan: null,
        starting: false,
      })
    }
  },

  closeSession: async (closeoutText, mvsSeedMinutes, doneItems) => {
    const active = get().active
    if (!active) return null
    set({ closing: true, error: null })

    if (active.offline) {
      const endedAt = new Date().toISOString()

      // Reconnected mid-session -- resolve for real now rather than
      // waiting for a background sync to catch up.
      if (active.stashedStart) {
        try {
          const online = await isOnline()
          if (online) {
            const startData = await postJson<{ session: any }>(
              '/api/utilities?resource=start',
              { ...active.stashedStart, started_at: active.stashedStart.started_at }
            )
            const result = await postJson<{
              ok: boolean; moved: boolean | null; duration_minutes: number
              marked_done?: string[]; created?: string[]; next_added?: string[]
              progress_noted?: string[]; finish?: { reached: boolean; reason: string } | null
            }>(
              '/api/utilities?resource=close',
              {
                session_id: startData.session.id,
                closeout_text: closeoutText,
                mvs_seed_minutes: mvsSeedMinutes,
                done_items: doneItems,
                ended_at: endedAt,
              }
            )
            set({ active: null, closing: false })
            return {
              moved: result.moved,
              duration_minutes: result.duration_minutes,
              markedDone: result.marked_done ?? [],
              created: result.created ?? [],
              nextAdded: result.next_added ?? [],
              progressNoted: result.progress_noted ?? [],
              finish: result.finish ?? null,
            }
          }
        } catch (e) {
          console.warn('[session] resolve-for-real failed, queuing for later sync:', e)
        }
      }

      // Still offline (or the resolve attempt above failed) -- tick the
      // local cache now, so a second offline session on the same project
      // doesn't re-offer an already-finished step, and defer the real
      // reconciliation to the sync queue.
      const project = useProjectStore.getState().allProjects.find(p => p.id === active.project_id)
      const realTaskIds = (doneItems ?? [])
        .map(d => d.taskId)
        .filter((id): id is string => !!id && !id.startsWith('pending-'))
      if (project && realTaskIds.length > 0) {
        const ids = new Set(realTaskIds)
        const tasks: any[] = Array.isArray(project.metadata?.tasks) ? project.metadata!.tasks : []
        const updatedTasks = tasks.map(t => (t && ids.has(t.id) ? { ...t, done: true } : t))
        await useProjectStore.getState().updateProject(project.id, {
          metadata: { ...project.metadata, tasks: updatedTasks },
        })
      }

      await queueOperation('complete_offline_session', {
        ...active.stashedStart,
        closeout_text: closeoutText,
        mvs_seed_minutes: mvsSeedMinutes,
        done_items: doneItems,
        ended_at: endedAt,
      })
      await useOfflineStore.getState().updateQueueSize()

      set({ active: null, closing: false })
      return {
        moved: null,
        duration_minutes: Math.max(1, Math.round((Date.now() - new Date(active.started_at).getTime()) / 60000)),
        markedDone: (doneItems ?? []).map(d => d.text),
        created: [],
        nextAdded: [],
        progressNoted: [],
        finish: null,
        pendingSync: true,
      }
    }

    try {
      const result = await postJson<{
        ok: boolean; moved: boolean | null; duration_minutes: number
        marked_done?: string[]; created?: string[]; next_added?: string[]
        progress_noted?: string[]; finish?: { reached: boolean; reason: string } | null
      }>(
        '/api/utilities?resource=close',
        {
          session_id: active.id,
          closeout_text: closeoutText,
          mvs_seed_minutes: mvsSeedMinutes,
          done_items: doneItems,
        }
      )
      set({ active: null, closing: false })
      return {
        moved: result.moved,
        duration_minutes: result.duration_minutes,
        markedDone: result.marked_done ?? [],
        created: result.created ?? [],
        nextAdded: result.next_added ?? [],
        progressNoted: result.progress_noted ?? [],
        finish: result.finish ?? null,
      }
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
