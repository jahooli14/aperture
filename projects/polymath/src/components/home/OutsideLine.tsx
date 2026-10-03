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

const linkButton = 'text-[12px] font-medium underline-offset-2 hover:underline disabled:opacity-40'

export function OutsideLine() {
  const [find, setFind] = useState<OutsideFind | null>(null)
  const [busy, setBusy] = useState(false)

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
      if (verdict === 'saved') await useReadingStore.getState().saveArticle({ url: find.url })
      await api.post('utilities?resource=outside-find', { id: find.id, verdict })
      setFind(null)
    } catch {
      // A failed save leaves it on screen, so it can be tried again.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 mb-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <p className="text-[11px] uppercase tracking-[0.14em] font-bold mb-1" style={{ color: 'var(--brand-text-muted)' }}>
        From outside · {KIND_LABEL[find.kind]}
      </p>
      <a href={find.url} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 text-[14px] leading-snug" style={{ color: 'var(--brand-text-primary)' }}>
        <span>{find.title}</span>
        <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" style={{ opacity: 0.5 }} />
      </a>
      <p className="text-[12.5px] mt-1" style={{ color: 'var(--brand-text-secondary)', opacity: 0.85 }}>{find.why}</p>
      <div className="flex gap-4 mt-1.5">
        <button className={linkButton} style={{ color: 'rgb(var(--brand-primary-rgb))' }} disabled={busy} onClick={() => resolve('saved')}>
          Save to read
        </button>
        <button className={linkButton} style={{ color: 'var(--brand-text-secondary)' }} disabled={busy} onClick={() => resolve('dismissed')}>
          Not useful
        </button>
      </div>
    </div>
  )
}
