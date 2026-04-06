/**
 * EvolutionFeed — Shows AI actively working on your projects
 *
 * Displays:
 *   - 1 highlighted evolution event (intersection / reshape / reflection)
 *   - "X other projects evolving" expandable link
 *   - Surfaces an exact past thought occasionally to trigger reflection
 */

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

interface EvolutionEvent {
  id: string
  event_type: 'intersection' | 'reshape' | 'reflection'
  project_id?: string
  highlight: boolean
  description: string
  created_at: string
}

const EVENT_LABELS: Record<EvolutionEvent['event_type'], string> = {
  intersection: 'Intersection found',
  reshape: 'Idea reshaped',
  reflection: 'Past thought resurfaced',
}

export function EvolutionFeed() {
  const [events, setEvents] = useState<EvolutionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/projects?resource=evolution-feed&limit=10')
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data.events)) setEvents(data.events)
      } catch {}
      finally {
        setLoading(false)
      }
    }
    fetchEvents()
  }, [])

  if (loading) {
    return (
      <div className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--brand-glass-bg)', border: '1px solid rgba(255,255,255,0.06)' }} />
    )
  }

  if (events.length === 0) {
    return (
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--brand-glass-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,179,237,0.08)',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
        }}
      >
        <h2 className="section-header" style={{ marginBottom: '0.75rem' }}>ideas <span>evolving</span></h2>
        <p className="text-sm text-[var(--brand-text-secondary)] opacity-50 leading-relaxed">
          The AI runs overnight and will surface connections between your projects and thoughts here. Add more voice notes to speed things up.
        </p>
      </div>
    )
  }

  const highlight = events.find(e => e.highlight) || events[0]
  const others = events.filter(e => e.id !== highlight.id)

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--brand-glass-bg)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(99,179,237,0.12)',
        boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="section-header" style={{ marginBottom: 0 }}>ideas <span>evolving</span></h2>
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ background: 'var(--brand-primary)' }}
        />
      </div>

      {/* Highlight event */}
      <div className="mb-3">
        <span
          className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
          style={{ background: 'rgba(99,179,237,0.1)', color: 'var(--brand-primary)', border: '1px solid rgba(99,179,237,0.2)' }}
        >
          {EVENT_LABELS[highlight.event_type]}
        </span>
        <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed">{highlight.description}</p>
      </div>

      {/* Others expandable */}
      {others.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1.5 text-xs text-[var(--brand-text-secondary)] opacity-50 hover:opacity-80 transition-opacity mt-2"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {others.length} other {others.length === 1 ? 'project' : 'projects'} evolving
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {others.slice(0, 4).map(event => (
                    <div key={event.id} className="flex items-start gap-2">
                      <span
                        className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--brand-text-secondary)', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        {EVENT_LABELS[event.event_type]}
                      </span>
                      <p className="text-xs text-[var(--brand-text-secondary)] opacity-60 leading-relaxed line-clamp-2">{event.description}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Link to projects */}
      <Link
        to="/projects"
        className="flex items-center gap-1.5 mt-4 text-xs text-[var(--brand-primary)] opacity-60 hover:opacity-100 transition-opacity"
      >
        View all projects
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}
