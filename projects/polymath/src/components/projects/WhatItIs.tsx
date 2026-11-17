/**
 * "What it is now" -- the paragraph at the top of a project page
 * (api/_lib/project-summary.ts). Drafted from everything said about the
 * project, answers included; tap to put it in your own words, typed or said.
 * Yours is never redrafted. Falls back to the old one-line description
 * until a paragraph exists.
 */

import { useEffect, useState } from 'react'
import { VoiceInput } from '../VoiceInput'
import { api } from '../../lib/apiClient'
import { haptic } from '../../utils/haptics'

interface Summary { text: string; by: 'notes' | 'you' }

function stored(metadata: unknown): Summary | null {
  const s = (metadata as { summary?: Partial<Summary> } | null)?.summary
  return s && typeof s.text === 'string' && s.text.trim() ? { text: s.text, by: s.by === 'you' ? 'you' : 'notes' } : null
}

export function WhatItIs({ project }: { project: { id: string; description?: string | null; metadata?: unknown } }) {
  const [summary, setSummary] = useState<Summary | null>(() => stored(project.metadata))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  // Quietly bring it up to date with the notes. The server leaves yours alone.
  useEffect(() => {
    let cancelled = false
    api.get(`utilities?resource=project-summary&project_id=${encodeURIComponent(project.id)}`, { timeout: 30_000 })
      .then((d: unknown) => {
        const s = (d as { summary?: Summary | null }).summary
        if (!cancelled && s?.text) setSummary({ text: s.text, by: s.by })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [project.id])

  const text = summary?.text || project.description?.trim() || ''

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const d = await api.post('utilities?resource=project-summary', { project_id: project.id, text: draft }, { timeout: 30_000 }) as { summary?: Summary | null }
      if (d.summary) setSummary(d.summary)
      haptic.success()
      setEditing(false)
    } catch {
      setNote("That didn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mb-4">
        <p className="eyebrow mb-1.5">what it is</p>
        <VoiceInput onTranscript={t => setDraft(c => (c ? `${c} ${t}` : t))} maxDuration={120} />
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={5}
          className="field w-full mt-2 px-3 py-2 text-[15px] resize-none"
          placeholder="What is it now? Say it or type it."
        />
        <div className="flex items-center gap-3 mt-2">
          <button className="neon-button px-3 py-1.5 text-[13px] font-medium disabled:opacity-50" disabled={saving || !draft.trim()} onClick={() => { void save() }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="text-[13px] min-h-[40px]" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={() => setEditing(false)}>
            cancel
          </button>
        </div>
        {note && <p className="text-[13px] mt-1" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
      </div>
    )
  }

  return (
    <div className="mb-4">
      {text ? (
        <button onClick={() => setOpen(v => !v)} className="text-left w-full" aria-expanded={open}>
          <p
            className={`text-[15px] leading-relaxed ${open ? '' : 'line-clamp-3'}`}
            style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-body)' }}
          >
            {text}
          </p>
        </button>
      ) : null}
      <button
        className="text-[13px] min-h-[40px]"
        style={{ color: 'rgb(var(--brand-primary-rgb))' }}
        onClick={() => { setDraft(text); setEditing(true) }}
      >
        {summary?.by === 'you' ? 'change it' : text ? 'not quite? say what it is' : 'say what it is'}
      </button>
    </div>
  )
}
