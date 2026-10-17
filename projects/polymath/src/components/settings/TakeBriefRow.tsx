/**
 * Settings: "What I want from takes" — your own words, kept short, handed to
 * the to-mull draft (api/_lib/mull-generator.ts, `loadTakeBrief`). It steers
 * what the draft looks for. Every honesty rule still applies on top.
 */

import { useEffect, useState } from 'react'
import { api } from '../../lib/apiClient'

const MAX = 1200

export function TakeBriefRow() {
  const [saved, setSaved] = useState('')
  const [draft, setDraft] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api.get('utilities?resource=take-brief')
      .then(r => {
        const brief = typeof (r as { brief?: unknown } | null)?.brief === 'string' ? (r as { brief: string }).brief : ''
        if (live) { setSaved(brief); setDraft(brief) }
      })
      .catch(() => {})
      .finally(() => { if (live) setLoaded(true) })
    return () => { live = false }
  }, [])

  const dirty = loaded && draft.trim() !== saved.trim()

  const save = async (value: string) => {
    setBusy(true)
    setNote(null)
    try {
      const r = (await api.post('utilities?resource=take-brief', { brief: value })) as { brief: string }
      setSaved(r.brief)
      setDraft(r.brief)
      setNote(r.brief ? 'Saved. New takes will use it.' : 'Cleared.')
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't save that. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-[13px] mb-3" style={{ color: 'var(--brand-text-secondary)' }}>
        Say what you want from the to-mull takes, in your own words. What to look for, what to leave alone. New takes follow it.
      </p>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value.slice(0, MAX))}
        disabled={!loaded || busy}
        rows={5}
        placeholder="e.g. I like it when a take puts my book next to something I said about music. Leave my dad out of it."
        className="w-full p-3 rounded-xl text-[15px] leading-relaxed outline-none glass-card-subtle"
        style={{ color: 'var(--brand-text-primary)' }}
      />
      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <span className="text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>{note ?? `${draft.length} / ${MAX}`}</span>
        <div className="flex gap-2">
          <button
            onClick={() => save('')}
            disabled={!loaded || busy || !saved}
            className="px-4 py-2 rounded-lg text-[13px] disabled:opacity-40"
            style={{ color: 'var(--brand-text-secondary)', border: '1px solid var(--glass-surface-hover)' }}
          >
            Clear
          </button>
          <button
            onClick={() => save(draft)}
            disabled={!loaded || busy || !dirty}
            className="neon-button px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
