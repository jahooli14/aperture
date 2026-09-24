/**
 * "I'm stuck" — one move back into the step you're on.
 *
 * Mid-session you're either flowing or stuck, and neither wants a list.
 * Stuck wants one thing to do with your hands: smaller, sideways, or a
 * constraint (api/_lib/session-moves.ts). Never a new plan, never saved --
 * if it helped, the close-out will say so in your own words.
 */

import { useEffect, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { useSessionStore } from '../../stores/useSessionStore'
import { haptic } from '../../utils/haptics'

interface Props {
  projectId: string
  /** The step you're on right now. Null when everything's ticked. */
  step: string | null
  online: boolean
  /** Bumped from outside (the notification's "I'm stuck" button) to ask
   *  without a tap on this screen. */
  askSignal?: number
}

export function StuckMove({ projectId, step, online, askSignal = 0 }: Props) {
  const askStuck = useSessionStore(s => s.askStuck)
  const [move, setMove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [empty, setEmpty] = useState(false)

  // A move is for one step. Ticking it moves you on, so the move goes.
  useEffect(() => { setMove(null); setEmpty(false) }, [step])

  const ask = async () => {
    if (!step) return
    haptic.light()
    setBusy(true)
    setEmpty(false)
    const next = await askStuck(projectId, step)
    setBusy(false)
    if (next) setMove(next)
    else setEmpty(true)
  }
  useEffect(() => {
    if (askSignal > 0 && step && online) void ask()
    // Only a new signal asks; step/online changes alone must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askSignal])

  if (!step || !online) return null



  if (move) {
    return (
      <div
        className="rounded-xl px-3.5 py-3 space-y-1.5"
        style={{ background: 'var(--glass-surface)', border: '1px solid var(--glass-border-bold)' }}
      >
        <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
          Try this
        </p>
        <p className="text-sm leading-snug">{move}</p>
        <button
          onClick={ask}
          disabled={busy}
          className="text-xs disabled:opacity-40"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
        >
          {busy ? 'Thinking…' : 'Something else'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={ask}
      disabled={busy}
      className="flex items-center gap-1.5 text-xs mx-auto disabled:opacity-40"
      style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
    >
      <LifeBuoy size={12} />
      {busy ? 'Finding a way in…' : empty ? 'Nothing useful to suggest — tap to try again' : "I'm stuck"}
    </button>
  )
}
