import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  TrendingUp,
  BookOpen,
  Edit3,
  Target,
} from 'lucide-react'
import type { ManuscriptState } from '../types/manuscript'

interface StoryDashboardProps {
  manuscript: ManuscriptState
  onBack: () => void
}

const SECTION_IDS = ['departure', 'escape', 'rupture', 'alignment', 'reveal'] as const
const SECTION_LABELS: Record<string, string> = {
  departure: 'Departure',
  escape: 'The Escape',
  rupture: 'The Rupture',
  alignment: 'The Alignment',
  reveal: 'The Reveal',
}
const SECTION_TARGETS: Record<string, number> = {
  departure: 15000,
  escape: 12000,
  rupture: 8000,
  alignment: 10000,
  reveal: 10000,
}
const SECTION_COLORS: Record<string, string> = {
  departure: 'from-blue-500 to-blue-400',
  escape: 'from-green-500 to-green-400',
  rupture: 'from-red-500 to-red-400',
  alignment: 'from-purple-500 to-purple-400',
  reveal: 'from-amber-500 to-amber-400',
}
const SECTION_TEXT_COLORS: Record<string, string> = {
  departure: 'text-blue-400',
  escape: 'text-green-400',
  rupture: 'text-red-400',
  alignment: 'text-purple-400',
  reveal: 'text-amber-400',
}

export default function StoryDashboard({ manuscript, onBack }: StoryDashboardProps) {
  const navigate = useNavigate()

  const sectionProgress = SECTION_IDS.map(section => {
    const scenesInSection = manuscript.scenes.filter(s => s.section === section)
    const words = scenesInSection.reduce((sum, s) => sum + s.wordCount, 0)
    const target = SECTION_TARGETS[section]
    const progress = Math.min(100, (words / target) * 100)
    const completed = scenesInSection.filter(s => s.status === 'complete').length

    return {
      section,
      label: SECTION_LABELS[section],
      color: SECTION_COLORS[section],
      textColor: SECTION_TEXT_COLORS[section],
      words,
      target,
      progress,
      sceneCount: scenesInSection.length,
      completedScenes: completed,
    }
  })

  const lastEditedScene = manuscript.lastEditedSceneId
    ? manuscript.scenes.find(s => s.id === manuscript.lastEditedSceneId)
    : null

  const formatLastEdited = () => {
    if (!manuscript.lastEditedAt) return null
    const date = new Date(manuscript.lastEditedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const thisWeekWords = (manuscript.sessions || [])
    .filter(s => {
      const sessionDate = new Date(s.date)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return sessionDate >= weekAgo
    })
    .reduce((sum, s) => sum + s.wordsAdded, 0)

  const totalTarget = SECTION_IDS.reduce((sum, s) => sum + SECTION_TARGETS[s], 0)
  const overallProgress = Math.min(100, (manuscript.totalWordCount / totalTarget) * 100)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-ink-800">
        <button onClick={onBack} className="p-2 -ml-2 text-ink-400">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-50 truncate">{manuscript.title}</h1>
          <p className="text-xs text-ink-500">{manuscript.totalWordCount.toLocaleString()} words total</p>
        </div>
        <button
          onClick={() => navigate('/toc')}
          className="px-3 py-1.5 bg-ink-800 rounded-lg text-xs text-ink-300 hover:text-ink-100"
        >
          Open
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-safe">
        {/* Quick Resume */}
        {lastEditedScene && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/edit/${lastEditedScene.id}`)}
            className="w-full p-4 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Edit3 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-400 font-medium">Continue writing</span>
                </div>
                <h3 className="text-sm font-medium text-ink-100 mb-1 truncate">
                  {lastEditedScene.title}
                </h3>
                <div className="text-xs text-ink-500">
                  {formatLastEdited()} · {lastEditedScene.wordCount.toLocaleString()} words
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.button>
        )}

        {/* Overall progress */}
        <div className="p-4 bg-ink-900/50 border border-ink-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-ink-500" />
              <span className="text-ink-300 font-medium">Overall</span>
            </div>
            <span className="text-ink-400">{Math.round(overallProgress)}%</span>
          </div>
          <div className="h-3 bg-ink-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 rounded-full"
            />
          </div>
          <p className="text-xs text-ink-500">
            {manuscript.totalWordCount.toLocaleString()} / {totalTarget.toLocaleString()} words
          </p>
        </div>

        {/* This Week */}
        {thisWeekWords > 0 && (
          <div className="p-4 bg-ink-900/50 border border-ink-800 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-ink-300">This Week</h3>
            </div>
            <div className="text-2xl font-bold text-ink-100">
              {thisWeekWords.toLocaleString()}
            </div>
            <div className="text-xs text-ink-500">words written</div>
          </div>
        )}

        {/* Section Progress */}
        <div>
          <h3 className="text-sm font-medium text-ink-300 mb-3 px-1">By Section</h3>
          <div className="space-y-4">
            {sectionProgress.map((section, i) => (
              <motion.div
                key={section.section}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={section.textColor}>{section.label}</span>
                  <span className="text-ink-500">
                    {section.words.toLocaleString()} / {section.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-2.5 bg-ink-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${section.progress}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                    className={`h-full bg-gradient-to-r ${section.color} rounded-full`}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-600">
                  <span>{section.sceneCount} scene{section.sceneCount !== 1 ? 's' : ''}</span>
                  {section.completedScenes > 0 && (
                    <span>· {section.completedScenes} complete</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* All Scenes */}
        <button
          onClick={() => navigate('/toc')}
          className="w-full p-4 bg-ink-900/30 border border-ink-800 border-dashed rounded-xl text-ink-400 hover:text-ink-200 hover:border-ink-600 transition-colors"
        >
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">View All Scenes</span>
          </div>
        </button>
      </div>
    </div>
  )
}
