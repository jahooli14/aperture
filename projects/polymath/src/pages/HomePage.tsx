/**
 * Home Page — the creative harness.
 *
 * The home renders as a single continuous surface — no section headings,
 * no "your priority / recently active / up next" labels. Group identity
 * is carried by the cards' material:
 *
 *   • The Moment / priority hero — saturated. Project accent washes the card.
 *   • Recently active — glass cards, 2-up. Accent dot + soft corner vignette.
 *   • Up Next — ghost cards, 2-up. Outline-only. Quieter, reads as "later".
 *
 * Section breaks are 1px hairline "seams" (.section-seam) that fade across
 * the page width. Behind everything: a vanishingly subtle vertical wash
 * (.home-atmosphere) — warmer at the top, cooler at the bottom.
 *
 * Top-left of the masthead carries a "mode register" chip naming what the
 * lead card is firing in: priority / keep going / quiet. Replaces the
 * removed wordmark/eyebrow.
 */

import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore, usePriorityProject, useMostRecentNonPriorityProject } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { useAuthContext } from '../contexts/AuthContext'
import { SubtleBackground } from '../components/SubtleBackground'
import { KeepGoingCard, KeepGoingEmpty } from '../components/home/KeepGoingCard'
import { RecentlyActiveMini } from '../components/home/RecentlyActiveMini'
import { UpNextMini } from '../components/home/UpNextMini'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { ProjectIdeasHome } from '../components/home/ProjectIdeasHome'
import { MomentSurface } from '../components/home/MomentSurface'
import { FeelingPill } from '../components/home/FeelingPill'
import { UnauthHome } from '../components/onboarding/UnauthHome'
import { ease, stagger } from '../lib/motion'
import { AlertCircle, ArrowRight, Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box, Search, Moon } from 'lucide-react'

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

/**
 * Mode register chip — small two-line label in the top-left of the home
 * masthead. Names what the lead card is firing in, and tints itself in
 * that project's accent colour so the chip echoes the hero downscreen.
 *
 * For now the chip reads off the priority / recent state we already have.
 * When MomentSurface lifts its mode (new idea / reshape / extend) into
 * shared state, this is where it should land.
 */
function ModeRegister({
  label,
  detail,
}: {
  label: string
  detail?: string
}) {
  return (
    <div className="mode-register">
      <span className="mode-register-label">{label}</span>
      {detail && <span className="mode-register-detail">{detail}</span>}
    </div>
  )
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
  const navigate = useNavigate()
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

  // After 9:30pm, surface the bedtime affordance up in the masthead
  // instead of as a floating FAB. Re-evaluates each minute so it
  // appears without a reload.
  const [isAfterBedtime, setIsAfterBedtime] = useState(() => {
    const n = new Date(); return n.getHours() > 21 || (n.getHours() === 21 && n.getMinutes() >= 30)
  })
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setIsAfterBedtime(n.getHours() > 21 || (n.getHours() === 21 && n.getMinutes() >= 30))
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

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

  // Mode register copy + accent. Reads off the data we already have —
  // priority project takes the chip, falling back to the still-warm card,
  // then a quiet "no focus" state. When MomentSurface starts surfacing
  // explicit modes (new idea / reshape / extend), wire them in here.
  const leadProject = priorityProject || recentProject
  const modeLabel = priorityProject ? 'priority' : recentProject ? 'keep going' : 'quiet'
  const modeDetail = leadProject?.title

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <SubtleBackground />

      <div className="min-h-screen pb-24 relative">
        {/* Vertical time-of-day wash — warm-top to cool-bottom. The trick
            that makes "now → later" feel like a real axis on the page. */}
        <div className="home-atmosphere" aria-hidden />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 1 }}>

          {/* Masthead: mode register chip (left) + bedtime/search (right). */}
          <motion.div {...stackTransition(0)}>
            <header className="page-masthead">
              <div className="page-masthead-text">
                {leadProject && (
                  <ModeRegister
                    label={modeLabel}
                    detail={modeDetail}
                  />
                )}
              </div>
              <div className="page-masthead-actions">
                {isAfterBedtime && (
                  <button
                    onClick={() => navigate('/bedtime')}
                    aria-label="Bedtime — wind down"
                    className="masthead-action press-spring"
                    title="Bedtime — wind down"
                    style={{
                      background: 'rgba(var(--brand-primary-rgb), 0.12)',
                      borderColor: 'rgba(var(--brand-primary-rgb), 0.35)',
                    }}
                  >
                    <Moon className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={() => navigate('/search')}
                  aria-label="Search everything"
                  className="masthead-action press-spring"
                  title="Search everything"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </header>
          </motion.div>

          {/* Session context — one-tap "how are you feeling right now" so
              downstream surfaces (idea re-roll, Keep Going filtering) can
              calibrate to today. CLAUDE.md §Inputs #1. Persisted to
              sessionStorage so a stale state from yesterday doesn't shape
              today's home. Stays compact and dismissable — tapping the
              same chip again clears the selection. */}
          <motion.div {...stackTransition(0)} className="flex justify-center">
            <FeelingPill />
          </motion.div>

          {/* The Moment — earned AI idea. Renders only when the cron has
              pre-baked a high-confidence Read idea; otherwise null and the
              page falls back to the priority hero. */}
          <motion.div {...stackTransition(1)}>
            <MomentSurface />
          </motion.div>

          {/* Hero — the single priority project, or the empty-state nudge. */}
          {priorityProject ? (
            <motion.div {...stackTransition(2)}>
              <KeepGoingCard project={priorityProject} />
            </motion.div>
          ) : !hasAnyFocus ? (
            <motion.div {...stackTransition(2)}>
              <KeepGoingEmpty />
            </motion.div>
          ) : null}

          {/* Recently active — 2-up glass cards. */}
          <h2 className="section-header" style={{ margin: '32px 0 18px' }}>still <span>warm</span></h2>
          <motion.div {...stackTransition(3)}>
            <RecentlyActiveMini />
          </motion.div>

          {/* Up Next — 2-up ghost cards. Quieter material than the glass
              row above, so it reads as further away. */}
          <h2 className="section-header" style={{ margin: '32px 0 18px' }}>the <span>queue</span></h2>
          <motion.div {...stackTransition(4)}>
            <UpNextMini />
          </motion.div>

          {/* Suggest a project — quiet escape-hatch pill for on-demand
              generation when nothing higher-up has earned the page. */}
          <h2 className="section-header" style={{ margin: '32px 0 18px' }}>try something <span>new</span></h2>
          <motion.div {...stackTransition(5)}>
            <ProjectIdeasHome />
          </motion.div>

          {/* What you're consuming — identity layer. */}
          <h2 className="section-header" style={{ margin: '32px 0 18px' }}>now <span>consuming</span></h2>
          <motion.div {...stackTransition(6)}>
            <NowConsumingWidget />
          </motion.div>

          {/* Thought of the day — resurfaced memory quote. */}
          <motion.div {...stackTransition(7)}>
            <ThoughtOfTheDay />
          </motion.div>

        </div>
      </div>
    </motion.div>
  )
}
