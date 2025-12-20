/**
 * ConnectionsList Component
 * Displays up to 5 most relevant connections/suggestions
 * "Connections from a project - they should be auto populated, you cannot delete, should be max 5 connections (most relevant)"
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, ArrowLeft, Link as LinkIcon, Brain, Layers, BookOpen, Lightbulb, Plus, Check } from 'lucide-react'
import type { ItemConnection, ConnectionSourceType } from '../../types'
import { CreateConnectionDialog } from './CreateConnectionDialog'
import { useConnectionStore } from '../../stores/useConnectionStore'
import { ConnectionSuggestion } from '../ConnectionSuggestion'

interface ConnectionsListProps {
  itemType: ConnectionSourceType
  itemId: string
  content?: string // For AI suggestions
  onConnectionDeleted?: () => void
  onConnectionCreated?: () => void
}

interface DisplayItem {
  id: string
  type: string // 'project' | 'thought' | 'article'
  title: string
  reasoning?: string
  similarity?: number
  isPersisted: boolean
  connectionId?: string
  connectionType?: string
  direction?: 'inbound' | 'outbound'
  createdBy?: 'user' | 'ai'
  createdAt?: string
}

const SCHEMA_COLORS = {
  project: {
    primary: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.1)',
    icon: Layers
  },
  thought: {
    primary: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.1)',
    icon: Brain
  },
  article: {
    primary: '#10b981',
    bg: 'rgba(16, 185, 129, 0.1)',
    icon: BookOpen
  },
  suggestion: {
    primary: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.1)',
    icon: Lightbulb
  }
}

export function ConnectionsList({ itemType, itemId, content, onConnectionDeleted, onConnectionCreated }: ConnectionsListProps) {
  const { getConnections, setConnections: cacheConnections, invalidateConnections } = useConnectionStore()
  const [connections, setConnections] = useState<ItemConnection[]>([])
  const [suggestions, setSuggestions] = useState<DisplayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadData()
  }, [itemType, itemId, content])

  const loadData = async () => {
    setLoading(true)

    // 1. Fetch Persisted Connections
    try {
      // Check cache first
      let fetchedConnections = getConnections(itemType, itemId)

      if (!fetchedConnections) {
        const response = await fetch(`/api/connections?action=list-sparks&id=${itemId}&type=${itemType}`)
        if (response.ok) {
          const data = await response.json()
          fetchedConnections = data.connections || []
          cacheConnections(itemType, itemId, fetchedConnections!)
        }
      }

      if (fetchedConnections) {
        setConnections(fetchedConnections)
      }

      // 2. Fetch AI Suggestions (if needed to fill slots)
      // Always fetch to ensure we have the best candidates
      if (content) {
        const response = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: itemType,
            sourceId: itemId,
            content,
            userId: 'default'
          })
        })

        if (response.ok) {
          const data = await response.json()
          // Map to DisplayItem
          const mappedSuggestions = (data.candidates || []).map((c: any) => ({
            id: c.id,
            type: c.type,
            title: c.title,
            similarity: c.similarity,
            reasoning: `${Math.round(c.similarity * 100)}% Match`,
            isPersisted: false
          }))
          setSuggestions(mappedSuggestions)
        }
      }

    } catch (err) {
      console.error('Error loading connections data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Merge and Limit to 5
  // Priority: Persisted > High Confidence Suggestions
  const displayItems = useMemo(() => {
    const items: DisplayItem[] = []
    const includedIds = new Set<string>()

    // 1. Add Persisted Connections
    connections.forEach(conn => {
      items.push({
        id: conn.related_id,
        type: conn.related_type,
        title: getItemTitle(conn),
        reasoning: conn.ai_reasoning || (conn.created_by === 'ai' ? 'AI Connected' : undefined),
        isPersisted: true,
        connectionId: conn.connection_id,
        connectionType: conn.connection_type,
        direction: conn.direction,
        createdBy: conn.created_by as 'user' | 'ai',
        createdAt: conn.created_at
      })
      includedIds.add(conn.related_id)
    })

    // 2. Add Suggestions until we hit 5
    for (const sugg of suggestions) {
      if (items.length >= 5) break
      if (!includedIds.has(sugg.id)) {
        items.push(sugg)
        includedIds.add(sugg.id)
      }
    }

    // Sort: Manual Persisted First, then by "relevance" (AI persisted or suggestion)
    // Actually, keep persisted at top is usually safer UX so things don't jump around too much,
    // but user wants "most relevant".
    // For now, let's just stick to the order: Persisted connections first, then suggestions.
    // Ideally we'd sort persisted ones by date or relevance too.

    return items.slice(0, 5)
  }, [connections, suggestions])

  const handleManualConnectionCreated = async () => {
    // Called after a new manual connection is created
    // We need to check if we exceeded 5 persisted connections and remove the weakest one if so.

    // Refresh connections first
    invalidateConnections(itemType, itemId)

    // Fetch fresh
    const response = await fetch(`/api/connections?action=list-sparks&id=${itemId}&type=${itemType}`)
    if (!response.ok) {
      loadData()
      return
    }
    const data = await response.json()
    const freshConnections: ItemConnection[] = data.connections || []

    // If we have > 5 persisted connections, we need to prune.
    // Strategy: Keep all Manual connections if possible. 
    // Remove oldest AI connection.
    // If all are Manual and > 5 (rare/impossible if UI prevents), remove oldest Manual?
    // User said "overrides one of the links". 

    if (freshConnections.length > 5) {
      // Sort to find candidate to delete
      // Priority to Keep: Manual > AI
      // Secondary Priority: Newest > Oldest

      const sorted = [...freshConnections].sort((a, b) => {
        // 0. Manual wins over AI
        const aManual = a.created_by === 'user' ? 1 : 0
        const bManual = b.created_by === 'user' ? 1 : 0
        if (aManual !== bManual) return bManual - aManual // Descending (User first)

        // 1. Newest first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // The items to keep are the first 5
      const toKeep = new Set(sorted.slice(0, 5).map(c => c.connection_id))
      const toDelete = freshConnections.filter(c => !toKeep.has(c.connection_id))

      // Execute deletions
      for (const conn of toDelete) {
        console.log('Pruning extra connection:', conn.connection_id)
        await fetch(`/api/connections?action=delete-spark&connection_id=${conn.connection_id}`, {
          method: 'DELETE'
        })
      }

      invalidateConnections(itemType, itemId)
    }

    loadData()
    onConnectionCreated?.()
  }

  if (loading && displayItems.length === 0) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* AI Suggestions */}
      <div className="mb-2">
        <h3 className="text-xs font-medium mb-3 flex items-center gap-2 uppercase tracking-wider opacity-60" style={{ color: 'var(--premium-text-secondary)' }}>
          <Sparkles className="h-3 w-3 text-purple-400" />
          Smart Suggestions
        </h3>
        <ConnectionSuggestion
          suggestions={suggestions.map(s => ({
            targetId: s.id,
            targetType: s.type as any,
            targetTitle: s.title,
            reason: s.reasoning || '',
            confidence: s.similarity || 0
          }))}
          sourceId={itemId}
          sourceType={itemType === 'thought' ? 'memory' : itemType as any}
          onLinkCreated={() => {
            invalidateConnections(itemType, itemId)
            loadData()
          }}
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {displayItems.map((item, index) => {
          const schema = SCHEMA_COLORS[item.type as keyof typeof SCHEMA_COLORS] || SCHEMA_COLORS.project
          const Icon = schema.icon
          const isPersisted = item.isPersisted
          const isAI = !isPersisted || item.createdBy === 'ai'

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={getItemUrl(item.type, item.id)}
                className="group relative overflow-hidden rounded-xl border border-white/5 bg-white/5 p-4 block transition-all hover:bg-white/10 hover:border-white/10 premium-glass-subtle"
                style={{
                  backgroundColor: isAI ? undefined : 'rgba(255, 255, 255, 0.08)' // Subtle distinction for manual?
                }}
              >
                {/* Visual indicator for AI vs Manual if needed, but "You cannot delete" implies uniform look */}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1 p-1.5 rounded-lg" style={{ backgroundColor: schema.bg }}>
                    <Icon className="h-4 w-4" style={{ color: schema.primary }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: 'var(--premium-text-secondary)' }}>
                        {item.type}
                      </span>
                      {isAI && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-medium">
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto
                        </div>
                      )}
                    </div>

                    <h4 className="text-sm font-medium mb-1 line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
                      {item.title}
                    </h4>

                    {item.reasoning && (
                      <p className="text-xs line-clamp-1 opacity-70" style={{ color: 'var(--premium-text-secondary)' }}>
                        {item.reasoning}
                      </p>
                    )}
                  </div>

                  {/* Arrow Indicator */}
                  <div className="self-center opacity-0 group-hover:opacity-50 transition-opacity">
                    <ArrowRight className="h-4 w-4 text-white" />
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}

        {/* Empty Slots Fillers (Optional - if we want to show 5 empty slots? No, "auto filled" means we supply content) */}
      </div>

      {/* Manual Override Button */}
      {/* "just a simple 'or add a link yourself button'" */}
      <div className="pt-2">
        <button
          onClick={() => setShowCreateDialog(true)}
          className="w-full py-3 rounded-xl border border-dashed border-white/10 flex items-center justify-center gap-2 text-xs font-medium transition-all hover:bg-white/5 hover:border-white/20 group"
          style={{ color: 'var(--premium-text-secondary)' }}
        >
          <Plus className="h-4 w-4 group-hover:text-blue-400 transition-colors" />
          <span className="group-hover:text-white transition-colors">
            {displayItems.length >= 5 ? 'Override with Manual Link' : 'Add Link Yourself'}
          </span>
        </button>
      </div>

      <CreateConnectionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        sourceType={itemType}
        sourceId={itemId}
        sourceContent={content}
        onConnectionCreated={handleManualConnectionCreated}
      />
    </div>
  )
}

// Helpers
function getItemTitle(connection: ItemConnection): string {
  const item = connection.related_item
  if (!item) return 'Unknown item'
  if ('title' in item && typeof item.title === 'string' && item.title) return item.title
  if ('body' in item && typeof item.body === 'string' && item.body) {
    return item.body.slice(0, 60) + (item.body.length > 60 ? '...' : '')
  }
  return 'Untitled'
}

function getItemUrl(type: string, id: string): string {
  switch (type) {
    case 'project': return `/projects/${id}`
    case 'thought':
    case 'memory': return `/memories?highlight=${id}` // Handle mapping 'thought' -> 'memory'
    case 'article': return `/reading?highlight=${id}`
    default: return '#'
  }
}
