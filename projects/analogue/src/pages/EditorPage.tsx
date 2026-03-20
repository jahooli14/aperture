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
  Bot,
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useEditorStore } from '../stores/useEditorStore'
import { applyMask, getStorageText } from '../lib/mask'
import ReverbTagModal from '../components/ReverbTagModal'
import ExportModal from '../components/ExportModal'
import MetadataDrawer from '../components/MetadataDrawer'
import { TagDrawer } from '../components/TagDrawer'
import { WordTagList } from '../components/WordTagList'
import { TaggedProseView } from '../components/TaggedProseView'
import AIAssistantDrawer from '../components/AIAssistantDrawer'

const AVAILABLE_TAGS = ['glasses', 'door', 'drift', 'postman', 'villager', 'identity', 'recovery', 'threshold', 'mask', 'anchor']

export default function EditorPage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const navigate = useNavigate()
  const { manuscript, updateScene, addWordTag, removeWordTag } = useManuscriptStore()
  const {
    footnoteDrawerOpen,
    footnoteDrawerHeight,
    openFootnoteDrawer,
    closeFootnoteDrawer,
    tagDrawerOpen,
    activeTag,
    openTagDrawer,
    closeTagDrawer,
    setActiveTag,
    showReverbTagging,
    setShowReverbTagging,
    selectedText,
    setSelection,
    clearSelection,
    focusMode,
    toggleFocusMode,
    markSaved,
    textSize,
    cycleTextSize,
    showAIAssistant,
    setShowAIAssistant,
    sessionWordsAdded,
    startSession,
    updateSessionWords,
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
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      setTouchStart(null)
      return
    }
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return

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

  // Start session tracking when scene loads
  useEffect(() => {
    if (scene) {
      startSession(scene.wordCount)
    }
  }, [scene?.id])

  // Auto-save indicator
  useEffect(() => {
    if (scene) {
      const timer = setTimeout(() => markSaved(), 500)
      return () => clearTimeout(timer)
    }
  }, [scene?.prose, scene?.footnotes, markSaved])

  // Redirect if no manuscript
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

  // Track cursor position
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

  // Restore cursor position
  useLayoutEffect(() => {
    if (!isReadMode && proseRef.current && cursorPositionRef.current > 0) {
      const textarea = proseRef.current
      const pos = Math.min(cursorPositionRef.current, textarea.value.length)
      textarea.setSelectionRange(pos, pos)
    }
  }, [localProse, isReadMode])

  // Handle mobile keyboard viewport
  useEffect(() => {
    if (!window.visualViewport) return

    let keyboardVisible = false

    const handleViewportResize = () => {
      const viewport = window.visualViewport
      if (!viewport || !proseRef.current) return

      const viewportHeight = viewport.height
      const windowHeight = window.innerHeight
      const heightDiff = windowHeight - viewportHeight

      if (heightDiff > 150 && document.activeElement === proseRef.current) {
        keyboardVisible = true

        requestAnimationFrame(() => {
          if (proseRef.current && keyboardVisible) {
            const { selectionStart } = proseRef.current
            const lines = proseRef.current.value.substring(0, selectionStart).split('\n').length
            const lineHeight = parseInt(getComputedStyle(proseRef.current).lineHeight) || 24
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

  const handleProseChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!scene || !manuscript) return
    if (isComposing) return

    const newValue = e.target.value
    cursorPositionRef.current = e.target.selectionStart

    setLocalProse(newValue)

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = window.setTimeout(() => {
      const rawText = getStorageText(
        newValue,
        manuscript.protagonistRealName,
        manuscript.maskModeEnabled
      )
      updateScene(scene.id, { prose: rawText })

      // Update session word count
      const newWordCount = rawText.trim().split(/\s+/).filter(Boolean).length
      updateSessionWords(newWordCount)
    }, 200)
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false)
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

      const newWordCount = rawText.trim().split(/\s+/).filter(Boolean).length
      updateSessionWords(newWordCount)
    }
  }

  const handleFootnoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!scene) return
    updateScene(scene.id, { footnotes: e.target.value })
  }

  const handleTextSelect = useCallback(() => {
    const textarea = proseRef.current
    if (!textarea || !scene) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start !== end && end - start > 3) {
      const text = textarea.value.slice(start, end)

      setTimeout(() => {
        if (textarea.selectionStart === start && textarea.selectionEnd === end) {
          if (activeTag) {
            addWordTag({
              sceneId: scene.id,
              tag: activeTag,
              text,
              start,
              end
            })
            clearSelection()
            textarea.setSelectionRange(start, start)
          } else {
            setSelection(text, start, end)
          }
        }
      }, 300)
    } else {
      clearSelection()
    }
  }, [scene, activeTag, addWordTag, clearSelection, setSelection])

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

  const displayProse = isReadMode
    ? applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled)
    : localProse

  const parseFootnotes = (footnotesText: string): string[] => {
    if (!footnotesText.trim()) return []
    return footnotesText
      .split(/\n\n+/)
      .map(note => note.trim())
      .filter(note => note.length > 0)
  }

  const footnotes = parseFootnotes(scene.footnotes)

  // Build section label for AI context
  const sectionLabel = manuscript.scenes.find(s => s.section === scene.section)
    ? scene.section.charAt(0).toUpperCase() + scene.section.slice(1)
    : scene.section

  const aiContext = {
    manuscriptTitle: manuscript.title,
    sectionLabel,
    sceneTitle: scene.title,
    sceneBeat: scene.sceneBeat,
    prose: scene.prose,
  }

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe text-size-${textSize}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Minimal Header */}
      <header className={`flex items-center justify-between px-3 py-3 border-b border-ink-800 focus-fade ${focusMode ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-ink-400" />
          </button>
          <button
            onClick={openTagDrawer}
            className={`p-2 relative ${activeTag ? 'bg-blue-500/20 text-blue-400' : 'text-ink-400'}`}
          >
            <Tag className="w-5 h-5" />
            {scene.wordTags && scene.wordTags.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {scene.wordTags.length}
              </span>
            )}
          </button>
        </div>

        <h1 className="text-base font-medium text-ink-100 truncate flex-1 text-center px-4">
          {scene.title}
        </h1>

        <div className="flex items-center gap-1">
          {/* Session words counter */}
          {sessionWordsAdded > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-xs text-green-400 font-medium px-1"
            >
              +{sessionWordsAdded}
            </motion.span>
          )}
          {/* AI button */}
          <button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className={`p-2 rounded-lg transition-colors ${showAIAssistant ? 'bg-purple-600/20 text-purple-400' : 'text-ink-400'}`}
          >
            <Bot className="w-5 h-5" />
          </button>
          <button onClick={() => setShowDrawer(true)} className="p-2 -mr-2">
            <Menu className="w-5 h-5 text-ink-400" />
          </button>
        </div>
      </header>

      {/* Prose Pane */}
      <div
        className="flex-1 relative min-h-0"
        style={footnoteDrawerOpen ? { height: `${100 - footnoteDrawerHeight}%` } : undefined}
      >
        {isReadMode ? (
          <div className="absolute inset-0 overflow-y-auto p-3 pb-24">
            {!displayProse ? (
              <p className="text-ink-600 italic">No content yet. Switch to Edit mode to start writing.</p>
            ) : scene.wordTags && scene.wordTags.length > 0 ? (
              <TaggedProseView
                prose={displayProse}
                wordTags={scene.wordTags}
                onTagClick={(wordTag) => {
                  if (confirm(`Remove "${wordTag.text}" tag?`)) {
                    removeWordTag(wordTag.id, scene.id)
                  }
                }}
              />
            ) : (
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
              </div>
            )}

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
        ) : (
          <div className="absolute inset-0 overflow-y-auto pb-24" style={{ scrollPaddingBottom: '150px', scrollPaddingTop: '100px' }}>
            <textarea
              ref={proseRef}
              value={displayProse}
              onChange={handleProseChange}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onSelect={handleTextSelect}
              onMouseDown={() => clearSelection()}
              placeholder="Begin writing...

Start a new paragraph by pressing Enter twice.

The Read mode will show your text with proper paragraph formatting."
              className="w-full h-full p-3 bg-transparent text-ink-100 placeholder:text-ink-600 resize-none prose-edit focus:outline-none"
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
              spellCheck={true}
              inputMode="text"
              enterKeyHint="enter"
            />

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
          {selectedText && !isReadMode && !activeTag && (
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

        {/* Word Tags List */}
        {!isReadMode && scene.wordTags && scene.wordTags.length > 0 && (
          <WordTagList
            wordTags={scene.wordTags}
            onRemove={(tagId) => removeWordTag(tagId, scene.id)}
          />
        )}

        {/* Active Tag Indicator */}
        <AnimatePresence>
          {activeTag && !isReadMode && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => setActiveTag(null)}
              className="w-full px-4 py-2 border-t border-ink-800 bg-blue-900/30 text-center active:bg-blue-900/50"
            >
              <span className="text-xs text-blue-400">
                Tagging: <span className="font-semibold capitalize">{activeTag}</span> • Tap to stop
              </span>
            </motion.button>
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
            <div
              className="flex items-center justify-center py-2 cursor-ns-resize"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 bg-ink-600 rounded-full" />
            </div>

            <div className="flex items-center gap-2 px-4 pb-2">
              <MessageSquare className="w-4 h-4 text-ink-500" />
              <span className="text-xs text-ink-500 uppercase tracking-wider">
                Notes / Inner Voice
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
              placeholder="Scene notes, inner voice, ideas..."
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
      <div className={`focus-fade fixed bottom-4 left-0 right-0 flex items-center justify-center gap-4 px-4 pb-safe ${focusMode ? 'opacity-0' : 'opacity-100'}`}>
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
        currentSceneIndex={currentIndex}
        totalScenes={sortedScenes.length}
        allScenes={sortedScenes}
      />

      {/* Tag Drawer */}
      <TagDrawer
        isOpen={tagDrawerOpen}
        onClose={closeTagDrawer}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
        availableTags={AVAILABLE_TAGS}
      />

      {/* AI Assistant Drawer */}
      <AIAssistantDrawer
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        ctx={aiContext}
      />
    </div>
  )
}
