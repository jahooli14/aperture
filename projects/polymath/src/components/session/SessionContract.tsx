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

function ReEntry({ project }: { project: Project }) {
  if (!project.last_closeout_text) {
    return (
      <p className="text-sm text-[var(--text-secondary,#9a9a9a)]">
        First session on this one.
      </p>
    )
  }
  return (
    <p className="text-sm text-[var(--text-secondary,#9a9a9a)] italic">
      "{project.last_closeout_text}"
    </p>
  )
}

function ShapeList({ shapes }: { shapes: SessionShape[] }) {
  return (
    <ul className="space-y-2 mt-4">
      {shapes.map((shape, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent,#c9a876)] flex-shrink-0" />
          <span>
            {shape.text}
            {shape.partial && (
              <span className="text-xs text-[var(--text-tertiary,#777)]"> — a first piece, not the whole thing</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

type Phase = 'window' | 'running' | 'closeout' | 'done'

export function SessionContract({ project, onDone }: { project: Project; onDone: () => void }) {
  const { active, starting, closing, error, startSession, closeSession } = useSessionStore()
  const [phase, setPhase] = useState<Phase>('window')
  const [windowMinutes, setWindowMinutes] = useState<number | null>(null)
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
    setWindowMinutes(minutes)
    await startSession(project.id, minutes)
    setElapsedSec(0)
    setPhase('running')
  }

  const handleStop = () => setPhase('closeout')

  const handleCloseoutTranscript = async (text: string) => {
    setCloseoutText(text)
  }

  const handleSubmitCloseout = async () => {
    const result = await closeSession(closeoutText, mvsSeedMinutes ?? undefined)
    if (result) setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className="glass-card p-6 text-center space-y-3">
        <p className="text-base">Logged.</p>
        <button className="text-sm text-[var(--accent,#c9a876)] underline" onClick={onDone}>
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
            <p className="text-sm text-[var(--text-secondary,#9a9a9a)]">
              How long do you usually need to get going on this?
            </p>
            <div className="flex gap-2">
              {[10, 20, 40].map(m => (
                <button
                  key={m}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    mvsSeedMinutes === m ? 'bg-[var(--accent,#c9a876)] text-black' : 'border-[var(--border,#333)]'
                  }`}
                  onClick={() => setMvsSeedMinutes(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}
        <VoiceInput onTranscript={handleCloseoutTranscript} autoSubmit={false} maxDuration={30} />
        {closeoutText && (
          <p className="text-sm text-[var(--text-secondary,#9a9a9a)] italic">"{closeoutText}"</p>
        )}
        <button
          className="w-full py-2 rounded-lg bg-[var(--accent,#c9a876)] text-black text-sm font-medium disabled:opacity-50"
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
          <span className="text-sm text-[var(--text-secondary,#9a9a9a)]">{project.title}</span>
          <span className="flex items-center gap-1 text-lg tabular-nums">
            <Clock size={16} />
            {formatElapsed(elapsedSec)}
          </span>
        </div>
        <ShapeList shapes={active.shapes} />
        <button
          className="w-full py-2 rounded-lg border border-[var(--border,#333)] text-sm flex items-center justify-center gap-2"
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
        <p className="text-sm text-[var(--text-secondary,#9a9a9a)]">How long have you got?</p>
        <div className="flex gap-2">
          {WINDOW_PRESETS.map(m => (
            <button
              key={m}
              disabled={starting}
              className="px-4 py-2 rounded-full text-sm border border-[var(--border,#333)] hover:border-[var(--accent,#c9a876)] disabled:opacity-50"
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
