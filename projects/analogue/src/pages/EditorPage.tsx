import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Plus,
  MessageSquare,
  Tag,
  Glasses,
  MoreVertical,
  Eye,
  Edit3,
  Focus,
  ChevronLeft,
  ChevronRight,
  Save,
  Type
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useEditorStore } from '../stores/useEditorStore'
import { applyMask, getStorageText } from '../lib/mask'
import { flagGlassesMention } from '../lib/validation'
import PulseCheck from '../components/PulseCheck'
import ChecklistHeader from '../components/ChecklistHeader'
import SceneTimeline from '../components/SceneTimeline'
import ReverbTagModal from '../components/ReverbTagModal'

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
    lastSavedAt,
    isSaving,
    markSaved,
    textSize,
    cycleTextSize
  } = useEditorStore()

  const proseRef = useRef<HTMLTextAreaElement>(null)
  const footnoteRef = useRef<HTMLTextAreaElement>(null)
  const dragControls = useDragControls()
  const [showMenu, setShowMenu] = useState(false)
  const [isReadMode, setIsReadMode] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)

  const scene = manuscript?.scenes.find(s => s.id === sceneId)

  // Get adjacent scenes for navigation
  const sortedScenes = useMemo(() => {
    if (!manuscript) return []
    return [...manuscript.scenes].sort((a, b) => a.order - b.order)
  }, [manuscript])

  const currentIndex = sortedScenes.findIndex(s => s.id === sceneId)
  const prevScene = currentIndex > 0 ? sortedScenes[currentIndex - 1] : null
  const nextScene = currentIndex < sortedScenes.length - 1 ? sortedScenes[currentIndex + 1] : null

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return
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
    const rawText = getStorageText(
      e.target.value,
      manuscript.protagonistRealName,
      manuscript.maskModeEnabled
    )
    updateScene(scene.id, { prose: rawText })
    checkForGlasses(rawText)
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
    if (start !== end) {
      const text = textarea.value.slice(start, end)
      setSelection(text, start, end)
    } else {
      clearSelection()
    }
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

  const displayProse = applyMask(
    scene.prose,
    manuscript.protagonistRealName,
    manuscript.maskModeEnabled
  )

  // Format time since last save
  const getSaveStatus = () => {
    if (isSaving) return 'Saving...'
    if (!lastSavedAt) return ''
    const secs = Math.floor((Date.now() - lastSavedAt) / 1000)
    if (secs < 5) return 'Saved'
    if (secs < 60) return `${secs}s ago`
    return `${Math.floor(secs / 60)}m ago`
  }

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe text-size-${textSize} ${focusMode ? 'focus-mode-active' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pinned Header Checklist */}
      <div className="focus-fade">
        <ChecklistHeader scene={scene} />
      </div>

      {/* Scene Timeline */}
      <div className="focus-fade">
        <SceneTimeline
          scenes={sortedScenes}
          currentSceneId={scene.id}
          currentChapterId={scene.chapterId}
        />
      </div>

      {/* Editor Header */}
      <header className="focus-fade flex items-center justify-between p-3 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>

        <div className="text-center flex-1 min-w-0">
          <h1 className="text-sm font-medium text-ink-100 truncate px-4">
            {scene.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs text-ink-500">
            <span>{scene.wordCount} words</span>
            {lastSavedAt && (
              <>
                <span>·</span>
                <span className={isSaving ? 'save-indicator' : ''}>
                  <Save className="w-3 h-3 inline mr-1" />
                  {getSaveStatus()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 -mr-2">
            <MoreVertical className="w-5 h-5 text-ink-400" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-48 bg-ink-900 border border-ink-700 rounded-lg shadow-xl z-50"
              >
                <button
                  onClick={() => {
                    setShowPulseCheck(true)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  <Check className="w-4 h-4" />
                  Redo Pulse Check
                </button>
                <button
                  onClick={() => {
                    toggleFocusMode()
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  <Focus className="w-4 h-4" />
                  {focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
                </button>
                <button
                  onClick={() => {
                    cycleTextSize()
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm text-ink-200 hover:bg-ink-800"
                >
                  <Type className="w-4 h-4" />
                  Text Size: {textSize.charAt(0).toUpperCase() + textSize.slice(1)}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Mode toggle */}
      <div className="focus-fade flex items-center justify-between px-4 py-2 border-b border-ink-800 bg-ink-900/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsReadMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              !isReadMode
                ? 'bg-section-departure text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => setIsReadMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              isReadMode
                ? 'bg-section-departure text-white'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Read
          </button>
        </div>
        <span className="text-xs text-ink-500">
          {scene.section}
        </span>
      </div>

      {/* Prose Pane */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{ height: footnoteDrawerOpen ? `${100 - footnoteDrawerHeight}%` : '100%' }}
      >
        {isReadMode ? (
          /* Read mode - formatted paragraphs */
          <div className="flex-1 overflow-y-auto p-4 pb-safe">
            <div className="prose-container max-w-none">
              {displayProse.split(/\n\n+/).map((paragraph, i) => (
                paragraph.trim() && (
                  <p
                    key={i}
                    className="text-ink-100 text-base leading-loose mb-6 first:mt-0"
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
            </div>
          </div>
        ) : (
          /* Edit mode - textarea with serif font */
          <textarea
            ref={proseRef}
            value={displayProse}
            onChange={handleProseChange}
            onSelect={handleTextSelect}
            placeholder="Begin writing...

Start a new paragraph by pressing Enter twice.

The Read mode will show your text with proper paragraph formatting."
            className="flex-1 w-full p-4 bg-transparent text-ink-100 placeholder:text-ink-600 resize-none prose-edit"
          />
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

      {/* Glasses indicator */}
      {scene.glassesmentions.some(m => m.flagged) && (
        <div className="focus-fade absolute bottom-20 left-4 px-3 py-2 bg-status-yellow/20 border border-status-yellow/50 rounded-lg flex items-center gap-2">
          <Glasses className="w-4 h-4 text-status-yellow" />
          <span className="text-xs text-status-yellow">
            {scene.glassesmentions.filter(m => m.flagged).length} glasses mention(s) flagged
          </span>
        </div>
      )}

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
    </div>
  )
}
