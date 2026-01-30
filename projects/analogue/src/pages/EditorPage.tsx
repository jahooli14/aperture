import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Tag,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useEditorStore } from '../stores/useEditorStore'
import { applyMask, getStorageText } from '../lib/mask'
import { flagGlassesMention } from '../lib/validation'
import PulseCheck from '../components/PulseCheck'
import ReverbTagModal from '../components/ReverbTagModal'
import ExportModal from '../components/ExportModal'
import MetadataDrawer from '../components/MetadataDrawer'

export default function EditorPage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const navigate = useNavigate()
  const { manuscript, updateScene, addGlassesMention } = useManuscriptStore()
  const {
    footnoteDrawerOpen,
    footnoteDrawerHeight,
    openFootnoteDrawer,
    closeFootnoteDrawer,
    showPulseCheck,
    setShowPulseCheck,
    showReverbTagging,
    setShowReverbTagging,
    selectedText,
    setSelection,
    clearSelection,
    focusMode,
    toggleFocusMode,
    markSaved,
    textSize,
    cycleTextSize
  } = useEditorStore()

  const proseRef = useRef<HTMLTextAreaElement>(null)
  const footnoteRef = useRef<HTMLTextAreaElement>(null)
  const dragControls = useDragControls()
  const [showDrawer, setShowDrawer] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [isReadMode, setIsReadMode] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  // Local state for immediate UI updates (prevents cursor jumping)
  const [localProse, setLocalProse] = useState<string>('')
  const [isComposing, setIsComposing] = useState(false)
  const cursorPositionRef = useRef<number>(0)
  const debounceTimerRef = useRef<number | null>(null)

  const scene = manuscript?.scenes.find(s => s.id === sceneId)

  // Get adjacent scenes for navigation
  const sortedScenes = useMemo(() => {
    if (!manuscript) return []
    return [...manuscript.scenes].sort((a, b) => a.order - b.order)
  }, [manuscript])

  const currentIndex = sortedScenes.findIndex(s => s.id === sceneId)
  const prevScene = currentIndex > 0 ? sortedScenes[currentIndex - 1] : null
  const nextScene = currentIndex < sortedScenes.length - 1 ? sortedScenes[currentIndex + 1] : null

  // Swipe handlers - only trigger if not interacting with textarea
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't trigger swipe if user is interacting with a textarea or input
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      setTouchStart(null)
      return
    }
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return

    // Don't trigger swipe if user is interacting with a textarea or input
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      setTouchStart(null)
      return
    }

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd
    const threshold = 100

    if (diff > threshold && nextScene) {
      navigate(`/edit/${nextScene.id}`)
    } else if (diff < -threshold && prevScene) {
      navigate(`/edit/${prevScene.id}`)
    }
    setTouchStart(null)
  }

  // Sync local state with scene changes
  useEffect(() => {
    if (scene && manuscript) {
      const displayProse = applyMask(
        scene.prose,
        manuscript.protagonistRealName,
        manuscript.maskModeEnabled
      )
      setLocalProse(displayProse)
    }
  }, [scene?.id, manuscript?.protagonistRealName, manuscript?.maskModeEnabled])

  // Auto-save indicator - mark as saved after update
  useEffect(() => {
    if (scene) {
      const timer = setTimeout(() => markSaved(), 500)
      return () => clearTimeout(timer)
    }
  }, [scene?.prose, scene?.footnotes, markSaved])

  // Redirect if no manuscript after a brief delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!manuscript) {
        navigate('/', { replace: true })
      } else if (!scene) {
        navigate('/toc', { replace: true })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [manuscript, scene, navigate])

  // Check for first-time opening (needs Pulse Check)
  useEffect(() => {
    if (scene && !scene.pulseCheckCompletedAt) {
      setShowPulseCheck(true)
    }
  }, [scene, setShowPulseCheck])

  // Track cursor position with selectionchange event (more reliable than onChange)
  useEffect(() => {
    const textarea = proseRef.current
    if (!textarea) return

    const handleSelectionChange = () => {
      if (document.activeElement === textarea && !isComposing) {
        cursorPositionRef.current = textarea.selectionStart
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [isComposing])

  // Restore cursor position using useLayoutEffect (before paint, prevents visible jumps)
  useLayoutEffect(() => {
    if (!isReadMode && proseRef.current && cursorPositionRef.current > 0) {
      const textarea = proseRef.current
      const pos = Math.min(cursorPositionRef.current, textarea.value.length)
      textarea.setSelectionRange(pos, pos)
    }
  }, [localProse, isReadMode])

  // Handle mobile keyboard viewport changes
  useEffect(() => {
    if (!window.visualViewport) return

    let keyboardVisible = false

    const handleViewportResize = () => {
      const viewport = window.visualViewport
      if (!viewport || !proseRef.current) return

      const viewportHeight = viewport.height
      const windowHeight = window.innerHeight
      const heightDiff = windowHeight - viewportHeight

      // Keyboard appeared
      if (heightDiff > 150 && document.activeElement === proseRef.current) {
        keyboardVisible = true

        // Scroll cursor into view after keyboard settles
        requestAnimationFrame(() => {
          if (proseRef.current && keyboardVisible) {
            const { selectionStart } = proseRef.current
            const lines = proseRef.current.value.substring(0, selectionStart).split('\n').length
            const lineHeight = parseInt(getComputedStyle(proseRef.current).lineHeight) || 24

            // Scroll to show cursor with padding
            proseRef.current.scrollTop = Math.max(0, (lines - 2) * lineHeight)
          }
        })
      } else if (heightDiff < 50) {
        keyboardVisible = false
      }
    }

    window.visualViewport.addEventListener('resize', handleViewportResize)
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize)
  }, [])

  // Check for glasses mentions on prose change
  const checkForGlasses = useCallback((text: string) => {
    if (!scene || !manuscript) return

    const glassesPatterns = /\b(glasses|spectacles|lenses|frames)\b/gi
    let match
    while ((match = glassesPatterns.exec(text)) !== null) {
      const start = Math.max(0, match.index - 50)
      const end = Math.min(text.length, match.index + match[0].length + 50)
      const context = text.slice(start, end)

      // Check if this mention is already tracked
      const alreadyTracked = scene.glassesmentions.some(m =>
        m.text.includes(match![0]) && m.text === context
      )

      if (!alreadyTracked) {
        const validation = flagGlassesMention(context)
        addGlassesMention({
          sceneId: scene.id,
          text: context,
          isValidDraw: validation.isValidDraw,
          flagged: !validation.isValidDraw
        })
      }
    }
  }, [scene, manuscript, addGlassesMention])

  const handleProseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!scene || !manuscript) return

    // Don't update during IME composition
    if (isComposing) return

    const newValue = e.target.value
    cursorPositionRef.current = e.target.selectionStart

    // Update local state immediately for responsive UI
    setLocalProse(newValue)

    // Clear previous debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce store update to reduce re-renders and improve performance
    debounceTimerRef.current = window.setTimeout(() => {
      const rawText = getStorageText(
        newValue,
        manuscript.protagonistRealName,
        manuscript.maskModeEnabled
      )
      updateScene(scene.id, { prose: rawText })
      checkForGlasses(rawText)
    }, 200)
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false)
    // Process the final composed text
    if (scene && manuscript) {
      const newValue = e.currentTarget.value
      cursorPositionRef.current = e.currentTarget.selectionStart
      setLocalProse(newValue)

      const rawText = getStorageText(
        newValue,
        manuscript.protagonistRealName,
        manuscript.maskModeEnabled
      )
      updateScene(scene.id, { prose: rawText })
      checkForGlasses(rawText)
    }
  }

  const handleFootnoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!scene) return
    updateScene(scene.id, { footnotes: e.target.value })
  }

  const handleTextSelect = () => {
    const textarea = proseRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    // Only show selection toolbar if there's actual selected text (more than a few characters)
    // and the user has finished selecting (not just placing cursor)
    if (start !== end && end - start > 3) {
      const text = textarea.value.slice(start, end)

      // Debounce to avoid interference while user is still selecting
      setTimeout(() => {
        // Check selection is still valid after delay
        if (textarea.selectionStart === start && textarea.selectionEnd === end) {
          setSelection(text, start, end)
        }
      }, 300)
    } else {
      clearSelection()
    }
  }

  const handleMouseDown = () => {
    clearSelection()
  }

  const handleMouseUp = () => {
    // Text selection will be handled by onSelect event
  }

  const handleTagWisdom = () => {
    if (selectedText) {
      setShowReverbTagging(true)
    }
  }

  if (!scene || !manuscript) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ink-600 border-t-ink-300 rounded-full animate-spin" />
      </div>
    )
  }

  // Use localProse for edit mode (immediate updates), applyMask for read mode
  const displayProse = isReadMode
    ? applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled)
    : localProse

  // Parse footnotes into numbered array
  const parseFootnotes = (footnotesText: string): string[] => {
    if (!footnotesText.trim()) return []

    // Split by double newlines to get individual footnotes
    const footnotes = footnotesText
      .split(/\n\n+/)
      .map(note => note.trim())
      .filter(note => note.length > 0)

    return footnotes
  }

  const footnotes = parseFootnotes(scene.footnotes)

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe text-size-${textSize}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-3 py-3 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>

        <h1 className="text-base font-medium text-ink-100 truncate flex-1 text-center px-4">
          {scene.title}
        </h1>

        <button onClick={() => setShowDrawer(true)} className="p-2 -mr-2">
          <Menu className="w-5 h-5 text-ink-400" />
        </button>
      </header>

      {/* Prose Pane */}
      <div
        className="flex-1 relative min-h-0"
        style={footnoteDrawerOpen ? { height: `${100 - footnoteDrawerHeight}%` } : undefined}
      >
        {isReadMode ? (
          /* Read mode - formatted paragraphs */
          <div className="absolute inset-0 overflow-y-auto p-3 pb-24">
            <div className="prose-container max-w-none">
              {displayProse.split(/\n\n+/).map((paragraph, i) => (
                paragraph.trim() && (
                  <p
                    key={i}
                    className="text-ink-100 text-base leading-relaxed mb-4 first:mt-0"
                    style={{ textIndent: i > 0 ? '2em' : '0' }}
                  >
                    {paragraph.split('\n').map((line, j) => (
                      <span key={j}>
                        {line}
                        {j < paragraph.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                )
              ))}
              {!displayProse && (
                <p className="text-ink-600 italic">No content yet. Switch to Edit mode to start writing.</p>
              )}

              {/* Footnotes section */}
              {footnotes.length > 0 && (
                <div className="mt-6 pt-4 border-t border-ink-700">
                  <div className="space-y-2">
                    {footnotes.map((footnote, i) => (
                      <p key={i} className="text-ink-400 text-sm leading-relaxed">
                        <span className="text-ink-500">[{i + 1}]</span> {footnote}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit mode - textarea with serif font and footnotes display */
          <div className="absolute inset-0 overflow-y-auto pb-24" style={{ scrollPaddingBottom: '150px', scrollPaddingTop: '100px' }}>
            <textarea
              ref={proseRef}
              value={displayProse}
              onChange={handleProseChange}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onSelect={handleTextSelect}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              placeholder="Begin writing...

Start a new paragraph by pressing Enter twice.

The Read mode will show your text with proper paragraph formatting."
              className="w-full p-3 bg-transparent text-ink-100 placeholder:text-ink-600 resize-none prose-edit focus:outline-none min-h-[300px]"
              style={{
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                fontSize: '16px',
                scrollPaddingBottom: '150px',
                scrollPaddingTop: '100px'
              }}
              autoCapitalize="sentences"
              autoCorrect="on"
              autoComplete="off"
              spellCheck="true"
              inputMode="text"
              enterKeyHint="enter"
            />

            {/* Footnotes section in edit mode */}
            {footnotes.length > 0 && (
              <div className="px-3 pb-3">
                <div className="mt-6 pt-4 border-t border-ink-700">
                  <div className="space-y-2">
                    {footnotes.map((footnote, i) => (
                      <p key={i} className="text-ink-400 text-sm leading-relaxed">
                        <span className="text-ink-500">[{i + 1}]</span> {footnote}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selection toolbar */}
        <AnimatePresence>
          {selectedText && !isReadMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-4 py-2 border-t border-ink-800 bg-ink-900"
            >
              <span className="text-xs text-ink-500 truncate flex-1">
                "{selectedText.slice(0, 30)}..."
              </span>
              <button
                onClick={handleTagWisdom}
                className="flex items-center gap-1 px-3 py-1.5 bg-section-departure rounded text-xs text-white"
              >
                <Tag className="w-3 h-3" />
                Tag Wisdom
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footnote Drawer */}
      <AnimatePresence>
        {footnoteDrawerOpen ? (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${footnoteDrawerHeight}%` }}
            exit={{ height: 0 }}
            className="footnote-drawer border-t border-ink-700 bg-ink-900 flex flex-col"
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-center py-2 cursor-ns-resize"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 bg-ink-600 rounded-full" />
            </div>

            <div className="flex items-center gap-2 px-4 pb-2">
              <MessageSquare className="w-4 h-4 text-ink-500" />
              <span className="text-xs text-ink-500 uppercase tracking-wider">
                Subconscious / Meta Voice
              </span>
              <button
                onClick={closeFootnoteDrawer}
                className="ml-auto text-xs text-ink-500"
              >
                Collapse
              </button>
            </div>

            <textarea
              ref={footnoteRef}
              value={scene.footnotes}
              onChange={handleFootnoteChange}
              placeholder="The acerbic inner voice..."
              className="flex-1 w-full px-4 pb-4 bg-transparent text-ink-300 text-sm leading-relaxed placeholder:text-ink-600 resize-none"
            />
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={openFootnoteDrawer}
            className="focus-fade fixed bottom-20 right-4 w-12 h-12 bg-ink-800 border border-ink-700 rounded-full flex items-center justify-center shadow-lg pb-safe"
          >
            <Plus className="w-5 h-5 text-ink-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scene Navigation */}
      <div className="focus-fade fixed bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4 pb-safe">
        <button
          onClick={() => prevScene && navigate(`/edit/${prevScene.id}`)}
          disabled={!prevScene}
          className="flex items-center gap-1 px-3 py-2 bg-ink-900/90 border border-ink-700 rounded-lg text-xs text-ink-300 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>
        <span className="text-xs text-ink-500">
          {currentIndex + 1} / {sortedScenes.length}
        </span>
        <button
          onClick={() => nextScene && navigate(`/edit/${nextScene.id}`)}
          disabled={!nextScene}
          className="flex items-center gap-1 px-3 py-2 bg-ink-900/90 border border-ink-700 rounded-lg text-xs text-ink-300 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Pulse Check Modal */}
      <AnimatePresence>
        {showPulseCheck && (
          <PulseCheck scene={scene} onComplete={() => setShowPulseCheck(false)} />
        )}
      </AnimatePresence>

      {/* Reverberation Tag Modal */}
      <AnimatePresence>
        {showReverbTagging && (
          <ReverbTagModal
            scene={scene}
            selectedText={selectedText}
            onClose={() => {
              setShowReverbTagging(false)
              clearSelection()
            }}
          />
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && manuscript && (
          <ExportModal
            manuscript={manuscript}
            onClose={() => setShowExport(false)}
          />
        )}
      </AnimatePresence>

      {/* Metadata Drawer */}
      <MetadataDrawer
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        scene={scene}
        mode={isReadMode ? 'read' : 'edit'}
        onModeChange={(mode) => setIsReadMode(mode === 'read')}
        textSize={textSize}
        onTextSizeChange={(size) => {
          // Manually set text size - we'll need to add this to the store
          const sizes = ['small', 'medium', 'large'] as const
          const currentIndex = sizes.indexOf(textSize)
          const targetIndex = sizes.indexOf(size)
          const clicks = (targetIndex - currentIndex + 3) % 3
          for (let i = 0; i < clicks; i++) {
            cycleTextSize()
          }
        }}
        focusMode={focusMode}
        onFocusMode={toggleFocusMode}
        onExport={() => setShowExport(true)}
        onRedoPulseCheck={() => setShowPulseCheck(true)}
        currentSceneIndex={currentIndex}
        totalScenes={sortedScenes.length}
        allScenes={sortedScenes}
      />
    </div>
  )
}
