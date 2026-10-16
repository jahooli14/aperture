import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const get = vi.fn()
const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))
vi.mock('../VoiceInput', () => ({ VoiceInput: () => null }))
vi.mock('../../utils/haptics', () => ({ haptic: { light: vi.fn(), medium: vi.fn(), success: vi.fn(), error: vi.fn() } }))

let themes: { text: string; at: string }[] = []
const fetchProjects = vi.fn()
vi.mock('../../stores/useProjectStore', () => {
  const useProjectStore: any = (sel: (s: unknown) => unknown) =>
    sel({ allProjects: [{ id: 'p1', title: 'The book', metadata: { themes } }] })
  useProjectStore.getState = () => ({ fetchProjects })
  return { useProjectStore }
})

const { StandingQuestion } = await import('./StandingQuestion')

const TAKE = 'You rewrote chapter nine four times. You said a recording only works in one take. I think chapter nine needs one slow sitting.'

beforeEach(() => {
  get.mockReset(); post.mockReset(); fetchProjects.mockReset(); themes = []
  get.mockResolvedValue({ spark: { id: 's1', type: 'mull', text: TAKE, project_id: 'p1', projects: { title: 'The book' }, sources: [], stake: 'Chapter nine gets one slow sitting.' } })
  post.mockResolvedValue({ project_title: 'The book' })
})

async function answer(stance: string) {
  render(<StandingQuestion />)
  await screen.findByText(/one slow sitting/)
  fireEvent.click(screen.getByText(stance))
  fireEvent.click(await screen.findByText('Done'))
}

describe('keeping a yes', () => {
  it('offers the stake after a yes and keeps it as a theme in one tap', async () => {
    await answer('yes')
    const keep = await screen.findByText(/Keep in mind:/)
    fireEvent.click(keep)
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=themes', {
      project_id: 'p1', action: 'set', themes: ['Chapter nine gets one slow sitting'],
    }))
    expect(await screen.findByText(/It's on The book now/)).toBeTruthy()
    expect(fetchProjects).toHaveBeenCalled()
  })

  it('adds to the themes already there', async () => {
    themes = [{ text: 'Every chapter in the new voice', at: '2026-10-01T00:00:00Z' }]
    await answer('yes')
    fireEvent.click(await screen.findByText(/Keep in mind:/))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=themes', {
      project_id: 'p1', action: 'set', themes: ['Every chapter in the new voice', 'Chapter nine gets one slow sitting'],
    }))
  })

  it('offers nothing after a no', async () => {
    await answer('no')
    await screen.findByText(/Wrong is useful too/)
    expect(screen.queryByText(/Keep in mind:/)).toBeNull()
  })

  it('offers nothing when the project already has three', async () => {
    themes = ['a', 'b', 'c'].map(t => ({ text: t, at: '2026-10-01T00:00:00Z' }))
    await answer('yes')
    await screen.findByText(/Noted/)
    expect(screen.queryByText(/Keep in mind:/)).toBeNull()
  })

  it('says so when keeping fails, and the line stays', async () => {
    await answer('yes')
    post.mockRejectedValueOnce(new Error('nope'))
    fireEvent.click(await screen.findByText(/Keep in mind:/))
    expect(await screen.findByText(/Couldn't keep that/)).toBeTruthy()
    expect(screen.getByText('Chapter nine gets one slow sitting')).toBeTruthy()
  })
})

describe('when the reroll runs out of time', () => {
  it('says it took too long, not that there is nothing to work with', async () => {
    get.mockResolvedValue({ spark: null })
    post.mockResolvedValue({ rerolled: false, reason: 'took too long', slow: true })
    render(<StandingQuestion />)
    fireEvent.click(await screen.findByText('give me something to think about'))
    expect(await screen.findByText('That took too long. Try again.')).toBeTruthy()
    expect(screen.queryByText(/Really nothing to work with/)).toBeNull()
    expect(screen.queryByText('get more creative')).toBeNull()
  })
})

describe('where a take came from', () => {
  it('stays hidden until you tap the take', async () => {
    get.mockResolvedValue({ spark: { id: 's2', type: 'mull', text: TAKE, project_id: 'p1', projects: { title: 'The book' }, sources: [{ title: 'Greenhouse note' }, { title: 'The book' }], stake: 'x' } })
    render(<StandingQuestion />)
    const take = await screen.findByText(/one slow sitting/)
    expect(screen.queryByText(/Greenhouse note/)).toBeNull()
    fireEvent.click(take)
    expect(await screen.findByText(/Greenhouse note \+ The book/)).toBeTruthy()
    fireEvent.click(take)
    await waitFor(() => expect(screen.queryByText(/Greenhouse note/)).toBeNull())
  })
})
