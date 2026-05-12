/**
 * YourHourHeader — the home page masthead.
 *
 * Uses the same .page-masthead pattern as Thoughts / Projects /
 * Collections so the page title sits at the same y-coordinate across
 * tab switches. Serif "Aperture." title, cyan eyebrow with today's
 * weekday, search action on the right.
 */

import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function todayLabel(): string {
  // Plain English: weekday name in caps — the eyebrow class handles
  // tracking + colour. Falls back to "TODAY" if something explodes.
  try {
    return new Date().toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()
  } catch {
    return 'TODAY'
  }
}

export function YourHourHeader() {
  const navigate = useNavigate()

  return (
    <header className="page-masthead relative">
      {/* Soft brand glow tucked behind the wordmark — gives the header lift */}
      <div
        aria-hidden
        className="absolute -top-6 -left-6 h-32 w-64 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at left, rgba(var(--brand-primary-rgb), 0.18), transparent 65%)',
          filter: 'blur(24px)',
        }}
      />
      <div className="page-masthead-text relative">
        <h1 className="page-hero">
          Aper<span style={{ color: 'rgb(var(--brand-primary-rgb))' }}>ture</span>.
        </h1>
        <div className="page-eyebrow">{todayLabel()}</div>
      </div>

      <div className="page-masthead-actions relative">
        <button
          onClick={() => navigate('/search')}
          aria-label="Search everything"
          className="masthead-action press-spring"
          title="Search everything"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
