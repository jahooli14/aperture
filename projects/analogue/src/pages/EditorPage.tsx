import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Plus,
  MessageSquare,
  Tag,
  Glasses,
  MoreVertical
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useEditorStore } from '../stores/useEditorStore'
import { applyMask, getStorageText } from '../lib/mask'
import { flagGlassesMention } from '../lib/validation'
import PulseCheck from '../components/PulseCheck'
import ChecklistHeader from '../components/ChecklistHeader'
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
    clearSelection
  } = useEditorStore()

  const proseRef = useRef<HTMLTextAreaElement>(null)
  const footnoteRef = useRef<HTMLTextAreaElement>(null)
  const dragControls = useDragControls()
  const [showMenu, setShowMenu] = useState(false)

  const scene = manuscript?.scenes.find(s => s.id === sceneId)

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
        <p className="text-ink-500">Scene not found</p>
      </div>
    )
  }

  const displayProse = applyMask(
    scene.prose,
    manuscript.protagonistRealName,
    manuscript.maskModeEnabled
  )

  return (
    <div className="flex-1 flex flex-col bg-ink-950 pt-safe">
      {/* Pinned Header Checklist */}
      <ChecklistHeader scene={scene} />

      {/* Editor Header */}
      <header className="flex items-center justify-between p-3 border-b border-ink-800">
        <button onClick={() => navigate('/toc')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>

        <div className="text-center flex-1 min-w-0">
          <h1 className="text-sm font-medium text-ink-100 truncate px-4">
            {scene.title}
          </h1>
          <p className="text-xs text-ink-500">{scene.wordCount} words</p>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Prose Pane (70%) */}
      <div
        className="flex-1 flex flex-col"
        style={{ height: footnoteDrawerOpen ? `${100 - footnoteDrawerHeight}%` : '100%' }}
      >
        <textarea
          ref={proseRef}
          value={displayProse}
          onChange={handleProseChange}
          onSelect={handleTextSelect}
          placeholder="Begin writing..."
          className="flex-1 w-full p-4 bg-transparent text-ink-100 text-base leading-relaxed placeholder:text-ink-600 resize-none"
        />

        {/* Selection toolbar */}
        <AnimatePresence>
          {selectedText && (
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
            className="fixed bottom-20 right-4 w-12 h-12 bg-ink-800 border border-ink-700 rounded-full flex items-center justify-center shadow-lg pb-safe"
          >
            <Plus className="w-5 h-5 text-ink-400" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Glasses indicator */}
      {scene.glassesmentions.some(m => m.flagged) && (
        <div className="absolute bottom-20 left-4 px-3 py-2 bg-status-yellow/20 border border-status-yellow/50 rounded-lg flex items-center gap-2">
          <Glasses className="w-4 h-4 text-status-yellow" />
          <span className="text-xs text-status-yellow">
            {scene.glassesmentions.filter(m => m.flagged).length} glasses mention(s) flagged
          </span>
        </div>
      )}

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
