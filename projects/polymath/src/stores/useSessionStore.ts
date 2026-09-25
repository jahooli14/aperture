/**
 * The session contract (SPEC.md) — declare a live project, open a session,
 * run the timer, capture the close-out. This is the foundation the rest of
 * the rebuild depends on: `last_closeout_text` only exists once a session
 * has actually been closed.
 *
 * Deliberately thin: network calls and timer bookkeeping only. The UI
 * (SessionContract.tsx) owns the screens; this store holds what's in
 * flight, including the project's one next move (api/_lib/next-move.ts).
 */

import { create } from 'zustand'
import { useProjectStore } from './useProjectStore'
import { queueOperation } from '../lib/offlineQueue'
import { useOfflineStore } from './useOfflineStore'
import { isOnline } from '../lib/network'
import { clearSessionNotification } from '../hooks/useSessionNotification'

export interface SessionShape {
  text: string
  source: 'closeout' | 'slot' | 'decomposition' | 'start' | 'ignition' | 'shaped' | 'friction' | 'spark'
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
    packdown: FrictionLine | null
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
  /** The "while you're in there" punt from the week's corpus, not a step
   *  on the project. Sent to resource=start so the running list can keep
   *  showing it as what it is rather than as an ordinary step. */
  spark?: boolean
}

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

/** Keep the cached project in step, so the card shows the new move at once
 *  and a later offline start uses it. */
function patchCachedMove(projectId: string, move: SessionMove) {
  const store = useProjectStore.getState()
  const project = store.allProjects.find(p => p.id === projectId)
  if (!project) return
  useProjectStore.setState({
    allProjects: store.allProjects.map(p =>
      p.id === projectId ? { ...p, metadata: { ...(p.metadata ?? {}), next_move: move } } : p),
  })
}

interface SessionState {
  active: ActiveSession | null
  starting: boolean
  closing: boolean
  pendingCloseout: PendingCloseout | null
  error: string | null

  /** The project's one next move, and which project it's for. */
  move: SessionMove | null
  moveFor: string | null
  moveBusy: boolean
  /** Shows the stored move at once (it's in the cached project), then
   *  asks the server only if there isn't one. */
  loadMove: (projectId: string) => Promise<void>
  /** "Too big" / "wrong thing", their own words, a fork answer, or a move
   *  they wrote themselves -- each comes back as a new move. */
  reworkMove: (projectId: string, change: MoveChange) => Promise<void>

  startSession: (projectId: string, windowMinutes: number | null, source?: string, items?: PlanItem[], friction?: FrictionLine | null, packdown?: FrictionLine | null) => Promise<void>
  closeSession: (closeoutText: string, mvsSeedMinutes?: number, doneItems?: { text: string; taskId: string | null; partial?: boolean }[]) => Promise<CloseResult | null>
  checkPendingCloseout: () => Promise<void>
  closeoutForPending: (closeoutText: string) => Promise<void>
  dismissPendingCloseout: () => void
  declareLive: (projectId: string) => Promise<void>
  /** "That's mix 5 — line up the next one." Files what the finished one
   *  took and plans the next from that shape. */
  startNextCycle: (projectId: string) => Promise<boolean>
  /** "I'm stuck" on the step you're on: one move back into it, never a
   *  new plan. Null when nothing honest could be said. */
  askStuck: (projectId: string, step: string) => Promise<string | null>
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
  /** Set when the last step of a REPEATING project's cycle was just
   *  ticked (project-cycles.ts). Not "the project is finished" — this one
   *  is, and the next hasn't started. Mutually exclusive with `finish`. */
  cycle: { n: number; label: string; unit: string; reason: string } | null
  /** What next time starts with -- written from the note just left. */
  nextMove: SessionMove | null
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

/** Setting up goes first and clearing away goes last, because that is when
 *  they happen -- and a session that ends without the pack-down on screen
 *  is the one that overruns. Neither is ever sent to resource=start as a
 *  real item, so neither can be promoted into a task the way a plan item
 *  can; ticking them does nothing at close but feel good. */
function withBookends(
  shapes: SessionShape[],
  friction?: FrictionLine | null,
  packdown?: FrictionLine | null,
): SessionShape[] {
  const out = [...shapes]
  if (friction) out.unshift({ text: friction.text, source: 'friction', partial: false, taskId: null })
  if (packdown) out.push({ text: packdown.text, source: 'friction', partial: false, taskId: null })
  return out
}

export const useSessionStore = create<SessionState>((set, get) => ({
  active: null,
  move: null,
  moveFor: null,
  moveBusy: false,
  starting: false,
  closing: false,
  pendingCloseout: null,
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
      if (get().moveFor === projectId) set({ move, moveBusy: false })
    } catch (e) {
      console.error('[session] could not get the next move:', e)
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
      console.error('[session] could not change the move:', e)
      set({ moveBusy: false, error: 'Couldn’t change it just now — the move is as it was.' })
    }
  },

  startSession: async (projectId, windowMinutes, source = 'live', items, friction, packdown) => {
    set({ starting: true, error: null })
    try {
      const data = await postJson<{ session: any; shapes: SessionShape[]; ask_mvs_seed: boolean }>(
        '/api/utilities?resource=start',
        { project_id: projectId, window_minutes: windowMinutes, source, items }
      )
      // Friction never goes to the server as a real plan item -- it's
      // added to the running list client-side, so it can never be
      // promoted into a task the way an invented item can.
      const shapes = withBookends(data.shapes, friction, packdown)
      set({
        active: {
          id: data.session.id,
          project_id: projectId,
          started_at: data.session.started_at,
          window_minutes: windowMinutes,
          shapes,
          askMvsSeed: data.ask_mvs_seed,
        },
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
        source: item.spark ? ('spark' as const) : ('shaped' as const),
        partial: item.partial ?? false,
        taskId: item.taskId ?? `pending-${Date.now()}-${i}`,
      }))
      const shapes = withBookends(shaped, friction, packdown)
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
            packdown: packdown ?? null,
            started_at: startedAt,
          },
        },
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
              cycle?: { n: number; label: string; unit: string; reason: string } | null
              next_move?: SessionMove | null
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
            clearSessionNotification()
            set({ active: null, closing: false })
            return {
              moved: result.moved,
              duration_minutes: result.duration_minutes,
              markedDone: result.marked_done ?? [],
              created: result.created ?? [],
              nextAdded: result.next_added ?? [],
              progressNoted: result.progress_noted ?? [],
              finish: result.finish ?? null,
              cycle: result.cycle ?? null,
              nextMove: result.next_move ?? null,
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

      clearSessionNotification()
      set({ active: null, closing: false })
      return {
        moved: null,
        duration_minutes: Math.max(1, Math.round((Date.now() - new Date(active.started_at).getTime()) / 60000)),
        markedDone: (doneItems ?? []).map(d => d.text),
        created: [],
        nextAdded: [],
        progressNoted: [],
        finish: null,
        cycle: null,
        nextMove: null,
        pendingSync: true,
      }
    }

    try {
      const result = await postJson<{
        ok: boolean; moved: boolean | null; duration_minutes: number
        marked_done?: string[]; created?: string[]; next_added?: string[]
        progress_noted?: string[]; finish?: { reached: boolean; reason: string } | null
        cycle?: { n: number; label: string; unit: string; reason: string } | null
        next_move?: SessionMove | null
      }>(
        '/api/utilities?resource=close',
        {
          session_id: active.id,
          closeout_text: closeoutText,
          mvs_seed_minutes: mvsSeedMinutes,
          done_items: doneItems,
        }
      )
      clearSessionNotification()
      set({ active: null, closing: false })
      if (result.next_move) {
        set({ move: result.next_move, moveFor: active.project_id })
        patchCachedMove(active.project_id, result.next_move)
      }
      return {
        moved: result.moved,
        duration_minutes: result.duration_minutes,
        markedDone: result.marked_done ?? [],
        created: result.created ?? [],
        nextAdded: result.next_added ?? [],
        progressNoted: result.progress_noted ?? [],
        finish: result.finish ?? null,
        cycle: result.cycle ?? null,
        nextMove: result.next_move ?? null,
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

  startNextCycle: async (projectId) => {
    try {
      await postJson('/api/utilities?resource=next-cycle', { project_id: projectId })
      // The project's task list has just been rewritten server-side, so the
      // cached copy is now wrong in a way the next session would inherit.
      await useProjectStore.getState().fetchProjects()
      return true
    } catch (e) {
      console.error('[session] could not line up the next one:', e)
      return false
    }
  },

  askStuck: async (projectId, step) => {
    try {
      const { move } = await postJson<{ move: string | null }>(
        '/api/utilities?resource=stuck',
        { project_id: projectId, step },
      )
      return move
    } catch (e) {
      console.error('[session] stuck move failed:', e)
      return null
    }
  },
}))
