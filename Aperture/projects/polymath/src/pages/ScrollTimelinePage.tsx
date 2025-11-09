/**
 * Scroll-Driven Meta-Timeline
 * Phase III: Frontier Visualization
 *
 * Features:
 * - Scroll Progress Timelines API for synchronized animations
 * - SchemaLine color-coding (Projects=blue, Thoughts=indigo, Articles=green)
 * - Animated connection lines revealing on scroll
 * - Sticky year markers with parallax effects
 * - DfF-inspired depth hierarchy with glassmorphism
 */

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, useMotionValue, animate } from 'framer-motion'
import { Layers, FolderKanban, FileText, Sparkles, GitBranch, ZoomIn, ZoomOut, Search, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { haptic } from '../utils/haptics'

interface TimelineEvent {
  id: string
  type: 'thought' | 'project' | 'article'
  title: string
  date: string
  year: number
  month: number
  status?: string
  url?: string
  sourceReference?: { type: string; id: string }
}

interface MonthSection {
  year: number
  month: number
  monthLabel: string
  events: TimelineEvent[]
  connections: Array<{ from: string; to: string }>
}

// SchemaLine color-coding constants
const SCHEMA_COLORS = {
  project: {
    primary: '#3b82f6',    // blue-500
    light: '#60a5fa',      // blue-400
    glow: 'rgba(59, 130, 246, 0.3)'
  },
  thought: {
    primary: '#6366f1',    // indigo-500
    light: '#818cf8',      // indigo-400
    glow: 'rgba(99, 102, 241, 0.3)'
  },
  article: {
    primary: '#10b981',    // green-500
    light: '#34d399',      // green-400
    glow: 'rgba(16, 185, 129, 0.3)'
  }
} as const

export function ScrollTimelinePage() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })

  // Memoize scroll transforms to prevent re-render loops
  const progressBarWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  const [monthSections, setMonthSections] = useState<MonthSection[]>([])
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([]) // NEW: Store all events for thread filtering
  const [threadFilter, setThreadFilter] = useState<{type: string, id: string} | null>(null) // NEW: Thread view filter
  const [searchQuery, setSearchQuery] = useState('')  // NEW: Search filter
  const [loading, setLoading] = useState(true)

  // Timeline scrubbing and zoom state
  const [zoomLevel, setZoomLevel] = useState<'day' | 'month' | 'year'>('month')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  const scrubPosition = useMotionValue(0) // 0 to 1, represents position in timeline

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

      // Transform to timeline events
      const events: TimelineEvent[] = []

      // Add projects
      if (projectsData.projects) {
        projectsData.projects.forEach((p: any) => {
          const date = new Date(p.last_active || p.created_at)
          events.push({
            id: p.id,
            type: 'project',
            title: p.title,
            date: date.toISOString(),
            year: date.getFullYear(),
            month: date.getMonth(),
            status: p.status
          })
        })
      }

      // Add thoughts (use created_at since Memory interface doesn't have updated_at)
      if (thoughtsData.memories) {
        thoughtsData.memories.forEach((m: any) => {
          const date = new Date(m.created_at)
          events.push({
            id: m.id,
            type: 'thought',
            title: m.title || 'Untitled thought',
            date: date.toISOString(),
            year: date.getFullYear(),
            month: date.getMonth(),
            sourceReference: m.source_reference
          })
        })
      }

      // Add articles
      if (articlesData.articles) {
        articlesData.articles
          .filter((a: any) => a.status === 'archived' || a.status === 'reading')
          .forEach((a: any) => {
            const date = new Date(a.read_at || a.archived_at || a.created_at)
            events.push({
              id: a.id,
              type: 'article',
              title: a.title,
              date: date.toISOString(),
              year: date.getFullYear(),
              month: date.getMonth(),
              url: a.url
            })
          })
      }

      // Sort by date (oldest first for scroll timeline)
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setAllEvents(events) // NEW: Store all events

      // Calculate date range for scrubber
      if (events.length > 0) {
        const startDate = new Date(events[0].date)
        const endDate = new Date(events[events.length - 1].date)
        setDateRange({ start: startDate, end: endDate })
      }

      // Group by month
      const monthMap = new Map<string, TimelineEvent[]>()
      events.forEach(event => {
        const monthKey = `${event.year}-${event.month.toString().padStart(2, '0')}`
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, [])
        }
        monthMap.get(monthKey)!.push(event)
      })

      // Build month sections with connections
      const sections: MonthSection[] = Array.from(monthMap.entries())
        .map(([monthKey, monthEvents]) => {
          const connections: Array<{ from: string; to: string }> = []

          // Find connections within this month
          monthEvents.forEach(event => {
            if (event.sourceReference) {
              const sourceEvent = events.find(e => e.id === event.sourceReference!.id)
              if (sourceEvent) {
                connections.push({
                  from: sourceEvent.id,
                  to: event.id
                })
              }
            }
          })

          // Safety check: ensure monthEvents has at least one element
          const firstEvent = monthEvents[0];
          if (!firstEvent) {
            throw new Error('monthEvents array is unexpectedly empty');
          }

          const year = firstEvent.year
          const month = firstEvent.month
          const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          })

          return { year, month, monthLabel, events: monthEvents, connections }
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

      setMonthSections(sections)
    } catch (error) {
      console.error('[ScrollTimeline] Failed to load:', error)
    } finally {
      setLoading(false)
    }
  }

  // NEW: Filter events by search query
  const filterEventsBySearch = useCallback((query: string) => {
    if (!query.trim()) {
      // No search - reload all data
      loadTimelineData()
      return
    }

    const lowerQuery = query.toLowerCase()
    const filteredEvents = allEvents.filter(event =>
      event.title.toLowerCase().includes(lowerQuery) ||
      event.type.toLowerCase().includes(lowerQuery)
    )

    // Rebuild month sections with filtered events
    const monthMap = new Map<string, TimelineEvent[]>()
    filteredEvents.forEach(event => {
      const monthKey = `${event.year}-${event.month.toString().padStart(2, '0')}`
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, [])
      }
      monthMap.get(monthKey)!.push(event)
    })

    const sections: MonthSection[] = Array.from(monthMap.entries())
      .map(([monthKey, monthEvents]) => {
        const year = monthEvents[0].year
        const month = monthEvents[0].month
        const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        })
        return { year, month, monthLabel, events: monthEvents, connections: [] }
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

    setMonthSections(sections)
  }, [allEvents])

  // Apply search filter when query changes
  useEffect(() => {
    if (threadFilter) return // Don't search when viewing thread
    filterEventsBySearch(searchQuery)
  }, [searchQuery, filterEventsBySearch, threadFilter])

  // NEW: Fetch thread for a given item
  const loadThread = async (itemType: string, itemId: string) => {
    try {
      const response = await fetch(`/api/connections?action=thread&id=${itemId}&type=${itemType}`)
      if (!response.ok) throw new Error('Failed to fetch thread')

      const data = await response.json()
      const threadItemIds = new Set(data.items.map((item: any) => item.item_id))

      // Filter events to only show items in the thread
      const threadEvents = allEvents.filter(event => threadItemIds.has(event.id))

      // Rebuild month sections with filtered events
      const monthMap = new Map<string, TimelineEvent[]>()
      threadEvents.forEach(event => {
        const monthKey = `${event.year}-${event.month.toString().padStart(2, '0')}`
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, [])
        }
        monthMap.get(monthKey)!.push(event)
      })

      const sections: MonthSection[] = Array.from(monthMap.entries())
        .map(([monthKey, monthEvents]) => {
          const year = monthEvents[0].year
          const month = monthEvents[0].month
          const monthLabel = new Date(year, month).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          })
          return { year, month, monthLabel, events: monthEvents, connections: [] }
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

      setMonthSections(sections)
      setThreadFilter({ type: itemType, id: itemId })
    } catch (error) {
      console.error('[ScrollTimeline] Failed to load thread:', error)
    }
  }

  // NEW: Clear thread filter
  const clearThreadFilter = () => {
    setThreadFilter(null)
    loadTimelineData() // Reload all data
  }

  // Scrubbing: Jump to a specific position in the timeline
  const handleScrub = useCallback((position: number) => {
    // position is 0 to 1
    scrubPosition.set(position)

    // Calculate target scroll position
    if (containerRef.current) {
      const scrollHeight = containerRef.current.scrollHeight - containerRef.current.clientHeight
      const targetScroll = scrollHeight * position

      // Smooth scroll to position
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      })

      haptic.light()
    }
  }, [scrubPosition])

  // Zoom in: Change to more detailed view
  const handleZoomIn = useCallback(() => {
    if (zoomLevel === 'year') {
      setZoomLevel('month')
      haptic.light()
    } else if (zoomLevel === 'month') {
      setZoomLevel('day')
      haptic.light()
    }
  }, [zoomLevel])

  // Zoom out: Change to less detailed view
  const handleZoomOut = useCallback(() => {
    if (zoomLevel === 'day') {
      setZoomLevel('month')
      haptic.light()
    } else if (zoomLevel === 'month') {
      setZoomLevel('year')
      haptic.light()
    }
  }, [zoomLevel])

  // Pinch-to-zoom detection
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let lastDistance = 0

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()

        const touch1 = e.touches[0]
        const touch2 = e.touches[1]

        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        )

        if (lastDistance > 0) {
          const delta = distance - lastDistance

          // Pinch out = zoom in
          if (delta > 10) {
            handleZoomIn()
            lastDistance = 0 // Reset to prevent rapid firing
          }
          // Pinch in = zoom out
          else if (delta < -10) {
            handleZoomOut()
            lastDistance = 0 // Reset to prevent rapid firing
          }
        }

        lastDistance = distance
      }
    }

    const handleTouchEnd = () => {
      lastDistance = 0
    }

    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleZoomIn, handleZoomOut])

  const getSchemaColor = (type: TimelineEvent['type']) => {
    return SCHEMA_COLORS[type]
  }

  const getIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'project': return FolderKanban
      case 'thought': return Layers
      case 'article': return FileText
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Sparkles className="h-12 w-12 mx-auto mb-4 animate-pulse" style={{ color: 'var(--premium-blue)' }} />
          <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Loading timeline...</p>
        </motion.div>
      </div>
    )
  }

  if (monthSections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="premium-card border-2 p-16 text-center" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <Sparkles className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>No Timeline Data Yet</h2>
          <p style={{ color: 'var(--premium-text-secondary)' }}>Start capturing thoughts, reading articles, and building projects.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 premium-glass-strong border-b shadow-lg" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Thread Filter Banner */}
          {threadFilter && (
            <div className="mb-4 p-4 rounded-xl border-2 flex items-center justify-between" style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderColor: 'rgba(245, 158, 11, 0.3)'
            }}>
              <div className="flex items-center gap-3">
                <GitBranch className="h-5 w-5" style={{ color: 'var(--premium-amber)' }} />
                <div>
                  <div className="font-bold" style={{ color: 'var(--premium-text-primary)' }}>Viewing Thread</div>
                  <div className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                    Showing items connected to this {threadFilter.type}
                  </div>
                </div>
              </div>
              <button
                onClick={clearThreadFilter}
                className="px-4 py-2 rounded-lg border-2 font-medium transition-colors premium-card"
                style={{ borderColor: 'rgba(255, 255, 255, 0.2)', color: 'var(--premium-text-primary)' }}
              >
                Show All
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                Knowledge Timeline
              </h1>
              <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                {threadFilter ? 'Viewing connected items only' : 'Scroll to explore your knowledge evolution'}
              </p>
            </div>

            {/* Schema Legend */}
            <div className="hidden md:flex gap-4">
              {(['project', 'thought', 'article'] as const).map(type => {
                const Icon = getIcon(type)
                const colors = getSchemaColor(type)
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 px-4 py-2 rounded-full premium-glass border shadow-md"
                    style={{ borderColor: `${colors.primary}50` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <Icon className="h-4 w-4" style={{ color: colors.primary }} />
                    <span className="text-xs font-medium capitalize" style={{ color: colors.primary }}>
                      {type}s
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Scroll Progress Bar */}
          <motion.div
            className="absolute bottom-0 left-0 h-1"
            style={{
              width: progressBarWidth,
              background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo), var(--premium-emerald))'
            }}
          />
        </div>
      </div>

      {/* Timeline Scrubber */}
      {dateRange && (
        <TimelineScrubber
          dateRange={dateRange}
          zoomLevel={zoomLevel}
          onScrub={handleScrub}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          canZoomIn={zoomLevel !== 'day'}
          canZoomOut={zoomLevel !== 'year'}
        />
      )}

      {/* Timeline Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {monthSections.map((section, sectionIndex) => (
          <MonthSection
            key={`${section.year}-${section.month}`}
            section={section}
            sectionIndex={sectionIndex}
            totalSections={monthSections.length}
            scrollProgress={scrollYProgress}
            onViewThread={loadThread} // NEW: Pass thread viewer function
            onEventClick={(event) => {
              if (event.type === 'project') {
                navigate(`/projects/${event.id}`)
              } else if (event.type === 'thought') {
                navigate('/memories')
              } else if (event.url) {
                window.open(event.url, '_blank')
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface MonthSectionProps {
  section: MonthSection
  sectionIndex: number
  totalSections: number
  scrollProgress: any
  onViewThread: (itemType: string, itemId: string) => void // NEW
  onEventClick: (event: TimelineEvent) => void
}

function MonthSection({ section, sectionIndex, totalSections, scrollProgress, onViewThread, onEventClick }: MonthSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)

  // Calculate scroll-based parallax for month marker
  const sectionStart = useMemo(() => sectionIndex / totalSections, [sectionIndex, totalSections])
  const sectionEnd = useMemo(() => (sectionIndex + 1) / totalSections, [sectionIndex, totalSections])

  const monthOpacity = useTransform(
    scrollProgress,
    [sectionStart - 0.1, sectionStart, sectionEnd, sectionEnd + 0.1],
    [0, 1, 1, 0]
  )

  const monthY = useTransform(
    scrollProgress,
    [sectionStart, sectionEnd],
    [20, -20]
  )

  return (
    <div ref={sectionRef} className="relative mb-24">
      {/* Sticky Month Marker with Parallax */}
      <motion.div
        className="sticky top-24 z-30 mb-12"
        style={{ opacity: monthOpacity, y: monthY }}
      >
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl premium-glass border-2 shadow-xl" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <div className="text-3xl font-bold" style={{
            background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-indigo))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {section.monthLabel}
          </div>
          <div className="text-sm font-medium" style={{ color: 'var(--premium-text-secondary)' }}>
            {section.events.length} event{section.events.length !== 1 ? 's' : ''}
          </div>
        </div>
      </motion.div>

      {/* Events Grid with Staggered Animation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {section.events.map((event, eventIndex) => (
          <TimelineEventCard
            key={event.id}
            event={event}
            eventIndex={eventIndex}
            sectionIndex={sectionIndex}
            totalSections={totalSections}
            scrollProgress={scrollProgress}
            onViewThread={() => onViewThread(event.type, event.id)} // NEW
            onClick={() => onEventClick(event)}
          />
        ))}
      </div>

      {/* Connection Lines (SVG Overlay) */}
      {section.connections.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          style={{ width: '100%', height: '100%', zIndex: 5 }}
        >
          {section.connections.map((conn, idx) => (
            <ConnectionLine
              key={`${conn.from}-${conn.to}`}
              fromId={conn.from}
              toId={conn.to}
              index={idx}
              scrollProgress={scrollProgress}
              sectionStart={sectionStart}
              events={section.events}
            />
          ))}
        </svg>
      )}
    </div>
  )
}

interface TimelineEventCardProps {
  event: TimelineEvent
  eventIndex: number
  sectionIndex: number
  totalSections: number
  scrollProgress: any
  onViewThread: () => void // NEW
  onClick: () => void
}

function TimelineEventCard({ event, eventIndex, sectionIndex, totalSections, scrollProgress, onViewThread, onClick }: TimelineEventCardProps) {
  const getIconForType = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'project': return FolderKanban
      case 'thought': return Layers
      case 'article': return FileText
    }
  }

  const colors = SCHEMA_COLORS[event.type]
  const Icon = getIconForType(event.type)

  // Scroll-triggered reveal animation
  const sectionStart = useMemo(() => sectionIndex / totalSections, [sectionIndex, totalSections])
  const cardDelay = useMemo(() => eventIndex * 0.02, [eventIndex])

  const cardOpacity = useTransform(
    scrollProgress,
    [sectionStart - 0.05 + cardDelay, sectionStart + 0.05 + cardDelay],
    [0, 1]
  )

  const cardY = useTransform(
    scrollProgress,
    [sectionStart - 0.05 + cardDelay, sectionStart + 0.05 + cardDelay],
    [40, 0]
  )

  return (
    <motion.button
      onClick={onClick}
      className="group relative text-left w-full"
      style={{ opacity: cardOpacity, y: cardY }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glassmorphism Card */}
      <div className="premium-card border-2 transition-all duration-300 p-6"
        style={{
          borderColor: `${colors.primary}50`
        }}
      >
        {/* Content */}
        <div>
          <div className="flex items-start gap-3 mb-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              <Icon className="h-5 w-5" style={{ color: colors.primary }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-1 capitalize" style={{ color: colors.primary }}>
                {event.type}
              </div>
              <h3 className="font-semibold line-clamp-2" style={{ color: 'var(--premium-text-primary)' }}>
                {event.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
            <span>
              {new Date(event.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
            {event.status && (
              <span className="px-2 py-0.5 rounded-full font-medium" style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'var(--premium-text-secondary)'
              }}>
                {event.status}
              </span>
            )}
          </div>

          {/* View Thread Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewThread()
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all premium-glass-subtle hover:bg-white/10"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.2)',
              color: 'var(--premium-text-secondary)'
            }}
          >
            <GitBranch className="h-3.5 w-3.5" />
            View Thread
          </button>
        </div>

        {/* Accent Line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-2"
          style={{
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.light})`
          }}
        />
      </div>
    </motion.button>
  )
}

interface ConnectionLineProps {
  fromId: string
  toId: string
  index: number
  scrollProgress: any
  sectionStart: number
  events: TimelineEvent[]
}

function ConnectionLine({ fromId, toId, index, scrollProgress, sectionStart, events }: ConnectionLineProps) {
  const lineRef = useRef<SVGPathElement>(null)

  // Animate line drawing on scroll
  const lineProgress = useTransform(
    scrollProgress,
    [sectionStart, sectionStart + 0.2],
    [0, 1]
  )

  useEffect(() => {
    const unsubscribe = lineProgress.on('change', (latest) => {
      if (lineRef.current) {
        const length = lineRef.current.getTotalLength()
        lineRef.current.style.strokeDasharray = `${length}`
        lineRef.current.style.strokeDashoffset = `${length * (1 - latest)}`
      }
    })
    return () => unsubscribe()
  }, [lineProgress])

  // Find the event types to determine color
  const fromEvent = events.find(e => e.id === fromId)
  const toEvent = events.find(e => e.id === toId)

  if (!fromEvent || !toEvent) return null

  // Use source event color for the connection
  const colors = SCHEMA_COLORS[fromEvent.type]

  // Calculate positions (simplified - in a real implementation would use refs to get actual DOM positions)
  const fromIndex = events.findIndex(e => e.id === fromId)
  const toIndex = events.findIndex(e => e.id === toId)

  // Simple grid-based positioning (3 columns)
  const cols = 3
  const fromCol = fromIndex % cols
  const fromRow = Math.floor(fromIndex / cols)
  const toCol = toIndex % cols
  const toRow = Math.floor(toIndex / cols)

  // Card dimensions (approximate)
  const cardWidth = 300
  const cardHeight = 200
  const gap = 24

  const x1 = fromCol * (cardWidth + gap) + cardWidth / 2
  const y1 = fromRow * (cardHeight + gap) + cardHeight
  const x2 = toCol * (cardWidth + gap) + cardWidth / 2
  const y2 = toRow * (cardHeight + gap)

  // Create bezier curve path
  const controlY = (y1 + y2) / 2
  const path = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`

  return (
    <motion.path
      ref={lineRef}
      d={path}
      stroke={colors.primary}
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      opacity={0.6}
      initial={{ pathLength: 0 }}
      style={{
        filter: `drop-shadow(0 0 8px ${colors.glow})`,
        strokeDasharray: 0,
        strokeDashoffset: 0
      }}
    />
  )
}

// ============================================================================
// TIMELINE SCRUBBER COMPONENT
// ============================================================================

interface TimelineScrubberProps {
  dateRange: { start: Date; end: Date }
  zoomLevel: 'day' | 'month' | 'year'
  onScrub: (position: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  canZoomIn: boolean
  canZoomOut: boolean
}

function TimelineScrubber({
  dateRange,
  zoomLevel,
  onScrub,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut
}: TimelineScrubberProps) {
  const scrubberRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(0)

  // Generate timeline markers based on zoom level
  const markers = useMemo(() => {
    const { start, end } = dateRange
    const markers: { label: string; position: number }[] = []

    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (zoomLevel === 'year') {
      // Show years
      const startYear = start.getFullYear()
      const endYear = end.getFullYear()

      for (let year = startYear; year <= endYear; year++) {
        const yearStart = new Date(year, 0, 1)
        const daysSinceStart = Math.floor((yearStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        const position = daysSinceStart / totalDays

        if (position >= 0 && position <= 1) {
          markers.push({
            label: year.toString(),
            position
          })
        }
      }
    } else if (zoomLevel === 'month') {
      // Show months
      let current = new Date(start)
      while (current <= end) {
        const daysSinceStart = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        const position = daysSinceStart / totalDays

        markers.push({
          label: current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          position
        })

        current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
      }
    } else {
      // Show days (limit to 30 markers max)
      const step = Math.max(1, Math.floor(totalDays / 30))

      for (let i = 0; i <= totalDays; i += step) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)

        const position = i / totalDays

        markers.push({
          label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          position
        })
      }
    }

    return markers
  }, [dateRange, zoomLevel])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    handlePointerMove(e)
  }

  const handlePointerMove = (e: React.PointerEvent | PointerEvent) => {
    if (!isDragging && e.type !== 'pointerdown') return
    if (!scrubberRef.current) return

    const rect = scrubberRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const position = Math.max(0, Math.min(1, x / rect.width))

    setCurrentPosition(position)
    onScrub(position)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: PointerEvent) => handlePointerMove(e)
    const handleUp = () => handlePointerUp()

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDragging])

  // Format current date based on position
  const getCurrentDate = () => {
    const { start, end } = dateRange
    const totalMs = end.getTime() - start.getTime()
    const currentMs = start.getTime() + (totalMs * currentPosition)
    const date = new Date(currentMs)

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="sticky top-32 z-30 max-w-7xl mx-auto px-4 sm:px-6 mb-6">
      <div className="premium-card border-2 p-4" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
        {/* Header with zoom controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--premium-text-secondary)' }}>
              Timeline Scrubber
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              color: 'var(--premium-blue)'
            }}>
              {zoomLevel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onZoomOut}
              disabled={!canZoomOut}
              className="p-2 rounded-lg transition-colors disabled:opacity-30"
              style={{
                backgroundColor: canZoomOut ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: 'var(--premium-blue)'
              }}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={onZoomIn}
              disabled={!canZoomIn}
              className="p-2 rounded-lg transition-colors disabled:opacity-30"
              style={{
                backgroundColor: canZoomIn ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: 'var(--premium-blue)'
              }}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrubber track */}
        <div
          ref={scrubberRef}
          className="relative h-16 rounded-lg cursor-pointer touch-none select-none"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          onPointerDown={handlePointerDown}
        >
          {/* Timeline markers */}
          {markers.map((marker, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: `${marker.position * 100}%` }}
            >
              <div
                className="w-0.5 h-3 rounded-full"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
              />
              <span
                className="text-xs mt-1"
                style={{ color: 'var(--premium-text-tertiary)' }}
              >
                {marker.label}
              </span>
            </div>
          ))}

          {/* Current position indicator */}
          <motion.div
            className="absolute top-0 bottom-0 w-1 rounded-full pointer-events-none"
            style={{
              left: `${currentPosition * 100}%`,
              backgroundColor: 'var(--premium-blue)',
              boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)'
            }}
            initial={false}
            animate={{ scale: isDragging ? 1.2 : 1 }}
          >
            {/* Current date tooltip */}
            {isDragging && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg whitespace-nowrap premium-glass border shadow-lg"
                style={{ borderColor: 'rgba(59, 130, 246, 0.4)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                  {getCurrentDate()}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 bottom-0 rounded-lg pointer-events-none"
            style={{
              width: `${currentPosition * 100}%`,
              background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.3), rgba(99, 102, 241, 0.3))'
            }}
          />
        </div>

        {/* Instructions */}
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
          <span>Drag to scrub • Pinch to zoom</span>
          <span>{getCurrentDate()}</span>
        </div>
      </div>
    </div>
  )
}
