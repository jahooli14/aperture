import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateProject = vi.fn()
const addToast = vi.fn()
vi.mock('../../stores/useProjectStore', () => ({
  useProjectStore: (sel: (s: { updateProject: typeof updateProject }) => unknown) => sel({ updateProject }),
}))
vi.mock('../ui/toast', () => ({ useToast: () => ({ addToast }) }))

const { FinishedItButton } = await import('./FinishedItButton')

const small = (over: object = {}) => ({
  id: 'st', title: 'Graham stencil', status: 'active', state: 'on-deck', is_priority: false,
  metadata: { season: { role: 'also', until: '2999-12-25', label: 'Christmas' } }, ...over,
}) as any

beforeEach(() => { updateProject.mockReset(); addToast.mockReset(); updateProject.mockResolvedValue(undefined) })

describe('FinishedItButton', () => {
  it('finishes it with one tap, and says so quietly', async () => {
    render(<FinishedItButton project={small()} />)
    fireEvent.click(screen.getByText('Finished it'))
    await waitFor(() => expect(updateProject).toHaveBeenCalledWith('st', { status: 'completed' }))
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Done.' }))
  })
  it('is not there for the main project, a finished one, or a project outside the season', () => {
    const { container, rerender } = render(<FinishedItButton project={small({ state: 'live' })} />)
    expect(container.textContent).toBe('')
    rerender(<FinishedItButton project={small({ status: 'completed' })} />)
    expect(container.textContent).toBe('')
    rerender(<FinishedItButton project={small({ metadata: {} })} />)
    expect(container.textContent).toBe('')
    rerender(<FinishedItButton project={small({ metadata: { season: { role: 'also', until: '2020-01-01', label: null } } })} />)
    expect(container.textContent).toBe('')
  })
  it('says so when it could not save', async () => {
    updateProject.mockRejectedValue(new Error('x'))
    render(<FinishedItButton project={small()} />)
    fireEvent.click(screen.getByText('Finished it'))
    await waitFor(() => expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })))
  })
})
