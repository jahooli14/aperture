import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const get = vi.fn()
const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }))

import { TakeBriefRow } from './TakeBriefRow'

describe('TakeBriefRow', () => {
  beforeEach(() => { get.mockReset(); post.mockReset() })

  it('shows what is saved and saves an edit', async () => {
    get.mockResolvedValue({ brief: 'Leave my dad out of it.' })
    post.mockResolvedValue({ brief: 'Leave my dad out of it. More music.' })
    render(<TakeBriefRow />)
    const box = await screen.findByDisplayValue('Leave my dad out of it.')
    fireEvent.change(box, { target: { value: 'Leave my dad out of it. More music.' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=take-brief', { brief: 'Leave my dad out of it. More music.' }))
    expect(await screen.findByText(/New takes will use it/)).toBeTruthy()
  })

  it('clears it', async () => {
    get.mockResolvedValue({ brief: 'Something.' })
    post.mockResolvedValue({ brief: '' })
    render(<TakeBriefRow />)
    await screen.findByDisplayValue('Something.')
    fireEvent.click(screen.getByText('Clear'))
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=take-brief', { brief: '' }))
  })

  it('says so plainly when saving fails', async () => {
    get.mockResolvedValue({ brief: '' })
    post.mockRejectedValue(new Error('Run the take_brief migration first.'))
    render(<TakeBriefRow />)
    const box = await screen.findByPlaceholderText(/e\.g\./)
    fireEvent.change(box, { target: { value: 'More music' } })
    fireEvent.click(screen.getByText('Save'))
    expect(await screen.findByText(/Run the take_brief migration/)).toBeTruthy()
  })
})
