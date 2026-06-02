/**
 * RichTextEditor — the app's one fluid writing surface.
 *
 * A Notion/Capacities-style WYSIWYG built on TipTap (headless ProseMirror),
 * styled to the Polymath glass theme. Type and it formats live; select text
 * for a floating format menu; optionally drop/paste images and they upload
 * inline. Emits markdown (via onChange / onBlurSave) so the content stays
 * portable and renders back identically through MarkdownRenderer.
 *
 * Used everywhere a textarea used to be: project notes, memory bodies,
 * reading notes, list + project descriptions.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { Bold, Italic, Strikethrough, Link2, Heading1, Heading2, List, Quote, ImagePlus, Loader2 } from 'lucide-react'
import { useToast } from './toast'
import { api } from '../../lib/apiClient'
import { cn } from '../../lib/utils'
import '../../styles/rich-text.css'

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

export interface RichTextEditorProps {
  /** Current value as markdown. */
  value: string
  /** Fired on every edit with the latest markdown. */
  onChange?: (markdown: string) => void
  /** Fired on blur — handy for autosave surfaces that debounce the network call. */
  onBlurSave?: (markdown: string) => void
  /** Focus/blur notifications for surfaces that gate UI on focus (e.g. word counts). */
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
  editable?: boolean
  /** 'bordered' draws the boxed glass surface; 'bare' is a naked inline surface. */
  variant?: 'bordered' | 'bare'
  /** Min height of the writing area, e.g. '8rem' or 96. */
  minHeight?: number | string
  autoFocus?: boolean
  /** Enable inline image paste / drop / picker. Off by default for compact fields. */
  enableImages?: boolean
  /** Scroll the surface into view on focus (mobile keyboard). */
  scrollOnFocus?: boolean
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  onBlurSave,
  onFocus,
  onBlur,
  placeholder = 'Write something…',
  editable = true,
  variant = 'bordered',
  minHeight = '8rem',
  autoFocus = false,
  enableImages = false,
  scrollOnFocus = false,
  className,
}: RichTextEditorProps) {
  const { addToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, linkify: true, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value || '',
    editable,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'focus:outline-none' } },
    onUpdate: ({ editor }) => onChange?.(getMarkdown(editor)),
    onBlur: ({ editor }) => { onBlurSave?.(getMarkdown(editor)); onBlur?.() },
    onFocus: () => {
      if (scrollOnFocus) {
        setTimeout(() => surfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 300)
      }
      onFocus?.()
    },
  })

  // Pull in external changes (draft hydrate, reset, AI append) without clobbering
  // what the user is actively typing. An empty editor is always safe to fill —
  // that's how a restored draft lands even when autofocus grabbed focus first.
  useEffect(() => {
    if (!editor) return
    const incoming = value ?? ''
    const current = getMarkdown(editor)
    if (incoming.trim() === current.trim()) return
    if (editor.isFocused && current.trim() !== '') return
    editor.commands.setContent(incoming, { emitUpdate: false })
  }, [value, editor])

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editable, editor])

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
    if (!enableImages) return
    const files = Array.from(e.clipboardData?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); insertImageFiles(files) }
  }
  const onDrop = (e: React.DragEvent) => {
    if (!enableImages) return
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'))
    if (files.length) { e.preventDefault(); insertImageFiles(files) }
    setDragOver(false)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!enableImages) return
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

  const bordered = variant === 'bordered'

  return (
    <div className={cn('rich-text', className)}>
      {editor && editable && (
        <BubbleMenu editor={editor} className="rich-text-bubble">
          {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', Bold)}
          {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', Italic)}
          {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', Strikethrough)}
          {btn(editor.isActive('link'), toggleLink, 'Link', Link2)}
          <span className="rich-text-bubble-sep" />
          {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1', Heading1)}
          {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2', Heading2)}
          {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', List)}
          {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', Quote)}
        </BubbleMenu>
      )}

      <div
        ref={surfaceRef}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        className={cn('transition-colors', bordered && 'rounded-xl px-4 py-3.5')}
        style={bordered ? {
          background: dragOver ? 'rgba(var(--brand-primary-rgb),0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px ${dragOver ? 'dashed' : 'solid'} ${dragOver ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.06)'}`,
          minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        } : {
          minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
        }}
        onClick={() => editable && editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {enableImages && editable && (
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
      )}
    </div>
  )
}
