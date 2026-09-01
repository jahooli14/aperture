/**
 * SessionContract — the execution session, per SPEC.md.
 *
 * Four phases, in order, in one box:
 *   1. window   — how long have you got. A real gate: the list can't be
 *                 sized until it knows. Skipped when the card above
 *                 already collected it.
 *   2. planning — the two minutes. An AI-shaped list of 3-6 moves sized to
 *                 the window, reshaped by saying what's wrong with it. A
 *                 2:00 countdown starts the moment you first touch it, so
 *                 shaping is always done but can never become the session.
 *                 At 0:00 it flips itself into the work.
 *   3. running  — the clock counts the window down and the agreed list is
 *                 on screen the whole time, ticked off as you go. Never a
 *                 timer with nothing under it.
 *   4. closeout — where'd you get to, spoken. Ticked items pre-fill it so
 *                 there's something to say even at the end of a bad hour.
 *
 * Voice throughout — the window, the reshape and the close-out are all
 * speakable, per "you never write a to-do list."
 *
 * Styling follows theme.css's real tokens (--brand-primary-rgb,
 * --brand-text-secondary, --glass-border-bold) rather than ad hoc CSS
 * variables, matching TodaysAnswerCard's "Start session" button exactly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Square, ArrowUp, Shuffle, Check, Keyboard, Mic, Wrench } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import { useSessionStore, WINDOW_PRESETS, planningSecondsFor, type CloseResult } from '../../stores/useSessionStore'
import { useVoicePreference } from '../../stores/useVoicePreference'
import { haptic } from '../../utils/haptics'
import type { Project } from '../../types'

function formatClock(seconds: number): string {
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${seconds < 0 ? '+' : ''}${m}:${s.toString().padStart(2, '0')}`
}

const secondaryTextStyle = { color: 'var(--brand-text-secondary)', opacity: 0.7 }
const borderStyle = { borderColor: 'var(--glass-border-bold)' }
const primaryButtonStyle = {
  background: 'rgba(var(--brand-primary-rgb), 0.12)',
  border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
  color: 'rgb(var(--brand-primary-rgb))',
}

function ReEntry({ project }: { project: Project }) {
  if (!project.last_closeout_text) {
    return <p className="text-sm" style={secondaryTextStyle}>First session on this one.</p>
  }
  return (
    <p className="text-sm italic" style={secondaryTextStyle}>
      "{project.last_closeout_text}"
    </p>
  )
}

type Phase = 'window' | 'planning' | 'running' | 'closeout' | 'receipt' | 'done'

export function SessionContract({
  project,
  onDone,
  source = 'live',
  surface = 'card',
  presetWindowMinutes = null,
}: {
  project: Project
  onDone: () => void
  /** 'different-thing' for the monthly quota session -- doesn't touch the
   *  live-project declaration, just tags the logged session so the mirror
   *  and the quota check (different-thing.ts) can find it. */
  source?: 'live' | 'different-thing'
  /** 'card' draws its own glass surface (standalone /session route).
   *  'bare' lets the parent own the surface -- used on home so the session
   *  keeps the answer box's hero gradient instead of visibly demoting
   *  itself to a flat panel at the moment you commit to working. */
  surface?: 'card' | 'bare'
  /** A window the parent already collected (the time chips on home). The
   *  window is a gate on the plan -- it just doesn't have to be asked
   *  twice when the card above already asked it. */
  presetWindowMinutes?: number | null
}) {
  // In 'bare' mode the parent supplies padding and background.
  const shell = (extra: string) => (surface === 'bare' ? extra : `glass-card p-6 ${extra}`)
  const {
    active, plan, shaping, starting, closing, error,
    shapePlan, reshapePlan, swapPlanItem, clearPlan, startSession, closeSession,
    answerPlanQuestion,
  } = useSessionStore()

  const [phase, setPhase] = useState<Phase>(presetWindowMinutes != null ? 'planning' : 'window')
  const [windowMinutes, setWindowMinutes] = useState<number | null>(presetWindowMinutes)
  const [planLeft, setPlanLeft] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [steer, setSteer] = useState('')
  const [closeoutText, setCloseoutText] = useState('')
  const [mvsSeedMinutes, setMvsSeedMinutes] = useState<number | null>(null)
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null)
  // Whether the mic is actually capturing right now -- a countdown or an
  // auto-advance must never fire mid-sentence, and "there's unsent text"
  // isn't the only shape "busy" can take.
  const [recording, setRecording] = useState(false)

  // Voice by default, listening automatically on your turn; typing is what
  // you opt into. Shared across creation, planning and the debrief so the
  // choice is made once, not re-fought every phase.
  const prefersText = useVoicePreference(s => s.prefersText)
  const setPrefersText = useVoicePreference(s => s.setPrefersText)
  const voiceTurn = !prefersText

  // ─── The plan ──────────────────────────────────────────────────────
  // Fetched once per (project, window). A reshape replaces it in place.
  const shapedFor = useRef<string | null>(null)
  useEffect(() => {
    if (phase !== 'planning') return
    const key = `${project.id}:${windowMinutes}`
    if (shapedFor.current === key) return
    shapedFor.current = key
    void shapePlan(project.id, windowMinutes)
  }, [phase, project.id, windowMinutes, shapePlan])

  const beginWork = useCallback(async () => {
    const items = plan?.items?.length ? plan.items : undefined
    await startSession(project.id, windowMinutes, source, items, plan?.friction ?? null)
    setElapsedSec(0)
    setTicked(new Set())
    setPhase('running')
  }, [plan, project.id, windowMinutes, source, startSession])

  // The planning clock runs from the moment there's a list to react to.
  //
  // The first cut started it on your first interaction, which was wrong in
  // exactly the way that matters: a clock that starts on a condition you
  // can't see isn't a ritual, it's a trap. Reading the list and deciding
  // it's fine IS the planning — so it counts, and you can see it counting.
  //
  // It pauses while a reshape is in flight, there's unsent text in the
  // box, or the mic is actually recording: the cap exists to stop
  // dithering, not to cut off a sentence that isn't finished yet. Also
  // paused while the app is the one asking. Flipping into a session
  // because the two minutes ran out on a question you were still answering
  // would be the app talking over itself.
  const planBusy = shaping || steer.trim().length > 0 || !!plan?.needsInput || recording
  // A plan that came straight from the task list, verbatim, with no model
  // call has nothing to "shape" -- the two-minute ritual exists to cover a
  // model call in flight and a list worth double-checking, neither of
  // which applies here. Reviewing it at your own pace beats a countdown
  // pressuring you through a list you didn't even need the AI for.
  const skipTimer = plan?.source === 'tasks'
  useEffect(() => {
    if (phase !== 'planning' || skipTimer) return
    if (!plan || plan.projectId !== project.id) return
    if (planLeft == null) { setPlanLeft(planningSecondsFor(windowMinutes)); return }
    if (planBusy) return
    if (planLeft <= 0) { void beginWork(); return }
    const t = window.setTimeout(() => setPlanLeft(v => (v == null ? null : v - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [phase, plan, project.id, planLeft, planBusy, beginWork, skipTimer, windowMinutes])

  // ─── The session clock ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return
    const t = window.setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [phase])

  const handlePickWindow = (minutes: number) => {
    haptic.light()
    setWindowMinutes(minutes)
    setPhase('planning')
  }

  // One input, two jobs, decided by which conversation is open: when the
  // app has asked a question, what you say is the answer to it (and gets
  // remembered); otherwise it's a complaint about the list.
  const sendToPlan = (text: string) => {
    const clean = text.trim()
    if (!clean || shaping) return
    if (plan?.needsInput) void answerPlanQuestion(clean)
    else void reshapePlan(clean)
  }

  const submitSteer = () => {
    if (!steer.trim() || shaping) return
    const text = steer
    setSteer('')
    sendToPlan(text)
  }

  const handleStop = () => {
    // A ticked list is the honest first draft of a close-out, so the box
    // is never empty at the exact moment attention is lowest.
    // Items already end in a full stop, so trim before joining — "from the
    // top.. Bounce the vocal." reads like a typo in your own words.
    const tickedShapes = (active?.shapes ?? []).filter((_, i) => ticked.has(i))
    const done = tickedShapes.map(s => s.text.trim().replace(/[.!?]+$/, ''))
    if (done.length > 0) setCloseoutText(`Did: ${done.join('. ')}.`)
    setPhase('closeout')
  }

  const handleSubmitCloseout = async () => {
    // The ticks go to the server, not just into the close-out text: a
    // ticked item that matches an open task marks it done, which is what
    // makes "what's already finished" real evidence next time. Friction
    // lines never carry a real taskId, so ticking one is inert server-side
    // — it just can't accidentally become a task.
    const doneItems = (active?.shapes ?? [])
      .filter((_, i) => ticked.has(i))
      .map(sh => ({ text: sh.text, taskId: sh.taskId ?? null }))
    const result = await closeSession(closeoutText, mvsSeedMinutes ?? undefined, doneItems)
    if (!result) return
    // A brief receipt of what the task list just did, rather than a silent
    // rewrite discovered weeks later -- skipped only when there's genuinely
    // nothing to show (an empty close-out with nothing ticked).
    if (result.markedDone.length > 0 || result.created.length > 0 || result.nextAdded.length > 0) {
      setCloseResult(result)
      setPhase('receipt')
    } else {
      setPhase('done')
    }
  }

  // ─── done ──────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className={shell('text-center space-y-3')}>
        <p className="text-base">Logged.</p>
        <button className="text-sm underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={onDone}>
          Close
        </button>
      </div>
    )
  }

  // ─── receipt ───────────────────────────────────────────────────────
  // A rewrite of the project's own record deserves a beat where you can
  // see what happened, not just a silent "Logged." — the debrief matches
  // free speech against the whole task list, and the one place that could
  // go wrong unnoticed is exactly here.
  if (phase === 'receipt' && closeResult) {
    return (
      <div className={shell('space-y-4')}>
        <p className="text-base">Here's what changed.</p>
        <div className="space-y-3">
          {(closeResult.markedDone.length > 0 || closeResult.created.length > 0) && (
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ ...secondaryTextStyle, opacity: 0.5 }}>Marked done</p>
              <ul className="space-y-1">
                {[...closeResult.markedDone, ...closeResult.created].map((t, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {closeResult.nextAdded.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-1" style={{ ...secondaryTextStyle, opacity: 0.5 }}>Added for next time</p>
              <ul className="space-y-1">
                {closeResult.nextAdded.map((t, i) => (
                  <li key={i} className="text-sm" style={secondaryTextStyle}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button
          className="w-full py-2 rounded-lg text-sm font-medium"
          style={primaryButtonStyle}
          onClick={() => setPhase('done')}
        >
          Good
        </button>
      </div>
    )
  }

  // ─── closeout ──────────────────────────────────────────────────────
  if (phase === 'closeout') {
    return (
      <div className={shell('space-y-4')}>
        <p className="text-base">Where'd you get to?</p>
        {active?.askMvsSeed && (
          <div className="space-y-1">
            <p className="text-sm" style={secondaryTextStyle}>
              How long do you usually need to get going on this?
            </p>
            <div className="flex gap-2">
              {[10, 20, 40].map(m => (
                <button
                  key={m}
                  className="px-3 py-1 rounded-full text-sm border"
                  style={mvsSeedMinutes === m ? primaryButtonStyle : borderStyle}
                  onClick={() => setMvsSeedMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}
        {voiceTurn ? (
          <div className="space-y-2">
            <VoiceInput
              onTranscript={t => setCloseoutText(c => (c ? `${c} ${t}` : t))}
              autoStart
              autoSubmit={false}
              maxDuration={45}
            />
            <button
              type="button"
              onClick={() => setPrefersText(true)}
              className="flex items-center gap-1 text-[11px] mx-auto transition-all"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
            >
              <Keyboard className="h-3 w-3" /> type instead
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPrefersText(false)}
            aria-label="Switch to voice"
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
          >
            <Mic className="h-3 w-3" /> use voice instead
          </button>
        )}
        <textarea
          value={closeoutText}
          onChange={e => setCloseoutText(e.target.value)}
          placeholder="Did: ... Next: ..."
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border resize-none outline-none"
          style={{ ...borderStyle, color: 'var(--brand-text-primary)' }}
        />
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={closing}
          onClick={handleSubmitCloseout}
        >
          {closing ? 'Saving…' : closeoutText ? 'Done' : 'Skip — nothing to report'}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // ─── running ───────────────────────────────────────────────────────
  if (phase === 'running' && active) {
    const remaining = windowMinutes != null ? windowMinutes * 60 - elapsedSec : elapsedSec
    return (
      <div className={shell('space-y-4')}>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={secondaryTextStyle}>{project.title}</span>
          <span
            className="flex items-center gap-1 text-lg tabular-nums"
            style={remaining < 0 ? { color: 'rgba(245,158,11,0.9)' } : undefined}
          >
            <Clock size={16} />
            {formatClock(remaining)}
          </span>
        </div>

        {/* The list is on screen for the whole session. A timer with
            nothing under it is just pressure. */}
        <ul className="space-y-1">
          {active.shapes.map((shape, i) => {
            const done = ticked.has(i)
            return (
              <li key={i}>
                <button
                  onClick={() => {
                    haptic.light()
                    setTicked(prev => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i); else next.add(i)
                      return next
                    })
                  }}
                  className="w-full flex items-start gap-2.5 text-left py-2 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/[0.04]"
                >
                  <span
                    className="mt-0.5 h-4 w-4 rounded-[5px] flex-shrink-0 flex items-center justify-center border"
                    style={done
                      ? { background: 'rgba(var(--brand-primary-rgb),0.9)', borderColor: 'rgba(var(--brand-primary-rgb),0.9)' }
                      : { borderColor: 'var(--glass-border-bold)' }}
                  >
                    {done && <Check size={11} strokeWidth={3} style={{ color: '#0b1220' }} />}
                  </span>
                  <span
                    className="text-sm leading-snug flex-1"
                    style={done ? { ...secondaryTextStyle, textDecoration: 'line-through', opacity: 0.45 } : undefined}
                  >
                    {shape.text}
                    {shape.partial && (
                      <span className="text-xs" style={secondaryTextStyle}> — a first piece, not the whole thing</span>
                    )}
                  </span>
                  {shape.source === 'friction' && (
                    <Wrench size={12} className="mt-0.5 flex-shrink-0" style={{ ...secondaryTextStyle, opacity: 0.4 }} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <button
          className="w-full py-2 rounded-lg border text-sm flex items-center justify-center gap-2"
          style={borderStyle}
          onClick={handleStop}
        >
          <Square size={14} /> Stop
        </button>
      </div>
    )
  }

  // ─── planning ──────────────────────────────────────────────────────
  // Two minutes, spent deciding, visibly. The layout has one job: make it
  // obvious what you can change and how, without becoming a form.
  //
  //   the plan        — numbered, each row swappable in place
  //   say what's off  — one input, for the cases a swap can't express
  //   Start           — the only filled button on screen
  //
  // An earlier cut had nine tap targets here (five dim x glyphs, a big
  // "Tap to talk", a text field, Start, Not now) with no hierarchy between
  // them. That's the menu the whole spec exists to avoid, at the exact
  // moment the user is trying to stop deciding.
  if (phase === 'planning') {
    const items = plan?.projectId === project.id ? plan.items : []
    // Swapping a single row for a bench spare only makes sense when the
    // items are interchangeable AI suggestions ("same quality, different
    // angles" per the shape prompt). When the plan is the user's own task
    // list verbatim (source 'tasks'), position is the order they actually
    // left the tasks in -- a real sequence, not a pool to shuffle. Putting
    // a later task into an earlier slot silently breaks that sequence.
    const canSwap = (plan?.bench.length ?? 0) > 0 && plan?.source !== 'tasks'
    const needsInput = plan?.projectId === project.id ? plan.needsInput : null
    const elapsedFrac = planLeft == null ? 0 : 1 - planLeft / planningSecondsFor(windowMinutes)

    return (
      <div className={shell('space-y-4')}>
        {/* The clock is the frame, not an ornament: a bar that drains, so
            the two minutes are felt peripherally rather than watched. A
            plan that's already the task list verbatim has nothing to
            shape, so there's no clock at all -- just review at your own
            pace and go. */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{project.title}</span>
            <span className="text-xs tabular-nums flex items-center gap-1.5" style={secondaryTextStyle}>
              {planLeft != null && !skipTimer && (
                <>
                  {/* Three distinct states, said plainly. "shaping" for all
                      of them was a lie in two of the three cases — nothing
                      is being shaped while you're mid-sentence. */}
                  <span style={planBusy ? { opacity: 0.45 } : undefined}>
                    {shaping
                      ? 'redoing the list…'
                      : plan?.needsInput
                        ? 'over to you'
                        : planBusy
                          ? 'paused'
                          : `${formatClock(planLeft)} to shape`}
                  </span>
                  <span style={{ opacity: 0.3 }}>·</span>
                </>
              )}
              <span>{windowMinutes ? `${windowMinutes < 60 ? `${windowMinutes}m` : `${windowMinutes / 60}h`} session` : 'session'}</span>
            </span>
          </div>
          {!skipTimer && (
            <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${Math.min(elapsedFrac, 1) * 100}%`,
                  background: 'rgba(var(--brand-primary-rgb),0.55)',
                }}
              />
            </div>
          )}
        </div>

        {/* The setup step, when this project genuinely has one -- shown
            above the real tasks since it comes first, but visually
            distinct so it doesn't read as one of them. */}
        {plan?.friction && (
          <div className="flex items-center gap-2 text-sm" style={secondaryTextStyle}>
            <Wrench size={13} className="flex-shrink-0" style={{ opacity: 0.5 }} />
            <span>{plan.friction.text}</span>
            <span className="text-xs flex-shrink-0" style={{ opacity: 0.5 }}>{plan.friction.minutes}m</span>
          </div>
        )}

        {shaping && items.length === 0 ? (
          <p className="text-sm" style={secondaryTextStyle}>Working out what to do…</p>
        ) : items.length === 0 ? (
          // One message, not two. The red error line below is suppressed in
          // this state -- saying "couldn't shape a list" and "could not
          // shape a list just now" one above the other reads as two
          // separate things going wrong.
          <div className="space-y-2">
            <p className="text-sm" style={secondaryTextStyle}>
              Couldn't shape a list. Start anyway and say what you did at the end.
            </p>
            <button
              className="text-xs underline"
              style={{ color: 'rgb(var(--brand-primary-rgb))' }}
              onClick={() => { void shapePlan(project.id, windowMinutes) }}
            >
              Try again
            </button>
          </div>
        ) : (
          <ol className="space-y-0.5" style={shaping ? { opacity: 0.45 } : undefined}>
            {items.map((item, i) => (
              <li key={`${i}-${item.text}`}>
                {/* The whole row is the swap target. A 13px glyph at 30%
                    opacity was both invisible and a miss risk on a phone;
                    the row is 44px of hit area and the icon is a label for
                    it, not the control. */}
                <button
                  onClick={() => { haptic.light(); swapPlanItem(i) }}
                  disabled={!canSwap || shaping}
                  className="w-full flex items-start gap-2.5 text-left py-2 px-2 -mx-2 rounded-lg transition-colors enabled:hover:bg-white/[0.04] disabled:cursor-default"
                >
                  <span
                    className="mt-0.5 text-[11px] tabular-nums font-semibold flex-shrink-0 w-4"
                    style={{ color: 'rgba(var(--brand-primary-rgb),0.8)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-sm leading-snug block">{item.text}</span>
                    {/* The receipt. Every line either points at something
                        you actually said, or says nothing that needs a
                        source. Seeing which is which at a glance is the
                        difference between a list you can act on and one
                        you have to fact-check first. */}
                    {item.source && (
                      <span
                        className="text-[10.5px] leading-tight block mt-0.5"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                      >
                        {item.source}
                      </span>
                    )}
                  </span>
                  {canSwap && (
                    <Shuffle
                      size={13}
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}

        {/* The app ran out of things it actually knows. It says so and asks,
            rather than filling the gap with plausible invention -- one made
            up line costs the whole list its credibility, because you then
            have to check every other line yourself. The answer is saved to
            the project, so it has to ask less next time. */}
        {needsInput ? (
          <div
            className="rounded-xl px-3.5 py-3 space-y-1"
            style={{
              background: 'rgba(var(--brand-primary-rgb),0.06)',
              border: '1px solid rgba(var(--brand-primary-rgb),0.20)',
            }}
          >
            <p className="text-sm leading-snug">{needsInput}</p>
            <p className="text-[11px]" style={{ ...secondaryTextStyle, opacity: 0.5 }}>
              I'll only suggest things you've actually told me about.
            </p>
          </div>
        ) : items.length > 0 ? (
          <p className="text-xs" style={{ ...secondaryTextStyle, opacity: 0.45 }}>
            {plan?.source === 'derived'
              ? 'Offline list — built from your last close-out, not shaped.'
              : plan?.source === 'tasks'
                ? 'Straight from your task list.'
                : canSwap
                  ? 'Tap any line to swap it. Say what\u2019s off to redo the lot.'
                  : 'Say what\u2019s off and it\u2019ll redo the list.'}
          </p>
        ) : null}

        {!!plan?.truncatedCount && (
          <p className="text-xs" style={{ ...secondaryTextStyle, opacity: 0.4 }}>
            +{plan.truncatedCount} more on your list, not shown today.
          </p>
        )}

        {/* Voice by default, listening the moment there's a list to react
            to; typing is what you opt into. Remounted on every new list
            (the key) so it starts listening again each time it's your
            turn, rather than only once at the very first render. */}
        {voiceTurn ? (
          <div className="space-y-1.5">
            <VoiceInput
              key={items.map(i => i.text).join('|')}
              onTranscript={t => { void sendToPlan(t) }}
              onRecordingChange={setRecording}
              autoStart
              autoSubmit
              maxDuration={30}
            />
            <button
              type="button"
              onClick={() => setPrefersText(true)}
              className="flex items-center gap-1 text-[11px] mx-auto transition-all"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
            >
              <Keyboard className="h-3 w-3" /> type instead
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-1.5 border"
            style={borderStyle}
          >
            <button
              type="button"
              onClick={() => setPrefersText(false)}
              aria-label="Switch to voice"
              className="flex-shrink-0 p-1"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
            >
              <Mic size={16} />
            </button>
            <input
              value={steer}
              onChange={e => setSteer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSteer() }}
              placeholder={needsInput ? 'Tell it what you\u2019re doing\u2026' : 'Too much for an hour\u2026'}
              disabled={shaping}
              className="flex-1 bg-transparent text-sm outline-none disabled:opacity-50 py-1.5"
              style={{ color: 'var(--brand-text-primary)' }}
            />
            <button onClick={submitSteer} disabled={shaping || !steer.trim()} className="disabled:opacity-30 p-1 flex-shrink-0">
              <ArrowUp size={16} style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
            </button>
          </div>
        )}

        <div className="space-y-2 pt-0.5">
          <button
            className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={primaryButtonStyle}
            disabled={starting || shaping}
            onClick={() => { haptic.medium(); void beginWork() }}
          >
            {starting
              ? 'Starting…'
              : items.length === 0
                ? 'Start anyway'
                : `Start \u2014 ${items.length} thing${items.length === 1 ? '' : 's'}`}
          </button>
          <button
            className="w-full text-xs"
            style={{ ...secondaryTextStyle, opacity: 0.5 }}
            onClick={() => { clearPlan(); onDone() }}
          >
            Not now
          </button>
        </div>

        {error && items.length > 0 && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }

  // ─── window ────────────────────────────────────────────────────────
  // A gate, deliberately: the list is sized to the window, so there is
  // nothing to show until it's answered.
  return (
    <div className={shell('space-y-4')}>
      <p className="text-base font-medium">{project.title}</p>
      <ReEntry project={project} />
      <div className="space-y-2">
        <p className="text-sm" style={secondaryTextStyle}>How long have you got?</p>
        <div className="flex gap-2">
          {WINDOW_PRESETS.map(m => (
            <button
              key={m}
              className="px-4 py-2 rounded-full text-sm border"
              style={borderStyle}
              onClick={() => handlePickWindow(m)}
            >
              {m < 60 ? `${m}m` : `${m / 60}h`}
            </button>
          ))}
        </div>
        <VoiceInput
          onTranscript={text => {
            const minutes = parseInt(text.replace(/\D/g, ''), 10)
            if (!Number.isNaN(minutes) && minutes > 0) handlePickWindow(minutes)
          }}
          maxDuration={10}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
