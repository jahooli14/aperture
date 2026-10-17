/**
 * Themes on the project page, shown to the user as "Threads": the 2-3
 * big things about this project that stay true for weeks
 * (api/_lib/project-themes.ts).
 *
 * Set by the user, or drafted from their notes and then kept or edited.
 * They follow the notes: new notes re-read them (ThemesFollowNotes), with a
 * line saying so and an Undo. The main button is Update, not Go.
 */

import { useState } from 'react'
import { Loader2, Mic, Sparkles } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { MAX_THEMES, readThemes, type ProjectTheme } from '../../lib/projectThemes'
import { ThemesUpdatedNote, useRefreshThemes } from './ThemesFollowNotes'
import type { Project } from '../../types'

export function ProjectThemes({ project, onGo }: { project: Project; onGo?: () => void }) {
  const themes = readThemes(project.metadata)
  useRefreshThemes(project)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const open = (start: string[]) => {
    const filled = [...start]
    while (filled.length < MAX_THEMES) filled.push('')
    setDraft(filled.slice(0, MAX_THEMES))
    setNote(null)
    setEditing(true)
  }

  // Said out loud: each sentence becomes a line, filling the empty ones.
  const fromSpeech = (text: string) => {
    const lines = text.split(/[.!?\n]+/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setDraft(prev => {
      const base = editing ? prev.filter(v => v.trim()) : []
      const next = [...base, ...lines].slice(0, MAX_THEMES)
      while (next.length < MAX_THEMES) next.push('')
      return next
    })
    setNote('Check these, change any, then Save.')
    setEditing(true)
  }

  const fromNotes = async () => {
    setDrafting(true)
    setNote(null)
    try {
      const res = await api.post('utilities?resource=themes', { project_id: project.id, action: 'draft' }, { timeout: 30_000 }) as { themes?: string[] }
      const found = Array.isArray(res.themes) ? res.themes : []
      if (found.length === 0) {
        setNote("Couldn't find any in your notes yet. Write your own.")
        if (!editing) open(themes.map(t => t.text))
      } else {
        open(found)
        setNote('Drafted from your notes. Keep, change or clear any of them.')
      }
    } catch {
      setNote("That didn't work. Write your own, or try again.")
      if (!editing) open(themes.map(t => t.text))
    } finally {
      setDrafting(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post('utilities?resource=themes', {
        project_id: project.id, action: 'set', themes: draft.map(t => t.trim()).filter(Boolean),
      })
      await useProjectStore.getState().fetchProjects()
      setEditing(false)
      setNote(null)
    } catch {
      setNote("Couldn't save. What you wrote is still here.")
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="glass-card p-5 space-y-3">
        <p className="eyebrow">Threads</p>
        <p className="text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
          Two or three things to hold onto while you work on this. Say them or type them. They follow your notes, and you can change them any time.
        </p>
        {draft.map((value, i) => (
          <input
            key={i}
            value={value}
            onChange={e => setDraft(d => d.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={i === 0 ? 'Every chapter in the new voice' : ''}
            aria-label={`Theme ${i + 1}`}
            maxLength={100}
            className="field w-full px-3 py-2.5 text-[15px]"
          />
        ))}
        {note && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            onClick={() => { void fromNotes() }}
            disabled={drafting}
            className="flex items-center gap-1.5 text-[13px] py-2"
            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
          >
            {drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {drafting ? 'Reading your notes…' : 'Draft from my notes'}
          </button>
          <VoiceInput variant="icon" onTranscript={fromSpeech} maxDuration={60} />
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); setNote(null) }} className="px-3 py-2 text-[13px] rounded-lg" style={{ color: 'var(--brand-text-secondary)' }}>Cancel</button>
            <button
              onClick={() => { void save() }}
              disabled={saving}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.16)', color: 'rgb(var(--brand-primary-rgb))' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (themes.length === 0) {
    return (
      <div className="glass-card-subtle p-5 space-y-2">
        <p className="eyebrow">Threads</p>
        <p className="text-[15px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
          Two or three things to hold onto while you work on this. A few words each: "every chapter in the new voice".
        </p>
        {note && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
        <div className="flex gap-4 pt-1">
          <button
            onClick={() => { void fromNotes() }}
            disabled={drafting}
            className="flex items-center gap-1.5 text-[13px] py-2"
            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
          >
            {drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {drafting ? 'Reading your notes…' : 'Draft from my notes'}
          </button>
          <button onClick={() => open([])} className="text-[13px] py-2" style={{ color: 'var(--brand-text-secondary)' }}>
            Write them
          </button>
          <span className="flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
            <VoiceInput variant="icon" onTranscript={fromSpeech} maxDuration={60} />
            Say them
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Threads</p>
        <button
          onClick={() => open(themes.map(t => t.text))}
          className="text-[13px] py-1 px-2 -mr-2"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          Edit
        </button>
      </div>
      <ThemeList themes={themes} />
      <ThemesUpdatedNote project={project} />
      {onGo && (
        <button
          onClick={onGo}
          className="neon-button w-full py-3 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2"
        >
          <Mic className="h-4 w-4" />
          Update
        </button>
      )}
    </div>
  )
}

/** The lead style, no decoration: the lines are the content. */
export function ThemeList({ themes, rgb }: { themes: ProjectTheme[]; rgb?: string }) {
  // Each line carries its own stripe, so they read as three themes, not a
  // paragraph: a bright edge and a wash that fades out to the right.
  const c = rgb ?? 'var(--brand-primary-rgb)'
  return (
    <ul className="space-y-1.5">
      {themes.map(t => (
        <li
          key={t.text}
          className="type-lead pl-3 pr-2 py-1.5 rounded-r-lg"
          style={{
            boxShadow: `inset 2px 0 0 rgba(${c},0.85)`,
            background: `linear-gradient(90deg, rgba(${c},0.16), rgba(${c},0) 75%)`,
          }}
        >
          {t.text}
        </li>
      ))}
    </ul>
  )
}
