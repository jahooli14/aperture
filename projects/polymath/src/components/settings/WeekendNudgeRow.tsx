/**
 * Settings toggle for the Saturday nudge (api/_lib/weekend-nudge.ts): one
 * push naming a project that's been waiting. Off by default; hidden until
 * the server table exists.
 */

import { useEffect, useState } from 'react'
import { getWeekendNudge, setWeekendNudge } from '../../lib/push'

export function WeekendNudgeRow() {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getWeekendNudge()
      .then(s => { if (live) { setAvailable(s.available); setEnabled(s.enabled) } })
      .catch(() => {})
    return () => { live = false }
  }, [])

  if (!available) return null

  const toggle = async () => {
    const next = !enabled
    setBusy(true)
    setError(null)
    try {
      await setWeekendNudge(next)
      setEnabled(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change that")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-card-subtle">
      <div className="flex items-center justify-between px-4 py-3.5 gap-3">
        <div>
          <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>Saturday pick-up</p>
          <p className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>
            One push on Saturday morning naming a project that's been waiting, and where you got to
          </p>
        </div>
        <button
          onClick={() => { void toggle() }}
          disabled={busy}
          aria-label={enabled ? 'Turn off Saturday pick-up' : 'Turn on Saturday pick-up'}
          aria-pressed={enabled}
          className="relative h-7 w-12 rounded-full transition-all flex-shrink-0"
          style={{ background: enabled ? 'rgba(var(--brand-primary-rgb), 0.65)' : 'var(--glass-surface-hover)', opacity: busy ? 0.7 : 1 }}
        >
          <div className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all" style={{ left: enabled ? '26px' : '4px' }} />
        </button>
      </div>
      {error && (
        <div className="px-4 pb-3.5">
          <p className="text-[13px]" style={{ color: 'rgba(var(--color-error-rgb), 1)' }}>{error}</p>
        </div>
      )}
    </div>
  )
}
