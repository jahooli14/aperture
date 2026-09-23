/**
 * One thing from outside (api/_lib/outside-find.ts) — the last and
 * quietest thing the attention slot can show. A technique, a maker or a
 * piece of work, found for the live project's next step.
 *
 * One statement, one action, one quiet out, like every other slot.
 * "Save to read" puts the link in the reading queue, which keeps it out of
 * the corpus until it's read and voted "good". "Not useful" tells the next
 * week's search to stop offering that kind of thing.
 */

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useReadingStore } from '../../stores/useReadingStore'

export interface OutsideFind {
  id: string
  title: string
  kind: 'technique' | 'maker' | 'work'
  why: string
  url: string
  project_title: string | null
}

const KIND_LABEL: Record<OutsideFind['kind'], string> = {
  technique: 'A technique',
  maker: 'Someone who did this',
  work: 'Worth a look',
}

const secondaryTextStyle = { color: 'var(--brand-text-secondary)', opacity: 0.7 }
const primaryButtonStyle = {
  background: 'rgba(var(--brand-primary-rgb), 0.12)',
  border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
  color: 'rgb(var(--brand-primary-rgb))',
}
const quietOutClass = 'w-full text-[12px] py-1.5 transition-opacity hover:opacity-90 disabled:opacity-30'
const quietOutStyle = { color: 'var(--brand-text-secondary)', opacity: 0.5 }

export function OutsideSlot({ find, onResolved }: { find: OutsideFind; onResolved: () => void }) {
  const [busy, setBusy] = useState(false)

  const resolve = async (verdict: 'saved' | 'dismissed') => {
    setBusy(true)
    try {
      if (verdict === 'saved') {
        await useReadingStore.getState().saveArticle({ url: find.url })
      }
      await api.post('utilities?resource=outside-find', { id: find.id, verdict })
    } catch {
      // A failed save leaves the find unresolved, so it's offered again.
    } finally {
      setBusy(false)
      onResolved()
    }
  }

  let host = ''
  try {
    host = new URL(find.url).hostname.replace(/^www\./, '')
  } catch {
    // parseFind only stores valid URLs; nothing to show if one slipped by.
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-xs uppercase tracking-wide" style={{ ...secondaryTextStyle, opacity: 0.5 }}>
        {KIND_LABEL[find.kind]}{find.project_title ? ` · ${find.project_title}` : ''}
      </p>
      <a href={find.url} target="_blank" rel="noreferrer" className="block space-y-1">
        <p className="text-base font-medium flex items-start gap-1.5">
          {find.title}
          <ExternalLink className="h-3.5 w-3.5 mt-1 flex-shrink-0" style={{ opacity: 0.5 }} />
        </p>
        {host && <p className="text-[11px]" style={{ ...secondaryTextStyle, opacity: 0.45 }}>{host}</p>}
      </a>
      <p className="text-sm" style={secondaryTextStyle}>{find.why}</p>
      <div className="space-y-1">
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => resolve('saved')}
        >
          Save to read
        </button>
        <button className={quietOutClass} style={quietOutStyle} disabled={busy} onClick={() => resolve('dismissed')}>
          not useful
        </button>
      </div>
    </div>
  )
}
