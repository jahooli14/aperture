/**
 * The breadcrumb. Twenty seconds of voice at the end: where you stopped,
 * what's next, what's bugging you. It's the most valuable thing the app
 * ever hears -- it becomes the first thing you see next time, so the next
 * session starts mid-sentence instead of from cold (Hemingway's trick).
 *
 * What you ticked is shown, not typed into the box: the box is for the
 * note to your future self, and a list of what you did is a worse opening
 * line than "stopped halfway through the second verse".
 */

import { Check, Keyboard, Mic } from 'lucide-react'
import { VoiceInput } from '../../VoiceInput'
import { splitDoneWhen } from '../sessionRunOps'
import { accent, accentA, faint, label, primaryButton, serif } from './ui'

interface Props {
  question: string
  placeholder: string
  /** A normal session gets the three prompts; a short, empty one is asked
   *  what got in the way instead, and the prompts would be wrong there. */
  showPrompts: boolean
  did: string[]
  text: string
  onText: (updater: (prev: string) => string) => void
  voice: boolean
  onVoice: (on: boolean) => void
  askMvsSeed: boolean
  mvsSeed: number | null
  onMvsSeed: (minutes: number) => void
  saving: boolean
  error: string | null
  onSave: () => void
  onBack: () => void
}

export function Breadcrumb(p: Props) {
  return (
    <div className="flex-1 flex flex-col py-6 space-y-6">
      <div className="space-y-2">
        <p className={label} style={{ color: accent, opacity: 0.85 }}>Note for next time</p>
        <p className="text-[26px] leading-[1.2]" style={serif}>{p.question}</p>
        {p.showPrompts && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {['Where you stopped', 'What’s next', 'What’s bugging you'].map(t => (
              <span key={t} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: accentA(0.08), color: accentA(0.9) }}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {p.did.length > 0 && (
        <div className="space-y-1.5">
          <p className={label} style={faint(0.4)}>You did</p>
          {p.did.map((t, i) => (
            <p key={i} className="flex items-start gap-2 text-[13.5px] leading-snug" style={faint(0.75)}>
              <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: accent }} />
              {splitDoneWhen(t).move}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {p.voice ? (
          <VoiceInput onTranscript={t => p.onText(c => (c ? `${c} ${t}` : t))} autoStart autoSubmit={false} maxDuration={45} />
        ) : null}
        <textarea
          value={p.text}
          onChange={e => { const v = e.target.value; p.onText(() => v) }}
          placeholder={p.placeholder}
          rows={3}
          className="w-full rounded-2xl px-4 py-3 text-[14px] bg-transparent resize-none outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'var(--brand-text-primary)' }}
        />
        <button
          type="button"
          onClick={() => p.onVoice(!p.voice)}
          className="flex items-center gap-1.5 text-[11px] mx-auto"
          style={faint(0.45)}
        >
          {p.voice ? <><Keyboard size={12} /> type instead</> : <><Mic size={12} /> say it instead</>}
        </button>
      </div>

      {p.askMvsSeed && (
        <div className="space-y-2">
          <p className="text-[13px]" style={faint(0.65)}>How long do you usually need to get going on this?</p>
          <div className="flex gap-2">
            {[10, 20, 40].map(m => (
              <button
                key={m}
                className="px-3.5 py-1.5 rounded-full text-[12.5px]"
                style={p.mvsSeed === m
                  ? { background: accentA(0.16), border: `1px solid ${accentA(0.45)}`, color: accent }
                  : { border: '1px solid rgba(255,255,255,0.12)', color: 'var(--brand-text-secondary)' }}
                onClick={() => p.onMvsSeed(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />
      <div className="space-y-3">
        <button
          className="w-full py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50"
          style={primaryButton}
          disabled={p.saving}
          onClick={p.onSave}
        >
          {p.saving ? 'Saving…' : p.text.trim() ? 'Save note' : 'Skip the note'}
        </button>
        <button className="w-full text-[12.5px]" style={faint(0.5)} onClick={p.onBack}>Not done yet — back to it</button>
        {p.error && <p className="text-xs text-red-400 text-center">{p.error}</p>}
      </div>
    </div>
  )
}
