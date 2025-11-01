/**
 * ConnectionsList Component
 * Displays all connections (Sparks) for a given item
 * Shows both inbound and outbound links with item previews
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, ArrowLeft, Link as LinkIcon, Trash2, Brain, Rocket, BookOpen, Lightbulb } from 'lucide-react'
import type { ItemConnection, ConnectionSourceType } from '../../types'

interface ConnectionsListProps {
  itemType: ConnectionSourceType
  itemId: string
  onConnectionDeleted?: () => void
}

const SCHEMA_COLORS = {
  project: {
    primary: '#3b82f6',
    light: 'rgba(59, 130, 246, 0.3)',
    bg: 'rgba(59, 130, 246, 0.15)',
    icon: Rocket
  },
  thought: {
    primary: '#6366f1',
    light: 'rgba(99, 102, 241, 0.3)',
    bg: 'rgba(99, 102, 241, 0.15)',
    icon: Brain
  },
  article: {
    primary: '#10b981',
    light: 'rgba(16, 185, 129, 0.3)',
    bg: 'rgba(16, 185, 129, 0.15)',
    icon: BookOpen
  },
  suggestion: {
    primary: '#f59e0b',
    light: 'rgba(245, 158, 11, 0.3)',
    bg: 'rgba(245, 158, 11, 0.15)',
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

export function ConnectionsList({ itemType, itemId, onConnectionDeleted }: ConnectionsListProps) {
  const [connections, setConnections] = useState<ItemConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConnections()
  }, [itemType, itemId])

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

  if (connections.length === 0) {
    return (
      <div className="py-8 text-center">
        <LinkIcon className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
        <p className="text-neutral-600 text-sm">No connections yet</p>
        <p className="text-neutral-500 text-xs mt-1">Link this item to projects, thoughts, or articles</p>
      </div>
    )
  }

  return (
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
  )
}
