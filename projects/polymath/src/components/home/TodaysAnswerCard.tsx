/**
 * TodaysAnswerCard — the home page's two-sided card.
 *
 * Top half: something to think about while you're NOT working — the standing
 * question (StandingQuestion). Bottom half: the project to pick up right now,
 * its one next move, your last note in your own words, and Go. While the
 * project is being worked on and has themes, the themes take the move's
 * place (they stay true for weeks; the move goes stale off-app).
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
import { MoveTweak } from './MoveTweak'
import { SessionContract, type Phase } from '../session/SessionContract'
import { useSessionStore, readStoredMove } from '../../stores/useSessionStore'
import { splitDoneWhen } from '../session/sessionRunOps'
import { haptic } from '../../utils/haptics'
import { isActivelyWorked, readThemes } from '../../lib/projectThemes'
import { seasonLine } from '../../lib/season'
import { ThemeList } from '../projects/ProjectThemes'
import { getTheme } from '../../lib/projectTheme'

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

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
  // "Not this — change it" opens too big / wrong thing right here.
  const [tweaking, setTweaking] = useState(false)


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
          className="glass-card-subtle p-5 h-[132px]"
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

  // While a project is being worked on, its themes lead instead of the
  // move (api/_lib/project-themes.ts). The move is rewritten only at an
  // in-app close-out, so on work done off-app it goes stale after one
  // session; themes stay true for weeks. Gone quiet, the move comes back:
  // a way back in is what a cold project needs.
  const themes = readThemes(focusProject.metadata)
  const steering = themes.length > 0 && isActivelyWorked(focusProject)

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
  // The badge is the signal, so it stays legible; the card's border is
  // only atmosphere and sits far softer.
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

  const theme = getTheme(focusProject.type || 'other', focusProject.title, focusProject.metadata?.tags)

  // What the project half says under its title: your Keep in mind lines
  // while you're on it, else the move, a fork, or where you left off. All
  // plain text on the card itself -- no panel inside a panel.
  const label = 'text-[11px] font-medium uppercase tracking-[0.14em] mb-1.5'
  const muted = { color: 'var(--brand-text-muted)' }
  const readout = steering ? (
    <>
      <p className={label} style={muted}>keep in mind</p>
      <ThemeList themes={themes} rgb={theme.rgb} />
    </>
  ) : nextMove ? (
    <>
      <p className={label} style={muted}>next move</p>
      <p className="type-lead">{nextMove.move}</p>
      {nextMove.doneWhen && <p className="text-[13px] mt-1" style={muted}>{nextMove.doneWhen}</p>}
      {reEntry && <p className="text-[13px] mt-2 line-clamp-1" style={muted}>You stopped with “{reEntry}”</p>}
    </>
  ) : fork ? (
    <>
      <p className={label} style={muted}>first, decide</p>
      <p className="type-lead">{fork}</p>
    </>
  ) : reEntry ? (
    <>
      <p className={label} style={muted}>where you left off</p>
      <p className="type-lead line-clamp-3">“{reEntry}”</p>
    </>
  ) : null

  const BASE = '#0c1322'
  // "Where you left off" sits beside Go when the lines lead; in the move and
  // fork layouts it is already part of the readout.
  const stopped = steering ? reEntry : null

  return (
    // One card, two halves: the thought above, the work below, and a slow
    // swell between them where a bead of light rides the curve. The wrapper
    // carries the breathing glow because the card clips its overflow.
    <div className="relative isolate rounded-[22px] neon-breathe" style={{ ['--neon-rgb' as string]: theme.rgb }}>
      <div
        className="rounded-[22px] overflow-hidden relative neon-edge"
        style={{
          background: BASE,
          border: `1px solid rgba(${theme.rgb},0.16)`,
          boxShadow: `0 0 40px rgba(${theme.rgb},0.18), 0 16px 44px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
      >
        {/* The work's own light, from the bottom corner. */}
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(120% 55% at 100% 100%, rgba(${theme.rgb},0.28) 0%, transparent 70%)` }}
        />
        {/* A little grain so the glass feels like a surface, not a gradient. */}
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.07, mixBlendMode: 'overlay', backgroundImage: GRAIN }}
        />

        {/* The thought: lit cyan from above, and its lower edge is the swell. */}
        <div className="relative" style={{ background: 'linear-gradient(180deg, rgba(var(--brand-primary-rgb),0.26) 0%, rgba(var(--brand-primary-rgb),0.10) 100%)' }}>
          <div className="px-5 pt-5 pb-9">
            <StandingQuestion />
          </div>
          <svg
            aria-hidden
            className="absolute bottom-0 left-0 w-full block"
            style={{ height: 30 }}
            viewBox="0 0 400 30"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="seamline" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="rgb(var(--brand-primary-rgb))" />
                <stop offset="0.6" stopColor={`rgb(${theme.rgb})`} stopOpacity="0.6" />
                <stop offset="1" stopColor={`rgb(${theme.rgb})`} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 30 L0 12 C 90 30 230 30 400 5 L400 30 Z" fill={BASE} />
            <path d="M0 12 C 90 30 230 30 400 5" fill="none" stroke="url(#seamline)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            aria-hidden
            className="absolute w-[6px] h-[6px] rounded-full"
            style={{ left: 17, bottom: 17, background: '#fff', boxShadow: `0 0 12px 3px rgba(${theme.rgb},0.9), 0 0 3px 1px rgba(255,255,255,0.85)` }}
          />
        </div>

        <div className="relative px-5 pt-1 pb-5 cursor-pointer" onClick={() => navigate(`/projects/${focusProject!.id}`)}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="card-title-lg line-clamp-2 flex-1">{focusProject.title}</h3>
            {dormancyLabel && (
              <span className="text-[13px] flex-shrink-0 mt-0.5" style={muted}>{dormancyLabel}</span>
            )}
          </div>
          <p className="text-[13px] mt-0.5 mb-3" style={muted}>
            {formatRelativeTime(focusProject.last_active || focusProject.updated_at)}
            {seasonLine(focusProject) ? ` · ${seasonLine(focusProject)}` : ''}
          </p>

          {readout && <div className="mb-3.5">{readout}</div>}

          {/* Go is a small button, not a bar. Where you stopped sits beside
              it; "change it" opens "too big" / "wrong thing" under it. */}
          <div className="flex items-end justify-between gap-4" onClick={e => e.stopPropagation()}>
            {stopped ? (
              <p className="text-[13px] line-clamp-2 flex-1 min-w-0" style={muted}>You stopped with “{stopped}”</p>
            ) : nextMove && !steering ? (
              <button
                onClick={() => setTweaking(t => !t)}
                className="text-[13px] py-1.5 text-left"
                style={muted}
              >
                {tweaking ? 'Keep this one' : 'Not this — change it'}
              </button>
            ) : <span />}
            <button
              onClick={() => handleStartSession(!!nextMove || steering)}
              className="neon-button flex-shrink-0 px-6 py-2.5 rounded-full font-semibold text-[15px] flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              {nextMove || steering ? 'Go' : fork ? 'Answer it' : 'Find the first move'}
            </button>
          </div>
          {nextMove && !steering && tweaking && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <MoveTweak projectId={focusProject.id} onClose={() => setTweaking(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
