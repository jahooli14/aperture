import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const startSession = vi.fn()
const loadMove = vi.fn()
const state: any = {
  active: null, move: { kind: 'move', text: 'Paste the first section into Claude AI' }, moveFor: 'p1', moveBusy: false,
  starting: false, closing: false, error: null,
  loadMove, reworkMove: vi.fn(), startSession, closeSession: vi.fn(),
}
vi.mock('../../stores/useSessionStore', () => {
  const useSessionStore: any = () => state
  useSessionStore.getState = () => state
  return { useSessionStore }
})
vi.mock('../../stores/useVoicePreference', () => ({ useVoicePreference: (sel: any) => sel({ prefersText: false, setPrefersText: vi.fn() }) }))
vi.mock('../../stores/useProjectStore', () => ({ useProjectStore: { getState: () => ({ updateProject: vi.fn() }) } }))
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }))
vi.mock('../../hooks/useSessionNotification', () => ({ useSessionNotification: vi.fn(), SESSION_ACTION_EVENT: 'x' }))
vi.mock('../../utils/haptics', () => ({ haptic: { light: vi.fn(), medium: vi.fn() } }))

const { SessionContract } = await import('./SessionContract')

const project = (over: object = {}) => ({
  id: 'p1', title: 'Going Analogue', status: 'active', last_active: new Date().toISOString(),
  metadata: { themes: [{ text: 'Do the full trim', at: '2026-10-01T00:00:00Z' }] }, ...over,
}) as any

beforeEach(() => { startSession.mockReset(); loadMove.mockReset() })

describe('Go on a project with Keep in mind lines', () => {
  it('starts at once on those lines, not on the stored move', async () => {
    render(<SessionContract project={project()} onDone={() => {}} autoStart />)
    await waitFor(() => expect(startSession).toHaveBeenCalled())
    const items = startSession.mock.calls[0][3]
    expect(items).toEqual([{ text: 'Keep going on Going Analogue', source: null, taskId: null }])
    expect(loadMove).not.toHaveBeenCalled()
  })

  it('still uses the stored move when there are no lines', async () => {
    render(<SessionContract project={project({ metadata: {} })} onDone={() => {}} autoStart />)
    await waitFor(() => expect(startSession).toHaveBeenCalled())
    expect(startSession.mock.calls[0][3][0].text).toBe('Paste the first section into Claude AI')
    expect(loadMove).toHaveBeenCalled()
  })
})
