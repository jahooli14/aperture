/**
 * ConnectionPathPicker
 * "See how this connects to..." dropdown with search + auto-suggested top 5
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Layers, Brain, BookOpen, Wand2, X } from 'lucide-react'
import type { ConnectionSourceType } from '../../types'

interface PickerItem {
  id: string
  type: string
  title: string
  subtitle?: string
  similarity?: number
}

interface ConnectionPathPickerProps {
  sourceId: string
  sourceType: ConnectionSourceType
  open: boolean
  onClose: () => void
  onSelect: (item: PickerItem) => void
}

const TYPE_ICONS: Record<string, typeof Layers> = {
  project: Layers,
  thought: Brain,
  memory: Brain,
  article: BookOpen,
}

const TYPE_COLORS: Record<string, string> = {
  project: 'rgb(var(--brand-primary-rgb))',
  thought: 'rgb(var(--brand-primary-rgb))',
  memory: 'rgb(var(--brand-primary-rgb))',
  article: 'rgb(var(--brand-primary-rgb))',
}

export function ConnectionPathPicker({ sourceId, sourceType, open, onClose, onSelect }: ConnectionPathPickerProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PickerItem[]>([])
  const [allItems, setAllItems] = useState<PickerItem[]>([])
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load top 5 auto-suggestions + all items on open
  useEffect(() => {
    if (!open) return

    setQuery('')
    setLoading(true)

    const load = async () => {
      try {
        // Fetch AI suggestions (top 5 by similarity) and all items in parallel
        const [suggestionsRes, projectsRes, memoriesRes, articlesRes] = await Promise.all([
          fetch(`/api/connections?action=suggestions&id=${sourceId}&type=${sourceType}`).then(r => r.ok ? r.json() : { suggestions: [] }),
          fetch('/api/projects').then(r => r.ok ? r.json() : { projects: [] }),
          fetch('/api/memories').then(r => r.ok ? r.json() : { memories: [] }),
          fetch('/api/reading').then(r => r.ok ? r.json() : { articles: [] }),
        ])

        // Top 5 suggestions
        const topSuggestions: PickerItem[] = (suggestionsRes.suggestions || [])
          .slice(0, 5)
          .map((s: any) => ({
            id: s.id,
            type: s.type === 'memory' ? 'thought' : s.type,
            title: s.title,
            subtitle: s.subtitle || s.matchReason,
            similarity: s.similarity,
          }))
        setSuggestions(topSuggestions)

        // Build full searchable list (excluding source item)
        const items: PickerItem[] = []
        const suggestedIds = new Set(topSuggestions.map(s => s.id))

        for (const p of projectsRes.projects || []) {
          if (p.id === sourceId || suggestedIds.has(p.id)) continue
          items.push({ id: p.id, type: 'project', title: p.title, subtitle: (p.description || '').slice(0, 80) })
        }
        for (const m of memoriesRes.memories || []) {
          if (m.id === sourceId || suggestedIds.has(m.id)) continue
          items.push({ id: m.id, type: 'thought', title: m.title || (m.body || '').slice(0, 50), subtitle: (m.body || '').slice(0, 80) })
        }
        for (const a of articlesRes.articles || []) {
          if (a.id === sourceId || suggestedIds.has(a.id)) continue
          items.push({ id: a.id, type: 'article', title: a.title, subtitle: (a.excerpt || '').slice(0, 80) })
        }
        setAllItems(items)
      } catch (err) {
        console.error('Failed to load items for picker:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [open, sourceId, sourceType])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Filter items by query — search across suggestions + all items, deduped
  const filteredItems = query.trim()
    ? (() => {
        const seen = new Set<string>()
        return [...suggestions, ...allItems]
          .filter(item => {
            if (seen.has(item.id)) return false
            seen.add(item.id)
            return item.title.toLowerCase().includes(query.toLowerCase()) ||
              (item.subtitle || '').toLowerCase().includes(query.toLowerCase())
          })
          .slice(0, 8)
      })()
    : []

  // Show suggestions when no query, filtered results when typing
  // Fall back to first 5 items if no AI suggestions available
  const defaultItems = suggestions.length > 0 ? suggestions : allItems.slice(0, 5)
  const displayItems = query.trim() ? filteredItems : defaultItems

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Picker */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ type: 'spring', damping: 30, stiffness: 500 }}
          className="relative w-full max-w-lg rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(20, 27, 38, 0.95)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <Search className="w-5 h-5 text-[var(--brand-text-muted)] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="See how this connects to..."
              className="flex-1 bg-transparent text-[var(--brand-text-primary)] text-base outline-none placeholder:text-[var(--brand-text-muted)]"
            />
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/5">
              <X className="w-4 h-4 text-[var(--brand-text-muted)]" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="px-5 py-8 flex items-center justify-center gap-3">
                <div className="h-4 w-4 border-2 border-brand-primary/30 border-t-blue-500 animate-spin rounded-full" />
                <span className="text-sm text-[var(--brand-text-muted)]">Finding related items...</span>
              </div>
            ) : displayItems.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-[var(--brand-text-muted)]">
                  {query.trim() ? 'No matches found' : 'No suggestions available'}
                </p>
              </div>
            ) : (
              <div className="py-2">
                {/* Section header */}
                {!query.trim() && (
                  <div className="px-5 py-2 flex items-center gap-2">
                    <Wand2 className="w-3 h-3 text-brand-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-primary">
                      {suggestions.length > 0 ? 'Suggested connections' : 'Your items'}
                    </span>
                  </div>
                )}

                {displayItems.map((item, i) => {
                  const Icon = TYPE_ICONS[item.type] || Layers
                  const color = TYPE_COLORS[item.type] || 'rgb(var(--brand-primary-rgb))'

                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => onSelect(item)}
                      className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors group"
                    >
                      <div
                        className="flex-shrink-0 p-1.5 rounded-lg"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate group-hover:text-white">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-xs text-[var(--brand-text-muted)] truncate mt-0.5">
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      {item.similarity && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-brand-primary px-2 py-0.5 rounded-full bg-brand-primary/10">
                          {Math.round(item.similarity * 100)}%
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
