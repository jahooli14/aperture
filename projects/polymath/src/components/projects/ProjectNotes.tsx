/**
 * Project Notes — the project's freeform "Content" space.
 *
 * A Notion/Capacities-style WYSIWYG built on TipTap (headless ProseMirror),
 * styled to the Polymath glass theme. Always-editable inline: type and it
 * formats live, drop/paste images and they upload inline, select text for a
 * floating format menu. Autosaves as markdown to projects.notes_doc — so the
 * doc stays portable and the AI can read/append to it from the chat.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { Bold, Italic, Strikethrough, Link2, Heading1, Heading2, List, Quote, ImagePlus, Loader2, Check } from 'lucide-react'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import { api } from '../../lib/apiClient'
import '../../styles/project-notes.css'

interface ProjectNotesProps {
  projectId: string
  notesDoc?: string | null
}

// tiptap-markdown augments editor.storage at runtime but ships no storage types.
const getMarkdown = (editor: Editor): string => {
  const md = (editor.storage as unknown as Record<string, unknown>).markdown as { getMarkdown: () => string } | undefined
  return md?.getMarkdown() ?? ''
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

type SaveState = 'idle' | 'saving' | 'saved'

export function ProjectNotes({ projectId, notesDoc }: ProjectNotesProps) {
  const { addToast } = useToast()
  const updateProject = useProjectStore(state => state.updateProject)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Drop text, links, or images for this project…' }),
      Markdown.configure({ html: false, linkify: true, transformPastedText: true, transformCopiedText: true }),
    ],
    content: notesDoc || '',
    editorProps: { attributes: { class: 'focus:outline-none' } },
    onUpdate: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const md = getMarkdown(editor)
      saveTimer.current = setTimeout(() => persist(md), 900)
    },
    onBlur: ({ editor }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      persist(getMarkdown(editor))
    },
  })

  // Pull in external changes (e.g. an AI append from the chat) — but only when
  // the user isn't mid-edit, so we never clobber what they're typing.
  useEffect(() => {
    if (!editor) return
    const incoming = notesDoc ?? ''
    if (editor.isFocused) return
    if (incoming.trim() === getMarkdown(editor).trim()) return
    editor.commands.setContent(incoming, { emitUpdate: false })
    lastSaved.current = incoming
  }, [notesDoc, editor])

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (savedFlash.current) clearTimeout(savedFlash.current)
  }, [])

  const insertImageFiles = useCallback(async (files: File[]) => {
    const images = files.filter(f => f.type.startsWith('image/'))
    if (images.length === 0 || !editor) return
    setUploading(true)
    try {
      for (const file of images) {
        const url = await uploadImage(file)
        editor.chain().focus().setImage({ src: url }).run()
      }
    } catch (err) {
      addToast({ title: 'Image upload failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }, [editor, addToast])

  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); insertImageFiles(files) }
  }
  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); insertImageFiles(files) }
    setDragOver(false)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer?.items || []).some(i => i.kind === 'file')) { e.preventDefault(); setDragOver(true) }
  }

  const toggleLink = () => {
    if (!editor) return
    if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); return }
    const url = window.prompt('Link URL', editor.getAttributes('link').href || 'https://')
    if (url === null) return
    if (url.trim() === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const btn = (active: boolean, onClick: () => void, label: string, Icon: typeof Bold) => (
    <button type="button" onClick={onClick} aria-label={label} className={active ? 'is-active' : ''}>
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </button>
  )

  return (
    <div className="project-notes">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-text-secondary)]">Notes</span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide" style={{ color: 'var(--brand-text-secondary)', opacity: saveState === 'idle' ? 0 : 0.55, transition: 'opacity 0.25s' }}>
          {saveState === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : saveState === 'saved' ? <><Check className="h-3 w-3" /> Saved</> : null}
        </span>
      </div>

      {editor && (
        <BubbleMenu editor={editor} className="notes-bubble">
          {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', Bold)}
          {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', Italic)}
          {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', Strikethrough)}
          {btn(editor.isActive('link'), toggleLink, 'Link', Link2)}
          <span className="notes-bubble-sep" />
          {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1', Heading1)}
          {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2', Heading2)}
          {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', List)}
          {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', Quote)}
        </BubbleMenu>
      )}

      {/* Editor surface */}
      <div
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        className="rounded-xl px-4 py-3.5 transition-colors"
        style={{
          background: dragOver ? 'rgba(var(--brand-primary-rgb),0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px ${dragOver ? 'dashed' : 'solid'} ${dragOver ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.06)'}`,
        }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Footer affordance */}
      <div className="flex items-center gap-3 mt-2.5 px-1">
        <label className="flex items-center gap-1.5 text-[12px] cursor-pointer transition-opacity hover:opacity-100" style={{ color: 'var(--brand-text-secondary)', opacity: 0.55 }}>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => { if (e.target.files?.length) insertImageFiles(Array.from(e.target.files)); e.target.value = '' }}
          />
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Add image'}
        </label>
        <span className="text-[11px]" style={{ color: 'var(--brand-text-muted)', opacity: 0.4 }}>or drag, paste, or select text to format</span>
      </div>
    </div>
  )
}
