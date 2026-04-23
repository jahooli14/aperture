/**
 * SelfModelHome — experimental homepage surface.
 *
 * Shows a ticker while /api/utilities?resource=self-model generates, then
 * reveals the Thesis (word-by-word), three Threads (latent questions), and a
 * single Move for today. "Argue with me" re-runs the model with the user's
 * critique. Off by default — opt in via ?self=1, Settings, or localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, MessageSquareWarning, RefreshCw } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface SelfModel {
  thesis: string
  threads: string[]
  move: { action: string; why: string; artefact: string }
}

interface Sources {
  projects: number
  memories: number
  articles: number
  list_items: number
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
  (s: Sources) => `scanning ${s.projects} active projects`,
  (s: Sources) => `following ${s.articles} reading threads`,
  (s: Sources) => `weighing ${s.list_items} open loops`,
  () => 'finding today\'s move',
]

function useWordReveal(text: string, delay = 28): string {
  const [shown, setShown] = useState('')
  useEffect(() => {
    if (!text) { setShown(''); return }
    setShown('')
    const words = text.split(/(\s+)/)
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setShown(words.slice(0, i).join(''))
      if (i >= words.length) window.clearInterval(id)
    }, delay)
    return () => window.clearInterval(id)
  }, [text, delay])
  return shown
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

  // Initial load
  useEffect(() => {
    fetchModel('generate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rotate the ticker while loading so the page visibly "thinks"
  useEffect(() => {
    if (!loading) return
    setTickerIdx(0)
    const id = window.setInterval(() => {
      setTickerIdx(i => (i + 1) % TICKER_STEPS.length)
    }, 700)
    return () => window.clearInterval(id)
  }, [loading])

  const model = data?.model ?? null
  const sources = data?.sources ?? { projects: 0, memories: 0, articles: 0, list_items: 0 }

  const thesisReveal = useWordReveal(model?.thesis ?? '')

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
          self-model · experimental
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
            <p className="mb-2">Couldn't build the model right now.</p>
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
            Not enough signal yet. Add a few voice notes and projects, then check back.
          </div>
        )}

        {!loading && model && (
          <div className="space-y-5">
            {/* Thesis */}
            <div>
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
                style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
              >
                the thesis
              </p>
              <p className="text-xl sm:text-2xl font-bold leading-tight text-[var(--brand-text-primary)] aperture-header">
                {thesisReveal}
                {thesisReveal.length < (model.thesis?.length ?? 0) && (
                  <span className="inline-block w-1.5 h-5 ml-1 align-middle bg-brand-primary animate-pulse" />
                )}
              </p>
            </div>

            {/* Threads */}
            {model.threads.length > 0 && (
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.2em] uppercase mb-2"
                  style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                >
                  threads
                </p>
                <div className="space-y-2">
                  {model.threads.map((q, i) => (
                    <motion.div
                      key={`${q}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.12, duration: 0.3 }}
                      className="p-3 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-border)]"
                    >
                      <p className="text-sm font-semibold text-[var(--brand-text-primary)] leading-snug">
                        {q}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Move */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.35 }}
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
                the move · today
              </p>
              <p className="text-base font-semibold text-[var(--brand-text-primary)] leading-snug mb-2">
                {model.move.action}
              </p>
              {model.move.why && (
                <p className="text-xs text-[var(--brand-text-secondary)] opacity-80 mb-2">
                  {model.move.why}
                </p>
              )}
              {model.move.artefact && (
                <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-70">
                  ↳ by tonight: <span className="italic">{model.move.artefact}</span>
                </p>
              )}
              <button
                type="button"
                onClick={handleShapeMove}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-brand-primary hover:bg-brand-primary/90 transition-colors"
              >
                Shape this move
                <ArrowRight className="h-3 w-3" />
              </button>
            </motion.div>

            {/* Argue */}
            <div className="pt-2 border-t border-[var(--glass-border)]">
              {!arguing ? (
                <button
                  type="button"
                  onClick={() => setArguing(true)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-text-muted)] hover:text-brand-primary transition-colors"
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Argue with me — this isn't right
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-primary/80">
                    what did I miss?
                  </label>
                  <textarea
                    value={critique}
                    onChange={e => setCritique(e.target.value)}
                    placeholder="e.g. the thesis is close but the move is wrong — I'm not ready to ship, I need to think"
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
                      {submittingCritique ? 'Re-modelling…' : 'Re-model'}
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
