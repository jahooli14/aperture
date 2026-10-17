/**
 * "Update" — the main button on a project. Say (or type) where you got to.
 *
 * It replaced Go, which was a timer around an empty screen: nobody presses
 * start and stop, and counting minutes felt like a timesheet. A sentence is
 * easy, and it feeds everything: the note is filed under THIS project (no
 * guessing which), the "Keep in mind" lines are re-read against it, the line
 * on the card becomes your own words, and the day counts on the monthly
 * mirror. api/_lib/project-update.ts.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { VoiceInput } from '../VoiceInput'
import { ThemeList } from './ProjectThemes'
import { readThemes, type ProjectTheme } from '../../lib/projectThemes'
import type { Project } from '../../types'

type Result = { themes: ProjectTheme[]; changed: boolean; previous?: string[] }

export function UpdateSheet({ project, onClose }: { project: Project; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [undone, setUndone] = useState(false)
  const online = typeof navigator === 'undefined' || navigator.onLine

  const save = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.post('utilities?resource=project-update', { project_id: project.id, text: text.trim() }, { timeout: 60_000 }) as Result
      setResult({ themes: Array.isArray(r.themes) ? r.themes : readThemes(project.metadata), changed: !!r.changed, previous: r.previous })
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

  // In a portal: opened from the home card, whose glass blurs and clips
  // anything fixed inside it, so the sheet has to live on the body.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Update">
      <div className="absolute inset-0 bg-black/60" onClick={busy ? undefined : onClose} />
      <div
        className="relative w-full max-w-lg neon-edge rounded-t-[24px] rounded-b-none p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{ background: '#0c1322' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow truncate">{project.title}</p>
            <p className="type-lead mt-1">{result ? 'Saved' : 'Where did you get to?'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5" style={{ color: 'var(--brand-text-muted)' }}><X size={18} /></button>
        </div>

        {result ? (
          <div className="space-y-3">
            {result.changed && !undone ? (
              <>
                <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>Your lines now read:</p>
                <ThemeList themes={result.themes} />
                <button onClick={() => { void undo() }} disabled={busy} className="text-[13px] underline disabled:opacity-40" style={{ color: 'var(--brand-text-secondary)' }}>
                  {busy ? 'Undoing…' : 'Undo that'}
                </button>
              </>
            ) : (
              <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
                {undone ? 'Put your old lines back.' : 'Your lines still hold.'}
              </p>
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
                placeholder="Trimmed chapter two. Next is the voice pass."
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
              {busy ? <><Loader2 size={15} className="animate-spin" /> Reading it…</> : 'Save update'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
