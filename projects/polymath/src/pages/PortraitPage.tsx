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
import { RefreshCw, ArrowLeft, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
import { SubtleBackground } from '../components/SubtleBackground'
import { api } from '../lib/apiClient'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'

interface EvidenceRef {
  kind: 'memory' | 'list_item' | 'project_event' | 'project' | 'reading' | 'highlight'
  source_id: string
  label: string
  snippet: string
  occurred_at: string | null
}

interface PortraitSnapshot {
  id: string
  body: string
  evidence_refs: EvidenceRef[]
  generated_at: string
}

interface PortraitPrediction {
  id: string
  prediction: string
  week_starting: string
  sealed_until: string
  generated_at: string
}

interface PortraitReckoning {
  id: string
  prediction_id: string
  called: 'hit' | 'partial' | 'miss'
  evidence: string
  score: number
  evaluated_at: string
}

interface PortraitPredictionWithReckoning extends PortraitPrediction {
  reckoning: PortraitReckoning | null
}

interface PortraitPayload {
  snapshot: PortraitSnapshot | null
  last_prediction: PortraitPredictionWithReckoning | null
  next_prediction: PortraitPrediction | null
  calibration: { score_sum: number; count: number; display: string } | null
  next_refresh_available_at: string | null
  reason?: 'insufficient_signal'
  debounced?: boolean
}

const KIND_LABEL: Record<EvidenceRef['kind'], string> = {
  memory: 'voice note',
  list_item: 'list',
  project_event: 'project',
  project: 'project',
  reading: 'article',
  highlight: 'highlight',
}

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
  const { addToast } = useToast()
  const [payload, setPayload] = useState<PortraitPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEvidence, setShowEvidence] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('utilities?resource=portrait') as PortraitPayload
      setPayload(res)
    } catch (err: any) {
      console.error('[portrait] load failed:', err)
      setError(err?.message || 'Could not load the portrait')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    haptic.medium()
    try {
      const res = await api.post('utilities?resource=portrait', {}, { timeout: 75_000 }) as PortraitPayload
      setPayload(res)
      if (res.debounced) {
        addToast({
          title: 'Just generated',
          description: 'The portrait is still fresh. Try again later.',
          variant: 'default',
        })
      } else if (res.reason === 'insufficient_signal') {
        addToast({
          title: 'Not enough this week',
          description: 'Capture a few thoughts or queue some reading, then try again.',
          variant: 'default',
        })
      }
    } catch (err: any) {
      console.error('[portrait] generate failed:', err)
      setError(err?.message || 'Could not generate the portrait')
    } finally {
      setGenerating(false)
    }
  }, [generating, addToast])

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
                className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] opacity-60 hover:opacity-100 transition-opacity mb-2 press-spring"
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
                  updated {updatedLabel}
                  {payload.calibration && (
                    <>
                      <span className="mx-2 opacity-50">·</span>
                      calibration {payload.calibration.display}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="page-masthead-actions">
              <button
                onClick={generate}
                disabled={generating || (!refreshAvailable && !!payload?.snapshot)}
                aria-label="Refresh the portrait"
                title={refreshAvailable ? 'Refresh' : 'Just generated — try again later'}
                className="masthead-action press-spring disabled:opacity-30"
              >
                <RefreshCw className={`h-5 w-5 ${generating ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </header>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="text-[11px] uppercase tracking-[0.28em] italic opacity-50" style={{ color: 'var(--brand-text-muted)' }}>
                opening the portrait…
              </span>
            </div>
          )}

          {!loading && !payload?.snapshot && (
            <EmptyState
              onGenerate={generate}
              generating={generating}
              reason={payload?.reason ?? null}
            />
          )}

          {generating && payload?.snapshot && (
            <div className="text-center my-6">
              <span className="text-[11px] uppercase tracking-[0.28em] italic opacity-70" style={{ color: 'var(--brand-text-muted)' }}>
                re-reading the week…
              </span>
            </div>
          )}

          {!loading && payload?.snapshot && (
            <>
              {/* this week */}
              <section className="mt-2">
                <h2 className="section-header" style={{ margin: '0 0 16px' }}>this <span>week</span></h2>
                <div
                  className="text-[16px] sm:text-[18px] leading-[1.7] whitespace-pre-line"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'var(--brand-font-body)',
                    fontWeight: 400,
                  }}
                >
                  {payload.snapshot.body}
                </div>

                {payload.snapshot.evidence_refs.length > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowEvidence(s => !s)}
                      className="text-[10px] tracking-[0.28em] uppercase opacity-50 hover:opacity-90 transition-opacity press-spring"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      {showEvidence
                        ? '— hide signals —'
                        : `— ${payload.snapshot.evidence_refs.length === 1 ? 'see the signal' : `see all ${payload.snapshot.evidence_refs.length} signals`} —`}
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
                      {payload.snapshot.evidence_refs.map((e, i) => (
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
                    no <span>verdict</span> yet
                  </h2>
                  <p
                    className="text-[14px] leading-[1.6] italic opacity-80"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    The first prediction is still sealed. Once a week passes, the harness scores itself and the score appears here.
                  </p>
                </section>
              )}

              <div className="section-seam my-10" aria-hidden />

              {/* sealed for next week */}
              {payload.next_prediction && (
                <section>
                  <h2 className="section-header" style={{ margin: '0 0 16px' }}>
                    sealed for next <span>week</span>
                  </h2>
                  <blockquote
                    className="text-[16px] sm:text-[18px] leading-[1.55] italic pl-4 mb-3"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-body)',
                      borderLeft: '2px solid rgba(var(--brand-primary-rgb), 0.4)',
                    }}
                  >
                    “{payload.next_prediction.prediction}”
                  </blockquote>
                  <p
                    className="text-[10px] uppercase tracking-[0.28em] opacity-60"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    opens {formatDay(payload.next_prediction.sealed_until)}
                  </p>
                </section>
              )}
            </>
          )}

          {error && !loading && (
            <p className="mt-8 text-[12px] italic text-center" style={{ color: 'var(--brand-text-secondary)' }}>
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
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Sparkles
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
        Nothing here yet.
      </h3>
      <p
        className="text-[14px] leading-[1.6] max-w-md mb-7 opacity-85"
        style={{ color: 'var(--brand-text-secondary)' }}
      >
        {reason === 'insufficient_signal'
          ? 'Not enough captured this week to write a portrait. Add a thought or two, then come back.'
          : 'The portrait reads what you\'ve captured this week and writes you back. One sealed prediction per refresh. A calibration score that grows the longer it knows you.'}
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
            <Sparkles className="h-3.5 w-3.5" />
            <span>open the portrait</span>
          </>
        )}
      </button>
    </div>
  )
}

function ReckoningRow({ reckoning }: { reckoning: PortraitReckoning }) {
  const chipStyle = (() => {
    switch (reckoning.called) {
      case 'hit':
        return {
          background: 'rgba(56, 189, 248, 0.14)',  // cyan
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: 'rgb(56, 189, 248)',
        }
      case 'partial':
        return {
          background: 'rgba(252, 211, 77, 0.12)',  // amber
          border: '1px solid rgba(252, 211, 77, 0.4)',
          color: 'rgb(252, 211, 77)',
        }
      case 'miss':
        return {
          background: 'rgba(244, 114, 182, 0.12)', // rose
          border: '1px solid rgba(244, 114, 182, 0.4)',
          color: 'rgb(244, 114, 182)',
        }
    }
  })()

  return (
    <div className="flex items-start gap-3 flex-wrap">
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.24em] font-semibold flex-shrink-0"
        style={chipStyle}
      >
        {reckoning.called === 'hit' && 'called it'}
        {reckoning.called === 'partial' && 'partial'}
        {reckoning.called === 'miss' && 'missed it'}
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
