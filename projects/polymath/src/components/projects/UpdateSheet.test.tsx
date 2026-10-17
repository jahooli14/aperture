import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }))
vi.mock('../../stores/useProjectStore', () => ({ useProjectStore: { getState: () => ({ fetchProjects: vi.fn() }) } }))
vi.mock('../VoiceInput', () => ({ VoiceInput: () => <button aria-label="mic" /> }))

import { UpdateSheet } from './UpdateSheet'
import type { Project } from '../../types'

const project = { id: 'p1', title: 'Going Analogue', metadata: { themes: [{ text: 'Do the full trim', at: '2026-10-01T00:00:00Z' }] } } as unknown as Project

describe('UpdateSheet', () => {
  beforeEach(() => { post.mockReset() })

  it('asks where you got to and saves what you say to this project', async () => {
    post.mockResolvedValue({ themes: [{ text: 'Do the full trim', at: 'x' }], changed: false })
    render(<UpdateSheet project={project} onClose={() => {}} />)
    expect(screen.getByText('Where did you get to?')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/Trimmed chapter two/), { target: { value: 'Pasted the comments into Claude' } })
    fireEvent.click(screen.getByText('Save update'))
    await waitFor(() => expect(post).toHaveBeenCalledWith(
      'utilities?resource=project-update', { project_id: 'p1', text: 'Pasted the comments into Claude' }, expect.anything(),
    ))
    expect(await screen.findByText('Your lines still hold.')).toBeTruthy()
  })

  it('shows the new lines when they changed, and Undo puts the old ones back', async () => {
    post.mockResolvedValueOnce({ themes: [{ text: 'The voice is close now', at: 'x' }], changed: true, previous: ['Do the full trim'] })
    post.mockResolvedValueOnce({})
    render(<UpdateSheet project={project} onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/Trimmed chapter two/), { target: { value: 'Voice is close now' } })
    fireEvent.click(screen.getByText('Save update'))
    expect(await screen.findByText('The voice is close now')).toBeTruthy()
    fireEvent.click(screen.getByText('Undo that'))
    await waitFor(() => expect(post).toHaveBeenLastCalledWith('utilities?resource=themes', { project_id: 'p1', action: 'set', themes: ['Do the full trim'] }))
    expect(await screen.findByText('Put your old lines back.')).toBeTruthy()
  })

  it('keeps what you wrote when saving fails', async () => {
    post.mockRejectedValue(new Error('no'))
    render(<UpdateSheet project={project} onClose={() => {}} />)
    const box = screen.getByPlaceholderText(/Trimmed chapter two/) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Some words' } })
    fireEvent.click(screen.getByText('Save update'))
    expect(await screen.findByText(/What you wrote is still here/)).toBeTruthy()
    expect(box.value).toBe('Some words')
  })

  it('does not save nothing', () => {
    render(<UpdateSheet project={project} onClose={() => {}} />)
    expect((screen.getByText('Save update') as HTMLButtonElement).disabled).toBe(true)
  })
})
