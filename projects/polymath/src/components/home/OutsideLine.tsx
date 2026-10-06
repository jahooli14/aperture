/**
 * One thing from outside (api/_lib/outside-find.ts), as a single quiet line
 * under the day's question — a technique, a maker or a piece of work found for
 * the live project's next step. Everything else in the app only recombines
 * what you've captured; this is the one way something new gets in.
 *
 * It was its own card in the attention slot. It's a line now: where it sits is
 * where you're already thinking. "Save" puts the link in the reading queue,
 * which keeps it out of the corpus until it's read and voted "good". "Not
 * useful" tells next week's search to stop offering that kind of thing.
 */

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useReadingStore } from '../../stores/useReadingStore'

interface OutsideFind {
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
const quietActionStyle = { color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }

export function OutsideLine() {
  const [find, setFind] = useState<OutsideFind | null>(null)
  const [busy, setBusy] = useState(false)
  // Arrives after the card has painted; open a beat later so it eases in
  // rather than snapping the project section down (.reveal in theme.css).
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!find) return
    const t = setTimeout(() => setShown(true), 30)
    return () => clearTimeout(t)
  }, [find])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get('utilities?resource=outside-find') as { find: OutsideFind | null }
        if (!cancelled && data?.find) setFind(data.find)
      } catch {
        // Nothing found, or offline: there is simply no line.
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!find) return null

  const resolve = async (verdict: 'saved' | 'dismissed') => {
    setBusy(true)
    try {
      // Record the verdict first: if it fails the find stays and a retry
      // can't save the article twice.
      await api.post('utilities?resource=outside-find', { id: find.id, verdict })
      if (verdict === 'saved') await useReadingStore.getState().saveArticle({ url: find.url })
      setFind(null)
    } catch {
      // A failed save leaves it on screen, so it can be tried again.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reveal" data-open={shown}>
    <div>
    {/* Same shape as the question above it: no box, same label, same quiet
        action row. A filled panel with pill buttons read as a different app.
        Kept to three short lines so the whole home card fits one screen. */}
    <div className="pb-2 mb-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1 truncate" style={{ color: 'var(--brand-text-muted)' }}>
        from outside · {KIND_LABEL[find.kind].toLowerCase()}
      </p>
      <a href={find.url} target="_blank" rel="noreferrer" className="block" style={{ color: 'var(--brand-text-primary)' }}>
        <p className="flex items-start gap-1.5 text-[14.5px] leading-[1.35]" style={{ fontFamily: 'var(--brand-font-serif)' }}>
          <span className="line-clamp-1">{find.title}</span>
          <ExternalLink className="h-3 w-3 mt-1.5 flex-shrink-0" style={{ opacity: 0.5 }} />
        </p>
        <p className="text-[12px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--brand-text-secondary)' }}>{find.why}</p>
      </a>
      <div className="flex items-center gap-3 mt-1">
        <button className="text-[12px] disabled:opacity-30" style={quietActionStyle} disabled={busy} onClick={() => resolve('saved')}>
          save to read
        </button>
        <span style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>·</span>
        <button className="text-[12px] disabled:opacity-30" style={quietActionStyle} disabled={busy} onClick={() => resolve('dismissed')}>
          not useful
        </button>
      </div>
    </div>
    </div>
    </div>
  )
}
