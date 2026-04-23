/**
 * SelfModelHome — the home "reveal" surface.
 *
 * Fetches /api/utilities?resource=self-model, which finds 3–5 things the user
 * said across time that converge on the same underlying thing (the "middle
 * of the Venn"). Each quote reveals in sequence, then the connection, then
 * the one move for today. Grounded entirely in the user's own words — the
 * quotes are verbatim fragments, so the wow comes from seeing yourself
 * quoted back.
 *
 * Falls back to "single" mode (one quote + move) when there isn't enough
 * signal for a convergence. Off by default — opt in via ?self=1, Settings,
 * or localStorage('polymath-self-model', '1').
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, MessageSquareWarning, RefreshCw } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface Quote {
  quote: string
  date: string
  memory_id: string
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
  memories_with_embedding: number
  convergence_size: number
}

interface ApiResponse {
  sources: Sources
  model: SelfModel | null
  reason?: string
  took_ms: number
}

interface SelfModelHomeProps {
  onShapeIdea: (idea: { title: string; description: string }) => void
}

const TICKER_STEPS = [
  (s: Sources) => `reading ${s.memories} memories`,
  (s: Sources) => `listening for repeats across ${s.memories_with_embedding} voice notes`,
  () => 'finding the middle of the Venn',
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

export function SelfModelHome({ onShapeIdea }: SelfModelHomeProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tickerIdx, setTickerIdx] = useState(0)
  const [arguing, setArguing] = useState(false)
  const [critique, setCritique] = useState('')
  const [submittingCritique, setSubmittingCritique] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchModel = useCallback(async (mode: 'generate' | 'argue' = 'generate', critiqueText = '') => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { mode }
      if (mode === 'argue') {
        body.previous = data?.model
        body.critique = critiqueText
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [data?.model])

  useEffect(() => {
    fetchModel('generate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) return
    setTickerIdx(0)
    const id = window.setInterval(() => {
      setTickerIdx(i => (i + 1) % TICKER_STEPS.length)
    }, 900)
    return () => window.clearInterval(id)
  }, [loading])

  const model = data?.model ?? null
  const sources = data?.sources ?? { projects: 0, memories: 0, memories_with_embedding: 0, convergence_size: 0 }

  const handleArgueSubmit = useCallback(async () => {
    if (!critique.trim() || submittingCritique) return
    setSubmittingCritique(true)
    haptic.medium()
    try {
      await fetchModel('argue', critique.trim())
      setCritique('')
      setArguing(false)
    } finally {
      setSubmittingCritique(false)
    }
  }, [critique, submittingCritique, fetchModel])

  const handleShapeMove = useCallback(() => {
    if (!model) return
    haptic.medium()
    onShapeIdea({
      title: model.move.action,
      description: `${model.move.why}\n\nWhen you're done: ${model.move.artefact}`,
    })
  }, [model, onShapeIdea])

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-primary/80">
          today · experimental
        </h2>
        {model && !loading && (
          <button
            type="button"
            onClick={() => fetchModel('generate')}
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

        {loading && (
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
                {TICKER_STEPS[tickerIdx](sources)}…
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

        {!loading && !error && !model && data?.reason === 'not-enough-signal' && (
          <div className="text-sm text-[var(--brand-text-secondary)]">
            Not enough voice notes yet. Record a few, then check back.
          </div>
        )}

        {!loading && model && (
          <div className="space-y-5">
            {model.mode === 'convergence' && model.convergence && (
              <Convergence convergence={model.convergence} />
            )}

            {model.mode === 'single' && model.single && (
              <Single single={model.single} />
            )}

            <MoveCard
              move={model.move}
              delay={model.mode === 'convergence' && model.convergence
                ? 0.4 + model.convergence.quotes.length * 0.5 + 0.5
                : 0.9}
              onShape={handleShapeMove}
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

function Convergence({ convergence }: { convergence: { quotes: Quote[]; connection: string } }) {
  const { quotes, connection } = convergence
  return (
    <div className="space-y-4">
      <p
        className="text-[10px] font-bold tracking-[0.2em] uppercase"
        style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
      >
        {quotes.length} things you said
      </p>
      <div className="space-y-4">
        {quotes.map((q, i) => (
          <motion.div
            key={`${q.memory_id}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.5, duration: 0.5, ease: 'easeOut' }}
            className="relative pl-4"
          >
            <span
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.45)' }}
            />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--brand-text-muted)] mb-1">
              {relativeDate(q.date)}
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
        transition={{ delay: 0.2 + quotes.length * 0.5, duration: 0.5 }}
        className="pt-2"
      >
        <p
          className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
          style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
        >
          the middle
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
        you said, {relativeDate(single.date)}
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
  onShape,
}: {
  move: { action: string; why: string; artefact: string }
  delay: number
  onShape: () => void
}) {
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
      <button
        type="button"
        onClick={onShape}
        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors"
      >
        Take it on
        <ArrowRight className="h-3 w-3" />
      </button>
    </motion.div>
  )
}
