/**
 * What a close-out does to the project's task list.
 *
 * This was ~150 lines inline in api/utilities.ts's `close` handler, woven
 * through four awaited Supabase calls, so the one place the app rewrites a
 * project's plan on the user's behalf could not be tested at all — and the
 * receipt shown afterwards ("marked done", "up next") is generated from
 * exactly these numbers.
 *
 * It's pure now: tasks in, tasks out. The two model calls stay in the
 * handler and arrive here as plain data (`debrief`), so this can be walked
 * end to end without a network or a database.
 *
 * The rules, in the order they apply — order matters, and each step can
 * see what the ones before it did:
 *   1. Ticked items with a real task id mark that task done, whatever the
 *      shaper paraphrased the text into.
 *   2. A "pending-" id is a session line that was never written to the
 *      project. Ticking it is what promotes it to real; left unticked it
 *      simply never existed.
 *   3. Ticked items with no id at all fall back to a text match.
 *   4. Pieces of one split step: all of them ticked finishes the step,
 *      some of them is progress on it and never a false "done".
 *   5. What the user SAID comes last, so a spoken "got as far as the
 *      second chorus" overrides the mechanical "did: piece one" note.
 *   6. A step that was on the plan, never ticked, in a session that ran
 *      its whole window is evidence the estimate was too low.
 */

import { bumpEstimate, type EstimateMinutes } from './session-estimate.js'
import { insertAfterDone, normalizeTaskOrder } from './task-order.js'
import type { DebriefResult } from './debrief-matcher.js'

export interface TickedItem {
  text: string
  taskId: string | null
  partial: boolean
}

export interface CloseoutInput {
  /** The project's task list, as stored. Never mutated. */
  tasks: any[]
  /** What the session actually put on screen (sessions.items). */
  sessionItems: any[]
  ticked: TickedItem[]
  endedAt: Date
  /** The window agreed at the start, and how long it really ran. */
  windowMinutes: number | null
  durationMinutes: number
  /** Already resolved by the handler; null when nothing was said. */
  debrief: DebriefResult | null
}

export interface CloseoutResult {
  tasks: any[]
  changed: boolean
  markedDone: string[]
  created: string[]
  nextAdded: string[]
  progressNoted: string[]
  /** sessions.items, each carrying whether it was ticked. */
  itemsWithOutcome: any[]
  /** Open steps left after everything above. 0 means the plan is spent. */
  openLeft: number
}

/** Accepts the raw `done_items` body value in any of the shapes the client
 *  has ever sent, and drops anything that isn't one. */
export function parseTicked(raw: unknown): TickedItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x: unknown): TickedItem | null => {
      if (typeof x === 'string') return { text: x, taskId: null, partial: false }
      if (x && typeof x === 'object' && typeof (x as any).text === 'string') {
        return {
          text: (x as any).text,
          taskId: typeof (x as any).taskId === 'string' ? (x as any).taskId : null,
          partial: (x as any).partial === true,
        }
      }
      return null
    })
    .filter((x): x is TickedItem => !!x)
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim()

export function reconcileCloseout(input: CloseoutInput): CloseoutResult {
  const { sessionItems, ticked, endedAt, windowMinutes, durationMinutes, debrief } = input

  const tickedTaskIds = new Set(ticked.map(t => t.taskId).filter((id): id is string => !!id))
  const tickedTextLower = new Set(ticked.map(t => norm(t.text)))

  const itemsWithOutcome = sessionItems.map((it: any) => {
    const itText = typeof it === 'string' ? it : it?.text
    const itTaskId = typeof it === 'object' ? it?.taskId : null
    const byText = tickedTextLower.has(norm(itText))
    // Pieces of one step share its id, so only the text says which piece
    // was ticked.
    const done = it?.partial === true ? byText : ((itTaskId && tickedTaskIds.has(itTaskId)) || byText)
    return { ...it, done }
  })

  const piecesByStep = new Map<string, { total: number; ticked: string[] }>()
  for (const it of sessionItems) {
    if (!it || typeof it !== 'object' || it.partial !== true || typeof it.taskId !== 'string') continue
    const entry = piecesByStep.get(it.taskId) ?? { total: 0, ticked: [] }
    entry.total++
    if (tickedTaskIds.has(it.taskId) && tickedTextLower.has(norm(it.text))) entry.ticked.push(String(it.text))
    piecesByStep.set(it.taskId, entry)
  }

  let tasks: any[] = Array.isArray(input.tasks) ? [...input.tasks] : []
  let changed = false
  const markedDone: string[] = []
  const created: string[] = []
  const progressNoted: string[] = []
  const nextAdded: string[] = []

  const markDoneById = (id: string) => {
    const idx = tasks.findIndex(t => t?.id === id && !t?.done)
    if (idx === -1) return
    // A finished step has no "where I got to" any more.
    const { progress_note: _n, progress_at: _a, ...rest } = tasks[idx]
    tasks[idx] = { ...rest, done: true, completed_at: endedAt.toISOString() }
    changed = true
    markedDone.push(String(tasks[idx].text))
  }
  const noteProgress = (id: string, note: string) => {
    const idx = tasks.findIndex(t => t?.id === id && !t?.done)
    if (idx === -1) return
    tasks[idx] = { ...tasks[idx], progress_note: note, progress_at: endedAt.toISOString() }
    changed = true
    progressNoted.push(`${tasks[idx].text} — ${note}`)
  }
  let seq = 0
  const newTask = (text: string, done: boolean, origin: string, source: string | null) => ({
    id: `t-${endedAt.getTime()}-${seq++}`,
    text,
    done,
    created_at: endedAt.toISOString(),
    ...(done ? { completed_at: endedAt.toISOString() } : {}),
    order: tasks.length,
    origin,
    source,
  })
  const createDoneTask = (text: string, origin: string, source: string | null) => {
    tasks.push(newTask(text, true, origin, source))
    changed = true
    markedDone.push(text)
  }

  for (const t of ticked) {
    if (!t.taskId || t.partial) continue
    if (t.taskId.startsWith('pending-')) {
      createDoneTask(t.text, 'session', null)
      continue
    }
    markDoneById(t.taskId)
  }
  for (const t of ticked) {
    if (t.taskId || t.partial) continue
    const idx = tasks.findIndex(x => !x.done && typeof x.text === 'string' && norm(x.text) === norm(t.text))
    if (idx !== -1) markDoneById(tasks[idx].id)
  }
  for (const [stepId, pieces] of piecesByStep) {
    if (pieces.ticked.length === 0) continue
    if (pieces.ticked.length >= pieces.total) markDoneById(stepId)
    else noteProgress(stepId, `did: ${pieces.ticked.map(p => p.replace(/[.!?]+$/, '')).join('; ')}`)
  }

  // Reconciled against the WHOLE open list, not just what was on screen:
  // people regularly do something unplanned mid-session and it should
  // still land as real progress.
  if (debrief) {
    debrief.doneTaskIds.forEach(markDoneById)
    debrief.newDone.forEach(t => createDoneTask(t, 'closeout', 'you said it at the end of a session'))
    debrief.progress.forEach(p => noteProgress(p.taskId, p.note))
    // What comes next is, by definition, the very next thing: it goes to
    // the front of the open list, not after the eight steps already there.
    if (debrief.next.length > 0) {
      const incoming = debrief.next.map(t => newTask(t, false, 'closeout', 'you said it at the end of a session'))
      tasks = insertAfterDone(tasks, incoming)
      changed = true
      debrief.next.forEach(t => { created.push(t); nextAdded.push(t) })
    }
  }

  if (changed) tasks = normalizeTaskOrder(tasks)

  // A step that was on this session's plan, never ticked, in a session
  // that ran its full window: real evidence the estimate was too low,
  // cheap to nudge without another model call.
  if (typeof windowMinutes === 'number' && durationMinutes >= windowMinutes) {
    const unfinished = new Set(
      itemsWithOutcome
        .filter((it: any) => !it.done && typeof it.taskId === 'string' && !String(it.taskId).startsWith('pending-'))
        .map((it: any) => it.taskId),
    )
    if (unfinished.size > 0) {
      tasks = tasks.map(t => {
        if (!unfinished.has(t.id) || !t.estimate_set || typeof t.estimated_minutes !== 'number') return t
        changed = true
        return { ...t, estimated_minutes: bumpEstimate(t.estimated_minutes as EstimateMinutes) }
      })
    }
  }

  return {
    tasks,
    changed,
    markedDone: [...new Set(markedDone)],
    created: [...new Set(created)],
    nextAdded,
    progressNoted,
    itemsWithOutcome,
    openLeft: tasks.filter(t => t && !t.done).length,
  }
}
