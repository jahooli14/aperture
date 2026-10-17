/**
 * "Update" — the one button on a project. Say (or type) where you got to.
 *
 * It replaced Go, which was a timer around an empty screen: nobody presses
 * start and stop, and counting minutes felt like a timesheet. A sentence is
 * easy, and it feeds everything: the note is filed under THIS project (no
 * guessing which), the "Keep in mind" lines are re-read against it, a one-off
 * project's next move is logged as done and the next one written, the line on
 * the card becomes your own words, and the day counts on the monthly mirror.
 * api/_lib/project-update.ts.
 *
 * The same sheet answers a fork ("the pole, or the wires?") on a project that
 * is waiting for its first move.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, X } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { readStoredMove, useMoveStore } from '../../stores/useMoveStore'
import { VoiceInput } from '../VoiceInput'
import { ThemeList } from './ProjectThemes'
import { splitDoneWhen } from '../../lib/moveText'
import { readThemes, type ProjectTheme } from '../../lib/projectThemes'
import type { Project } from '../../types'

interface Result {
  themes: ProjectTheme[]
  changed: boolean
  previous?: string[]
  move?: { text: string; kind: 'move' | 'fork' }
  logged?: string
  projectDone?: boolean
}

export function UpdateSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const stored = readStoredMove(project.metadata)
  const fork = stored?.kind === 'fork' ? stored.text : null
  const repeating = !!(project.metadata as { cycle?: unknown } | undefined)?.cycle

  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [undone, setUndone] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const online = typeof navigator === 'undefined' || navigator.onLine

  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      if (fork) {
        // Answering the fork writes the first move.
        await useMoveStore.getState().reworkMove(project.id, { action: 'answer', text: text.trim() })
        const s = useMoveStore.getState()
        if (s.error || !s.move) throw new Error(s.error ?? 'no move')
        setResult({ themes: [], changed: false, move: { text: s.move.text, kind: s.move.kind } })
      } else {
        const r = await api.post('utilities?resource=project-update', { project_id: project.id, text: text.trim() }, { timeout: 60_000 }) as {
          themes?: ProjectTheme[]; changed?: boolean; previous?: string[]
          move?: { text: string; kind: 'move' | 'fork' }; logged?: string; project_done?: boolean
        }
        setResult({
          themes: Array.isArray(r.themes) ? r.themes : readThemes(project.metadata),
          changed: !!r.changed, previous: r.previous, move: r.move, logged: r.logged, projectDone: !!r.project_done,
        })
      }
      await useProjectStore.getState().fetchProjects()
    } catch {
      setError("Couldn't save that. What you wrote is still here.")
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!result?.previous) return
    setBusy(true)
    try {
      await api.post('utilities?resource=themes', { project_id: project.id, action: 'set', themes: result.previous })
      await useProjectStore.getState().fetchProjects()
      setUndone(true)
    } catch { /* leave it as it is */ } finally { setBusy(false) }
  }

  const finish = async () => {
    setFinishing(true)
    try {
      if (repeating) await useMoveStore.getState().startNextCycle(project.id)
      else await useProjectStore.getState().updateProject(project.id, { status: 'completed' })
      onClose()
    } finally { setFinishing(false) }
  }

  const nextMove = result?.move?.kind === 'move' ? splitDoneWhen(result.move.text) : null
  const showLines = !!result && result.changed && !undone

  // In a portal: opened from the home card, whose glass blurs and clips
  // anything fixed inside it, so the sheet has to live on the body.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Update">
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onClose} />
      <div
        className="relative w-full max-w-lg neon-edge rounded-t-[24px] rounded-b-none p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[88vh] overflow-y-auto"
        style={{ background: '#0c1322' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow truncate">{project.title}</p>
            <p className="type-lead mt-1">{result ? 'Saved' : fork ? fork : 'Where did you get to?'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5" style={{ color: 'var(--brand-text-muted)' }}><X size={18} /></button>
        </div>

        {result ? (
          <div className="space-y-4">
            {result.logged && (
              <p className="flex items-start gap-1.5 text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
                <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                Logged as done: {splitDoneWhen(result.logged).move}
              </p>
            )}
            {nextMove && (
              <div className="space-y-1">
                <p className="eyebrow">{result.logged ? 'Next move' : 'Your move now'}</p>
                <p className="type-lead">{nextMove.move}</p>
                {nextMove.doneWhen && <p className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>{nextMove.doneWhen}</p>}
              </div>
            )}
            {showLines && (
              <div className="space-y-2">
                <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>Your lines now read:</p>
                <ThemeList themes={result.themes} />
                <button onClick={() => { void undo() }} disabled={busy} className="text-[13px] underline disabled:opacity-40" style={{ color: 'var(--brand-text-secondary)' }}>
                  {busy ? 'Undoing…' : 'Undo that'}
                </button>
              </div>
            )}
            {!nextMove && !showLines && !result.logged && (
              <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
                {undone ? 'Put your old lines back.' : readThemes(project.metadata).length > 0 ? 'Your lines still hold.' : 'Kept on the project.'}
              </p>
            )}
            {result.projectDone && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[15px]" style={{ color: 'var(--brand-text-primary)' }}>
                  {repeating ? 'Sounds like that one is done.' : `Sounds like the whole thing is finished. Mark ${project.title} as done?`}
                </p>
                <button onClick={() => { void finish() }} disabled={finishing} className="neon-button px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-50">
                  {finishing ? 'One moment…' : repeating ? 'Line up the next one' : 'Mark it done'}
                </button>
              </div>
            )}
            <button onClick={onClose} className="neon-button w-full py-3 rounded-xl font-semibold text-[15px]">Done</button>
          </div>
        ) : !online ? (
          <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>This needs a connection. Try again when you're back online.</p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={busy}
                rows={5}
                placeholder={fork ? 'Your answer' : 'Trimmed chapter two. Next is the voice pass.'}
                className="field w-full px-3 py-2.5 pr-12 text-[15px]"
              />
              <div className="absolute right-2 bottom-2">
                <VoiceInput variant="icon" autoStart onTranscript={t => setText(c => (c ? `${c} ${t}` : t))} maxDuration={60} />
              </div>
            </div>
            {error && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>}
            <button
              onClick={() => { void save() }}
              disabled={busy || !text.trim()}
              className="neon-button w-full py-3 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {busy ? <><Loader2 size={15} className="animate-spin" /> Reading it…</> : fork ? 'Save answer' : 'Save update'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
