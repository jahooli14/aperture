/**
 * One folded row that holds everything about a project's past — what's been
 * done, what done looks like, the arc, what was made. On a project being
 * worked on the page leads with "Keep in mind" and the notes; this is
 * history, so it stays shut until asked for.
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function ProgressFold({ doneCount, children }: { doneCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--brand-text-muted)' }}>
          Progress{doneCount > 0 ? ` · ${doneCount} done` : ''}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--brand-text-muted)' }}
        />
      </button>
      {open && <div className="space-y-8 pt-3">{children}</div>}
    </section>
  )
}
