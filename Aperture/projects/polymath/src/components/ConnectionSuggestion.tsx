/**
 * Connection Suggestion Component
 * Shows proactive connection suggestions when new content is saved
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, X, Brain, FileText, FolderKanban, ExternalLink, Check } from 'lucide-react'

interface ConnectionSuggestion {
  targetId: string
  targetType: 'memory' | 'project' | 'article'
  targetTitle: string
  reason: string
  confidence: number
  snippet?: string
}

interface ConnectionSuggestionProps {
  suggestions: ConnectionSuggestion[]
  sourceType: 'memory' | 'article' | 'project'
  sourceId: string
  onLinkCreated?: (targetId: string, targetType: string) => void
  onDismiss?: () => void
}

export function ConnectionSuggestion({
  suggestions,
  sourceType,
  sourceId,
  onLinkCreated,
  onDismiss
}: ConnectionSuggestionProps) {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || suggestions.length === 0) return null

  const handleLink = async (suggestion: ConnectionSuggestion) => {
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          sourceId,
          targetType: suggestion.targetType,
          targetId: suggestion.targetId,
          connectionType: 'ai_suggested',
          metadata: {
            reason: suggestion.reason,
            confidence: suggestion.confidence
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create connection')
      }

      setLinkedIds(prev => new Set(prev).add(suggestion.targetId))
      onLinkCreated?.(suggestion.targetId, suggestion.targetType)
    } catch (error) {
      console.error('[ConnectionSuggestion] Failed to create link:', error)
      // Still mark as linked in UI even if API fails (optimistic update)
      setLinkedIds(prev => new Set(prev).add(suggestion.targetId))
      onLinkCreated?.(suggestion.targetId, suggestion.targetType)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'memory': return Brain
      case 'project': return FolderKanban
      case 'article': return FileText
      default: return Link2
    }
  }

  const getIconColor = (type: string) => {
    switch (type) {
      case 'memory': return 'var(--premium-indigo)'
      case 'project': return 'var(--premium-blue)'
      case 'article': return 'var(--premium-emerald)'
      default: return 'var(--premium-platinum)'
    }
  }

  const getPath = (type: string, id: string) => {
    switch (type) {
      case 'memory': return `/memories#${id}`
      case 'project': return `/projects/${id}`
      case 'article': return `/reading/${id}`
      default: return '#'
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-24 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]"
      >
        <div className="premium-card p-6 shadow-2xl" style={{
          border: '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 0 40px rgba(59, 130, 246, 0.2)'
        }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                <Link2 className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
              </div>
              <div>
                <h3 className="premium-text-platinum font-bold text-base">
                  Connections Found!
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }}>
                  This relates to {suggestions.length} {suggestions.length === 1 ? 'item' : 'items'} in your knowledge
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" style={{ color: 'var(--premium-text-secondary)' }} />
            </button>
          </div>

          {/* Suggestions */}
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => {
              const Icon = getIcon(suggestion.targetType)
              const isLinked = linkedIds.has(suggestion.targetId)

              return (
                <motion.div
                  key={suggestion.targetId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="premium-glass-subtle rounded-lg p-4 group hover:bg-white/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg flex-shrink-0" style={{
                      background: `${getIconColor(suggestion.targetType)}20`
                    }}>
                      <Icon className="h-4 w-4" style={{ color: getIconColor(suggestion.targetType) }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="premium-text-platinum font-semibold text-sm truncate">
                              {suggestion.targetTitle}
                            </h4>
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0" style={{
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: 'var(--premium-blue)'
                            }}>
                              {Math.round(suggestion.confidence * 100)}%
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                            {suggestion.reason}
                          </p>
                        </div>
                      </div>

                      {suggestion.snippet && (
                        <div className="mt-2 p-2 rounded" style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: '2px solid rgba(59, 130, 246, 0.3)'
                        }}>
                          <p className="text-xs italic" style={{ color: 'var(--premium-text-tertiary)' }}>
                            "{suggestion.snippet}"
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        {isLinked ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--premium-emerald)' }}>
                            <Check className="h-3.5 w-3.5" />
                            Linked
                          </div>
                        ) : (
                          <button
                            onClick={() => handleLink(suggestion)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-white/10"
                            style={{
                              color: 'var(--premium-blue)',
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}
                          >
                            Link Together
                          </button>
                        )}

                        <a
                          href={getPath(suggestion.targetType, suggestion.targetId)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-white/10 inline-flex items-center gap-1"
                          style={{
                            color: 'var(--premium-text-secondary)',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Footer tip */}
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
            <p className="text-xs text-center" style={{ color: 'var(--premium-text-tertiary)' }}>
              💡 Linking related content helps build your knowledge graph
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
