/**
 * Themes on the project page: the 2-3 big things this project is steering
 * by, which stay true for weeks (api/_lib/project-themes.ts).
 *
 * Set by the user, or drafted from their notes and then kept or edited.
 * Nothing updates them behind their back and nothing asks if they're still
 * right — they change when the user changes them.
 */

import { useState } from 'react'
import { Loader2, Pencil, Sparkles } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { MAX_THEMES, readThemes, themeDate, type ProjectTheme } from '../../lib/projectThemes'
import type { Project } from '../../types'

const label = 'text-[11px] font-bold uppercase tracking-[0.14em]'

export function ProjectThemes({ project }: { project: Project }) {
  const themes = readThemes(project.metadata)
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
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(var(--brand-primary-rgb),0.22)' }}>
        <p className={label} style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }}>Steering by</p>
        <p className="text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
          Two or three big things that stay true for weeks. Not today's step.
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
        {note && <p className="text-[12px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
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
      <div className="rounded-2xl p-5 space-y-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className={label} style={{ color: 'var(--brand-text-muted)' }}>Steering by</p>
        <p className="text-[14px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
          The big things this project is about right now. They stay on the home card while you're working on it.
        </p>
        {note && <p className="text-[12px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
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
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between">
        <p className={label} style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }}>Steering by</p>
        <button
          onClick={() => open(themes.map(t => t.text))}
          aria-label="Change themes"
          className="p-2 -m-2 rounded-lg"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          <Pencil size={14} />
        </button>
      </div>
      <ThemeList themes={themes} />
    </div>
  )
}

export function ThemeList({ themes, compact = false }: { themes: ProjectTheme[]; compact?: boolean }) {
  return (
    <ul className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {themes.map(t => (
        <li key={t.text} className="pl-3" style={{ borderLeft: '2px solid rgba(var(--brand-primary-rgb),0.45)' }}>
          <p
            className={compact ? 'text-[15px] leading-[1.35]' : 'text-[16px] leading-[1.35]'}
            style={{ color: 'var(--brand-text-primary)', fontFamily: 'var(--brand-font-body)' }}
          >
            {t.text}
          </p>
          {!compact && themeDate(t.at) && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--brand-text-muted)' }}>since {themeDate(t.at)}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
