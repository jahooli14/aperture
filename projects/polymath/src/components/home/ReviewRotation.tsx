/**
 * ReviewRotation — the forgotten projects, surfaced on home and dealt with
 * on home.
 *
 * A few priority projects live in the user's head fine. Everything else goes
 * out of sight and stops being able to do the one thing a dormant project is
 * good for: sparking the next one. A complete list on another page doesn't fix
 * that — nobody opens a list of forty things on purpose.
 *
 * ONE AT A TIME, not a list. The first cut of this rendered all three
 * candidates stacked with three buttons each — nine buttons on the home page,
 * which is a menu, and the page's whole rule is "guide, not menu". A single
 * card asks a single question; the rest wait behind it as a physical stack so
 * the batch size is visible without a counter shouting it.
 *
 * Two things the card says without words:
 *   • Colour is the project's craft, taken from its labels (see getTheme) —
 *     so a resurfaced music project arrives the same colour as every other
 *     music thing on the page.
 *   • Dormancy dims it. A project untouched eight months literally looks
 *     faded; picking it up restores it. Clamped so it never drops below
 *     readable.
 *
 * Acting never navigates. The projects page stays for browsing; this is the
 * review, and it finishes where it started.
 */

import { forwardRef, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { getTheme } from '../../lib/projectTheme'
import { spring, ease } from '../../lib/motion'
import { haptic } from '../../utils/haptics'
import { dormancyFade } from './reviewRotationOps'

interface ReviewCandidate {
  id: string
  title: string
  description: string | null
  tags: string[]
  status: string
  reason: string
  shared_tags: string[]
  days_since_touched: number
}

type ReviewAction = 'keep' | 'park' | 'promote'

/** How long the "batch clear" beat holds before the section collapses away. */
const DONE_BEAT_MS = 1600

export function ReviewRotation() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const fetchProjects = useProjectStore(s => s.fetchProjects)

  const [queue, setQueue] = useState<ReviewCandidate[]>([])
  const [batchSize, setBatchSize] = useState(0)
  const [showDone, setShowDone] = useState(false)
  // Ids with a write in flight. A ref, not state: it guards re-entry without
  // re-rendering, and must never gate the NEXT card's buttons — an in-flight
  // write for the card you just dismissed is not a reason to freeze the one
  // that replaced it.
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = (await api.get('projects?resource=review-queue')) as
          | { candidates: ReviewCandidate[] }
          | null
        if (cancelled) return
        if (Array.isArray(res?.candidates) && res.candidates.length > 0) {
          setQueue(res.candidates)
          setBatchSize(res.candidates.length)
        }
      } catch {
        // Silent — the review never interrupts.
      }
    })()
    return () => { cancelled = true }
  }, [])

  // The batch-clear beat: hold a brief acknowledgement, then collapse. Without
  // it the section just blinks out of existence, which reads as a glitch
  // rather than as having finished something.
  useEffect(() => {
    if (!showDone) return
    const id = window.setTimeout(() => setShowDone(false), DONE_BEAT_MS)
    return () => window.clearTimeout(id)
  }, [showDone])

  const current = queue[0]
  const remaining = queue.length - 1
  const reviewed = batchSize - queue.length

  if (!current && !showDone) return null

  const act = async (action: ReviewAction) => {
    if (!current || inFlight.current.has(current.id)) return
    const acted = current
    inFlight.current.add(acted.id)
    haptic.medium()

    // Advance immediately. The decision is the user's, not the server's —
    // making them watch a spinner to confirm what they just chose turns a
    // one-tap review into a wait.
    setQueue(prev => prev.slice(1))
    if (queue.length === 1) setShowDone(true)

    try {
      await api.post('projects?resource=review-act', { project_id: acted.id, action })
      if (action === 'promote') await fetchProjects()
    } catch {
      // Put it back at the front if the write failed, so a decision isn't
      // silently dropped — the project would leave the rotation with nothing
      // actually recorded against it.
      setShowDone(false)
      setQueue(prev => (prev.some(c => c.id === acted.id) ? prev : [acted, ...prev]))
    } finally {
      inFlight.current.delete(acted.id)
    }
  }

  return (
    <>
      <div className="section-seam" aria-hidden />

      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2 className="section-header" style={{ margin: 0 }}>worth a <span>look</span></h2>
        {/* Progress as pips rather than "1 of 3" — the batch is three things,
            not a task counter, and pips don't imply an obligation. */}
        {batchSize > 1 && (
          <div className="flex items-center gap-1.5 flex-shrink-0" aria-hidden>
            {Array.from({ length: batchSize }).map((_, i) => (
              <motion.span
                key={i}
                animate={{
                  opacity: i < reviewed ? 0.85 : 0.22,
                  scale: i === reviewed ? 1.35 : 1,
                }}
                transition={spring.snap}
                style={{
                  display: 'block',
                  width: 4,
                  height: 4,
                  borderRadius: 99,
                  background: 'rgb(var(--brand-primary-rgb))',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {current && (
        <p className="text-[11px] mb-3" style={{ color: 'var(--brand-text-muted)' }}>
          You haven't touched {batchSize === 1 ? 'this' : 'these'} in a while.
        </p>
      )}

      {/* Cards swap in place, so without this the whole rotation is silent to
          a screen reader. Polite: it's never urgent enough to interrupt. */}
      <p className="sr-only" role="status" aria-live="polite">
        {current
          ? `Reviewing ${current.title}. ${reviewed + 1} of ${batchSize}. ${current.reason}`
          : showDone
            ? 'Review batch complete.'
            : ''}
      </p>

      {/* The stack. Height is driven by the front card; the ghosts behind are
          absolutely positioned so they can't push layout around as the queue
          drains. */}
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {current && (
            <ReviewCard
              key={current.id}
              candidate={current}
              remaining={remaining}
              reduceMotion={!!reduceMotion}
              onOpen={() => { haptic.light(); navigate(`/projects/${current.id}`) }}
              onAct={act}
            />
          )}

          {showDone && !current && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={reduceMotion ? ease.quick : spring.gentle}
              className="rounded-2xl border flex items-center gap-3 px-4 py-5"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.10), rgba(15,24,41,0.5))',
                borderColor: 'rgba(var(--brand-primary-rgb),0.28)',
              }}
            >
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(var(--brand-primary-rgb),0.16)',
                  border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
                }}
              >
                <Check className="h-3.5 w-3.5" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
              </span>
              <p className="card-title">That's the batch.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

interface ReviewCardProps {
  candidate: ReviewCandidate
  remaining: number
  reduceMotion: boolean
  onOpen: () => void
  onAct: (action: ReviewAction) => void
}

const ReviewCard = forwardRef<HTMLDivElement, ReviewCardProps>(function ReviewCard(
  { candidate: c, remaining, reduceMotion, onOpen, onAct },
  ref
) {
  // Labels first, legacy type never — a review card is exactly where "creative"
  // would tell you nothing.
  const theme = getTheme('', c.title, c.tags)
  const fade = dormancyFade(c.days_since_touched)

  // pointerEvents on exit matters: AnimatePresence keeps the outgoing card
  // mounted while it animates away, so without this its buttons stay tappable
  // for a few hundred ms — and a tap there would act on the card that just
  // replaced it, not the one under the finger.
  const enter = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, pointerEvents: 'auto' as const },
        exit: { opacity: 0, pointerEvents: 'none' as const },
      }
    : {
        initial: { opacity: 0, y: 18, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' as const },
        exit: { opacity: 0, y: -14, scale: 0.97, pointerEvents: 'none' as const },
      }

  return (
    <div ref={ref} className="relative">
      {/* Ghost cards — the rest of the batch, physically behind. Two at most;
          beyond that the depth stops reading and just adds noise. */}
      {Array.from({ length: Math.min(remaining, 2) }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-x-0 top-0 rounded-2xl border pointer-events-none"
          style={{
            height: '100%',
            transform: `translateY(${(i + 1) * 9}px) scale(${1 - (i + 1) * 0.04})`,
            background: 'rgba(20,30,48,0.85)',
            borderColor: `rgba(${theme.rgb},0.16)`,
            opacity: 0.75 - i * 0.28,
          }}
        />
      ))}

      <motion.div
        layout={!reduceMotion}
        {...enter}
        transition={reduceMotion ? ease.quick : spring.gentle}
        className="relative rounded-2xl border overflow-hidden"
        style={{
          zIndex: 1,
          // The card's own light is the project's craft colour, dimmed by how
          // long it's been sitting.
          background: `linear-gradient(155deg, rgba(${theme.rgb},${0.13 * fade}) 0%, rgba(15,24,41,0.72) 62%)`,
          borderColor: `rgba(${theme.rgb},${0.34 * fade})`,
          boxShadow: `0 0 34px rgba(${theme.rgb},${0.16 * fade}), 0 10px 30px -12px rgba(0,0,0,0.6)`,
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        }}
      >
        {/* Top hairline in the project's colour — same signature the rest of
            the home's cards carry. */}
        <span
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, rgba(${theme.rgb},${0.5 * fade}), transparent)` }}
        />

        <div className="p-4">
          {/* Reason as the eyebrow: it's the framing, so it comes before the
              title rather than trailing after it as a footnote. */}
          <p
            className="text-[9.5px] uppercase tracking-[0.22em] font-semibold mb-2"
            style={{ color: `rgba(${theme.rgb},0.85)` }}
          >
            {c.reason}
          </p>

          <button type="button" onClick={onOpen} className="text-left w-full group">
            <h3 className="card-title-lg line-clamp-2 group-hover:opacity-80 transition-opacity">
              {c.title}
            </h3>
          </button>

          {c.description && (
            <p
              className="text-[12px] leading-relaxed mt-1.5 line-clamp-2"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              {c.description}
            </p>
          )}

          {c.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {c.tags.map((tag, i) => {
                const shared = c.shared_tags.includes(tag)
                return (
                  <motion.span
                    key={tag}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.04, ...ease.quick }}
                    className="text-[9.5px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: shared ? `rgba(${theme.rgb},0.18)` : 'rgba(255,255,255,0.05)',
                      color: shared ? `rgb(${theme.rgb})` : 'var(--brand-text-muted)',
                      border: shared ? `1px solid rgba(${theme.rgb},0.34)` : '1px solid transparent',
                    }}
                  >
                    {tag}
                  </motion.span>
                )
              })}
            </div>
          )}

          {/* One hero action. The user opened the app with willpower to spend,
              so "pick it up" is the outcome worth encouraging; "still mine" is
              the quiet common answer and "park it" hides at the end. */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => onAct('promote')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95"
              style={{
                background: `rgba(${theme.rgb},0.18)`,
                border: `1px solid rgba(${theme.rgb},0.42)`,
                color: `rgb(${theme.rgb})`,
              }}
            >
              Pick it up
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onAct('keep')}
              className="px-3 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider transition-all active:scale-95"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--brand-text-secondary)',
              }}
            >
              Still mine
            </button>
            <button
              type="button"
              onClick={() => onAct('park')}
              className="ml-auto text-[11px] font-medium opacity-45 hover:opacity-90 transition-opacity"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              Park it
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
})
