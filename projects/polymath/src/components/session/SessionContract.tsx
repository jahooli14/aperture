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
import { Clock, Square, ArrowUp, X, Check } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import { useSessionStore, WINDOW_PRESETS, PLANNING_SECONDS } from '../../stores/useSessionStore'
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

type Phase = 'window' | 'planning' | 'running' | 'closeout' | 'done'

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
    shapePlan, reshapePlan, dropPlanItem, clearPlan, startSession, closeSession,
  } = useSessionStore()

  const [phase, setPhase] = useState<Phase>(presetWindowMinutes != null ? 'planning' : 'window')
  const [windowMinutes, setWindowMinutes] = useState<number | null>(presetWindowMinutes)
  const [planLeft, setPlanLeft] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [steer, setSteer] = useState('')
  const [closeoutText, setCloseoutText] = useState('')
  const [mvsSeedMinutes, setMvsSeedMinutes] = useState<number | null>(null)

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
    await startSession(project.id, windowMinutes, source, items)
    setElapsedSec(0)
    setTicked(new Set())
    setPhase('running')
  }, [plan, project.id, windowMinutes, source, startSession])

  // The planning clock starts on the first thing you DO to the list, not
  // on arrival -- reading it isn't the part that needs a cap. Once it's
  // ticking it flips itself into the work at zero, which is what makes
  // shaping always-done rather than optional.
  const touchPlan = () => setPlanLeft(v => (v == null ? PLANNING_SECONDS : v))

  useEffect(() => {
    if (phase !== 'planning' || planLeft == null) return
    if (planLeft <= 0) { void beginWork(); return }
    const t = window.setTimeout(() => setPlanLeft(v => (v == null ? null : v - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [phase, planLeft, beginWork])

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

  const submitSteer = () => {
    const text = steer.trim()
    if (!text || shaping) return
    setSteer('')
    touchPlan()
    void reshapePlan(text)
  }

  const handleStop = () => {
    // A ticked list is the honest first draft of a close-out, so the box
    // is never empty at the exact moment attention is lowest.
    // Items already end in a full stop, so trim before joining — "from the
    // top.. Bounce the vocal." reads like a typo in your own words.
    const done = (active?.shapes ?? [])
      .filter((_, i) => ticked.has(i))
      .map(s => s.text.trim().replace(/[.!?]+$/, ''))
    if (done.length > 0) setCloseoutText(`Did: ${done.join('. ')}.`)
    setPhase('closeout')
  }

  const handleSubmitCloseout = async () => {
    const result = await closeSession(closeoutText, mvsSeedMinutes ?? undefined)
    if (result) setPhase('done')
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
        <VoiceInput onTranscript={t => setCloseoutText(c => (c ? `${c} ${t}` : t))} autoSubmit={false} maxDuration={30} />
        {closeoutText && (
          <p className="text-sm italic" style={secondaryTextStyle}>"{closeoutText}"</p>
        )}
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={closing || !closeoutText}
          onClick={handleSubmitCloseout}
        >
          {closing ? 'Saving…' : 'Done'}
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
                    className="text-sm leading-snug"
                    style={done ? { ...secondaryTextStyle, textDecoration: 'line-through', opacity: 0.45 } : undefined}
                  >
                    {shape.text}
                    {shape.partial && (
                      <span className="text-xs" style={secondaryTextStyle}> — a first piece, not the whole thing</span>
                    )}
                  </span>
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
  if (phase === 'planning') {
    const items = plan?.projectId === project.id ? plan.items : []
    return (
      <div className={shell('space-y-4')}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm" style={secondaryTextStyle}>
            {project.title}{windowMinutes ? ` · ${windowMinutes < 60 ? `${windowMinutes}m` : `${windowMinutes / 60}h`}` : ''}
          </span>
          {planLeft != null && (
            <span className="text-xs tabular-nums" style={secondaryTextStyle}>
              shaping · {formatClock(planLeft)}
            </span>
          )}
        </div>

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
          <ol className="space-y-1">
            {items.map((text, i) => (
              <li key={i} className="flex items-start gap-2.5 group">
                <span
                  className="mt-0.5 text-[11px] tabular-nums font-semibold flex-shrink-0 w-4"
                  style={{ color: 'rgba(var(--brand-primary-rgb),0.8)' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-snug flex-1">{text}</span>
                <button
                  onClick={() => { haptic.light(); touchPlan(); dropPlanItem(i) }}
                  aria-label={`Drop "${text}"`}
                  className="mt-0.5 opacity-30 hover:opacity-90 transition-opacity flex-shrink-0"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ol>
        )}

        {plan?.source === 'derived' && items.length > 0 && (
          <p className="text-xs" style={{ ...secondaryTextStyle, opacity: 0.5 }}>
            Offline list — built from your last close-out, not shaped.
          </p>
        )}

        {/* Say what's wrong with it. This is the whole reshape mechanism —
            no menus, no editing in place. Voice first: talking at a list
            is faster than typing at it, and this is the two minutes. */}
        <div className="space-y-2">
          <VoiceInput
            onTranscript={t => { touchPlan(); void reshapePlan(t) }}
            autoSubmit
            maxDuration={15}
          />
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 border"
            style={borderStyle}
            onFocus={touchPlan}
          >
            <input
              value={steer}
              onChange={e => setSteer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitSteer() }}
              placeholder="No — more like…"
              disabled={shaping}
              className="flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
              style={{ color: 'var(--brand-text-primary)' }}
            />
            <button onClick={submitSteer} disabled={!steer.trim() || shaping} className="disabled:opacity-30">
              <ArrowUp size={16} style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
            </button>
          </div>
        </div>

        <button
          className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={starting || shaping}
          onClick={() => { haptic.medium(); void beginWork() }}
        >
          {starting ? 'Starting…' : items.length > 0 ? `Start — ${items.length} things` : 'Start anyway'}
        </button>

        <button
          className="w-full text-xs underline"
          style={secondaryTextStyle}
          onClick={() => { clearPlan(); onDone() }}
        >
          Not now
        </button>

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
