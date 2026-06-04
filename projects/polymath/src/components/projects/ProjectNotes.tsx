/**
 * Project Notes — the project's freeform "Content" space.
 *
 * A thin wrapper around the shared RichTextEditor: it owns the "Notes" header,
 * the Saving/Saved indicator, and the debounced autosave to projects.notes_doc.
 * The editing experience itself lives in RichTextEditor so every writing
 * surface in the app behaves the same way.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Check } from 'lucide-react'
import { RichTextEditor } from '../ui/RichTextEditor'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'

interface ProjectNotesProps {
  projectId: string
  notesDoc?: string | null
}

type SaveState = 'idle' | 'saving' | 'saved'

export function ProjectNotes({ projectId, notesDoc }: ProjectNotesProps) {
  const { addToast } = useToast()
  const updateProject = useProjectStore(state => state.updateProject)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef<string>(notesDoc ?? '')
  const savedFlash = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persist = useCallback(async (md: string) => {
    const next = md.trim()
    if (next === lastSaved.current.trim()) return
    lastSaved.current = next
    setSaveState('saving')
    try {
      await updateProject(projectId, { notes_doc: next || null })
      setSaveState('saved')
      if (savedFlash.current) clearTimeout(savedFlash.current)
      savedFlash.current = setTimeout(() => setSaveState('idle'), 1800)
    } catch {
      setSaveState('idle')
      addToast({ title: 'Failed to save notes', description: 'Changes are still here — try again.', variant: 'destructive' })
    }
  }, [projectId, updateProject, addToast])

  // Keep lastSaved in sync with external changes (e.g. AI append from the chat).
  useEffect(() => { lastSaved.current = notesDoc ?? '' }, [notesDoc])

  const onChange = useCallback((md: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(md), 900)
  }, [persist])

  const onBlurSave = useCallback((md: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    persist(md)
  }, [persist])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (savedFlash.current) clearTimeout(savedFlash.current)
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)]">Notes</span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide" style={{ color: 'var(--brand-text-secondary)', opacity: saveState === 'idle' ? 0 : 0.55, transition: 'opacity 0.25s' }}>
          {saveState === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : saveState === 'saved' ? <><Check className="h-3 w-3" /> Saved</> : null}
        </span>
      </div>

      <RichTextEditor
        value={notesDoc ?? ''}
        onChange={onChange}
        onBlurSave={onBlurSave}
        placeholder="Drop text, links, or images for this project…"
        enableImages
        minHeight="8rem"
      />
    </div>
  )
}
