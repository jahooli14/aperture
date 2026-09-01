/**
 * TodaysAnswerCard — the home page's single output box.
 *
 * Replaces the old three-piece split (KeepGoingCard hero + FocusChat's own
 * collapsed pill + ProjectIdeasHome's quiet suggest-a-project pill) with
 * one thing: a single "today's answer", a Start session button, and a
 * redirect ("or steer it") that opens to real corpus signals — the same
 * evidence-backed queue ProjectIdeasHome draws from — plus free text.
 * Tapping a signal commits it (creates the project, becomes the new
 * answer); typing hands off to the existing Focus chat thread instead of
 * running a second conversation.
 *
 * "Guide, not menu": one statement, one action, one quiet way to redirect —
 * never a question next to two competing buttons. See the chat-ux-review
 * design work this was built from for the full rationale.
 *
 * EXECUTION REBUILD (SPEC.md): this card IS the session contract now, not a
 * neighbour to it. The first cut of the rebuild added a parallel session
 * card + its own /session route beside this one, which left the home with
 * two competing answer boxes and a floating menu — the exact "bolted on"
 * result the spec exists to prevent. So instead:
 *   - the hero is the declared LIVE project (state==='live'), or whatever
 *     is booked for today, falling back to the legacy is_priority star so
 *     nothing regresses before a live project has ever been declared;
 *   - the readout prefers the last close-out, played back in the user's own
 *     words — that re-entry line is the thing that makes a cold project
 *     cheap to restart, and it's why close-out is non-negotiable;
 *   - Start session opens the real contract (window → derived shapes →
 *     timer → close-out) inline, in this same box, rather than handing off
 *     to the old Power Hour focus overlay.
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
import { useHomeAnswerStore } from '../../stores/useHomeAnswerStore'
import { useProjectIdeasStore, type ProjectIdea } from '../../stores/useProjectIdeasStore'
import { toPortfolioSummaries, buildOpeningLine } from './focusChatOps'
import { formatRelativeTime, KeepGoingEmpty } from './KeepGoingEmpty'
import { ProjectIdeasHome } from './ProjectIdeasHome'
import { FocusChat } from './FocusChat'
import { SessionContract } from '../session/SessionContract'
import { WINDOW_PRESETS, useSessionStore } from '../../stores/useSessionStore'
import { FeelingPill } from './FeelingPill'
import { useDifferentThingNudge } from './useDifferentThingNudge'
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

  // A chip tap — or confirming a new-project proposal from inside the
  // Focus chat thread — creates a project and becomes the new answer in
  // place, same box, new content, rather than starting a session
  // invisibly out from under the card. Lives in a shared store because
  // the chat's confirm card sits three components below this one
  // (Card → SteerPanel → FocusChat → FocusChatNewProjectCard).
  const overrideProjectId = useHomeAnswerStore(s => s.overrideProjectId)

  // Execution rebuild (SPEC.md): the declared live project is the hero, and
  // a project booked for today beats even that — booking a two-hour block
  // only pays off if the app opens pre-loaded on the day without asking
  // again. is_priority stays as the fallback so the card still has an
  // anchor before a live project has ever been declared.
  const liveProject = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    // Same active-and-shaped filter every other project selector uses.
    // Without it, sending the live project to the graveyard left it sitting
    // here as today's answer forever — the graveyard looked broken because
    // the one place it mattered wasn't checking status.
    const eligible = allProjects.filter(
      p => ['active', 'upcoming'].includes(p.status ?? '') && p.metadata?.is_shaped !== false,
    )
    const booked = eligible.find(
      p => p.booked_session_at?.slice(0, 10) === today && p.state !== 'harvested',
    )
    return booked ?? eligible.find(p => p.state === 'live') ?? null
  }, [allProjects])

  const focusProject = useMemo(
    () => (overrideProjectId && allProjects.find(
        p => p.id === overrideProjectId &&
          ['active', 'upcoming'].includes(p.status ?? ''),
      ))
      || liveProject
      || priorityProject
      || recentProject
      || null,
    [overrideProjectId, allProjects, liveProject, priorityProject, recentProject],
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
      useHomeAnswerStore.getState().clearOverride()
    }
  }, [priorityProjectId])

  const [plan, setPlan] = useState<any>(null)

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
  // The session contract renders in place of this card's body once
  // started, so the whole flow (window → shapes → timer → close-out)
  // happens in the one box rather than on a second screen.
  const [contractOpen, setContractOpen] = useState(false)
  // How long you've got. A control ON the card, never a gate in front of it
  // -- most opens aren't sessions (capture, browse, logging a close-out),
  // and asking those a time question first blocks them for nothing. Picking
  // one here means Start session goes straight to the timer instead of
  // asking again.
  const windowMinutes = useSessionStore(s => s.windowMinutes)
  const setWindowMinutes = useSessionStore(s => s.setWindowMinutes)

  // "Work on this one, now" arriving from elsewhere on the page — the ▶ on
  // a mini card, or the chat answering with start_session. Those surfaces
  // used to each run their own Power Hour flow; now they point this box at
  // the project and open the one contract, so there is exactly one session
  // engine in the app.
  const startRequestId = useHomeAnswerStore(s => s.startRequestId)

  const pickWindow = (m: number) => {
    haptic.light()
    setWindowMinutes(windowMinutes === m ? null : m)
  }

  useEffect(() => {
    if (!startRequestId) return
    // requestStart sets the override in the same call, so focusProject is
    // already this project by the time we get here; the guard is for the
    // one frame where the project list hasn't caught up.
    if (focusProject?.id !== startRequestId) return
    useHomeAnswerStore.getState().clearStartRequest()
    setContractOpen(true)
    // The request usually comes from a card further down the page, so put
    // the session back in front of the user rather than leaving it opened
    // off-screen above them.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [startRequestId, focusProject?.id])

  useEffect(() => {
    if (!focusProject) { setPlan(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/power-hour?projectId=${focusProject.id}&duration=60`)
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
  // The monthly quota nudge, when it's due. Rendered in the steer row and
  // — if that's what the user tapped — said into the chat for them, so the
  // conversation opens already about the thing the app raised rather than
  // making them re-type the app's own suggestion.
  const nudge = useDifferentThingNudge()

  const openSteer = () => {
    haptic.light()
    setEngaged(true)
    void useProjectIdeasStore.getState().load()
    if (nudge.opener && useFocusChatStore.getState().messages.length === 0) {
      useFocusChatStore.getState().sendMessage(nudge.opener, summaries, feeling)
    }
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
      useHomeAnswerStore.getState().setOverride(created.id)
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
          <SteerRow onOpen={openSteer} nudge={nudge.text} />
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

  // Execution rebuild: opens the contract in place. The old Power Hour
  // overlay it used to hand off to is gone -- there is one session engine
  // now, and this is the way in.
  const handleStartSession = () => {
    haptic.medium()
    setContractOpen(true)
  }

  // Re-entry playback — the user's own words from the end of the last
  // session. This is the line that makes a cold project cheap to restart,
  // so it outranks any generated plan text when it exists.
  const reEntry = focusProject.last_closeout_text?.trim() || null

  const headline = plan?.task_title || focusProject.metadata?.session_headline
  const pitch = plan?.task_description || focusProject.metadata?.session_pitch
  // Only surface a preview when we actually know what's next. Generic
  // "continue where you left off" copy is exactly the analyst voice
  // CLAUDE.md forbids — stay quiet when there's nothing real to say.
  const answer = headline || focusProject.metadata?.tasks?.find((t: any) => !t.done)?.text

  const dormancyDays = Math.floor(
    (Date.now() - new Date(focusProject.last_active || focusProject.updated_at || 0).getTime()) / 86_400_000
  )
  // Amber at both tiers, never red. Red is the destructive/error colour
  // everywhere else in the app, so outlining the hero in it made the one
  // thing you're meant to act on read as something that had gone wrong.
  // The badge carries how long it's been; the card just warms slightly.
  const dormancyColor = dormancyDays >= 28
    ? 'rgba(245,158,11,0.45)'
    : dormancyDays >= 7
    ? 'rgba(245,158,11,0.28)'
    : null
  // The badge is the signal, so it stays legible; the card's border is
  // only atmosphere and sits far softer.
  const dormancyBadgeColor = dormancyColor ? 'rgba(245,158,11,0.9)' : null
  const dormancyLabel = dormancyDays >= 28
    ? 'long quiet'
    : dormancyDays >= 7
    ? 'going quiet'
    : null

  // A running session takes over the box entirely — during a session there
  // is exactly one thing on screen, which is the whole point of the
  // contract. It keeps the hero's gradient and glow (surface="bare", so the
  // wrapper below owns the surface): dropping to a flat panel at the exact
  // moment you commit to working reads as a demotion, which is backwards.
  if (contractOpen) {
    return (
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
          boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
        />
        <SessionContract
          project={focusProject}
          surface="bare"
          presetWindowMinutes={windowMinutes}
          onDone={() => {
            setContractOpen(false)
            // Pull the project back down so the card's re-entry line shows
            // the close-out that was just recorded, not the previous one.
            void useProjectStore.getState().fetchProjects()
          }}
        />
      </div>
    )
  }

  return (
    <>
    <FeelingPill />
    <div
      className="rounded-2xl p-5 flex flex-col overflow-hidden relative transition-all duration-700"
      style={{
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
        backdropFilter: 'blur(32px) saturate(190%)',
        WebkitBackdropFilter: 'blur(32px) saturate(190%)',
        border: `1px solid ${dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.35)'}`,
        boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
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
                color: dormancyBadgeColor ?? undefined,
                border: `1px solid rgba(245,158,11,0.4)`,
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
          style={{ color: dormancyBadgeColor ?? 'rgba(var(--brand-primary-rgb),0.7)' }}
        >
          {formatRelativeTime(focusProject.last_active || focusProject.updated_at)}
        </span>

        {/* The readout below carries no border — it's a passive surface,
            not something you can act on. Every 1px rectangle at the same
            weight is what made the page read as a stack of outlined
            boxes; fill alone separates it from the card behind it. */}
        {reEntry ? (
          /* Where you left off, in your own words. Quoted rather than
             paraphrased on purpose — a summary of your own sentence is
             strictly worse than the sentence. */
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.045)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--brand-text-secondary)] opacity-40 mb-1">
              where you left off
            </p>
            <p
              className="text-[17px] leading-[1.4] mb-1 italic"
              style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-serif)' }}
            >
              “{reEntry}”
            </p>
          </div>
        ) : answer ? (
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

        <div className="flex items-center gap-2 mb-3" onClick={e => e.stopPropagation()}>
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
            got
          </span>
          {WINDOW_PRESETS.map(m => {
            const active = windowMinutes === m
            return (
              <button
                key={m}
                onClick={() => pickWindow(m)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all active:scale-[0.97]"
                style={active
                  ? { background: 'rgba(var(--brand-primary-rgb),0.16)', border: '1px solid rgba(var(--brand-primary-rgb),0.45)', color: 'rgb(var(--brand-primary-rgb))' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--brand-text-secondary)' }}
              >
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            )
          })}
        </div>

        {/* The window is a gate, not a preference. The plan is sized to it,
            so there is nothing honest to show until it's answered — and a
            list built for "some amount of time" is the thing that made the
            old session one vague item long. */}
        <button
          onClick={(e) => { e.stopPropagation(); handleStartSession() }}
          disabled={windowMinutes == null}
          className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:cursor-default disabled:hover:brightness-100"
          style={windowMinutes == null ? {
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--brand-text-secondary)',
            opacity: 0.5,
          } : {
            background: 'rgba(var(--brand-primary-rgb), 0.12)',
            border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
            color: 'rgb(var(--brand-primary-rgb))',
            boxShadow: '0 4px 16px -4px rgba(var(--brand-primary-rgb), 0.18)',
          }}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {windowMinutes == null ? 'Pick a time first' : 'Start session'}
        </button>
      </div>

      {/* Redirect — stopPropagation so tapping anything in here doesn't
          also fire the card's navigate-to-project click above. */}
      <div onClick={(e) => e.stopPropagation()}>
        {!engaged ? (
          <SteerRow onOpen={openSteer} nudge={nudge.text} />
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
    </>
  )
}

/** Resting-state redirect entry. Deciding what to work on IS the point of
 *  this card, so the way in has to look like somewhere you can talk —
 *  a real field with a real prompt, not a dim text link with a chevron
 *  (which is what it was, and read as a footnote to the answer above it). */
function SteerRow({ onOpen, nudge }: { onOpen: () => void; nudge: string | null }) {
  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
      {nudge ? (
        // The monthly "try something different" quota. It used to borrow the
        // steer field's chrome — rounded box, placeholder-grey text, a send
        // arrow — which made the app's own suggestion look like a sentence
        // the user had already typed and not sent. It's the app talking, so
        // it looks like the app talking, with its own answer button.
        <button
          onClick={onOpen}
          className="w-full text-left rounded-xl px-4 py-3.5 transition-all active:scale-[0.995]"
          style={{
            background: 'rgba(var(--brand-primary-rgb),0.07)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.22)',
          }}
        >
          <span
            className="block text-[10px] uppercase tracking-[0.2em] mb-1.5"
            style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.55 }}
          >
            a month on the same things
          </span>
          <span className="block text-[15px] leading-snug" style={{ color: 'var(--brand-text-primary)' }}>
            {nudge}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-[12px] font-medium mt-2.5"
            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
          >
            Talk it through <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        </button>
      ) : (
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
      )}
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
