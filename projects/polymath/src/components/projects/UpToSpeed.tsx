/**
 * "Bring me up to speed" — leads the page of a project that's been quiet a
 * couple of weeks (api/_lib/up-to-speed.ts): what it is, where you got to,
 * what was still unsettled, each line dated to the note it came from.
 *
 * The way back in is the move panel right under this; this card only
 * says where things stand. Cached server-side until a newer note lands,
 * so opening the same quiet project twice costs nothing.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { daysQuiet, isLiveStatus, UP_TO_SPEED_AFTER_DAYS, type UpToSpeed as UpToSpeedData } from '../../lib/projectThemes'
import type { Project } from '../../types'

function awayFor(days: number): string {
  if (days >= 60) return `${Math.round(days / 30)} months away`
  return `${Math.floor(days / 7)} weeks away`
}

export function UpToSpeed({ project }: { project: Project }) {
  const quiet = daysQuiet(project)
  const show = isLiveStatus(project.status) && quiet != null && quiet >= UP_TO_SPEED_AFTER_DAYS
  const [data, setData] = useState<UpToSpeedData | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle')

  useEffect(() => {
    if (!show) return
    let live = true
    setState('loading')
    api.post('utilities?resource=up-to-speed', { project_id: project.id }, { timeout: 40_000 })
      .then((res: { up_to_speed?: UpToSpeedData | null }) => {
        if (!live) return
        setData(res.up_to_speed ?? null)
        setState('done')
      })
      .catch(() => { if (live) setState('failed') })
    return () => { live = false }
  }, [project.id, show])

  if (!show) return null
  // Nothing honest to say (no notes, or nothing survived the checks): say
  // nothing. The move panel below still offers a way back in.
  if (state === 'done' && !data) return null
  if (state === 'failed') return null

  return (
    <section
      aria-label="Bring me up to speed"
      className="glass-card-subtle p-5 space-y-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">Up to speed</p>
        {quiet != null && <p className="text-[11px]" style={{ color: 'var(--brand-text-muted)' }}>{awayFor(quiet)}</p>}
      </div>

      {state === 'loading' && !data && (
        <p className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
          <Loader2 size={14} className="animate-spin" /> Reading your notes on this…
        </p>
      )}

      {data && (
        <>
          {data.what && (
            <p className="text-[15px] leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
              {data.what}
            </p>
          )}
          {data.where && (
            <div className="space-y-1">
              <p className="eyebrow">Where you got to</p>
              <p className="type-lead">
                {data.where.text}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--brand-text-muted)' }}>from your {data.where.from}</p>
            </div>
          )}
          {data.open.length > 0 && (
            <div className="space-y-2">
              <p className="eyebrow">Still up in the air</p>
              {data.open.map(o => (
                <div key={o.text}>
                  <p className="text-[15px] leading-[1.45]" style={{ color: 'var(--brand-text-primary)' }}>
                    {o.text}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--brand-text-muted)' }}>from your {o.from}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
