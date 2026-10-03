/**
 * The project page's lead: the one next move, a box to tell it what changed,
 * and what you've actually done.
 *
 * Not a to-do list. The move is written from the last session's note
 * (api/_lib/next-move.ts); the record of work is built from what got done,
 * afterwards. The say-box is the old Guide chat folded into the move it was
 * always about: "I did that" logs the move and writes the next one, "the
 * left side is 2cm low" rewrites it, "the whole thing is done" offers to
 * finish the project. One engine, so the card and the reply can't disagree.
 */

import { useEffect, useState } from 'react'
import { ArrowUp, Check, Flag, Loader2, Play } from 'lucide-react'
import { readStoredMove, useSessionStore } from '../../stores/useSessionStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { splitDoneWhen } from '../session/sessionRunOps'
import { VoiceInput } from '../VoiceInput'
import { api } from '../../lib/apiClient'
import type { Project } from '../../types'

const LOG_PREVIEW = 6
/** Same floor the home card uses: "Done." is an acknowledgement, not a note
 *  worth playing back. */
const MIN_USEFUL_NOTE = 25

interface LoggedTask { text: string; done?: boolean; completed_at?: string; created_at?: string }

interface SayResult {
  move?: { text: string; kind: 'move' | 'fork' }
  logged?: string
  project_done?: boolean
}

export function NextMovePanel({ project, onGo, onChange, onFinish }: {
  project: Project
  onGo: () => void
  onChange: () => void
  /** They said the whole project is finished and confirmed it. */
  onFinish: () => void
}) {
  const stored = readStoredMove(project.metadata)
  const hasStoredMove = stored !== null
  const move = stored?.kind === 'move' ? splitDoneWhen(stored.text) : null
  const fork = stored?.kind === 'fork' ? stored.text : null
  const tasks: LoggedTask[] = Array.isArray(project.metadata?.tasks) ? (project.metadata!.tasks as LoggedTask[]) : []
  const done = tasks
    .filter(t => t?.done && typeof t.text === 'string')
    .sort((a, b) => String(b.completed_at ?? b.created_at ?? '').localeCompare(String(a.completed_at ?? a.created_at ?? '')))
  const [showAll, setShowAll] = useState(false)
  const live = project.status !== 'completed' && project.status !== 'graveyard'
  const note = project.last_closeout_text?.trim() ?? ''
  const lastNote = note.length >= MIN_USEFUL_NOTE ? note : null

  const moveBusy = useSessionStore(s => s.moveBusy)
  const [said, setSaid] = useState('')
  const [sending, setSending] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [askFinish, setAskFinish] = useState(false)

  // A project with no move yet gets one written the moment you open it — a
  // first move for a new project, a way back in for an old one — rather than
  // a card that says "No move yet" and waits for a tap.
  useEffect(() => {
    if (!live || hasStoredMove) return
    void useSessionStore.getState().loadMove(project.id)
  }, [project.id, live, hasStoredMove])

  const send = async () => {
    const text = said.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    setReceipt(null)
    try {
      const result = await api.post('utilities?resource=move', {
        project_id: project.id, action: 'say', text,
      }, { timeout: 60_000 }) as SayResult
      setSaid('')
      if (result.logged) setReceipt(`Logged as done: ${result.logged}`)
      setAskFinish(result.project_done === true)
      // The log and the move both changed on the server.
      await useProjectStore.getState().fetchProjects()
    } catch {
      setError('That didn’t send. What you said is still here — try again.')
    } finally {
      setSending(false)
    }
  }

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
            <p className="flex items-center gap-2 text-[14px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.87 }}>
              {moveBusy && <Loader2 size={14} className="animate-spin" />}
              {moveBusy ? 'Working out where to start…' : 'No move yet.'}
            </p>
          )}
          {move?.doneWhen && (
            <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)', opacity: 0.9 }}>
              <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgba(var(--brand-primary-rgb),0.8)' }} />
              {move.doneWhen}
            </p>
          )}
          {lastNote && (
            <p className="text-[12.5px] italic leading-snug line-clamp-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.8 }}>
              You stopped with “{lastNote}”
            </p>
          )}
          <button
            onClick={move ? onGo : onChange}
            disabled={!move && !fork && moveBusy}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-50"
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

          {/* Tell it what changed. */}
          <div className="pt-1">
            <div
              className="flex items-center gap-1 rounded-xl pl-3 pr-1.5 py-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <input
                value={said}
                onChange={e => setSaid(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void send() }}
                placeholder="What changed, or what’s next?"
                aria-label="Tell this project what changed"
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px] py-2"
                style={{ color: 'var(--brand-text-primary)' }}
                disabled={sending}
              />
              <VoiceInput variant="icon" onTranscript={t => setSaid(c => (c ? `${c} ${t}` : t))} maxDuration={30} />
              <button
                onClick={() => void send()}
                disabled={!said.trim() || sending}
                aria-label="Send"
                className="h-9 w-9 rounded-full flex items-center justify-center disabled:opacity-30"
                style={{ background: 'rgba(var(--brand-primary-rgb),0.9)', color: '#0b1220' }}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
              </button>
            </div>
            {receipt && (
              <p className="mt-2 flex items-start gap-1.5 text-[12.5px]" style={{ color: 'var(--brand-text-secondary)' }}>
                <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                {receipt}
              </p>
            )}
            {error && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>}
            {askFinish && (
              <div className="mt-3 rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[14px]" style={{ color: 'var(--brand-text-primary)' }}>
                  Sounds like the whole thing is finished. Mark {project.title} as done?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setAskFinish(false); onFinish() }}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold"
                    style={{ background: 'rgba(var(--brand-primary-rgb),0.9)', color: '#0b1220' }}
                  >
                    Mark it done
                  </button>
                  <button onClick={() => setAskFinish(false)} className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
                    Not quite
                  </button>
                </div>
              </div>
            )}
          </div>
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
    </div>
  )
}
