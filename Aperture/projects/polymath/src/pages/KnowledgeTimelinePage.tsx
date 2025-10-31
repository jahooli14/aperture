/**
 * Knowledge Timeline Page
 * Scrollable temporal visualization of thoughts, projects, and articles
 * Features: Entity parallelism, color-coding, dependency arrows, time-slice filtering
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Layers, FolderKanban, FileText, Filter, Calendar } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'

interface TimelineItem {
  id: string
  type: 'thought' | 'project' | 'article'
  title: string
  date: string // ISO timestamp
  status?: string
  color: string
  url?: string
  sourceReference?: { type: string; id: string }
}

interface Connection {
  fromId: string
  toId: string
  fromType: 'thought' | 'project' | 'article'
  toType: 'thought' | 'project' | 'article'
}

type Track = 'projects' | 'thoughts' | 'articles'

export function KnowledgeTimelinePage() {
  const navigate = useNavigate()

  const [items, setItems] = useState<TimelineItem[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTrack, setActiveTrack] = useState<Track | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d' | 'year'>('all')

  useEffect(() => {
    loadTimelineData()
  }, [])

  const loadTimelineData = async () => {
    setLoading(true)
    try {
      // Fetch all data sources in parallel
      const [projectsRes, thoughtsRes, articlesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/memories'),
        fetch('/api/reading')
      ])

      const [projectsData, thoughtsData, articlesData] = await Promise.all([
        projectsRes.json(),
        thoughtsRes.json(),
        articlesRes.json()
      ])

      const timelineItems: TimelineItem[] = []

      // Add projects (use last_active as date)
      if (projectsData.projects) {
        timelineItems.push(...projectsData.projects.map((p: any) => ({
          id: p.id,
          type: 'project' as const,
          title: p.title,
          date: p.last_active || p.created_at,
          status: p.status,
          color: getProjectColor(p.status)
        })))
      }

      // Add thoughts/memories (use created_at)
      if (thoughtsData.memories) {
        timelineItems.push(...thoughtsData.memories.map((m: any) => ({
          id: m.id,
          type: 'thought' as const,
          title: m.title || 'Untitled thought',
          date: m.created_at,
          color: '#6366f1', // Indigo for thoughts
          sourceReference: m.source_reference
        })))
      }

      // Add articles (use read_at if available, otherwise created_at)
      if (articlesData.articles) {
        timelineItems.push(...articlesData.articles
          .filter((a: any) => a.status === 'archived') // Only show read articles
          .map((a: any) => ({
            id: a.id,
            type: 'article' as const,
            title: a.title,
            date: a.read_at || a.archived_at || a.created_at,
            status: a.status,
            color: '#10b981', // Green for articles
            url: a.url
          })))
      }

      // Sort by date (newest first)
      timelineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      // Build connections graph from source_reference data
      const connectionMap: Connection[] = []
      timelineItems.forEach(item => {
        if (item.sourceReference) {
          const sourceItem = timelineItems.find(i => i.id === item.sourceReference!.id)
          if (sourceItem) {
            connectionMap.push({
              fromId: item.sourceReference.id,
              toId: item.id,
              fromType: item.sourceReference.type as any,
              toType: item.type
            })
          }
        }
      })

      setItems(timelineItems)
      setConnections(connectionMap)
    } catch (error) {
      console.error('[Timeline] Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProjectColor = (status: string): string => {
    const colors: Record<string, string> = {
      upcoming: '#f59e0b', // Amber
      active: '#3b82f6',   // Blue
      'on-hold': '#6b7280', // Gray
      maintaining: '#8b5cf6', // Purple
      completed: '#10b981', // Green
      archived: '#9ca3af'  // Light gray
    }
    return colors[status] || '#6b7280'
  }

  const filteredItems = items.filter(item => {
    // Filter by track
    if (activeTrack !== 'all' && item.type !== activeTrack.slice(0, -1)) {
      return false
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      const now = new Date()
      const itemDate = new Date(item.date)
      const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))

      switch (dateFilter) {
        case '7d':
          return diffDays <= 7
        case '30d':
          return diffDays <= 30
        case '90d':
          return diffDays <= 90
        case 'year':
          return diffDays <= 365
        default:
          return true
      }
    }

    return true
  })

  const groupByTrack = () => {
    return {
      projects: filteredItems.filter(i => i.type === 'project'),
      thoughts: filteredItems.filter(i => i.type === 'thought'),
      articles: filteredItems.filter(i => i.type === 'article')
    }
  }

  const tracks = groupByTrack()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-blue-900 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600">Loading timeline...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 pb-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-6 w-6 text-blue-900" />
              <h1 className="text-2xl font-bold text-neutral-900">Knowledge Timeline</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">{items.length} events</span>
            </div>
          </div>

          {/* Track Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'projects', 'thoughts', 'articles'] as const).map((track) => (
              <Button
                key={track}
                variant={activeTrack === track ? 'default' : 'outline'}
                onClick={() => setActiveTrack(track)}
                className="whitespace-nowrap text-sm"
                size="sm"
              >
                {track === 'all' && <Filter className="h-3 w-3 mr-1" />}
                {track === 'projects' && <FolderKanban className="h-3 w-3 mr-1" />}
                {track === 'thoughts' && <Layers className="h-3 w-3 mr-1" />}
                {track === 'articles' && <FileText className="h-3 w-3 mr-1" />}
                {track.charAt(0).toUpperCase() + track.slice(1)}
              </Button>
            ))}
          </div>

          {/* Date Range Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mt-2 pt-2 border-t border-neutral-200">
            <span className="text-xs text-neutral-600 flex items-center px-2">Time:</span>
            {([
              { key: 'all', label: 'All Time' },
              { key: '7d', label: 'Last 7 Days' },
              { key: '30d', label: 'Last 30 Days' },
              { key: '90d', label: 'Last 90 Days' },
              { key: 'year', label: 'Last Year' }
            ] as const).map(({ key, label }) => (
              <Button
                key={key}
                variant={dateFilter === key ? 'default' : 'outline'}
                onClick={() => setDateFilter(key)}
                className="whitespace-nowrap text-xs"
                size="sm"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Tracks */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-6">
          {/* Projects Track */}
          {(activeTrack === 'all' || activeTrack === 'projects') && tracks.projects.length > 0 && (
            <TimelineTrack
              title="Projects"
              icon={FolderKanban}
              items={tracks.projects}
              connections={connections}
              color="blue"
              onItemClick={(item) => navigate(`/projects/${item.id}`)}
            />
          )}

          {/* Thoughts Track */}
          {(activeTrack === 'all' || activeTrack === 'thoughts') && tracks.thoughts.length > 0 && (
            <TimelineTrack
              title="Thoughts"
              icon={Layers}
              items={tracks.thoughts}
              connections={connections}
              color="indigo"
              onItemClick={(item) => navigate('/memories')}
            />
          )}

          {/* Articles Track */}
          {(activeTrack === 'all' || activeTrack === 'articles') && tracks.articles.length > 0 && (
            <TimelineTrack
              title="Reading"
              icon={FileText}
              items={tracks.articles}
              connections={connections}
              color="green"
              onItemClick={(item) => item.url ? window.open(item.url, '_blank') : navigate(`/reading/${item.id}`)}
            />
          )}
        </div>

        {filteredItems.length === 0 && (
          <Card className="pro-card">
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-600">No events in timeline</p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  )
}

interface TimelineTrackProps {
  title: string
  icon: any
  items: TimelineItem[]
  connections: Connection[]
  color: string
  onItemClick: (item: TimelineItem) => void
}

function TimelineTrack({ title, icon: Icon, items, connections, color, onItemClick }: TimelineTrackProps) {
  // Find items that have connections (either as source or target)
  const getItemConnections = (itemId: string) => {
    const outgoing = connections.filter(c => c.fromId === itemId)
    const incoming = connections.filter(c => c.toId === itemId)
    return { outgoing, incoming }
  }
  return (
    <Card className="pro-card overflow-hidden">
      <CardContent className="p-0">
        {/* Track Header */}
        <div className="bg-blue-50 border-b border-blue-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-blue-700" />
            <h3 className="font-semibold text-blue-900">{title}</h3>
            <span className="text-xs text-neutral-500">({items.length})</span>
          </div>
        </div>

        {/* Timeline Items */}
        <div className="p-5">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200" />

            {/* Items */}
            <div className="space-y-4">
              {items.map((item) => {
                const { outgoing, incoming } = getItemConnections(item.id)
                const hasConnections = outgoing.length > 0 || incoming.length > 0

                return (
                  <div key={item.id} className="relative pl-10">
                    {/* Dot */}
                    <div
                      className="absolute left-0 top-2 h-6 w-6 rounded-full border-4 border-white shadow-sm"
                      style={{ backgroundColor: item.color }}
                    >
                      {/* Connection indicator badge */}
                      {hasConnections && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-500 border-2 border-white" />
                      )}
                    </div>

                    {/* Content */}
                    <button
                      onClick={() => onItemClick(item)}
                      className="text-left w-full group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-neutral-900 group-hover:text-blue-900 transition-colors line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-xs text-neutral-500 mt-1">
                            {formatDate(item.date)}
                            {item.status && ` • ${item.status}`}
                          </p>

                          {/* Connection summary */}
                          {hasConnections && (
                            <div className="mt-2 flex gap-2 text-xs">
                              {incoming.length > 0 && (
                                <span className="text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                                  ← {incoming.length} source{incoming.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {outgoing.length > 0 && (
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  → {outgoing.length} inspired
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
