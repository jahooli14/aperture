/**
 * The work. One move on screen, big, with where it's done. Tap Done and
 * the next one slides in. The rest of the list is dots, not text: by the
 * time you get there it'll have changed, and reading ahead is how a
 * sitting turns into planning.
 *
 * Two ways out of the middle: "I'm stuck" (one move back in, never a new
 * plan) and Stop. When the list runs out or the time does, Stop becomes
 * the obvious button -- it never interrupts, it just gets easier.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Flag, Square, Wrench } from 'lucide-react'
import type { SessionShape } from '../../../stores/useSessionStore'
import { splitDoneWhen } from '../sessionRunOps'
import { StuckMove } from '../StuckMove'
import { accent, accentA, faint, formatClock, label, primaryButton, quietButton, serif } from './ui'

interface Props {
  projectId: string
  title: string
  shapes: SessionShape[]
  workIndexes: number[]
  ticked: Set<number>
  /** Seconds left in the window, or elapsed when there's no window. */
  clockSeconds: number
  hasWindow: boolean
  timeUp: boolean
  online: boolean
  stuckSignal: number
  onToggle: (index: number) => void
  onStop: () => void
  onMinimise: () => void
}

export function WorkView({
  projectId, title, shapes, workIndexes, ticked, clockSeconds, hasWindow, timeUp,
  online, stuckSignal, onToggle, onStop, onMinimise,
}: Props) {
  const currentIndex = workIndexes.find(i => !ticked.has(i)) ?? -1
  const current = currentIndex >= 0 ? shapes[currentIndex] : null
  const nextIndex = workIndexes.find(i => i !== currentIndex && !ticked.has(i) && workIndexes.indexOf(i) > workIndexes.indexOf(currentIndex))
  const next = nextIndex != null ? shapes[nextIndex] : null
  const allDone = currentIndex < 0 && workIndexes.length > 0
  const stopIsTheMove = timeUp || allDone

  return (
    <div className="flex-1 flex flex-col">
      {/* Top: where you are, how long is left, and a way to step out
          without stopping (capture a thought, check something). */}
      <div className="flex items-center justify-between gap-3 py-2">
        <button onClick={onMinimise} className="p-1.5 -ml-1.5 rounded-full" style={faint(0.6)} aria-label="Minimise session">
          <ChevronDown size={20} />
        </button>
        <p className="text-[12px] truncate flex-1 text-center" style={faint(0.55)}>{title}</p>
        <div className="text-right">
          <p
            className="text-[17px] tabular-nums font-medium leading-none"
            style={{ color: timeUp ? 'rgba(245,158,11,0.95)' : 'var(--brand-text-primary)' }}
          >
            {formatClock(clockSeconds)}
          </p>
          <p className="text-[11px] uppercase tracking-[0.14em] mt-1" style={faint(0.4)}>
            {timeUp ? 'over' : hasWindow ? 'left' : 'in'}
          </p>
        </div>
      </div>

      {/* Progress as dots. Tap one to un-tick it if you jumped the gun. */}
      <div className="flex gap-1.5 mt-3">
        {workIndexes.map(i => (
          <button
            key={i}
            onClick={() => ticked.has(i) && onToggle(i)}
            aria-label={ticked.has(i) ? 'Undo' : undefined}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: ticked.has(i) ? accentA(0.85) : i === currentIndex ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center py-10">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div
              key={`${currentIndex}-${current.text}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <p className={`${label} flex items-center gap-1.5`} style={{ color: accent, opacity: 0.85 }}>
                {current.source === 'friction' ? <><Wrench size={11} /> Setup</> : 'Now'}
              </p>
              <p className="text-[28px] leading-[1.2]" style={serif}>{splitDoneWhen(current.text).move}</p>
              {splitDoneWhen(current.text).doneWhen && (
                <p className="flex items-start gap-2 text-[14px] leading-snug" style={faint(0.75)}>
                  <Flag size={14} className="mt-0.5 flex-shrink-0" style={{ color: accentA(0.8) }} />
                  {splitDoneWhen(current.text).doneWhen}
                </p>
              )}
              {current.partial && (
                <p className="text-[12px]" style={faint(0.5)}>A piece of a bigger step — the rest keeps for next time.</p>
              )}
            </motion.div>
          ) : (
            <motion.div key="all-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <p className="text-[28px] leading-[1.2]" style={serif}>
                {allDone ? 'That’s the move done.' : 'Nothing on the list.'}
              </p>
              <p className="text-[15px] leading-snug" style={faint(0.6)}>
                {timeUp ? 'Good place to stop.' : 'Keep going while it’s flowing. When you stop, say where you got to — that’s next time’s move.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {next && (
        <p className="text-[12.5px] leading-snug mb-4 truncate" style={faint(0.45)}>
          <span className="uppercase tracking-[0.1em] text-[11px] mr-2">Then</span>
          {splitDoneWhen(next.text).move}
        </p>
      )}

      <div className="space-y-3">
        {current && !timeUp && (
          <button
            className="w-full py-4 rounded-2xl text-[16px] font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={primaryButton}
            onClick={() => onToggle(currentIndex)}
          >
            <Check size={18} strokeWidth={3} /> Done
          </button>
        )}
        {current && (
          <StuckMove projectId={projectId} step={current.source === 'friction' ? null : current.text} online={online} askSignal={stuckSignal} />
        )}
        <button
          className="w-full py-3 rounded-2xl text-[14px] font-medium flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          style={stopIsTheMove ? primaryButton : quietButton}
          onClick={onStop}
        >
          <Square size={13} /> {timeUp ? 'Time’s up — stop here' : allDone ? 'Stop here' : 'Stop'}
        </button>
      </div>
    </div>
  )
}
