/**
 * TodaysAnswerCard — the home page's two-sided card.
 *
 * Top half: something to think about while you're NOT working — the standing
 * question (StandingQuestion). Bottom half: the project in play, what it
 * keeps in mind (or its one next move), your last note in your own words, and
 * one button: Update. Say where you got to; it is kept on the project and
 * the lines or the move follow it. There is no timer and no session screen:
 * a long project (the book) is read off its lines, a one-off (a coaster) off
 * its next move, and both are moved on the same way.
 *
 * Changing project is the "everything else" row underneath (tap a project
 * to look; the arrow puts it on this card). "Suggest a project" lives once,
 * at the end of that row.
 */

import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
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
import { useMoveStore, readStoredMove } from '../../stores/useMoveStore'
import { splitDoneWhen } from '../../lib/moveText'
import { haptic } from '../../utils/haptics'
import { isActivelyWorked, readThemes } from '../../lib/projectThemes'
import { seasonLine } from '../../lib/season'
import { ThemeList } from '../projects/ProjectThemes'
import { ThemesUpdatedNote, useRefreshThemes } from '../projects/ThemesFollowNotes'
import { UpdateSheet } from '../projects/UpdateSheet'
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
  useRefreshThemes(focusProject)

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

  const [updateOpen, setUpdateOpen] = useState(false)
  // "Not this — change it" opens too big / wrong thing right here.
  const [tweaking, setTweaking] = useState(false)

  // A project with neither lines nor a move yet gets its first move written
  // as the card shows it, so there is never a button that has to go and make
  // one. (An answered fork or a note moves it on from there.)
  const loadMove = useMoveStore(s => s.loadMove)
  const askedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!focusProject || askedFor.current === focusProject.id) return
    if (readThemes(focusProject.metadata).length > 0 || readStoredMove(focusProject.metadata)) return
    askedFor.current = focusProject.id
    void loadMove(focusProject.id)
  }, [focusProject, loadMove])

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
      <ThemesUpdatedNote project={focusProject} />
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

          {/* Update is a small button, not a bar. Where you stopped sits beside
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
              onClick={() => { haptic.medium(); setUpdateOpen(true) }}
              className="neon-button flex-shrink-0 px-6 py-2.5 rounded-full font-semibold text-[15px] flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              {fork && !steering ? 'Answer it' : 'Update'}
            </button>
          </div>
          {nextMove && !steering && tweaking && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              <MoveTweak projectId={focusProject.id} onClose={() => setTweaking(false)} />
            </div>
          )}
        </div>
      </div>
      {updateOpen && <UpdateSheet project={focusProject} onClose={() => setUpdateOpen(false)} />}
    </div>
  )
}
