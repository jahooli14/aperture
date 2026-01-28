import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, Scissors, Loader2, ChevronDown, ChevronUp, Edit3, Check, RotateCcw, ClipboardPaste } from 'lucide-react'
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
  footnotes: string
  wordCount: number // Pre-computed
  chapterId: string | null
  chapterTitle: string | null
  sceneNumber: number | null
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

// Fast word count - O(n) single pass
function countWords(text: string): number {
  let count = 0
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    const isSpace = c === 32 || c === 10 || c === 13 || c === 9
    if (isSpace) {
      inWord = false
    } else if (!inWord) {
      inWord = true
      count++
    }
  }
  return count
}

// Find all paragraph breaks in text - O(n)
function findParagraphBreaks(text: string): number[] {
  const breaks: number[] = []
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '\n' && text[i + 1] === '\n') {
      breaks.push(i)
    }
  }
  return breaks
}

// Extract footnotes from text
function extractFootnotes(text: string): { prose: string; footnotes: string } {
  // Common footnote patterns:
  // [^1], [1], ^1 for inline markers
  // Look for footnote section at the end (often after "---" or multiple blank lines)

  const footnoteTexts: string[] = []

  // Split text to find footnotes section (usually at end after separator)
  const footnoteSectionMatch = text.match(/\n\s*(?:---|footnotes?:)\s*\n([\s\S]+)$/i)

  if (footnoteSectionMatch) {
    // Found explicit footnotes section
    const footnoteSection = footnoteSectionMatch[1]
    const proseOnly = text.slice(0, footnoteSectionMatch.index || text.length).trim()

    // Extract individual footnotes from section
    // Match patterns like: [1] text, [^1] text, 1. text, etc.
    const footnotePattern = /^\s*(?:\[(?:\^)?(\d+)\]|(\d+)\.)\s+(.+?)(?=^\s*(?:\[(?:\^)?\d+\]|\d+\.)|$)/gms
    let match

    while ((match = footnotePattern.exec(footnoteSection)) !== null) {
      const num = match[1] || match[2]
      const text = match[3].trim()
      footnoteTexts.push(`[^${num}] ${text}`)
    }

    return {
      prose: proseOnly,
      footnotes: footnoteTexts.join('\n\n')
    }
  }

  // No explicit section - check for inline footnotes that might be scattered
  // Pattern: [^1] text immediately following in parentheses or brackets
  // For now, return text as-is if no footnote section found
  // User can manually separate if needed

  return {
    prose: text,
    footnotes: ''
  }
}

function parseManuscript(text: string, splitMethod: SplitMethod): ImportedScene[] {
  const scenes: ImportedScene[] = []
  const totalWords = countWords(text)

  // Estimate scenes for section distribution
  const estimatedScenes = splitMethod === 'wordcount'
    ? Math.ceil(totalWords / 800)
    : 20 // Will be refined
  const scenesPerSection = Math.max(1, Math.ceil(estimatedScenes / 5))

  if (splitMethod === 'wordcount') {
    // Efficient word-count based splitting
    const targetWordsPerScene = 800
    const paragraphBreaks = findParagraphBreaks(text)

    if (paragraphBreaks.length === 0) {
      // No paragraph breaks - split by sentences or just chunk it
      const chunkSize = Math.floor(text.length / Math.ceil(totalWords / targetWordsPerScene))
      let start = 0
      let sceneIndex = 0

      while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length)
        // Try to end at a period or newline
        if (end < text.length) {
          const periodIdx = text.lastIndexOf('. ', end)
          if (periodIdx > start + chunkSize * 0.5) {
            end = periodIdx + 1
          }
        }

        const chunk = text.slice(start, end).trim()
        if (chunk) {
          const { prose, footnotes } = extractFootnotes(chunk)
          scenes.push({
            title: `Scene ${sceneIndex + 1}`,
            section: SECTIONS[Math.min(Math.floor(sceneIndex / scenesPerSection), 4)],
            prose,
            footnotes,
            wordCount: countWords(prose),
            chapterId: null,
            chapterTitle: null,
            sceneNumber: null
          })
          sceneIndex++
        }
        start = end
      }
    } else {
      // Split at paragraph breaks near word count targets
      let currentStart = 0
      let currentWordCount = 0
      let sceneIndex = 0
      let lastBreakIdx = 0

      // Count words up to each paragraph break
      for (let i = 0; i <= paragraphBreaks.length; i++) {
        const breakPos = i < paragraphBreaks.length ? paragraphBreaks[i] : text.length
        const chunk = text.slice(currentStart, breakPos)
        const chunkWords = countWords(chunk)

        if (currentWordCount + chunkWords >= targetWordsPerScene && currentWordCount > 0) {
          // Use the previous break point
          const sceneText = text.slice(currentStart, paragraphBreaks[lastBreakIdx] || breakPos).trim()
          if (sceneText) {
            const { prose, footnotes } = extractFootnotes(sceneText)
            scenes.push({
              title: `Scene ${sceneIndex + 1}`,
              section: SECTIONS[Math.min(Math.floor(sceneIndex / scenesPerSection), 4)],
              prose,
              footnotes,
              wordCount: countWords(prose),
              chapterId: null,
              chapterTitle: null,
              sceneNumber: null
            })
            sceneIndex++
          }
          currentStart = (paragraphBreaks[lastBreakIdx] || breakPos) + 2
          currentWordCount = countWords(text.slice(currentStart, breakPos))
        } else {
          currentWordCount += chunkWords
        }
        lastBreakIdx = i
      }

      // Add remaining text
      const remaining = text.slice(currentStart).trim()
      if (remaining) {
        const { prose, footnotes } = extractFootnotes(remaining)
        scenes.push({
          title: `Scene ${sceneIndex + 1}`,
          section: SECTIONS[Math.min(Math.floor(sceneIndex / scenesPerSection), 4)],
          prose,
          footnotes,
          wordCount: countWords(prose),
          chapterId: null,
          chapterTitle: null,
          sceneNumber: null
        })
      }
    }
  } else if (splitMethod === 'chapters') {
    // Chapter-based splitting with proper chapter/scene distinction
    // First, find all chapter markers (e.g., "Chapter 1", "Chapter One", "CHAPTER 1")
    const chapterRegex = /^(?:Chapter|Part)\s+(?:\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)[:\s]*(.*)$/gim
    const chapterMarkers: { index: number; title: string; end: number; number: string }[] = []

    let chMatch
    while ((chMatch = chapterRegex.exec(text)) !== null) {
      const fullMatch = chMatch[0]
      const chapterNum = fullMatch.match(/(?:Chapter|Part)\s+((?:\d+|[IVXLC]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten))/i)?.[1] || String(chapterMarkers.length + 1)
      const subtitle = chMatch[1]?.trim() || ''
      const title = subtitle ? `Chapter ${chapterNum}: ${subtitle}` : `Chapter ${chapterNum}`

      chapterMarkers.push({
        index: chMatch.index,
        title,
        number: chapterNum,
        end: chMatch.index + fullMatch.length
      })
    }

    // Scene marker regex: # followed by a number anywhere in the text (e.g., #1, #2, #42)
    // This is the ONLY place # is used in scripts, so any #N is a scene break
    const sceneRegex = /#(\d+)/g

    // Check for scene markers in the full text
    const allSceneMarkers: { index: number; title: string; end: number; number: number }[] = []
    let scMatch
    while ((scMatch = sceneRegex.exec(text)) !== null) {
      allSceneMarkers.push({
        index: scMatch.index,
        title: `Scene ${scMatch[1]}`,
        end: scMatch.index + scMatch[0].length,
        number: parseInt(scMatch[1])
      })
    }

    // If no chapters but we have scene markers, use scene markers directly
    if (chapterMarkers.length === 0) {
      if (allSceneMarkers.length === 0) {
        // No chapters and no scene markers, fall back to word count
        return parseManuscript(text, 'wordcount')
      }

      // Use scene markers as the primary split points
      const actualScenesPerSection = Math.max(1, Math.ceil(allSceneMarkers.length / 5))

      for (let scIdx = 0; scIdx < allSceneMarkers.length; scIdx++) {
        const sceneStart = allSceneMarkers[scIdx].end
        const sceneEnd = scIdx < allSceneMarkers.length - 1 ? allSceneMarkers[scIdx + 1].index : text.length
        const sceneContent = text.slice(sceneStart, sceneEnd).trim()

        if (sceneContent.length > 20) {
          const { prose, footnotes } = extractFootnotes(sceneContent)
          const sceneNumber = allSceneMarkers[scIdx].number
          scenes.push({
            title: `Scene ${sceneNumber}`,
            section: SECTIONS[Math.min(Math.floor(scIdx / actualScenesPerSection), 4)],
            prose,
            footnotes,
            wordCount: countWords(prose),
            chapterId: null,
            chapterTitle: null,
            sceneNumber
          })
        }
      }
      return scenes
    }

    // Process each chapter with scene markers within
    let sceneGlobalIndex = 0
    const actualScenesPerSection = Math.max(1, Math.ceil(chapterMarkers.length * 2 / 5)) // Estimate scenes per section

    for (let chIdx = 0; chIdx < chapterMarkers.length; chIdx++) {
      const chapterStart = chapterMarkers[chIdx].end
      const chapterEnd = chIdx < chapterMarkers.length - 1 ? chapterMarkers[chIdx + 1].index : text.length
      const chapterContent = text.slice(chapterStart, chapterEnd).trim()
      const chapterId = `chapter-${chapterMarkers[chIdx].number}`

      if (chapterContent.length < 50) continue

      // Within this chapter, look for scene markers (#N anywhere in text)
      const chapterSceneRegex = /#(\d+)/g
      const sceneMarkers: { index: number; title: string; end: number; number: number }[] = []

      let chScMatch
      while ((chScMatch = chapterSceneRegex.exec(chapterContent)) !== null) {
        sceneMarkers.push({
          index: chScMatch.index,
          title: `Scene ${chScMatch[1]}`,
          end: chScMatch.index + chScMatch[0].length,
          number: parseInt(chScMatch[1])
        })
      }

      // If no scene markers found, treat entire chapter as one scene
      if (sceneMarkers.length === 0) {
        const { prose, footnotes } = extractFootnotes(chapterContent)
        scenes.push({
          title: chapterMarkers[chIdx].title,
          section: SECTIONS[Math.min(Math.floor(sceneGlobalIndex / actualScenesPerSection), 4)],
          prose,
          footnotes,
          wordCount: countWords(prose),
          chapterId,
          chapterTitle: chapterMarkers[chIdx].title,
          sceneNumber: 1
        })
        sceneGlobalIndex++
      } else {
        // Process each scene within the chapter
        for (let scIdx = 0; scIdx < sceneMarkers.length; scIdx++) {
          const sceneStart = sceneMarkers[scIdx].end
          const sceneEnd = scIdx < sceneMarkers.length - 1 ? sceneMarkers[scIdx + 1].index : chapterContent.length
          const sceneContent = text.slice(chapterStart + sceneStart, chapterStart + sceneEnd).trim()

          if (sceneContent.length > 20) {
            const { prose, footnotes } = extractFootnotes(sceneContent)
            const sceneNumber = sceneMarkers[scIdx].number

            scenes.push({
              title: `${chapterMarkers[chIdx].title} - Scene ${sceneNumber}`,
              section: SECTIONS[Math.min(Math.floor(sceneGlobalIndex / actualScenesPerSection), 4)],
              prose,
              footnotes,
              wordCount: countWords(prose),
              chapterId,
              chapterTitle: chapterMarkers[chIdx].title,
              sceneNumber
            })
            sceneGlobalIndex++
          }
        }
      }
    }
  } else {
    // Scene break splitting (*** or ---)
    const parts = text.split(/\n\s*(?:\*{3,}|-{3,}|~{3,})\s*\n/)

    if (parts.length <= 1) {
      // No breaks found, fall back to word count
      return parseManuscript(text, 'wordcount')
    }

    const actualScenesPerSection = Math.max(1, Math.ceil(parts.length / 5))
    parts.forEach((part, i) => {
      const trimmed = part.trim()
      if (trimmed.length > 50) {
        const { prose, footnotes } = extractFootnotes(trimmed)
        scenes.push({
          title: `Scene ${scenes.length + 1}`,
          section: SECTIONS[Math.min(Math.floor(i / actualScenesPerSection), 4)],
          prose,
          footnotes,
          wordCount: countWords(prose),
          chapterId: null,
          chapterTitle: null,
          sceneNumber: null
        })
      }
    })
  }

  return scenes
}

// Parse in chunks to not block UI
async function parseManuscriptAsync(text: string, splitMethod: SplitMethod, onProgress?: (msg: string) => void): Promise<ImportedScene[]> {
  onProgress?.('Analyzing document structure...')

  // Give UI a chance to update
  await new Promise(resolve => setTimeout(resolve, 10))

  const scenes = parseManuscript(text, splitMethod)

  onProgress?.(`Found ${scenes.length} scenes`)
  await new Promise(resolve => setTimeout(resolve, 10))

  return scenes
}

type InputMode = 'file' | 'paste'

export default function ImportModal({ onImport, onClose }: ImportModalProps) {
  const [rawText, setRawText] = useState('')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('chapters')
  const [scenes, setScenes] = useState<ImportedScene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [expandedScene, setExpandedScene] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [pasteText, setPasteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Memoized word count - only compute once when text changes
  const wordCount = useMemo(() => {
    if (!rawText) return 0
    return countWords(rawText)
  }, [rawText])

  const hasContent = rawText.length > 0

  // Parse when text or split method changes
  useEffect(() => {
    if (!rawText.trim()) {
      setScenes([])
      return
    }

    let cancelled = false
    setIsParsing(true)
    setLoadingMessage('Splitting into scenes...')

    parseManuscriptAsync(rawText, splitMethod, setLoadingMessage)
      .then(parsed => {
        if (!cancelled) {
          setScenes(parsed)
          setIsParsing(false)
          setLoadingMessage('')
        }
      })

    return () => { cancelled = true }
  }, [rawText, splitMethod])

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle !== null && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileNameLower = file.name.toLowerCase()
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)

    // Validate file type
    const validExtensions = ['.txt', '.md', '.text', '.docx']
    const hasValidExtension = validExtensions.some(ext => fileNameLower.endsWith(ext))

    if (!hasValidExtension) {
      if (fileNameLower.endsWith('.doc')) {
        alert('Legacy .doc format is not supported. Please save as .docx or copy/paste your text.')
      } else {
        alert('Please select a .txt, .md, or .docx file.')
      }
      return
    }

    setFileName(file.name)
    setIsLoading(true)

    // Handle .docx files
    if (fileNameLower.endsWith('.docx')) {
      setLoadingMessage(`Reading Word document (${fileSizeMB}MB)...`)

      try {
        // Give UI time to show loading state
        await new Promise(resolve => setTimeout(resolve, 50))

        const arrayBuffer = await file.arrayBuffer()
        setLoadingMessage('Extracting text from Word document...')
        await new Promise(resolve => setTimeout(resolve, 50))

        const result = await mammoth.extractRawText({ arrayBuffer })

        if (!result.value || result.value.trim().length === 0) {
          throw new Error('No text content found in document')
        }

        setRawText(result.value)
      } catch (error) {
        console.error('Failed to parse docx:', error)
        alert('Failed to read Word document. Please try copying and pasting the text instead.')
        setFileName(null)
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Handle text files (.txt, .md)
    setLoadingMessage(`Reading file (${fileSizeMB}MB)...`)

    try {
      // Use async/await pattern for FileReader
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const text = event.target?.result as string
          if (!text || text.trim().length === 0) {
            reject(new Error('File appears to be empty'))
          } else {
            resolve(text)
          }
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsText(file)
      })

      setRawText(content)
    } catch (error) {
      console.error('Failed to read file:', error)
      alert(error instanceof Error ? error.message : 'Failed to read file')
      setFileName(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleImport = useCallback(() => {
    if (scenes.length === 0) return
    onImport(scenes)
  }, [scenes, onImport])

  const updateSceneTitle = useCallback((index: number, title: string) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, title } : s))
  }, [])

  const updateSceneSection = useCallback((index: number, section: NarrativeSection) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, section } : s))
  }, [])

  const distributeSections = useCallback(() => {
    const scenesPerSection = Math.ceil(scenes.length / 5)
    setScenes(prev => prev.map((s, i) => ({
      ...s,
      section: SECTIONS[Math.min(Math.floor(i / scenesPerSection), 4)]
    })))
  }, [scenes.length])

  const clearImport = useCallback(() => {
    setRawText('')
    setFileName(null)
    setScenes([])
    setPasteText('')
  }, [])

  const handlePasteSubmit = useCallback(() => {
    if (!pasteText.trim()) return
    setRawText(pasteText)
    setFileName(null)
  }, [pasteText])

  const showLoading = isLoading || isParsing

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

        {showLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 text-section-departure animate-spin" />
            <p className="text-sm text-ink-400">{loadingMessage}</p>
            {wordCount > 0 && (
              <p className="text-xs text-ink-600">{wordCount.toLocaleString()} words</p>
            )}
          </div>
        ) : !hasContent ? (
          /* Input mode selection */
          <div className="flex-1 flex flex-col">
            {/* Input mode tabs */}
            <div className="flex border-b border-ink-800">
              <button
                onClick={() => setInputMode('file')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                  inputMode === 'file'
                    ? 'border-section-departure text-ink-100'
                    : 'border-transparent text-ink-500'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload File</span>
              </button>
              <button
                onClick={() => setInputMode('paste')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-colors ${
                  inputMode === 'paste'
                    ? 'border-section-departure text-ink-100'
                    : 'border-transparent text-ink-500'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="text-sm">Paste Text</span>
              </button>
            </div>

            {inputMode === 'file' ? (
              /* File upload */
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-sm p-8 border-2 border-dashed border-ink-700 rounded-2xl flex flex-col items-center gap-4 cursor-pointer hover:border-section-departure/50 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-ink-800 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-section-departure" />
                  </div>
                  <div className="text-center">
                    <p className="text-ink-100 font-medium mb-1">Tap to select file</p>
                    <p className="text-sm text-ink-500">.docx, .txt, or .md</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-ink-600 text-center">
                  File picker not working? Use the Paste Text tab instead.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              /* Paste text */
              <div className="flex-1 flex flex-col p-4">
                <p className="text-xs text-ink-500 mb-2">
                  Paste your entire manuscript below. Copy from Word, Google Docs, or any text editor.
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste your manuscript text here..."
                  className="flex-1 w-full p-3 bg-ink-950 border border-ink-800 rounded-lg text-ink-100 text-sm leading-relaxed placeholder:text-ink-600 resize-none"
                  autoFocus
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-ink-500">
                    {pasteText ? `${countWords(pasteText).toLocaleString()} words` : 'No text yet'}
                  </span>
                  <button
                    onClick={handlePasteSubmit}
                    disabled={!pasteText.trim()}
                    className="px-4 py-2 bg-section-departure rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-ink-950/50 border-b border-ink-800">
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-300 truncate max-w-[150px]">{fileName || 'Pasted text'}</span>
                <span className="text-xs text-ink-500">{wordCount.toLocaleString()} words</span>
              </div>
              <button
                onClick={clearImport}
                className="text-xs text-ink-500 hover:text-ink-300"
              >
                Clear
              </button>
            </div>

            {/* Split method tabs */}
            <div className="flex border-b border-ink-800">
              {[
                { key: 'chapters' as SplitMethod, label: 'Chapters' },
                { key: 'breaks' as SplitMethod, label: 'Breaks' },
                { key: 'wordcount' as SplitMethod, label: '~800w' },
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
                onClick={distributeSections}
                className="flex items-center gap-1 text-xs text-section-departure"
              >
                <RotateCcw className="w-3 h-3" />
                Auto-assign sections
              </button>
            </div>

            {/* Scene list */}
            <div className="flex-1 overflow-y-auto">
              {scenes.map((scene, i) => (
                <SceneRow
                  key={i}
                  scene={scene}
                  isExpanded={expandedScene === i}
                  isEditing={editingTitle === i}
                  onToggleExpand={() => setExpandedScene(expandedScene === i ? null : i)}
                  onStartEdit={() => setEditingTitle(i)}
                  onEndEdit={() => setEditingTitle(null)}
                  onUpdateTitle={(title) => updateSceneTitle(i, title)}
                  onUpdateSection={(section) => updateSceneSection(i, section)}
                  titleInputRef={editingTitle === i ? titleInputRef : undefined}
                />
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

// Separate component to avoid re-renders
interface SceneRowProps {
  scene: ImportedScene
  isExpanded: boolean
  isEditing: boolean
  onToggleExpand: () => void
  onStartEdit: () => void
  onEndEdit: () => void
  onUpdateTitle: (title: string) => void
  onUpdateSection: (section: NarrativeSection) => void
  titleInputRef?: React.RefObject<HTMLInputElement | null>
}

function SceneRow({
  scene,
  isExpanded,
  isEditing,
  onToggleExpand,
  onStartEdit,
  onEndEdit,
  onUpdateTitle,
  onUpdateSection,
  titleInputRef
}: SceneRowProps) {
  return (
    <div className="border-b border-ink-800">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ink-800/30"
        onClick={onToggleExpand}
      >
        {/* Section indicator */}
        <div className={`w-1 h-8 rounded-full ${SECTION_COLORS[scene.section]}`} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={titleInputRef}
              value={scene.title}
              onChange={(e) => onUpdateTitle(e.target.value)}
              onBlur={onEndEdit}
              onKeyDown={(e) => e.key === 'Enter' && onEndEdit()}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-ink-800 border border-ink-600 rounded px-2 py-1 text-sm text-ink-100"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink-100 truncate">{scene.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit() }}
                className="text-ink-500 hover:text-ink-300 flex-shrink-0"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-xs text-ink-500">
            {scene.wordCount.toLocaleString()} words
          </div>
        </div>

        {/* Section selector */}
        <select
          value={scene.section}
          onChange={(e) => { e.stopPropagation(); onUpdateSection(e.target.value as NarrativeSection) }}
          onClick={(e) => e.stopPropagation()}
          className="bg-ink-800 border border-ink-700 rounded px-2 py-1 text-xs text-ink-300"
        >
          {SECTIONS.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {/* Expand toggle */}
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-ink-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ink-500 flex-shrink-0" />
        )}
      </div>

      {/* Scene preview - expanded */}
      <AnimatePresence>
        {isExpanded && (
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
  )
}
