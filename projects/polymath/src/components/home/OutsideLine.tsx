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
    <div className="mt-1 mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <a href={find.url} target="_blank" rel="noreferrer" className="flex-1 min-w-0" style={{ color: 'var(--brand-text-primary)' }}>
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: 'var(--brand-text-muted)' }}>
          From outside · {KIND_LABEL[find.kind]}
        </p>
        <p className="flex items-start gap-1.5 text-[14px] leading-snug mt-0.5">
          <span className="line-clamp-2">{find.title}</span>
          <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" style={{ opacity: 0.5 }} />
        </p>
        <p className="text-[12.5px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--brand-text-secondary)' }}>{find.why}</p>
      </a>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <button
          className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-40"
          style={{ background: 'rgba(var(--brand-primary-rgb),0.16)', color: 'rgb(var(--brand-primary-rgb))' }}
          disabled={busy}
          onClick={() => resolve('saved')}
        >
          Save
        </button>
        <button className="text-[11.5px] disabled:opacity-40" style={{ color: 'var(--brand-text-secondary)' }} disabled={busy} onClick={() => resolve('dismissed')}>
          Not useful
        </button>
      </div>
    </div>
  )
}
