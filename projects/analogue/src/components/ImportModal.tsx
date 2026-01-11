import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, ClipboardPaste, FileText, Scissors } from 'lucide-react'
import type { NarrativeSection } from '../types/manuscript'

interface ImportModalProps {
  onImport: (scenes: ImportedScene[]) => void
  onClose: () => void
}

export interface ImportedScene {
  title: string
  section: NarrativeSection
  prose: string
}

// Common chapter/section markers
const CHAPTER_PATTERNS = [
  /^#{1,3}\s+(.+)$/gm,                    // Markdown headers
  /^Chapter\s+(\d+|[IVXLC]+)[:\s]*(.*)$/gim,  // Chapter 1, Chapter IV
  /^Part\s+(\d+|[IVXLC]+)[:\s]*(.*)$/gim,     // Part 1, Part II
  /^\*{3,}$/gm,                            // *** scene breaks
  /^-{3,}$/gm,                             // --- scene breaks
  /^~{3,}$/gm,                             // ~~~ scene breaks
]

function parseManuscript(text: string, splitMethod: 'chapters' | 'wordcount' | 'breaks'): ImportedScene[] {
  const scenes: ImportedScene[] = []
  const sections: NarrativeSection[] = ['departure', 'escape', 'rupture', 'alignment', 'reveal']

  if (splitMethod === 'wordcount') {
    // Split by approximate word count (~800 words per scene)
    const words = text.split(/\s+/)
    const wordsPerScene = 800
    let currentScene = ''
    let sceneIndex = 0

    for (let i = 0; i < words.length; i++) {
      currentScene += words[i] + ' '

      // Check if we've hit the word limit and found a paragraph break
      if (currentScene.split(/\s+/).length >= wordsPerScene) {
        const paragraphEnd = currentScene.lastIndexOf('\n\n')
        if (paragraphEnd > currentScene.length * 0.5) {
          // Split at paragraph break
          scenes.push({
            title: `Scene ${sceneIndex + 1}`,
            section: sections[Math.min(Math.floor(sceneIndex / (Math.ceil(words.length / wordsPerScene / 5))), 4)],
            prose: currentScene.slice(0, paragraphEnd).trim()
          })
          currentScene = currentScene.slice(paragraphEnd).trim() + ' '
          sceneIndex++
        }
      }
    }

    // Add remaining text
    if (currentScene.trim()) {
      scenes.push({
        title: `Scene ${sceneIndex + 1}`,
        section: sections[Math.min(4, Math.floor(sceneIndex / Math.max(1, scenes.length / 5)))],
        prose: currentScene.trim()
      })
    }
  } else if (splitMethod === 'chapters') {
    // Split by chapter markers
    let sceneIndex = 0

    // Find all chapter markers
    const markers: { index: number; title: string }[] = []

    for (const pattern of CHAPTER_PATTERNS) {
      let match
      const regex = new RegExp(pattern.source, pattern.flags)
      while ((match = regex.exec(text)) !== null) {
        const title = match[2] || match[1] || `Chapter ${markers.length + 1}`
        markers.push({ index: match.index, title: title.trim() || `Scene ${markers.length + 1}` })
      }
    }

    // Sort markers by position
    markers.sort((a, b) => a.index - b.index)

    if (markers.length === 0) {
      // No markers found, treat as single scene or fall back to word count
      return parseManuscript(text, 'wordcount')
    }

    // Extract scenes between markers
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index
      const end = i < markers.length - 1 ? markers[i + 1].index : text.length
      const content = text.slice(start, end).replace(CHAPTER_PATTERNS[0], '').trim()

      if (content.length > 50) { // Only add if has substantial content
        scenes.push({
          title: markers[i].title,
          section: sections[Math.min(Math.floor(i / Math.max(1, markers.length / 5)), 4)],
          prose: content
        })
        sceneIndex++
      }
    }

    // Add any content before first marker
    if (markers.length > 0 && markers[0].index > 100) {
      scenes.unshift({
        title: 'Opening',
        section: 'departure',
        prose: text.slice(0, markers[0].index).trim()
      })
    }
  } else {
    // Split by scene breaks (*** or ---)
    const parts = text.split(/\n\s*(?:\*{3,}|-{3,}|~{3,})\s*\n/)

    parts.forEach((part, i) => {
      const trimmed = part.trim()
      if (trimmed.length > 50) {
        scenes.push({
          title: `Scene ${i + 1}`,
          section: sections[Math.min(Math.floor(i / Math.max(1, parts.length / 5)), 4)],
          prose: trimmed
        })
      }
    })

    // If no breaks found, fall back to word count
    if (scenes.length <= 1) {
      return parseManuscript(text, 'wordcount')
    }
  }

  return scenes
}

export default function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [text, setText] = useState('')
  const [splitMethod, setSplitMethod] = useState<'chapters' | 'wordcount' | 'breaks'>('chapters')
  const [preview, setPreview] = useState<ImportedScene[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()
      setText(clipboardText)
    } catch {
      // Clipboard API might not be available
      alert('Please paste your text into the text area below')
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setText(content)
    }
    reader.readAsText(file)
  }

  const handlePreview = () => {
    if (!text.trim()) return
    const scenes = parseManuscript(text, splitMethod)
    setPreview(scenes)
  }

  const handleImport = () => {
    if (!preview || preview.length === 0) return
    onImport(preview)
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end bg-black/70"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        className="w-full h-[90vh] bg-ink-900 rounded-t-2xl border-t border-ink-700 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ink-800">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-section-departure" />
            <h2 className="text-lg font-medium text-ink-100">Import Manuscript</h2>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!preview ? (
          <>
            {/* Import options */}
            <div className="flex gap-2 p-4 border-b border-ink-800">
              <button
                onClick={handlePaste}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-ink-800 rounded-lg text-ink-200"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="text-sm">Paste</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-ink-800 rounded-lg text-ink-200"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Text area */}
            <div className="flex-1 p-4 overflow-hidden">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or type your manuscript here..."
                className="w-full h-full p-3 bg-ink-950 border border-ink-800 rounded-lg text-ink-100 text-sm leading-relaxed placeholder:text-ink-600 resize-none"
              />
            </div>

            {/* Split method selection */}
            {text && (
              <div className="p-4 border-t border-ink-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-400">{wordCount.toLocaleString()} words</span>
                </div>

                <div>
                  <label className="block text-xs text-ink-500 mb-2">Split method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSplitMethod('chapters')}
                      className={`p-2 rounded text-xs ${
                        splitMethod === 'chapters'
                          ? 'bg-section-departure text-white'
                          : 'bg-ink-800 text-ink-300'
                      }`}
                    >
                      Chapters
                    </button>
                    <button
                      onClick={() => setSplitMethod('breaks')}
                      className={`p-2 rounded text-xs ${
                        splitMethod === 'breaks'
                          ? 'bg-section-departure text-white'
                          : 'bg-ink-800 text-ink-300'
                      }`}
                    >
                      Scene breaks
                    </button>
                    <button
                      onClick={() => setSplitMethod('wordcount')}
                      className={`p-2 rounded text-xs ${
                        splitMethod === 'wordcount'
                          ? 'bg-section-departure text-white'
                          : 'bg-ink-800 text-ink-300'
                      }`}
                    >
                      ~800 words
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview button */}
            <div className="p-4 border-t border-ink-800 pb-safe">
              <button
                onClick={handlePreview}
                disabled={!text.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50"
              >
                <Scissors className="w-4 h-4" />
                Preview Split
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Preview list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-sm text-ink-400 mb-3">
                {preview.length} scenes detected
              </p>
              {preview.map((scene, i) => (
                <div
                  key={i}
                  className="p-3 bg-ink-950 border border-ink-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-ink-100">
                      {scene.title}
                    </span>
                    <span className="text-xs text-ink-500">
                      {scene.prose.split(/\s+/).length} words
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded bg-section-${scene.section}/20 text-section-${scene.section}`}>
                    {scene.section}
                  </span>
                  <p className="mt-2 text-xs text-ink-400 line-clamp-2">
                    {scene.prose.slice(0, 150)}...
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-ink-800 pb-safe flex gap-2">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-3 border border-ink-700 rounded-lg text-ink-300"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                className="flex-1 py-3 bg-section-departure rounded-lg text-white font-medium"
              >
                Import {preview.length} Scenes
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
