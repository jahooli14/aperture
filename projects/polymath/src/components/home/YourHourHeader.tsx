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
    <div className="mb-7 relative">
      {/* Soft brand glow tucked behind the wordmark — gives the header lift */}
      <div
        aria-hidden
        className="absolute -top-6 -left-6 h-32 w-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at left, rgba(var(--brand-primary-rgb), 0.18), transparent 65%)',
          filter: 'blur(24px)',
        }}
      />
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl aperture-header" style={{ color: 'var(--brand-text-primary)', opacity: 0.95 }}>
            <BrandName className="inline" showLogo={true} />
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Duration toggle */}
          <div
            className="flex items-center rounded-full overflow-hidden backdrop-blur-md"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {DURATIONS.map(d => (
              <button
                key={d.value}
                onClick={() => handleDurationChange(d.value)}
                className="px-3 py-1.5 text-[10px] font-bold tracking-wider transition-all"
                style={{
                  color: duration === d.value ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-secondary)',
                  opacity: duration === d.value ? 1 : 0.45,
                  background: duration === d.value
                    ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.18), rgba(var(--brand-primary-rgb),0.06))'
                    : 'transparent',
                  textShadow: duration === d.value ? '0 0 10px rgba(var(--brand-primary-rgb), 0.5)' : 'none',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/search')}
            className="h-9 w-9 rounded-full flex items-center justify-center transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.15), rgba(var(--brand-primary-rgb),0.04))',
              border: '1px solid rgba(var(--brand-primary-rgb),0.25)',
              color: 'rgb(var(--brand-primary-rgb))',
              boxShadow: '0 4px 14px -4px rgba(var(--brand-primary-rgb),0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
            title="Search everything"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feeling chips — one tap, calibrates The Moment */}
      <div className="relative flex items-center gap-2">
        <span
          className="text-[9px] uppercase tracking-[0.32em] mr-1 italic"
          style={{ color: 'var(--brand-text-muted)', opacity: 0.55, fontFamily: 'var(--brand-font-serif)' }}
        >
          feeling
        </span>
        {FEELINGS.map(f => {
          const selected = feeling === f.value
          return (
            <button
              key={f.value}
              onClick={() => handleFeelingChange(f.value)}
              title={f.hint}
              className="px-3 py-1 rounded-full text-[10px] tracking-wide transition-all hover:scale-[1.04] active:scale-95"
              style={{
                color: selected ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
                background: selected
                  ? 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.18), rgba(var(--brand-primary-rgb), 0.06))'
                  : 'rgba(255,255,255,0.04)',
                border: selected
                  ? '1px solid rgba(var(--brand-primary-rgb), 0.4)'
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: selected ? '0 0 16px -4px rgba(var(--brand-primary-rgb), 0.5)' : 'none',
                opacity: feeling && !selected ? 0.45 : 1,
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
