/**
 * Projects whose finish line repeats.
 *
 * Some real projects never end and shouldn't be made to. DJing is "record
 * a mix, record a mix, record a mix": there is no state in which it's
 * finished, and inventing one would be a lie. The app already handles the
 * absence of a finish line — end_goal is optional, and it's never asked
 * for — but that left two things wrong for this kind of work.
 *
 * The first is that every cycle looked like a brand-new project. Tick the
 * last step and the backlog is empty, so the next session re-plans from
 * scratch, unable to reuse the shape that already worked five times.
 *
 * The second is worse: you never finish anything. A moving finish line
 * doesn't just deny you an ending, it denies you every ending — you
 * record a mix, tick the last step, and nothing marks it.
 *
 * So the finish line isn't removed here, it's scoped to ONE of them.
 * `end_goal` becomes the unit ("a recorded mix"), which means every
 * existing planner keeps working and keeps working WELL: the spine plans
 * backwards from a real finish, and judgeFinishLine asks a question with
 * a real answer. Only what happens at the finish changes — the project
 * doesn't complete, the next one starts.
 *
 * Deliberately NOT a habit tracker, which is a different thing that was
 * tried and rejected. A habit is measured in frequency: did you do it
 * this week, are you on a streak, you've missed three. This is measured
 * in outputs: this is the fifth. There is no cadence here, nothing to
 * fall behind on, and no streak to break — a quiet repeating project goes
 * cold exactly like any other project and gets resurfaced the same way.
 *
 * Pure. Every function takes metadata and gives metadata back.
 */

import { normalizeTaskOrder } from './task-order.js'

/** Keep the last few cycles for the planner to learn a shape from. All of
 *  them would grow without bound and swamp the spine prompt. */
export const CYCLE_HISTORY_LIMIT = 5

export interface CycleRecord {
  /** Which one this was: 1 for the first. */
  n: number
  /** ISO, when it was finished. */
  at: string
  /** The steps it actually took, in order — the shape the next one is
   *  planned from. */
  steps: string[]
  /** What they said at the end of the session that finished it. */
  closeout?: string | null
}

export interface CycleState {
  /** Singular noun, no article: "mix", "sketch", "issue". Short because
   *  it gets counted in the UI ("Mix 5", "5 mixes"). */
  unit: string
  /** How many are finished. */
  done: number
  history: CycleRecord[]
}

/** Null when this project doesn't repeat — which is almost all of them. */
export function readCycleState(metadata: unknown): CycleState | null {
  const raw = (metadata as any)?.cycle
  if (!raw || typeof raw !== 'object') return null
  const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''
  if (!unit) return null
  return {
    unit,
    done: typeof raw.done === 'number' && raw.done >= 0 ? Math.floor(raw.done) : 0,
    history: Array.isArray(raw.history)
      ? raw.history
          .filter((h: any) => h && typeof h.n === 'number' && Array.isArray(h.steps))
          .map((h: any) => ({
            n: h.n,
            at: typeof h.at === 'string' ? h.at : new Date().toISOString(),
            steps: h.steps.filter((s: unknown) => typeof s === 'string'),
            closeout: typeof h.closeout === 'string' ? h.closeout : null,
          }))
      : [],
  }
}

export function repeats(metadata: unknown): boolean {
  return readCycleState(metadata) !== null
}

/** "mix" -> "mixes", "sketch" -> "sketches", "track" -> "tracks". Naive on
 *  purpose: the unit is short and user-editable, so a wrong plural is
 *  fixed by editing the word rather than by a dictionary in here. */
export function pluralise(unit: string, count: number): string {
  if (count === 1) return unit
  return /(s|x|z|ch|sh)$/i.test(unit) ? `${unit}es` : `${unit}s`
}

/** "Mix 5" — what the one just finished is called. */
export function cycleLabel(unit: string, n: number): string {
  return `${unit.charAt(0).toUpperCase()}${unit.slice(1)} ${n}`
}

/** "5 mixes so far" — the count on a project card. Empty before the first
 *  one lands: "0 mixes" is a worse thing to read than nothing. */
export function cycleCountLabel(state: CycleState): string | null {
  if (state.done <= 0) return null
  return `${state.done} ${pluralise(state.unit, state.done)} so far`
}

/**
 * Finishing one and starting the next.
 *
 * The done steps are FILED rather than left on the project: they were the
 * shape of the last one and they're wanted for planning the next, but a
 * list that keeps sixty finished steps makes every receipt and every
 * prompt unreadable. Open steps are kept — anything not done when the
 * cycle closed genuinely carries over.
 */
export function rollToNextCycle(
  metadata: any,
  options: { closeout?: string | null; now?: Date } = {},
): any {
  const state = readCycleState(metadata)
  if (!state) return metadata
  const now = options.now ?? new Date()

  const tasks: any[] = Array.isArray(metadata?.tasks) ? metadata.tasks : []
  const doneSteps = tasks
    .filter(t => t?.done && typeof t.text === 'string')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(t => t.text as string)
  // Renumbered contiguous from 0 -- task-order.ts's one invariant every
  // writer of metadata.tasks has to keep. Filtering out the done steps
  // otherwise leaves gaps (0, 2, 5, ...) in what's left.
  const openTasks = normalizeTaskOrder(tasks.filter(t => t && !t.done))

  const n = state.done + 1
  const history = [
    ...state.history,
    { n, at: now.toISOString(), steps: doneSteps, closeout: options.closeout ?? null },
  ].slice(-CYCLE_HISTORY_LIMIT)

  return {
    ...metadata,
    tasks: openTasks,
    cycle: { unit: state.unit, done: n, history },
  }
}

/** The shape the last one took, for seeding the next spine. Newest first,
 *  flattened to plain lines the planner can read. */
export function lastCycleSteps(state: CycleState | null): string[] {
  if (!state || state.history.length === 0) return []
  return state.history[state.history.length - 1].steps
}
