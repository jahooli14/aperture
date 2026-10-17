import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const get = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { get: (...a: unknown[]) => get(...a) } }))

import { ProjectUpdates } from './ProjectUpdates'
import type { Project } from '../../types'

const project = { id: 'p1', last_active: '2026-10-17T15:08:00Z' } as unknown as Project
const at = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

describe('ProjectUpdates', () => {
  it('lists what has been said about the project, newest first, and folds the rest', async () => {
    get.mockResolvedValue({ updates: [
      { kind: 'note', text: 'Novel editing progress, about halfway to the target word count', at: at(0) },
      { kind: 'session', text: 'Pasted the comments into Claude', at: at(1) },
      { kind: 'note', text: 'Trimmed chapter two', at: at(3) },
      { kind: 'note', text: 'Older thing', at: at(9) },
    ] })
    render(<ProjectUpdates project={project} />)
    expect(await screen.findByText(/Novel editing progress/)).toBeTruthy()
    expect(screen.getByText(/close-out/)).toBeTruthy()
    expect(screen.queryByText('Older thing')).toBeNull()
    fireEvent.click(screen.getByText('Show all 4'))
    expect(screen.getByText('Older thing')).toBeTruthy()
  })

  it('shows nothing when there is nothing', async () => {
    get.mockResolvedValue({ updates: [] })
    const { container } = render(<ProjectUpdates project={project} />)
    await new Promise(r => setTimeout(r, 20))
    expect(container.textContent).toBe('')
  })
})
