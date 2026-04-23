/**
 * SelfModelHome — the home "reveal" surface.
 *
 * Fetches /api/utilities?resource=self-model, which finds 3–5 things the user
 * has captured across voice notes, list items, and project ideas that all
 * land on the same underlying thing (the "middle of the Venn"). Quotes are
 * verbatim fragments of what the user actually said — the wow comes from
 * seeing yourself quoted back.
 *
 * First load runs with full reveal theatre; subsequent loads in the same
 * session skip the stagger. Cached locally for 2h so returning to the
 * surface is instant. Refresh / argue both pass the current source_ids as
 * exclude_ids so tapping "refresh" or "wrong read" actually surfaces a
 * *different* convergence instead of re-serving the same cluster.
 *
 * Falls back to "single" mode (one quote + move) when there isn't enough
 * cross-surface signal for a convergence. Off by default — opt in via
 * ?self=1, Settings, or localStorage('polymath-self-model', '1').
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, MessageSquareWarning, RefreshCw } from 'lucide-react'
import { haptic } from '../../utils/haptics'

type SignalKind = 'memory' | 'list_item' | 'project'

interface Quote {
  quote: string
  date: string
  source_id: string
  kind: SignalKind
  source_label?: string
}

interface SelfModel {
  mode: 'convergence' | 'single'
  convergence?: { quotes: Quote[]; connection: string }
  single?: Quote
  move: { action: string; why: string; artefact: string }
}

interface Sources {
  projects: number
  memories: number
  list_items: number
  signals_with_embedding: number
  convergence_size: number
}

interface ApiResponse {
  sources: Sources
  model: SelfModel | null
  reason?: string
  source_ids?: string[]
  relaxed_excludes?: boolean
  took_ms: number
}

interface SelfModelHomeProps {
  onShapeIdea: (idea: { title: string; description: string }) => void
}

const CACHE_KEY = 'polymath-selfmodel-v2'
const CACHE_TTL_MS = 2 * 60 * 60 * 1000
const SEEN_KEY = 'polymath-self-model-seen'

const TICKER_STEPS = [
  (s: Sources) => `reading ${s.memories} voice notes`,
  (s: Sources) => `scanning ${s.list_items} list items`,
  (s: Sources) => `scanning ${s.projects} project ideas`,
  () => 'finding what they share',
  () => 'picking today\'s move',
]

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  const months = Math.floor(days / 30)
  return months === 1 ? 'a month ago' : `${months} months ago`
}

function readCache(): { cached_at: number; response: ApiResponse } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { cached_at: number; response: ApiResponse }
    if (!parsed?.cached_at || Date.now() - parsed.cached_at > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(response: ApiResponse) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cached_at: Date.now(), response }))
  } catch {
    // storage full / disabled — no big deal, we'll just refetch next time
  }
}

function emptyStateCopy(sources: Sources | null): string {
  if (!sources || (sources.memories === 0 && sources.list_items === 0 && sources.projects === 0)) {
    return 'No signal yet. Record a voice note, jot a list item, or sketch a project — then check back.'
  }
  if (sources.memories === 0 && sources.list_items > 0) {
    return 'Plenty of list items, but your notes and projects aren\'t converging yet. A voice note or two would help.'
  }
  if (sources.signals_with_embedding < 3) {
    return 'Not enough captured yet for a convergence. A few more notes and this surface will start to hum.'
  }
  return 'Nothing\'s converging on the same thread today. Try again in a day or two once more signal lands.'
}

export function SelfModelHome({ onShapeIdea }: SelfModelHomeProps) {
  const firstLoadRef = useRef(true)
  // Prime from cache immediately so the surface feels instant on repeat opens.
  const initialCache = typeof window !== 'undefined' ? readCache() : null
  const [loading, setLoading] = useState(!initialCache)
  const [data, setData] = useState<ApiResponse | null>(initialCache?.response ?? null)
  const [fromCache, setFromCache] = useState(!!initialCache)
  const [error, setError] = useState<string | null>(null)
  const [tickerIdx, setTickerIdx] = useState(0)
  const [arguing, setArguing] = useState(false)
  const [critique, setCritique] = useState('')
  const [submittingCritique, setSubmittingCritique] = useState(false)
  const [todoState, setTodoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const abortRef = useRef<AbortController | null>(null)

  // First-time theatre vs. minimal stagger on repeat. sessionStorage so it
  // persists across refreshes within a session but not across tab closes.
  const [firstTime] = useState(() => {
    if (typeof window === 'undefined') return true
    const seen = window.sessionStorage.getItem(SEEN_KEY)
    return !seen
  })

  const fetchModel = useCallback(async (
    mode: 'generate' | 'argue' = 'generate',
    opts: { critiqueText?: string; excludeIds?: string[]; previous?: SelfModel | null } = {},
  ) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { mode }
      if (opts.excludeIds?.length) body.exclude_ids = opts.excludeIds
      if (mode === 'argue') {
        body.previous = opts.previous
        body.critique = opts.critiqueText
      }
      const res = await fetch('/api/utilities?resource=self-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        setError(txt || `Failed (${res.status})`)
        return
      }
      const json = (await res.json()) as ApiResponse
      setData(json)
      setFromCache(false)
      setTodoState('idle')
      writeCache(json)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch: only if we didn't hydrate from cache. If we did, the user
  // sees the cached card instantly and can tap refresh for fresh content.
  useEffect(() => {
    if (!initialCache) fetchModel('generate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mark first-time seen once a model has been shown.
  useEffect(() => {
    if (data?.model && firstTime) {
      try { window.sessionStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ }
    }
  }, [data?.model, firstTime])

  useEffect(() => {
    if (!loading) return
    setTickerIdx(0)
    const id = window.setInterval(() => {
      setTickerIdx(i => (i + 1) % TICKER_STEPS.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [loading])

  const model = data?.model ?? null
  const sources = data?.sources ?? null
  const currentSourceIds = useMemo(() => data?.source_ids ?? [], [data?.source_ids])

  const handleRefresh = useCallback(() => {
    haptic.light()
    fetchModel('generate', { excludeIds: currentSourceIds })
  }, [fetchModel, currentSourceIds])

  const handleArgueSubmit = useCallback(async () => {
    if (!critique.trim() || submittingCritique) return
    setSubmittingCritique(true)
    haptic.medium()
    try {
      await fetchModel('argue', {
        critiqueText: critique.trim(),
        excludeIds: currentSourceIds,
        previous: model,
      })
      setCritique('')
      setArguing(false)
    } finally {
      setSubmittingCritique(false)
    }
  }, [critique, submittingCritique, fetchModel, currentSourceIds, model])

  const handleAddToToday = useCallback(async () => {
    if (!model || todoState === 'saving' || todoState === 'saved') return
    haptic.medium()
    setTodoState('saving')
    try {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      const scheduled_date = `${year}-${month}-${day}`
      const notes = [
        model.move.why && `Why: ${model.move.why}`,
        model.move.artefact && `By tonight: ${model.move.artefact}`,
      ].filter(Boolean).join('\n\n')
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: model.move.action,
          notes: notes || null,
          scheduled_date,
          estimated_minutes: 60,
        }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed'))
      setTodoState('saved')
      haptic.success?.()
    } catch {
      setTodoState('error')
    }
  }, [model, todoState])

  const handleShapeAsIdea = useCallback(() => {
    if (!model) return
    haptic.light()
    onShapeIdea({
      title: model.move.action,
      description: `${model.move.why}\n\nWhen you're done: ${model.move.artefact}`,
    })
  }, [model, onShapeIdea])

  // Reveal timings — full theatre first time, quick on repeat.
  const stagger = firstTime && !fromCache ? 0.5 : 0.08
  const firstDelay = firstTime && !fromCache ? 0.15 : 0

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary/80">
          today · experimental
        </h2>
        {model && !loading && (
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-[var(--brand-text-muted)] hover:text-brand-primary transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            refresh
          </button>
        )}
      </div>

      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.14) 0%, rgba(15,24,41,0.75) 60%)',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
          boxShadow: '0 0 40px rgba(var(--brand-primary-rgb),0.08), 0 8px 40px -12px rgba(0,0,0,0.55)',
          minHeight: '340px',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.5), transparent)' }}
        />

        {loading && !model && (
          <div className="flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary" />
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={tickerIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-[11px] font-mono uppercase tracking-widest text-brand-primary/90"
              >
                {TICKER_STEPS[tickerIdx](sources ?? { projects: 0, memories: 0, list_items: 0, signals_with_embedding: 0, convergence_size: 0 })}…
              </motion.span>
            </AnimatePresence>
          </div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-300">
            <p className="mb-2">Couldn't read the signal right now.</p>
            <p className="text-xs opacity-70">{error}</p>
            <button
              type="button"
              onClick={() => fetchModel('generate')}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && !model && (
          <div className="text-sm text-[var(--brand-text-secondary)]">
            {emptyStateCopy(sources)}
          </div>
        )}

        {model && (
          <div className="space-y-5">
            {model.mode === 'convergence' && model.convergence && (
              <Convergence
                convergence={model.convergence}
                stagger={stagger}
                firstDelay={firstDelay}
              />
            )}

            {model.mode === 'single' && model.single && (
              <Single single={model.single} />
            )}

            <MoveCard
              move={model.move}
              delay={model.mode === 'convergence' && model.convergence
                ? firstDelay + stagger * (model.convergence.quotes.length + 1) + 0.1
                : firstDelay + 0.3}
              todoState={todoState}
              onAddToToday={handleAddToToday}
              onShapeAsIdea={handleShapeAsIdea}
            />

            <div className="pt-2 border-t border-[var(--glass-border)]">
              {!arguing ? (
                <button
                  type="button"
                  onClick={() => setArguing(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-text-muted)] hover:text-brand-primary transition-colors"
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Wrong read — try again
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-primary/80">
                    what did I miss?
                  </label>
                  <textarea
                    value={critique}
                    onChange={e => setCritique(e.target.value)}
                    placeholder="e.g. the quotes are right but the move is off — I don't want to ship, I want to think"
                    className="w-full min-h-[80px] p-3 text-sm rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-muted)] focus:border-brand-primary/50 focus:outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleArgueSubmit}
                      disabled={!critique.trim() || submittingCritique}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {submittingCritique ? 'Re-reading…' : 'Re-read'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setArguing(false); setCritique('') }}
                      className="text-xs font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function Convergence({
  convergence,
  stagger,
  firstDelay,
}: {
  convergence: { quotes: Quote[]; connection: string }
  stagger: number
  firstDelay: number
}) {
  const { quotes, connection } = convergence
  return (
    <div className="space-y-4">
      <p
        className="text-[10px] font-bold tracking-[0.2em] uppercase"
        style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
      >
        {quotes.length} things on your mind
      </p>
      <div className="space-y-4">
        {quotes.map((q, i) => (
          <motion.div
            key={`${q.kind}-${q.source_id}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: firstDelay + i * stagger, duration: Math.max(0.25, stagger), ease: 'easeOut' }}
            className="relative pl-4"
          >
            <span
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.45)' }}
            />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text-muted)] mb-1">
              {q.source_label ?? q.kind} · {relativeDate(q.date)}
            </p>
            <p className="text-[15px] leading-snug text-[var(--brand-text-primary)] italic">
              “{q.quote}”
            </p>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: firstDelay + quotes.length * stagger, duration: 0.4 }}
        className="pt-2"
      >
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
          style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
        >
          what they share
        </p>
        <p className="text-lg sm:text-xl font-bold leading-snug text-[var(--brand-text-primary)] aperture-header">
          {connection}
        </p>
      </motion.div>
    </div>
  )
}

function Single({ single }: { single: Quote }) {
  return (
    <div className="space-y-3">
      <p
        className="text-[10px] font-bold tracking-[0.2em] uppercase"
        style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
      >
        {single.source_label ?? single.kind} · {relativeDate(single.date)}
      </p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-lg sm:text-xl font-semibold leading-snug text-[var(--brand-text-primary)] italic"
      >
        “{single.quote}”
      </motion.p>
    </div>
  )
}

function MoveCard({
  move,
  delay,
  todoState,
  onAddToToday,
  onShapeAsIdea,
}: {
  move: { action: string; why: string; artefact: string }
  delay: number
  todoState: 'idle' | 'saving' | 'saved' | 'error'
  onAddToToday: () => void
  onShapeAsIdea: () => void
}) {
  const buttonLabel =
    todoState === 'saving' ? 'Adding…' :
    todoState === 'saved' ? 'Added to today' :
    todoState === 'error' ? 'Try again' :
    'Add to today'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
      className="p-4 rounded-xl"
      style={{
        background: 'rgba(var(--brand-primary-rgb),0.12)',
        border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
      }}
    >
      <p
        className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
        style={{ color: 'var(--brand-primary)', opacity: 0.8 }}
      >
        today
      </p>
      <p className="text-base font-semibold text-[var(--brand-text-primary)] leading-snug mb-2">
        {move.action}
      </p>
      {move.why && (
        <p className="text-xs text-[var(--brand-text-secondary)] opacity-80 mb-2">
          {move.why}
        </p>
      )}
      {move.artefact && (
        <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-70">
          by tonight: <span className="italic">{move.artefact}</span>
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onAddToToday}
          disabled={todoState === 'saving' || todoState === 'saved'}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-70 transition-colors"
        >
          {todoState === 'saved' ? <Check className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
          {buttonLabel}
        </button>
        <button
          type="button"
          onClick={onShapeAsIdea}
          className="text-[11px] font-medium text-[var(--brand-text-muted)] hover:text-brand-primary transition-colors underline underline-offset-2 decoration-dotted"
        >
          shape as an idea instead
        </button>
      </div>
    </motion.div>
  )
}
