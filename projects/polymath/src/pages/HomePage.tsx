/**
 * Home Page — the creative harness.
 *
 * Stack (top to bottom):
 *   1. YourHourHeader — brand + duration toggle + search
 *   2. ProjectIdeasHome — The Moment: single hero card directing creative
 *      willpower (new idea coalescing / forgotten project / extend an active)
 *   3. KeepGoingCarousel — focus mode for active projects
 *   4. NowConsumingWidget — compact strip of active list items
 *   5. ThoughtOfTheDay — resurfaced memory quote
 *   6. BedtimeFloatingIcon — after 9:30pm
 *
 * Deprecated and removed: This Week (mashups), Unshaped Nudge Bar, Try
 * Something New. Their jobs map into The Moment's modes (Mode 3 Extend,
 * Mode 1 Coalescing, Mode 2 Forgotten).
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore } from '../stores/useProjectStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { useAuthContext } from '../contexts/AuthContext'
import { SubtleBackground } from '../components/SubtleBackground'
import { YourHourHeader } from '../components/home/YourHourHeader'
import { KeepGoingCarousel } from '../components/home/KeepGoingCarousel'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { BedtimeFloatingIcon } from '../components/home/BedtimeFloatingIcon'
import { ProjectIdeasHome } from '../components/home/ProjectIdeasHome'
import { UnauthHome } from '../components/onboarding/UnauthHome'
import { AlertCircle, ArrowRight, Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box } from 'lucide-react'

const LIST_TYPE_ICONS: Record<string, React.ElementType> = {
  film: Film, music: Music, tech: Monitor, book: Book, place: MapPin,
  game: Gamepad2, event: Calendar, quote: Quote, article: FileText,
  software: Monitor, generic: Box,
}

function NowConsumingWidget() {
  const [activeItems, setActiveItems] = useState<{ listId: string; listTitle: string; listType: string; itemId: string; itemContent: string }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const fetchActiveItems = async () => {
      try {
        const res = await fetch('/api/lists?scope=items&resource=active-items&limit=4')
        if (!res.ok) return
        const rows = await res.json()
        setActiveItems(rows.map((r: any) => ({
          listId: r.list_id,
          listTitle: r.list?.title ?? '',
          listType: r.list?.type ?? 'generic',
          itemId: r.id,
          itemContent: r.content,
        })))
      } catch {}
      setLoaded(true)
    }
    fetchActiveItems()
  }, [])

  if (!loaded || activeItems.length === 0) return null

  const shown = activeItems.slice(0, 4)

  return (
    <section className="pb-6">
      <h2 className="section-header">what you're <span>consuming</span></h2>
      <div className="flex flex-col gap-1 p-3 rounded-2xl neon-card">
        {shown.map((item) => {
          const Icon = LIST_TYPE_ICONS[item.listType] || Box
          return (
            <Link
              key={item.itemId}
              to={`/lists/${item.listId}`}
              className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[rgba(245,158,11,0.06)] min-h-[56px]"
            >
              <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] flex-shrink-0">
                <Icon className="h-4 w-4 text-[var(--brand-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate">{item.itemContent}</p>
                <p className="text-xs text-[var(--brand-text-muted)] truncate">{item.listTitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--brand-text-muted)] flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function HomePage() {
  const { isAuthenticated } = useAuthContext()
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  const projects = useProjectStore(s => s.projects)
  const fetchSuggestions = useSuggestionStore(s => s.fetchSuggestions)
  const fetchMemories = useMemoryStore(s => s.fetchMemories)
  const setContext = useContextEngineStore(s => s.setContext)
  const onboardingCompletedAt = useJourneyStore(s => s.onboardingCompletedAt)
  const startSession = useJourneyStore(s => s.startSession)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    setContext('home', 'home', 'Home')
    if (onboardingCompletedAt) startSession()
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const loadData = async () => {
      try {
        if (projects.length === 0) {
          await fetchProjects()
        } else {
          fetchProjects()
        }
        fetchSuggestions()
        fetchMemories()
      } catch (err) {
        console.error('Failed to load data on mount:', err)
      }
    }
    loadData()
  }, [isAuthenticated])

  // Show landing page for unauthenticated users instead of empty black screen
  if (!isAuthenticated) {
    return <UnauthHome />
  }

  if (error) {
    return (
      <div className="min-h-screen py-12 px-4 flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="max-w-2xl w-full p-8 border-red-500/20 bg-brand-primary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-brand-primary/20 flex items-center justify-center text-brand-text-secondary">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold premium-text-platinum">Something went wrong</h2>
          </div>
          <p className="text-brand-text-secondary mb-8 font-mono text-sm p-4 bg-black/30 rounded-lg border border-red-500/10">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-lg bg-brand-primary text-[var(--brand-text-primary)] font-bold hover:bg-brand-primary transition-colors">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      <SubtleBackground />

      <div className="min-h-screen pb-24 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <YourHourHeader />

          {/* The Moment — single hero card, the headline of the home flow */}
          <div className="mb-8">
            <ProjectIdeasHome />
          </div>

          {/* Keep Going — focus mode for active projects */}
          <div className="mb-8">
            <KeepGoingCarousel />
          </div>

          {/* What you're consuming */}
          <NowConsumingWidget />

          {/* Thought of the day */}
          <ThoughtOfTheDay />

        </div>
      </div>

      {/* Bedtime floating icon — appears after 9:30pm */}
      <BedtimeFloatingIcon />
    </motion.div>
  )
}
