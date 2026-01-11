import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, Scissors, Loader2, ChevronDown, ChevronUp, Edit3, Check, RotateCcw } from 'lucide-react'
import mammoth from 'mammoth'
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

type SplitMethod = 'chapters' | 'wordcount' | 'breaks'

const SECTIONS: NarrativeSection[] = ['departure', 'escape', 'rupture', 'alignment', 'reveal']

const SECTION_COLORS: Record<NarrativeSection, string> = {
  departure: 'bg-section-departure',
  escape: 'bg-section-escape',
  rupture: 'bg-section-rupture',
  alignment: 'bg-section-alignment',
  reveal: 'bg-section-reveal',
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

function parseManuscript(text: string, splitMethod: SplitMethod): ImportedScene[] {
  const scenes: ImportedScene[] = []

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
            section: SECTIONS[Math.min(Math.floor(sceneIndex / (Math.ceil(words.length / wordsPerScene / 5))), 4)],
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
        section: SECTIONS[Math.min(4, Math.floor(sceneIndex / Math.max(1, scenes.length / 5)))],
        prose: currentScene.trim()
      })
    }
  } else if (splitMethod === 'chapters') {
    // Split by chapter markers
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
      // No markers found, fall back to word count
      return parseManuscript(text, 'wordcount')
    }

    // Extract scenes between markers
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index
      const end = i < markers.length - 1 ? markers[i + 1].index : text.length
      const content = text.slice(start, end).replace(CHAPTER_PATTERNS[0], '').trim()

      if (content.length > 50) {
        scenes.push({
          title: markers[i].title,
          section: SECTIONS[Math.min(Math.floor(i / Math.max(1, markers.length / 5)), 4)],
          prose: content
        })
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
          section: SECTIONS[Math.min(Math.floor(i / Math.max(1, parts.length / 5)), 4)],
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
  const [rawText, setRawText] = useState('')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('chapters')
  const [scenes, setScenes] = useState<ImportedScene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Auto-parse when text or split method changes
  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseManuscript(rawText, splitMethod)
      setScenes(parsed)
    } else {
      setScenes([])
    }
  }, [rawText, splitMethod])

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle !== null && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const fileNameLower = file.name.toLowerCase()

    // Handle .docx files
    if (fileNameLower.endsWith('.docx')) {
      setIsLoading(true)
      setLoadingMessage('Extracting text from Word document...')

      try {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        setRawText(result.value)
      } catch (error) {
        console.error('Failed to parse docx:', error)
        alert('Failed to read Word document. Please try copying and pasting the text instead.')
      } finally {
        setIsLoading(false)
        setLoadingMessage('')
      }
      return
    }

    // Handle .doc files (legacy format - limited support)
    if (fileNameLower.endsWith('.doc')) {
      alert('Legacy .doc format is not supported. Please save as .docx or copy/paste your text.')
      setFileName(null)
      return
    }

    // Handle text files (.txt, .md)
    setIsLoading(true)
    setLoadingMessage('Reading file...')
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setRawText(content)
      setIsLoading(false)
      setLoadingMessage('')
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (scenes.length === 0) return
    onImport(scenes)
  }

  const updateSceneTitle = (index: number, title: string) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, title } : s))
  }

  const updateSceneSection = (index: number, section: NarrativeSection) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, section } : s))
  }

  const distributesSections = () => {
    // Auto-distribute sections evenly across scenes
    const scenesPerSection = Math.ceil(scenes.length / 5)
    setScenes(prev => prev.map((s, i) => ({
      ...s,
      section: SECTIONS[Math.min(Math.floor(i / scenesPerSection), 4)]
    })))
  }

  const wordCount = rawText.trim().split(/\s+/).filter(Boolean).length
  const hasContent = rawText.trim().length > 0

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
            <Scissors className="w-5 h-5 text-section-departure" />
            <h2 className="text-lg font-medium text-ink-100">Import & Split</h2>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-section-departure animate-spin" />
            <p className="text-sm text-ink-400">{loadingMessage}</p>
          </div>
        ) : !hasContent ? (
          /* Upload prompt */
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm p-8 border-2 border-dashed border-ink-700 rounded-2xl flex flex-col items-center gap-4 cursor-pointer hover:border-section-departure/50 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center">
                <Upload className="w-8 h-8 text-section-departure" />
              </div>
              <div className="text-center">
                <p className="text-ink-100 font-medium mb-1">Upload your manuscript</p>
                <p className="text-sm text-ink-500">One document, split into scenes</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <FileText className="w-3 h-3" />
                <span>.docx, .txt, or .md</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.text,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-ink-950/50 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-300">{fileName || 'Pasted text'}</span>
                <span className="text-xs text-ink-500">{wordCount.toLocaleString()} words</span>
              </div>
              <button
                onClick={() => { setRawText(''); setFileName(null); setScenes([]) }}
                className="text-xs text-ink-500 hover:text-ink-300"
              >
                Clear
              </button>
            </div>

            {/* Split method tabs */}
            <div className="flex border-b border-ink-800">
              {[
                { key: 'chapters' as SplitMethod, label: 'By Chapters', desc: 'Chapter/Part headers' },
                { key: 'breaks' as SplitMethod, label: 'By Breaks', desc: '*** or --- markers' },
                { key: 'wordcount' as SplitMethod, label: 'By Length', desc: '~800 words each' },
              ].map(method => (
                <button
                  key={method.key}
                  onClick={() => setSplitMethod(method.key)}
                  className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                    splitMethod === method.key
                      ? 'border-section-departure text-ink-100'
                      : 'border-transparent text-ink-500'
                  }`}
                >
                  <div className="text-sm font-medium">{method.label}</div>
                </button>
              ))}
            </div>

            {/* Scene count and actions */}
            <div className="flex items-center justify-between px-4 py-2 bg-ink-900">
              <span className="text-sm text-ink-400">{scenes.length} scenes</span>
              <button
                onClick={distributesSections}
                className="flex items-center gap-1 text-xs text-section-departure"
              >
                <RotateCcw className="w-3 h-3" />
                Auto-assign sections
              </button>
            </div>

            {/* Scene list */}
            <div className="flex-1 overflow-y-auto">
              {scenes.map((scene, i) => (
                <div key={i} className="border-b border-ink-800">
                  {/* Scene header - always visible */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ink-800/30"
                    onClick={() => setExpandedScene(expandedScene === i ? null : i)}
                  >
                    {/* Section indicator */}
                    <div className={`w-1 h-8 rounded-full ${SECTION_COLORS[scene.section]}`} />

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      {editingTitle === i ? (
                        <input
                          ref={titleInputRef}
                          value={scene.title}
                          onChange={(e) => updateSceneTitle(i, e.target.value)}
                          onBlur={() => setEditingTitle(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(null)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-ink-800 border border-ink-600 rounded px-2 py-1 text-sm text-ink-100"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-100 truncate">{scene.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingTitle(i) }}
                            className="text-ink-500 hover:text-ink-300"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="text-xs text-ink-500">
                        {scene.prose.split(/\s+/).length} words
                      </div>
                    </div>

                    {/* Section selector */}
                    <select
                      value={scene.section}
                      onChange={(e) => { e.stopPropagation(); updateSceneSection(i, e.target.value as NarrativeSection) }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-300"
                    >
                      {SECTIONS.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>

                    {/* Expand toggle */}
                    {expandedScene === i ? (
                      <ChevronUp className="w-4 h-4 text-ink-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-ink-500" />
                    )}
                  </div>

                  {/* Scene preview - expanded */}
                  <AnimatePresence>
                    {expandedScene === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-3 pl-8">
                          <p className="text-xs text-ink-400 leading-relaxed line-clamp-6">
                            {scene.prose.slice(0, 500)}...
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Import button */}
            <div className="p-4 border-t border-ink-800 pb-safe">
              <button
                onClick={handleImport}
                disabled={scenes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Import {scenes.length} Scenes
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
