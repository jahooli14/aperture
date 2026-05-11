/**
 * ProjectIdeasHome — opt-in suggestion button, with a full card on expand.
 *
 * Lives below Keep Going on the homepage. Default state is a quiet button —
 * the user only ever sees an idea if they ask for one. Two button labels
 * depending on whether the system has a pre-baked idea waiting:
 *
 *   - "unlock" (instant) — cron has pre-baked an idea (Read or crossover at
 *     full quality) and it's sitting unviewed in the queue. Clicking expands
 *     it inline; no LLM call.
 *   - "suggest a project" (~10s) — queue is empty. Clicking generates one
 *     fresh on demand using the FAST path (Flash-Lite, crossover-only). The
 *     wow ideas (Read mode) only come from the cron-baked queue; on-demand
 *     prioritises speed over depth.
 *
 * After the user acts on an idea (save / dismiss / build), the card collapses
 * back to the button. If more pre-baked ideas remain, the button stays in
 * "unlock" state. If the queue is now empty, it switches to "suggest."
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookmarkPlus, BookmarkCheck, X, Hammer } from 'lucide-react'
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
  /** Read-only: model's honest 0–100 self-score on the pattern. The home
   *  auto-surfaces the prominent teaser only when this is >= 70; below
   *  that the idea sits in the queue and the user has to reach for the
   *  button. NULL on crossover (no threshold gate). */
  confidence?: number | null
}

/** Minimum confidence for the prominent home teaser to fire. Below this,
 *  the surface stays as the small "suggest a project" button — the user
 *  asks if they want one. The wow has to be earned every time. */
const TEASER_CONFIDENCE_THRESHOLD = 70

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

// Staged loading copy for the on-demand fast path (~5–10s). The thresholds
// stretch beyond 10s so a slow tail doesn't hit the last stage suspiciously
// early. Each stage names what the model is roughly doing.
const LOADING_STAGES: Array<{ at_ms: number; line: string }> = [
  { at_ms: 0,      line: 'reading your captures' },
  { at_ms: 3_000,  line: 'pairing what you started with what you kept' },
  { at_ms: 7_000,  line: 'picking the one that fits today' },
  { at_ms: 12_000, line: 'almost there' },
]

export function ProjectIdeasHome() {
  const navigate = useNavigate()
  const [ideas, setIdeas] = useState<ProjectIdea[]>([])
  const [insufficientSignals, setInsufficientSignals] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showEvidence, setShowEvidence] = useState(false)
  const [pendingFeedback, setPendingFeedback] = useState<string | null>(null)
  const [loadingStage, setLoadingStage] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  // Default state is collapsed — the surface is a quiet button. The user
  // expands it explicitly by clicking "unlock" or "suggest a project."
  // Each save / dismiss / build collapses back so the user always lands
  // on the choice "do I want another?" rather than a chained reveal.
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('utilities?resource=project-ideas') as ProjectIdeasResponse
      const active = (res.ideas ?? []).slice(0, 3)
      setIdeas(active)
      setActiveIndex(0)
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
      // Server short-circuits to the queue when one exists (instant); only
      // hits the LLM when the queue is empty. Fast path is ~10s; allow 40s
      // so a slightly slow tail doesn't abort.
      const res = await api.post(
        'utilities?resource=generate-project-ideas',
        {},
        { timeout: 40_000 },
      ) as GenerateResponse
      if (!res.ideas || res.ideas.length === 0) {
        if (res.reason === 'insufficient_data') {
          const have = typeof res.signal_count === 'number' ? res.signal_count : 0
          setInsufficientSignals(have)
        } else {
          setError('Nothing ripe right now. Capture a thought and try again.')
        }
        return
      }
      setInsufficientSignals(null)
      // POST already returns the inserted rows — use them directly to
      // skip the GET round-trip and expand the card immediately.
      setIdeas(res.ideas.slice(0, 3))
      setActiveIndex(0)
      setExpanded(true)
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
  }, [generating])

  const sendFeedback = useCallback(async (idea: ProjectIdea, status: 'saved' | 'rejected' | 'built' | 'pending') => {
    if (pendingFeedback === idea.id) return
    setPendingFeedback(idea.id)
    haptic.medium()
    try {
      await api.post('utilities?resource=project-ideas-feedback', { id: idea.id, status })
      if (status === 'rejected') {
        // Drop the rejected idea from the local deck and collapse back to
        // the button. If the queue still has more, the button will show
        // "unlock" again; if not, it'll show "suggest a project."
        setIdeas(prev => prev.filter(i => i.id !== idea.id))
        setActiveIndex(0)
        setExpanded(false)
        setShowEvidence(false)
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
        // Save (or any non-destructive status change) collapses the card.
        // The user has decided what to do with this one — we get out of
        // the way and let them return to Keep Going.
        if (status === 'saved') {
          setExpanded(false)
          setShowEvidence(false)
        }
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

  // Click handler for the collapsed button. Either reveals a queued idea
  // (instant, no API call) or kicks off generation (~10s) when the queue
  // is empty. The post above already short-circuits on the server when a
  // pending row exists, so calling generate() always does the right thing
  // — but we can avoid even the round-trip when the deck is already
  // populated client-side.
  const reveal = useCallback(async () => {
    if (generating) return
    haptic.medium()
    if (ideas.length > 0) {
      setExpanded(true)
      setActiveIndex(0)
      return
    }
    await generate()
  }, [generating, ideas.length, generate])

  // Surface state. Two paths into the expanded card:
  //   1. The earned teaser. Only fires when a Read idea sits in the queue
  //      with confidence >= TEASER_CONFIDENCE_THRESHOLD. The teaser is a
  //      single italic line that says "there's something I want to show
  //      you" — the wow only appears when the system has earned the click.
  //   2. The escape hatch button. Always available below the teaser (or
  //      on its own when nothing's earned). Click → expand the queued
  //      idea if there is one, or generate fresh in ~10s.
  // The user-explicit click NEVER respects the threshold — that's just
  // the auto-surface gate. If the user asks for an idea, we produce one.
  const earnedTeaser = (() => {
    const queued = ideas.find(i => i.mode === 'read' && (i.confidence ?? 0) >= TEASER_CONFIDENCE_THRESHOLD)
    if (!queued) return null
    const visual = MODE_VISUAL.read
    return { idea: queued, glyph: visual.glyph, accentRgb: visual.accentRgb }
  })()

  return (
    <section className="relative">
      {/* Container collapses tight when the user hasn't asked for an idea
          yet — the surface is a button, not a hero. Expands when an idea
          is being viewed or generated. */}
      <div className={`relative px-2 sm:px-6 ${expanded || generating ? 'py-8 sm:py-10 min-h-[260px]' : 'py-3'}`}>
        {loading && (
          <div className="flex items-center justify-center py-3">
            <span
              className="text-[10px] uppercase tracking-[0.28em] italic opacity-50"
              style={{ color: 'var(--brand-text-muted)' }}
            >
              checking your queue…
            </span>
          </div>
        )}

        {/* Collapsed state. Two cohabiting surfaces:
            • Earned teaser — when a high-confidence Read sits in the queue,
              the home shows a single italic line inviting the click. The
              pattern itself stays hidden until they tap; the line only
              promises that something is there.
            • Escape-hatch button — always present below. The user can ask
              for an idea even when the system hasn't earned the teaser.
              On a sparse / low-quality day, the button is the only surface.
            Both routes end in the same expanded card. */}
        {!loading && !expanded && !generating && (
          <div className="flex flex-col items-center gap-5 py-2">
            {earnedTeaser && (
              <button
                type="button"
                onClick={() => { haptic.medium(); setExpanded(true); setActiveIndex(ideas.findIndex(i => i.id === earnedTeaser.idea.id)) }}
                className="group flex items-center gap-3 px-2 py-3 rounded-lg transition-all max-w-xl"
                style={{ color: 'var(--brand-text-primary)' }}
              >
                <span
                  aria-hidden
                  className="text-[20px] leading-none flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{
                    color: `rgb(${earnedTeaser.accentRgb})`,
                    fontFamily: 'var(--brand-font-serif)',
                    textShadow: `0 0 14px rgba(${earnedTeaser.accentRgb}, 0.45)`,
                  }}
                >
                  {earnedTeaser.glyph}
                </span>
                <span
                  className="text-[16px] sm:text-[18px] italic leading-[1.35] text-left"
                  style={{
                    color: 'var(--brand-text-primary)',
                    fontFamily: 'var(--brand-font-serif)',
                    opacity: 0.92,
                  }}
                >
                  there's something i want to show you
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={reveal}
              className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-full transition-all"
              style={{
                background: 'rgba(var(--brand-primary-rgb), 0.08)',
                color: 'var(--brand-text-secondary)',
                border: '1px solid rgba(var(--brand-primary-rgb), 0.18)',
              }}
            >
              <span
                aria-hidden
                className="text-[12px] leading-none opacity-80"
                style={{ fontFamily: 'var(--brand-font-serif)' }}
              >
                ✦
              </span>
              <span className="text-[11.5px] tracking-wide">
                suggest a project
              </span>
            </button>
            {insufficientSignals !== null ? (
              <p className="text-[11px] italic opacity-70" style={{ color: 'var(--brand-text-secondary)' }}>
                {insufficientSignals} signal{insufficientSignals === 1 ? '' : 's'} captured — needs 8 to find patterns
              </p>
            ) : error ? (
              <p className="text-[11px] italic opacity-70" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>
            ) : null}
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
              A few seconds.
            </p>
          </div>
        )}

        {!loading && !generating && expanded && active && (() => {
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
