/**
 * Portrait Page — slice 1.
 *
 * See projects/polymath/docs/PORTRAIT_SPEC.md
 *
 * Single column. Reuses the editorial typography from HomePage —
 * .section-header for the section titles, .section-seam for the hairlines.
 *
 * Sections, top to bottom:
 *   1. Masthead: title, updated-at, calibration badge, refresh button.
 *   2. this week — the prose body. "See evidence" toggle expands a flat
 *      list of the captures, items, and events the body was built from.
 *   3. last week, the harness predicted — the prior prediction with its
 *      hit / partial / miss chip and the reckoner's one-line evidence.
 *   4. sealed for next week — the new prediction with its open date.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ArrowLeft, Aperture, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
import { SubtleBackground } from '../components/SubtleBackground'
import { api } from '../lib/apiClient'
import { haptic } from '../utils/haptics'
import type { PortraitPayload, PortraitReckoning } from '../../api/_lib/portrait/types'

interface EvidenceRefView {
  kind: 'memory' | 'list_item' | 'project_event' | 'project' | 'reading' | 'highlight'
  source_id: string
  label: string
  snippet: string
  occurred_at: string | null
}

const KIND_LABEL: Record<EvidenceRefView['kind'], string> = {
  memory: 'voice note',
  list_item: 'list',
  project_event: 'project',
  project: 'project',
  reading: 'article',
  highlight: 'highlight',
}

// Staged loading copy. Crossfades while we wait for Flash. The thresholds
// stretch past 20s because a slow tail shouldn't hit the last stage early.
const LOADING_STAGES: Array<{ at_ms: number; line: string }> = [
  { at_ms: 0,      line: 'reading you' },
  { at_ms: 4_000,  line: 'lining up the week' },
  { at_ms: 9_000,  line: 'writing it back' },
  { at_ms: 15_000, line: 'sealing next week' },
  { at_ms: 22_000, line: 'almost there' },
]

export default function PortraitPage() {
  // Thin auth gate — matches MemoriesPage so hooks rules stay clean.
  const { isAuthenticated, loading: authLoading } = useAuthContext()
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--brand-bg)' }} className="min-h-screen pt-12">
        <SignInNudge variant="thoughts" />
      </div>
    )
  }
  return <PortraitPageInner />
}

function PortraitPageInner() {
  const navigate = useNavigate()
  const [payload, setPayload] = useState<PortraitPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEvidence, setShowEvidence] = useState(false)
  const [loadingStage, setLoadingStage] = useState(0)
  const [debouncedFlash, setDebouncedFlash] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('utilities?resource=portrait') as PortraitPayload
      setPayload(res)
    } catch (err) {
      console.error('[portrait] load failed:', err)
      setError(err instanceof Error ? err.message : 'Could not load the portrait')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Advance loading stages while generating. Resets when generation ends.
  useEffect(() => {
    if (!generating) {
      setLoadingStage(0)
      return
    }
    const startedAt = Date.now()
    setLoadingStage(0)
    const tick = () => {
      const elapsed = Date.now() - startedAt
      let idx = 0
      for (let i = 0; i < LOADING_STAGES.length; i++) {
        if (elapsed >= LOADING_STAGES[i].at_ms) idx = i
      }
      setLoadingStage(idx)
    }
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [generating])

  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    haptic.medium()
    try {
      const res = await api.post('utilities?resource=portrait', {}, { timeout: 75_000 }) as PortraitPayload
      setPayload(res)
      if (res.debounced) {
        // Inline flash on the masthead — not a toast. State, not event.
        setDebouncedFlash(true)
        window.setTimeout(() => setDebouncedFlash(false), 2400)
      }
      // For insufficient_signal we leave the EmptyState to do the talking
      // (it already renders the right copy from `payload.reason`). No toast.
    } catch (err) {
      // ApiError carries the server's reason for parse_failed / voice_failed.
      const apiErr = err as { status?: number; details?: { reason?: string }; message?: string }
      if (apiErr?.details?.reason === 'voice_failed') {
        setError("The model wrote something off-voice. Try again in a moment.")
      } else if (apiErr?.details?.reason === 'parse_failed') {
        setError("Couldn't write this week's read. Try again in a moment.")
      } else {
        setError(apiErr?.message || 'Could not generate the portrait')
      }
    } finally {
      setGenerating(false)
    }
  }, [generating])

  const updatedLabel = useMemo(() => {
    if (!payload?.snapshot) return null
    return formatRelative(payload.snapshot.generated_at)
  }, [payload?.snapshot])

  const refreshAvailable = useMemo(() => {
    if (!payload?.next_refresh_available_at) return true
    return Date.now() >= new Date(payload.next_refresh_available_at).getTime()
  }, [payload?.next_refresh_available_at])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <SubtleBackground />
      <div className="min-h-screen pb-24 relative">
        <div className="home-atmosphere" aria-hidden />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 1 }}>

          {/* Masthead */}
          <header className="page-masthead">
            <div className="page-masthead-text">
              <button
                onClick={() => navigate('/')}
                aria-label="Back home"
                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] opacity-60 hover:opacity-100 transition-opacity mb-2 press-spring py-1"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                home
              </button>
              <h1 className="page-hero">the portrait.</h1>
              {payload?.snapshot && (
                <p
                  className="text-[11px] uppercase tracking-[0.22em] italic opacity-70 mt-2"
                  style={{ color: 'var(--brand-text-muted)' }}
                >
                  {debouncedFlash ? (
                    <span style={{ color: 'rgb(var(--brand-primary-rgb))' }}>still fresh</span>
                  ) : (
                    <>updated {updatedLabel}</>
                  )}
                  {payload.calibration && (
                    <>
                      <span className="mx-2 opacity-50" aria-hidden>·</span>
                      <span aria-label={`calibration: ${payload.calibration.display.replace(' / ', ' out of ')}`}>
                        calibration {payload.calibration.display}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="page-masthead-actions">
              <button
                onClick={generate}
                disabled={generating || (!refreshAvailable && !!payload?.snapshot)}
                aria-label={refreshAvailable ? 'Refresh the portrait' : 'Still fresh — read again in a few hours'}
                title={refreshAvailable ? 'Refresh' : 'Still fresh — read again in a few hours'}
                className="masthead-action press-spring disabled:opacity-30"
              >
                <RefreshCw className={`h-5 w-5 ${generating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </header>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-[11px] uppercase tracking-[0.28em] italic opacity-50" style={{ color: 'var(--brand-text-muted)' }}>
                reading you…
              </span>
            </div>
          )}

          {!loading && !payload?.snapshot && !generating && (
            <EmptyState
              onGenerate={generate}
              generating={false}
              reason={payload?.reason ?? null}
            />
          )}

          {/* Mid-page loading shimmer when there's no existing snapshot
              (first generation). When we DO have an old snapshot we keep
              it visible and show a small inline note above the body
              instead — see the "regenerating" branch below. */}
          {!loading && !payload?.snapshot && generating && (
            <LoadingShimmer stageIdx={loadingStage} />
          )}

          {!loading && payload?.snapshot && (
            <>
              {generating && (
                <div className="text-center my-6">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={loadingStage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.8 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="text-[11px] uppercase tracking-[0.28em] italic"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      {LOADING_STAGES[loadingStage]?.line ?? LOADING_STAGES[0].line}…
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}

              {/* this week */}
              <section className="mt-2">
                <h2 className="section-header" style={{ margin: '0 0 16px' }}>
                  this <span>week</span>
                </h2>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={payload.snapshot.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="text-[16px] sm:text-[18px] leading-[1.7]"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-body)',
                      fontWeight: 400,
                    }}
                  >
                    {splitParagraphs(payload.snapshot.body).map((para, i) => (
                      <p key={i} className={i > 0 ? 'mt-5' : ''}>{para}</p>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {payload.snapshot.evidence_refs.length > 0 && (
                  <div className="mt-7 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowEvidence(s => !s)}
                      aria-expanded={showEvidence}
                      className="text-[10px] tracking-[0.28em] uppercase opacity-50 hover:opacity-90 transition-opacity press-spring py-2 px-3 rounded-full"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      {showEvidence
                        ? 'hide signals'
                        : `see signals (${payload.snapshot.evidence_refs.length})`}
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {showEvidence && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-5 space-y-3 overflow-hidden"
                    >
                      {(payload.snapshot.evidence_refs as EvidenceRefView[]).map((e, i) => (
                        <li
                          key={`${e.source_id}-${i}`}
                          className="text-[13px] leading-[1.6]"
                          style={{ color: 'var(--brand-text-muted)' }}
                        >
                          <span className="block text-[9.5px] uppercase tracking-[0.24em] opacity-70 mb-1">
                            {KIND_LABEL[e.kind] ?? e.kind} · {e.label}
                            {e.occurred_at ? ` · ${formatDay(e.occurred_at)}` : ''}
                          </span>
                          {e.snippet && (
                            <span
                              className="block italic opacity-90"
                              style={{ fontFamily: 'var(--brand-font-body)' }}
                            >
                              “{e.snippet}”
                            </span>
                          )}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </section>

              <div className="section-seam my-10" aria-hidden />

              {/* last week, the harness predicted */}
              {payload.last_prediction ? (
                <section>
                  <h2 className="section-header" style={{ margin: '0 0 16px' }}>
                    last week, the harness <span>predicted</span>
                  </h2>
                  <blockquote
                    className="text-[15px] sm:text-[17px] leading-[1.6] italic pl-4 mb-4"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-body)',
                      borderLeft: '2px solid rgba(var(--brand-primary-rgb), 0.4)',
                    }}
                  >
                    “{payload.last_prediction.prediction}”
                  </blockquote>
                  {payload.last_prediction.reckoning && (
                    <ReckoningRow reckoning={payload.last_prediction.reckoning} />
                  )}
                </section>
              ) : (
                <section>
                  <h2 className="section-header" style={{ margin: '0 0 16px' }}>
                    still <span>sealed</span>
                  </h2>
                  <p
                    className="text-[14px] leading-[1.6] italic opacity-80"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    First prediction is sealed. We'll grade it once the week's done.
                  </p>
                </section>
              )}

              <div className="section-seam my-10" aria-hidden />

              {/* sealed for next week — the prediction text itself stays
                  hidden. "Sealed" means sealed. If the user can read what
                  the harness predicted, they can game it (or game against
                  it) and the calibration score becomes meaningless. The
                  reveal happens next week in the "last week, the harness
                  predicted" section, alongside the verdict. */}
              {payload.next_prediction && (
                <section>
                  <h2 className="section-header" style={{ margin: '0 0 16px' }}>
                    sealed for next <span>week</span>
                  </h2>
                  <div
                    className="flex items-center gap-3 px-4 py-4 rounded-2xl mb-3"
                    style={{
                      background: 'rgba(var(--brand-primary-rgb), 0.05)',
                      border: '1px dashed rgba(var(--brand-primary-rgb), 0.3)',
                    }}
                  >
                    <Lock
                      className="h-4 w-4 flex-shrink-0"
                      style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}
                      aria-hidden
                    />
                    <p
                      className="text-[13px] sm:text-[14px] leading-[1.55] italic flex-1 min-w-0"
                      style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-body)' }}
                    >
                      A prediction is sealed. You'll find out what it was — and whether it landed — next week.
                    </p>
                  </div>
                  <p
                    className="text-[12px] italic opacity-70"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    opens <span style={{ color: 'rgb(var(--brand-primary-rgb))', fontStyle: 'normal' }}>{formatDay(payload.next_prediction.sealed_until)}</span>
                  </p>
                </section>
              )}
            </>
          )}

          {error && !loading && (
            <p className="mt-8 text-[13px] italic text-center" style={{ color: 'var(--brand-text-secondary)' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function EmptyState({
  onGenerate,
  generating,
  reason,
}: {
  onGenerate: () => void
  generating: boolean
  reason: 'insufficient_signal' | null
}) {
  const isQuietWeek = reason === 'insufficient_signal'
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Aperture
        className="h-7 w-7 mb-5 opacity-50"
        style={{ color: 'var(--brand-text-secondary)' }}
        aria-hidden
      />
      <h3
        className="text-[22px] sm:text-[26px] leading-[1.2] mb-3"
        style={{
          color: 'var(--brand-text-primary)',
          fontFamily: 'var(--brand-font-body)',
          fontWeight: 500,
          letterSpacing: '-0.018em',
        }}
      >
        {isQuietWeek ? 'Quiet week so far.' : 'No week to read yet.'}
      </h3>
      <p
        className="text-[14px] leading-[1.6] max-w-md mb-7 opacity-85"
        style={{ color: 'var(--brand-text-secondary)' }}
      >
        {isQuietWeek
          ? 'Capture a few thoughts or queue some reading, then come back.'
          : 'Seven days of you, read back. One guess at next week. Graded when the week’s done.'}
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-bold tracking-wide transition-all disabled:opacity-50"
        style={{
          color: 'var(--brand-bg)',
          background: 'linear-gradient(135deg, rgb(var(--brand-primary-rgb)), rgba(var(--brand-primary-rgb), 0.8))',
          boxShadow: '0 4px 16px -4px rgba(var(--brand-primary-rgb), 0.6), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
      >
        {generating ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>reading you…</span>
          </>
        ) : (
          <>
            <Aperture className="h-3.5 w-3.5" />
            <span>open the portrait</span>
          </>
        )}
      </button>
    </div>
  )
}

function LoadingShimmer({ stageIdx }: { stageIdx: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="relative w-48 h-[2px] overflow-hidden mb-8"
        style={{ background: 'rgba(var(--brand-primary-rgb), 0.12)' }}
      >
        <motion.div
          className="absolute top-0 left-0 h-full w-1/3"
          style={{
            background: 'linear-gradient(90deg, transparent, rgb(var(--brand-primary-rgb)), transparent)',
          }}
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
      <div className="relative h-6 mb-2 w-full max-w-xs">
        <AnimatePresence mode="wait">
          <motion.p
            key={stageIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-0 text-[12px] uppercase tracking-[0.22em] italic"
            style={{ color: 'var(--brand-text-muted)' }}
          >
            {LOADING_STAGES[stageIdx]?.line ?? LOADING_STAGES[0].line}…
          </motion.p>
        </AnimatePresence>
      </div>
      <p
        className="text-[10px] tracking-[0.16em] uppercase mt-1 opacity-50"
        style={{ color: 'var(--brand-text-muted)' }}
      >
        A few seconds.
      </p>
    </div>
  )
}

function ReckoningRow({ reckoning }: { reckoning: PortraitReckoning }) {
  const chipStyle = (() => {
    switch (reckoning.called) {
      case 'hit':
        return {
          background: 'rgba(56, 189, 248, 0.14)',   // cyan — confirmation
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: 'rgb(56, 189, 248)',
          label: 'called it',
        }
      case 'partial':
        return {
          background: 'rgba(252, 211, 77, 0.12)',   // amber — half-true
          border: '1px solid rgba(252, 211, 77, 0.4)',
          color: 'rgb(252, 211, 77)',
          label: 'partial',
        }
      case 'miss':
        // Slate, NOT rose — rose collides with the "Read mode" identity
        // colour in ProjectIdeasHome. A miss is honest measurement, not
        // failure, so neutral slate matches the tone better.
        return {
          background: 'rgba(148, 163, 184, 0.12)',
          border: '1px solid rgba(148, 163, 184, 0.4)',
          color: 'rgb(148, 163, 184)',
          label: 'missed it',
        }
    }
  })()

  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.24em] font-semibold flex-shrink-0"
        style={{
          background: chipStyle.background,
          border: chipStyle.border,
          color: chipStyle.color,
        }}
      >
        {chipStyle.label}
      </span>
      <p
        className="text-[14px] leading-[1.55] flex-1 min-w-0 opacity-90"
        style={{
          color: 'var(--brand-text-primary)',
          fontFamily: 'var(--brand-font-body)',
        }}
      >
        {reckoning.evidence}
      </p>
    </div>
  )
}

/**
 * Split body into paragraphs on blank-line separators. Gemini emits both
 * `\n\n` and single `\n` newlines inconsistently — using
 * `whitespace-pre-line` for the whole block gives jumpy vertical
 * rhythm. Splitting and wrapping in `<p>` gives editorial paragraph
 * spacing that matches the rest of the app. Single `\n` inside a
 * paragraph is preserved via `whitespace-pre-line` on the parent.
 */
function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatDay(iso: string): string {
  try {
    const d = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  } catch {
    return iso.slice(0, 10)
  }
}
