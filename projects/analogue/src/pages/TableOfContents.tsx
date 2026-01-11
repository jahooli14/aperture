import { useState } from 'react'
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
  Circle
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { NarrativeSection, ValidationStatus } from '../types/manuscript'

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
  const { manuscript, createScene, toggleMaskMode } = useManuscriptStore()
  const [showAddScene, setShowAddScene] = useState<NarrativeSection | null>(null)
  const [newSceneTitle, setNewSceneTitle] = useState('')

  if (!manuscript) return null

  const scenesBySection = SECTIONS.map(section => ({
    ...section,
    scenes: manuscript.scenes.filter(s => s.section === section.id)
  }))

  const handleAddScene = async () => {
    if (!showAddScene || !newSceneTitle.trim()) return
    const scene = await createScene(showAddScene, newSceneTitle.trim())
    setShowAddScene(null)
    setNewSceneTitle('')
    navigate(`/edit/${scene.id}`)
  }

  return (
    <div className="flex-1 flex flex-col bg-ink-950 pt-safe">
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
      <div className="flex-1 overflow-y-auto pb-safe">
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
                return (
                  <motion.button
                    key={scene.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onClick={() => navigate(`/edit/${scene.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 pl-12 text-left hover:bg-ink-900/50 transition-colors"
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
                  </motion.button>
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
    </div>
  )
}
