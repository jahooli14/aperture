/**
 * SessionContract — the execution session, per SPEC.md. Move, work,
 * breadcrumb.
 *
 *   1. move      — the one next move, already written when you stopped
 *                  last time (api/_lib/next-move.ts), so it's here at once.
 *                  "Too big" / "wrong thing" / your own words write a new
 *                  one. A brand-new project may get a question instead.
 *   2. running   — the whole screen (FocusShell): the move, a Done button,
 *                  "I'm stuck", Stop. The clock counts up; nothing to size.
 *                  Minimise to step out without stopping.
 *   3. closeout  — the breadcrumb: where you stopped, what's next, what's
 *                  bugging you. The server turns it into the next move.
 *   4. receipt   — the hand-off: "next time starts with…", correctable
 *                  right there while it's fresh.
 *
 * Why this shape: in creative work the next step comes out of the last
 * one, so the move is written at the end of a session, not the start of
 * the next. The two moments that need help are starting and stopping
 * well; everything in between gets out of the way.
 *
 * The screens are in ./flow; this file owns the state and the store calls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useSessionStore, type CloseResult } from '../../stores/useSessionStore'
import { useVoicePreference } from '../../stores/useVoicePreference'
import { useProjectStore } from '../../stores/useProjectStore'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useSessionNotification, SESSION_ACTION_EVENT, type SessionAction } from '../../hooks/useSessionNotification'
import { haptic } from '../../utils/haptics'
import {
  loadTicks, saveTicks, elapsedSeconds, partitionRunningShapes,
  closeoutDraft, closeoutPrompt, splitDoneWhen,
  loadMinimised, saveMinimised,
} from './sessionRunOps'
import { MoveCard } from './flow/MoveCard'
import { FocusShell } from './flow/FocusShell'
import { WorkView } from './flow/WorkView'
import { Breadcrumb } from './flow/Breadcrumb'
import { Handoff } from './flow/Handoff'
import { accent, faint, formatClock } from './flow/ui'
import type { Project } from '../../types'

export type Phase = 'move' | 'running' | 'closeout' | 'receipt'

export function SessionContract({
  project,
  onDone,
  onFinish,
  source = 'live',
  surface = 'card',
  autoStart = false,
  onPhaseChange,
}: {
  project: Project
  onDone: () => void
  /** The hand-off says the finish line is reached and the user agrees.
   *  The default marks the project completed; a page with its own
   *  completion ritual passes its handler instead. */
  onFinish?: () => void | Promise<void>
  /** 'different-thing' for the monthly quota session -- doesn't touch the
   *  live-project declaration, just tags the logged session. */
  source?: 'live' | 'different-thing'
  /** 'card' draws its own glass surface (standalone /session route);
   *  'bare' lets the parent own it (the home answer box). */
  surface?: 'card' | 'bare'
  /** Go straight into the session with the stored move -- the card's own
   *  Go button already was the decision. */
  autoStart?: boolean
  /** Lets a 'bare' parent swap its own chrome by phase. */
  onPhaseChange?: (phase: Phase) => void
}) {
  const shell = (extra: string) => (surface === 'bare' ? extra : `glass-card p-6 ${extra}`)
  const {
    active, move, moveFor, moveBusy, starting, closing, error,
    loadMove, reworkMove, startSession, closeSession,
  } = useSessionStore()
  const { isOnline: online } = useOnlineStatus()
  const prefersText = useVoicePreference(s => s.prefersText)
  const setPrefersText = useVoicePreference(s => s.setPrefersText)

  // Rejoining a session already running on this project, not planning a
  // second one on top of it.
  const resuming = active != null && active.project_id === project.id

  const [phase, setPhase] = useState<Phase>(resuming ? 'running' : 'move')
  useEffect(() => { onPhaseChange?.(phase) }, [phase, onPhaseChange])
  // Only a session started before moves existed carries a window.
  const windowMinutes = resuming ? active?.window_minutes ?? null : null
  // The focus screen can be stepped out of (to capture a thought, say)
  // without stopping. The session keeps running; the card shows a bar.
  const [focusOpen, setFocusOpenState] = useState(() => !(resuming && loadMinimised(active?.id)))
  const setFocusOpen = (open: boolean) => {
    setFocusOpenState(open)
    saveMinimised(useSessionStore.getState().active?.id, !open)
  }
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [ticked, setTicked] = useState<Set<number>>(() =>
    resuming && active ? loadTicks(active.id) : new Set()
  )
  const [note, setNote] = useState('')
  const [mvsSeed, setMvsSeed] = useState<number | null>(null)
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null)
  const [savedNote, setSavedNote] = useState('')
  const [busy, setBusy] = useState(false)

  // ── The move: stored, so this is usually instant ──────────────────
  useEffect(() => {
    if (!resuming) void loadMove(project.id)
    // Once per project; a resumed session already has its move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])
  const moveHere = moveFor === project.id ? move : null

  const go = useCallback(async () => {
    haptic.medium()
    const items = moveHere?.kind === 'move' ? [{ text: moveHere.text, source: null, taskId: null }] : undefined
    await startSession(project.id, null, source, items)
    if (useSessionStore.getState().active) {
      setNowMs(Date.now())
      setTicked(new Set())
      setFocusOpen(true)
      setPhase('running')
    }
  }, [moveHere, project.id, source, startSession])

  // The card's Go button already was the decision: don't ask it twice.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStart || autoStarted.current || resuming || phase !== 'move') return
    if (moveHere?.kind !== 'move') return
    autoStarted.current = true
    void go()
  }, [autoStart, resuming, phase, moveHere, go])

  // ── The clock: wall time, never an accumulator ────────────────────
  // A locked phone suspends timers; (now - started_at) never lies.
  useEffect(() => {
    if (phase !== 'running') return
    const tick = () => setNowMs(Date.now())
    tick()
    const t = window.setInterval(tick, 1000)
    const onVisible = () => { if (!document.hidden) tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [phase])

  // ── Ticks belong to the session id and survive a remount ─────────
  const activeSessionId = active?.id ?? null
  const restoredTicksFor = useRef<string | null>(resuming ? activeSessionId : null)
  useEffect(() => {
    if (!activeSessionId || restoredTicksFor.current === activeSessionId) return
    restoredTicksFor.current = activeSessionId
    setTicked(loadTicks(activeSessionId))
  }, [activeSessionId])
  useEffect(() => {
    if (activeSessionId) saveTicks(activeSessionId, ticked)
  }, [activeSessionId, ticked])

  const toggle = (i: number) => {
    haptic.light()
    setTicked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  // ── Derived session state (above every early return: hooks) ───────
  const shapes = active?.shapes ?? []
  const { workIndexes } = partitionRunningShapes(shapes)
  const elapsedSec = active ? elapsedSeconds(active.started_at, nowMs) : 0
  const remaining = windowMinutes != null ? windowMinutes * 60 - elapsedSec : elapsedSec
  const timeUp = windowMinutes != null && remaining < 0
  const currentIndex = workIndexes.find(i => !ticked.has(i)) ?? -1
  const isRunning = phase === 'running' && active != null
  useSessionNotification(isRunning, project.title, currentIndex >= 0 ? shapes[currentIndex].text : null)

  // The notification's buttons: Done ticks the move you're on, I'm stuck
  // opens the session and asks for a way back in.
  const [stuckSignal, setStuckSignal] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const onAction = (e: Event) => {
      const action = (e as CustomEvent<SessionAction>).detail
      if (action === 'done' && currentIndex >= 0) toggle(currentIndex)
      if (action === 'stuck') {
        setFocusOpen(true)
        setStuckSignal(n => n + 1)
      }
    }
    window.addEventListener(SESSION_ACTION_EVENT, onAction)
    return () => window.removeEventListener(SESSION_ACTION_EVENT, onAction)
  }, [isRunning, currentIndex])

  const ask = closeoutPrompt(elapsedSec, ticked.size)
  const did = shapes.filter((sh, i) => ticked.has(i) && sh.source !== 'friction').map(sh => sh.text)

  const stop = () => {
    haptic.medium()
    setPhase('closeout')
  }

  const saveNote = async () => {
    const doneItems = shapes
      .filter((_, i) => ticked.has(i))
      .map(sh => ({ text: splitDoneWhen(sh.text).move, taskId: sh.taskId ?? null, partial: sh.partial }))
    // No note is fine -- what you ticked still stands as the record, so the
    // next session never opens on nothing.
    const text = note.trim() || closeoutDraft(shapes, ticked)
    const result = await closeSession(text, mvsSeed ?? undefined, doneItems)
    if (!result) return
    setSavedNote(note.trim())
    setCloseResult(result)
    setPhase('receipt')
  }

  const finishUp = () => {
    setFocusOpen(true)
    onDone()
  }

  const nextCycle = async () => {
    haptic.medium()
    setBusy(true)
    await useSessionStore.getState().startNextCycle(project.id)
    setBusy(false)
    finishUp()
  }

  const markFinished = async () => {
    haptic.medium()
    if (onFinish) await onFinish()
    else await useProjectStore.getState().updateProject(project.id, { status: 'completed' })
    finishUp()
  }

  // ── Focus mode: running, breadcrumb, hand-off ─────────────────────
  if ((phase === 'running' && active) || phase === 'closeout' || (phase === 'receipt' && closeResult)) {
    const bar = (
      <MinimisedBar
        title={project.title}
        clock={formatClock(remaining)}
        timeUp={timeUp}
        onOpen={() => setFocusOpen(true)}
        className={shell('')}
      />
    )
    return (
      <>
        {!focusOpen && phase === 'running' ? bar : <div className={shell('')}><p className="text-sm" style={faint(0.5)}>Session in progress…</p></div>}
        <AnimatePresence>
          {(focusOpen || phase !== 'running') && (
            <FocusShell>
              {phase === 'running' && active ? (
                <WorkView
                  projectId={project.id}
                  title={project.title}
                  shapes={shapes}
                  workIndexes={workIndexes}
                  ticked={ticked}
                  clockSeconds={remaining}
                  hasWindow={windowMinutes != null}
                  timeUp={timeUp}
                  online={online}
                  stuckSignal={stuckSignal}
                  onToggle={toggle}
                  onStop={stop}
                  onMinimise={() => setFocusOpen(false)}
                />
              ) : phase === 'closeout' ? (
                <Breadcrumb
                  question={ask.question}
                  placeholder={ask.placeholder}
                  showPrompts={ask.question !== 'What got in the way?'}
                  did={did}
                  text={note}
                  onText={updater => setNote(prev => updater(prev))}
                  voice={!prefersText}
                  onVoice={on => setPrefersText(!on)}
                  askMvsSeed={!!active?.askMvsSeed}
                  mvsSeed={mvsSeed}
                  onMvsSeed={setMvsSeed}
                  saving={closing}
                  error={error}
                  onSave={() => { void saveNote() }}
                  onBack={() => { haptic.light(); setPhase('running') }}
                />
              ) : closeResult ? (
                <Handoff
                  result={closeResult}
                  nextMove={moveHere ?? closeResult.nextMove}
                  onSetMove={(text: string) => { void reworkMove(project.id, { action: 'set', text }) }}
                  note={savedNote}
                  minutes={closeResult.duration_minutes}
                  busy={busy}
                  onClose={finishUp}
                  onFinish={() => { void markFinished() }}
                  onNextCycle={() => { void nextCycle() }}
                />
              ) : null}
            </FocusShell>
          )}
        </AnimatePresence>
      </>
    )
  }

  // ── Before: the move ──────────────────────────────────────────────
  return (
    <div className={shell('')}>
      <MoveCard
        title={project.title}
        lastNote={project.last_closeout_text?.trim() || null}
        move={moveHere}
        busy={moveBusy}
        starting={starting}
        online={online}
        error={error}
        onGo={() => { void go() }}
        onChange={change => { void reworkMove(project.id, change) }}
        onNotNow={onDone}
      />
    </div>
  )
}

function MinimisedBar({ title, clock, timeUp, onOpen, className }: {
  title: string; clock: string; timeUp: boolean; onOpen: () => void; className: string
}) {
  return (
    <button onClick={onOpen} className={`${className} w-full flex items-center justify-between gap-3 text-left`}>
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-[0.2em]" style={faint(0.5)}>Session running</span>
        <span className="block text-[15px] font-semibold truncate">{title}</span>
      </span>
      <span className="flex items-center gap-3 flex-shrink-0">
        <span className="tabular-nums text-[15px]" style={{ color: timeUp ? 'rgba(245,158,11,0.95)' : undefined }}>{clock}</span>
        <span className="text-[12px] font-semibold" style={{ color: accent }}>Back to it</span>
      </span>
    </button>
  )
}
