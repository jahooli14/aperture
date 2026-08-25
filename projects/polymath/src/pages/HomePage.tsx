/**
 * Home Page — the creative harness.
 *
 * The home is a labelled stack of sections, all sharing the editorial
 * .section-header style (lowercase serif with the accent word brand-tinted),
 * separated by 1px .section-seam hairlines that fade across the page width.
 *
 * Section order:
 *   1. Today's answer    — TodaysAnswerCard: one statement, one action, one
 *                          redirect. The redirect panel owns both the
 *                          Focus chat thread AND the full idea deck
 *                          (evidence, modes, hour scope, reject-with-
 *                          reason) — both used to be separate pieces on
 *                          this page (FocusChat as its own stacked card
 *                          with a duplicate input field; the deck as its
 *                          own "try something new" section) and are
 *                          reached from inside the card now instead.
 *   2. Everything else   — EverythingElseMini: one swipeable row, still
 *                          warm projects then queued ones. Used to be two
 *                          stacked 2-up grids ("still warm" / "the queue");
 *                          merged into the single carousel the design
 *                          settled on, so priority/warm/queue reads as one
 *                          continuum instead of three separate lists.
 *   3. Worth a look       — ReviewRotation: two or three forgotten projects,
 *                          reviewed and acted on IN PLACE (still mine / pick
 *                          it up / park it). The projects page is for
 *                          browsing; the review finishes where it starts.
 *                          Ordered by shared label with the current priority
 *                          project, so a resurfaced one reads as a building
 *                          block rather than a random pick. Self-contained
 *                          and invisible once the batch is clear.
 *   4. Now consuming     — ConsumingWidget (identity layer + reading drawers)
 *   5. Thought of the day — ThoughtOfTheDay (editorial pull-quote)
 *
 * Behind everything: a vanishingly subtle vertical wash (.home-atmosphere) —
 * warmer at the top, cooler at the bottom.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useProjectStore, useRecentNonPriorityProjects, useUpNextMiniProjects } from '../stores/useProjectStore'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { useJourneyStore } from '../stores/useJourneyStore'
import { useAuthContext } from '../contexts/AuthContext'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { SubtleBackground } from '../components/SubtleBackground'
import { TodaysAnswerCard } from '../components/home/TodaysAnswerCard'
import { FeelingPill } from '../components/home/FeelingPill'
import { EverythingElseMini } from '../components/home/EverythingElseMini'
import { ReviewRotation } from '../components/home/ReviewRotation'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { ConsumingWidget } from '../components/home/ConsumingWidget'
import { AttentionSlot } from '../components/session/AttentionSlot'
import { DeferMount } from '../components/DeferMount'
import { UnauthHome } from '../components/onboarding/UnauthHome'
import { ease, stagger } from '../lib/motion'
import { AlertCircle, Search, Moon, Settings, ChevronDown, Timer } from 'lucide-react'

export function HomePage() {
  const { isAuthenticated } = useAuthContext()
  const isKeyboardVisible = useKeyboardVisible()
  const navigate = useNavigate()
  const fetchProjects = useProjectStore(s => s.fetchProjects)
  const projects = useProjectStore(s => s.projects)
  const fetchMemories = useMemoryStore(s => s.fetchMemories)
  const setContext = useContextEngineStore(s => s.setContext)
  const onboardingCompletedAt = useJourneyStore(s => s.onboardingCompletedAt)
  const startSession = useJourneyStore(s => s.startSession)
  // Mirror EverythingElseMini's selectors here so we can drop the section
  // header + seam when the row would be empty — a bare "everything else"
  // header over nothing reads as a bug, not a quiet state.
  const recentMini = useRecentNonPriorityProjects(2)
  const upNextMini = useUpNextMiniProjects()
  const hasEverythingElse = recentMini.length > 0 || upNextMini.length > 0

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

  // Warm the chunks for the screens people open from home (a project, a
  // read, a list) while the browser is idle, so the first navigation doesn't
  // pay a lazy-load wait. Fire-and-forget; failures are harmless.
  useEffect(() => {
    if (!isAuthenticated) return
    const prefetch = () => {
      import('./ProjectDetailPage').catch(() => {})
      import('./ReaderPage').catch(() => {})
      import('./ListDetailPage').catch(() => {})
    }
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined
    const cancel = (window as any).cancelIdleCallback as ((id: number) => void) | undefined
    const id = ric ? ric(prefetch, { timeout: 2500 }) : window.setTimeout(prefetch, 1500)
    return () => {
      if (ric && cancel) cancel(id as number)
      else clearTimeout(id as number)
    }
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

          {/* Attention budget (SPEC.md, execution rebuild) — at most one of
              a deferred close-out, the monthly mirror, a composite/morph
              proposal, or today's spark. Renders nothing most opens.
              Additive: sits above the untouched old surface below. */}
          {isAuthenticated && (
            <motion.div {...stackTransition(0)}>
              <AttentionSlot />
            </motion.div>
          )}

          {/* Masthead: bedtime/search actions (right). The mode label lives
              with each section header below ("today's answer", "still warm")
              so the page reads as one editorial stack. No streak counter —
              creative work isn't a daily-login habit. */}
          <motion.div {...stackTransition(0)}>
            <header className="page-masthead">
              <div className="page-masthead-text" style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
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
                {/* Entry point for the new execution session contract
                    (SPEC.md). Additive on purpose — this sits alongside
                    the old Today's Answer / Power Hour flow rather than
                    replacing it, until the session contract is validated
                    and the home rebuild becomes its own piece of work. */}
                <button
                  onClick={() => navigate('/session')}
                  aria-label="Start a session"
                  className="masthead-action press-spring"
                  title="Start a session"
                >
                  <Timer className="h-5 w-5" />
                </button>
              </div>
            </header>
          </motion.div>

          {/* Section 1 — Today's answer. One statement, one action, one
              redirect. FeelingPill still feeds the session-context signal
              the redirect and the idea generator both read; kept small and
              out of the way rather than a competing control above the box.
              The Focus chat thread renders INSIDE this card now (its own
              redirect panel), not as a second card mounted separately here
              — that used to produce two stacked glass cards with duplicate
              headers and duplicate input fields. */}
          <motion.div {...stackTransition(1)}>
            <FeelingPill />
            <TodaysAnswerCard />
          </motion.div>

          {/* Section 2 — Everything else. Still warm projects then queued
              ones, one swipeable row. Header + seam only when there's
              something to show, so we never strand a heading over an
              empty row. */}
          {hasEverythingElse && (
            <>
              <div className="section-seam" aria-hidden />
              <h2 className="section-header" style={{ margin: '0 0 10px' }}>everything <span>else</span></h2>
              <motion.div {...stackTransition(2)}>
                <EverythingElseMini />
              </motion.div>
            </>
          )}

          {/* Section 3 — Worth a look. The review rotation: a few forgotten
              projects, dealt with here rather than on another page. Renders
              its own seam + header and disappears entirely once the batch is
              clear, same contract as "everything else" above. */}
          <motion.div {...stackTransition(3)}>
            <ReviewRotation />
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 4 — Now consuming. Identity layer.
              Non-article lists in the top strip; Saved reads + New reads
              dropdowns hold articles from the reading queue and RSS feeds.
              Deferred: it fetches the reading queue + RSS on mount, so we
              hold it back until it's near the viewport rather than letting
              it compete with the first paint. */}
          <h2 className="section-header" style={{ margin: '0 0 10px' }}>now <span>consuming</span></h2>
          <motion.div {...stackTransition(4)}>
            <DeferMount minHeight={120}>
              <ConsumingWidget />
            </DeferMount>
          </motion.div>

          <div className="section-seam" aria-hidden />

          {/* Section 5 — Thought of the day. Component renders its own
              section-header internally. Deferred for the same reason — it
              fetches a batch of resurfaced memories on mount. */}
          <motion.div {...stackTransition(5)}>
            <DeferMount minHeight={160}>
              <ThoughtOfTheDay />
            </DeferMount>
          </motion.div>

          {/* Quiet exit to Settings — small, centred, low-contrast.
              Lives at the very bottom so it never competes with content. */}
          <motion.div {...stackTransition(6)}>
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

        {/* Pairs with the top box's own "or steer it" language: that card
            is the shape-a-session half of the screen; the ⊕ fixed at the
            bottom is the other half — capture, always on, no card needed.
            Purely a label pointing at a button that already works, so it's
            decorative (aria-hidden, no pointer events) and sits well clear
            of the FAB's own halo (safe-area + ~5.7rem at most) rather than
            trying to touch it. Hidden with the keyboard, same as the FAB
            it's labelling. */}
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 transition-opacity duration-200"
          style={{
            bottom: 'calc(var(--safe-area-inset-bottom, 20px) + 7.25rem)',
            opacity: isKeyboardVisible ? 0 : 1,
          }}
          aria-hidden
        >
          <span
            className="text-[10px] uppercase tracking-[0.24em] font-semibold px-3 py-1 rounded-full"
            style={{
              color: 'var(--brand-text-secondary)',
              opacity: 0.55,
              background: 'rgba(15,24,41,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            or capture something new
          </span>
          <motion.div
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="h-3.5 w-3.5" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.6 }} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
