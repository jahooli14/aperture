/**
 * TodaysAnswerCard — the home page's two-sided card.
 *
 * Top half: something to think about while you're NOT working — the standing
 * question (StandingQuestion). Bottom half: the project to pick up right now,
 * its one next move, your last note in your own words, and Go.
 *
 * Changing project is the "everything else" row underneath (tap a project to
 * look, ▶ to start it now); the card itself no longer carries a second way to
 * steer. It used to: a "say what you're actually after" field that opened a
 * chat, corpus chips, the full idea deck and a monthly "try something
 * different" nudge. That was a second and third answer box on the same card.
 * "Suggest a project" lives once, at the end of the row.
 *
 * This card IS the session contract (SPEC.md): Go opens the real contract
 * inline — move, timer, close-out — in this same box.
 */

import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  useProjectStore,
  usePriorityProject,
  useFocusProject,
} from '../../stores/useProjectStore'
import { useHomeAnswerStore } from '../../stores/useHomeAnswerStore'
import { formatRelativeTime, KeepGoingEmpty } from './KeepGoingEmpty'
import { StandingQuestion } from './StandingQuestion'
import { OutsideLine } from './OutsideLine'
import { SessionContract, type Phase } from '../session/SessionContract'
import { useSessionStore, readStoredMove } from '../../stores/useSessionStore'
import { splitDoneWhen } from '../session/sessionRunOps'
import { haptic } from '../../utils/haptics'

export function TodaysAnswerCard() {
  const navigate = useNavigate()
  const allProjects = useProjectStore(s => s.allProjects)
  const projects = useProjectStore(s => s.projects)
  const projectsLoading = useProjectStore(s => s.loading)
  const projectsInitialized = useProjectStore(s => s.initialized)
  const priorityProject = usePriorityProject()

  // A ▶ on one of the cards in the 'everything else' row points this card at
  // that project (see useHomeAnswerStore) without re-starring anything.
  const overrideProjectId = useHomeAnswerStore(s => s.overrideProjectId)

  // Execution rebuild (SPEC.md): the declared live project is the hero, and
  // a project booked for today beats even that — booking a two-hour block
  // only pays off if the app opens pre-loaded on the day without asking
  // again. is_priority stays as the fallback so the card still has an
  // anchor before a live project has ever been declared.
  // The whole chain (override -> booked today -> live -> star -> most
  // recent) lives in useProjectStore as resolveFocusProjectId, because
  // "everything else" has to exclude exactly whatever this resolves to.
  // It used to be inlined here and the row only excluded the STAR, so any
  // time this card showed something else — every ▶ tap on a mini card,
  // which sets an override rather than re-starring — the same project
  // appeared in both places.
  const focusProject = useFocusProject()

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

  // The session contract renders in place of this card's body once
  // started, so the whole flow (window → shapes → timer → close-out)
  // happens in the one box rather than on a second screen.
  const [contractOpen, setContractOpen] = useState(false)
  // Go on the card IS the decision, so the session starts straight away.
  // "Change it" opens the same box without starting.
  const [autoStart, setAutoStart] = useState(false)
  // Tracked so the wrapper below can go true black once a session is
  // actually running -- the one screen you stare at for the length of an
  // hour, where the hero gradient's glow costs real OLED battery for no
  // reason. Every other phase (window/planning/closeout/receipt/done) is
  // brief, so it keeps the richer look.
  const [sessionPhase, setSessionPhase] = useState<Phase | null>(null)


  // "Work on this one, now" arriving from elsewhere on the page — the ▶ on
  // a mini card, or the chat answering with start_session. Those surfaces
  // used to each run their own Power Hour flow; now they point this box at
  // the project and open the one contract, so there is exactly one session
  // engine in the app.
  const startRequestId = useHomeAnswerStore(s => s.startRequestId)

  // Rejoining a session already in flight. `active` lives in the session
  // store and survives navigation; `contractOpen` is local state and does
  // not. So stepping off home mid-hour -- to capture the thought the work
  // just gave you, the most likely reason to leave -- came back to a
  // normal answer card with a Start button on it, everything below still
  // hidden because a session was technically running, and no way back into
  // the hour. Starting again from there opened a second session.
  const activeSessionProjectId = useSessionStore(s => s.active?.project_id ?? null)

  useEffect(() => {
    if (!activeSessionProjectId) return
    if (focusProject?.id === activeSessionProjectId) {
      setContractOpen(true)
      return
    }
    // The session is on a project this card didn't resolve to (started
    // from a mini card, then the page remounted). Point the card at the
    // session rather than showing an unrelated answer beside it.
    if (allProjects.some(p => p.id === activeSessionProjectId)) {
      useHomeAnswerStore.getState().setOverride(activeSessionProjectId)
    }
  }, [activeSessionProjectId, focusProject?.id, allProjects])

  useEffect(() => {
    if (!startRequestId) return
    // requestStart sets the override in the same call, so focusProject is
    // already this project by the time we get here; the guard is for the
    // one frame where the project list hasn't caught up.
    if (focusProject?.id !== startRequestId) return
    useHomeAnswerStore.getState().clearStartRequest()
    setAutoStart(true)
    setContractOpen(true)
    // The request usually comes from a card further down the page, so put
    // the session back in front of the user rather than leaving it opened
    // off-screen above them.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [startRequestId, focusProject?.id])

  // Nothing starred, nothing recently touched. Genuinely brand new (no
  // projects at all) points at capture instead of an empty projects list;
  // otherwise the generic "nothing active" empty state.
  if (!focusProject) {
    // Mid-first-load there are no projects yet because none have arrived,
    // not because none exist — a returning user opening on a new device
    // was told "nothing here yet" for as long as the fetch took. Say
    // nothing until it lands.
    if (projects.length === 0 && (projectsLoading || !projectsInitialized)) {
      return (
        <div
          className="rounded-2xl p-5 h-[132px]"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          aria-hidden
        />
      )
    }
    if (projects.length === 0) {
      return (
        <KeepGoingEmpty
          message="Nothing here yet. Start by capturing a thought."
          actionLabel="Capture a thought"
          onAction={() => window.dispatchEvent(new Event('openVoiceCapture'))}
        />
      )
    }
    // Projects exist, but none is in motion (all finished or put away).
    // Nothing to press Go on, so say so plainly and point at the way in.
    return (
      <KeepGoingEmpty
        message="Nothing in motion right now. Capture a thought, or tap Suggest a project below."
        actionLabel="Capture a thought"
        onAction={() => window.dispatchEvent(new Event('openVoiceCapture'))}
      />
    )
  }

  // Execution rebuild: opens the contract in place. The old Power Hour
  // overlay it used to hand off to is gone -- there is one session engine
  // now, and this is the way in.
  const handleStartSession = (start: boolean) => {
    haptic.medium()
    setAutoStart(start)
    setContractOpen(true)
  }

  // Re-entry playback — the user's own words from the end of the last
  // session. This is the line that makes a cold project cheap to restart,
  // so it outranks any generated plan text when it exists.
  //
  // Only when it's actually a path, though. "Done." and "good session" are
  // acknowledgements, and showing one as the whole answer meant a project
  // with a real next step on its list said nothing about it. Same 25-char
  // floor the briefing uses to decide an exit note is worth planning from
  // (MIN_USEFUL_EXIT_NOTE in api/_lib/session-briefing.ts — repeated
  // rather than imported, since shipped src/ never reaches into api/_lib).
  const MIN_USEFUL_CLOSEOUT = 25
  const closeout = focusProject.last_closeout_text?.trim() || null
  const reEntry = closeout && closeout.length >= MIN_USEFUL_CLOSEOUT ? closeout : null

  // The one next move, written when the last session ended
  // (api/_lib/next-move.ts) and cached on the project, so it's on the card
  // the instant the app opens. The same move the session opens with --
  // home never promises one thing and the session another.
  const storedMove = readStoredMove(focusProject.metadata)
  const nextMove = storedMove?.kind === 'move' ? splitDoneWhen(storedMove.text) : null
  const fork = storedMove?.kind === 'fork' ? storedMove.text : null

  // No timestamp at all means never touched, not touched in 1970 — the
  // `|| 0` fallback here dated the project to the epoch and stamped a
  // brand-new one "long quiet" next to its own "not started yet".
  const lastTouched = focusProject.last_active || focusProject.updated_at || null
  const dormancyDays = lastTouched
    ? Math.floor((Date.now() - new Date(lastTouched).getTime()) / 86_400_000)
    : 0
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
  //
  // Once you're actually running, that changes: this is the one screen
  // you're staring at for the length of an hour, not a few seconds like
  // every other phase, so the gradient/glow that reads as premium
  // elsewhere just costs OLED battery here for nothing. True black, no
  // glow, current task pulled forward instead (SessionContract's own job).
  if (contractOpen) {
    const isRunning = sessionPhase === 'running'
    return (
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={isRunning ? {
          background: '#000',
          border: '1px solid rgba(255,255,255,0.08)',
        } : {
          background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(13,20,34,0.86) 55%)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
          boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {!isRunning && (
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
          />
        )}
        <SessionContract
          project={focusProject}
          surface="bare"
          autoStart={autoStart}
          onPhaseChange={setSessionPhase}
          onDone={() => {
            setContractOpen(false)
            setAutoStart(false)
            setSessionPhase(null)
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
    {/* Wrapper carries the breathing glow: the card itself clips its
        overflow, which would cut an outer glow off at the edge. */}
    <div className="relative isolate rounded-2xl neon-breathe">
    <div
      className="rounded-2xl p-5 flex flex-col overflow-hidden relative transition-colors duration-700 neon-edge"
      style={{
        background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(13,20,34,0.86) 55%)',
        backdropFilter: 'blur(32px) saturate(190%)',
        WebkitBackdropFilter: 'blur(32px) saturate(190%)',
        border: `1px solid ${dormancyColor ?? 'rgba(var(--brand-primary-rgb),0.10)'}`,
        boxShadow: '0 0 42px rgba(var(--brand-primary-rgb),0.22), 0 12px 36px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Top hairline glow — same brand-primary cue used on ThoughtOfTheDay. */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
      />

      {/* Two halves of one card, always in this order. The top quarter is
          the thing to think about while you're NOT working; everything
          below the rule is the session. The order doesn't shuffle by time
          of day — a card that rearranges itself on a clock can't be learned,
          and the session is what you came to press either way, so it keeps
          the weight and the space. Resting state only: during a session
          there's one thing on screen and it isn't a question about another
          project. */}
      <div onClick={(e) => e.stopPropagation()}>
        <StandingQuestion />
        <OutsideLine />
      </div>

      <div className="cursor-pointer" onClick={() => navigate(`/projects/${focusProject!.id}`)}>
        {/* The line the mull question sits above is its own, deliberately
            faint — this is the one that marks the handoff into the
            project, so it carries more contrast and a touch of the brand
            glow rather than reading as one more hairline. */}
        <div
          className="h-px mb-4 -mt-0.5"
          style={{ background: 'linear-gradient(90deg, rgba(var(--brand-primary-rgb),0.35), rgba(255,255,255,0.16) 40%, transparent)' }}
        />
        <div className="flex items-start justify-between gap-2 mb-1 mt-1">
          <h3
            className="card-title-lg line-clamp-2 flex-1"
            style={{ fontWeight: 600, fontSize: '1.125rem', fontFamily: 'var(--brand-font-body)' }}
          >
            {focusProject.title}
          </h3>
          {dormancyLabel && (
            <span
              className="text-[11px] font-medium uppercase tracking-[0.14em] px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
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
          className="text-[11px] uppercase tracking-[0.14em] font-medium mb-3 inline-block"
          style={{
            color: dormancyBadgeColor ?? 'var(--brand-text-muted)',
          }}
        >
          {formatRelativeTime(focusProject.last_active || focusProject.updated_at)}
        </span>

        {/* The readout below carries no border — it's a passive surface,
            not something you can act on. Every 1px rectangle at the same
            weight is what made the page read as a stack of outlined
            boxes; fill alone separates it from the card behind it. */}
        {nextMove ? (
          <div className="p-3.5 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.055)' }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--brand-text-muted)' }}>
              next move
            </p>
            <p
              className="text-[16px] leading-[1.4] font-medium"
              style={{ color: 'var(--brand-text-primary)', fontFamily: 'var(--brand-font-body)' }}
            >
              {nextMove.move}
            </p>
            {nextMove.doneWhen && (
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--brand-text-secondary)' }}>{nextMove.doneWhen}</p>
            )}
            {reEntry && (
              <p className="text-[12px] mt-2.5 line-clamp-2" style={{ color: 'var(--brand-text-secondary)' }}>
                You stopped with “{reEntry}”
              </p>
            )}
          </div>
        ) : fork ? (
          <div className="p-3.5 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.055)' }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--brand-text-muted)' }}>
              first, decide
            </p>
            <p className="text-[16px] leading-[1.4] font-medium" style={{ fontFamily: 'var(--brand-font-body)' }}>{fork}</p>
          </div>
        ) : reEntry ? (
          <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.055)' }}>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5" style={{ color: 'var(--brand-text-muted)' }}>
              where you left off
            </p>
            <p
              className="text-[14px] leading-[1.5]"
              style={{ color: 'var(--brand-text-primary)', fontFamily: 'var(--brand-font-body)' }}
            >
              “{reEntry}”
            </p>
          </div>
        ) : null}

        {/* One button. The move is already written, so Go starts the
            session straight away; "change it" opens the same box without
            starting, for "too big" / "wrong thing". */}
        <div className="space-y-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleStartSession(!!nextMove)}
            className="neon-button w-full py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {nextMove ? 'Go' : fork ? 'Answer it' : 'Find the first move'}
          </button>
          {nextMove && (
            <button
              onClick={() => handleStartSession(false)}
              className="w-full text-[12px] py-0.5"
              style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }}
            >
              Not this — change it
            </button>
          )}
        </div>
      </div>

    </div>
    </div>
    </>
  )
}
