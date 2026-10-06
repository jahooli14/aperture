/**
 * "Not this — change it", inline on the home card.
 *
 * It used to open the session box, which showed the same project, last
 * note, move and Go a second time just to reach two buttons. Now the two
 * buttons (and "say what's off") open right under the move they change.
 * Same route as the session box: useSessionStore.reworkMove.
 */

import { useState } from 'react'
import { ArrowUp, Loader2, Minimize2, Shuffle } from 'lucide-react'
import { useSessionStore, type MoveChange } from '../../stores/useSessionStore'

const quiet = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: 'var(--brand-text-secondary)',
}

export function MoveTweak({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const reworkMove = useSessionStore(s => s.reworkMove)
  const busy = useSessionStore(s => s.moveBusy)
  const error = useSessionStore(s => s.error)
  const [say, setSay] = useState('')
  const online = typeof navigator === 'undefined' || navigator.onLine

  const change = async (c: MoveChange) => {
    if (busy) return
    await reworkMove(projectId, c)
    if (!useSessionStore.getState().error) {
      setSay('')
      onClose()
    }
  }
  const send = () => {
    const text = say.trim()
    if (text) void change({ action: 'say', text })
  }

  if (!online) {
    return <p className="text-[12px] text-center py-1" style={{ color: 'var(--brand-text-muted)' }}>Changing the move needs a connection.</p>
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
          style={quiet}
          disabled={busy}
          onClick={() => void change({ action: 'feedback', reason: 'too_big' })}
        >
          <Minimize2 size={13} /> Too big
        </button>
        <button
          className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
          style={quiet}
          disabled={busy}
          onClick={() => void change({ action: 'feedback', reason: 'wrong_thing' })}
        >
          <Shuffle size={13} /> Wrong thing
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-1" style={quiet}>
        <input
          value={say}
          onChange={e => setSay(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Or say what’s off…"
          disabled={busy}
          className="flex-1 min-w-0 bg-transparent text-[13px] outline-none py-1.5 disabled:opacity-50"
          style={{ color: 'var(--brand-text-primary)' }}
        />
        <button onClick={send} disabled={busy || !say.trim()} className="p-1.5 disabled:opacity-30" aria-label="Send">
          <ArrowUp size={16} style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
        </button>
      </div>
      {busy && (
        <p className="text-[12px] flex items-center gap-1.5" style={{ color: 'var(--brand-text-muted)' }}>
          <Loader2 size={12} className="animate-spin" /> Writing a new one…
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
