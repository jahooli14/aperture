/**
 * Settings: "This season" — say what matters for a stretch of time.
 *
 * "Until Christmas, Going Analogue is main, Oscar's toy is second, and the
 * rest is for fun." Said or typed, read back as a form you can correct,
 * then saved (api/_lib/season.ts). From then on the daily takes lead with
 * the main project, then the others, and always leave room for something
 * fun. Nothing is deleted when a season ends; it just stops being weighted.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { VoiceInput } from '../VoiceInput'
import { useProjectStore } from '../../stores/useProjectStore'

interface Pick { id: string; title: string }
type Size = 'hours' | 'weekend' | null
interface Small extends Pick { size?: Size; blocked?: boolean; waiting?: string | null; from?: string | null }
interface Season { main: Pick | null; also: Small[]; until: string | null; label: string | null; active?: boolean }
interface Proposal { main: Pick | null; also: Small[]; until: string | null; label: string | null }
/** One row of the form: a project, how big, what it's waiting on. */
interface Row { id: string; size: Size; waiting: string; from: string | null }

const SLOTS = 3
const blankRow = (): Row => ({ id: '', size: null, waiting: '', from: null })
const toRows = (list: Small[]): Row[] =>
  Array.from({ length: SLOTS }, (_, i) => {
    const a = list[i]
    return a ? { id: a.id, size: a.size ?? null, waiting: a.waiting ?? '', from: a.from ?? null } : blankRow()
  })

const label = 'eyebrow'
const field = 'field w-full px-3 py-2.5 text-[15px]'

function niceDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export function SeasonRow() {
  const [season, setSeason] = useState<Season | null>(null)
  const [projects, setProjects] = useState<Pick[]>([])
  const [editing, setEditing] = useState(false)
  const [said, setSaid] = useState('')
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [main, setMain] = useState('')
  const [also, setAlso] = useState<Row[]>(toRows([]))
  const [until, setUntil] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    let live = true
    api.post('utilities?resource=season', { action: 'get' })
      .then((r: { season: Season; projects: Pick[] }) => { if (live) { setSeason(r.season); setProjects(r.projects) } })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const open = () => {
    setMain(season?.main?.id ?? '')
    setAlso(toRows(season?.also ?? []))
    setUntil(season?.until ?? '')
    setName(season?.label ?? '')
    setNote(null)
    setSaid('')
    setEditing(true)
  }

  const readIt = async () => {
    if (!said.trim()) return
    setReading(true)
    setNote(null)
    try {
      const r = await api.post('utilities?resource=season', { action: 'read', text: said }, { timeout: 30_000 }) as { proposal: Proposal | null }
      if (!r.proposal) {
        setNote("Couldn't match that to your projects. Pick them below.")
      } else {
        // Keep the current main when they only named others.
        if (r.proposal.main) setMain(r.proposal.main.id)
        setAlso(toRows(r.proposal.also))
        setUntil(r.proposal.until ?? '')
        setName(r.proposal.label ?? '')
        setNote('Here\'s what I heard. Fix anything, then save.')
      }
    } catch {
      setNote("That didn't work. Pick them below.")
    } finally {
      setReading(false)
    }
  }

  const save = async () => {
    if (!main) { setNote('Pick the main project first.'); return }
    setSaving(true)
    try {
      const r = await api.post('utilities?resource=season', {
        action: 'apply', main_id: main, until: until || null, label: name || null,
        also: also.filter(a => a.id).map(a => ({
          id: a.id, size: a.size, waiting: a.waiting.trim() || null, from: a.from,
        })),
      }) as { season: Season }
      setSeason(r.season)
      await useProjectStore.getState().fetchProjects()
      setEditing(false)
    } catch {
      setNote("Couldn't save that. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const gotIt = async (id: string) => {
    setSaving(true)
    try {
      const r = await api.post('utilities?resource=season', { action: 'unblock', project_id: id }) as { season: Season }
      setSeason(r.season)
    } catch {
      setNote("Couldn't save that. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const end = async () => {
    setSaving(true)
    try {
      const r = await api.post('utilities?resource=season', { action: 'clear' }) as { season: Season }
      setSeason(r.season)
      await useProjectStore.getState().fetchProjects()
      setEditing(false)
    } catch {
      setNote("Couldn't end it. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!season) return null

  const options = (skip: string[]) => projects.filter(p => !skip.includes(p.id))
  const setRow = (i: number, patch: Partial<Row>) => setAlso(rows => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const waitingOn = (season?.also ?? []).filter(a => a.waiting)

  return (
    <div className="glass-card-subtle">
      <div className="px-4 py-3.5">
        <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>This season</p>
        {!editing && (
          <>
            <p className="text-[13px] mt-0.5 leading-snug" style={{ color: 'var(--brand-text-muted)' }}>
              {season.main && season.active !== false
                ? `${season.main.title} is main${season.also.length ? `, then ${season.also.map(p => p.title).join(' and ')}` : ''}${season.until ? `, until ${season.label ?? niceDate(season.until)}` : ''}. The rest is for fun.`
                : 'Say what matters for a stretch of time, and the takes will aim at it. The rest stays for fun.'}
            </p>
            {season.active !== false && waitingOn.map(a => (
              <p key={a.id} className="text-[13px] mt-1 leading-snug flex items-center gap-2" style={{ color: 'var(--brand-text-muted)' }}>
                <span>{a.title} is waiting for {a.waiting}.</span>
                <button onClick={() => { void gotIt(a.id) }} disabled={saving} className="py-1 disabled:opacity-40" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
                  Got it
                </button>
              </p>
            ))}
            <button onClick={open} className="text-[13px] mt-2 py-1" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
              {season.main && season.active !== false ? 'Change it' : 'Set it'}
            </button>
          </>
        )}
      </div>

      {editing && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--glass-surface)] pt-3">
          <p className="text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
            Say it, like: "Until Christmas, Going Analogue is main and Oscar's toy is second."
          </p>
          <div className="flex items-start gap-2">
            <textarea
              value={said}
              onChange={e => setSaid(e.target.value)}
              rows={2}
              placeholder="Or type it…"
              aria-label="Say what matters this season"
              className={`${field} resize-none flex-1`}
            />
            <VoiceInput variant="icon" onTranscript={t => setSaid(c => (c ? `${c} ${t}` : t))} maxDuration={60} />
          </div>
          <button
            onClick={() => { void readIt() }}
            disabled={reading || saving || !said.trim()}
            className="text-[13px] py-1 flex items-center gap-1.5 disabled:opacity-40"
            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
          >
            {reading && <Loader2 size={13} className="animate-spin" />}
            {reading ? 'Reading…' : 'Read it'}
          </button>

          {note && <p role="status" aria-live="polite" className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{note}</p>}

          <label className="block">
            <span className={label}>Main</span>
            <select value={main} onChange={e => setMain(e.target.value)} className={`${field} mt-1`}>
              <option value="">Pick one</option>
              {options(also.map(r => r.id)).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          {also.map((row, i) => (
            <div key={i} className="space-y-2">
              <label className="block">
                <span className={label}>{i === 0 ? 'Also finish' : 'And'}</span>
                <select
                  value={row.id}
                  onChange={e => setRow(i, { id: e.target.value })}
                  className={`${field} mt-1`}
                  aria-label={`Also finish ${i + 1}`}
                >
                  <option value="">None</option>
                  {options([main, ...also.filter((_, j) => j !== i).map(r => r.id)]).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              {row.id && (
                <div className="flex gap-2">
                  <select
                    value={row.size ?? ''}
                    onChange={e => setRow(i, { size: (e.target.value || null) as Size })}
                    className={`${field} flex-1`}
                    aria-label={`How big is finish ${i + 1}`}
                  >
                    <option value="">How big?</option>
                    <option value="hours">A few hours</option>
                    <option value="weekend">A weekend</option>
                  </select>
                  <input
                    value={row.waiting}
                    maxLength={40}
                    onChange={e => setRow(i, { waiting: e.target.value })}
                    placeholder="Waiting for…"
                    aria-label={`What finish ${i + 1} is waiting for`}
                    className={`${field} flex-1`}
                  />
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className={label}>Until</span>
              <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block flex-1">
              <span className={label}>Called</span>
              <input value={name} maxLength={30} onChange={e => setName(e.target.value)} placeholder="Christmas" className={`${field} mt-1`} />
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            {season.main && season.active !== false
              ? <button onClick={() => { void end() }} disabled={saving} className="text-[13px] py-2" style={{ color: 'var(--brand-text-secondary)' }}>End the season</button>
              : <span />}
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} disabled={saving} className="px-3 py-2 text-[13px] rounded-lg disabled:opacity-40" style={{ color: 'var(--brand-text-secondary)' }}>Cancel</button>
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
      )}
    </div>
  )
}
