/**
 * A one-off project's page: its one next move and the same Update button as
 * every other project. (The log of what you've done used to sit under it; the
 * page is deliberately short now.)
 *
 * Not a to-do list. The move is written from what you last said
 * (api/_lib/next-move.ts); saying "I did that", "the left side is 2cm low" or
 * "the whole thing is done" through Update logs the move, rewrites it, or
 * offers to finish the project. One engine, so the card and the reply can't
 * disagree. A long project (the book) is read off its "Keep in mind" lines
 * instead and never shows this.
 */

import { useEffect, useState } from 'react'
import { Flag, Loader2, Mic } from 'lucide-react'
import { readStoredMove, useMoveStore } from '../../stores/useMoveStore'
import { splitDoneWhen } from '../../lib/moveText'
import { MoveTweak } from '../home/MoveTweak'
import type { Project } from '../../types'

/** Same floor the home card uses: "Done." is an acknowledgement, not a note
 *  worth playing back. */
const MIN_USEFUL_NOTE = 25

export function NextMovePanel({ project, onUpdate }: { project: Project; onUpdate: () => void }) {
  const stored = readStoredMove(project.metadata)
  const hasStoredMove = stored !== null
  const move = stored?.kind === 'move' ? splitDoneWhen(stored.text) : null
  const fork = stored?.kind === 'fork' ? stored.text : null
  const live = project.status !== 'completed' && project.status !== 'graveyard'
  const note = project.last_closeout_text?.trim() ?? ''
  const lastNote = note.length >= MIN_USEFUL_NOTE ? note : null

  const moveBusy = useMoveStore(s => s.moveBusy)
  const [tweaking, setTweaking] = useState(false)

  // A project with no move yet gets one written the moment you open it — a
  // first move for a new project, a way back in for an old one — rather than
  // a card that says "No move yet" and waits for a tap.
  useEffect(() => {
    if (!live || hasStoredMove) return
    void useMoveStore.getState().loadMove(project.id)
  }, [project.id, live, hasStoredMove])

  if (!live) return null

  return (
    <div className="glass-card p-5 space-y-3">
      <p className="eyebrow">{fork ? 'First, decide' : 'Next move'}</p>
      {move || fork ? (
        <p className="type-lead">{move ? move.move : fork}</p>
      ) : (
        <p className="flex items-center gap-2 text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
          {moveBusy && <Loader2 size={14} className="animate-spin" />}
          {moveBusy ? 'Working out where to start…' : 'No move yet.'}
        </p>
      )}
      {move?.doneWhen && (
        <p className="flex items-start gap-2 text-[13px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
          <Flag size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'rgba(var(--brand-primary-rgb),0.8)' }} />
          {move.doneWhen}
        </p>
      )}
      {lastNote && (
        <p className="text-[13px] italic leading-snug line-clamp-3" style={{ color: 'var(--brand-text-secondary)' }}>
          You stopped with “{lastNote}”
        </p>
      )}
      <button
        onClick={onUpdate}
        className="neon-button w-full py-3 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2"
      >
        <Mic className="h-4 w-4" />
        {fork ? 'Answer it' : 'Update'}
      </button>
      {move && (
        <>
          <button onClick={() => setTweaking(t => !t)} className="w-full text-[13px] py-1" style={{ color: 'var(--brand-text-muted)' }}>
            {tweaking ? 'Keep this one' : 'Not this — change it'}
          </button>
          {tweaking && <MoveTweak projectId={project.id} onClose={() => setTweaking(false)} />}
        </>
      )}
    </div>
  )
}
