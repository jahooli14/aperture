/**
 * The project page's lead: the one next move, and what you've actually
 * done. Not a to-do list -- the move is written from the last session's
 * note (api/_lib/next-move.ts), and the record of work is built from what
 * got done, afterwards. The old step list, where a project has one, stays
 * folded away: it's background the move-writer reads, not orders.
 */

import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, Flag, Play } from 'lucide-react'
import { readStoredMove } from '../../stores/useSessionStore'
import { splitDoneWhen } from '../session/sessionRunOps'
import type { Project } from '../../types'

const LOG_PREVIEW = 6

interface LoggedTask { text: string; done?: boolean; completed_at?: string; created_at?: string }

export function NextMovePanel({ project, onGo, onChange, oldList }: {
  project: Project
  onGo: () => void
  onChange: () => void
  /** The old step list, rendered folded. */
  oldList: ReactNode
}) {
  const stored = readStoredMove(project.metadata)
  const move = stored?.kind === 'move' ? splitDoneWhen(stored.text) : null
  const fork = stored?.kind === 'fork' ? stored.text : null
  const tasks: LoggedTask[] = Array.isArray(project.metadata?.tasks) ? (project.metadata!.tasks as LoggedTask[]) : []
  const done = tasks
    .filter(t => t?.done && typeof t.text === 'string')
    .sort((a, b) => String(b.completed_at ?? b.created_at ?? '').localeCompare(String(a.completed_at ?? a.created_at ?? '')))
  const open = tasks.filter(t => t && !t.done && typeof t.text === 'string').length
  const [showAll, setShowAll] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const live = project.status !== 'completed' && project.status !== 'graveyard'

  return (
    <div className="space-y-6">
      {live && (
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{
            background: 'linear-gradient(160deg, rgba(var(--brand-primary-rgb),0.12), rgba(255,255,255,0.02))',
            border: '1px solid rgba(var(--brand-primary-rgb),0.28)',
          }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }}>
            {fork ? 'First, decide' : 'Next move'}
          </p>
          {move || fork ? (
            <p className="text-[21px] leading-[1.25]" style={{ fontFamily: 'var(--brand-font-serif)', color: 'var(--brand-text-primary)' }}>
              {move ? move.move : fork}
            </p>
          ) : (
            <p className="text-[14px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.87 }}>
              No move yet. One gets written when you start.
            </p>
          )}
          {move?.doneWhen && (
            <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)', opacity: 0.9 }}>
              <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgba(var(--brand-primary-rgb),0.8)' }} />
              {move.doneWhen}
            </p>
          )}
          <button
            onClick={move ? onGo : onChange}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.9)', color: '#0b1220' }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {move ? 'Go' : fork ? 'Answer it' : 'Find the first move'}
          </button>
          {move && (
            <button onClick={onChange} className="w-full text-[11.5px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}>
              Not this — change it
            </button>
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide lowercase" style={{ color: 'var(--brand-text-secondary)', opacity: 0.78 }}>
            what you’ve done
          </p>
          {(showAll ? done : done.slice(0, LOG_PREVIEW)).map((t, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[14px] leading-snug">
              <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.9 }} />
              <span className="flex-1" style={{ color: 'var(--brand-text-secondary)' }}>{splitDoneWhen(t.text).move}</span>
              {t.completed_at && (
                <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: 'var(--brand-text-secondary)', opacity: 0.69 }}>
                  {new Date(t.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
          {done.length > LOG_PREVIEW && (
            <button onClick={() => setShowAll(v => !v)} className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}>
              {showAll ? 'Show less' : `Show all ${done.length}`}
            </button>
          )}
        </div>
      )}

      {/* Folded, not gone: it can still be edited, and the move-writer
          reads it as where the project was heading. */}
      {open > 0 && (
        <div>
          <button
            onClick={() => setShowOld(v => !v)}
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}
          >
            <ChevronDown size={13} style={{ transform: showOld ? 'rotate(180deg)' : undefined }} />
            The old list ({open} left)
          </button>
          {showOld && <div className="mt-3">{oldList}</div>}
        </div>
      )}
    </div>
  )
}
