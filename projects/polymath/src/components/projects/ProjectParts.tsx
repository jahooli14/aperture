/**
 * The parts of a project you tick off (api/_lib/project-parts.ts):
 * "Chapter 1" ... "Final pass". Tap a row to tick it; an Update that says
 * "finished chapter 4" ticks it for you. No count anywhere: the rows are
 * the progress.
 */

import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { haptic } from '../../utils/haptics'
import { useProjectStore } from '../../stores/useProjectStore'

interface Part { id: string; label: string; done: boolean }

function read(metadata: unknown): Part[] {
  const raw = (metadata as { parts?: unknown } | null)?.parts
  return Array.isArray(raw) ? raw.filter((p): p is Part => !!p && typeof (p as Part).id === 'string' && typeof (p as Part).label === 'string') : []
}

export function ProjectParts({ project }: { project: { id: string; metadata?: unknown } }) {
  const [parts, setParts] = useState<Part[]>(() => read(project.metadata))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [count, setCount] = useState('12')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const post = async (body: Record<string, unknown>) => {
    const d = await api.post('utilities?resource=project-parts', { project_id: project.id, ...body }, { timeout: 20_000 }) as { parts?: Part[] }
    if (d.parts) setParts(d.parts)
    void useProjectStore.getState().fetchProjects()
  }

  const tick = async (p: Part) => {
    haptic.light()
    setParts(ps => ps.map(x => (x.id === p.id ? { ...x, done: !x.done } : x)))
    try { await post({ action: 'tick', id: p.id, done: !p.done }) } catch {
      setParts(ps => ps.map(x => (x.id === p.id ? { ...x, done: p.done } : x)))
      setNote("That didn't save. Try again.")
    }
  }

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      await post({ action: 'set', labels: draft.split('\n').map(l => l.trim()).filter(Boolean) })
      setEditing(false)
    } catch { setNote("That didn't save. Try again.") } finally { setSaving(false) }
  }

  const fillChapters = () => {
    const n = Math.max(1, Math.min(50, Number(count) || 12))
    setDraft([...Array.from({ length: n }, (_, i) => `Chapter ${i + 1}`), 'Final pass'].join('\n'))
  }

  if (editing) {
    return (
      <div className="glass-card-subtle p-4 mb-4 space-y-2">
        <p className="eyebrow">to tick off · one per line</p>
        <div className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
          <span>Fill with</span>
          <input id="parts-count" value={count} onChange={e => setCount(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="field w-14 px-2 py-1 text-center" aria-label="How many chapters" />
          <button className="min-h-[40px] font-medium" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={fillChapters}>chapters + a final pass</button>
        </div>
        <textarea id="parts-draft" value={draft} onChange={e => setDraft(e.target.value)} rows={8} className="field w-full px-3 py-2 text-[15px] resize-none" placeholder={'Chapter 1\nChapter 2\nFinal pass'} />
        <div className="flex items-center gap-3">
          <button className="neon-button px-3 py-1.5 text-[13px] font-medium disabled:opacity-50" disabled={saving || !draft.trim()} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="text-[13px] min-h-[40px]" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={() => setEditing(false)}>cancel</button>
        </div>
        {note && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
      </div>
    )
  }

  if (parts.length === 0) {
    return (
      <button className="text-[13px] min-h-[40px] mb-2" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={() => { setDraft(''); setEditing(true) }}>
        add things to tick off
      </button>
    )
  }

  return (
    <div className="mb-4">
      <ul className="space-y-0.5">
        {parts.map(p => (
          <li key={p.id}>
            <button className="flex items-center gap-3 w-full text-left min-h-[40px]" onClick={() => { void tick(p) }} aria-pressed={p.done}>
              <span
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                style={{ border: `1.5px solid ${p.done ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)'}`, background: p.done ? 'rgba(var(--brand-primary-rgb), 0.18)' : 'transparent' }}
              >
                {p.done && <Check size={12} style={{ color: 'rgb(var(--brand-primary-rgb))' }} />}
              </span>
              <span className="text-[15px]" style={{ color: p.done ? 'var(--brand-text-muted)' : 'var(--brand-text-primary)', textDecoration: p.done ? 'line-through' : 'none' }}>{p.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="text-[13px] min-h-[40px]" style={{ color: 'var(--brand-text-muted)' }} onClick={() => { setDraft(parts.map(p => p.label).join('\n')); setEditing(true) }}>
        edit the list
      </button>
      {note && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}
    </div>
  )
}
