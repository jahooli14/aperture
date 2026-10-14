import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const updateProject = vi.fn()
const fetchProjects = vi.fn()
const addToast = vi.fn()
const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('../../stores/useProjectStore', () => {
  const useProjectStore: any = (sel: (s: { updateProject: typeof updateProject }) => unknown) => sel({ updateProject })
  useProjectStore.getState = () => ({ fetchProjects })
  return { useProjectStore }
})
vi.mock('../ui/toast', () => ({ useToast: () => ({ addToast }) }))

const { FinishedItButton } = await import('./FinishedItButton')

const small = (over: object = {}) => ({
  id: 'st', title: 'Graham stencil', status: 'active', state: 'on-deck', is_priority: false,
  metadata: { season: { role: 'also', until: '2999-12-25', label: 'Christmas' } }, ...over,
}) as any

beforeEach(() => { updateProject.mockReset(); addToast.mockReset(); post.mockReset(); fetchProjects.mockReset(); updateProject.mockResolvedValue(undefined); post.mockResolvedValue({}) })

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

describe('a small thing that is waiting', () => {
  const waiting = () => small({ metadata: { season: { role: 'also', until: '2999-12-25', label: 'Christmas', waiting: 'the wood' } } })

  it('says what it waits on, and "Got it" clears it', async () => {
    render(<FinishedItButton project={waiting()} />)
    expect(screen.getByText('Waiting for the wood.')).toBeTruthy()
    fireEvent.click(screen.getByText('Got it'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=season', { action: 'unblock', project_id: 'st' }))
    await waitFor(() => expect(fetchProjects).toHaveBeenCalled())
  })

  it('names the day when it only has a start date', () => {
    render(<FinishedItButton project={small({ metadata: { season: { role: 'also', until: '2999-12-25', label: null, from: '2999-11-01' } } })} />)
    expect(screen.getByText(/Can start from 1 November/)).toBeTruthy()
  })

  it('says nothing about waiting when it can be started', () => {
    render(<FinishedItButton project={small()} />)
    expect(screen.queryByText(/Waiting for/)).toBeNull()
  })
})

