/**
 * ThemeEditor — chips with X to remove + a small input for adding themes
 * to a single thought. Mirrors the TagEditor pattern.
 *
 * AI assigns themes automatically during processing; this editor is the
 * manual override so the user can re-bucket a thought after the fact.
 * Themes are the canonical organising axis on the Thoughts page (the
 * Themes tab + cluster cards both read them), so this is now the main
 * grouping affordance on a memory.
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '../../lib/apiClient'

interface ThemeEditorProps {
  memoryId: string
  initialThemes: string[]
  onChange?: (themes: string[]) => void
}

interface VocabEntry {
  theme: string
  count: number
}

export function ThemeEditor({ memoryId, initialThemes, onChange }: ThemeEditorProps) {
  const [themes, setThemes] = useState<string[]>(initialThemes ?? [])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [vocab, setVocab] = useState<VocabEntry[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setThemes(initialThemes ?? [])
  }, [memoryId, initialThemes])

  useEffect(() => {
    if (!adding || vocab.length > 0) return
    void (async () => {
      try {
        const res = await api.get('memories?action=theme-vocab') as { vocabulary?: VocabEntry[] }
        setVocab(res.vocabulary ?? [])
      } catch {
        // Non-fatal — user can still type a custom theme.
      }
    })()
  }, [adding, vocab.length])

  const persist = async (next: string[]) => {
    setThemes(next)
    onChange?.(next)
    setSaving(true)
    try {
      const res = await api.post('memories?action=update-themes', { id: memoryId, themes: next }) as { themes?: string[] }
      if (Array.isArray(res.themes)) {
        setThemes(res.themes)
        onChange?.(res.themes)
      }
    } catch {
      setThemes(initialThemes)
      onChange?.(initialThemes)
    } finally {
      setSaving(false)
    }
  }

  const addTheme = (raw: string) => {
    const clean = raw.trim().toLowerCase()
    if (!clean) return
    if (themes.includes(clean)) return
    void persist([...themes, clean])
    setDraft('')
    setAdding(false)
  }

  const removeTheme = (theme: string) => {
    void persist(themes.filter(t => t !== theme))
  }

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return vocab
      .filter(v => !themes.includes(v.theme))
      .filter(v => (q ? v.theme.includes(q) : true))
      .slice(0, 6)
  }, [draft, vocab, themes])

  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold tracking-[0.18em] mb-2"
        style={{ color: 'rgba(var(--brand-primary-rgb), 0.7)' }}>
        themes
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {themes.map(theme => (
          <span
            key={theme}
            className="group inline-flex items-center gap-1 pl-3 pr-1 py-1 text-xs font-medium rounded-full"
            style={{
              backgroundColor: 'rgba(var(--brand-primary-rgb), 0.14)',
              color: 'rgb(var(--brand-primary-rgb))',
              border: '1px solid rgba(var(--brand-primary-rgb), 0.35)',
            }}
          >
            {theme}
            <button
              type="button"
              onClick={() => removeTheme(theme)}
              disabled={saving}
              className="h-5 w-5 rounded-full inline-flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-white/10 transition-opacity disabled:opacity-30"
              aria-label={`Remove ${theme}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-dashed transition-colors hover:bg-white/5"
            style={{
              color: 'rgba(var(--brand-primary-rgb), 0.85)',
              borderColor: 'rgba(var(--brand-primary-rgb), 0.4)',
            }}
          >
            <Plus className="h-3 w-3" />
            add theme
          </button>
        ) : (
          <div className="relative">
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTheme(suggestions[0]?.theme ?? draft)
                } else if (e.key === 'Escape') {
                  setDraft('')
                  setAdding(false)
                }
              }}
              onBlur={() => {
                setTimeout(() => { setAdding(false); setDraft('') }, 120)
              }}
              placeholder="theme"
              className="px-3 py-1 text-xs rounded-full bg-[var(--glass-surface)] border outline-none focus:border-brand-primary/60 transition-colors"
              style={{
                color: 'var(--brand-text-primary)',
                borderColor: 'rgba(var(--brand-primary-rgb), 0.35)',
                minWidth: '8rem',
              }}
            />
            {suggestions.length > 0 && (
              <div
                className="absolute top-full left-0 mt-1 z-20 min-w-[10rem] rounded-lg backdrop-blur-xl py-1 shadow-lg border"
                style={{
                  background: 'rgba(15, 24, 41, 0.95)',
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                }}
              >
                {suggestions.map(s => (
                  <button
                    key={s.theme}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      addTheme(s.theme)
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center justify-between"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    <span>{s.theme}</span>
                    <span className="opacity-40 text-[10px]">{s.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
