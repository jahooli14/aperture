/**
 * Home Page — the creative harness.
 *
 * The home is a labelled stack of sections, all sharing the editorial
 * .section-header style (lowercase serif with the accent word brand-tinted),
 * separated by 1px .section-seam hairlines that fade across the page width.
 *
 * Section order:
 *   1. Today's answer    — TodaysAnswerCard: one statement, one action, one
 *                          redirect. Since the execution rebuild (SPEC.md)
 *                          this card IS the session contract — the live
 *                          project, the last close-out played back in your
 *                          own words, and a Start session that runs the
 *                          window → shapes → timer → close-out flow inside
 *                          this same box. The redirect panel still owns the
 *                          Focus chat thread and the full idea deck.
 *   2. The attention slot — AttentionSlot: at most ONE of a deferred
 *                          close-out, the monthly mirror, the live-project
 *                          re-ask, a morph/composite proposal, today's
 *                          spark, or the different-thing nudge. Silent on
 *                          most opens. Never a competing hero.
 *   3. Everything else   — EverythingElseMini: one swipeable row, still
 *                          warm projects then queued ones. Used to be two
 *                          stacked 2-up grids ("still warm" / "the queue");
 *                          merged into the single carousel the design
 *                          settled on, so priority/warm/queue reads as one
 *                          continuum instead of three separate lists.
 *   4. Now consuming     — ConsumingWidget (identity layer + reading drawers)
 *   5. Thought of the day — ThoughtOfTheDay (editorial pull-quote, the
 *                          page's closer). Distinct from a spark: a spark
 *                          asks and wants an answer; this shows and asks
 *                          nothing.
 *
 * Removed by the execution rebuild: "worth a look" (ReviewRotation). Its
 * three-button triage (still mine / pick it up / park it) was a menu, and
 * "park it" asks you to confirm a kill — which drift-decay now does quietly
 * on its own. The half of its job that IS still needed (offering a
 * long-forgotten project back into play) belongs in the attention slot, not
 * in a section of its own. Component untouched.
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
import { SubtleBackground } from '../components/SubtleBackground'
import { TodaysAnswerCard } from '../components/home/TodaysAnswerCard'
import { EverythingElseMini } from '../components/home/EverythingElseMini'
import { ConsumingWidget } from '../components/home/ConsumingWidget'
import { ThoughtOfTheDay } from '../components/home/ThoughtOfTheDay'
import { AttentionSlot } from '../components/session/AttentionSlot'
import { DeferMount } from '../components/DeferMount'
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
            <TodaysAnswerCard />
          </motion.div>

          {/* The attention budget (SPEC.md) — at most ONE of: a deferred
              close-out, the monthly mirror, the live-project re-ask, a
              composite/morph proposal, today's spark, or the different-thing
              nudge. Renders nothing on most opens.

              It sits directly under the answer box, not above the masthead
              where the first cut put it (which read as broken chrome), and
              never as a competing hero — the answer box is the one thing
              you act on; this is the one thing the app gets to say back. */}
          <motion.div {...stackTransition(2)}>
            <AttentionSlot />
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

          {/* "Worth a look" (ReviewRotation) removed by the execution
              rebuild — resurfacing a forgotten project is the mull
              channel's job now (sparks, and the composite proposals that
              gate on exactly the same "stalled" condition the rotation was
              approximating with time-since-touched). Two mechanisms
              competing to resurface the same projects is what made the page
              read as unrelated sections. The rotation's component and its
              API resources are now deleted rather than left dormant —
              a second resurfacing mechanism sitting unused is exactly the
              fragmentation this rebuild is clearing out. */}

          <div className="section-seam" aria-hidden />

          {/* Section 3 — Now consuming. Identity layer.
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

          {/* Section 4 — Thought of the day. An earlier cut of the rebuild
              removed this as "the spark channel already does quotes from
              your past", which was wrong: a spark ASKS you something and
              wants a voice answer back, this just shows you something you
              said and asks nothing. Different job, and it's the page's
              closer rather than a competing interruption. Component renders
              its own section-header internally; deferred because it fetches
              a batch of resurfaced memories on mount. */}
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

        {/* The floating "or capture something new" caption + chevron that
            used to sit here is gone. It was position:fixed at ~85% of the
            viewport height, so at rest it landed on top of whatever content
            happened to be there — a section header, a project card, the
            review card — on every screen and at every scroll position. A
            translucent pill laid over live text is a large part of what made
            this page read as cluttered.

            Nothing is lost: the ⊕ in the nav below is a glowing primary
            button in the centre of the bar, and the answer box's own
            "Say what you're actually after…" field already carries the
            capture-vs-steer pairing this caption was spelling out. */}
      </div>
    </motion.div>
  )
}
