/** One piece, big: the photo, the player or the link, and its title, words and day, all editable. */

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { editOutput, removeOutput, type ProjectOutput } from '../../lib/projectOutputs'
import { pieceLabel, pieceName } from '../../lib/projectOutputsOps'
import { Sheet, PieceFieldsForm } from './Sheet'

export function PieceSheet({ item, total, projectTitle, onChanged, onRemoved, onClose }: {
  item: ProjectOutput; total: number; projectTitle?: string
  onChanged: (item: ProjectOutput) => void
  onRemoved: (id: string) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [madeOn, setMadeOn] = useState(item.made_on)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = title !== (item.title ?? '') || note !== (item.note ?? '') || madeOn !== item.made_on

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onChanged(await editOutput(item.id, { title, note, made_on: madeOn }))
      onClose()
    } catch {
      setError("That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await removeOutput(item.id)
      onRemoved(item.id)
      onClose()
    } catch {
      setError("Couldn't remove it. Try again.")
      setBusy(false)
    }
  }

  return (
    <Sheet eyebrow={[projectTitle, pieceLabel(item, total)].filter(Boolean).join(' · ')} title={pieceName(item)} onClose={onClose} busy={busy}>
      {item.kind === 'image' && item.url && (
        <a href={item.url} target="_blank" rel="noreferrer">
          <img src={item.url} alt={pieceName(item)} className="w-full max-h-[50vh] object-contain rounded-xl" />
        </a>
      )}
      {item.kind === 'audio' && item.url && <audio controls preload="metadata" src={item.url} className="w-full" />}
      {item.kind === 'link' && item.link && (
        <a href={item.link} target="_blank" rel="noreferrer" className="glass-card-subtle flex items-center gap-3 p-3 rounded-xl">
          {item.link_meta?.image && <img src={item.link_meta.image} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] truncate" style={{ color: 'var(--brand-text-primary)' }}>{item.link_meta?.title ?? item.link}</span>
            <span className="block text-[13px]" style={{ color: 'var(--brand-text-muted)' }}>{item.link_meta?.site ?? new URL(item.link).hostname}</span>
          </span>
          <ExternalLink size={15} style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
        </a>
      )}

      <PieceFieldsForm
        title={title} setTitle={setTitle} note={note} setNote={f => setNote(f)} madeOn={madeOn} setMadeOn={setMadeOn}
        titlePlaceholder="Title" disabled={busy}
      />
      {error && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => (confirming ? void remove() : setConfirming(true))} disabled={busy} className="text-[13px] min-h-[40px]" style={{ color: 'var(--brand-text-muted)' }}>
          {confirming ? 'Tap again to remove it' : 'Remove'}
        </button>
        <button onClick={() => { void save() }} disabled={busy || !changed} className="neon-button px-5 py-2.5 rounded-xl font-semibold text-[15px] flex items-center gap-2 disabled:opacity-40">
          {busy && <Loader2 size={14} className="animate-spin" />} Save
        </button>
      </div>
    </Sheet>
  )
}
