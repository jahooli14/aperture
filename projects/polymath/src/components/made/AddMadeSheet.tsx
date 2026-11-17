/**
 * Add what you made: a photo (or a batch of them), a recording, or a link
 * (a mix on SoundCloud, a video, a page). One photo or a link gets a title,
 * a few words and the day; a batch goes straight on, each dated from its own
 * photo, so seven years of paintings is one pick, not three hundred forms.
 */

import { useRef, useState } from 'react'
import { Camera, Link2, Loader2, Mic } from 'lucide-react'
import { addFile, addLink, dateOfFile, type ProjectOutput } from '../../lib/projectOutputs'
import { haptic } from '../../utils/haptics'
import { Sheet, PieceFieldsForm } from './Sheet'

type Mode = 'file' | 'link'
const today = () => new Date().toISOString().slice(0, 10)

export function AddMadeSheet({ projectId, projectTitle, unit, onAdded, onClose }: {
  projectId: string; projectTitle: string
  /** "painting", "mix": what one piece of this project is called. */
  unit?: string
  onAdded: (items: ProjectOutput[]) => void
  onClose: () => void
}) {
  const photoRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [madeOn, setMadeOn] = useState(today())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (list: FileList | null) => {
    const chosen = Array.from(list ?? [])
    if (!chosen.length) return
    setError(null)
    setFiles(chosen)
    setMode('file')
    if (chosen.length === 1) {
      if (chosen[0].type.startsWith('image/')) setPreview(URL.createObjectURL(chosen[0]))
      setMadeOn((await dateOfFile(chosen[0])) ?? today())
    }
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    const added: ProjectOutput[] = []
    try {
      if (mode === 'link') {
        added.push(await addLink(projectId, link, { title, note, made_on: madeOn }))
      } else if (files.length === 1) {
        added.push(await addFile(projectId, files[0], { title, note, made_on: madeOn }))
      } else {
        // One at a time: on mobile data one upload in flight does better.
        for (const [i, f] of files.entries()) {
          setProgress(`${i + 1} of ${files.length}`)
          added.push(await addFile(projectId, f, { made_on: (await dateOfFile(f)) ?? undefined }))
        }
      }
      haptic.success()
      onAdded(added)
      onClose()
    } catch (e) {
      if (added.length) onAdded(added)
      const left = files.length > 1 ? ` ${added.length} of ${files.length} went on.` : ''
      setError((e instanceof Error && e.message ? e.message : "Couldn't save that. Try again.") + left)
      if (added.length) setFiles(f => f.slice(added.length))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const thing = unit || 'something you made'
  const ready = mode === 'link' ? /^https:\/\/\S+\.\S+/.test(link.trim()) : files.length > 0

  return (
    <Sheet eyebrow={projectTitle} title={`Add ${unit ? `a ${unit}` : 'what you made'}`} onClose={onClose} busy={busy}>
      <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { void pick(e.target.files); e.target.value = '' }} />
      <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={e => { void pick(e.target.files); e.target.value = '' }} />

      {mode === null && (
        <div className="grid grid-cols-3 gap-2">
          <Choice icon={<Camera size={18} />} label="Photos" onClick={() => photoRef.current?.click()} />
          <Choice icon={<Mic size={18} />} label="Recording" onClick={() => audioRef.current?.click()} />
          <Choice icon={<Link2 size={18} />} label="Link" onClick={() => setMode('link')} />
        </div>
      )}

      {mode === 'link' && (
        <input value={link} onChange={e => setLink(e.target.value)} disabled={busy} inputMode="url" autoFocus placeholder="Paste a link: SoundCloud, YouTube, any page" className="field w-full px-3 py-2.5 text-[15px]" aria-label="Link" />
      )}

      {mode === 'file' && files.length === 1 && preview && (
        <img src={preview} alt="" className="w-full max-h-[40vh] object-contain rounded-xl" />
      )}
      {mode === 'file' && files.length === 1 && !preview && (
        <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>{files[0].name}</p>
      )}
      {mode === 'file' && files.length > 1 && (
        <p className="text-[15px]" style={{ color: 'var(--brand-text-secondary)' }}>
          {files.length} files. Each goes on as its own {unit ?? 'piece'}, dated from the photo where it can be. Add titles and words after, one at a time.
        </p>
      )}

      {mode && !(mode === 'file' && files.length > 1) && (
        <PieceFieldsForm
          title={title} setTitle={setTitle} note={note} setNote={f => setNote(f)} madeOn={madeOn} setMadeOn={setMadeOn}
          titlePlaceholder={mode === 'link' ? 'Title (taken from the link if left empty)' : `What's this ${thing} called? (optional)`}
          disabled={busy}
        />
      )}

      {error && <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{error}</p>}

      {mode && (
        <button onClick={() => { void save() }} disabled={busy || !ready} className="neon-button w-full py-3 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40">
          {busy ? <><Loader2 size={15} className="animate-spin" /> {progress ? `Adding ${progress}…` : 'Saving…'}</> : files.length > 1 ? `Add ${files.length}` : 'Add it'}
        </button>
      )}
    </Sheet>
  )
}

function Choice({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass-card-subtle flex flex-col items-center gap-2 py-4 rounded-xl text-[13px]" style={{ color: 'var(--brand-text-primary)' }}>
      <span style={{ color: 'rgb(var(--brand-primary-rgb))' }}>{icon}</span>
      {label}
    </button>
  )
}
