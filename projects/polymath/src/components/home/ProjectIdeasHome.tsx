/**
 * ProjectIdeasHome — the home headline surface.
 *
 * Replaces the witness-mode "noticing" panel with a concrete, opinionated
 * thing: 3 ranked project ideas drawn from across the user's data, each
 * with evidence receipts and a doable next step. Generation runs on a
 * weekly cron — this component just reads the latest batch from the API.
 *
 * Behaviour:
 *   - Empty state (no batch yet) shows a one-tap "show me ideas" button
 *     that triggers a fresh generation. Up to ~30s — we show progress copy.
 *   - Each idea has save / dismiss / "I built it" actions. Feedback writes
 *     status back to project_ideas; rejected ideas vanish from the deck.
 *   - The deck shows up to 3 ideas, swipeable on mobile via simple
 *     prev/next chevrons. No autoplay carousel. Idea 1 is the strongest.
 *   - "Refresh deck" regenerates on demand — confirms first because it
 *     replaces the current batch.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookmarkPlus, BookmarkCheck, X, ChevronLeft, ChevronRight, Hammer, RotateCw } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { api } from '../../lib/apiClient'

interface IdeaEvidence {
  kind: string
  source_id: string
  label: string
  date: string
  excerpt: string
}

interface ProjectIdea {
  id: string
  batch_id: string
  rank: number
  title: string
  pitch: string
  why_now: string
  next_step: string
  evidence: IdeaEvidence[]
  status: 'pending' | 'saved' | 'rejected' | 'built'
  generated_at: string
}

interface ProjectIdeasResponse {
  ideas: ProjectIdea[]
  generated_at: string | null
  has_any: boolean
}

interface GenerateResponse {
  ideas: ProjectIdea[]
  reason?: string
  signal_count?: number
  attempts?: number
  took_ms?: number
  // Cooldown response shape (HTTP 429 — the apiClient surfaces this as
  // an error, but we also defensively check the parsed body).
  retry_after_ms?: number
  message?: string
}

const KIND_LABEL: Record<string, string> = {
  memory: 'voice note',
  list_item: 'list',
  project: 'project',
  project_dormant: 'dormant project',
  reading: 'article',
  highlight: 'highlight',
  todo: 'todo',
  suggestion: 'idea',
  idea_engine: 'idea-engine',
}

function relativeAge(iso: string | null): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  return `${Math.floor(days / 7)} weeks ago`
}

// Staged loading copy for the ~30s synthesis window. The thresholds add
// up to ~40s so a slightly slow Flash call doesn't hit the last stage
// suspiciously early. Each stage names what the model is roughly doing
// at that point so the wait feels intentional, not broken.
const LOADING_STAGES: Array<{ at_ms: number; line: string }> = [
  { at_ms: 0,      line: 'reading your captures' },
  { at_ms: 6_000,  line: 'connecting voice notes to lists' },
  { at_ms: 12_000, line: 'looking at dormant projects' },
  { at_ms: 18_000, line: 'drafting candidate projects' },
  { at_ms: 26_000, line: 'critiquing for clichés' },
  { at_ms: 34_000, line: 'picking the strongest three' },
]

export function ProjectIdeasHome() {
  const [ideas, setIdeas] = useState<ProjectIdea[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [hasAny, setHasAny] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [showEvidence, setShowEvidence] = useState(false)
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null)
  const [loadingStage, setLoadingStage] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('utilities?resource=project-ideas') as ProjectIdeasResponse
      setIdeas(res.ideas ?? [])
      setGeneratedAt(res.generated_at)
      setHasAny(res.has_any)
      setActiveIdx(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ideas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Advance the loading-stage copy while a generation is in flight. Stages
  // are time-anchored to the start of `generating`; on completion the
  // stage resets so the next run starts fresh.
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

  // Reset the evidence drawer whenever the active idea changes — without
  // this, switching slides while evidence is open animates two layouts at
  // once and looks janky on slow devices (notably Capacitor Android).
  useEffect(() => { setShowEvidence(false) }, [activeIdx])

  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setError(null)
    haptic.medium()
    try {
      // Pro synthesis call routinely runs ~30-50s. apiClient default is
      // 30s; bump to 80s so the browser doesn't abort while the server
      // is still finishing.
      const res = await api.post(
        'utilities?resource=generate-project-ideas',
        {},
        { timeout: 80_000 },
      ) as GenerateResponse
      if (!res.ideas || res.ideas.length === 0) {
        if (res.reason === 'insufficient_data') {
          const have = typeof res.signal_count === 'number' ? res.signal_count : 0
          setError(`You have ${have} captured signal${have === 1 ? '' : 's'} — the synthesiser needs at least 8 to find patterns. Add a few voice notes or list items and try again.`)
        } else {
          setError('The synthesiser didn\'t find anything strong. Try again in a moment.')
        }
        return
      }
      await load()
    } catch (err) {
      // The apiClient throws ApiError with .status === 429 on cooldown.
      const e = err as { status?: number; message?: string; details?: { retry_after_ms?: number; message?: string } }
      if (e?.status === 429) {
        const retryS = Math.ceil((e.details?.retry_after_ms ?? 60_000) / 1000)
        setError(e.details?.message ?? `Just generated — try again in ~${retryS}s.`)
      } else {
        setError(err instanceof Error ? err.message : 'Generation failed')
      }
    } finally {
      setGenerating(false)
    }
  }, [generating, load])

  const sendFeedback = useCallback(async (idea: ProjectIdea, status: 'saved' | 'rejected' | 'built' | 'pending') => {
    if (pendingFeedback === idea.id) return
    setPendingFeedback(idea.id)
    haptic.medium()
    try {
      await api.post('utilities?resource=project-ideas-feedback', { id: idea.id, status })
      if (status === 'rejected') {
        // Drop locally and advance the carousel.
        setIdeas(prev => {
          const next = prev.filter(i => i.id !== idea.id)
          if (activeIdx >= next.length && next.length > 0) setActiveIdx(next.length - 1)
          return next
        })
      } else {
        setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status } : i))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save feedback')
    } finally {
      setPendingFeedback(null)
    }
  }, [activeIdx, pendingFeedback])

  const active = ideas[activeIdx] ?? null
  const total = ideas.length
  const evidenceCount = useMemo(() => active?.evidence?.length ?? 0, [active])

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-6 px-1">
        <h2
          className="text-[10px] uppercase tracking-[0.32em] italic"
          style={{ color: 'var(--brand-text-muted)', fontWeight: 400 }}
        >
          ideas for you
        </h2>
        <div className="flex items-center gap-3">
          {generatedAt && (
            <span
              className="text-[10px] tracking-[0.18em] uppercase opacity-50"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              {relativeAge(generatedAt)}
            </span>
          )}
          {ideas.length > 0 && (
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase opacity-50 hover:opacity-90 transition-opacity disabled:opacity-30"
              style={{ color: 'var(--brand-text-muted)' }}
              title="Refresh deck"
              aria-busy={generating}
            >
              <RotateCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="relative px-2 sm:px-6 py-8 sm:py-10 min-h-[260px]">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <span
              className="text-[11px] uppercase tracking-[0.28em] italic"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              reading your data…
            </span>
          </div>
        )}

        {!loading && !ideas.length && !generating && (
          <div className="text-center max-w-md mx-auto py-6">
            <p
              className="leading-relaxed italic mb-6"
              style={{ color: 'var(--brand-text-muted)', fontSize: '14px' }}
            >
              {hasAny
                ? 'You\'ve cleared the deck. Generate a fresh batch when you\'re ready.'
                : 'No ideas yet. The system reads across your captures, dormant projects, and reading queue, then proposes three projects only you could make.'}
            </p>
            <button
              type="button"
              onClick={generate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full transition-all"
              style={{
                background: 'rgba(var(--brand-primary-rgb), 0.15)',
                color: 'rgb(var(--brand-primary-rgb))',
                border: '1px solid rgba(var(--brand-primary-rgb), 0.4)',
              }}
            >
              <span className="text-sm tracking-wide">show me ideas</span>
            </button>
            {error && (
              <p className="text-xs mt-4 italic" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>
            )}
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {/* Slow shimmer rule — visual anchor while we wait. The
                background gradient cycles ~3s and the rule itself is
                offset to feel like a wave rolling across the surface. */}
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

            {/* Cross-fade the staged copy as elapsed time crosses each
                threshold. The list of stages is defined alongside the
                component so it's easy to tune. */}
            <div className="relative h-6 mb-2 w-full max-w-xs">
              <AnimatePresence mode="wait">
                <motion.p
                  key={loadingStage}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-0 text-[12px] uppercase tracking-[0.22em] italic"
                  style={{ color: 'var(--brand-text-muted)' }}
                >
                  {LOADING_STAGES[loadingStage]?.line ?? LOADING_STAGES[0].line}…
                </motion.p>
              </AnimatePresence>
            </div>

            <p
              className="text-[10px] tracking-[0.16em] uppercase mt-1 opacity-50"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              ~30 seconds — synthesis is deep
            </p>
          </div>
        )}

        {!loading && !generating && active && (
          <div className="max-w-xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.article
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="flex items-baseline justify-between mb-4">
                  <span
                    className="text-[10px] tracking-[0.32em] uppercase opacity-60"
                    style={{ color: 'var(--brand-text-muted)' }}
                  >
                    idea {active.rank} of {total}
                  </span>
                  {active.status !== 'pending' && (
                    <span
                      className="text-[10px] tracking-[0.22em] uppercase"
                      style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                    >
                      {active.status}
                    </span>
                  )}
                </div>

                <h3
                  className="text-[22px] sm:text-[26px] leading-tight mb-4"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
                    fontWeight: 500,
                  }}
                >
                  {active.title}
                </h3>

                <p
                  className="text-[15px] sm:text-[16px] leading-[1.6] mb-5"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
                  }}
                >
                  {active.pitch}
                </p>

                <div
                  className="text-[13px] leading-snug mb-5 italic"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  <span className="opacity-60 mr-1.5">why now —</span>
                  {active.why_now}
                </div>

                <div
                  className="rounded-xl p-4 mb-5"
                  style={{
                    background: 'var(--glass-surface)',
                    border: '1px solid rgba(var(--brand-primary-rgb), 0.18)',
                  }}
                >
                  <div
                    className="text-[10px] tracking-[0.22em] uppercase opacity-70 mb-1.5"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  >
                    next step
                  </div>
                  <div
                    className="text-[14px] leading-snug"
                    style={{ color: 'var(--brand-text-primary)' }}
                  >
                    {active.next_step}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEvidence(s => !s)}
                  className="text-[10px] tracking-[0.22em] uppercase opacity-50 hover:opacity-90 transition-opacity"
                  style={{ color: 'var(--brand-text-muted)' }}
                >
                  {showEvidence ? 'hide receipts' : `from ${evidenceCount} signals in your data`}
                </button>

                <AnimatePresence>
                  {showEvidence && (
                    <motion.ul
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-4 space-y-2 overflow-hidden"
                    >
                      {(active.evidence ?? []).map((e, i) => (
                        <li
                          key={`${e.source_id}-${i}`}
                          className="text-[12px] leading-snug"
                          style={{ color: 'var(--brand-text-muted)' }}
                        >
                          <span className="opacity-60 italic">
                            {KIND_LABEL[e.kind] ?? e.kind} · {e.label}{e.date ? ` · ${e.date}` : ''}
                          </span>
                          {e.excerpt && (
                            <span
                              className="block opacity-80 mt-0.5"
                              style={{ fontStyle: 'italic' }}
                            >
                              "{e.excerpt}"
                            </span>
                          )}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>

                <div className="mt-7 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      className="h-9 w-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 hover:bg-[var(--glass-surface)]"
                      style={{ color: 'var(--brand-text-muted)' }}
                      aria-label="Previous idea"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i => Math.min(total - 1, i + 1))}
                      disabled={activeIdx >= total - 1}
                      className="h-9 w-9 rounded-full flex items-center justify-center transition-opacity disabled:opacity-20 hover:bg-[var(--glass-surface)]"
                      style={{ color: 'var(--brand-text-muted)' }}
                      aria-label="Next idea"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => sendFeedback(active, 'rejected')}
                      disabled={pendingFeedback === active.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-opacity opacity-50 hover:opacity-100 disabled:opacity-30"
                      style={{ color: 'var(--brand-text-muted)' }}
                      title="Not for me"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>not for me</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendFeedback(active, active.status === 'saved' ? 'pending' : 'saved')}
                      disabled={pendingFeedback === active.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-all"
                      style={{
                        color: active.status === 'saved' ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
                        background: active.status === 'saved' ? 'rgba(var(--brand-primary-rgb), 0.12)' : 'transparent',
                      }}
                      title={active.status === 'saved' ? 'Unsave' : 'Save for later'}
                    >
                      {active.status === 'saved' ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                      <span>{active.status === 'saved' ? 'saved' : 'save'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => sendFeedback(active, 'built')}
                      disabled={pendingFeedback === active.id || active.status === 'built'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-all"
                      style={{
                        color: active.status === 'built' ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
                        background: active.status === 'built' ? 'rgba(var(--brand-primary-rgb), 0.12)' : 'transparent',
                      }}
                      title="I'm building it"
                    >
                      <Hammer className="h-3.5 w-3.5" />
                      <span>{active.status === 'built' ? 'building' : 'building it'}</span>
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-xs mt-4 italic text-center" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>
                )}
              </motion.article>
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  )
}
