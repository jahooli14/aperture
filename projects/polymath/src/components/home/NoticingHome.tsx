/**
 * NoticingHome — the home "witness" surface.
 *
 * The previous incarnation of this surface ("self-model") read converging
 * voice notes and handed back a 30-minute chore. That's a productivity card,
 * not a witness. This rewrite drops the chore framing entirely. The output
 * is a *noticing*: 2–3 short sentences a third agent has carefully written,
 * holding the user's through-line and handing it back with the dates intact.
 *
 * Three rules govern this component:
 *   - The voice is a witness, not an advisor. No imperative CTAs. No "Add
 *     to today". No timer. No artefact noun. The user is the agent — we
 *     observe and offer.
 *   - Re-reading is a feature. The server returns yesterday's noticing if
 *     it's under ~18h old. Refresh is small and unloved.
 *   - Silence is acceptable. If the pipeline can't produce a clean noticing
 *     and we have no recent stored one, the surface stays quiet rather than
 *     showing a generic chore.
 *
 * The "receipts" (which captures the noticing was grounded in) are visible
 * in a small attribution row beneath — the user can tap to expand and see
 * the original dates and labels. This is part of the magic: you can see
 * exactly what was noticed, in your own data.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkPlus, BookmarkCheck, MessageSquareWarning, RefreshCw } from 'lucide-react'
import { haptic } from '../../utils/haptics'

type SignalKind = 'memory' | 'list_item' | 'project'
type NoticingShape = 'observation' | 'commission'

interface NoticingSource {
  kind: SignalKind
  source_id: string
  label: string
  date: string
  excerpt?: string
}

interface Noticing {
  id: string | null
  lines: string[]
  shape: NoticingShape
  sources: NoticingSource[]
  saved: boolean
  served_at: string
  saved_at?: string | null
}

interface SourcesSeen {
  memories: number
  list_items: number
  projects: number
  total: number
}

interface ApiResponse {
  noticing: Noticing | null
  resumed?: boolean
  reason?: 'no_signal' | 'no_candidate' | 'no_voice'
  sources_seen?: SourcesSeen
  attempts?: number
  took_ms: number
}

const CACHE_KEY = 'polymath-noticing-v1'
const CACHE_TTL_MS = 18 * 60 * 60 * 1000

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
    // storage full / disabled — fine
  }
}

function emptyCopy(sources: SourcesSeen | undefined, reason: ApiResponse['reason']): string {
  if (!sources || sources.total === 0) {
    return 'Nothing here yet. Talk to me a few times — voice notes, list items, project sketches — and the surface will start to read you back.'
  }
  if (reason === 'no_candidate' || reason === 'no_voice') {
    return 'Quiet today. Nothing landed strongly enough to put in front of you. Sometimes that means the pattern is still forming.'
  }
  return 'Quiet for now. Try again in a day or two.'
}

export function NoticingHome() {
  const initialCache = typeof window !== 'undefined' ? readCache() : null
  const [data, setData] = useState<ApiResponse | null>(initialCache?.response ?? null)
  const [loading, setLoading] = useState(!initialCache)
  const [error, setError] = useState<string | null>(null)
  const [arguing, setArguing] = useState(false)
  const [critique, setCritique] = useState('')
  const [submittingCritique, setSubmittingCritique] = useState(false)
  const [showSources, setShowSources] = useState(false)
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const abortRef = useRef<AbortController | null>(null)

  const fetchNoticing = useCallback(async (
    mode: 'fresh' | 'resume',
    opts: { critiqueText?: string; excludeKeys?: string[] } = {},
  ) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { mode }
      if (opts.excludeKeys?.length) body.exclude_keys = opts.excludeKeys
      if (opts.critiqueText) body.critique = opts.critiqueText
      const res = await fetch('/api/utilities?resource=noticing', {
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
      setSavingState(json.noticing?.saved ? 'saved' : 'idle')
      writeCache(json)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch — resume mode pulls yesterday's noticing if young enough.
  useEffect(() => {
    if (!initialCache) fetchNoticing('resume')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const noticing = data?.noticing ?? null
  const sourceKeys = useMemo(
    () => noticing?.sources?.map(s => `${s.kind}:${s.source_id}`) ?? [],
    [noticing?.sources],
  )

  const handleRefresh = useCallback(() => {
    haptic.light()
    setShowSources(false)
    fetchNoticing('fresh', { excludeKeys: sourceKeys })
  }, [fetchNoticing, sourceKeys])

  const handleArgueSubmit = useCallback(async () => {
    if (!critique.trim() || submittingCritique) return
    setSubmittingCritique(true)
    haptic.medium()
    try {
      await fetchNoticing('fresh', {
        critiqueText: critique.trim(),
        excludeKeys: sourceKeys,
      })
      setCritique('')
      setArguing(false)
    } finally {
      setSubmittingCritique(false)
    }
  }, [critique, submittingCritique, fetchNoticing, sourceKeys])

  const handleSave = useCallback(async () => {
    if (!noticing?.id || savingState !== 'idle') return
    haptic.medium()
    setSavingState('saving')
    try {
      const res = await fetch('/api/utilities?resource=noticing-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noticing.id, saved: true }),
      })
      if (!res.ok) throw new Error('save failed')
      setSavingState('saved')
      // Update local data so the icon stays filled.
      if (data) {
        const next: ApiResponse = { ...data, noticing: { ...noticing, saved: true, saved_at: new Date().toISOString() } }
        setData(next)
        writeCache(next)
      }
    } catch {
      setSavingState('idle')
    }
  }, [noticing, savingState, data])

  return (
    <section className="relative">
      <div className="flex items-center justify-between mb-6 px-1">
        <h2
          className="text-[10px] uppercase tracking-[0.32em] italic"
          style={{ color: 'var(--brand-text-muted)', fontWeight: 400 }}
        >
          noticed
        </h2>
        {noticing && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[10px] tracking-[0.18em] uppercase opacity-50 hover:opacity-90 transition-opacity disabled:opacity-30"
            style={{ color: 'var(--brand-text-muted)' }}
            aria-busy={loading}
            title="Read again"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="relative px-2 sm:px-6 py-8 sm:py-10 min-h-[220px]">
        {loading && !noticing && (
          <div className="flex items-center justify-center py-10">
            <span
              className="text-[11px] uppercase tracking-[0.28em] italic"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              listening…
            </span>
          </div>
        )}

        {!loading && error && !noticing && (
          <div className="text-center text-sm" style={{ color: 'var(--brand-text-secondary)' }}>
            <p className="mb-3 italic">Couldn't read the signal right now.</p>
            <button
              type="button"
              onClick={() => fetchNoticing('resume')}
              className="text-xs underline underline-offset-4 hover:opacity-80"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              try again
            </button>
          </div>
        )}

        {!loading && !error && !noticing && (
          <p
            className="text-center max-w-md mx-auto leading-relaxed italic"
            style={{ color: 'var(--brand-text-muted)', fontSize: '14px' }}
          >
            {emptyCopy(data?.sources_seen, data?.reason)}
          </p>
        )}

        {noticing && (
          <div className={`transition-opacity duration-300 ${loading ? 'opacity-30' : 'opacity-100'}`}>
            <div className="max-w-xl mx-auto space-y-5">
              {noticing.lines.map((line, i) => (
                <motion.p
                  key={`${noticing.id ?? 'transient'}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.18, duration: 0.5, ease: 'easeOut' }}
                  className="text-[17px] sm:text-[18px] leading-[1.55]"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
                    fontWeight: 400,
                  }}
                >
                  {line}
                </motion.p>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + noticing.lines.length * 0.18, duration: 0.6 }}
              className="mt-8 flex items-center justify-between gap-4 max-w-xl mx-auto"
            >
              <button
                type="button"
                onClick={() => setShowSources(s => !s)}
                className="text-[10px] tracking-[0.22em] uppercase opacity-50 hover:opacity-90 transition-opacity"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                {showSources ? 'hide sources' : `from ${noticing.sources.length} ${noticing.sources.length === 1 ? 'capture' : 'captures'}`}
              </button>

              <div className="flex items-center gap-3">
                {noticing.id && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={savingState !== 'idle'}
                    className="opacity-50 hover:opacity-100 transition-opacity disabled:cursor-default"
                    style={{ color: savingState === 'saved' ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)' }}
                    title={savingState === 'saved' ? 'Saved to your thread' : 'Save to your thread'}
                  >
                    {savingState === 'saved' ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </motion.div>

            <AnimatePresence>
              {showSources && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-5 space-y-2 max-w-xl mx-auto overflow-hidden"
                >
                  {noticing.sources.map((s, i) => (
                    <li
                      key={`${s.kind}-${s.source_id}-${i}`}
                      className="text-[11px] leading-snug"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      <span className="opacity-60 italic">{s.label} · {relativeDate(s.date)}</span>
                      {s.excerpt && (
                        <span className="block opacity-80 mt-0.5">"{s.excerpt}"</span>
                      )}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>

            <div className="mt-8 max-w-xl mx-auto text-center">
              {!arguing ? (
                <button
                  type="button"
                  onClick={() => setArguing(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] opacity-40 hover:opacity-90 transition-opacity"
                  style={{ color: 'var(--brand-text-muted)' }}
                >
                  <MessageSquareWarning className="h-3 w-3" />
                  doesn't read true
                </button>
              ) : (
                <div className="space-y-2 text-left">
                  <textarea
                    value={critique}
                    onChange={e => setCritique(e.target.value)}
                    placeholder="what's off?"
                    className="w-full min-h-[64px] p-3 text-sm rounded-lg bg-[var(--glass-surface)] border border-[var(--glass-border)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-muted)] focus:border-brand-primary/50 focus:outline-none resize-none italic"
                    style={{ fontFamily: 'Georgia, serif' }}
                    autoFocus
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleArgueSubmit}
                      disabled={!critique.trim() || submittingCritique}
                      className="text-[11px] tracking-[0.18em] uppercase opacity-70 hover:opacity-100 disabled:opacity-30 transition-opacity"
                      style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                    >
                      {submittingCritique ? 'reading again…' : 'read again'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setArguing(false); setCritique('') }}
                      className="text-[11px] opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading && noticing && (
          <div className="absolute top-2 right-2 text-[10px] uppercase tracking-[0.22em] opacity-60 italic" style={{ color: 'var(--brand-text-muted)' }}>
            listening…
          </div>
        )}
      </div>
    </section>
  )
}
