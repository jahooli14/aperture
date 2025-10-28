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

import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Layers, FolderKanban, FileText, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

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
  const [loading, setLoading] = useState(true)

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

          const year = monthEvents[0].year
          const month = monthEvents[0].month
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
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Sparkles className="h-12 w-12 text-blue-900 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-neutral-600">Loading timeline...</p>
        </motion.div>
      </div>
    )
  }

  if (monthSections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Sparkles className="h-16 w-16 text-blue-400 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">No Timeline Data Yet</h2>
          <p className="text-neutral-600">Start capturing thoughts, reading articles, and building projects.</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900 mb-1">
                Knowledge Timeline
              </h1>
              <p className="text-sm text-neutral-600">
                Scroll to explore your knowledge evolution
              </p>
            </div>

            {/* Schema Legend */}
            <div className="hidden md:flex gap-4">
              {(['project', 'thought', 'article'] as const).map(type => {
                const Icon = getIcon(type)
                const colors = getSchemaColor(type)
                return (
                  <div key={type} className="flex items-center gap-2">
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
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500"
            style={{
              width: progressBarWidth
            }}
          />
        </div>
      </div>

      {/* Timeline Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {monthSections.map((section, sectionIndex) => (
          <MonthSection
            key={`${section.year}-${section.month}`}
            section={section}
            sectionIndex={sectionIndex}
            totalSections={monthSections.length}
            scrollProgress={scrollYProgress}
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
  onEventClick: (event: TimelineEvent) => void
}

function MonthSection({ section, sectionIndex, totalSections, scrollProgress, onEventClick }: MonthSectionProps) {
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
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl backdrop-blur-xl bg-white/80 border border-neutral-200 shadow-lg">
          <div className="text-3xl font-bold bg-gradient-to-r from-blue-900 to-indigo-900 bg-clip-text text-transparent">
            {section.monthLabel}
          </div>
          <div className="text-sm text-neutral-600 font-medium">
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
  onClick: () => void
}

function TimelineEventCard({ event, eventIndex, sectionIndex, totalSections, scrollProgress, onClick }: TimelineEventCardProps) {
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
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/60 border-2 transition-all duration-300 p-6 shadow-lg group-hover:shadow-2xl"
        style={{
          borderColor: `${colors.primary}50`
        }}
      >
        {/* Glow Effect on Hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
          style={{ backgroundColor: colors.glow }}
        />

        {/* Content */}
        <div className="relative z-10">
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
              <h3 className="font-semibold text-neutral-900 line-clamp-2 group-hover:text-neutral-950">
                {event.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {new Date(event.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
            {event.status && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-medium">
                {event.status}
              </span>
            )}
          </div>
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
