/**
 * Before the session: one move, not a list.
 *
 * In creative work the next step comes out of the last one, so a list
 * written up front is out of date by item two. This screen leads with the
 * FIRST move -- big, in the medium's own verbs, with its "Done when" --
 * and lets the rest sit underneath, quiet. If the first move is wrong you
 * say so in one tap ("too big", "wrong thing") or in your own words, and
 * the plan is redone from what's real. Then one button: Go.
 *
 * No countdown. Deciding is allowed to take the ten seconds it takes.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUp, Flag, Loader2, Minimize2, Shuffle, Wrench } from 'lucide-react'
import { VoiceInput } from '../../VoiceInput'
import { WINDOW_PRESETS, type PlanDraft } from '../../../stores/useSessionStore'
import { splitDoneWhen, moveKind, MOVE_LABEL, RESHAPE_ASKS } from '../sessionRunOps'
import { accent, accentA, faint, label, primaryButton, quietButton, serif, text2, windowLabel } from './ui'

interface Props {
  title: string
  /** The last close-out, in their own words. */
  lastNote: string | null
  windowMinutes: number | null
  plan: PlanDraft | null
  shaping: boolean
  starting: boolean
  online: boolean
  error: string | null
  onPickWindow: (minutes: number) => void
  onGo: () => void
  onReshape: (instruction: string) => void
  onAnswer: (answer: string) => void
  onRetry: () => void
  onNotNow: () => void
}

export function MovePlan(props: Props) {
  const { title, lastNote, windowMinutes } = props

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold leading-tight">{title}</p>
        {windowMinutes != null && (
          <span className="text-[11px] flex-shrink-0" style={faint(0.55)}>{windowLabel(windowMinutes)}</span>
        )}
      </div>

      {lastNote && (
        <div className="pl-3" style={{ borderLeft: `2px solid ${accentA(0.35)}` }}>
          <p className={`${label} mb-1`} style={faint(0.45)}>Last time you said</p>
          <p className="text-[15px] leading-snug italic" style={{ ...text2, ...serif }}>“{lastNote}”</p>
        </div>
      )}

      {windowMinutes == null ? <WindowPicker onPick={props.onPickWindow} /> : <Plan {...props} />}
    </div>
  )
}

function WindowPicker({ onPick }: { onPick: (minutes: number) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-base">How long have you got?</p>
      <div className="flex gap-2">
        {WINDOW_PRESETS.map(m => (
          <button
            key={m}
            className="flex-1 py-3 rounded-2xl text-sm font-medium transition-transform active:scale-[0.97]"
            style={quietButton}
            onClick={() => onPick(m)}
          >
            {m < 60 ? `${m}m` : `${m / 60}h`}
          </button>
        ))}
      </div>
      <VoiceInput
        onTranscript={text => {
          const minutes = parseInt(text.replace(/\D/g, ''), 10)
          if (!Number.isNaN(minutes) && minutes > 0) onPick(minutes)
        }}
        maxDuration={10}
      />
    </div>
  )
}

function Plan({ plan, shaping, starting, online, error, windowMinutes, onGo, onReshape, onAnswer, onRetry, onNotNow }: Props) {
  const [say, setSay] = useState('')
  const items = plan?.items ?? []
  const first = items[0] ?? null
  const rest = items.slice(1)
  const question = plan?.needsInput ?? null

  const send = (text: string) => {
    const clean = text.trim()
    if (!clean || shaping) return
    setSay('')
    if (question) onAnswer(clean)
    else onReshape(clean)
  }

  if (!plan && shaping) return <Finding />
  if (shaping && items.length === 0) return <Finding />

  return (
    <div className="space-y-5">
      {plan?.planned ? (
        <p className="text-[12.5px]" style={faint(0.6)}>
          Planned {plan.planned} new step{plan.planned === 1 ? '' : 's'} from where you left off.
        </p>
      ) : null}
      {plan?.unblocked && (
        <p className="text-[12.5px] leading-snug" style={faint(0.6)}>
          {plan.unblocked.added ? 'Added a step that has to come first' : 'Moved a step up'}: “{plan.unblocked.before}” needs “{plan.unblocked.text}” done before it.
        </p>
      )}
      {plan?.removed && plan.removed.length > 0 && (
        <p className="text-[12.5px] leading-snug" style={faint(0.6)}>
          Taken off the project: {plan.removed.map(r => `“${r.text}”`).join(', ')}.
        </p>
      )}

      {question ? (
        <div className="rounded-2xl p-4 space-y-1" style={{ background: accentA(0.07), border: `1px solid ${accentA(0.22)}` }}>
          <p className="text-[17px] leading-snug" style={serif}>{question}</p>
          <p className="text-[11px]" style={faint(0.5)}>I only suggest things you've actually told me about.</p>
        </div>
      ) : first ? (
        <>
          {plan?.friction && (
            <p className="flex items-center gap-2 text-[13px]" style={faint(0.65)}>
              <Wrench size={13} className="flex-shrink-0" />
              Setup first: {plan.friction.text} · {plan.friction.minutes}m
            </p>
          )}
          <FirstMove text={first.text} kind={moveKind(first.taskId)} source={first.source} dim={shaping} />
          {rest.length > 0 && (
            <div className="space-y-1.5" style={shaping ? { opacity: 0.4 } : undefined}>
              <p className={label} style={faint(0.4)}>Then, if there's time</p>
              {rest.map((item, i) => (
                <p key={`${i}-${item.text}`} className="text-[13.5px] leading-snug flex gap-2" style={faint(0.62)}>
                  <span className="tabular-nums" style={{ color: accentA(0.6) }}>{i + 2}</span>
                  {splitDoneWhen(item.text).move}
                </p>
              ))}
            </div>
          )}
          {plan?.packdown && (
            <p className="flex items-center gap-2 text-[12.5px]" style={faint(0.5)}>
              <Wrench size={12} className="flex-shrink-0" />
              To finish: {plan.packdown.text} · {plan.packdown.minutes}m
            </p>
          )}
          {plan?.doneLooksLike && plan.source !== 'tasks' && (
            <p className="text-[13px] leading-snug" style={faint(0.6)}>
              <span className={`${label} mr-2`} style={{ opacity: 0.7 }}>By the end</span>
              {plan.doneLooksLike}
            </p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm" style={faint(0.7)}>
            Couldn't find a first move. Start anyway and say what you did at the end.
          </p>
          <button className="text-xs underline" style={{ color: accent }} onClick={onRetry}>Try again</button>
        </div>
      )}

      {plan?.source === 'offline' && (
        <p className="text-[11.5px]" style={faint(0.45)}>Offline — this is your list as it stands. Reconnect to change it.</p>
      )}

      <button
        className="w-full py-3.5 rounded-2xl text-[15px] font-semibold disabled:opacity-50 transition-transform active:scale-[0.99]"
        style={primaryButton}
        disabled={starting || shaping}
        onClick={onGo}
      >
        {starting ? 'Starting…' : first ? `Go — ${windowLabel(windowMinutes)}` : 'Start anyway'}
      </button>

      {online && (
        <div className="space-y-2.5">
          {first && !question && (
            <div className="flex gap-2">
              <button
                className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={quietButton}
                disabled={shaping}
                onClick={() => onReshape(RESHAPE_ASKS.tooBig)}
              >
                <Minimize2 size={13} /> Too big
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-[12.5px] flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={quietButton}
                disabled={shaping}
                onClick={() => onReshape(RESHAPE_ASKS.wrongThing)}
              >
                <Shuffle size={13} /> Wrong thing
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl pl-3 pr-1.5 py-1" style={quietButton}>
            <input
              value={say}
              onChange={e => setSay(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(say) }}
              placeholder={question ? 'Tell it what you’re doing…' : 'Or say what’s off…'}
              disabled={shaping}
              className="flex-1 bg-transparent text-[13px] outline-none py-1.5 disabled:opacity-50"
              style={{ color: 'var(--brand-text-primary)' }}
            />
            {say.trim() ? (
              <button onClick={() => send(say)} disabled={shaping} className="p-1.5 disabled:opacity-30" aria-label="Send">
                <ArrowUp size={16} style={{ color: accent }} />
              </button>
            ) : (
              <VoiceInput variant="icon" onTranscript={send} autoSubmit maxDuration={30} />
            )}
          </div>
        </div>
      )}

      {shaping && (
        <p className="text-[12px] flex items-center gap-1.5" style={faint(0.55)}>
          <Loader2 size={12} className="animate-spin" /> Reworking it…
        </p>
      )}
      {error && items.length > 0 && <p className="text-xs text-red-400">{error}</p>}

      <button className="w-full text-[12px]" style={faint(0.45)} onClick={onNotNow}>Not now</button>
    </div>
  )
}

function FirstMove({ text, kind, source, dim }: { text: string; kind: ReturnType<typeof moveKind>; source: string | null; dim: boolean }) {
  const { move, doneWhen } = splitDoneWhen(text)
  // A real step needs no receipt -- it's just the next thing on the list.
  // Anything the app added says so, so it never passes as yours.
  const note = kind !== 'step' && kind !== 'reentry' && source ? source : null
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dim ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl p-5 space-y-3"
      style={{
        background: `linear-gradient(160deg, ${accentA(0.12)}, rgba(255,255,255,0.02))`,
        border: `1px solid ${accentA(0.28)}`,
      }}
    >
      <p className={label} style={{ color: accent, opacity: 0.85 }}>{MOVE_LABEL[kind]}</p>
      <p className="text-[22px] leading-[1.25]" style={{ ...serif, color: 'var(--brand-text-primary)' }}>{move}</p>
      {doneWhen && (
        <p className="flex items-start gap-2 text-[13px] leading-snug" style={faint(0.75)}>
          <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: accentA(0.8) }} />
          {doneWhen}
        </p>
      )}
      {note && <p className="text-[11px]" style={faint(0.5)}>{note}</p>}
    </motion.div>
  )
}

function Finding() {
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className={label} style={faint(0.45)}>First move</p>
      <div className="space-y-2 animate-pulse">
        <div className="h-5 rounded-md w-11/12" style={{ background: 'rgba(255,255,255,0.07)' }} />
        <div className="h-5 rounded-md w-3/5" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>
      <p className="text-[12px]" style={faint(0.5)}>Finding the first move…</p>
    </div>
  )
}
