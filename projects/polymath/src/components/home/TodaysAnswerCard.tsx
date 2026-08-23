/**
 * TodaysAnswerCard — the home page's single output box.
 *
 * Replaces the old three-piece split (KeepGoingCard hero + FocusChat's own
 * collapsed pill + ProjectIdeasHome's quiet suggest-a-project pill) with
 * one thing: a single "today's answer" built from the priority project's
 * real Power Hour plan, a Start session button, and a redirect ("or steer
 * it") that opens to real corpus signals — the same evidence-backed queue
 * ProjectIdeasHome draws from — plus free text. Tapping a signal commits it
 * (creates the project, becomes the new answer); typing hands off to the
 * existing Focus chat thread instead of running a second conversation.
 *
 * "Guide, not menu": one statement, one action, one quiet way to redirect —
 * never a question next to two competing buttons. See the chat-ux-review
 * design work this was built from for the full rationale.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, ArrowUp, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  useProjectStore,
  usePriorityProject,
  useMostRecentNonPriorityProject,
} from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { useFocusChatStore } from '../../stores/useFocusChatStore'
import { useProjectIdeasStore, type ProjectIdea } from '../../stores/useProjectIdeasStore'
import { useStartProjectSession, SESSION_DURATION_MINUTES } from '../../hooks/useStartProjectSession'
import { toPortfolioSummaries, buildOpeningLine } from './focusChatOps'
import { formatRelativeTime, KeepGoingEmpty } from './KeepGoingEmpty'
import { ProjectIdeasHome } from './ProjectIdeasHome'
import { FocusChat } from './FocusChat'
import { createProjectFromIdea } from '../../lib/createProjectFromIdea'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { handleInputFocus } from '../../utils/keyboard'

// One string for the resting field and the engaged one, so tapping in
// doesn't swap the question out from under you mid-thought.
const STEER_PROMPT = "Say what you're actually after…"

export function TodaysAnswerCard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const allProjects = useProjectStore(s => s.allProjects)
  const projects = useProjectStore(s => s.projects)
  const createProject = useProjectStore(s => s.createProject)
  const priorityProject = usePriorityProject()
  const recentProject = useMostRecentNonPriorityProject()
  const feeling = useSessionContextStore(s => s.feeling)

  // A chip tap creates a project and becomes the new answer in place —
  // same box, new content — rather than starting a session invisibly out
  // from under the card.
  const [overrideProjectId, setOverrideProjectId] = useState<string | null>(null)
  const focusProject = useMemo(
    () => (overrideProjectId && allProjects.find(p => p.id === overrideProjectId)) || priorityProject || recentProject || null,
    [overrideProjectId, allProjects, priorityProject, recentProject],
  )

  // Drop the override the moment the REAL priority changes to something
  // else — without this, a chip pick from earlier in the session would
  // keep winning forever even after starring a different project
  // elsewhere in the app, since the override always took precedence.
  const priorityProjectId = priorityProject?.id ?? null
  const prevPriorityIdRef = useRef(priorityProjectId)
  useEffect(() => {
    if (prevPriorityIdRef.current !== priorityProjectId) {
      prevPriorityIdRef.current = priorityProjectId
      setOverrideProjectId(null)
    }
  }, [priorityProjectId])

  const [plan, setPlan] = useState<any>(null)
  const { start, loading: startingSession } = useStartProjectSession(focusProject?.id)

  const [engaged, setEngaged] = useState(false)
  // Shared with ProjectIdeasHome — same cache, same fetch. In practice
  // ProjectIdeasHome's own mount-time load usually wins the race, so
  // tapping "or steer it" here shows chips instantly instead of a spinner;
  // either way, resolving one from here is instantly reflected there too.
  const chipsLoaded = useProjectIdeasStore(s => s.loaded)
  const chipsLoading = useProjectIdeasStore(s => s.loading)
  const chips = useProjectIdeasStore(s => s.ideas)
  const [resolvingChipId, setResolvingChipId] = useState<string | null>(null)
  // Flips true if a chip resolve is taking a while — createProject is
  // usually near-instant, but a slow network shouldn't leave "Starting…"
  // sitting there indefinitely with no sign anything's still happening.
  const [resolveSlow, setResolveSlow] = useState(false)
  const [steerText, setSteerText] = useState('')
  const [showDeck, setShowDeck] = useState(false)

  useEffect(() => {
    if (!focusProject) { setPlan(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/power-hour?projectId=${focusProject.id}&duration=${SESSION_DURATION_MINUTES}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data.tasks?.[0] && !cancelled) setPlan(data.tasks[0])
      } catch {}
    })()
    return () => { cancelled = true }
    // Refetch only when the project id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProject?.id])

  const summaries = useMemo(() => toPortfolioSummaries(
    allProjects.filter(p => p.status !== 'completed' && p.status !== 'graveyard' && p.metadata?.is_shaped !== false)
  ), [allProjects])

  // Real corpus signals for "already noticed" — the same evidence-backed
  // queue ProjectIdeasHome draws from, off the shared store. Idempotent:
  // if that fetch already ran (usual case — ProjectIdeasHome mounts and
  // loads before anyone taps this), this is a no-op and chips are already
  // populated by the time the panel opens.
  const openSteer = () => {
    haptic.light()
    setEngaged(true)
    void useProjectIdeasStore.getState().load()
  }

  // True once a real conversation exists — the panel switches from
  // chips-to-tap into the thread itself at that point, using this same
  // input to keep talking rather than opening a second card underneath
  // with its own header and its own copy of this exact field.
  const hasThread = useFocusChatStore(s => s.messages.length > 0)

  // Free-text steer hands straight to the existing Focus chat thread
  // rather than a second resolution mechanism — real conversation, the
  // same one that already knows how to propose, start, or reshape. Stays
  // open after sending (this IS the reply box for whatever it asks next),
  // not collapsed back to a chip list.
  const submitSteer = () => {
    const text = steerText.trim()
    if (!text) return
    setSteerText('')
    // The deck (if open) belongs to the "browsing" register, not the
    // "talking" one — close it in the same action that starts a
    // conversation, so it reads as a deliberate handoff instead of
    // silently vanishing a moment later.
    setShowDeck(false)
    useFocusChatStore.getState().sendMessage(text, summaries, feeling)
  }

  // Ends the conversation for real (clears the transcript), not just
  // hides it — otherwise there'd be no way back to fresh corpus chips
  // for the rest of the session short of reloading the page.
  const startOver = () => {
    useFocusChatStore.getState().reset()
  }

  // Tapping a chip commits it — same create-project flow ProjectIdeasHome's
  // save button uses, then becomes this card's new answer in place. No
  // separate confirmation: tapping a named, evidence-backed signal already
  // IS the "let's do this" gesture.
  const resolveChip = async (idea: ProjectIdea) => {
    if (resolvingChipId) return
    setResolvingChipId(idea.id)
    haptic.medium()
    const slowTimer = window.setTimeout(() => setResolveSlow(true), 4000)
    try {
      const created = await createProjectFromIdea(idea, createProject)
      setEngaged(false)
      setOverrideProjectId(created.id)
      addToast({
        title: 'Saved to projects',
        description: `"${idea.title}" is now today's answer.`,
        variant: 'success',
      })
    } catch (err) {
      addToast({
        title: "Couldn't start that",
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      })
    } finally {
      window.clearTimeout(slowTimer)
      setResolveSlow(false)
      setResolvingChipId(null)
    }
  }

  // Nothing starred, nothing recently touched. Genuinely brand new (no
  // projects at all) points at capture instead of an empty projects list;
  // otherwise the generic "nothing active" empty state.
  if (!focusProject) {
    if (projects.length === 0) {
      return (
        <KeepGoingEmpty
          message="Nothing here yet. Start by capturing a thought."
          actionLabel="Capture a thought"
          onAction={() => window.dispatchEvent(new Event('openVoiceCapture'))}
        />
      )
    }
    // Projects exist but nothing's starred or recently active enough to
    // anchor an answer to a single project — still give a real, portfolio-
    // aware line (not a placeholder) and a way to steer, just no Start
    // session button (there's no specific project to attach it to).
    const openingLine = buildOpeningLine(summaries)
    return (
      <div
        className="rounded-2xl p-5 relative"
        style={{
          background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
          boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}>today's answer</span>
        <p className="mt-3 text-[17px] leading-[1.4]" style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-serif)' }}>{openingLine}</p>
        {!engaged ? (
          <SteerRow onOpen={openSteer} />
        ) : (
          <SteerPanel
            chips={chips}
            chipsLoaded={chipsLoaded}
            chipsLoading={chipsLoading}
            resolvingChipId={resolvingChipId}
            resolveSlow={resolveSlow}
            onResolveChip={resolveChip}
            hasThread={hasThread}
            onStartOver={startOver}
            steerText={steerText}
            onSteerTextChange={setSteerText}
            onSubmitSteer={submitSteer}
            onClose={() => { setEngaged(false); setShowDeck(false); useFocusChatStore.getState().close() }}
            showDeck={showDeck}
            onToggleDeck={() => setShowDeck(v => !v)}
          />
        )}
      </div>
    )
  }

  const handleStartSession = () => start({ prefetched: plan })

  const headline = plan?.task_title || focusProject.metadata?.session_headline
  const pitch = plan?.task_description || focusProject.metadata?.session_pitch
  // Only surface a preview when we actually know what's next. Generic
  // "continue where you left off" copy is exactly the analyst voice
  // CLAUDE.md forbids — stay quiet when there's nothing real to say.
  const answer = headline || focusProject.metadata?.tasks?.find((t: any) => !t.done)?.text

  const dormancyDays = Math.floor(
    (Date.now() - new Date(focusProject.last_active || focusProject.updated_at || 0).getTime()) / 86_400_000
  )
  const dormancyColor = dormancyDays >= 28
    ? 'rgba(239,68,68,0.55)'
    : dormancyDays >= 7
    ? 'rgba(245,158,11,0.55)'
    : null
  const dormancyLabel = dormancyDays >= 28
    ? 'long quiet'
    : dormancyDays >= 7
    ? 'going quiet'
    : null

  return (
    <div
      className="rounded-2xl p-5 flex flex-col overflow-hidden relative transition-all duration-700"
      style={{
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
        backdropFilter: 'blur(32px) saturate(190%)',
        WebkitBackdropFilter: 'blur(32px) saturate(190%)',
        border: `1px solid ${dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.35)'}`,
        boxShadow: dormancyColor
          ? `0 0 36px ${dormancyColor.replace('0.55', '0.22')}, 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Top hairline glow — same brand-primary cue used on ThoughtOfTheDay. */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
      />

      <div className="cursor-pointer" onClick={() => navigate(`/projects/${focusProject!.id}`)}>
        <div className="flex items-start justify-between gap-2 mb-1 mt-1">
          <h3 className="card-title-lg line-clamp-2 flex-1">{focusProject.title}</h3>
          {dormancyLabel && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
              style={{
                color: dormancyColor ?? undefined,
                border: `1px solid ${dormancyColor}`,
                background: 'rgba(0,0,0,0.3)',
                boxShadow: dormancyColor ? `0 0 8px ${dormancyColor.replace('0.55', '0.25')}` : undefined,
              }}
            >
              {dormancyLabel}
            </span>
          )}
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.28em] font-semibold mb-3 inline-block"
          style={{ color: dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.7)' }}
        >
          {formatRelativeTime(focusProject.last_active || focusProject.updated_at)}
        </span>

        {/* The readout below carries no border — it's a passive surface,
            not something you can act on. Every 1px rectangle at the same
            weight is what made the page read as a stack of outlined
            boxes; fill alone separates it from the card behind it. */}
        {answer ? (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.045)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--brand-text-secondary)] opacity-40 mb-1">
              {headline ? "today's answer" : "what's next"}
            </p>
            <p
              className="text-[17px] leading-[1.4] line-clamp-2 mb-1"
              style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-serif)' }}
            >
              {answer}
            </p>
            {pitch && <p className="text-xs text-[var(--brand-text-secondary)] opacity-60 line-clamp-2">{pitch}</p>}
          </div>
        ) : (
          <p className="text-xs mb-4" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
            No plan yet — start and we'll work out the first move together.
          </p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); handleStartSession() }}
          disabled={startingSession}
          className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
          style={{
            background: 'rgba(var(--brand-primary-rgb), 0.12)',
            border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
            color: 'rgb(var(--brand-primary-rgb))',
            boxShadow: '0 4px 16px -4px rgba(var(--brand-primary-rgb), 0.18)',
          }}
        >
          {startingSession ? (
            <span className="animate-pulse">Planning session...</span>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Start session
            </>
          )}
        </button>
      </div>

      {/* Redirect — stopPropagation so tapping anything in here doesn't
          also fire the card's navigate-to-project click above. */}
      <div onClick={(e) => e.stopPropagation()}>
        {!engaged ? (
          <SteerRow onOpen={openSteer} />
        ) : (
          <SteerPanel
            chips={chips}
            chipsLoaded={chipsLoaded}
            chipsLoading={chipsLoading}
            resolvingChipId={resolvingChipId}
            resolveSlow={resolveSlow}
            onResolveChip={resolveChip}
            hasThread={hasThread}
            onStartOver={startOver}
            steerText={steerText}
            onSteerTextChange={setSteerText}
            onSubmitSteer={submitSteer}
            onClose={() => { setEngaged(false); setShowDeck(false); useFocusChatStore.getState().close() }}
            showDeck={showDeck}
            onToggleDeck={() => setShowDeck(v => !v)}
          />
        )}
      </div>
    </div>
  )
}

/** Resting-state redirect entry. Deciding what to work on IS the point of
 *  this card, so the way in has to look like somewhere you can talk —
 *  a real field with a real prompt, not a dim text link with a chevron
 *  (which is what it was, and read as a footnote to the answer above it). */
function SteerRow({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all active:scale-[0.995]"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 0 24px -10px rgba(var(--brand-primary-rgb),0.4)',
        }}
      >
        <span className="flex-1 text-[15px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
          {STEER_PROMPT}
        </span>
        <ArrowUp className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.5 }} />
      </button>
    </div>
  )
}

/** Engaged state: real corpus signals to tap (recognition), plus a text
 *  field for anything they cover (recall) — same weight, no icons beyond
 *  the one chevron reused from elsewhere in the app, no caption spelling
 *  out what either does. */
function SteerPanel({
  chips,
  chipsLoaded,
  chipsLoading,
  resolvingChipId,
  resolveSlow,
  onResolveChip,
  hasThread,
  onStartOver,
  steerText,
  onSteerTextChange,
  onSubmitSteer,
  onClose,
  showDeck,
  onToggleDeck,
}: {
  chips: ProjectIdea[]
  chipsLoaded: boolean
  chipsLoading: boolean
  resolvingChipId: string | null
  resolveSlow: boolean
  onResolveChip: (idea: ProjectIdea) => void
  hasThread: boolean
  onStartOver: () => void
  steerText: string
  onSteerTextChange: (v: string) => void
  onSubmitSteer: () => void
  onClose: () => void
  showDeck: boolean
  onToggleDeck: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-5 pt-4"
      style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}>
          {hasThread ? 'focus' : 'already noticed'}
        </span>
        <div className="flex items-center gap-3">
          {/* Close only hides the thread (resumable); start over actually
              ends it, so "or steer it" can open back to fresh chips
              instead of the same conversation for the rest of the visit. */}
          {hasThread && (
            <button onClick={onStartOver} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Start over</button>
          )}
          <button onClick={onClose} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Close</button>
        </div>
      </div>

      {/* Once a real conversation exists, it replaces the chips entirely —
          this IS the thread now, rendered in place rather than as a
          second card underneath with its own header and its own copy of
          the input below. */}
      {hasThread ? (
        <div className="mb-3">
          <FocusChat onEditMessage={onSteerTextChange} />
        </div>
      ) : (
        <>
          {chipsLoading && (
            <p className="text-xs mb-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Reading your captures…</p>
          )}

          {!chipsLoading && chipsLoaded && chips.length === 0 && (
            <p className="text-xs mb-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Nothing waiting yet — say what you're after below.</p>
          )}

          <AnimatePresence initial={false}>
            {chips.map(idea => (
              <motion.button
                key={idea.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                onClick={() => onResolveChip(idea)}
                disabled={!!resolvingChipId}
                className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl mb-2 text-left transition-opacity disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
              >
                <div className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium line-clamp-1" style={{ color: 'var(--brand-text-primary)' }}>{idea.title}</span>
                  <span className="text-[11px] opacity-60 line-clamp-1" style={{ color: 'var(--brand-text-secondary)' }}>
                    {resolvingChipId === idea.id ? (resolveSlow ? 'Still working…' : 'Starting…') : (idea.evidence?.[0]?.label || idea.why_now)}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 opacity-30 flex-shrink-0" style={{ color: 'var(--brand-text-secondary)' }} />
              </motion.button>
            ))}
          </AnimatePresence>
        </>
      )}

      <div className="mt-4">
        {!hasThread && (
          <span className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>or steer it</span>
        )}
        <div className="flex items-center gap-2">
          <input
            placeholder={hasThread ? 'Reply…' : STEER_PROMPT}
            value={steerText}
            onChange={e => onSteerTextChange(e.target.value)}
            onFocus={handleInputFocus}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitSteer() } }}
            autoComplete="off"
            className="flex-1 px-4 py-3 rounded-xl text-[15px] focus:outline-none focus:ring-0"
            style={{ color: 'var(--brand-text-primary)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          />
          <button
            type="button"
            onClick={onSubmitSteer}
            disabled={!steerText.trim()}
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-10"
            style={{
              background: steerText.trim() ? 'rgba(var(--brand-primary-rgb),0.1)' : 'transparent',
              border: `1px solid ${steerText.trim() ? 'rgba(var(--brand-primary-rgb),0.15)' : 'rgba(255,255,255,0.04)'}`,
              color: 'var(--brand-text-primary)',
            }}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* The full deck — evidence, mode visuals, hour scope, reject with a
          reason — lives here now instead of as its own "try something new"
          section further down the page, which just put a second suggest-
          a-project pill next to this card's own. One entry point; this is
          its "go deeper" door, collapsed until asked for. Hidden mid-
          conversation — one thing to look at while you're talking, not
          a browsing door left dangling under it. */}
      {!hasThread && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onToggleDeck}
            className="text-[11px] font-medium"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            {showDeck ? 'hide the full deck' : 'or browse the full deck →'}
          </button>
          {showDeck && (
            <div className="mt-3">
              <ProjectIdeasHome startExpanded />
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
