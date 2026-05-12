/**
 * Home Page — the creative harness.
 *
 * Stack (top to bottom):
 *   1. YourHourHeader — brand + duration toggle + search
 *   2. MomentSurface — earned AI idea. Only renders when the cron has
 *      pre-baked a high-confidence Read idea; otherwise null.
 *   3. Priority project card — the starred one. Hidden if nothing starred.
 *   4. Still-warm card — most-recently-touched non-priority project.
 *   5. UpNextShelf — user-pinned queue. Hidden when empty.
 *   6. ProjectIdeasHome — "suggest a project" pill. The escape hatch when
 *      no earned idea is ready; expands to the full editorial card on click.
 *   7. NowConsumingWidget — compact strip of active list items.
 *   8. ThoughtOfTheDay — resurfaced memory quote.
 *   9. BedtimeFloatingIcon — after 9:30pm.
 *
 * Ordering: the AI moment leads when present (the most-important surface).
 * Otherwise Keep Going leads — the user opens the app to do the thing
 * they're already on, and the suggest-pill stays a quiet escape hatch
 * below Up Next.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore, usePriorityProject, useMostRecentNonPriorityProject } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { useAuthContext } from '../contexts/AuthContext'
import { SubtleBackground } from '../components/SubtleBackground'
import { YourHourHeader } from '../components/home/YourHourHeader'
import { KeepGoingCard, KeepGoingEmpty } from '../components/home/KeepGoingCard'
import { UpNextShelf } from '../components/home/UpNextShelf'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { BedtimeFloatingIcon } from '../components/home/BedtimeFloatingIcon'
import { ProjectIdeasHome } from '../components/home/ProjectIdeasHome'
import { MomentSurface } from '../components/home/MomentSurface'
import { UnauthHome } from '../components/onboarding/UnauthHome'
import { ease, stagger } from '../lib/motion'
import { AlertCircle, ArrowRight, Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box } from 'lucide-react'

const LIST_TYPE_ICONS: Record<string, React.ElementType> = {
  film: Film, music: Music, tech: Monitor, book: Book, place: MapPin,
  game: Gamepad2, event: Calendar, quote: Quote, article: FileText,
  software: Monitor, generic: Box,
}

// Per-list-type accent colour (rgb triple) — paints the icon halo so the
// strip reads as a constellation of distinct items, not a uniform list.
const LIST_TYPE_ACCENT: Record<string, string> = {
  film: '236, 72, 153',     // pink
  music: '239, 68, 68',     // red
  tech: '59, 130, 246',     // blue
  book: '252, 211, 77',     // amber
  place: '16, 185, 129',    // emerald
  game: '167, 139, 250',    // violet
  event: '56, 189, 248',    // cyan
  quote: '156, 163, 175',   // slate
  article: '6, 182, 212',   // teal
  software: '59, 130, 246', // blue
  generic: '156, 163, 175', // slate
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
    <section className="pb-8">
      <h2 className="section-header">what you're <span>into</span></h2>
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(15,24,41,0.45))',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {shown.map((item, i) => {
          const Icon = LIST_TYPE_ICONS[item.listType] || Box
          const accent = LIST_TYPE_ACCENT[item.listType] || LIST_TYPE_ACCENT.generic
          const isLast = i === shown.length - 1
          return (
            <Link
              key={item.itemId}
              to={`/lists/${item.listId}`}
              className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] min-h-[60px]"
              style={{
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                animation: `pageEnter 0.45s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms both`,
              }}
            >
              <div
                className="relative h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon className="h-4 w-4 text-[var(--brand-text-secondary)] opacity-80" />
                {/* Type accent — single dot, the only colour cue per row */}
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                  style={{
                    background: `rgb(${accent})`,
                    boxShadow: `0 0 6px rgba(${accent}, 0.7)`,
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate">{item.itemContent}</p>
                <p className="text-[11px] text-[var(--brand-text-muted)] truncate mt-0.5">{item.listTitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--brand-text-muted)] opacity-40 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
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
  const fetchMemories = useMemoryStore(s => s.fetchMemories)
  const setContext = useContextEngineStore(s => s.setContext)
  const onboardingCompletedAt = useJourneyStore(s => s.onboardingCompletedAt)
  const startSession = useJourneyStore(s => s.startSession)
  const priorityProject = usePriorityProject()
  const recentProject = useMostRecentNonPriorityProject()
  const hasAnyFocus = priorityProject || recentProject

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

  // Stagger sections in as the page mounts so the home doesn't snap into
  // existence. Uses the shared editorial ease so every page entrance
  // feels like the same hand dealt them.
  const stackTransition = (i: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { ...ease.editorial, delay: 0.04 + i * stagger.list },
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <SubtleBackground />

      <div className="min-h-screen pb-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <motion.div {...stackTransition(0)}>
            {/* YourHourHeader provides the .page-masthead spacing so the
                title sits at the same y as the other tabs. */}
            <YourHourHeader />
          </motion.div>

          {/* The Moment — earned AI idea. Renders only when the cron has
              pre-baked a high-confidence Read idea; otherwise null and the
              page falls back to Keep Going as the lead. */}
          <motion.div className="mb-10" {...stackTransition(1)}>
            <MomentSurface />
          </motion.div>

          {/* Priority — the single starred project. Hidden when nothing
              is starred (the recent-card below carries the page on its own). */}
          {priorityProject && (
            <motion.div className="mb-10" {...stackTransition(2)}>
              <KeepGoingCard
                project={priorityProject}
                heading={<>your <span>priority</span></>}
              />
            </motion.div>
          )}

          {/* Still warm — most-recently-touched non-priority active project.
              Hidden when nothing else is active. Always shows a fallback
              empty state when nothing is in focus at all (no priority, no
              recent), so the page doesn't collapse to just the header + pill. */}
          {recentProject ? (
            <motion.div className="mb-10" {...stackTransition(3)}>
              <KeepGoingCard
                project={recentProject}
                heading={<>still <span>warm</span></>}
              />
            </motion.div>
          ) : !hasAnyFocus ? (
            <motion.div className="mb-10" {...stackTransition(3)}>
              <h2 className="section-header">keep <span>going</span></h2>
              <KeepGoingEmpty />
            </motion.div>
          ) : null}

          {/* Up Next — pinned queue. Hidden when empty. */}
          <motion.div className="mb-10" {...stackTransition(4)}>
            <UpNextShelf />
          </motion.div>

          {/* Suggest a project — the quiet escape-hatch pill. Expands to the
              full editorial card on click. The earned-teaser case has moved
              to MomentSurface at the top; this slot is the on-demand
              generation surface only. */}
          <motion.div className="mb-10" {...stackTransition(5)}>
            <ProjectIdeasHome />
          </motion.div>

          {/* What you're consuming */}
          <motion.div {...stackTransition(6)}>
            <NowConsumingWidget />
          </motion.div>

          {/* Thought of the day */}
          <motion.div {...stackTransition(7)}>
            <ThoughtOfTheDay />
          </motion.div>

        </div>
      </div>

      {/* Bedtime floating icon — appears after 9:30pm */}
      <BedtimeFloatingIcon />
    </motion.div>
  )
}
