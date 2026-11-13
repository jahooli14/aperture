import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../lib/apiClient', () => ({ api: { get: vi.fn() } }))
import { ProjectUpdates } from './ProjectUpdates'

const at = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

describe('ProjectUpdates', () => {
  it('is folded by default and shows what was said, not the generated title', () => {
    render(<ProjectUpdates items={[
      { kind: 'note', text: 'Novel editing progress — Did some more trimming today', at: at(0) },
      { kind: 'session', text: 'Pasted the comments into Claude', at: at(1) },
    ]} />)
    expect(screen.queryByText(/trimming/)).toBeNull()
    fireEvent.click(screen.getByText(/Everything you've said about it · 2/))
    expect(screen.getByText('Did some more trimming today')).toBeTruthy()
    expect(screen.queryByText(/Novel editing progress/)).toBeNull()
    expect(screen.getByText(/close-out/)).toBeTruthy()
  })

  it('shows nothing when there is nothing', () => {
    const { container } = render(<ProjectUpdates items={[]} />)
    expect(container.textContent).toBe('')
  })
})
