/** The bottom sheet the "what you made" pieces open in. On the body, like UpdateSheet. */

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { InFieldMic } from '../VoiceInput'

export function Sheet({ eyebrow, title, onClose, busy, children }: { eyebrow?: string; title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }} onClick={busy ? undefined : onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 38, stiffness: 560, mass: 0.4 }}
        className="relative w-full max-w-lg neon-edge rounded-t-[24px] rounded-b-none p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto"
        style={{ background: '#0c1322' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow truncate">{eyebrow}</p>}
            <p className="type-lead mt-1">{title}</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close" className="p-1.5 -mr-1.5" style={{ color: 'var(--brand-text-muted)' }}><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>,
    document.body,
  )
}

/** Title, a few words (said or typed) and the day it was made. */
export function PieceFieldsForm({ title, setTitle, note, setNote, madeOn, setMadeOn, titlePlaceholder, disabled }: {
  title: string; setTitle: (s: string) => void
  note: string; setNote: (f: (s: string) => string) => void
  madeOn: string; setMadeOn: (s: string) => void
  titlePlaceholder: string; disabled?: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-3">
      <input value={title} onChange={e => setTitle(e.target.value)} disabled={disabled} maxLength={120} placeholder={titlePlaceholder} className="field w-full px-3 py-2.5 text-[15px]" aria-label="Title" />
      <NoteField note={note} setNote={setNote} disabled={disabled} />
      <label className="flex items-center justify-between gap-3 text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>
        Made on
        <input type="date" value={madeOn} max={today} onChange={e => setMadeOn(e.target.value || today)} disabled={disabled} className="field px-3 py-2 text-[15px]" />
      </label>
    </div>
  )
}


function NoteField({ note, setNote, disabled }: { note: string; setNote: (f: (s: string) => string) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <textarea
        value={note}
        onChange={e => { const v = e.target.value; setNote(() => v) }}
        disabled={disabled}
        rows={3}
        maxLength={1200}
        placeholder="A few words about it, if you like. What it's of, who it's for, what you'd change."
        className="field w-full px-3 py-2.5 pr-12 text-[15px]"
        aria-label="A few words"
      />
      <InFieldMic onTranscript={t => setNote(c => (c ? `${c} ${t}` : t))} maxDuration={90} />
    </div>
  )
}
