/**
 * Home Page — the creative harness.
 *
 * The home is a labelled stack of sections, all sharing the editorial
 * .section-header style (lowercase serif with the accent word brand-tinted),
 * separated by 1px .section-seam hairlines that fade across the page width.
 *
 * Section order:
 *   1. Your priority     — KeepGoingCard for the starred project (hero)
 *   2. Still warm        — RecentlyActiveMini (2-up glass)
 *   3. The queue         — UpNextMini (2-up ghost)
 *   4. Try something new — ProjectIdeasHome (compact on-demand suggestion)
 *   5. Now consuming     — ConsumingWidget (identity layer + reading drawers)
 *   6. Thought of the day — ThoughtOfTheDay (editorial pull-quote)
 *
 * Behind everything: a vanishingly subtle vertical wash (.home-atmosphere) —
 * warmer at the top, cooler at the bottom.
 *
 * Top-left of the masthead carries a "mode register" chip naming what the
 * lead card is firing in: priority / keep going / quiet. Replaces the
 * removed wordmark/eyebrow.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { ConsumingWidget } from '../components/home/ConsumingWidget'
import { UnauthHome } from '../components/onboarding/UnauthHome'
import { ease, stagger } from '../lib/motion'
import { AlertCircle, Search, Moon, Settings } from 'lucide-react'

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
        setError(err instanceof Error ? err.message : 'Failed to load')
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
        {/* Vertical time-of-day wash — warm-top to cool-bottom. The trick
            that makes "now → later" feel like a real axis on the page. */}
        <div className="home-atmosphere" aria-hidden />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 1 }}>

          {/* Masthead: bedtime/search actions (right). The mode label lives
              with each section header below ("your priority", "still warm")
              so the page reads as one editorial stack. */}
          <motion.div {...stackTransition(0)}>
            <header className="page-masthead">
              <div className="page-masthead-text">
                <h1 className="page-hero">Aperture.</h1>
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

          {/* Section 1 — Priority. */}
          {priorityProject ? (
            <motion.div {...stackTransition(2)}>
              <h2 className="section-header" style={{ margin: '0 0 10px' }}>your <span>priority</span></h2>
              <KeepGoingCard project={priorityProject} />
            </motion.div>
          ) : !hasAnyFocus ? (
            <motion.div {...stackTransition(2)}>
              <h2 className="section-header" style={{ margin: '0 0 10px' }}>your <span>priority</span></h2>
              <KeepGoingEmpty />
            </motion.div>
          ) : null}

          <div className="section-seam" aria-hidden />

          {/* Section 2 — Recently active. 2-up glass cards. */}
          <h2 className="section-header" style={{ margin: '0 0 10px' }}>still <span>warm</span></h2>
          <motion.div {...stackTransition(3)}>
            <RecentlyActiveMini />
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 3 — Up Next. 2-up ghost cards, quieter material. */}
          <h2 className="section-header" style={{ margin: '0 0 10px' }}>the <span>queue</span></h2>
          <motion.div {...stackTransition(4)}>
            <UpNextMini />
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 4 — Try something new. Compact escape-hatch for
              on-demand idea generation. Sits below the project lists so
              the user sees what they're already working on first. */}
          <h2 className="section-header" style={{ margin: '0 0 10px' }}>try something <span>new</span></h2>
          <motion.div {...stackTransition(5)}>
            <ProjectIdeasHome />
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 5 — Now consuming. Identity layer.
              Non-article lists in the top strip; Saved reads + New reads
              dropdowns hold articles from the reading queue and RSS feeds. */}
          <h2 className="section-header" style={{ margin: '0 0 10px' }}>now <span>consuming</span></h2>
          <motion.div {...stackTransition(6)}>
            <ConsumingWidget />
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 6 — Thought of the day. Component renders its own
              section-header internally. */}
          <motion.div {...stackTransition(7)}>
            <ThoughtOfTheDay />
          </motion.div>

          {/* Quiet exit to Settings — small, centred, low-contrast.
              Lives at the very bottom so it never competes with content. */}
          <motion.div {...stackTransition(8)}>
            <div className="pt-10 pb-2 flex justify-center">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] opacity-40 hover:opacity-80 transition-opacity press-spring"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </motion.div>
  )
}
