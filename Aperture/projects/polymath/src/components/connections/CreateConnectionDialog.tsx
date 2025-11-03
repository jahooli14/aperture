/**
 * CreateConnectionDialog Component
 * Manual linking interface - connect any item to any other item
 */

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { motion } from 'framer-motion'
import { Search, Link as LinkIcon, Brain, Rocket, BookOpen, Lightbulb, Loader2 } from 'lucide-react'
import type { ConnectionSourceType, Project, Memory, ReadingQueueItem, ProjectSuggestion } from '../../types'

interface CreateConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceType: ConnectionSourceType
  sourceId: string
  onConnectionCreated?: () => void
}

type SearchableItem = {
  id: string
  type: ConnectionSourceType
  title: string
  preview?: string
}

const SCHEMA_COLORS = {
  project: { primary: '#3b82f6', icon: Rocket },
  thought: { primary: '#6366f1', icon: Brain },
  article: { primary: '#10b981', icon: BookOpen },
  suggestion: { primary: '#f59e0b', icon: Lightbulb }
}

export function CreateConnectionDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  onConnectionCreated
}: CreateConnectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedType, setSelectedType] = useState<ConnectionSourceType | 'all'>('all')

  useEffect(() => {
    if (open) {
      fetchAllItems()
    } else {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open])

  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = searchResults.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setSearchResults(filtered)
    } else {
      fetchAllItems()
    }
  }, [searchQuery])

  const fetchAllItems = async () => {
    setLoading(true)
    try {
      // Fetch all searchable items in parallel
      const [projectsRes, thoughtsRes, articlesRes, suggestionsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/memories'),
        fetch('/api/reading'),
        fetch('/api/projects?resource=suggestions')
      ])

      const [projectsData, thoughtsData, articlesData, suggestionsData] = await Promise.all([
        projectsRes.json(),
        thoughtsRes.json(),
        articlesRes.json(),
        suggestionsRes.json()
      ])

      const items: SearchableItem[] = []

      // Add projects
      if (projectsData.projects) {
        items.push(...projectsData.projects.map((p: Project) => ({
          id: p.id,
          type: 'project' as const,
          title: p.title,
          preview: p.description || undefined
        })))
      }

      // Add thoughts
      if (thoughtsData.memories) {
        items.push(...thoughtsData.memories.map((m: Memory) => ({
          id: m.id,
          type: 'thought' as const,
          title: m.title,
          preview: m.body?.slice(0, 100)
        })))
      }

      // Add articles
      if (articlesData.articles) {
        items.push(...articlesData.articles.map((a: ReadingQueueItem) => ({
          id: a.id,
          type: 'article' as const,
          title: a.title || a.url,
          preview: a.excerpt
        })))
      }

      // Add suggestions
      if (suggestionsData.suggestions) {
        items.push(...suggestionsData.suggestions.map((s: ProjectSuggestion) => ({
          id: s.id,
          type: 'suggestion' as const,
          title: s.title,
          preview: s.description
        })))
      }

      // Filter out the source item itself
      const filtered = items.filter(item => !(item.type === sourceType && item.id === sourceId))

      setSearchResults(filtered)
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateConnection = async (targetType: ConnectionSourceType, targetId: string) => {
    setCreating(true)
    try {
      const response = await fetch('/api/connections?action=create-spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          source_id: sourceId,
          target_type: targetType,
          target_id: targetId,
          connection_type: 'manual',
          created_by: 'user'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create connection')
      }

      onConnectionCreated?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating connection:', error)
      alert('Failed to create connection. It may already exist.')
    } finally {
      setCreating(false)
    }
  }

  const filteredResults = selectedType === 'all'
    ? searchResults
    : searchResults.filter(item => item.type === selectedType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Create Connection
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search for an item to link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 focus:outline-none transition-colors premium-glass"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--premium-text-primary)',
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }}
            autoFocus
          />
        </div>

        {/* Type filters */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedType('all')}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: selectedType === 'all' ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.05)',
              color: selectedType === 'all' ? 'white' : 'var(--premium-text-secondary)'
            }}
          >
            All
          </button>
          {Object.entries(SCHEMA_COLORS).map(([type, config]) => {
            const Icon = config.icon
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type as ConnectionSourceType)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: isSelected ? config.primary : 'rgba(255, 255, 255, 0.05)',
                  color: isSelected ? 'white' : 'var(--premium-text-secondary)'
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </button>
            )
          })}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: 'var(--premium-blue)' }} />
              <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Loading items...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--premium-text-tertiary)', opacity: 0.3 }} />
              <p className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>No items found</p>
              <p className="text-sm mt-1" style={{ color: 'var(--premium-text-tertiary)' }}>Try a different search or filter</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filteredResults.map((item, index) => {
                const schema = SCHEMA_COLORS[item.type]
                const Icon = schema.icon

                return (
                  <motion.button
                    key={`${item.type}-${item.id}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleCreateConnection(item.type, item.id)}
                    disabled={creating}
                    className="w-full text-left p-4 rounded-xl border transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group premium-card"
                    style={{ borderColor: schema.primary + '30' }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: schema.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: schema.primary, opacity: 0.7 }}>
                          {item.type}
                        </div>
                        <div className="font-medium mb-1 line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
                          {item.title}
                        </div>
                        {item.preview && (
                          <div className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                            {item.preview}
                          </div>
                        )}
                      </div>
                      <LinkIcon className="h-4 w-4 flex-shrink-0 mt-1 transition-colors" style={{
                        color: 'var(--premium-text-tertiary)',
                        opacity: 0.5
                      }} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
