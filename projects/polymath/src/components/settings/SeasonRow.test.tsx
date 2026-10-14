import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { post: (...a: unknown[]) => post(...a) } }))
vi.mock('../VoiceInput', () => ({ VoiceInput: () => null }))
const fetchProjects = vi.fn()
vi.mock('../../stores/useProjectStore', () => ({ useProjectStore: { getState: () => ({ fetchProjects }) } }))

const { SeasonRow } = await import('./SeasonRow')

const PROJECTS = [{ id: 'book', title: 'Going Analogue' }, { id: 'toy', title: "Oscar's toy" }, { id: 'paint', title: 'Paint pouring' }]
const EMPTY = { main: null, also: [], until: null, label: null }

beforeEach(() => {
  post.mockReset(); fetchProjects.mockReset()
  post.mockImplementation(async (_url: string, body: { action: string }) => {
    if (body.action === 'get') return { season: EMPTY, projects: PROJECTS }
    if (body.action === 'read') return { proposal: { main: PROJECTS[0], also: [PROJECTS[1]], until: '2026-12-25', label: 'Christmas' } }
    if (body.action === 'apply') return { season: { main: PROJECTS[0], also: [PROJECTS[1]], until: '2026-12-25', label: 'Christmas' } }
    return { season: EMPTY }
  })
})

describe('SeasonRow small finishes', () => {
  it('sends size and what it is waiting for, and "Got it" clears the wait', async () => {
    const waiting = { main: PROJECTS[0], also: [{ ...PROJECTS[1], size: 'weekend', blocked: true, waiting: 'the wood', from: null }], until: '2026-12-25', label: 'Christmas', active: true }
    post.mockImplementation(async (_u: string, body: { action: string }) => {
      if (body.action === 'get') return { season: waiting, projects: PROJECTS }
      if (body.action === 'unblock') return { season: { ...waiting, also: [{ ...waiting.also[0], blocked: false, waiting: null }] } }
      return { season: waiting }
    })
    render(<SeasonRow />)
    expect(await screen.findByText("Oscar's toy is waiting for the wood.")).toBeTruthy()
    fireEvent.click(screen.getByText('Got it'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=season', { action: 'unblock', project_id: 'toy' }))
    await waitFor(() => expect(screen.queryByText(/is waiting for/)).toBeNull())
  })

  it('lets you set how big it is and what it waits on', async () => {
    render(<SeasonRow />)
    fireEvent.click(await screen.findByText('Set it'))
    fireEvent.change(screen.getByLabelText('Say what matters this season'), { target: { value: 'x' } })
    fireEvent.click(screen.getByText('Read it'))
    await screen.findByText(/Here's what I heard/)
    fireEvent.change(screen.getByLabelText('How big is finish 1'), { target: { value: 'weekend' } })
    fireEvent.change(screen.getByLabelText('What finish 1 is waiting for'), { target: { value: 'the wood' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=season', expect.objectContaining({
      action: 'apply', also: [{ id: 'toy', size: 'weekend', waiting: 'the wood', from: null }],
    })))
  })
})

describe('SeasonRow', () => {
  it('reads what you said into the form, then saves it', async () => {
    render(<SeasonRow />)
    fireEvent.click(await screen.findByText('Set it'))
    fireEvent.change(screen.getByLabelText('Say what matters this season'), { target: { value: "Until Christmas, Going Analogue is main and Oscar's toy is second" } })
    fireEvent.click(screen.getByText('Read it'))
    await screen.findByText(/Here's what I heard/)
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=season', {
      action: 'apply', main_id: 'book', until: '2026-12-25', label: 'Christmas',
      also: [{ id: 'toy', size: null, waiting: null, from: null }],
    }))
    expect(await screen.findByText(/Going Analogue is main, then Oscar's toy, until Christmas\. The rest is for fun\./)).toBeTruthy()
    expect(fetchProjects).toHaveBeenCalled()
  })

  it("won't save without a main project", async () => {
    render(<SeasonRow />)
    fireEvent.click(await screen.findByText('Set it'))
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText('Pick the main project first.')).toBeTruthy()
    expect(post).not.toHaveBeenCalledWith('utilities?resource=season', expect.objectContaining({ action: 'apply' }))
  })

  it('says so when it could not match what you said, and leaves the form for you', async () => {
    post.mockImplementation(async (_u: string, body: { action: string }) =>
      body.action === 'get' ? { season: EMPTY, projects: PROJECTS } : { proposal: null })
    render(<SeasonRow />)
    fireEvent.click(await screen.findByText('Set it'))
    fireEvent.change(screen.getByLabelText('Say what matters this season'), { target: { value: 'something odd' } })
    fireEvent.click(screen.getByText('Read it'))
    expect(await screen.findByText(/Couldn't match that to your projects/)).toBeTruthy()
  })
})
