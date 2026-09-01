import { describe, it, expect } from 'vitest'

/**
 * The "Next: X" extraction that turns a close-out into a real task.
 * Mirrored from api/utilities.ts's close handler so the regex and its
 * bounds are testable without a database — this is the line that decides
 * whether doing the work grows the plan or evaporates.
 */
function extractNextStep(text: string): string | null {
  const m = text.match(/\bnext\s*[:\-]\s*(.+)$/is)
  const step = m?.[1]?.trim().replace(/\s+/g, ' ')
  if (!step || step.length <= 3 || step.length >= 160) return null
  return step
}

describe('extractNextStep', () => {
  it('takes what follows the marker, not the whole close-out', () => {
    expect(extractNextStep('Got the intro sorted. Next: fix the transition out of track two.'))
      .toBe('fix the transition out of track two.')
  })

  it('handles the ways people actually write it', () => {
    expect(extractNextStep('next - redo the vocal')).toBe('redo the vocal')
    expect(extractNextStep('NEXT: redo the vocal')).toBe('redo the vocal')
  })

  it('collapses a rambling spoken close-out onto one line', () => {
    expect(extractNextStep('Did loads.\nNext:  sort   the\n  ending')).toBe('sort the ending')
  })

  it('adds nothing when the close-out only says where they got to', () => {
    expect(extractNextStep('Got the intro sorted.')).toBeNull()
  })

  it('ignores a marker with nothing useful after it', () => {
    expect(extractNextStep('Next: x')).toBeNull()
  })

  it('ignores a whole essay after the marker — that is a note, not a task', () => {
    expect(extractNextStep(`Next: ${'a'.repeat(200)}`)).toBeNull()
  })
})

describe('ticks and the next step compose', () => {
  // The close handler builds projectUpdate.metadata for the ticks, then the
  // next-step append reads that back rather than the original row. If it
  // read the row instead, whichever ran second would silently drop the
  // other's write.
  it('keeps the tick AND adds the new task', () => {
    const current = { tasks: [{ id: 't1', text: 'Record the intro', done: false }] }
    const projectUpdate: Record<string, unknown> = {}

    // Step 1: ticks.
    projectUpdate.metadata = {
      ...current,
      tasks: current.tasks.map(t => ({ ...t, done: true, completed_at: 'now' })),
    }

    // Step 2: next step, reading projectUpdate.metadata first.
    const base = (projectUpdate.metadata as any) ?? current
    projectUpdate.metadata = {
      ...base,
      tasks: [...base.tasks, { id: 't2', text: 'fix the transition', done: false, origin: 'closeout' }],
    }

    const tasks = (projectUpdate.metadata as any).tasks
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ text: 'Record the intro', done: true })
    expect(tasks[1]).toMatchObject({ text: 'fix the transition', done: false })
  })
})

/**
 * The task-done matching from the close handler in api/utilities.ts,
 * mirrored here for unit testing without a database. Two independent code
 * traces found the same failure: the shaper's own prompt teaches it to
 * paraphrase the task it's grounded in, so matching purely on ticked TEXT
 * against stored task text silently misses most real completions. This is
 * the id-first, text-fallback logic that replaced it.
 */
function markDoneTasks(
  tasks: { id: string; text: string; done: boolean }[],
  ticked: { text: string; taskId: string | null }[],
) {
  const tickedTaskIds = new Set(ticked.map(t => t.taskId).filter((id): id is string => !!id))
  const tickedTextLower = new Set(ticked.map(t => t.text.toLowerCase().trim()))
  return tasks.map(t => {
    if (t.done) return t
    const matches = tickedTaskIds.has(t.id) || tickedTextLower.has(t.text.toLowerCase().trim())
    return matches ? { ...t, done: true } : t
  })
}

describe('task-done matching survives paraphrase', () => {
  const tasks = [{ id: 'task-42', text: 'Fix the transition out of track two', done: false }]

  it('marks the task done when the shaper paraphrased it — the real failure that shipped', () => {
    // This exact paraphrase is the session-shaper's OWN worked example
    // (session-shaper.ts) for grounding a session item in this exact task.
    const ticked = [{ text: 'Play track two from the top and find where it breaks.', taskId: 'task-42' }]
    expect(markDoneTasks(tasks, ticked)[0].done).toBe(true)
  })

  it('would have silently failed on text alone', () => {
    const ticked = [{ text: 'Play track two from the top and find where it breaks.', taskId: null }]
    expect(markDoneTasks(tasks, ticked)[0].done).toBe(false)
  })

  it('still matches by text when no id is present — the offline/derived fallback path', () => {
    const ticked = [{ text: 'Fix the transition out of track two', taskId: null }]
    expect(markDoneTasks(tasks, ticked)[0].done).toBe(true)
  })

  it('does not mark a task done by an unrelated ticked item', () => {
    const ticked = [{ text: 'Bounce a rough mix.', taskId: 'some-other-task' }]
    expect(markDoneTasks(tasks, ticked)[0].done).toBe(false)
  })

  it('leaves an already-done task alone', () => {
    const done = [{ id: 'task-42', text: 'Fix the transition out of track two', done: true }]
    const result = markDoneTasks(done, [{ text: 'anything', taskId: 'task-42' }])
    expect(result[0].done).toBe(true)
  })
})
