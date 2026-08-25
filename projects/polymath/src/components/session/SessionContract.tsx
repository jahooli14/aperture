/**
 * SessionContract — the execution session, per SPEC.md.
 *
 * Opening (target: two minutes):
 *   1. Re-entry playback: the project's last close-out, in its own words.
 *   2. One guess, not a menu — this project, stated plainly.
 *   3. The one thing the app can't know: how long you've got.
 *   4. Contract: 1-3 derived shapes, timer starts.
 *
 * Voice throughout — the window and the close-out are both spoken, never
 * typed, per "you never write a to-do list."
 *
 * Styling follows theme.css's real tokens (--brand-primary-rgb,
 * --brand-text-secondary, --glass-border-bold) rather than ad hoc CSS
 * variables, matching TodaysAnswerCard's "Start session" button exactly.
 */

import { useEffect, useRef, useState } from 'react'
import { Clock, Square } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import { useSessionStore, type SessionShape } from '../../stores/useSessionStore'
import type { Project } from '../../types'

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Quick taps for the one thing the app can't know. Voice covers anything else. */
const WINDOW_PRESETS = [20, 60, 120]

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

function ShapeList({ shapes }: { shapes: SessionShape[] }) {
  return (
    <ul className="space-y-2 mt-4">
      {shapes.map((shape, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span
            className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ background: 'rgb(var(--brand-primary-rgb))' }}
          />
          <span>
            {shape.text}
            {shape.partial && (
              <span className="text-xs" style={secondaryTextStyle}> — a first piece, not the whole thing</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

type Phase = 'window' | 'running' | 'closeout' | 'done'

export function SessionContract({
  project,
  onDone,
  source = 'live',
}: {
  project: Project
  onDone: () => void
  /** 'different-thing' for the monthly quota session -- doesn't touch the
   *  live-project declaration, just tags the logged session so the mirror
   *  and the quota check (different-thing.ts) can find it. */
  source?: 'live' | 'different-thing'
}) {
  const { active, starting, closing, error, startSession, closeSession } = useSessionStore()
  const [phase, setPhase] = useState<Phase>('window')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [closeoutText, setCloseoutText] = useState('')
  const [mvsSeedMinutes, setMvsSeedMinutes] = useState<number | null>(null)
  const tickRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'running') return
    tickRef.current = window.setInterval(() => setElapsedSec(s => s + 1), 1000)
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current)
    }
  }, [phase])

  const handlePickWindow = async (minutes: number) => {
    await startSession(project.id, minutes, source)
    setElapsedSec(0)
    setPhase('running')
  }

  const handleStop = () => setPhase('closeout')

  const handleSubmitCloseout = async () => {
    const result = await closeSession(closeoutText, mvsSeedMinutes ?? undefined)
    if (result) setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <p className="text-base">Logged.</p>
        <button className="text-sm underline" style={{ color: 'rgb(var(--brand-primary-rgb))' }} onClick={onDone}>
          Close
        </button>
      </div>
    )
  }

  if (phase === 'closeout') {
    return (
      <div className="glass-card p-6 space-y-4">
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
        <VoiceInput onTranscript={setCloseoutText} autoSubmit={false} maxDuration={30} />
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

  if (phase === 'running' && active) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm" style={secondaryTextStyle}>{project.title}</span>
          <span className="flex items-center gap-1 text-lg tabular-nums">
            <Clock size={16} />
            {formatElapsed(elapsedSec)}
          </span>
        </div>
        <ShapeList shapes={active.shapes} />
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

  // phase === 'window'
  return (
    <div className="glass-card p-6 space-y-4">
      <p className="text-base font-medium">{project.title}</p>
      <ReEntry project={project} />
      <div className="space-y-2">
        <p className="text-sm" style={secondaryTextStyle}>How long have you got?</p>
        <div className="flex gap-2">
          {WINDOW_PRESETS.map(m => (
            <button
              key={m}
              disabled={starting}
              className="px-4 py-2 rounded-full text-sm border disabled:opacity-50"
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
