/**
 * TagEditor — chips with X to remove + a small input for adding tags.
 *
 * Powered by the user's existing vocabulary: typing shows up to 6
 * suggestions ranked by how often they're used. Pressing Enter or
 * picking a suggestion adds the tag. The user can also type a brand-new
 * tag and it'll be added (and become part of the vocabulary the next
 * time the editor is opened).
 *
 * Saves on every change via /api/memories?action=update-tags. System
 * markers (onboarding / live-hybrid) are preserved server-side.
 */

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '../../lib/apiClient'

interface TagEditorProps {
  memoryId: string
  initialTags: string[]
  onChange?: (tags: string[]) => void
}

interface VocabEntry {
  tag: string
  count: number
}

export function TagEditor({ memoryId, initialTags, onChange }: TagEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags ?? [])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [vocab, setVocab] = useState<VocabEntry[]>([])
  const [saving, setSaving] = useState(false)

  // Sync from prop when the modal switches between memories.
  useEffect(() => {
    setTags(initialTags ?? [])
  }, [memoryId, initialTags])

  // Lazy-load the vocabulary the first time the user opens the add input.
  useEffect(() => {
    if (!adding || vocab.length > 0) return
    void (async () => {
      try {
        const res = await api.get('memories?action=tag-vocab') as { vocabulary?: VocabEntry[] }
        setVocab(res.vocabulary ?? [])
      } catch {
        // Non-fatal — autocomplete falls back to "type your own"
      }
    })()
  }, [adding, vocab.length])

  const persist = async (next: string[]) => {
    setTags(next)
    onChange?.(next)
    setSaving(true)
    try {
      const res = await api.post('memories?action=update-tags', { id: memoryId, tags: next }) as { tags?: string[] }
      // The server preserves system markers + cleans/dedupes — sync back
      // so the UI matches what was actually written.
      if (Array.isArray(res.tags)) {
        setTags(res.tags)
        onChange?.(res.tags)
      }
    } catch {
      // Revert on failure
      setTags(initialTags)
      onChange?.(initialTags)
    } finally {
      setSaving(false)
    }
  }

  const addTag = (raw: string) => {
    const clean = raw.trim().toLowerCase()
    if (!clean) return
    if (tags.includes(clean)) return
    void persist([...tags, clean])
    setDraft('')
    setAdding(false)
  }

  const removeTag = (tag: string) => {
    void persist(tags.filter(t => t !== tag))
  }

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return vocab
      .filter(v => !tags.includes(v.tag))
      .filter(v => (q ? v.tag.includes(q) : true))
      .slice(0, 6)
  }, [draft, vocab, tags])

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {tags.map(tag => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 pl-3 pr-1 py-1 text-xs font-medium rounded-full"
          style={{
            backgroundColor: 'rgba(148, 163, 184, 0.12)',
            color: 'var(--brand-text-secondary)',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            disabled={saving}
            className="h-5 w-5 rounded-full inline-flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-white/10 transition-opacity disabled:opacity-30"
            aria-label={`Remove ${tag}`}
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
            color: 'var(--brand-text-muted)',
            borderColor: 'rgba(148, 163, 184, 0.35)',
          }}
        >
          <Plus className="h-3 w-3" />
          add tag
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
                addTag(suggestions[0]?.tag ?? draft)
              } else if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            onBlur={() => {
              // Small delay so a click on a suggestion fires before blur kills the dropdown.
              setTimeout(() => { setAdding(false); setDraft('') }, 120)
            }}
            placeholder="tag name"
            className="px-3 py-1 text-xs rounded-full bg-[var(--glass-surface)] border outline-none focus:border-brand-primary/60 transition-colors"
            style={{
              color: 'var(--brand-text-primary)',
              borderColor: 'rgba(148, 163, 184, 0.35)',
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
                  key={s.tag}
                  type="button"
                  // onMouseDown fires before onBlur, so the click registers
                  // before the dropdown is dismissed.
                  onMouseDown={e => {
                    e.preventDefault()
                    addTag(s.tag)
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center justify-between"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  <span>{s.tag}</span>
                  <span className="opacity-40 text-[10px]">{s.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
