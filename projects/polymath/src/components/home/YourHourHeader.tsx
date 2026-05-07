/**
 * YourHourHeader — brand + duration toggle + session feeling + search.
 * Duration and feeling are stored in localStorage and used to calibrate
 * The Moment's generation context.
 */

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandName } from '../BrandName'
import { haptic } from '../../utils/haptics'

const DURATION_KEY = 'polymath-power-hour-duration'
const FEELING_KEY = 'polymath-session-feeling'

const DURATIONS = [
  { value: 25, label: '25m' },
  { value: 60, label: '60m' },
  { value: 150, label: '150m' },
] as const

export type SessionFeeling = 'focused' | 'scattered' | 'restless'

const FEELINGS: { value: SessionFeeling; label: string; hint: string }[] = [
  { value: 'focused', label: 'focused', hint: 'ready to go deep' },
  { value: 'scattered', label: 'scattered', hint: 'need an anchor' },
  { value: 'restless', label: 'restless', hint: 'want to explore' },
]

export function YourHourHeader() {
  const navigate = useNavigate()
  const [duration, setDuration] = useState(60)
  const [feeling, setFeeling] = useState<SessionFeeling | null>(null)

  useEffect(() => {
    const storedDuration = localStorage.getItem(DURATION_KEY)
    if (storedDuration) setDuration(Number(storedDuration))
    const storedFeeling = localStorage.getItem(FEELING_KEY) as SessionFeeling | null
    if (storedFeeling) setFeeling(storedFeeling)
  }, [])

  const handleDurationChange = (value: number) => {
    haptic.light()
    setDuration(value)
    localStorage.setItem(DURATION_KEY, String(value))
  }

  const handleFeelingChange = (value: SessionFeeling) => {
    haptic.light()
    const next = feeling === value ? null : value
    setFeeling(next)
    if (next) {
      localStorage.setItem(FEELING_KEY, next)
    } else {
      localStorage.removeItem(FEELING_KEY)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl aperture-header" style={{ color: 'var(--brand-text-secondary)', opacity: 0.9 }}>
            <BrandName className="inline" showLogo={true} />
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Duration toggle */}
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
            {DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => handleDurationChange(d.value)}
                className="px-2.5 py-1 text-[10px] font-bold tracking-wider transition-all"
                style={{
                  color: duration === d.value ? 'var(--brand-text-primary)' : 'var(--brand-text-secondary)',
                  opacity: duration === d.value ? 1 : 0.4,
                  background: duration === d.value ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/search')}
            className="h-9 w-9 rounded-xl flex items-center justify-center transition-all bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-hover)] border border-[rgba(255,255,255,0.05)] text-[var(--brand-primary)]"
            title="Search everything"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feeling chips — one tap, calibrates The Moment */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-[0.28em] opacity-40 mr-1" style={{ color: 'var(--brand-text-muted)' }}>
          feeling
        </span>
        {FEELINGS.map(f => (
          <button
            key={f.value}
            onClick={() => handleFeelingChange(f.value)}
            title={f.hint}
            className="px-2.5 py-1 rounded-full text-[10px] tracking-wide transition-all"
            style={{
              color: feeling === f.value ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
              background: feeling === f.value ? 'rgba(var(--brand-primary-rgb), 0.12)' : 'rgba(255,255,255,0.04)',
              border: feeling === f.value
                ? '1px solid rgba(var(--brand-primary-rgb), 0.35)'
                : '1px solid rgba(255,255,255,0.06)',
              opacity: feeling && feeling !== f.value ? 0.45 : 1,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
