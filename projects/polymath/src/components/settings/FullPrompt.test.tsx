import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const get = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a) } }))

import { FullPrompt } from './FullPrompt'

describe('FullPrompt', () => {
  beforeEach(() => { get.mockReset() })

  it('stays closed until asked, then shows the prompt', async () => {
    get.mockResolvedValue({ ideas: 'IDEA PROMPT TEXT', take_draft: 'DRAFT TEXT', take_judge: 'JUDGE TEXT' })
    render(<FullPrompt which="take_draft" label="the whole prompt that writes a take" />)
    expect(screen.queryByText('DRAFT TEXT')).toBeNull()
    fireEvent.click(screen.getByText(/See the whole prompt that writes a take/))
    expect(await screen.findByText('DRAFT TEXT')).toBeTruthy()
    expect(screen.getByText(/Read only/)).toBeTruthy()
  })

  it('says so when it cannot load', async () => {
    vi.resetModules()
    const { FullPrompt: Fresh } = await import('./FullPrompt')
    get.mockRejectedValue(new Error('no'))
    render(<Fresh which="ideas" label="x" />)
    fireEvent.click(screen.getByText(/See x/))
    expect(await screen.findByText(/Couldn't load it/)).toBeTruthy()
  })
})
