/**
 * ConnectionsList Component
 * Displays all connections (Sparks) for a given item
 * Shows both inbound and outbound links with item previews
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, ArrowLeft, Link as LinkIcon, Trash2, Brain, Rocket, BookOpen, Lightbulb, RefreshCw, X, Check, Plus } from 'lucide-react'
import type { ItemConnection, ConnectionSourceType } from '../../types'
import { CreateConnectionDialog } from './CreateConnectionDialog'

interface ConnectionsListProps {
  itemType: ConnectionSourceType
  itemId: string
  content?: string // For AI suggestions
  onConnectionDeleted?: () => void
  onConnectionCreated?: () => void
}

interface AISuggestion {
  type: 'project' | 'thought' | 'article'
  id: string
  title: string
  content: string
  similarity: number
  reasoning?: string
}

const SCHEMA_COLORS = {
  project: {
    primary: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: Rocket
  },
  thought: {
    primary: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: Brain
  },
  article: {
    primary: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: BookOpen
  },
  suggestion: {
    primary: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: Lightbulb
  }
}

const CONNECTION_TYPE_LABELS = {
  inspired_by: 'Inspired by',
  relates_to: 'Related to',
  evolves_from: 'Evolved from',
  ai_suggested: 'AI suggested link',
  manual: 'Linked',
  reading_flow: 'From reading'
}

export function ConnectionsList({ itemType, itemId, content, onConnectionDeleted, onConnectionCreated }: ConnectionsListProps) {
  const [connections, setConnections] = useState<ItemConnection[]>([])
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    fetchConnections()
    if (content) {
      fetchAISuggestions()
    }
  }, [itemType, itemId, content])

  const fetchConnections = async () => {
    setLoading(true)
    setError(null)
    try {
      // Use /api/connections with action=list-sparks
      const response = await fetch(`/api/connections?action=list-sparks&id=${itemId}&type=${itemType}`)
      if (!response.ok) {
        throw new Error('Failed to fetch connections')
      }
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (err) {
      console.error('Error fetching connections:', err)
      setError('Failed to load connections')
    } finally {
      setLoading(false)
    }
  }

  const fetchAISuggestions = async () => {
    if (!content) return

    setLoadingSuggestions(true)
    try {
      // Get existing connection IDs to avoid re-suggesting
      const existingIds = connections.map(c => c.related_id)

      const response = await fetch('/api/connections?action=auto-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          itemId,
          content,
          existingConnectionIds: existingIds
          // Note: userId is handled server-side by getUserId()
        })
      })

      if (!response.ok) {
        console.warn('Failed to fetch AI suggestions')
        return
      }

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Error fetching AI suggestions:', err)
      // Don't show error for suggestions - fail silently
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleConnectSuggestion = async (suggestion: AISuggestion) => {
    try {
      const response = await fetch('/api/connections?action=create-spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: itemType,
          source_id: itemId,
          target_type: suggestion.type,
          target_id: suggestion.id,
          connection_type: 'relates_to',
          created_by: 'ai',
          ai_reasoning: suggestion.reasoning || `${Math.round(suggestion.similarity * 100)}% semantic similarity`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create connection')
      }

      // Remove from suggestions and add to connections
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id))
      await fetchConnections()
      onConnectionCreated?.()
    } catch (err) {
      console.error('Error connecting suggestion:', err)
      alert('Failed to create connection')
    }
  }

  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedIds(prev => new Set(prev).add(suggestionId))
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Remove this connection?')) return

    try {
      const response = await fetch(`/api/connections?action=delete-spark&connection_id=${connectionId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete connection')
      }

      // Refresh connections
      await fetchConnections()
      onConnectionDeleted?.()
    } catch (err) {
      console.error('Error deleting connection:', err)
      alert('Failed to remove connection')
    }
  }

  const getItemUrl = (type: string, id: string): string => {
    switch (type) {
      case 'project':
        return `/projects/${id}`
      case 'thought':
        return `/memories?highlight=${id}`
      case 'article':
        return `/reading?highlight=${id}`
      case 'suggestion':
        return `/suggestions?highlight=${id}`
      default:
        return '#'
    }
  }

  const getItemTitle = (connection: ItemConnection): string => {
    const item = connection.related_item
    if (!item) return 'Unknown item'

    // For thoughts/memories, use title first, then body
    if ('title' in item && typeof item.title === 'string' && item.title) return item.title
    if ('body' in item && typeof item.body === 'string' && item.body) {
      return item.body.slice(0, 60) + (item.body.length > 60 ? '...' : '')
    }
    return 'Untitled thought'
  }

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent"></div>
        <p className="mt-3 text-sm text-neutral-600">Loading connections...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <Sparkles className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <p className="text-neutral-900 font-semibold">{error}</p>
      </div>
    )
  }

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id))
  const hasNoContent = connections.length === 0 && visibleSuggestions.length === 0

  if (hasNoContent && !loadingSuggestions) {
    return (
      <>
        <div className="py-8 text-center">
          <LinkIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-600 text-sm mb-3">No connections yet</p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              color: 'var(--premium-blue)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'}
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </button>
        </div>
        <CreateConnectionDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          sourceType={itemType}
          sourceId={itemId}
          sourceContent={content}
          onConnectionCreated={() => {
            fetchConnections()
            onConnectionCreated?.()
            setShowCreateDialog(false)
          }}
        />
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Connection Button */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold premium-text-secondary">
          Connections
        </h4>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            color: 'var(--premium-blue)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Link
        </button>
      </div>

      {/* Manual Connections Section */}
      {connections.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold premium-text-secondary mb-3">
            Linked ({connections.length})
          </h4>
          <div className="space-y-3">
            {connections.map((connection, index) => {
              const schema = SCHEMA_COLORS[connection.related_type as keyof typeof SCHEMA_COLORS] || SCHEMA_COLORS.project
              const Icon = schema.icon
              const isOutbound = connection.direction === 'outbound'

              return (
                <motion.div
                  key={connection.connection_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    to={getItemUrl(connection.related_type, connection.related_id)}
                    className="group relative overflow-hidden rounded-xl backdrop-blur-xl bg-white/80 border-2 shadow-lg hover-lift p-4 block transition-all duration-300 hover:shadow-xl"
                    style={{ borderColor: schema.light }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
                      style={{ backgroundColor: schema.bg }}
                    />

                    <div className="relative z-10">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 mt-1">
                          <Icon className="h-5 w-5" style={{ color: schema.primary }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                              {connection.related_type}
                            </span>
                            {isOutbound ? (
                              <ArrowRight className="h-3 w-3 text-neutral-400" />
                            ) : (
                              <ArrowLeft className="h-3 w-3 text-neutral-400" />
                            )}
                            <span className="text-xs text-neutral-500">
                              {CONNECTION_TYPE_LABELS[connection.connection_type]}
                            </span>
                            {connection.created_by === 'ai' && (
                              <Sparkles className="h-3 w-3 text-amber-500" />
                            )}
                          </div>

                          <h4 className="font-medium text-neutral-900 mb-1 line-clamp-2">
                            {getItemTitle(connection)}
                          </h4>

                          {connection.ai_reasoning && (
                            <p className="text-xs text-neutral-600 italic line-clamp-2">
                              "{connection.ai_reasoning}"
                            </p>
                          )}

                          <div className="text-xs text-neutral-500 mt-2">
                            {new Date(connection.created_at).toLocaleDateString()}
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteConnection(connection.connection_id)
                          }}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                          title="Remove connection"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div
                      className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2"
                      style={{ background: `linear-gradient(90deg, ${schema.primary}, ${schema.primary}AA)` }}
                    />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Suggestions Section */}
      {(visibleSuggestions.length > 0 || loadingSuggestions) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold premium-text-secondary flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'var(--premium-gold)' }} />
              AI Discovered
              {visibleSuggestions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{
                  background: 'var(--premium-gold-gradient)',
                  color: 'white'
                }}>
                  {visibleSuggestions.length} new
                </span>
              )}
            </h4>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              <RefreshCw className="h-3 w-3" />
              {new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {loadingSuggestions && visibleSuggestions.length === 0 && (
            <div className="py-6 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-amber-500 border-r-transparent"></div>
              <p className="mt-2 text-xs text-neutral-500">Discovering connections...</p>
            </div>
          )}

          <div className="space-y-3">
            {visibleSuggestions.map((suggestion, index) => {
              const schema = SCHEMA_COLORS[suggestion.type as keyof typeof SCHEMA_COLORS] || SCHEMA_COLORS.project
              const Icon = schema.icon
              const matchPercentage = Math.round(suggestion.similarity * 100)

              return (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative overflow-hidden rounded-xl backdrop-blur-xl bg-gradient-to-r from-amber-50/50 to-yellow-50/50 border-2 shadow-md hover:shadow-lg p-4 transition-all duration-300"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}
                >
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold" style={{
                    background: `linear-gradient(135deg, ${schema.primary}22, ${schema.primary}44)`,
                    color: schema.primary
                  }}>
                    {matchPercentage}% match
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <Icon className="h-5 w-5" style={{ color: schema.primary }} />
                    </div>

                    <div className="flex-1 min-w-0 pr-12">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                          {suggestion.type}
                        </span>
                      </div>

                      <h4 className="font-semibold text-neutral-900 mb-2 line-clamp-2">
                        {suggestion.title}
                      </h4>

                      {suggestion.reasoning && (
                        <p className="text-sm text-neutral-700 italic mb-3 line-clamp-2 flex items-start gap-1">
                          <Brain className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--premium-gold)' }} />
                          <span>"{suggestion.reasoning}"</span>
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConnectSuggestion(suggestion)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5"
                          style={{
                            background: 'var(--premium-blue-gradient)',
                            color: 'white'
                          }}
                        >
                          <Check className="h-3 w-3" />
                          Connect
                        </button>
                        <button
                          onClick={() => handleDismissSuggestion(suggestion.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 hover:bg-neutral-100"
                          style={{
                            borderColor: 'rgba(0, 0, 0, 0.1)',
                            color: 'var(--premium-text-secondary)'
                          }}
                        >
                          <X className="h-3 w-3" />
                          Not relevant
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ background: 'linear-gradient(90deg, var(--premium-gold), var(--premium-gold-light))' }}
                  />
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create Connection Dialog */}
      <CreateConnectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        sourceType={itemType}
        sourceId={itemId}
        onConnectionCreated={() => {
          fetchConnections()
          onConnectionCreated?.()
          setShowCreateDialog(false)
        }}
      />
    </div>
  )
}
