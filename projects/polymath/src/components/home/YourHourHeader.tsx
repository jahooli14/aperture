/**
 * YourHourHeader — "Your Hour" title with compact duration toggle
 * Reads/writes duration preference to localStorage.
 */

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrandName } from '../BrandName'
import { haptic } from '../../utils/haptics'

const DURATION_KEY = 'polymath-power-hour-duration'
const DURATIONS = [
  { value: 25, label: '25m' },
  { value: 60, label: '60m' },
  { value: 150, label: '150m' },
] as const

export function YourHourHeader() {
  const navigate = useNavigate()
  const [duration, setDuration] = useState(60)

  useEffect(() => {
    const stored = localStorage.getItem(DURATION_KEY)
    if (stored) setDuration(Number(stored))
  }, [])

  const handleDurationChange = (value: number) => {
    haptic.light()
    setDuration(value)
    localStorage.setItem(DURATION_KEY, String(value))
  }

  return (
    <div className="flex items-center justify-between mb-6">
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
  )
}
