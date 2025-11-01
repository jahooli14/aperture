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
        fetch('/api/suggestions')
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search for an item to link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl backdrop-blur-xl bg-white/80 border-2 border-neutral-200 focus:border-blue-400 focus:outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* Type filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedType === 'all'
                ? 'bg-blue-100 text-blue-900'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            All
          </button>
          {Object.entries(SCHEMA_COLORS).map(([type, config]) => {
            const Icon = config.icon
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type as ConnectionSourceType)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                  selectedType === type
                    ? 'text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
                style={selectedType === type ? { backgroundColor: config.primary } : {}}
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
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-neutral-600">Loading items...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center">
              <Search className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-600 font-medium">No items found</p>
              <p className="text-sm text-neutral-500 mt-1">Try a different search or filter</p>
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
                    className="w-full text-left p-3 rounded-xl backdrop-blur-xl bg-white/80 border-2 hover:border-opacity-100 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group"
                    style={{ borderColor: schema.primary + '40' }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: schema.primary }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                          {item.type}
                        </div>
                        <div className="font-medium text-neutral-900 mb-1 line-clamp-1">
                          {item.title}
                        </div>
                        {item.preview && (
                          <div className="text-sm text-neutral-600 line-clamp-2">
                            {item.preview}
                          </div>
                        )}
                      </div>
                      <LinkIcon className="h-4 w-4 text-neutral-400 group-hover:text-blue-600 transition-colors flex-shrink-0 mt-1" />
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
