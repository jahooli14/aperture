import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../StuckMove', () => ({ StuckMove: () => <div>stuck</div> }))

const { WorkView } = await import('./WorkView')

const base = {
  projectId: 'p1', title: 'Going Analogue', clockSeconds: 65, hasWindow: false, timeUp: false,
  online: true, stuckSignal: 0, onToggle: vi.fn(), onStop: vi.fn(), onMinimise: vi.fn(),
  shapes: [{ text: 'Keep going on Going Analogue', source: null, partial: false, taskId: null }] as any,
  workIndexes: [0], ticked: new Set<number>(),
}

describe('WorkView with Keep in mind lines', () => {
  it('shows the lines instead of a task, and one way to stop', () => {
    const onStop = vi.fn()
    render(<WorkView {...base} onStop={onStop} themes={['Do the full trim', 'Rewrite in my voice']} />)
    expect(screen.getByText('Do the full trim')).toBeTruthy()
    expect(screen.getByText('Rewrite in my voice')).toBeTruthy()
    expect(screen.queryByText('Keep going on Going Analogue')).toBeNull()
    expect(screen.queryByText('Done')).toBeNull()
    expect(screen.queryByText('stuck')).toBeNull()
    fireEvent.click(screen.getByText('Done for now'))
    expect(onStop).toHaveBeenCalled()
  })

  it('shows your own last note under the lines', () => {
    render(<WorkView {...base} themes={['Do the full trim']} lastNote="Next is the voice pass on chapter three." />)
    expect(screen.getByText(/You stopped with/)).toBeTruthy()
    expect(screen.getByText(/voice pass on chapter three/)).toBeTruthy()
  })

  it('still shows the task and Done when there are no lines', () => {
    render(<WorkView {...base} />)
    expect(screen.getByText('Keep going on Going Analogue')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })
})
