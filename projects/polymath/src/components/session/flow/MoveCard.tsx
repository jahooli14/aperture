/**
 * Before the session: the one next move, already written.
 *
 * It was written when you stopped last time, from the note you left
 * (api/_lib/next-move.ts), so it's here the instant the app opens -- no
 * planning, no spinner, no "how long have you got". Read it, press Go.
 *
 * If it's wrong, say so in one tap ("too big", "wrong thing") or in your
 * own words, and a new one is written. Those answers are kept, so the next
 * move is written to your size.
 *
 * A brand-new project may get a question instead ("the pole, or the
 * wires?") -- when nothing is decided, a decision beats a step. Your
 * answer writes the first move.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Flag, Loader2, Minimize2, Shuffle } from 'lucide-react'
import { VoiceInput } from '../../VoiceInput'
import type { SessionMove, MoveChange } from '../../../stores/useSessionStore'
import { splitDoneWhen } from '../sessionRunOps'
import { accent, accentA, faint, label, primaryButton, quietButton, serif, text2 } from './ui'

interface Props {
  title: string
  lastNote: string | null
  move: SessionMove | null
  busy: boolean
  starting: boolean
  online: boolean
  error: string | null
  onGo: () => void
  onChange: (change: MoveChange) => void
  onNotNow: () => void
}

export function MoveCard({ title, lastNote, move, busy, starting, online, error, onGo, onChange, onNotNow }: Props) {
  const [say, setSay] = useState('')
  const fork = move?.kind === 'fork'

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean || busy) return
    setSay('')
    onChange(fork ? { action: 'answer', text: clean } : { action: 'say', text: clean })
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] font-semibold leading-tight">{title}</p>

      {lastNote && !fork && (
        <div className="pl-3" style={{ borderLeft: `2px solid ${accentA(0.35)}` }}>
          <p className={`${label} mb-1`} style={faint(0.45)}>You stopped with</p>
          <p className="text-[15px] leading-snug italic" style={{ ...text2, ...serif }}>“{lastNote}”</p>
        </div>
      )}

      {!move && busy ? <Writing /> : move ? (
        <MoveBlock move={move} dim={busy} />
      ) : (
        <p className="text-sm" style={faint(0.7)}>Couldn’t write a move just now. Start anyway and say what you did at the end.</p>
      )}

      {!fork && (
        <button
          className="w-full py-3.5 rounded-2xl text-[15px] font-semibold disabled:opacity-50 transition-transform active:scale-[0.99]"
          style={primaryButton}
          disabled={starting || busy}
          onClick={onGo}
        >
          {starting ? 'Starting…' : move ? 'Go' : 'Start anyway'}
        </button>
      )}

      {online && (
        <div className="space-y-2.5">
          {move && !fork && (
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={quietButton}
                disabled={busy}
                onClick={() => onChange({ action: 'feedback', reason: 'too_big' })}
              >
                <Minimize2 size={13} /> Too big
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={quietButton}
                disabled={busy}
                onClick={() => onChange({ action: 'feedback', reason: 'wrong_thing' })}
              >
                <Shuffle size={13} /> Wrong thing
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-1" style={fork ? { ...quietButton, border: `1px solid ${accentA(0.35)}` } : quietButton}>
            <input
              value={say}
              onChange={e => setSay(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(say) }}
              placeholder={fork ? 'Your answer…' : 'Or say what’s off…'}
              disabled={busy}
              className="flex-1 bg-transparent text-[13px] outline-none py-1.5 disabled:opacity-50"
              style={{ color: 'var(--brand-text-primary)' }}
            />
            {say.trim() ? (
              <button onClick={() => send(say)} disabled={busy} className="p-1.5 disabled:opacity-30" aria-label="Send">
                <ArrowUp size={16} style={{ color: accent }} />
              </button>
            ) : (
              <VoiceInput variant="icon" onTranscript={send} autoSubmit maxDuration={30} />
            )}
          </div>
        </div>
      )}

      {busy && move && (
        <p className="text-[12px] flex items-center gap-1.5" style={faint(0.55)}>
          <Loader2 size={12} className="animate-spin" /> Writing a new one…
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      <button className="w-full text-[12px]" style={faint(0.45)} onClick={onNotNow}>Not now</button>
    </div>
  )
}

function MoveBlock({ move, dim }: { move: SessionMove; dim: boolean }) {
  const fork = move.kind === 'fork'
  const { move: text, doneWhen } = fork ? { move: move.text, doneWhen: null } : splitDoneWhen(move.text)
  return (
    <motion.div
      key={move.text}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dim ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-5 space-y-3"
      style={{
        background: `linear-gradient(160deg, ${accentA(0.12)}, rgba(255,255,255,0.02))`,
        border: `1px solid ${accentA(0.28)}`,
      }}
    >
      <p className={label} style={{ color: accent, opacity: 0.85 }}>{fork ? 'First, decide' : 'Next move'}</p>
      <p className="text-[22px] leading-[1.25]" style={{ ...serif, color: 'var(--brand-text-primary)' }}>{text}</p>
      {doneWhen && (
        <p className="flex items-start gap-2 text-[13px] leading-snug" style={faint(0.75)}>
          <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: accentA(0.8) }} />
          {doneWhen}
        </p>
      )}
      {fork && <p className="text-[12px]" style={faint(0.55)}>Answer in a sentence. That becomes the first move.</p>}
    </motion.div>
  )
}

function Writing() {
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className={label} style={faint(0.45)}>Next move</p>
      <div className="space-y-2 animate-pulse">
        <div className="h-5 rounded-md w-11/12" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="h-5 rounded-md w-3/5" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>
      <p className="text-[12px]" style={faint(0.5)}>Writing the first move…</p>
    </div>
  )
}
