/**
 * The project page's sit-down card. Opening a project should answer three
 * things, each once: where you are, what you've said since, what's next.
 * It used to be four cards (up to speed, threads, updates, next move) that
 * each re-read the same notes, so the same fact showed three times.
 *
 * - Where you are: the newest of your own last Update and the summary of
 *   your notes (only made for a project quiet two weeks). App-written text
 *   is never quoted as yours (isOwnWords).
 * - Still open: from the same summary.
 * - Since last time: notes about this project said after "where you are".
 *   This is what a walk note is for: it's waiting here when you sit down.
 * - Next move: a one-off's move always; an ongoing project's only when it
 *   doesn't repeat one of your own threads.
 * - One Update button.
 */

import { useEffect, useState } from 'react'
import { Flag, Loader2, Mic } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { readStoredMove, useMoveStore } from '../../stores/useMoveStore'
import { splitDoneWhen } from '../../lib/moveText'
import { daysQuiet, isLiveStatus, readThemes, UP_TO_SPEED_AFTER_DAYS, type UpToSpeed } from '../../lib/projectThemes'
import { moveRepeatsAThread, pickWhere, sinceLastTime, spokenPart, type Dated } from '../../lib/projectBrief'
import { MoveTweak } from '../home/MoveTweak'
import type { Project } from '../../types'

const muted = { color: 'var(--brand-text-muted)' }

function dayLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function useUpToSpeed(project: Project): { data: UpToSpeed | null; loading: boolean } {
  const quiet = daysQuiet(project)
  const wanted = isLiveStatus(project.status) && quiet != null && quiet >= UP_TO_SPEED_AFTER_DAYS
  const [data, setData] = useState<UpToSpeed | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!wanted) { setData(null); return }
    let live = true
    setLoading(true)
    api.post('utilities?resource=up-to-speed', { project_id: project.id }, { timeout: 40_000 })
      .then((res: { up_to_speed?: UpToSpeed | null }) => { if (live) setData(res.up_to_speed ?? null) })
      .catch(() => { if (live) setData(null) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [project.id, wanted])
  return { data, loading }
}

export function ProjectBrief({ project, updates, onUpdate, oneOff, hideMove }: {
  project: Project
  updates: Dated[]
  onUpdate: () => void
  oneOff: boolean
  /** Threads are leading (ongoing, worked lately) or it can't be started yet. */
  hideMove?: boolean
}) {
  const live = project.status !== 'completed' && project.status !== 'graveyard'
  const { data: summary, loading } = useUpToSpeed(project)

  const stored = readStoredMove(project.metadata)
  const move = stored?.kind === 'move' ? splitDoneWhen(stored.text) : null
  const fork = stored?.kind === 'fork' ? stored.text : null
  const threads = readThemes(project.metadata).map(t => t.text)
  const showMove = !hideMove && (oneOff || !moveRepeatsAThread(threads, move?.move ?? null))

  const moveBusy = useMoveStore(s => s.moveBusy)
  const [tweaking, setTweaking] = useState(false)
  // A project with no move yet gets one written when you open it.
  useEffect(() => {
    if (!live || stored || hideMove) return
    void useMoveStore.getState().loadMove(project.id)
  }, [project.id, live, stored, hideMove])

  if (!live) return null

  const where = pickWhere({
    summary: summary?.where ? { text: summary.where.text, at: summary.basis_at } : null,
    closeout: { text: project.last_closeout_text ?? null, at: project.last_active ?? null },
  })
  const since = sinceLastTime(updates, where?.at ?? null, where?.own ? where.text : null).slice(0, 3)
  const open = summary?.open ?? []

  return (
    <section aria-label="Where this project is" className="glass-card p-5 space-y-5">
      {loading && !where && (
        <p className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
          <Loader2 size={14} className="animate-spin" /> Reading your notes on this…
        </p>
      )}

      {where && (
        <div className="space-y-1">
          <p className="eyebrow">Where you are</p>
          <p className="type-lead">{where.own ? `“${where.text}”` : where.text}</p>
          <p className="text-[13px]" style={muted}>
            {where.own ? `Your last update${dayLabel(where.at) ? `, ${dayLabel(where.at)}` : ''}` : `From your ${summary?.where?.from ?? 'notes'}`}
          </p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-1.5">
          <p className="eyebrow">Still open</p>
          {open.map(o => (
            <p key={o.text} className="text-[15px] leading-snug" style={{ color: 'var(--brand-text-primary)' }}>{o.text}</p>
          ))}
        </div>
      )}

      {since.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">Since then you said</p>
          {since.map(s => (
            <div key={s.at + s.text.slice(0, 20)}>
              <p className="text-[15px] leading-snug line-clamp-3" style={{ color: 'var(--brand-text-secondary)' }}>{spokenPart(s.text)}</p>
              <p className="text-[13px]" style={muted}>{dayLabel(s.at)}</p>
            </div>
          ))}
        </div>
      )}

      {showMove && (move || fork || moveBusy) && (
        <div className="space-y-1.5">
          <p className="eyebrow">{fork ? 'First, decide' : 'Next move'}</p>
          {move || fork ? (
            <p className="type-lead">{move ? move.move : fork}</p>
          ) : (
            <p className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
              <Loader2 size={14} className="animate-spin" /> Working out where to start…
            </p>
          )}
          {move?.doneWhen && (
            <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
              <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
              {move.doneWhen}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <button
          onClick={onUpdate}
          className="neon-button w-full py-3 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
        >
          <Mic className="h-4 w-4" />
          {fork && showMove ? 'Answer it' : 'Update'}
        </button>
        {move && showMove && (
          <>
            <button onClick={() => setTweaking(t => !t)} className="w-full text-[13px] min-h-[44px]" style={muted}>
              {tweaking ? 'Keep this one' : 'Not this — change it'}
            </button>
            {tweaking && <MoveTweak projectId={project.id} onClose={() => setTweaking(false)} />}
          </>
        )}
      </div>
    </section>
  )
}
