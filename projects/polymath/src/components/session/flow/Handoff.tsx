/**
 * The hand-off. What the session changed, and -- the part that matters --
 * what the next one starts with. Seeing your own note waiting for you is
 * what makes leaving it worth the twenty seconds.
 */

import { Check, Flag } from 'lucide-react'
import type { CloseResult } from '../../../stores/useSessionStore'
import { splitDoneWhen } from '../sessionRunOps'
import { accent, faint, label, primaryButton, serif } from './ui'

interface Props {
  result: CloseResult
  /** The note they just left, if any. */
  note: string
  minutes: number
  busy: boolean
  onClose: () => void
  onFinish: () => void
  onNextCycle: () => void
}

export function Handoff({ result, note, minutes, busy, onClose, onFinish, onNextCycle }: Props) {
  const startsWith = result.nextAdded[0] ?? null
  const done = [...result.markedDone, ...result.created]

  return (
    <div className="flex-1 flex flex-col py-6 space-y-7">
      <div className="space-y-1">
        <p className={label} style={{ color: accent, opacity: 0.85 }}>
          {minutes > 0 ? `${minutes} minute${minutes === 1 ? '' : 's'} logged` : 'Logged'}
        </p>
        {result.pendingSync && (
          <p className="text-[12.5px]" style={faint(0.55)}>Saved on this phone. It’ll sync when you’re back online.</p>
        )}
      </div>

      {(startsWith || note.trim()) && (
        <div className="space-y-2">
          <p className={label} style={faint(0.45)}>Next time starts with</p>
          <p className="text-[24px] leading-[1.25]" style={serif}>
            {startsWith ? splitDoneWhen(startsWith).move : `“${note.trim()}”`}
          </p>
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1.5">
          <p className={label} style={faint(0.4)}>Done</p>
          {done.map((t, i) => (
            <p key={i} className="flex items-start gap-2 text-[13.5px] leading-snug" style={faint(0.75)}>
              <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: accent }} />
              {splitDoneWhen(t).move}
            </p>
          ))}
        </div>
      )}

      {result.progressNoted.length > 0 && (
        <div className="space-y-1.5">
          <p className={label} style={faint(0.4)}>Part way</p>
          {result.progressNoted.map((t, i) => (
            <p key={i} className="text-[13px] leading-snug" style={faint(0.6)}>{t}</p>
          ))}
        </div>
      )}

      {result.cycle && (
        <Panel title={`${result.cycle.label} done`} body={result.cycle.reason} />
      )}
      {result.finish && (
        <Panel
          title={result.finish.reached ? 'That’s the finish line' : 'Plan’s done, project isn’t'}
          body={result.finish.reason}
          foot={result.finish.reached ? null : 'Next session starts by planning the rest.'}
        />
      )}

      <div className="flex-1" />
      <div className="space-y-3">
        {result.cycle ? (
          <>
            <button className="w-full py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50" style={primaryButton} disabled={busy} onClick={onNextCycle}>
              {busy ? 'Lining it up…' : 'Line up the next one'}
            </button>
            <button className="w-full text-[12.5px]" style={faint(0.5)} onClick={onClose}>Leave it for now</button>
          </>
        ) : result.finish?.reached ? (
          <>
            <button className="w-full py-4 rounded-2xl text-[15px] font-semibold" style={primaryButton} onClick={onFinish}>Mark it finished</button>
            <button className="w-full text-[12.5px]" style={faint(0.5)} onClick={onClose}>Not yet</button>
          </>
        ) : (
          <button className="w-full py-4 rounded-2xl text-[15px] font-semibold" style={primaryButton} onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  )
}

function Panel({ title, body, foot }: { title: string; body: string; foot?: string | null }) {
  return (
    <div className="rounded-2xl px-4 py-3.5 space-y-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <p className={`${label} flex items-center gap-1.5`} style={faint(0.7)}><Flag size={11} /> {title}</p>
      <p className="text-[14px] leading-snug">{body}</p>
      {foot && <p className="text-[11.5px]" style={faint(0.5)}>{foot}</p>}
    </div>
  )
}
