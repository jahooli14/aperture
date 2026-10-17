import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const post = vi.fn()
vi.mock('../../lib/apiClient', () => ({ api: { post: (...a: unknown[]) => post(...a) } }))
const fetchProjects = vi.fn()
vi.mock('../../stores/useProjectStore', () => ({ useProjectStore: { getState: () => ({ fetchProjects }) } }))

import { ThemesUpdatedNote, useRefreshThemes } from './ThemesFollowNotes'
import type { Project } from '../../types'

const mk = (metadata: Record<string, unknown>) => ({ id: 'p1', metadata } as unknown as Project)
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

function Probe({ project }: { project: Project }) { useRefreshThemes(project); return null }

describe('ThemesUpdatedNote', () => {
  it('says so for a few days, with Undo', () => {
    render(<ThemesUpdatedNote project={mk({ themes: [{ text: 'b', at: ago(0) }], themes_update: { at: ago(1), previous: ['a'] } })} />)
    expect(screen.getByText(/Updated from your notes/)).toBeTruthy()
    expect(screen.getByText('Undo')).toBeTruthy()
  })
  it('goes quiet after that', () => {
    const { container } = render(<ThemesUpdatedNote project={mk({ themes_update: { at: ago(9), previous: ['a'] } })} />)
    expect(container.textContent).toBe('')
  })
})

describe('useRefreshThemes', () => {
  beforeEach(() => { post.mockReset(); fetchProjects.mockReset(); sessionStorage.clear() })

  it('asks the server once, and reloads only when the lines changed', async () => {
    post.mockResolvedValue({ changed: true })
    const p = mk({ themes: [{ text: 'a', at: ago(3) }] })
    const { rerender } = render(<Probe project={p} />)
    await waitFor(() => expect(post).toHaveBeenCalledWith('utilities?resource=themes', { project_id: 'p1', action: 'refresh' }, expect.anything()))
    await waitFor(() => expect(fetchProjects).toHaveBeenCalled())
    rerender(<Probe project={p} />)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a project with no lines', () => {
    render(<Probe project={mk({})} />)
    expect(post).not.toHaveBeenCalled()
  })
})
