/**
 * Project Notes — the project's freeform "Content" space.
 *
 * One continuous markdown document per project: drop text, links and images
 * in any order. View mode renders it; tap Edit for a textarea with an image
 * button (and paste-to-upload). Saves to projects.notes_doc.
 *
 * The AI can append to the same document via the project chat, so notes is the
 * shared scratch space for both the user and the guide.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { ImagePlus, Pencil, Check, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useToast } from '../ui/toast'
import { MarkdownRenderer } from '../ui/MarkdownRenderer'
import { useProjectStore } from '../../stores/useProjectStore'
import { api } from '../../lib/apiClient'
import { handleInputFocus } from '../../utils/keyboard'

interface ProjectNotesProps {
  projectId: string
  notesDoc?: string | null
}

async function uploadImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png'
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
  const { signedUrl, publicUrl } = await api.post('utilities?resource=upload-image', {
    fileName,
    fileType: file.type || 'image/png',
  })
  if (!signedUrl || !publicUrl) throw new Error('Upload server gave no URL')
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'image/png', 'x-upsert': 'true' },
    body: file,
  }).catch(() => { throw new Error('Upload failed — check your connection') })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  return publicUrl
}

export function ProjectNotes({ projectId, notesDoc }: ProjectNotesProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notesDoc ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()
  const updateProject = useProjectStore(state => state.updateProject)

  // Keep the draft in sync with the stored doc whenever we're not actively
  // editing — so an AI append from the chat shows up here without a refresh.
  useEffect(() => {
    if (!editing) setDraft(notesDoc ?? '')
  }, [notesDoc, editing])

  // Insert text at the cursor (or append) inside the textarea.
  const insertAtCursor = useCallback((snippet: string) => {
    const el = textareaRef.current
    setDraft(prev => {
      if (!el) return prev ? `${prev}\n${snippet}` : snippet
      const start = el.selectionStart ?? prev.length
      const end = el.selectionEnd ?? prev.length
      const next = prev.slice(0, start) + snippet + prev.slice(end)
      // Restore caret just after the inserted snippet on the next tick.
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + snippet.length
        el.setSelectionRange(pos, pos)
      })
      return next
    })
  }, [])

  const addImages = useCallback(async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'))
    if (images.length === 0) return
    setUploading(true)
    try {
      for (const file of images) {
        const url = await uploadImage(file)
        insertAtCursor(`\n\n![](${url})\n\n`)
      }
    } catch (err) {
      addToast({
        title: 'Image upload failed',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }, [insertAtCursor, addToast])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addImages(Array.from(e.target.files))
    e.target.value = '' // allow re-selecting the same file
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files || [])
    if (files.some(f => f.type.startsWith('image/'))) {
      e.preventDefault()
      addImages(files)
    }
  }

  const save = async () => {
    setSaving(true)
    const next = draft.trim() ? draft : null
    try {
      await updateProject(projectId, { notes_doc: next })
      setEditing(false)
    } catch {
      addToast({ title: 'Failed to save notes', description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(notesDoc ?? '')
    setEditing(false)
  }

  const hasContent = !!(notesDoc && notesDoc.trim())

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)]">
          Notes
        </span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/[0.06]"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            <Pencil className="h-3 w-3" /> {hasContent ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onPaste={handlePaste}
            onFocus={handleInputFocus}
            autoFocus
            placeholder="Drop text, links, or images here. Markdown works — # heading, **bold**, - list."
            rows={10}
            className="w-full px-4 py-3 rounded-xl text-[15px] leading-relaxed focus:outline-none focus:ring-2 resize-y"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--brand-text-primary)',
              '--tw-ring-color': 'var(--brand-primary)',
            } as React.CSSProperties}
          />

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                aria-label="Add image"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                className="h-9 px-3 text-xs flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--brand-text-secondary)', borderRadius: '9999px' }}
              >
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</>
                  : <><ImagePlus className="h-3.5 w-3.5" /> Image</>}
              </Button>
            </div>

            <div className="flex-grow" />

            <button
              onClick={cancel}
              disabled={saving}
              className="h-9 px-3 rounded-lg text-[13px] font-medium transition-colors hover:bg-white/[0.05]"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              Cancel
            </button>
            <Button
              onClick={save}
              disabled={saving || uploading}
              size="sm"
              className="h-9 px-4 text-[13px] font-semibold"
              style={{ background: 'var(--brand-primary)', color: 'var(--brand-text-primary)' }}
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…</> : <><Check className="h-3.5 w-3.5 mr-1.5" /> Save</>}
            </Button>
          </div>
        </div>
      ) : hasContent ? (
        <button
          onClick={() => setEditing(true)}
          className="block w-full text-left rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.02]"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <MarkdownRenderer content={notesDoc!} className="text-[15px]" />
        </button>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 w-full rounded-xl px-4 py-4 text-left transition-colors hover:bg-white/[0.03]"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', color: 'var(--brand-text-secondary)', opacity: 0.7 }}
        >
          <ImagePlus className="h-4 w-4" />
          <span className="text-[13px]">Drop text, links, or images for this project.</span>
        </button>
      )}
    </div>
  )
}
