/**
 * Connection Pulse
 *
 * Live notification that slides up when AI discovers new connections.
 * Non-intrusive: auto-dismisses after 8 seconds, expandable to see details.
 */

import { useState, useEffect, useRef } from 'react'
import { Sparkles, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAmbientLinker, type Discovery } from '../hooks/useAmbientLinker'

const TYPE_EMOJI: Record<string, string> = {
  thought: '💭',
  memory: '💭',
  project: '🔭',
  article: '📄',
  list_item: '📋',
  todo: '✓'
}

const TYPE_LABEL: Record<string, string> = {
  thought: 'Memory',
  memory: 'Memory',
  project: 'Project',
  article: 'Article',
  list_item: 'List',
  todo: 'Todo'
}

const TYPE_SOURCE_LABEL: Record<string, string> = {
  thought: 'memory',
  memory: 'memory',
  project: 'project',
  article: 'article',
  list_item: 'list item',
  todo: 'todo'
}

function getItemLink(id: string, type: string): string {
  if (type === 'project') return `/projects/${id}`
  if (type === 'article') return `/reading/${id}`
  if (type === 'thought' || type === 'memory') return `/memories`
  if (type === 'todo') return `/todos`
  if (type === 'list_item') return `/lists`
  return '/'
}

const CONNECTION_TYPE_LABEL: Record<string, string> = {
  relates_to: 'relates to',
  inspired_by: 'inspired by',
  evolves_from: 'evolves from',
  reading_flow: 'reading flow'
}

export function ConnectionPulse() {
  const { discoveries, dismissDiscovery } = useAmbientLinker()
  const [current, setCurrent] = useState<Discovery | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const shownTimestamps = useRef(new Set<number>())
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const latest = discoveries[0]
    if (!latest || shownTimestamps.current.has(latest.timestamp)) return

    shownTimestamps.current.add(latest.timestamp)
    setCurrent(latest)
    setExpanded(false)
    setVisible(true)

    // Auto-dismiss after 8s
    clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setVisible(false), 8000)

    return () => clearTimeout(dismissTimer.current)
  }, [discoveries])

  const dismiss = () => {
    setVisible(false)
    if (current) dismissDiscovery(current.timestamp)
  }

  if (!visible || !current) return null

  const autoLinkedCount = current.links.filter(l => l.autoLinked).length
  const totalCount = current.links.length

  return (
    <div
      className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:w-[380px] z-50 animate-slide-up"
      role="status"
      aria-label="New AI connections discovered"
    >
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-blue-500/20"
        style={{ background: 'linear-gradient(135deg, #0d1f3c 0%, #0a1628 100%)' }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-widest leading-none mb-1">
              AI linked your new {TYPE_SOURCE_LABEL[current.sourceType] || 'item'}
            </p>
            <p className="text-sm text-[var(--brand-text-primary)] font-medium truncate leading-snug">
              "{current.sourceTitle}"
              <span className="text-blue-300/70 font-normal">
                {' '}→ {totalCount} connection{totalCount !== 1 ? 's' : ''}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors text-[var(--brand-text-secondary)]"
              onClick={e => { e.stopPropagation(); setExpanded(x => !x) }}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors text-[var(--brand-text-secondary)]"
              onClick={e => { e.stopPropagation(); dismiss() }}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded connection list */}
        {expanded && (
          <div className="border-t border-[rgba(255,255,255,0.08)]">
            {current.links.slice(0, 6).map((link, i) => (
              <Link
                key={i}
                to={getItemLink(link.id, link.type)}
                onClick={dismiss}
                className="flex items-start gap-3 px-4 py-2.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors border-b border-[rgba(255,255,255,0.05)] last:border-b-0"
              >
                <span className="text-base flex-shrink-0 mt-0.5">{TYPE_EMOJI[link.type] || '🔗'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium text-blue-400/80 uppercase tracking-wide">
                      {TYPE_LABEL[link.type]}
                    </span>
                    <span className="text-[10px] text-[var(--brand-text-muted)]">
                      {CONNECTION_TYPE_LABEL[link.connectionType] || link.connectionType}
                    </span>
                    {link.autoLinked && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                        auto-linked
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--brand-text-primary)] font-medium truncate">{link.title}</p>
                  <p className="text-xs text-[var(--brand-text-secondary)] mt-0.5 line-clamp-2 leading-relaxed">
                    {link.reasoning}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-[var(--brand-text-muted)] flex-shrink-0 mt-2" />
              </Link>
            ))}
          </div>
        )}

        {/* Footer summary */}
        {autoLinkedCount > 0 && (
          <div className="px-4 py-2 bg-blue-500/10 border-t border-blue-500/15">
            <p className="text-[11px] text-blue-300 font-medium">
              ✦ {autoLinkedCount} auto-linked to your knowledge graph
              {totalCount > autoLinkedCount && (
                <span className="text-blue-400/60">
                  {' '}· {totalCount - autoLinkedCount} suggested
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
