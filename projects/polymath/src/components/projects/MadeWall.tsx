/**
 * What you made
 *
 * The mirror counts hours; this keeps the things. A photo of the shelf, a
 * screenshot of the page, a clip of the mix — attached at close-out or any
 * time from the project page (most making happens away from the app).
 *
 * Three pieces:
 *   - AddMadeButton — the file picker. On a phone it offers camera, photos
 *     and files, which covers photo, screenshot and audio in one tap.
 *   - MadeStrip — the close-out version: the button plus what's been added
 *     this session.
 *   - MadeWall — the project page: everything, newest first.
 *
 * Needs a connection (it's an upload), so it hides offline rather than
 * failing at the end of a session.
 */

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, X, Music } from 'lucide-react'
import { addOutput, listOutputs, removeOutput, type ProjectOutput } from '../../lib/projectOutputs'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { haptic } from '../../utils/haptics'
import { shortDate } from './projectArcOps'

const secondaryTextStyle = { color: 'var(--brand-text-secondary)' }

interface AddMadeButtonProps {
  projectId: string
  sessionId?: string | null
  label?: string
  onAdded: (item: ProjectOutput) => void
}

export function AddMadeButton({ projectId, sessionId, label = 'Add what you made', onAdded }: AddMadeButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isOnline } = useOnlineStatus()

  if (!isOnline) return null

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // One at a time: a phone on mobile data does better with one upload
      // in flight, and each lands on the wall as soon as it's done.
      for (const file of Array.from(files)) {
        onAdded(await addOutput(projectId, file, sessionId))
      }
      haptic.light()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't upload that. Try again.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,audio/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 text-[12px] disabled:opacity-50"
        style={{ ...secondaryTextStyle, opacity: busy ? 0.5 : 0.75 }}
      >
        <ImagePlus className="h-3.5 w-3.5" />
        {busy ? 'Uploading…' : label}
      </button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

function OutputTile({ item, onRemove }: { item: ProjectOutput; onRemove?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const removeButton = onRemove && (
    <button
      type="button"
      aria-label={confirming ? 'Confirm remove' : 'Remove'}
      onClick={() => (confirming ? onRemove() : setConfirming(true))}
      className="absolute top-1 right-1 rounded-full px-1.5 py-0.5 text-[11px] flex items-center gap-0.5"
      style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
    >
      {confirming ? 'Remove' : <X className="h-3 w-3" />}
    </button>
  )

  if (item.kind === 'image') {
    return (
      <div className="relative aspect-square rounded-lg overflow-hidden" style={{ background: 'var(--glass-surface)' }}>
        <a href={item.url} target="_blank" rel="noreferrer">
          <img src={item.url} alt={item.note ?? 'Something you made'} loading="lazy" className="w-full h-full object-cover" />
        </a>
        {removeButton}
      </div>
    )
  }

  return (
    <div
      className="relative col-span-3 rounded-lg px-3 py-2 space-y-1.5 border"
      style={{ borderColor: 'var(--glass-border-bold)' }}
    >
      <p className="text-[11px] flex items-center gap-1.5" style={{ ...secondaryTextStyle, opacity: 0.6 }}>
        <Music className="h-3 w-3" /> {shortDate(item.created_at)}
      </p>
      <audio controls preload="none" src={item.url} className="w-full h-8" />
      {removeButton}
    </div>
  )
}

/** Close-out: add a file, see what's been added this session. */
export function MadeStrip({ projectId, sessionId }: { projectId: string; sessionId?: string | null }) {
  const [added, setAdded] = useState<ProjectOutput[]>([])
  return (
    <div className="space-y-2">
      <AddMadeButton
        projectId={projectId}
        sessionId={sessionId}
        label={added.length > 0 ? 'Add another' : 'Add a photo or clip of what you made'}
        onAdded={item => setAdded(a => [...a, item])}
      />
      {added.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {added.map(item => <OutputTile key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}

const WALL_SHOWN = 12

/** Project page: everything made on this project, newest first. */
export function MadeWall({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ProjectOutput[]>([])
  const [available, setAvailable] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    listOutputs(projectId)
      .then(r => {
        if (cancelled) return
        setItems(r.items)
        setAvailable(r.available)
      })
      .catch(() => { /* a failed read shows nothing, not an error card */ })
    return () => { cancelled = true }
  }, [projectId])

  // Hidden until the table exists (migration not run yet).
  if (!available) return null

  const handleRemove = async (id: string) => {
    const before = items
    setItems(list => list.filter(i => i.id !== id))
    try {
      await removeOutput(id)
    } catch {
      setItems(before)
    }
  }

  const shown = showAll ? items : items.slice(0, WALL_SHOWN)

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <span className="text-[11px] font-medium tracking-wide flex items-center gap-1.5 lowercase" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.75 }}>
          <ImagePlus className="h-3 w-3" /> what you made · {items.length}
        </span>
      )}
      {shown.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {shown.map(item => (
            <OutputTile key={item.id} item={item} onRemove={() => handleRemove(item.id)} />
          ))}
        </div>
      )}
      {items.length > shown.length && (
        <button type="button" className="text-[11px]" style={{ ...secondaryTextStyle, opacity: 0.5 }} onClick={() => setShowAll(true)}>
          Show all {items.length}
        </button>
      )}
      <AddMadeButton
        projectId={projectId}
        label={items.length > 0 ? 'Add something' : 'Add a photo or clip of something you made'}
        onAdded={item => setItems(list => [item, ...list])}
      />
    </div>
  )
}
