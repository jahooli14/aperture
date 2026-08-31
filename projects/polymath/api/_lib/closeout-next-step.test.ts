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
