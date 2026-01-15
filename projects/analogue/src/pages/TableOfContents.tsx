import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Eye,
  EyeOff,
  ArrowLeft,
  Ear,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Circle,
  Trash2,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  X
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { NarrativeSection, ValidationStatus, SceneNode } from '../types/manuscript'

const SECTIONS: { id: NarrativeSection; label: string; icon: typeof Eye }[] = [
  { id: 'departure', label: 'Departure', icon: Eye },
  { id: 'escape', label: 'The Escape', icon: Eye },
  { id: 'rupture', label: 'The Rupture', icon: AlertCircle },
  { id: 'alignment', label: 'The Alignment', icon: Sparkles },
  { id: 'reveal', label: 'The Reveal', icon: BookOpen }
]

const STATUS_ICONS: Record<ValidationStatus, typeof CheckCircle2> = {
  green: CheckCircle2,
  yellow: Circle,
  red: AlertCircle
}

const STATUS_COLORS: Record<ValidationStatus, string> = {
  green: 'text-status-green',
  yellow: 'text-status-yellow',
  red: 'text-status-red'
}

export default function TableOfContents() {
  const navigate = useNavigate()
  const { manuscript, createScene, deleteScene, reorderScenes, toggleMaskMode } = useManuscriptStore()
  const [showAddScene, setShowAddScene] = useState<NarrativeSection | null>(null)
  const [newSceneTitle, setNewSceneTitle] = useState('')
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Redirect if no manuscript after a brief delay (allows for store hydration)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!manuscript) {
        navigate('/', { replace: true })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [manuscript, navigate])

  if (!manuscript) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ink-600 border-t-ink-300 rounded-full animate-spin" />
      </div>
    )
  }

  const scenesBySection = SECTIONS.map(section => ({
    ...section,
    scenes: manuscript.scenes.filter(s => s.section === section.id).sort((a, b) => a.order - b.order)
  }))

  const handleAddScene = async () => {
    if (!showAddScene || !newSceneTitle.trim()) return
    const scene = await createScene(showAddScene, newSceneTitle.trim())
    setShowAddScene(null)
    setNewSceneTitle('')
    navigate(`/edit/${scene.id}`)
  }

  const handleDeleteScene = async (sceneId: string) => {
    await deleteScene(sceneId)
    setDeleteConfirm(null)
    setEditingScene(null)
  }

  const handleMoveScene = async (scene: SceneNode, direction: 'up' | 'down') => {
    const sectionScenes = manuscript.scenes
      .filter(s => s.section === scene.section)
      .sort((a, b) => a.order - b.order)

    const currentIndex = sectionScenes.findIndex(s => s.id === scene.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= sectionScenes.length) return

    // Swap the scenes
    const newOrder = [...sectionScenes]
    ;[newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]]

    // Get all scenes maintaining their order
    const otherScenes = manuscript.scenes.filter(s => s.section !== scene.section)
    const reorderedIds = [...otherScenes, ...newOrder].sort((a, b) => {
      if (a.section !== b.section) {
        const sectionOrder = ['departure', 'escape', 'rupture', 'alignment', 'reveal']
        return sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section)
      }
      return a.order - b.order
    }).map(s => s.id)

    await reorderScenes(reorderedIds)
    setEditingScene(null)
  }

  const getScenePosition = (scene: SceneNode) => {
    const sectionScenes = manuscript.scenes
      .filter(s => s.section === scene.section)
      .sort((a, b) => a.order - b.order)
    const index = sectionScenes.findIndex(s => s.id === scene.id)
    return {
      isFirst: index === 0,
      isLast: index === sectionScenes.length - 1
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-ink-800">
        <button onClick={() => navigate('/')} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-medium text-ink-100">{manuscript.title}</h1>
          <p className="text-xs text-ink-500">
            {manuscript.totalWordCount.toLocaleString()} words
          </p>
        </div>

        <button
          onClick={() => toggleMaskMode()}
          className="p-2 -mr-2"
          title={manuscript.maskModeEnabled ? 'Unmask YYYY' : 'Mask protagonist'}
        >
          {manuscript.maskModeEnabled ? (
            <EyeOff className="w-5 h-5 text-section-departure" />
          ) : (
            <Eye className="w-5 h-5 text-ink-400" />
          )}
        </button>
      </header>

      {/* Quick actions */}
      <div className="flex gap-2 p-4 border-b border-ink-800 overflow-x-auto">
        <button
          onClick={() => navigate('/sensory')}
          className="flex items-center gap-2 px-3 py-2 bg-ink-900 rounded-lg text-xs text-ink-300 whitespace-nowrap"
        >
          <Ear className="w-4 h-4" />
          Sensory Audit
        </button>
        <button
          onClick={() => navigate('/reverberations')}
          className="flex items-center gap-2 px-3 py-2 bg-ink-900 rounded-lg text-xs text-ink-300 whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          Reverberations
        </button>
        {manuscript.revealAuditUnlocked && (
          <button
            onClick={() => navigate('/reveal')}
            className="flex items-center gap-2 px-3 py-2 bg-section-reveal/20 rounded-lg text-xs text-section-reveal whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4" />
            Reveal Audit
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-safe">
        {scenesBySection.map(section => (
          <div key={section.id} className="border-b border-ink-800">
            <div
              className={`flex items-center gap-3 p-4 border-l-2 section-${section.id}`}
            >
              <section.icon className="w-4 h-4 text-ink-400" />
              <span className="text-sm font-medium text-ink-200">
                {section.label}
              </span>
              <span className="text-xs text-ink-500">
                {section.scenes.length} scene{section.scenes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Scenes in section */}
            <AnimatePresence>
              {section.scenes.map(scene => {
                const StatusIcon = STATUS_ICONS[scene.validationStatus]
                const isEditing = editingScene === scene.id
                const { isFirst, isLast } = getScenePosition(scene)

                return (
                  <motion.div
                    key={scene.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    <div className="flex items-center">
                      <button
                        onClick={() => navigate(`/edit/${scene.id}`)}
                        className="flex-1 flex items-center gap-3 px-4 py-3 pl-12 text-left hover:bg-ink-900/50 transition-colors"
                      >
                        <StatusIcon
                          className={`w-4 h-4 ${STATUS_COLORS[scene.validationStatus]}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink-100 truncate">
                            {scene.title}
                          </div>
                          <div className="text-xs text-ink-500">
                            {scene.wordCount} words
                            {scene.sensoryFocus && ` · ${scene.sensoryFocus}`}
                          </div>
                        </div>
                      </button>

                      {/* Scene actions toggle */}
                      <button
                        onClick={() => setEditingScene(isEditing ? null : scene.id)}
                        className="p-3 text-ink-500 hover:text-ink-300"
                      >
                        {isEditing ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Scene actions panel */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-4 py-2 pl-12 bg-ink-900/50">
                            {/* Move up */}
                            <button
                              onClick={() => handleMoveScene(scene, 'up')}
                              disabled={isFirst}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-ink-400 hover:text-ink-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3 h-3" />
                              Up
                            </button>

                            {/* Move down */}
                            <button
                              onClick={() => handleMoveScene(scene, 'down')}
                              disabled={isLast}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-ink-400 hover:text-ink-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3 h-3" />
                              Down
                            </button>

                            <div className="flex-1" />

                            {/* Delete */}
                            <button
                              onClick={() => setDeleteConfirm(scene.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Add scene button */}
            {showAddScene === section.id ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-3 pl-12"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSceneTitle}
                    onChange={(e) => setNewSceneTitle(e.target.value)}
                    placeholder="Scene title"
                    className="flex-1 px-3 py-2 bg-ink-900 border border-ink-700 rounded text-sm text-ink-100 placeholder:text-ink-600"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddScene()
                      if (e.key === 'Escape') setShowAddScene(null)
                    }}
                  />
                  <button
                    onClick={handleAddScene}
                    disabled={!newSceneTitle.trim()}
                    className="px-3 py-2 bg-ink-700 rounded text-sm text-ink-100 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setShowAddScene(section.id)}
                className="w-full flex items-center gap-2 px-4 py-2 pl-12 text-ink-500 text-xs hover:text-ink-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add scene
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-ink-900 border border-ink-700 rounded-xl p-5"
            >
              <h3 className="text-ink-100 font-medium mb-2">Delete Scene?</h3>
              <p className="text-ink-400 text-sm mb-4">
                This will permanently delete "{manuscript.scenes.find(s => s.id === deleteConfirm)?.title}" and its content.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 p-3 border border-ink-700 rounded-lg text-ink-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteScene(deleteConfirm)}
                  className="flex-1 p-3 bg-red-600 rounded-lg text-white font-medium"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
