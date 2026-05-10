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
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookmarkPlus, BookmarkCheck, X, Hammer, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
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
  /** 'crossover' for the locked-pairs / permissive paths (the default).
   *  'read' for the longitudinal pattern reader — the row also carries a
   *  non-empty `pattern` and the card leads with it as the hero block. */
  mode?: 'crossover' | 'read'
  pattern?: string | null
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
  retry_after_ms?: number
  message?: string
}

type IdeaMode = 'read' | 'new_idea' | 'forgotten' | 'reshape' | 'extend'

// Derive the visual mode. The DB-backed `mode='read'` always wins — Read
// is the longitudinal pattern reader and gets its own treatment regardless
// of evidence shape. Falling through to evidence-based derivation gives
// crossover its mode-specific glyph as before.
function deriveMode(idea: ProjectIdea): IdeaMode {
  if (idea.mode === 'read') return 'read'
  const kinds = (idea.evidence ?? []).map(e => e.kind)
  if (kinds.includes('project_dormant')) {
    // Try to determine dormancy depth from the evidence date
    const dormantEvidence = idea.evidence.find(e => e.kind === 'project_dormant')
    if (dormantEvidence?.date) {
      const weeks = (Date.now() - new Date(dormantEvidence.date).getTime()) / (7 * 24 * 3600 * 1000)
      return weeks >= 16 ? 'reshape' : 'forgotten'
    }
    return 'forgotten'
  }
  if (kinds.includes('project')) return 'extend'
  return 'new_idea'
}

// Each mode gets a glyph + accent so the card reads as correspondence FROM
// the harness, not a generic note. The glyphs are typographic ornaments
// (fleurons, dingbats); the accents are non-brand colours so the card
// feels distinct from the rest of the cyan UI without breaking the system.
//
// Read uses warm rose — distinct from the other modes (which trend cool),
// and signals "this is the wow line" before the user reads anything.
const MODE_VISUAL: Record<IdeaMode, { glyph: string; accentRgb: string; eyebrow: string }> = {
  read:      { glyph: '◉', accentRgb: '244, 114, 182', eyebrow: 'what i see across your work' }, // rose
  new_idea:  { glyph: '✦', accentRgb: '252, 211, 77',  eyebrow: 'a new idea taking shape' },     // amber
  forgotten: { glyph: '❋', accentRgb: '148, 163, 184', eyebrow: 'you set this down' },           // slate
  reshape:   { glyph: '◈', accentRgb: '167, 139, 250', eyebrow: 'a new angle' },                 // violet
  extend:    { glyph: '→', accentRgb: '56, 189, 248',  eyebrow: 'pick this up' },                // cyan
}

const KIND_LABEL: Record<string, string> = {
  memory: 'voice note',
  list_item: 'list',
  project: 'project',
  project_dormant: 'dormant project',
  reading: 'article',
  highlight: 'highlight',
  suggestion: 'idea',
  idea_engine: 'frontier idea',
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
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<ProjectIdea[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [hasAny, setHasAny] = useState(false)
  const [lastIdea, setLastIdea] = useState<ProjectIdea | null>(null)
  const [insufficientSignals, setInsufficientSignals] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEvidence, setShowEvidence] = useState(false)
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null)
  const [loadingStage, setLoadingStage] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('utilities?resource=project-ideas') as ProjectIdeasResponse
      const active = (res.ideas ?? []).slice(0, 3)
      setIdeas(active)
      setActiveIndex(0)
      if (active[0]) setLastIdea(active[0])
      setGeneratedAt(res.generated_at)
      setHasAny(res.has_any)
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
  useEffect(() => { setShowEvidence(false) }, [ideas])

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
          setInsufficientSignals(have)
        } else {
          setError('Nothing ripe this week. Keep capturing and check back in a few days.')
        }
        return
      }
      setInsufficientSignals(null)
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
        // Advance to the next idea in the local array if any remain.
        // Clearing the deck only triggers when the user dismisses the last idea.
        setIdeas(prev => {
          const next = prev.filter(i => i.id !== idea.id)
          return next
        })
        setActiveIndex(0)
      } else if (status === 'built') {
        // Navigate to a pre-filled new project page so the user can
        // immediately start building what they just committed to. For
        // Read, lead the description with the pattern — that's the line
        // worth keeping in the project's own context as a reminder of
        // why this one is the right one.
        const description = idea.mode === 'read' && idea.pattern
          ? `${idea.pattern}\n\n${idea.pitch}`
          : idea.pitch
        const params = new URLSearchParams({
          title: idea.title,
          description,
          first_task: idea.next_step,
          from_idea: idea.id,
        })
        navigate(`/projects?create=1&${params.toString()}`)
      } else {
        setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status } : i))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save feedback')
    } finally {
      setPendingFeedback(null)
    }
  }, [pendingFeedback, navigate])

  const active = ideas[activeIndex] ?? null
  const evidenceCount = useMemo(() => active?.evidence?.length ?? 0, [active])
  const mode = useMemo(() => active ? deriveMode(active) : null, [active])
  const goPrev = useCallback(() => {
    haptic.light()
    setActiveIndex(i => Math.max(0, i - 1))
  }, [])
  const goNext = useCallback(() => {
    haptic.light()
    setActiveIndex(i => Math.min(ideas.length - 1, i + 1))
  }, [ideas.length])

  return (
    <section className="relative">
      <div className="max-w-2xl mx-auto flex items-center justify-end gap-3 mb-4 px-1 min-h-[28px]">
        <div className="flex items-center gap-3">
          {ideas.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goPrev}
                disabled={activeIndex === 0}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--brand-text-muted)' }}
                aria-label="Previous idea"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span
                className="text-[10px] tracking-[0.22em] uppercase opacity-60 tabular-nums"
                style={{ color: 'var(--brand-text-muted)' }}
              >
                {activeIndex + 1} / {ideas.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={activeIndex >= ideas.length - 1}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: 'var(--brand-text-muted)' }}
                aria-label="Next idea"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {generatedAt && (
            <span
              className="text-[10px] tracking-[0.22em] uppercase opacity-50"
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
              className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
              style={{ color: 'var(--brand-text-muted)' }}
              aria-busy={generating}
            >
              <RefreshCw className={`h-3 w-3 ${generating ? 'animate-spin' : ''}`} />
              <span>try another</span>
            </button>
          )}
        </div>
      </div>

      {/* Container collapses tightly when empty — only the generating
          and active-card states need real vertical space. */}
      <div className={`relative px-2 sm:px-6 ${ideas.length || generating || loading ? 'py-8 sm:py-10 min-h-[260px]' : 'py-3'}`}>
        {loading && (
          <div className="flex items-center justify-center py-6">
            <span
              className="text-[11px] uppercase tracking-[0.28em] italic"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              reading your data…
            </span>
          </div>
        )}

        {!loading && !ideas.length && !generating && (
          <div className="flex flex-col gap-4 px-2">
            {/* Show the last seen idea dimmed — gives context instead of a blank.
                Read mode previews the pattern (the wow line); crossover previews
                title + why_now as before. */}
            {lastIdea && (
              <div className="opacity-30 pointer-events-none select-none mb-2">
                {lastIdea.mode === 'read' && lastIdea.pattern ? (
                  <p
                    className="text-[18px] italic leading-[1.25]"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-serif)',
                      fontWeight: 400,
                      letterSpacing: '-0.018em',
                    }}
                  >
                    {lastIdea.pattern}
                  </p>
                ) : (
                  <>
                    <h3
                      className="text-[20px] leading-[1.15] mb-2"
                      style={{
                        color: 'var(--brand-text-primary)',
                        fontFamily: 'var(--brand-font-serif)',
                        fontWeight: 500,
                        letterSpacing: '-0.018em',
                      }}
                    >
                      {lastIdea.title}
                    </h3>
                    <p
                      className="text-[13px] italic leading-[1.6]"
                      style={{
                        color: 'var(--brand-text-secondary)',
                        fontFamily: 'var(--brand-font-serif)',
                      }}
                    >
                      {lastIdea.why_now}
                    </p>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full transition-all flex-shrink-0"
                style={{
                  background: 'rgba(var(--brand-primary-rgb), 0.15)',
                  color: 'rgb(var(--brand-primary-rgb))',
                  border: '1px solid rgba(var(--brand-primary-rgb), 0.4)',
                }}
              >
                <span className="text-sm tracking-wide">
                  {lastIdea ? 'try another' : 'show me ideas'}
                </span>
              </button>
              {insufficientSignals !== null ? (
                <p className="text-[11px] italic flex-1 min-w-0" style={{ color: 'var(--brand-text-secondary)' }}>
                  {insufficientSignals} signal{insufficientSignals === 1 ? '' : 's'} captured — needs 8 to find patterns
                </p>
              ) : error ? (
                <p className="text-[11px] italic flex-1 min-w-0" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>
              ) : (
                <p className="text-[11px] italic flex-1 min-w-0 opacity-60" style={{ color: 'var(--brand-text-muted)' }}>
                  {hasAny ? 'cleared the deck — pull a fresh one' : 'pull a project from across your captures'}
                </p>
              )}
            </div>
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
              About 30 seconds.
            </p>
          </div>
        )}

        {!loading && !generating && active && (() => {
          // Mode-specific visual identity. Falls back to brand cyan if mode
          // can't be derived (rare — only on legacy ideas without evidence).
          const visual = mode ? MODE_VISUAL[mode] : { glyph: '✦', accentRgb: 'var(--brand-primary-rgb)', eyebrow: 'for you' }
          const accent = visual.accentRgb
          const glyph = visual.glyph
          // Drop cap is only worth it on pitches longer than ~80 chars; on
          // short ones it crowds the layout and looks accidental.
          const useDropCap = (active.pitch?.length ?? 0) > 80
          const pitchFirstChar = active.pitch?.charAt(0) ?? ''
          const pitchRest = active.pitch?.slice(1) ?? ''
          return (
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.article
                key={active.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="relative"
              >
                {/* Atmospheric mesh — mode-tinted radial gradients give the
                    card a colour identity without a literal background panel.
                    Two offset ellipses create a soft, organic glow. */}
                <div
                  aria-hidden
                  className="absolute -inset-x-6 -top-16 h-[120%] pointer-events-none -z-10"
                  style={{
                    background: `
                      radial-gradient(ellipse 70% 45% at 30% 10%, rgba(${accent}, 0.22), transparent 65%),
                      radial-gradient(ellipse 50% 35% at 80% 25%, rgba(${accent}, 0.12), transparent 60%),
                      radial-gradient(ellipse 60% 30% at 50% 80%, rgba(${accent}, 0.08), transparent 70%)
                    `,
                    filter: 'blur(32px)',
                  }}
                />

                {/* Editorial stamp at the top — glyph · rule · mode label.
                    Reads as the masthead of an issue from the harness. */}
                <div className="relative flex items-center gap-3 mb-7">
                  <span
                    aria-hidden
                    className="text-[24px] leading-none flex-shrink-0"
                    style={{
                      color: `rgb(${accent})`,
                      fontFamily: 'var(--brand-font-serif)',
                      textShadow: `0 0 18px rgba(${accent}, 0.45)`,
                    }}
                  >
                    {glyph}
                  </span>
                  <span
                    className="h-px w-8 flex-shrink-0"
                    style={{ background: `linear-gradient(to right, rgba(${accent}, 0.6), rgba(${accent}, 0.1))` }}
                  />
                  <span
                    className="text-[10px] uppercase tracking-[0.32em] font-semibold flex-1 truncate"
                    style={{ color: `rgb(${accent})`, opacity: 0.85 }}
                  >
                    {visual.eyebrow}
                  </span>
                  {active.status !== 'pending' && (
                    <span
                      className="text-[9px] tracking-[0.28em] uppercase font-medium px-2 py-1 rounded-full flex-shrink-0"
                      style={{
                        color: `rgb(${accent})`,
                        background: `rgba(${accent}, 0.1)`,
                        border: `1px solid rgba(${accent}, 0.25)`,
                      }}
                    >
                      {active.status}
                    </span>
                  )}
                </div>

                {/* Read mode — the pattern is the hero. Render it first, large
                    serif, italic, mode-tinted. The project title sits below
                    as the consequence. The wow lands in the pattern; the
                    title is just the natural "so do this." */}
                {mode === 'read' && active.pattern && (
                  <>
                    <p
                      className="relative text-[26px] sm:text-[36px] leading-[1.18] italic mb-6"
                      style={{
                        color: 'var(--brand-text-primary)',
                        fontFamily: 'var(--brand-font-serif)',
                        fontWeight: 400,
                        letterSpacing: '-0.018em',
                      }}
                    >
                      {active.pattern}
                    </p>
                    <span
                      className="block text-[10px] uppercase tracking-[0.32em] mb-2 font-semibold"
                      style={{ color: `rgb(${accent})`, opacity: 0.85 }}
                    >
                      the project this points to
                    </span>
                  </>
                )}

                {/* Title — generous serif, with a mode-tinted underline that
                    acts as a printer's slug rule. In Read mode the title is
                    a sub-headline (the consequence of the pattern above), so
                    it gets a slightly smaller treatment. */}
                <h3
                  className={`relative leading-[1.05] mb-3 ${mode === 'read' ? 'text-[22px] sm:text-[28px]' : 'text-[30px] sm:text-[42px]'}`}
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'var(--brand-font-serif)',
                    fontWeight: 500,
                    letterSpacing: '-0.022em',
                  }}
                >
                  {active.title}
                </h3>
                <div
                  aria-hidden
                  className="h-[2px] w-16 mb-8 rounded-full"
                  style={{
                    background: `linear-gradient(to right, rgb(${accent}), rgba(${accent}, 0.15))`,
                    boxShadow: `0 0 12px rgba(${accent}, 0.4)`,
                  }}
                />

                {/* Pitch — serif body with a drop cap on the first letter.
                    Drop cap is mode-tinted and slightly glowing so the
                    paragraph feels like the start of a chapter. */}
                <p
                  className="relative text-[15.5px] sm:text-[17px] leading-[1.7] mb-10"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'var(--brand-font-serif)',
                    fontWeight: 400,
                    opacity: 0.95,
                  }}
                >
                  {useDropCap ? (
                    <>
                      <span
                        aria-hidden
                        className="float-left mr-2 mt-1 text-[58px] sm:text-[68px] leading-[0.85] font-medium select-none"
                        style={{
                          color: `rgb(${accent})`,
                          fontFamily: 'var(--brand-font-serif)',
                          textShadow: `0 0 24px rgba(${accent}, 0.35)`,
                        }}
                      >
                        {pitchFirstChar}
                      </span>
                      <span aria-hidden className="sr-only">{pitchFirstChar}</span>
                      {pitchRest}
                    </>
                  ) : (
                    active.pitch
                  )}
                </p>

                {/* Decorative fleuron divider — typographic ornament centred
                    between body and pull-quote. Stops the page from reading
                    as a uniform column of text. */}
                <div aria-hidden className="flex items-center gap-4 my-8 px-2">
                  <span
                    className="h-px flex-1"
                    style={{ background: `linear-gradient(to right, transparent, rgba(${accent}, 0.3))` }}
                  />
                  <span
                    className="text-[14px] leading-none"
                    style={{ color: `rgb(${accent})`, opacity: 0.7, fontFamily: 'var(--brand-font-serif)' }}
                  >
                    {glyph}
                  </span>
                  <span
                    className="h-px flex-1"
                    style={{ background: `linear-gradient(to left, transparent, rgba(${accent}, 0.3))` }}
                  />
                </div>

                {/* why_now — proper pull-quote treatment with a large opening
                    quotation mark glyph, mode-tinted. */}
                <figure className="relative mb-10 pl-2">
                  <span
                    aria-hidden
                    className="absolute -top-6 -left-2 text-[78px] leading-none select-none font-serif"
                    style={{
                      color: `rgb(${accent})`,
                      opacity: 0.28,
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}
                  >
                    “
                  </span>
                  <blockquote
                    className="relative pl-7 text-[15px] sm:text-[17px] leading-[1.65] italic"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-serif)',
                      opacity: 0.92,
                    }}
                  >
                    {active.why_now}
                  </blockquote>
                  <figcaption
                    className="mt-3 pl-7 text-[10px] uppercase tracking-[0.32em] font-semibold"
                    style={{ color: `rgb(${accent})`, opacity: 0.7 }}
                  >
                    — why now
                  </figcaption>
                </figure>

                {/* What's next — visual CTA panel with mode-tinted gradient.
                    NOT a button (the build/save/dismiss row below is where
                    decisions land), but visually weighty so the user knows
                    this is the concrete first move. */}
                <div
                  className="relative mb-8 p-5 sm:p-6 rounded-2xl overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, rgba(${accent}, 0.14), rgba(${accent}, 0.04) 60%, transparent)`,
                    border: `1px solid rgba(${accent}, 0.22)`,
                    boxShadow: `0 8px 32px -12px rgba(${accent}, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)`,
                  }}
                >
                  {/* Subtle corner glyph as decoration */}
                  <span
                    aria-hidden
                    className="absolute top-3 right-4 text-[32px] leading-none opacity-15 select-none"
                    style={{ color: `rgb(${accent})`, fontFamily: 'var(--brand-font-serif)' }}
                  >
                    {glyph}
                  </span>
                  <span
                    className="block text-[10px] uppercase tracking-[0.32em] mb-3 font-semibold"
                    style={{ color: `rgb(${accent})` }}
                  >
                    your move
                  </span>
                  <p
                    className="text-[16px] sm:text-[19px] leading-[1.45] font-medium pr-8"
                    style={{
                      color: 'var(--brand-text-primary)',
                      fontFamily: 'var(--brand-font-serif)',
                    }}
                  >
                    {active.next_step}
                  </p>
                </div>

                {evidenceCount > 0 && (
                  <div className="relative flex justify-center mb-2">
                    <button
                      type="button"
                      onClick={() => setShowEvidence(s => !s)}
                      className="text-[10px] tracking-[0.28em] uppercase opacity-50 hover:opacity-90 transition-opacity"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      {showEvidence
                        ? '— hide signals —'
                        : `— ${evidenceCount === 1 ? 'see the signal' : `see all ${evidenceCount} signals`} —`}
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
                      className="relative mt-5 space-y-3 overflow-hidden"
                    >
                      {(active.evidence ?? []).map((e, i) => (
                        <li
                          key={`${e.source_id}-${i}`}
                          className="text-[12.5px] leading-[1.55]"
                          style={{ color: 'var(--brand-text-muted)' }}
                        >
                          <span className="block text-[9.5px] uppercase tracking-[0.24em] opacity-70 mb-0.5">
                            {KIND_LABEL[e.kind] ?? e.kind} · {e.label}{e.date ? ` · ${e.date}` : ''}
                          </span>
                          {e.excerpt && (
                            <span
                              className="block italic opacity-85"
                              style={{ fontFamily: 'var(--brand-font-serif)' }}
                            >
                              “{e.excerpt}”
                            </span>
                          )}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>

                {/* Action row — clear hierarchy: dismiss (ghost) | save (outlined)
                    | building it (filled, mode-tinted, the unmistakable CTA). */}
                <div
                  className="relative mt-10 pt-5 flex items-center gap-2"
                  style={{ borderTop: `1px solid rgba(${accent}, 0.12)` }}
                >
                  <button
                    type="button"
                    onClick={() => sendFeedback(active, 'rejected')}
                    disabled={pendingFeedback === active.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] tracking-wide transition-opacity opacity-50 hover:opacity-100 disabled:opacity-30"
                    style={{ color: 'var(--brand-text-muted)' }}
                    title="Not for me"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>not for me</span>
                  </button>

                  <span className="flex-1" aria-hidden />

                  <button
                    type="button"
                    onClick={() => sendFeedback(active, active.status === 'saved' ? 'pending' : 'saved')}
                    disabled={pendingFeedback === active.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11.5px] font-medium tracking-wide transition-all"
                    style={{
                      color: active.status === 'saved' ? `rgb(${accent})` : 'var(--brand-text-secondary)',
                      background: active.status === 'saved' ? `rgba(${accent}, 0.12)` : 'transparent',
                      border: active.status === 'saved' ? `1px solid rgba(${accent}, 0.4)` : '1px solid rgba(255,255,255,0.08)',
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all disabled:opacity-60"
                    style={{
                      color: '#0b1320',
                      background: active.status === 'built'
                        ? `rgba(${accent}, 0.5)`
                        : `linear-gradient(135deg, rgb(${accent}), rgba(${accent}, 0.8))`,
                      boxShadow: active.status === 'built'
                        ? 'none'
                        : `0 4px 16px -4px rgba(${accent}, 0.6), inset 0 1px 0 rgba(255,255,255,0.2)`,
                    }}
                    title="I'm building it"
                  >
                    <Hammer className="h-3.5 w-3.5" />
                    <span>{active.status === 'built' ? 'building' : 'building it'}</span>
                  </button>
                </div>

                {error && (
                  <p className="relative text-xs mt-4 italic text-center" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>
                )}
              </motion.article>
            </AnimatePresence>
          </div>
          )
        })()}
      </div>
    </section>
  )
}
